// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: LISTENING DATA PROVIDER INTERFACE & MOCK ADAPTER
// ==============================================================================

import { DailyArtistListeningRecord, SyncStatus } from '../types';

export interface ListeningDataProviderResult {
  records: DailyArtistListeningRecord[];
  syncTimestamp: string;
  isMock: boolean;
  status: SyncStatus;
  providerName: string;
}

export interface ListeningDataProvider {
  name: string;
  isMock: boolean;
  getDailyListeningStats(date: string, artistIds?: string[]): Promise<ListeningDataProviderResult>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}

/**
 * MockListeningDataProvider:
 * Provides realistic, deterministic daily scrobble data during development & prototyping
 * without contacting external servers or touching Spotify Duo Charts until Phase 0 audit is complete.
 */
export class MockListeningDataProvider implements ListeningDataProvider {
  public name = 'MockListeningDataProvider';
  public isMock = true;

  private sampleStreamDatabase: Record<string, { acc1: number; acc2: number }> = {
    // Male Artists
    '3Nrfpe0tUJi4K4DXYWgMUX': { acc1: 8, acc2: 7 },  // BTS (15 streams -> 4 bonus)
    '2RRICqaOxoFarMt4IUAt20': { acc1: 6, acc2: 5 },  // Stray Kids (11 streams -> 4 bonus)
    '7nqOGRaoylMuNs3k3Wu0NV': { acc1: 5, acc2: 4 },  // SEVENTEEN (9 streams -> 3 bonus)
    '2auC28zjGQ9WrVT9WJ9PDr': { acc1: 7, acc2: 10 }, // Fujii Kaze (17 streams -> 5 bonus)
    '0GhZy2Yr0ggYegbTRUFQRJ': { acc1: 4, acc2: 2 },  // TXT (6 streams -> 3 bonus)
    '5t5FqBwTcgKTaWmfhu4Qz9': { acc1: 3, acc2: 3 },  // ENHYPEN (6 streams -> 3 bonus)
    '0k17h0D3J5VfsdmQ1iZtE9': { acc1: 2, acc2: 1 },  // King Gnu (3 streams -> 2 bonus)
    '6M2wZ9GZgrQXHCF2UCsq4Q': { acc1: 1, acc2: 1 },  // Official HIGE DANdism (2 streams -> 1 bonus)
    '4XpMTGHuTOLnmrA8f52F8H': { acc1: 0, acc2: 2 },  // ATEEZ (2 streams -> 1 bonus)
    '1dfeR4HaWDbWqFsssgP92V': { acc1: 0, acc2: 1 },  // ZEROBASEONE (1 stream -> 1 bonus)
    '4aEekK4uGepqQ9aL3nJ8mF': { acc1: 0, acc2: 0 },  // Vaundy (0 streams -> 0 bonus)
    '23fqKkggKUBV75QuUXR0Pt': { acc1: 1, acc2: 0 },  // SHINee (1 stream -> 1 bonus)

    // Female Artists
    '6RHTUrOAwM0eu2vNk2697t': { acc1: 9, acc2: 9 },  // NewJeans (18 streams -> 5 bonus)
    '6YVMFz59CuY7ngDxTx85hu': { acc1: 7, acc2: 6 },  // aespa (13 streams -> 4 bonus)
    '7n2YcHowGUzyE7k3v8bKQk': { acc1: 6, acc2: 6 },  // TWICE (12 streams -> 4 bonus)
    '64tNsm6TnZe2zpcMVMOo98': { acc1: 8, acc2: 5 },  // YOASOBI (13 streams -> 4 bonus)
    '2KcEbO5mC4b0WfU1bH6gJk': { acc1: 4, acc2: 4 },  // IVE (8 streams -> 3 bonus)
    '4K9IbXvU6b1A9t2fG5pC1m': { acc1: 3, acc2: 5 },  // LE SSERAFIM (8 streams -> 3 bonus)
    '52z4J5hA6i3WpT2G3fD8uP': { acc1: 3, acc2: 2 },  // Ado (5 streams -> 2 bonus)
    '3wR9gK6C2V5sT1bH4gD8mX': { acc1: 2, acc2: 2 },  // BLACKPINK (4 streams -> 2 bonus)
    '1Gj9X7C5p2W3aK1b4d8mRt': { acc1: 1, acc2: 2 },  // ILLIT (3 streams -> 2 bonus)
    '2Hk3T9G5b1C4aP8v7d2mRt': { acc1: 1, acc2: 1 },  // BABYMONSTER (2 streams -> 1 bonus)
    '4dK2G9b1C5aP8v7d3mRt9L': { acc1: 0, acc2: 1 },  // ITZY (1 stream -> 1 bonus)
    '6sL9K2b4C1aP5v7d8mRt3Q': { acc1: 0, acc2: 0 },  // (G)I-DLE (0 streams -> 0 bonus)
  };

  async getDailyListeningStats(date: string): Promise<ListeningDataProviderResult> {
    // Simulate lightweight deterministic latency
    const records: DailyArtistListeningRecord[] = Object.entries(this.sampleStreamDatabase).map(
      ([spotifyArtistId, counts]) => {
        const combined = counts.acc1 + counts.acc2;
        return {
          spotifyArtistId,
          artistName: 'Artist ' + spotifyArtistId.slice(0, 4),
          competitionDate: date,
          account1Streams: counts.acc1,
          account2Streams: counts.acc2,
          combinedStreams: combined,
          dataStatus: 'mock',
        };
      }
    );

    return {
      records,
      syncTimestamp: new Date().toISOString(),
      isMock: true,
      status: 'success',
      providerName: this.name,
    };
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; message: string }> {
    return {
      ok: true,
      latencyMs: 12,
      message: 'MockListeningDataProvider active. Isolated development mode.',
    };
  }
}
