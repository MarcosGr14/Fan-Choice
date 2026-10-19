// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: ARCHIVE CONTROLLER
// ==============================================================================

import { Request, Response } from 'express';
import { leagueStore } from '../repositories/leagueStore';

export async function listArchivedSeasons(_req: Request, res: Response) {
  const archives = Array.from(leagueStore.archivedSeasons.values()).map((rec) => ({
    seasonId: rec.season.id,
    name: rec.season.name,
    startDate: rec.season.startDate,
    closedAt: rec.closedAt,
    closedBy: rec.closedByDisplayName,
    absoluteChampion: rec.absoluteChampion
      ? {
          displayName: rec.absoluteChampion.artist.displayName,
          category: rec.absoluteChampion.artist.category,
          totalPoints: rec.absoluteChampion.cumulativePoints,
        }
      : null,
    totalVotesCast: rec.totalVotesCast,
    totalStreamsLogged: rec.totalStreamsLogged,
  }));

  return res.status(200).json({
    total: archives.length,
    seasons: archives,
  });
}

export async function getArchivedSeasonDetails(req: Request, res: Response) {
  const { seasonId } = req.params;
  const record = leagueStore.archivedSeasons.get(seasonId);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: `Temporada archivada '${seasonId}' no encontrada.`,
    });
  }

  return res.status(200).json({
    success: true,
    archive: record,
  });
}
