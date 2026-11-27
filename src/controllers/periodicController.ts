import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { leagueStore } from '../repositories/leagueStore';
import { IDOLS } from '../data/idols';
import { today } from '../services/dates';
import { currentPeriod, periodicPoints, validSelections } from '../services/periodicVoting';
import type { PeriodicVoteKind } from '../types/idols';

const kinds: PeriodicVoteKind[]=['weekly_artists','weekly_idols','monthly_artists','monthly_idols'];
export function catalog(_req: AuthenticatedRequest,res:Response) {
  res.setHeader('Cache-Control','no-store');
  const artists=leagueStore.getAllArtists().filter(a=>a.status==='approved'&&a.isEligible);
  const season=leagueStore.getActiveSeason()||null;
  const periods=Object.fromEntries(kinds.map(kind=>[kind,currentPeriod(kind)]));
  const results=Object.fromEntries(kinds.map(kind=>{
    const key=currentPeriod(kind);const votes=leagueStore.periodicSubmissions.filter(v=>v.seasonId===season?.id&&v.kind===kind&&v.periodKey===key);
    const isArtist=kind.endsWith('artists');const catalogItems=isArtist?artists:IDOLS;
    const categoryResults=Object.fromEntries((['male','female'] as const).map(category=>{
      const ids = catalogItems.filter(item => item.category === category).map(item => item.id);
      const score = season ? periodicPoints(votes, season.id, kind, ids, category).filter(row => row.points > 0) : [];
      const ranked=score.map(({id,points})=>{const item=catalogItems.find(candidate=>candidate.id===id);return {item,points,name:item?('displayName' in item?item.displayName:item.name):''};}).filter((entry):entry is {item:NonNullable<typeof entry.item>;points:number;name:string}=>!!entry.item).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).slice(0,10).map(({item,points})=>({item,points}));
      return [category,ranked];
    }));return [kind,{periodKey:key,voters:votes.length,...categoryResults}];
  }));
  return res.json({season,artists,idols:IDOLS,periods,results});
}
export function mine(req:AuthenticatedRequest,res:Response) {
  const season=leagueStore.getActiveSeason();
  res.setHeader('Cache-Control','no-store');
  const votes=leagueStore.periodicSubmissions.filter(v=>v.seasonId===season?.id&&v.participantId===req.user!.id);
  return res.json({seasonId:season?.id||null,periods:Object.fromEntries(kinds.map(kind=>[kind,{periodKey:currentPeriod(kind),submission:votes.find(v=>v.kind===kind&&v.periodKey===currentPeriod(kind))||null}]))});
}
export async function submit(req:AuthenticatedRequest,res:Response) {
  const {kind,selections,periodKey,seasonId}=req.body||{};
  const season=leagueStore.getActiveSeason();
  const date=today();
  if(!kinds.includes(kind)) return res.status(400).json({error:'Tipo de votación desconocido.'});
  const current=currentPeriod(kind);
  if(!season||season.startDate>today()) return res.status(403).json({error:'No hay una temporada activa.'});
  if(seasonId!==season.id||periodKey!==current) return res.status(409).json({error:'Cambió la temporada o el periodo. Actualiza la página.'});
  if(!validSelections(kind,selections,{artists:leagueStore.getAllArtists(),idols:IDOLS})) return res.status(400).json({error:'Revisa la cantidad, categoría y orden de tus selecciones.'});
  try {
    if(leagueStore.periodicSubmissions.some(v=>v.seasonId===season.id&&v.participantId===req.user!.id&&v.kind===kind&&v.periodKey===current)) return res.status(409).json({error:'Ya enviaste tu voto para este periodo.'});
    await leagueStore.savePeriodicSubmission({seasonId:season.id,participantId:req.user!.id,kind,periodKey:current,submittedDate:date,selections});
  } catch(error:any) {
    if(error.status===409||error.code==='23505') return res.status(409).json({error:error.message||'Este voto ya fue registrado.'});
    if(error.code==='42P01') return res.status(503).json({error:'Ejecuta la migración SQL de votos periódicos en Supabase.'});
    throw error;
  }
  return res.status(201).json({success:true});
}
