import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from './services/apiClient';
import type { Category, Participant } from './types';
import type { IdolOverview, IdolStatus } from './types/idols';
import { IdolPortrait } from './IdolPortrait';
import { LoadingSkeleton } from './LoadingSkeleton';
import { NextVoteClock, VoteConfirmation } from './VoteFeedback';

async function request<T>(path: string, options?: RequestInit) {
  const result = await apiClient.request<T>(path,options);
  if (!result.data || result.error) throw new Error(result.error || 'No se pudieron cargar los idols.');
  return result.data;
}
const currentDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Panama',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function IdolLeague({user,onLogin}: {user: Participant | null; onLogin:()=>void}) {
  const [data,setData] = useState<IdolOverview | null>(null);
  const [status,setStatus] = useState<IdolStatus | null>(null);
  const [category,setCategory] = useState<Category>('male');
  const [view,setView] = useState<'ranking'|'vote'>('ranking');
  const [seasonId,setSeasonId] = useState('');
  const [search,setSearch] = useState('');
  const [favorites,setFavorites] = useState<string[]>([]);
  const [picks,setPicks] = useState<Record<Category,string[]>>({male:[],female:[]});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [confirmed,setConfirmed] = useState<Category | null>(null);
  const [confirmFavorites,setConfirmFavorites] = useState(false);
  const favoriteDialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  async function load() {
    const version = ++generation.current;
    try {
      const [overview,mine] = await Promise.all([
        request<IdolOverview>('/idols'+(seasonId?'?seasonId='+encodeURIComponent(seasonId):'')),
        user ? request<IdolStatus>('/idols/me') : Promise.resolve(null),
      ]);
      if (version!==generation.current) return;
      setData(overview);setStatus(mine);setError('');
    } catch (e) { if(version===generation.current) setError((e as Error).message); }
  }
  useEffect(()=>{
    void load();
    const timer=setInterval(()=>void load(),15000);
    return ()=>{clearInterval(timer);generation.current++;};
  },[seasonId,user?.id]);
  useEffect(()=>{setPicks({male:[],female:[]});setFavorites([]);setConfirmed(null);},[status?.seasonId,status?.competitionDate]);
  useEffect(()=>{if(status?.seasonId && status.favorites===null && !seasonId) setView('vote');},[status?.seasonId,seasonId]);
  useEffect(()=>{if(confirmFavorites) favoriteDialog.current?.showModal();},[confirmFavorites]);
  if (!data) return <>{error && <p role="alert">{error} <button className="league-button" onClick={()=>void load()}>Reintentar</button></p>}<LoadingSkeleton/></>;
  const active = data.season?.status==='active' && data.season.startDate<=currentDate();
  const ready = !!user && active && status?.seasonId===data.season?.id && status?.competitionDate===currentDate();
  const onboarding = ready && status?.favorites===null;
  const rows = data.rankings[category];
  const selection = picks[category];
  const saved = ready ? status?.[category] : null;
  const catalog = data.catalog.filter(i=>(onboarding || i.category===category) && `${i.name} ${i.group}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function save(kind: 'favorites'|'daily') {
    if (!ready || busy) return;
    setBusy(true);setError('');
    const target=category;
    try {
      await request('/idols/votes',{method:'POST',body:JSON.stringify({kind,category:kind==='favorites'?'all':target,idolIds:kind==='favorites'?favorites:selection,seasonId:data!.season!.id,competitionDate:status!.competitionDate})});
      setStatus(previous=>previous ? {...previous,...(kind==='favorites'?{favorites:[...favorites]}:{[target]:[...selection]})}:previous);
      setConfirmFavorites(false);
      if(kind==='daily') setConfirmed(target);
      await load();
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  function toggle(id:string) {
    if(onboarding) setFavorites(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
    else setPicks(old=>({...old,[category]:old[category].includes(id)?old[category].filter(x=>x!==id):old[category].length<10?[...old[category],id]:old[category]}));
  }
  function move(index:number,delta:number) {
    setPicks(old=>{const next=[...old[category]];[next[index],next[index+delta]]=[next[index+delta],next[index]];return {...old,[category]:next};});
  }
  return <section className="idol-league space-y-6">
    <div className="section-heading"><div><p className="eyebrow">Fan Choice · Solo votos</p><h1>Idols</h1></div><span>84 hombres · 71 mujeres</span></div>
    <div className="idol-toolbar"><label>Temporada<select className="league-field" value={seasonId} disabled={busy} onChange={e=>{setSeasonId(e.target.value);setStatus(null);setData(null);setSearch('');setView('ranking');}}><option value="">Temporada actual</option>{data.seasons.filter(s=>s.status==='archived').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><div className="category-tabs"><button className={'category-tab '+(view==='ranking'?'is-active':'')} onClick={()=>setView('ranking')}>Ranking</button><button className={'category-tab '+(view==='vote'?'is-active':'')} onClick={()=>{setView('vote');setSearch('');}}>Votar</button></div></div>
    {error && <p role="alert" className="text-red-300">{error} <button onClick={()=>void load()}>Reintentar</button></p>}
    {!data.season && <p className="league-panel">No hay una temporada activa. Puedes consultar las anteriores.</p>}
    {(view==='ranking' || !onboarding) && <div className="category-tabs" role="group" aria-label="Categoría de idols">{(['male','female'] as Category[]).map(c=><button key={c} disabled={busy} aria-pressed={category===c} className={'category-tab '+(category===c?'is-active':'')} onClick={()=>{setCategory(c);setSearch('');}}>{c==='male'?'Hombres':'Mujeres'}</button>)}</div>}
    {view==='ranking' && <>
      <div className="idol-champions">{(['male','female'] as Category[]).map(c=>{const winner=data.rankings[c][0];return <article className="league-panel" key={c}><p className="eyebrow">{data.season?.status==='archived'?'Ganador':'Líder'} · {c==='male'?'Hombres':'Mujeres'}</p><div className="idol-leader-identity">{winner?.points ? <IdolPortrait idol={winner} priority large/> : null}<h2>{winner?.points ? winner.name : 'Esperando votos'}</h2></div><p>{winner?.points ? winner.group : 'Cada categoría tiene su ganador'}</p><strong>{winner?.points || 0} <small>puntos</small></strong></article>;})}</div>
      <p className="text-neutral-400 text-sm">Empates: más primeros puestos, luego puntos diarios y, por último, identificador alfabético.</p>
      <ol className="idol-ranking">{rows.map(row=><li key={row.id}><span className="rank-position">{String(row.rank).padStart(2,'0')}</span><IdolPortrait idol={row} priority={row.rank<=3}/><div className="min-w-0"><h3>{row.name}</h3><p>{row.group}</p><small>Favoritos {row.favoritePoints} · Votos {row.votePoints}</small></div><div className="idol-total"><small>Total</small><strong>{row.points}</strong></div></li>)}</ol>
    </>}
    {view==='vote' && (!user ? <div className="league-panel"><p>Entra para elegir tus favoritos y votar.</p><button className="league-button" onClick={onLogin}>Entrar</button></div> : !active ? <p className="league-panel">La votación está cerrada para esta temporada.</p> : !ready ? <LoadingSkeleton/> : <>
      {saved && !onboarding ? <section className="league-panel"><h2>Ya votaste hoy</h2><NextVoteClock competitionDate={status!.competitionDate}/><ol className="idol-saved">{saved.map((id,index)=><li key={id}>{index+1}. {data.catalog.find(i=>i.id===id)?.name} <span>{10-index} puntos</span></li>)}</ol></section> : <>
        <div className="league-panel"><h2>{onboarding?'Elige tus favoritos de temporada':'Tu Top 10 de hoy'}</h2><p className="text-neutral-400">{onboarding?'Marca todos los que quieras, de ambas categorías. Cada uno recibe 5 puntos. Esta selección se guarda una sola vez por temporada.':'Elige 10 idols y ordénalos: del primero al décimo reciben 10 a 1 puntos.'}</p></div>
        {!onboarding && <ol className="idol-saved league-panel">{selection.map((id,index)=><li key={id}><span>{index+1}. {data.catalog.find(i=>i.id===id)?.name} · {10-index} pts</span><div><button disabled={busy || index===0} aria-label="Subir posición" onClick={()=>move(index,-1)}>↑</button><button disabled={busy || index===selection.length-1} aria-label="Bajar posición" onClick={()=>move(index,1)}>↓</button><button disabled={busy} aria-label="Quitar idol" onClick={()=>toggle(id)}>×</button></div></li>)}{!selection.length && <li>Tu selección aparecerá aquí.</li>}</ol>}
        <input type="search" className="league-field" placeholder="Buscar idol o grupo" aria-label="Buscar idol o grupo" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="idol-picker">{catalog.map(idol=>{const selected=(onboarding?favorites:selection).includes(idol.id);return <button key={idol.id} type="button" aria-pressed={selected} disabled={busy || (!onboarding && selection.length===10 && !selected)} className={selected?'selected':''} onClick={()=>toggle(idol.id)}><IdolPortrait idol={idol}/><span><strong>{idol.name}</strong><small>{idol.group} · {idol.category==='male'?'Hombres':'Mujeres'}</small></span><b>{selected?(onboarding?'✓':selection.indexOf(idol.id)+1):'+'}</b></button>;})}</div>
        {!catalog.length && <p>No hay coincidencias.</p>}
        <div className="idol-save"><span>{onboarding?`${favorites.length} favoritos`:`${selection.length} / 10`}</span><button className="league-button" disabled={busy || (!onboarding && selection.length!==10)} onClick={()=>onboarding?setConfirmFavorites(true):void save('daily')}>{busy?'Guardando…':onboarding?'Guardar favoritos':'Guardar Top 10'}</button></div>
      </>}
    </>)}
    {confirmed && <VoteConfirmation category={confirmed} topSize={10} onClose={()=>setConfirmed(null)}/>}
    {confirmFavorites && <dialog ref={favoriteDialog} className="vote-confirmation" onCancel={e=>{if(busy)e.preventDefault();else setConfirmFavorites(false);}}><h2>¿Guardar {favorites.length} favoritos?</h2>{error && <p role="alert" className="text-red-300">{error}</p>}<p>Recibirán 5 puntos cada uno. No podrás cambiar esta selección durante la temporada.</p><button className="league-button" disabled={busy} onClick={()=>void save('favorites')}>Confirmar favoritos</button><button className="league-button" disabled={busy} onClick={()=>setConfirmFavorites(false)}>Volver</button></dialog>}
  </section>;
}
