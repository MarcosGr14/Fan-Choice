// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: SPOTIFY DUO CHARTS HTTP INTEGRATION PROVIDER
// ==============================================================================

import { DailyArtistListeningRecord, SyncStatus } from '../types';
import { ListeningDataProvider, ListeningDataProviderResult } from './listeningDataProvider';

export interface DuoChartsApiResponse {
  success: boolean;
  date: string;
  timezone: string;
  synced_at: string;
  accounts: Array<{
    id: number;
    spotify_user_id: string;
    nombre_display: string;
    necesita_reconexion: boolean;
  }>;
  total_records: number;
  records: Array<{
    spotify_artist_id: string;
    artist_name: string;
    image_url: string | null;
    competition_date: string;
    account_1_streams: number;
    account_2_streams: number;
    combined_streams: number;
  }>;
}

export class SpotifyDuoChartsProvider implements ListeningDataProvider {
  public name = 'SpotifyDuoChartsProvider';
  public isMock = false;

  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl?: string, apiToken?: string) {
    this.baseUrl = (baseUrl || 'http://127.0.0.1:3000').replace(/\/$/, '');
    this.apiToken = apiToken || '';
  }

  async getDailyListeningStats(date: string, artistIds?: string[]): Promise<ListeningDataProviderResult> {
    const url = `${this.baseUrl}/api/integrations/daily-artist-streams?date=${encodeURIComponent(date)}${artistIds ? '&artist_ids='+encodeURIComponent(artistIds.join(',')) : ''}`;
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };

      if (this.apiToken) {
        headers['x-integration-token'] = this.apiToken;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data: DuoChartsApiResponse = await response.json();

      if (data.success !== true || data.date !== date || !Array.isArray(data.records)) {
        throw new Error('Respuesta inválida de Duo Charts: se conservarán los datos anteriores.');
      }
      for (const item of data.records) {
        if (!item || typeof item.spotify_artist_id !== 'string' || !item.spotify_artist_id ||
            item.competition_date !== date ||
            ![item.account_1_streams, item.account_2_streams, item.combined_streams].every((n) => Number.isSafeInteger(n) && n >= 0) ||
            item.combined_streams !== item.account_1_streams + item.account_2_streams) {
          throw new Error('Duo Charts devolvió un registro inválido.');
        }
      }

      const records: DailyArtistListeningRecord[] = (data.records || []).map((item) => ({
        spotifyArtistId: item.spotify_artist_id,
        artistName: item.artist_name,
        imageUrl: item.image_url || undefined,
        competitionDate: item.competition_date || date,
        account1Streams: item.account_1_streams || 0,
        account2Streams: item.account_2_streams || 0,
        combinedStreams: item.combined_streams || 0,
        dataStatus: 'available',
      }));

      return {
        records,
        syncTimestamp: data.synced_at || new Date().toISOString(),
        isMock: false,
        status: 'success' as SyncStatus,
        providerName: this.name,
      };
    } catch (error: any) {
      console.error(`[SpotifyDuoChartsProvider] Failed to fetch listening stats for ${date}:`, error.message);

      return {
        records: [],
        syncTimestamp: new Date().toISOString(),
        isMock: false,
        status: 'failed' as SyncStatus,
        providerName: this.name,
      };
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/api/integrations/health`;

    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.apiToken) {
        headers['x-integration-token'] = this.apiToken;
      }

      const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          ok: false,
          latencyMs,
          message: `Duo Charts Integration responded with HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        ok: true,
        latencyMs,
        message: `Connected to Duo Charts. Timezone: ${data.timezone || 'unknown'}. Server time: ${data.timestamp || 'ok'}`,
      };
    } catch (error: any) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        message: `Connection failed: ${error.message}`,
      };
    }
  }
}
