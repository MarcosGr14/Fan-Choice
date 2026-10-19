import { CONFIG } from '../config';
import { leagueStore } from '../repositories/leagueStore';
import { dateRange } from './dates';
import type { DailyArtistListeningRecord } from '../types';
export async function syncListeningRange(from: string,to: string) {
  const ids=leagueStore.getAllArtists().filter(a=>a.isEligible&&a.status==='approved').map(a=>a.spotifyArtistId);
  if(!ids.length) throw new Error('No hay artistas aprobados.');
  const response=await fetch(`${CONFIG.SPOTIFY_DUO_CHARTS_API_URL.replace(/\/$/,'')}/api/integrations/artist-streams-range?${new URLSearchParams({from,to,artist_ids:ids.join(',')})}`,{
    headers:{'x-integration-token':CONFIG.SPOTIFY_DUO_CHARTS_API_SECRET,Accept:'application/json'},signal:AbortSignal.timeout(30000),
  });
  if(!response.ok) throw new Error(`No se pudo importar el rango: HTTP ${response.status}.`);
  const data=await response.json();
  if(data.success!==true||data.from!==from||data.to!==to||!Array.isArray(data.records)||!Array.isArray(data.artist_ids)||data.artist_ids.length!==ids.length||!data.artist_ids.every((id:string)=>ids.includes(id))) throw new Error('Respuesta de rango inválida.');
  const byDate=new Map<string,DailyArtistListeningRecord[]>(dateRange(from,to).map(date=>[date,[]]));
  const seen=new Set<string>();
  for(const r of data.records) {
    const key=r.competition_date+':'+r.spotify_artist_id;
    if(!byDate.has(r.competition_date)||!ids.includes(r.spotify_artist_id)||seen.has(key)||![r.account_1_streams,r.account_2_streams,r.combined_streams].every(n=>Number.isSafeInteger(n)&&n>=0)||r.combined_streams!==r.account_1_streams+r.account_2_streams) throw new Error('Registro de rango inválido.');
    seen.add(key);
    byDate.get(r.competition_date)!.push({spotifyArtistId:r.spotify_artist_id,artistName:r.artist_name,competitionDate:r.competition_date,account1Streams:r.account_1_streams,account2Streams:r.account_2_streams,combinedStreams:r.combined_streams,imageUrl:r.image_url||undefined,dataStatus:'available'});
  }
  await leagueStore.saveListeningRange(from,to,byDate);
  return [...byDate].map(([date,rows])=>({date,success:true,recordsProcessed:rows.length,errorMessage:undefined}));
}
