import React, { useEffect, useState } from 'react';
import { apiClient } from './services/apiClient';
import type { LifetimeSnapshot } from './services/lifetimeService';
import type { Artist } from './types';
const format = (n: number) => n.toLocaleString('es');
const date = (s: string | null) => s ? new Date(s).toLocaleString('es', {timeZone:'America/Panama'}) : 'Sin registros';
const card = 'league-panel';
export function LifetimeHistory({artists, isAdmin}: {artists:Artist[]; isAdmin:boolean}) {
  const [data,setData]=useState<{snapshot:LifetimeSnapshot;fetchedAt:string}|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [query,setQuery]=useState('');
  const [limit,setLimit]=useState(50);
  async function refresh() {
    const result=await apiClient.request<any>('/league/listening-history');
    if(result.error){setError(result.error);setLoaded(true);return;}
    setData(result.data.available ? result.data : null);setLoaded(true);setError('');
  }
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),60000);return()=>clearInterval(timer);},[]);
  async function sync() {
    setBusy(true);setError('');
    const result=await apiClient.request('/admin/sync/history',{method:'POST',body:'{}'});
    if(result.error) setError(result.error); else await refresh();
    setBusy(false);
  }
  const ids=new Set(artists.filter(a=>a.isEligible&&a.status==='approved').map(a=>a.spotifyArtistId));
  const rows=data?.snapshot.records.filter(r=>ids.has(r.spotify_artist_id)&&r.artist_name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.combined_streams-a.combined_streams||a.artist_name.localeCompare(b.artist_name)) || [];
  const a1=data?.snapshot.accounts[0]?.nombre_display || 'Cuenta 1';
  const a2=data?.snapshot.accounts[1]?.nombre_display || 'Cuenta 2';
  return <section className="space-y-6">
    <div className="flex flex-wrap justify-between gap-4 items-center"><div><p className="text-emerald-300 uppercase tracking-widest text-xs mb-2">Duo Spotify Charts</p><h1 className="text-3xl font-bold">Reproducciones del año</h1><p className="text-neutral-400 mt-3">Streams del catálogo · MAMA LATINO 2026</p></div>{isAdmin&&<button disabled={busy} className="league-button" onClick={()=>void sync()}>{busy?'Actualizando…':'Actualizar histórico'}</button>}</div>
    {error&&<p role="alert" className="border border-red-800 bg-red-950/30 rounded-xl p-4">{error} <button className="underline" onClick={()=>void refresh()}>Reintentar</button></p>}
    {!data&&<p className={card}>{loaded?'Todavía no hay una importación histórica disponible. Se cargará con la siguiente sincronización del servidor.':'Cargando el historial…'}</p>}
    {data&&<>
      {Date.now()-Date.parse(data.fetchedAt)>30*60*1000&&<p className="text-amber-300" role="status">Se muestra la última copia guardada; la actualización está pendiente.</p>}
      {data.snapshot.accounts.some(a=>a.necesita_reconexion)&&<p className="text-amber-300">Una cuenta necesita reconectarse en Duo Charts. Su histórico se conserva, pero pueden faltar escuchas recientes.</p>}
      <div className="grid md:grid-cols-3 gap-4">{[['Total',data.snapshot.summary.combined_streams],[a1,data.snapshot.summary.account_1_streams],[a2,data.snapshot.summary.account_2_streams]].map(([label,n])=><div className={card} key={label}><p className="text-neutral-400 text-sm">{label}</p><p className="history-number">{format(Number(n))}</p><p className="text-neutral-500 text-xs mt-2">Streams</p></div>)}</div>
      <div className="text-sm text-neutral-400 flex flex-wrap gap-x-8 gap-y-2"><span>Primer registro: {date(data.snapshot.summary.first_played_at)}</span><span>Último registro: {date(data.snapshot.summary.last_played_at)}</span><span>Actualizado: {date(data.fetchedAt)}</span></div>
      <div className={card}><div className="flex flex-wrap justify-between gap-4 mb-5"><div><h2 className="text-xl font-bold">Histórico del catálogo</h2><p className="text-neutral-500 text-sm mt-1">{rows.length} artistas del catálogo de la liga</p></div><div className="flex flex-wrap gap-4 items-center"><input aria-label="Buscar en histórico" className="league-field" placeholder="Buscar artista…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(50);}}/></div></div>
      <div className="history-table-wrap"><table className="history-table"><thead className="text-neutral-500"><tr><th className="pb-4">Artista</th><th className="px-3">{a1}</th><th className="px-3">{a2}</th><th className="px-3">Total</th></tr></thead><tbody>{rows.slice(0,limit).map((r,i)=><tr key={r.spotify_artist_id} className="border-t border-neutral-800"><td className="py-4"><div className="flex gap-3 items-center"><span className="text-neutral-500 w-6">{i+1}</span><div className="history-photo"><span className="photo-initials" aria-hidden="true">{r.artist_name.split(' ').map(word=>word[0]).slice(0,2).join('')}</span>{r.image_url&&<img src={r.image_url} alt={r.artist_name} className="object-cover" onError={e=>{e.currentTarget.style.display='none';}}/>}</div><span className="font-semibold">{r.artist_name}</span></div></td><td className="history-account" data-label={a1}>{format(r.account_1_streams)}</td><td className="history-account" data-label={a2}>{format(r.account_2_streams)}</td><td className="history-total" data-label="Total">{format(r.combined_streams)}</td></tr>)}</tbody></table></div>
      {!rows.length&&<p className="text-neutral-400 py-4">No hay artistas para este filtro.</p>}{rows.length>limit&&<button className="border border-neutral-600 rounded-xl px-4 py-2 mt-4" onClick={()=>setLimit(limit+50)}>Mostrar más</button>}
      <p className="text-xs text-neutral-500 mt-5">Las colaboraciones cuentan para cada artista. La suma puede superar el total del dúo. La búsqueda conserva los totales. Cada temporada nueva empieza en cero.</p></div>
    </>}
  </section>;
}
