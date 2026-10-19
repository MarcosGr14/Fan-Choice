import React, { useEffect, useState } from 'react';
import { Trophy, Music2, RefreshCw, LogOut, Lock, CalendarDays, Plus, CheckCircle2 } from 'lucide-react';
import { apiClient } from './services/apiClient';
import type { Artist, ArtistCumulativeStats, ArchivedSeasonRecord, Category, Participant, Season } from './types';
import { LifetimeHistory } from './LifetimeHistory';
import { NextVoteClock, VoteConfirmation } from './VoteFeedback';
import hero from './assets/images/league_hero_banner_1792299063889.jpg';

type Overview = {
  season: Season | null;
  standings: { maleStats: ArtistCumulativeStats[]; femaleStats: ArtistCumulativeStats[]; absoluteChampion: ArtistCumulativeStats | null };
  syncStatus: { lastSyncTimestamp: string; isMockProvider: boolean; status: string; totalRecords: number };
};
type SavedBallot = { status: 'saved' | 'unsubmitted'; items: {artistId: string; rankPosition: number}[] };
type Votes = { competitionDate: string; isLocked: boolean; maleBallot: SavedBallot; femaleBallot: SavedBallot };
type ArchiveSummary = { seasonId: string; name: string; closedAt: string; totalVotesCast: number; totalStreamsLogged: number };
const field = 'league-field';
const button = 'league-button';
const card = 'league-panel';
function localDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function time(value: string) { return new Date(value).toLocaleString('es', {timeZone: 'America/Panama'}); }
async function unwrap<T>(request: Promise<{data: T | null; error: string | null}>): Promise<T> {
  const {data, error} = await request;
  if (error || !data) throw new Error(error || 'El servidor no devolvió datos.');
  return data;
}
function Ladder({title, rows}: {title: string; rows: ArtistCumulativeStats[]}) {
  return <section className="ladder-section"><div className="section-heading"><h2>{title}</h2><span>Temporada · Top 10</span></div>
    {!rows.length && <p className="league-panel text-neutral-400">Sin artistas en esta categoría.</p>}
    <ol className="ranking-list">
      {rows.slice(0,10).map((s,i) => <li key={s.artist.id} className={'artist-row '+(i<3?'podium-row ':'')+(i===0?'first-place':'')} style={{'--row-index':i} as React.CSSProperties}>
        <div className="rank-position"><span className="sr-only">Posición </span><strong>{String(i+1).padStart(2,'0')}</strong><span className={'rank-change '+(s.isNewEntry || s.rankDelta>0?'rank-up':s.rankDelta<0?'rank-down':'')}>{s.isNewEntry?'NUEVO':s.rankDelta>0?`↑ ${s.rankDelta}`:s.rankDelta<0?`↓ ${Math.abs(s.rankDelta)}`:'—'}</span></div>
        <div className="artist-photo"><span aria-hidden="true" className="photo-initials">{s.artist.displayName.split(' ').map(word=>word[0]).slice(0,2).join('')}</span>{s.artist.imageUrl && <img src={i<3?s.artist.imageUrl.replace('ab6761610000e5eb','ab6761610000f178'):s.artist.imageUrl} alt={s.artist.displayName} loading="lazy" onError={e=>{if(e.currentTarget.getAttribute('src')!==s.artist.imageUrl){e.currentTarget.src=s.artist.imageUrl;}else{e.currentTarget.style.display='none';}}}/>}</div>
        <div className="artist-identity"><h3>{s.artist.displayName}</h3><p>{s.artist.artistType==='group'?'Grupo':'Solista'} · {s.artist.originCountry}</p><span className="today-score">Hoy +{s.todayPoints}</span></div>
        <div className="artist-metrics"><div className="metric metric-votes"><span>Votos</span><strong>{s.cumulativeVotePoints.toLocaleString('es')}</strong></div><div className="metric metric-streams"><span>Streams</span><strong>{s.cumulativeStreams.toLocaleString('es')}</strong></div><div className="metric metric-bonus"><span>Bonus</span><strong>{s.cumulativeBonusPoints.toLocaleString('es')}</strong></div></div>
        <div className="artist-total"><span>Total</span><strong>{s.cumulativePoints.toLocaleString('es')}</strong></div>
      </li>)}
    </ol></section>;
}
function CategoryRankings({maleRows, femaleRows}: {maleRows: ArtistCumulativeStats[]; femaleRows: ArtistCumulativeStats[]}) {
  const [visibleCategory, setVisibleCategory] = useState<Category>('male');
  return <div className="category-rankings">
    <div className="category-tabs ranking-category-tabs" role="group" aria-label="Categoría del ranking">
      <button type="button" aria-pressed={visibleCategory==='male'} className={'category-tab '+(visibleCategory==='male'?'is-active':'')} onClick={()=>setVisibleCategory('male')}>Hombres</button>
      <button type="button" aria-pressed={visibleCategory==='female'} className={'category-tab '+(visibleCategory==='female'?'is-active':'')} onClick={()=>setVisibleCategory('female')}>Mujeres</button>
    </div>
    <Ladder key={visibleCategory} title={visibleCategory==='male'?'Hombres':'Mujeres'} rows={visibleCategory==='male'?maleRows:femaleRows}/>
  </div>;
}

