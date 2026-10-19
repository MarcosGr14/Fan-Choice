// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: SEASON SERVICE & LIFECYCLE MANAGER
// ==============================================================================

import {
  Season,
  SeasonStatus,
  ArtistCumulativeStats,
  SeasonFrozenResult,
  ArchivedSeasonRecord,
} from '../types';
import { randomUUID } from 'node:crypto';
import { rankLadder, determineAbsoluteChampion } from '../engine/scoringEngine';

export interface CreateSeasonInput {
  name: string;
  description?: string;
  startDate?: string; // YYYY-MM-DD
}

export interface CloseSeasonInput {
  seasonId: string;
  adminParticipantId: string;
  adminDisplayName: string;
  maleStats: ArtistCumulativeStats[];
  femaleStats: ArtistCumulativeStats[];
  closedAt?: string;
  totalVotesCast?: number;
  totalStreamsLogged?: number;
}

export class SeasonService {
  /**
   * Validates whether a new season can be transitioned to active.
   * Enforces the Single-Active Season invariant: only 1 season may be 'active' at a time.
   */
  canActivateSeason(existingSeasons: Season[]): { allowed: boolean; reason?: string } {
    const activeSeason = existingSeasons.find((s) => s.status === 'active');
    if (activeSeason) {
      return {
        allowed: false,
        reason: `Ya existe una temporada activa ('${activeSeason.name}'). Debe cerrarse manualmente antes de activar una nueva.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Creates a new season in 'active' status if no other active season exists, or 'draft'.
   */
  createSeason(
    input: CreateSeasonInput,
    existingSeasons: Season[],
    autoActivate: boolean = true
  ): Season {
    const canActivate = this.canActivateSeason(existingSeasons);
    const status: SeasonStatus = autoActivate && canActivate.allowed ? 'active' : 'draft';

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Panama',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    return {
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim(),
      status,
      startDate: input.startDate || today,
      daysActive: 1,
    };
  }

  /**
   * Executes the manual atomic freeze and closure of an active season.
   * Generates immutable snapshot records: Male Top 10, Female Top 10, and Absolute Champion.
   */
  closeSeason(
    season: Season,
    input: CloseSeasonInput
  ): {
    archivedSeason: Season;
    frozenResults: SeasonFrozenResult[];
    archivedRecord: ArchivedSeasonRecord;
  } {
    if (season.status !== 'active') {
      throw new Error(`La temporada '${season.name}' no está activa (estado actual: ${season.status}). No se puede cerrar.`);
    }

    const freezeTimestamp = input.closedAt || new Date().toISOString();

    // 1. Finalize Male and Female ladders
    const rankedMale = rankLadder(input.maleStats);
    const rankedFemale = rankLadder(input.femaleStats);

    // 2. Determine Absolute Champion across both brackets
    const allStats = [...input.maleStats, ...input.femaleStats];
    const absoluteChampion = determineAbsoluteChampion(allStats);

    if (!absoluteChampion) {
      throw new Error('No fue posible determinar al Campeón Absoluto: lista de artistas vacía.');
    }

    // 3. Build frozen results ledger
    const frozenResults: SeasonFrozenResult[] = [];

    // Male bracket
    rankedMale.forEach((item, idx) => {
      frozenResults.push({
        artistId: item.artist.id,
        category: 'male',
        finalRank: idx + 1,
        isCategoryChampion: idx === 0,
        isAbsoluteChampion: item.artist.id === absoluteChampion.artist.id,
        finalPoints: item.cumulativePoints,
        totalVotePoints: item.cumulativeVotePoints,
        totalBonusPoints: item.cumulativeBonusPoints,
        totalStreams: item.cumulativeStreams,
        daysScored: item.daysWithPoints,
      });
    });

    // Female bracket
    rankedFemale.forEach((item, idx) => {
      frozenResults.push({
        artistId: item.artist.id,
        category: 'female',
        finalRank: idx + 1,
        isCategoryChampion: idx === 0,
        isAbsoluteChampion: item.artist.id === absoluteChampion.artist.id,
        finalPoints: item.cumulativePoints,
        totalVotePoints: item.cumulativeVotePoints,
        totalBonusPoints: item.cumulativeBonusPoints,
        totalStreams: item.cumulativeStreams,
        daysScored: item.daysWithPoints,
      });
    });

    // 4. Mark season archived
    const archivedSeason: Season = {
      ...season,
      status: 'archived',
      closedAt: freezeTimestamp,
      closedBy: input.adminParticipantId,
    };

    // 5. Build full immutable historical record
    const archivedRecord: ArchivedSeasonRecord = {
      season: archivedSeason,
      closedAt: freezeTimestamp,
      closedByDisplayName: input.adminDisplayName,
      absoluteChampion,
      maleTop10: rankedMale.slice(0, 10),
      femaleTop10: rankedFemale.slice(0, 10),
      totalVotesCast: input.totalVotesCast || 0,
      totalStreamsLogged: input.totalStreamsLogged || 0,
    };

    return {
      archivedSeason,
      frozenResults,
      archivedRecord,
    };
  }
}
