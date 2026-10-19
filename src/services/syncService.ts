// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: IDEMPOTENT LISTENING DATA SYNC SERVICE
// ==============================================================================

import { CONFIG } from '../config';
import { ListeningDataProvider } from './listeningDataProvider';
import { MockListeningDataProvider } from './listeningDataProvider';
import { SpotifyDuoChartsProvider } from './spotifyDuoProvider';
import { leagueStore } from '../repositories/leagueStore';

export class SyncService {
  private provider: ListeningDataProvider;

  constructor() {
    if (CONFIG.USE_MOCK_LISTENING_DATA) {
      this.provider = new MockListeningDataProvider();
    } else {
      this.provider = new SpotifyDuoChartsProvider(
        CONFIG.SPOTIFY_DUO_CHARTS_API_URL,
        CONFIG.SPOTIFY_DUO_CHARTS_API_SECRET
      );
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  isMock(): boolean {
    return this.provider.isMock;
  }

  /**
   * Triggers an idempotent synchronization of daily listening streams for a given competition date.
   * If run multiple times for the same date, replaces existing records and recalculates standings.
   */
  async syncDailyStats(competitionDate: string): Promise<{
    success: boolean;
    recordsProcessed: number;
    provider: string;
    isMock: boolean;
    timestamp: string;
    errorMessage?: string;
    ignoredArtists?: string[];
  }> {
    const startTime = Date.now();
    try {
      const result = await this.provider.getDailyListeningStats(competitionDate, leagueStore.getAllArtists().filter(a=>a.isEligible && a.status==='approved').map(a=>a.spotifyArtistId));

      if (result.status === 'failed') {
        throw new Error('El proveedor de datos reportó un fallo durante la consulta de reproducciones.');
      }

      // Persist to league store (and Postgres when enabled) and recalculate daily scores
      const persisted = await leagueStore.saveListeningRecordsPersisted(competitionDate, result.records);
      if (persisted.ignored > 0) {
        console.log(
          `[SyncService] ${competitionDate}: ${persisted.saved} artistas guardados, ` +
            `${persisted.ignored} ignorados por no estar en el catálogo.`
        );
      }

      leagueStore.lastSyncInfo = {
        timestamp: new Date().toISOString(),
        isMock: result.isMock,
        status: 'success',
        totalRecords: persisted.saved,
      };

      await leagueStore.logSyncRun({
        targetDate: competitionDate,
        providerName: this.provider.name,
        status: 'success',
        recordsProcessed: persisted.saved,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        recordsProcessed: persisted.saved,
        ignoredArtists: result.records.filter(r => !leagueStore.getArtistBySpotifyId(r.spotifyArtistId)).map(r => r.artistName),
        provider: this.provider.name,
        isMock: result.isMock,
        timestamp: leagueStore.lastSyncInfo.timestamp,
      };
    } catch (error: any) {
      console.error(`[SyncService] Sincronización fallida para ${competitionDate}:`, error.message);

      leagueStore.lastSyncInfo = {
        timestamp: new Date().toISOString(),
        isMock: this.provider.isMock,
        status: 'failed',
        totalRecords: 0,
      };

      await leagueStore.logSyncRun({
        targetDate: competitionDate,
        providerName: this.provider.name,
        status: 'failed',
        recordsProcessed: 0,
        errorMessage: error.message,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        recordsProcessed: 0,
        provider: this.provider.name,
        isMock: this.provider.isMock,
        timestamp: leagueStore.lastSyncInfo.timestamp,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Checks provider health and connectivity.
   */
  async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    return this.provider.healthCheck();
  }
}

export const syncService = new SyncService();