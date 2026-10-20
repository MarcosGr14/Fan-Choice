import { rankIdols } from '../services/idolService';
// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: ADMIN CONTROLLER (ROLE = 'admin')
// ==============================================================================

import { randomUUID } from 'node:crypto';
import { today, validDate } from '../services/dates';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { leagueStore } from '../repositories/leagueStore';
import { SeasonService } from '../services/seasonService';
import { syncService } from '../services/syncService';
import { Artist, Category, ArtistType, GroupType, MusicScene } from '../types';

const seasonService = new SeasonService();

export async function createSeason(req: AuthenticatedRequest, res: Response) {
  const { name, description, startDate } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'El nombre de la temporada es obligatorio.' });
  }

  if (name.trim().length === 0 || name.length > 100 || (description !== undefined && typeof description !== 'string') ||
      (startDate !== undefined && !validDate(startDate))) {
    return res.status(400).json({ success: false, error: 'Nombre, descripción o fecha de inicio inválidos.' });
  }
  const prior = leagueStore.getAllSeasons().filter(s => s.closedAt).sort((a,b) => b.closedAt!.localeCompare(a.closedAt!))[0];
  if (prior && (startDate || today()) <= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(prior.closedAt!))) {
    return res.status(400).json({ success: false, error: 'La nueva temporada debe empezar después del último día de la temporada anterior.' });
  }
  const existingSeasons = leagueStore.getAllSeasons();
  const activationCheck = seasonService.canActivateSeason(existingSeasons);

  if (!activationCheck.allowed) {
    return res.status(409).json({
      success: false,
      error: activationCheck.reason,
    });
  }

  const newSeason = seasonService.createSeason(
    { name, description, startDate },
    existingSeasons,
    true
  );

  await leagueStore.createSeasonPersisted(newSeason);

  return res.status(201).json({
    success: true,
    message: `Temporada '${newSeason.name}' creada y activada con éxito.`,
    season: newSeason,
  });
}

export async function closeSeason(req: AuthenticatedRequest, res: Response) {
  const { seasonId } = req.params;
  const { confirmCode, adminNotes } = req.body;

  if (confirmCode !== 'FREEZE_SEASON') {
    return res.status(400).json({
      success: false,
      error: "Para congelar y archivar la temporada debes enviar confirmCode: 'FREEZE_SEASON'.",
    });
  }

  const season = leagueStore.seasons.get(seasonId);
  if (!season) {
    return res.status(404).json({ success: false, error: `Temporada '${seasonId}' no encontrada.` });
  }

  if (season.status !== 'active') {
    return res.status(400).json({
      success: false,
      error: `La temporada '${season.name}' no está activa (estado: ${season.status}).`,
    });
  }

  // Calculate final cumulative stats
  const standings = leagueStore.computeCumulativeStandings();

  try {
    const closure = seasonService.closeSeason(season, {
      seasonId: season.id,
      adminParticipantId: req.user?.id || 'admin',
      adminDisplayName: req.user?.displayName || 'Admin',
      maleStats: standings.maleStats,
      femaleStats: standings.femaleStats,
      totalVotesCast: [...leagueStore.ballots.values()].filter(b => b.seasonId === season.id).reduce((n,b) => n + b.items.length, 0),
      totalStreamsLogged: [...standings.maleStats, ...standings.femaleStats].reduce((n,s) => n + s.cumulativeStreams, 0),
    });

    closure.archivedRecord.idolRankings = rankIdols(leagueStore.idolSubmissions, season.id);

    // Update in-memory store
    await leagueStore.archiveSeasonPersisted(closure.archivedRecord, closure.frozenResults);

    return res.status(200).json({
      success: true,
      message: `Temporada '${season.name}' cerrada y archivada permanentemente.`,
      archivedRecord: closure.archivedRecord,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function addCuratedArtist(req: AuthenticatedRequest, res: Response) {
  const {
    spotifyArtistId,
    displayName,
    category,
    artistType,
    groupType,
    musicScene,
    originCountry,
    imageUrl,
  } = req.body;

  if (!spotifyArtistId || !displayName || !category) {
    return res.status(400).json({
      success: false,
      error: "spotifyArtistId, displayName y category ('male' | 'female') son obligatorios.",
    });
  }

  if (typeof spotifyArtistId !== 'string' || !/^[a-zA-Z0-9]{22}$/.test(spotifyArtistId) ||
      typeof displayName !== 'string' || !displayName.trim() || displayName.length > 150 ||
      !['male','female'].includes(category) || (artistType && !['soloist','group'].includes(artistType)) ||
      (groupType && !['boy_group','girl_group','mixed_group'].includes(groupType)) ||
      (musicScene && !['kpop','jpop','both'].includes(musicScene)) ||
      (originCountry && !/^[A-Z]{2}$/.test(originCountry)) ||
      (imageUrl && (typeof imageUrl !== 'string' || !/^https:\/\//.test(imageUrl)))) {
    return res.status(400).json({ success: false, error: 'Revisa el ID de Spotify, nombre, categoría, tipo, país e imagen HTTPS.' });
  }
  // Check unique spotifyArtistId
  const existing = leagueStore.getArtistBySpotifyId(spotifyArtistId);
  if (existing) {
    return res.status(409).json({
      success: false,
      error: `El artista con Spotify ID '${spotifyArtistId}' ya existe (${existing.displayName}).`,
    });
  }

  const newArtist: Artist = {
    id: randomUUID(),
    spotifyArtistId,
    displayName,
    searchNormalizedName: displayName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim(),
    imageUrl: imageUrl || '',
    category: category as Category,
    artistType: (artistType || 'group') as ArtistType,
    groupType: groupType as GroupType,
    musicScene: (musicScene || 'kpop') as MusicScene,
    originCountry: originCountry || 'KR',
    status: 'approved',
    isEligible: true,
    eligibilityEffectiveDate: today(),
  };

  await leagueStore.addArtistPersisted(newArtist);

  return res.status(201).json({
    success: true,
    message: `Artista '${newArtist.displayName}' añadido con éxito al catálogo curado.`,
    artist: newArtist,
  });
}

export async function triggerSync(req: AuthenticatedRequest, res: Response) {
  const dateParam = (req.body?.date || req.query?.date || today()) as string;
  if (!validDate(dateParam) || dateParam > today()) return res.status(400).json({ success: false, error: 'Fecha de sincronización inválida.' });

  const syncResult = await syncService.syncDailyStats(dateParam);

  if (!syncResult.success) {
    return res.status(502).json({
      success: false,
      error: syncResult.errorMessage || 'Error en la sincronización con el proveedor de música.',
      syncResult,
    });
  }

  return res.status(200).json({
    success: true,
    message: `Sincronización completada exitosamente para ${dateParam}.`,
    syncResult,
  });
}
