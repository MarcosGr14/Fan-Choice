import { periodicLimits, pointsForPeriodicPosition, validVoteCount } from './data/voteRules';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient, ApiRequestError } from './services/apiClient';
import type { Participant } from './types';
import type { PeriodicVoteKind } from './types/idols';
import { ErrorNotice, toUserError, type UserError } from './ErrorNotice';

type Kind=PeriodicVoteKind;
type Entry={id:string;name?:string;displayName?:string;group?:string;imageUrl?:string;artistType?:string;category:'male'|'female'};
type Board={item:Entry;points:number};
type PeriodicData={season:{id:string;name:string}|null;artists:Entry[];idols:Entry[];periods:Record<Kind,string>;results:Record<Kind,{periodKey:string;voters:number;male:Board[];female:Board[]}>};
type Mine={seasonId:string|null;periods:Record<Kind,{periodKey:string;submission:{selections:{male:string[];female:string[]}}|null}>};
const modes:{kind:Kind;title:string;subtitle:string;detail:string}[]=[
 {kind:'weekly_artists',title:'Mega Voto Semanal',subtitle:'Artistas · cada lunes',detail:'De 10 a 15 por categoría · #1: 25 pts, #2–10: 15 pts, #11–15: 10 pts.'},
 {kind:'weekly_idols',title:'Mega Voto Semanal',subtitle:'Idols · cada lunes',detail:'De 10 a 25 por categoría · #1: 50 pts, #2–10: 20 pts, #11–25: 8 pts.'},
 {kind:'monthly_artists',title:'Favorito Mensual',subtitle:'Artistas · cada día 1',detail:'Un artista por categoría · 50 puntos para cada elección.'},
 {kind:'monthly_idols',title:'Bias del Mes',subtitle:'Idols · cada día 1',detail:'Bias y bias wrecker por categoría · 75 y 50 puntos.'},
];
async function dataRequest<T>(request:Promise<{data:T|null;error:string|null;errorCode?:string|null}>):Promise<T>{const r=await request;if(!r.data||r.error)throw new ApiRequestError(r.error||'No se pudieron cargar los votos.',r.errorCode||'EMPTY_RESPONSE');return r.data;}
function label(entry:Entry){return entry.displayName||entry.name||'Artista';}
function dateLabel(key:string){return key.length===7?new Date(`${key}-01T12:00:00Z`).toLocaleDateString('es',{month:'long',year:'numeric',timeZone:'UTC'}):new Date(`${key}T12:00:00Z`).toLocaleDateString('es',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});}
export default function PeriodicVoting({user,onLogin}:{user:Participant|null;onLogin:()=>void}){
 const [kind,setKind]=useState<Kind>('weekly_artists');const [data,setData]=useState<PeriodicData|null>(null);const [mine,setMine]=useState<Mine|null>(null);const [picks,setPicks]=useState<Record<'male'|'female',string[]>>({male:[],female:[]});const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState<UserError|null>(null);const [tick,setTick]=useState(Date.now());const [confirmOpen,setConfirmOpen]=useState(false);const confirmDialog=useRef<HTMLDialogElement>(null);const lock=useRef(false);
 const load=useCallback(async()=>{try{const [catalog,status]=await Promise.all([dataRequest<PeriodicData>(apiClient.getPeriodicCatalog()),user?dataRequest<Mine>(apiClient.getMyPeriodicVotes()):Promise.resolve(null)]);setData(catalog);setMine(status);setError(null);}catch(e){setError(toUserError(e));}},[user?.id]);
 useEffect(()=>{void load();const t=setInterval(()=>{void load();},60000);return()=>clearInterval(t);},[load]);
 useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>setPicks({male:[],female:[]}),[kind,data?.periods[kind]]);
 useEffect(()=>{const dialog=confirmDialog.current;if(confirmOpen&&dialog&&!dialog.open)dialog.showModal();if(!confirmOpen&&dialog?.open)dialog.close();},[confirmOpen]);
 if(!data)return <section className="league-panel">{error?<ErrorNotice error={error} onRetry={()=>void load()}/>:<p role="status">Cargando las votaciones…</p>}</section>;
 const mode=modes.find(x=>x.kind===kind)!;const periodKey=data.periods[kind];const submitted=mine?.periods[kind]?.periodKey===periodKey?mine.periods[kind].submission:null;
 const catalog=kind.endsWith('artists')?data.artists:data.idols;const isMonthly=kind.startsWith('monthly');const limits = periodicLimits[kind];
 const limit = limits.max;
 const canSubmit = validVoteCount(picks.male.length, limits) && validVoteCount(picks.female.length, limits);
 const pointText=kind==='weekly_artists'?'25 / 15 / 10':kind==='weekly_idols'?'50 / 20 / 8':kind==='monthly_artists'?'50':'75 / 50';
 const closeAt=(()=>{const [y,m,d]=periodKey.split('-').map(Number);const date=kind.startsWith('monthly')?new Date(Date.UTC(y,m,1,5)):new Date(Date.UTC(y,m-1,d+7,5));return date;})();const seconds=Math.max(0,Math.floor((closeAt.getTime()-tick)/1000));
 async function save(){if(!user){onLogin();return;}const seasonId=data?.season?.id;if(lock.current||!seasonId||!canSubmit)return;lock.current=true;setBusy(true);setError(null);try{await dataRequest(apiClient.submitPeriodicVote({kind,seasonId,periodKey,selections:picks}));setConfirmOpen(false);await load();}catch(e){setError(toUserError(e));}finally{lock.current=false;setBusy(false);}}
 function toggle(category:'male'|'female',id:string){setPicks(prev=>{const current=prev[category];return {...prev,[category]:current.includes(id)?current.filter(x=>x!==id):current.length<limit?[...current,id]:current};});}
 function move(category:'male'|'female',index:number,delta:number){setPicks(prev=>{const next=[...prev[category]],to=index+delta;if(to<0||to>=next.length)return prev;[next[index],next[to]]=[next[to],next[index]];return {...prev,[category]:next};});}
 return <section className="periodic-voting space-y-6">
  <header className="section-heading"><div><p className="eyebrow">Fan Choice · votaciones especiales</p><h1>Mega Voto y Favorito Mensual</h1></div>{data.season&&<span>{data.season.name}</span>}</header>
  {error&&<ErrorNotice compact error={error} onRetry={()=>void load()} onDismiss={()=>setError(null)}/>}
  <div className="periodic-mode-tabs" role="tablist" aria-label="Votaciones especiales">{modes.map(m=><button role="tab" aria-selected={kind===m.kind} className={kind===m.kind?'selected':''} key={m.kind} onClick={()=>setKind(m.kind)}><strong>{m.title}</strong><span>{m.subtitle}</span></button>)}</div>
  <div className="periodic-banner league-panel"><div><p className="eyebrow">{mode.subtitle}</p><h2>{dateLabel(periodKey)}</h2><p>{mode.detail}</p></div><div className="periodic-clock"><strong>{String(Math.floor(seconds/86400)).padStart(2,'0')}</strong><span>días</span><strong>{String(Math.floor(seconds%86400/3600)).padStart(2,'0')}</strong><span>h</span><strong>{String(Math.floor(seconds%3600/60)).padStart(2,'0')}</strong><span>m</span><strong>{String(seconds%60).padStart(2,'0')}</strong><span>s</span></div></div>
  <div className="periodic-columns">{(['male','female'] as const).map(category=>{const chosen=picks[category];const choices=catalog.filter(item=>item.category===category&&(`${label(item)} ${item.group||''}`).toLocaleLowerCase().includes(search.toLocaleLowerCase()));const saved=submitted?.selections[category]||[];const top=data.results[kind][category];return <section className="league-panel periodic-category" key={category}><div className="periodic-category-title"><div><p className="eyebrow">{category==='male'?'Categoría masculina':'Categoría femenina'}</p><h2>{submitted?'Voto registrado':`Tu selección · ${chosen.length}/${limit}`}</h2></div>{!submitted&&<span>{pointText} pts</span>}</div>
   {submitted?<ol className="periodic-selected">{saved.map((id,i)=>{const entry=catalog.find(item=>item.id===id);return <li key={id}><strong>{i+1}</strong><span>{entry?label(entry):id}</span><small>{pointsForPeriodicPosition(kind, i + 1)} pts{kind==='monthly_idols'?(i===0?' · Bias':' · Wrecker'):''}</small></li>;})}</ol>:!user?<div className="periodic-login"><p>Inicia sesión para guardar un voto por periodo.</p><button className="league-button" onClick={onLogin}>Entrar para votar</button></div>:<>
    {chosen.length>0&&<ol className="periodic-selected">{chosen.map((id,i)=>{const entry=catalog.find(item=>item.id===id);return <li key={id}><strong>{i+1}</strong><span>{entry?label(entry):id}</span>{!isMonthly&&<div><button aria-label="Subir" disabled={busy||i===0} onClick={()=>move(category,i,-1)}>↑</button><button aria-label="Bajar" disabled={busy||i===chosen.length-1} onClick={()=>move(category,i,1)}>↓</button></div>}</li>;})}</ol>}
    <input type="search" className="league-field" aria-label="Buscar artistas o idols" placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="periodic-picker">{choices.map(item=><button type="button" key={item.id} aria-pressed={chosen.includes(item.id)} className={chosen.includes(item.id)?'chosen':''} disabled={busy||(!chosen.includes(item.id)&&chosen.length>=limit)} onClick={()=>toggle(category,item.id)}><span>{label(item)}</span><small>{item.group||item.displayName||'Solista'}</small><b>{chosen.includes(item.id)?chosen.indexOf(item.id)+1:'+'}</b></button>)}</div>
   </>}
   <div className="periodic-results"><h3>Resultados del periodo · {data.results[kind].voters} votos</h3>{top.length?top.slice(0,5).map((row,i)=><p key={row.item.id}><span>{i+1}. {label(row.item)}</span><strong>{row.points} pts</strong></p>):<small>Aún no hay votos registrados en este periodo.</small>}</div>
  </section>;})}</div>
  {user&&!submitted&&<button className="league-button periodic-submit" disabled={busy||!data.season||!canSubmit} onClick={()=>setConfirmOpen(true)}>Revisar y guardar ambas categorías</button>}
  {!data.season&&<p className="league-panel">No hay temporada activa; puedes consultar los resultados, pero los votos están cerrados.</p>}
  {confirmOpen&&<dialog ref={confirmDialog} className="vote-confirmation periodic-review-dialog" aria-labelledby="periodic-review-title" onCancel={e=>{e.preventDefault();if(!busy)setConfirmOpen(false);}}>
   <p className="eyebrow">{mode.title} · {mode.subtitle}</p><h2 id="periodic-review-title">Confirma tus dos selecciones</h2><p>Este voto quedará registrado para {dateLabel(periodKey)}. Comprueba el orden antes de enviarlo.</p>
   <div className="periodic-review-columns">{(['male','female'] as const).map(category=><section key={category}><h3>{category==='male'?'Hombres':'Mujeres'}</h3><ol>{picks[category].map((id,index)=>{const entry=catalog.find(item=>item.id===id);const points=pointsForPeriodicPosition(kind, index + 1);return <li key={id}><span><b>{index+1}.</b> {entry?label(entry):'Participante'}</span><strong>{points} pts</strong></li>;})}</ol></section>)}</div>
   {error&&<ErrorNotice compact error={error} onDismiss={()=>setError(null)}/>}<button autoFocus type="button" className="league-button" disabled={busy} onClick={()=>void save()}>{busy?'Guardando voto…':'Confirmar voto'}</button><button type="button" className="dialog-secondary-button" disabled={busy} onClick={()=>setConfirmOpen(false)}>Volver a editar</button>
  </dialog>}
 </section>;
}
