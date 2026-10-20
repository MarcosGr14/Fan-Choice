import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { leagueStore } from '../repositories/leagueStore';
import { IDOLS } from '../data/idols';
import { today } from '../services/dates';
import { rankIdols } from '../services/idolService';

export function overview(req: Request, res: Response) {
  const season = req.query.seasonId ? leagueStore.seasons.get(String(req.query.seasonId)) : leagueStore.getActiveSeason();
  if (req.query.seasonId && (!season || season.status === 'draft')) return res.status(404).json({error:'Temporada no encontrada.'});
  const frozen = season ? leagueStore.archivedSeasons.get(season.id)?.idolRankings : undefined;
  res.setHeader('Cache-Control','no-store');
  return res.json({season:season || null, catalog:IDOLS, competitionDate:today(),
    seasons:leagueStore.getAllSeasons().filter(s=>s.status !== 'draft'),
    rankings:frozen || rankIdols(leagueStore.idolSubmissions,season?.id || '')});
}
export function status(req: AuthenticatedRequest, res: Response) {
  const season = leagueStore.getActiveSeason();
  const date = today();
  const submissions = leagueStore.idolSubmissions.filter(s=>s.seasonId===season?.id && s.participantId===req.user!.id);
  res.setHeader('Cache-Control','no-store');
  return res.json({seasonId:season?.id || null,competitionDate:date,
    favorites:submissions.find(s=>s.kind==='favorites')?.idolIds ?? null,
    male:submissions.find(s=>s.kind==='daily' && s.category==='male' && s.competitionDate===date)?.idolIds ?? null,
    female:submissions.find(s=>s.kind==='daily' && s.category==='female' && s.competitionDate===date)?.idolIds ?? null});
}
export async function submit(req: AuthenticatedRequest, res: Response) {
  const {kind,category,idolIds,seasonId,competitionDate} = req.body || {};
  const season = leagueStore.getActiveSeason();
  const date = today();
  if (!season || season.startDate>date) return res.status(403).json({error:'No hay una temporada activa para votar.'});
  if (seasonId!==season.id || competitionDate!==date) return res.status(409).json({error:'Cambió el día o la temporada. Actualiza antes de votar.'});
  if (!['favorites','daily'].includes(kind) || !Array.isArray(idolIds) || idolIds.some(id=>typeof id!=='string') || new Set(idolIds).size!==idolIds.length || idolIds.length>IDOLS.length) return res.status(400).json({error:'Selección inválida o repetida.'});
  if ((kind==='favorites' && category!=='all') || (kind==='daily' && (!['male','female'].includes(category) || idolIds.length!==10))) return res.status(400).json({error:'Elige 10 idols diferentes de la misma categoría.'});
  if (idolIds.some(id=>!IDOLS.some(i=>i.id===id && (kind==='favorites' || i.category===category)))) return res.status(400).json({error:'La selección contiene idols no elegibles.'});
  const own = leagueStore.idolSubmissions.filter(s=>s.seasonId===season.id && s.participantId===req.user!.id);
  if (kind==='daily' && !own.some(s=>s.kind==='favorites')) return res.status(409).json({error:'Guarda primero tus favoritos de temporada.'});
  if (own.some(s=>s.kind===kind && (kind==='favorites' || (s.category===category && s.competitionDate===date)))) return res.status(409).json({error:kind==='favorites'?'Ya guardaste tus favoritos de temporada.':'Ya votaste hoy en esta categoría.'});
  try {
    await leagueStore.saveIdolSubmission({seasonId:season.id,participantId:req.user!.id,kind,category,competitionDate:date,idolIds});
  } catch (error: any) {
    if (error.code==='42P01') return res.status(503).json({error:'La votación de idols estará disponible cuando se complete su configuración en la base de datos.'});
    if (error.code==='23505') return res.status(409).json({error:'Esta selección ya está guardada.'});
    throw error;
  }
  return res.status(201).json({success:true});
}