export function App() {
  const [tab,setTab] = useState('rankings');
  const [user,setUser] = useState<Participant | null>(null);
  const [overview,setOverview] = useState<Overview | null>(null);
  const [artists,setArtists] = useState<Artist[]>([]);
  const [archives,setArchives] = useState<ArchiveSummary[]>([]);
  const [archive,setArchive] = useState<ArchivedSeasonRecord | null>(null);
  const [votes,setVotes] = useState<Votes | null>(null);
  const [category,setCategory] = useState<Category>('male');
  const [selection,setSelection] = useState<string[]>(['','','','','']);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [search,setSearch] = useState('');
  const [date,setDate] = useState(localDate());
  const [syncDate,setSyncDate] = useState(localDate());
  const [seasonName,setSeasonName] = useState('');
  const [seasonDescription,setSeasonDescription] = useState('');
  const [seasonStart,setSeasonStart] = useState(localDate());
  const [confirmation,setConfirmation] = useState('');
  const [artistForm,setArtistForm] = useState({displayName:'',spotifyArtistId:'',category:'male',artistType:'group',musicScene:'kpop',originCountry:'KR',imageUrl:''});
  const [showLogin,setShowLogin] = useState(false);
  const [voteConfirmation,setVoteConfirmation] = useState<Category | null>(null);
  async function refresh() {
    const [o,c,a] = await Promise.all([unwrap(apiClient.getOverview()),unwrap(apiClient.getArtists()),unwrap(apiClient.getArchivedSeasons())]);
    setOverview(o);setArtists(c.artists);setArchives(a.seasons);
  }
  async function refreshVotes() {
    if (!apiClient.getToken()) {setVotes(null);return;}
    setVotes(await unwrap(apiClient.getTodayVotes()));
  }
  useEffect(() => {
    let active = true;
    void refresh().catch(e => active && setError(e.message));
    if (apiClient.getToken()) void unwrap(apiClient.getMe()).then(d => {if(active){setUser(d.user);void refreshVotes().catch(e=>setError(e.message));}}).catch(e=>{if(active)setError(e.message);});
    const interval = setInterval(() => { if(active) {setDate(localDate());void refresh().catch(e=>setError(e.message));} },60000);
    return () => {active=false;clearInterval(interval);};
  },[]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => setDate(localDate()), 1000);
    return () => clearInterval(timer);
  }, [user?.id]);
  useEffect(() => { setVoteConfirmation(null); }, [date,user?.id]);
  useEffect(() => { if(user) void refreshVotes().catch(e=>setError(e.message)); },[date,user?.id]);
  useEffect(() => {
    const items = votes?.[category === 'male' ? 'maleBallot' : 'femaleBallot'].items || [];
    setSelection(Array.from({length:5},(_,i)=>items.find(it=>it.rankPosition===i+1)?.artistId || ''));
  },[votes,category]);
  async function action(work: () => Promise<void>) {
    setBusy(true);setError('');setNotice('');
    try { await work(); } catch(e) {setError(e instanceof Error ? e.message : 'No se pudo completar la operación.');if(!apiClient.getToken()){setUser(null);setVotes(null);}} finally {setBusy(false);}
  }
  const season = overview?.season;
  const champion = overview?.standings.absoluteChampion;
  const eligible = artists.filter(a=>a.category===category && a.isEligible && a.status==='approved' && a.eligibilityEffectiveDate<=date);
  const currentBallot = votes?.[category==='male'?'maleBallot':'femaleBallot'];
  const votedToday = votes?.competitionDate===date && currentBallot?.status==='saved';
  const otherCategory: Category = category==='male'?'female':'male';
  const otherVoted = votes?.competitionDate===date && votes?.[otherCategory==='male'?'maleBallot':'femaleBallot'].status==='saved';
  const canVote = !!user && !!season && season.startDate<=date && votes?.competitionDate===date && !votes?.isLocked && !votedToday;
  return <div className="league-app">
    <header className="site-header"><div className="header-inner">
      <a href="/" className="brand"><Trophy/><span>Fan Choice <b>Most Populars</b></span></a>
      <nav className="site-nav">{[['rankings','Clasificación'],['voting','Votar'],['history','Histórico'],['archive','Archivo'],...(user?.role==='admin'?[['admin','Administración']]:[])].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={tab===id?'nav-tab is-active':'nav-tab'}>{label}</button>)}</nav>
      {user ? <div className="flex items-center gap-3 text-sm"><span>{user.displayName}</span><button className="logout-button" aria-label="Salir" onClick={()=>{apiClient.setToken(null);setUser(null);setVotes(null);setTab('rankings');setNotice('Sesión cerrada.');}}><LogOut size={18}/> Salir</button></div> : <button className={button} onClick={()=>setShowLogin(true)}>Entrar</button>}
    </div></header>
    <main className="page-content space-y-7">
      {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/40 p-4 flex justify-between gap-4"><span>{error}</span><button onClick={()=>void action(refresh)}>Reintentar</button></div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 flex items-center gap-2"><CheckCircle2 size={18}/>{notice}</p>}
      {!overview && <section className={card}>Cargando tu liga…</section>}
      {tab==='rankings' && overview && <>
        <section className="season-hero"><img src={hero} alt="" className="hero-image"/><div className="hero-content"><p className="eyebrow">Fan Choice Most Populars <span> / </span> Temporada</p><h1>{season ? 'MAMA LATINO 2026' : 'Entre temporadas'}</h1><p className="hero-caption">{season ? `Desde ${season.startDate} · Día ${season.daysActive}` : 'Próxima temporada pendiente'}</p><button className={button+' mt-6'} onClick={()=>setTab('voting')}>Elegir mi Top 5 <span aria-hidden="true">↗</span></button></div><span className="hero-watermark" aria-hidden="true">FAN<br/>CHOICE</span></section>
        <div className="overview-grid"><section className="champion-card">
          <div className="champion-photo"><span className="photo-initials" aria-hidden="true">{season && champion && champion.cumulativePoints>0 ? champion.artist.displayName.split(' ').map(word=>word[0]).slice(0,2).join('') : 'FC'}</span>{season && champion && champion.cumulativePoints>0 && champion.artist.imageUrl && <img src={champion.artist.imageUrl.replace('ab6761610000e5eb','ab6761610000f178')} alt={champion.artist.displayName} onError={e=>{if(e.currentTarget.getAttribute('src')!==champion.artist.imageUrl){e.currentTarget.src=champion.artist.imageUrl!;}else{e.currentTarget.style.display='none';}}}/>}</div>
          <div className="champion-info"><p className="eyebrow"><Trophy size={14}/> Campeón absoluto</p><h2>{season && champion && champion.cumulativePoints>0 ? champion.artist.displayName : 'Esperando puntos'}</h2><p className="champion-score">{season ? champion?.cumulativePoints || 0 : 0}<span>Total</span></p></div>
        </section><section className={card+' overview-stat'}><Music2/><p>Artistas</p><h2>{artists.length}</h2><span>K-pop · J-pop</span></section><section className={card+' overview-sync'}><RefreshCw/><p>Última sincronización</p><strong>{overview.syncStatus.totalRecords || overview.syncStatus.status==='success' ? time(overview.syncStatus.lastSyncTimestamp) : 'Pendiente de importación'}</strong><span>{overview.syncStatus.isMockProvider?'Demostración':'Spotify Duo Charts'} · {{success:'Actualizada',failed:'Error',partial:'Pendiente'}[overview.syncStatus.status] || overview.syncStatus.status}</span></section></div>
        {season && <CategoryRankings maleRows={overview.standings.maleStats} femaleRows={overview.standings.femaleStats}/>}
      </>}
      {tab==='history' && <LifetimeHistory artists={artists} isAdmin={user?.role==='admin'}/> }
      {tab==='voting' && <section className={card+' max-w-3xl mx-auto'}><div className="flex justify-between gap-4"><div><p className="text-emerald-300 text-xs uppercase tracking-widest">Votación diaria</p><h1 className="text-3xl font-bold mt-2">Tu Top 5</h1><p className="text-neutral-400 mt-2">{date} · Panamá · hasta las 23:59</p></div><Lock className="text-neutral-600"/></div>
        {!user ? <div className="mt-8"><p className="mb-4">Inicia sesión para guardar tu selección.</p><button className={button} onClick={()=>setShowLogin(true)}>Entrar</button></div> : <>
          {!season && <p className="mt-6 text-amber-300">No hay una temporada activa.</p>}
          <div className="category-tabs">{(['male','female'] as Category[]).map(c=><button disabled={busy} key={c} onClick={()=>{setCategory(c);setNotice('');}} className={'category-tab '+(category===c?'is-active':'')}>{c==='male'?'Hombres':'Mujeres'}</button>)}</div>
          {!votes || votes.competitionDate!==date ? <p className="text-neutral-400 py-6" role="status">Cargando tu votación de hoy…</p> : votedToday ? <div className="saved-vote">
            <div className="saved-vote-heading"><div className="vote-success-icon"><CheckCircle2 aria-hidden="true"/></div><div><p className="eyebrow">{category==='male'?'Hombres':'Mujeres'} · confirmado</p><h2>Ya votaste hoy</h2><p>Tu Top 5 está guardado. Gracias por participar.</p></div></div>
            {season && <NextVoteClock competitionDate={date}/>}
            <div className="saved-ballot"><h3>Tu selección de hoy</h3><ol>{[...(currentBallot?.items || [])].sort((a,b)=>a.rankPosition-b.rankPosition).map(item=><li key={item.rankPosition}><span className="saved-ballot-rank">{String(item.rankPosition).padStart(2,'0')}</span><strong>{artists.find(artist=>artist.id===item.artistId)?.displayName || 'Artista del catálogo'}</strong><span className="saved-ballot-points">{6-item.rankPosition} pts</span></li>)}</ol></div>
            {season && !otherVoted && <button type="button" className={button+' other-vote-button'} onClick={()=>setCategory(otherCategory)}>Votar en {otherCategory==='male'?'Hombres':'Mujeres'} <span aria-hidden="true">→</span></button>}
            {otherVoted && <p className="both-votes-done"><CheckCircle2 size={16} aria-hidden="true"/> Ya completaste ambas categorías.</p>}
          </div> : <>
          <div className="space-y-4">{selection.map((id,i)=><label key={i} className="flex items-center gap-4"><span className="text-emerald-300 font-bold text-xl w-8">{i+1}</span><select aria-label={`Artista en posición ${i+1}`} className={field} value={id} disabled={!canVote || busy} onChange={e=>setSelection(previous=>previous.map((v,j)=>j===i?e.target.value:v))}><option value="">Selecciona un artista</option>{eligible.map(a=><option key={a.id} value={a.id} disabled={selection.includes(a.id)&&id!==a.id}>{a.displayName}</option>)}</select><span className="text-sm text-neutral-500 w-14">{5-i} pts</span></label>)}</div>
          <button className={button+' mt-7'} disabled={busy || !canVote || selection.some(v=>!v) || new Set(selection).size!==5} onClick={()=>void action(async()=>{
            const items=selection.map((artistId,i)=>({artistId,rankPosition:i+1}));
            await unwrap(apiClient.submitBallot(category,items,date));
            setVotes(previous=>previous && previous.competitionDate===date ? {...previous,[category==='male'?'maleBallot':'femaleBallot']:{status:'saved',items}} : previous);
            setVoteConfirmation(category);
            const updates=await Promise.allSettled([refreshVotes(),refresh()]);
            if(updates.some(result=>result.status==='rejected')) setError('Tu voto se guardó. No se pudieron actualizar todos los datos; recarga la página para verlos.');
          })}>{busy?'Guardando…':'Guardar Top 5'}</button><p className="text-xs text-neutral-500 mt-4">Un Top 5 por categoría y día. Puntos: 5, 4, 3, 2 y 1.</p>
          </>}

        </>}
      </section>}
      {tab==='archive' && <><h1 className="text-3xl font-bold">Archivo de temporadas</h1>{!archives.length && <p className={card}>Aún no hay temporadas cerradas.</p>}<div className="flex flex-wrap gap-3">{archives.map(a=><button key={a.seasonId} className={card+' text-left hover:border-emerald-600'} disabled={busy} onClick={()=>void action(async()=>{const data=await unwrap(apiClient.getArchivedSeason(a.seasonId));setArchive(data.archive);})}><CalendarDays className="text-emerald-400 mb-2"/><strong>{a.name}</strong><p className="text-sm text-neutral-500">Cerrada {time(a.closedAt)}</p></button>)}</div>{archive && <><section className={card}><h2 className="text-2xl font-bold">{archive.season.name}</h2><p className="mt-3">Campeón: <strong className="text-amber-300">{archive.absoluteChampion.artist.displayName}</strong></p><p className="text-neutral-400 mt-2">{archive.totalVotesCast} selecciones votadas · {archive.totalStreamsLogged} reproducciones · Cerrada por {archive.closedByDisplayName}</p></section><CategoryRankings key={archive.season.id} maleRows={archive.maleTop10} femaleRows={archive.femaleTop10}/></>}</>}
      {tab==='admin' && user?.role==='admin' && <><h1 className="text-3xl font-bold">Administración</h1><div className="grid lg:grid-cols-2 gap-6">
        <section className={card}><h2 className="text-xl font-bold mb-3">Sincronizar reproducciones</h2><p className="text-neutral-400 text-sm mb-5">Actualización automática cada 15 minutos. Elige un día para sincronizarlo.</p><input aria-label="Fecha de sincronización" type="date" max={date} className={field} value={syncDate} onChange={e=>setSyncDate(e.target.value)}/><button disabled={busy} className={button+' mt-4'} onClick={()=>void action(async()=>{const d=await unwrap(apiClient.triggerSync(syncDate));await refresh();setNotice(`Sincronización completada: ${d.syncResult.recordsProcessed} registros guardados.${d.syncResult.ignoredArtists?.length ? ' Fuera del catálogo: ' + d.syncResult.ignoredArtists.join(', ') + '.' : ''}`);})}>{busy?'Procesando…':'Sincronizar día'}</button></section>
        <section className={card}><h2 className="text-xl font-bold mb-3">{season?'Cerrar temporada':'Crear temporada'}</h2>{season ? <><p className="text-neutral-400 text-sm mb-4">Se congelarán los resultados de MAMA LATINO 2026. Esta operación no se puede deshacer desde la aplicación. Escribe FREEZE_SEASON para confirmar.</p><input aria-label="Confirmar cierre" className={field} value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="FREEZE_SEASON"/><button className={button+' mt-4'} disabled={busy||confirmation!=='FREEZE_SEASON'} onClick={()=>void action(async()=>{await unwrap(apiClient.request(`/admin/seasons/${season.id}/close`,{method:'POST',body:JSON.stringify({confirmCode:confirmation})}));setConfirmation('');await refresh();setNotice('Temporada cerrada. Sus resultados están guardados en el archivo.');})}>Cerrar y archivar</button></> : <form className="space-y-3" onSubmit={e=>{e.preventDefault();void action(async()=>{await unwrap(apiClient.request('/admin/seasons',{method:'POST',body:JSON.stringify({name:seasonName,description:seasonDescription,startDate:seasonStart})}));await refresh();setSeasonName('');setNotice('Temporada creada. La importación automática recuperará sus reproducciones.');});}}><input required maxLength={100} aria-label="Nombre de temporada" placeholder="Nombre de la temporada" className={field} value={seasonName} onChange={e=>setSeasonName(e.target.value)}/><textarea aria-label="Descripción" placeholder="Descripción (opcional)" className={field} value={seasonDescription} onChange={e=>setSeasonDescription(e.target.value)}/><input required aria-label="Inicio de temporada" type="date" className={field} value={seasonStart} onChange={e=>setSeasonStart(e.target.value)}/><button disabled={busy} className={button}>Crear temporada</button></form>}</section>
      </div><section className={card}><h2 className="text-xl font-bold mb-4">Añadir artista al catálogo</h2><form className="grid md:grid-cols-3 gap-4" onSubmit={e=>{e.preventDefault();void action(async()=>{await unwrap(apiClient.request('/admin/artists',{method:'POST',body:JSON.stringify(artistForm)}));await refresh();setArtistForm({...artistForm,displayName:'',spotifyArtistId:'',imageUrl:''});setNotice('Artista guardado en el catálogo.');});}}>
        <input aria-label="Nombre del artista" required placeholder="Nombre del artista" maxLength={150} className={field} value={artistForm.displayName} onChange={e=>setArtistForm({...artistForm,displayName:e.target.value})}/><input aria-label="ID de Spotify" required pattern="[A-Za-z0-9]{22}" placeholder="ID de Spotify (22 caracteres)" className={field} value={artistForm.spotifyArtistId} onChange={e=>setArtistForm({...artistForm,spotifyArtistId:e.target.value.trim()})}/><select aria-label="Categoría" className={field} value={artistForm.category} onChange={e=>setArtistForm({...artistForm,category:e.target.value})}><option value="male">Hombres</option><option value="female">Mujeres</option></select><select aria-label="Tipo de artista" className={field} value={artistForm.artistType} onChange={e=>setArtistForm({...artistForm,artistType:e.target.value})}><option value="group">Grupo</option><option value="soloist">Solista</option></select><select aria-label="Escena musical" className={field} value={artistForm.musicScene} onChange={e=>setArtistForm({...artistForm,musicScene:e.target.value})}><option value="kpop">K-pop</option><option value="jpop">J-pop</option><option value="both">Ambas</option></select><input aria-label="País de origen" required pattern="[A-Z]{2}" placeholder="País: KR / JP" className={field} value={artistForm.originCountry} onChange={e=>setArtistForm({...artistForm,originCountry:e.target.value.toUpperCase()})}/><input aria-label="URL de imagen" type="url" placeholder="Imagen HTTPS (opcional)" className={field+' md:col-span-2'} value={artistForm.imageUrl} onChange={e=>setArtistForm({...artistForm,imageUrl:e.target.value})}/><button disabled={busy} className={button}><Plus className="inline w-4 mr-2"/>Añadir artista</button>
      </form></section><section className={card}><div className="flex flex-wrap justify-between gap-4 mb-5"><h2 className="text-xl font-bold">Catálogo · {artists.length} artistas</h2><input aria-label="Buscar artista" className={field+' max-w-xs'} placeholder="Buscar artista…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{artists.filter(a=>a.displayName.toLowerCase().includes(search.toLowerCase())).map(a=><div key={a.id} className="flex gap-3 items-center border border-neutral-800 rounded-xl p-3">{a.imageUrl && <img src={a.imageUrl} alt="" className="w-10 h-10 object-cover rounded-full"/>}<div><p className="font-semibold text-sm">{a.displayName}</p><p className="text-xs text-neutral-500">{a.category==='male'?'Hombres':'Mujeres'} · {a.musicScene}</p></div></div>)}</div></section></>}
      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex flex-wrap justify-between gap-3"><span>Fan Choice Most Populars</span><span>Votos + Bonus · Panamá</span></footer>
    </main>
    {voteConfirmation && <VoteConfirmation category={voteConfirmation} onClose={()=>setVoteConfirmation(null)}/>}
    {showLogin && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5"><section role="dialog" aria-modal="true" aria-labelledby="login-title" className={card+' w-full max-w-md bg-neutral-950'}><h2 id="login-title" className="text-2xl font-bold mb-2">Entrar</h2><p className="text-neutral-400 text-sm mb-6">Usa tu usuario y contraseña para votar.</p><form className="space-y-4" onSubmit={e=>{e.preventDefault();void action(async()=>{const d=await unwrap(apiClient.login(username.trim(),password));apiClient.setToken(d.token);setUser(d.user);setPassword('');await refreshVotes();setShowLogin(false);setNotice(`Bienvenido, ${d.user.displayName}.`);});}}><input autoFocus required autoComplete="username" aria-label="Usuario" className={field} placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)}/><input required type="password" autoComplete="current-password" aria-label="Contraseña" className={field} placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/>{error && <p role="alert" className="text-red-300 text-sm">{error}</p>}<div className="flex justify-between items-center"><button type="button" className="text-neutral-400" disabled={busy} onClick={()=>{setShowLogin(false);setPassword('');setError('');}}>Cancelar</button><button disabled={busy} className={button}>{busy?'Entrando…':'Entrar'}</button></div></form></section></div>}
  </div>;
}

export default App;
