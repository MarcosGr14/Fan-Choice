// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: LEAGUE OVERVIEW & ARTISTS CONTROLLER
// ==============================================================================

import { Request, Response } from 'express';
import { leagueStore } from '../repositories/leagueStore';
import { validDate } from '../services/dates';
import { CONFIG } from '../config';

export async function getLeagueOverview(req: Request, res: Response) {
  const targetDate = req.query.date as string | undefined;

  if (targetDate !== undefined && !validDate(targetDate)) return res.status(400).json({success:false,error:'Fecha inválida.'});

  const activeSeason = leagueStore.getActiveSeason();
  const standings = leagueStore.computeCumulativeStandings(targetDate);

  const maleTop10 = standings.maleStats.slice(0, 10).map((s) => ({
    rank: s.currentRank,
    previousRank: s.previousRank,
    rankDelta: s.rankDelta,
    isNewEntry: s.isNewEntry,
    artistId: s.artist.id,
    displayName: s.artist.displayName,
    artistType: s.artist.artistType,
    musicScene: s.artist.musicScene,
    originCountry: s.artist.originCountry,
    totalSeasonPoints: s.cumulativePoints,
    todayPoints: s.todayPoints,
    todayVotePoints: s.todayVotePoints,
    todayListeningBonus: s.todayListeningBonus,
    seasonStreams: s.cumulativeStreams,
    todayStreams: s.todayStreams,
    imageUrl: s.artist.imageUrl,
  }));

  const femaleTop10 = standings.femaleStats.slice(0, 10).map((s) => ({
    rank: s.currentRank,
    previousRank: s.previousRank,
    rankDelta: s.rankDelta,
    isNewEntry: s.isNewEntry,
    artistId: s.artist.id,
    displayName: s.artist.displayName,
    artistType: s.artist.artistType,
    musicScene: s.artist.musicScene,
    originCountry: s.artist.originCountry,
    totalSeasonPoints: s.cumulativePoints,
    todayPoints: s.todayPoints,
    todayVotePoints: s.todayVotePoints,
    todayListeningBonus: s.todayListeningBonus,
    seasonStreams: s.cumulativeStreams,
    todayStreams: s.todayStreams,
    imageUrl: s.artist.imageUrl,
  }));

  // Absolute champion
  let absoluteChampPayload = null;
  if (standings.absoluteChampion) {
    const champ = standings.absoluteChampion;
    const allRanked = [...standings.maleStats, ...standings.femaleStats].sort((a, b) => b.cumulativePoints - a.cumulativePoints);
    const runnerUp = allRanked[1];
    const leadMargin = runnerUp ? champ.cumulativePoints - runnerUp.cumulativePoints : 0;

    absoluteChampPayload = {
      artistId: champ.artist.id,
      displayName: champ.artist.displayName,
      category: champ.artist.category,
      totalPoints: champ.cumulativePoints,
      totalStreams: champ.cumulativeStreams,
      leadMargin,
      imageUrl: champ.artist.imageUrl,
    };
  }

  // Highlights
  const allCurrent = [...standings.maleStats, ...standings.femaleStats];
  const biggestGainer = [...allCurrent].sort((a, b) => b.rankDelta - a.rankDelta)[0];
  const topDaily = [...allCurrent].sort((a, b) => b.todayPoints - a.todayPoints)[0];
  const newEntries = allCurrent.filter((s) => s.isNewEntry).map((s) => s.artist);

  return res.status(200).json({
    season: activeSeason
      ? {
          id: activeSeason.id,
          name: activeSeason.name,
          status: activeSeason.status,
          startDate: activeSeason.startDate,
          daysActive: activeSeason.daysActive,
          timezone: CONFIG.LEAGUE_TIMEZONE,
        }
      : null,
    absoluteChampion: absoluteChampPayload,
    standings,
    maleTop10,
    femaleTop10,
    todayHighlights: {
      biggestGainer: biggestGainer && biggestGainer.rankDelta > 0
        ? { displayName: biggestGainer.artist.displayName, delta: biggestGainer.rankDelta }
        : null,
      topDailyPoints: topDaily && topDaily.todayPoints > 0
        ? { displayName: topDaily.artist.displayName, points: topDaily.todayPoints }
        : null,
      newEntries,
    },
    syncStatus: {
      lastSyncTimestamp: leagueStore.lastSyncInfo.timestamp,
      isMockProvider: leagueStore.lastSyncInfo.isMock,
      status: leagueStore.lastSyncInfo.status,
      totalRecords: leagueStore.lastSyncInfo.totalRecords,
    },
  });
}

export async function getArtistsCatalog(_req: Request, res: Response) {
  const artists = leagueStore.getAllArtists();
  return res.status(200).json({
    total: artists.length,
    artists,
  });
}
