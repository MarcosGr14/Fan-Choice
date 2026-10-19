import { CONFIG } from '../config';
import { leagueStore } from '../repositories/leagueStore';
export type LifetimeCounts = {
  account_1_streams: number; account_2_streams: number; combined_streams: number;
  first_played_at: string | null; last_played_at: string | null;
};
export type LifetimeSnapshot = {
  success: true; scope: 'lifetime'; synced_at: string; timezone: string; total_records: number;
  accounts: {id: number; spotify_user_id: string; nombre_display: string; necesita_reconexion: boolean; position: number}[];
  summary: LifetimeCounts;
  records: (LifetimeCounts & {spotify_artist_id: string; artist_name: string; image_url: string | null})[];
};
export function validateLifetimeSnapshot(value: any): asserts value is LifetimeSnapshot {
  const validTime = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  const counts = (v: any) => v && [v.account_1_streams,v.account_2_streams,v.combined_streams].every(n=>Number.isSafeInteger(n)&&n>=0) &&
    v.account_1_streams+v.account_2_streams===v.combined_streams &&
    (v.combined_streams===0 ? v.first_played_at===null && v.last_played_at===null : validTime(v.first_played_at) && validTime(v.last_played_at) && Date.parse(v.first_played_at)<=Date.parse(v.last_played_at));
  if (value?.success!==true || value.scope!=='lifetime' || !validTime(value.synced_at) || !Array.isArray(value.accounts) || value.accounts.length>2 ||
      !value.accounts.every((a:any,i:number)=>a.position===i+1 && typeof a.nombre_display==='string' && typeof a.spotify_user_id==='string') ||
      !counts(value.summary) || !Array.isArray(value.records) || value.total_records!==value.records.length ||
      !value.records.every((r:any)=>counts(r)&&typeof r.spotify_artist_id==='string'&&r.spotify_artist_id&&typeof r.artist_name==='string'&&r.combined_streams<=value.summary.combined_streams) ||
      new Set(value.records.map((r:any)=>r.spotify_artist_id)).size!==value.records.length) {
    throw new Error('Duo Charts devolvió un historial inválido. Se conservan los últimos datos válidos.');
  }
}
export async function syncLifetime() {
  if (CONFIG.USE_MOCK_LISTENING_DATA) throw new Error('El historial requiere el proveedor real de Duo Charts.');
  const ids=leagueStore.getAllArtists().filter(a=>a.isEligible && a.status==='approved').map(a=>a.spotifyArtistId);
  if (!ids.length) throw new Error('El catálogo aprobado está vacío.');
  const from=new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.LEAGUE_TIMEZONE,year:'numeric'}).format(new Date())+'-01-01';
  const params=new URLSearchParams({artist_ids:ids.join(','),from});
  const response = await fetch(`${CONFIG.SPOTIFY_DUO_CHARTS_API_URL.replace(/\/$/,'')}/api/integrations/lifetime-artist-streams?${params}`, {
    headers: {Accept:'application/json','x-integration-token':CONFIG.SPOTIFY_DUO_CHARTS_API_SECRET}, signal:AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(response.status===404 ? 'El endpoint histórico aún no está desplegado en Duo Charts.' : `Duo Charts respondió HTTP ${response.status} al consultar el historial.`);
  const snapshot: unknown = await response.json();
  validateLifetimeSnapshot(snapshot);
  const filter=(snapshot as any).filter;
  if (filter?.from!==from || !Array.isArray(filter.artist_ids) || filter.artist_ids.length!==ids.length || !filter.artist_ids.every((id:string)=>ids.includes(id)) || snapshot.records.some(r=>!ids.includes(r.spotify_artist_id))) throw new Error('El proveedor no aplicó el filtro del catálogo y año.');
  await leagueStore.saveLifetime(snapshot);
  return snapshot;
}
