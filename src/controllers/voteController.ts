// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: VOTES CONTROLLER
// ==============================================================================

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { leagueStore } from '../repositories/leagueStore';
import { VotingService } from '../services/votingService';
import { CONFIG } from '../config';
import { Category } from '../types';

const votingService = new VotingService(CONFIG.LEAGUE_TIMEZONE);

export async function getTodayVotes(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticación requerida.' });
  }

  const competitionDate = votingService.getCompetitionDate();
  const isLocked = !votingService.isVotingOpen(competitionDate);

  const maleBallot = leagueStore.getBallot(req.user.id, 'male', competitionDate);
  const femaleBallot = leagueStore.getBallot(req.user.id, 'female', competitionDate);

  // Map item IDs to display names for convenience
  const formatItems = (items: Array<{ rankPosition: number; artistId: string; pointsAwarded: number }>) => {
    return items.map((i) => {
      const artist = leagueStore.getArtistById(i.artistId);
      return {
        rankPosition: i.rankPosition,
        pointsAwarded: i.pointsAwarded,
        artistId: i.artistId,
        displayName: artist ? artist.displayName : i.artistId,
        imageUrl: artist ? artist.imageUrl : '',
      };
    });
  };

  return res.status(200).json({
    competitionDate,
    isLocked,
    timezone: CONFIG.LEAGUE_TIMEZONE,
    maleBallot: {
      status: maleBallot ? 'saved' : 'unsubmitted',
      items: maleBallot ? formatItems(maleBallot.items) : [],
    },
    femaleBallot: {
      status: femaleBallot ? 'saved' : 'unsubmitted',
      items: femaleBallot ? formatItems(femaleBallot.items) : [],
    },
  });
}

export async function submitBallot(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticación requerida.' });
  }

  const { category, items } = req.body;
  const competitionDate = votingService.getCompetitionDate();

  if (req.body.competitionDate && req.body.competitionDate !== competitionDate) {
    return res.status(409).json({ success: false, error: 'Cambió el día de votación. Actualiza la página antes de guardar.' });
  }
  const activeSeason = leagueStore.getActiveSeason();
  if (!activeSeason || activeSeason.startDate > competitionDate) {
    return res.status(403).json({
      success: false,
      error: 'No hay ninguna temporada activa para registrar votos.',
    });
  }

  // Validate ballot
  const catalogMap = leagueStore.artists;
  const validation = votingService.validateBallot(
    {
      seasonId: activeSeason.id,
      participantId: req.user.id,
      category: category as Category,
      items,
      competitionDate,
    },
    catalogMap
  );

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: validation.errors.join(" "),
      errors: validation.errors,
    });
  }

  // Build and persist normalized ballot
  const ballot = votingService.buildBallot({
    seasonId: activeSeason.id,
    participantId: req.user.id,
    category: category as Category,
    items,
    competitionDate,
  });

  try {
    await leagueStore.saveBallot(ballot);
  } catch (err) {
    console.error('[Voting] No se pudo guardar la papeleta:', err);
    return res.status(503).json({ success: false, error: 'No se pudo guardar la papeleta. Inténtalo de nuevo.' });
  }

  return res.status(200).json({
    success: true,
    message: `Papeleta ${category} guardada con éxito para la fecha ${competitionDate}.`,
    updatedAt: ballot.updatedAt,
    ballot,
  });
}
