import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Trophy, LogOut, Lock, CalendarDays, Plus, CheckCircle2, Sun, Moon, Crown, ArrowRight, ArrowLeft, Sparkles, Users, ChevronDown, UserRound } from 'lucide-react';
import { apiClient, ApiRequestError, type ApiResponse } from './services/apiClient';
import { ErrorNotice, toUserError, type UserError } from './ErrorNotice';
import type { Artist, ArtistCumulativeStats, ArchivedSeasonRecord, Category, Participant, Season } from './types';
import type { IdolOverview, IdolRankings, IdolStanding } from './types/idols';
import { IdolPortrait } from './IdolPortrait';
import type { LifetimeHistoryCache } from './LifetimeHistory';
import { LoadingSkeleton } from './LoadingSkeleton';
import { RankingsPage } from './RankingsPage';
import { NextVoteClock, VoteConfirmation } from './VoteFeedback';
import homeBannerOne from './assets/images/fan-choice-banner-01.webp';
import homeBannerTwo from './assets/images/fan-choice-banner-02.webp';
import homeBannerThree from './assets/images/fan-choice-banner-03.webp';
import homeBannerFour from './assets/images/fan-choice-banner-04.webp';
import homeBannerFive from './assets/images/fan-choice-banner-05.webp';
import homeBannerSix from './assets/images/fan-choice-banner-06.webp';
import homeBannerSeven from './assets/images/fan-choice-banner-07.webp';

const IdolLeague = lazy(() => import('./IdolLeague'));
const PeriodicVoting = lazy(() => import('./PeriodicVoting'));
const LifetimeHistory = lazy(() => import('./LifetimeHistory').then(module => ({ default: module.LifetimeHistory })));

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
const emptyBallot = () => Array<string>(5).fill('');
function localDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function time(value: string) { return new Date(value).toLocaleString('es', {timeZone: 'America/Panama'}); }
async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const {data, error, errorCode} = await request;
  if (error || !data) throw new ApiRequestError(error || 'El servidor no devolvió datos.', errorCode || 'EMPTY_RESPONSE');
  return data;
}
function Ladder({title, rows}: {title: string; rows: ArtistCumulativeStats[]}) {
  return <section className="ladder-section"><div className="section-heading"><h2>{title}</h2><span>Top 10</span></div>
    {!rows.length && <p className="league-panel text-neutral-400">Sin artistas en esta categoría.</p>}
    <ol className="ranking-list">
      {rows.slice(0,10).map((s,i) => <li key={s.artist.id} className={'artist-row '+(i<3?'podium-row ':'')+(i===0?'first-place':'')} style={{'--row-index':i} as React.CSSProperties}>
        <div className="rank-position"><span className="sr-only">Posición </span><strong>{String(i+1).padStart(2,'0')}</strong><span className={'rank-change '+(s.isNewEntry || s.rankDelta>0?'rank-up':s.rankDelta<0?'rank-down':'')}>{s.isNewEntry?'NUEVO':s.rankDelta>0?`↑ ${s.rankDelta}`:s.rankDelta<0?`↓ ${Math.abs(s.rankDelta)}`:'—'}</span></div>
        <div className="artist-photo"><span aria-hidden="true" className="photo-initials">{s.artist.displayName.split(' ').map(word=>word[0]).slice(0,2).join('')}</span>{s.artist.imageUrl && <img src={i<3?s.artist.imageUrl.replace('ab6761610000e5eb','ab6761610000f178'):s.artist.imageUrl} alt={s.artist.displayName} loading={i<3?"eager":"lazy"} fetchPriority={i<3?"high":"low"} decoding="async" width={110} height={110} onError={e=>{if(e.currentTarget.getAttribute('src')!==s.artist.imageUrl){e.currentTarget.src=s.artist.imageUrl;}else{e.currentTarget.style.display='none';}}}/>}</div>
        <div className="artist-identity"><h3>{s.artist.displayName}</h3><p>{s.artist.artistType==='group'?'Grupo':'Solista'} · {s.artist.originCountry}</p><span className="today-score">Hoy +{s.todayPoints}</span></div>
        <div className="artist-metrics"><div className="metric metric-votes"><span>Votos</span><strong>{s.cumulativeVotePoints.toLocaleString('es')}</strong></div><div className="metric metric-streams"><span>Streams</span><strong>{s.cumulativeStreams.toLocaleString('es')}</strong></div><div className="metric metric-bonus"><span>Bonus</span><strong>{s.cumulativeBonusPoints.toLocaleString('es')}</strong></div></div>
        <div className="artist-total"><span>Total</span><strong>{s.cumulativePoints.toLocaleString('es')}</strong></div>
      </li>)}
    </ol></section>;
}
function IdolWinnerCard({category, winner}: {category: Category; winner?: IdolStanding}) {
  const hasWinner = !!winner && winner.points > 0;
  return <article className={'idol-winner-card '+(category==='female'?'idol-winner-female':'idol-winner-male')}>
    <p className="winner-card-label"><Crown size={14}/>{category==='male'?'Idol #1 · Hombres':'Idol #1 · Mujeres'}</p>
    <div className="idol-winner-body">{hasWinner && <IdolPortrait idol={winner!} priority large/>}<div><strong>{hasWinner?winner!.name:'Esperando votos'}</strong><span>{hasWinner?winner!.group:'La votación definirá el primer lugar'}</span>{hasWinner && <b>{winner!.points.toLocaleString('es')} <small>puntos</small></b>}</div></div>
  </article>;
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

function ArchivedIdolRankings({rankings}: {rankings?: IdolRankings}) {
  if (!rankings) return <section className={card}><h2 className="text-2xl font-bold">Resultados de idols · Top 10</h2><p className="mt-3 text-neutral-400">No hay un registro de resultados de idols para esta temporada.</p></section>;
  const hasVotes = [...rankings.male, ...rankings.female].some(row => row.points > 0);
  return <section className="space-y-5">
    <div><h2 className="text-2xl font-bold">Resultados de idols · Top 10</h2><p className="mt-2 text-sm text-neutral-400">Puntuación final: favoritos, votos diarios y votos especiales semanales/mensuales.</p></div>
    {!hasVotes && <p className={card+' text-neutral-400'}>Esta temporada no tiene votos de idols registrados.</p>}
    {hasVotes && <div className="grid lg:grid-cols-2 gap-6">{(['male','female'] as const).map(category => {
      const rows = rankings[category].slice(0,10);
      return <section className="ladder-section" key={category}>
        <div className="section-heading"><h3>{category==='male'?'Hombres':'Mujeres'}</h3><span>Top 10 · Idols</span></div>
        <ol className="idol-ranking">{rows.map(row => <li key={row.id}>
          <span className="rank-position">{String(row.rank).padStart(2,'0')}</span>
          <IdolPortrait idol={row} priority={row.rank<=3}/>
          <div className="min-w-0"><h3>{row.name}</h3><p>{row.group}</p><small>Favoritos {row.favoritePoints} · Votos {row.votePoints} · Mega voto {row.periodicPoints||0}</small></div>
          <div className="idol-total"><small>Total</small><strong>{row.points}</strong></div>
        </li>)}</ol>
      </section>;
    })}</div>}
  </section>;
}

export function App() {
  const [theme,setTheme] = useState<'dark'|'light'>(() => {
    if (typeof localStorage !== 'undefined') return (localStorage.getItem('fan-choice-theme') as 'dark'|'light') || (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    return 'dark';
  });
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('fan-choice-theme',theme);document.querySelector('meta[name=theme-color]')?.setAttribute('content',theme==='dark'?'#0e0e12':'#f4f2ec');},[theme]);
  const [tab,setTab] = useState('rankings');
  const [heroSlide,setHeroSlide] = useState(0);
  const [user,setUser] = useState<Participant | null>(null);
  // Memory-only history cache; discard it whenever the signed-in participant changes.
  const historyCache = useMemo<LifetimeHistoryCache>(() => ({ data: null, loaded: false }), [user?.id]);
  const [overview,setOverview] = useState<Overview | null>(null);
  const [idolOverview,setIdolOverview] = useState<IdolOverview | null>(null);
  const [idolOverviewError,setIdolOverviewError] = useState<UserError | null>(null);
  const [artists,setArtists] = useState<Artist[]>([]);
  const [archives,setArchives] = useState<ArchiveSummary[]>([]);
  const [archivesLoaded,setArchivesLoaded] = useState(false);
  const [archive,setArchive] = useState<ArchivedSeasonRecord | null>(null);
  const [votes,setVotes] = useState<Votes | null>(null);
  const [category,setCategory] = useState<Category>('male');
  const [selections,setSelections] = useState<Record<Category,string[]>>({male:emptyBallot(),female:emptyBallot()});
  const [error,setError] = useState<UserError | null>(null);
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const actionLock = useRef(false);
  const refreshCycle = useRef(0);
  const voteLocks = useRef<Record<Category, boolean>>({male:false,female:false});
  const [savingVotes,setSavingVotes] = useState<Record<Category, boolean>>({male:false,female:false});
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
  const retryAction = useRef<(() => Promise<void>) | null>(null);
  const tabRef = useRef(tab);
  function navigate(nextTab:string) { tabRef.current=nextTab;setTab(nextTab);setError(null);retryAction.current=null;setNotice(''); }
  function reportError(cause:unknown,retry?:()=>Promise<void>) { setError(toUserError(cause));retryAction.current=retry||null; }
  async function refresh(includeArtists = false) {
    const [o,c] = await Promise.all([
      unwrap(apiClient.getOverview()),
      includeArtists ? unwrap(apiClient.getArtists()) : Promise.resolve(null),
    ]);
    setOverview(o);if(c)setArtists(c.artists);
  }
  async function refreshIdolOverview() {
    try {
      const data = await unwrap(apiClient.request<IdolOverview>('/idols'));
      setIdolOverview(data);setIdolOverviewError(null);
    } catch(e) { setIdolOverviewError(toUserError(e)); }
  }
  async function refreshArchives() {
    const a = await unwrap(apiClient.getArchivedSeasons());
    setArchives(a.seasons);setArchivesLoaded(true);
  }
  async function refreshVotes() {
    if (!apiClient.getToken()) {setVotes(null);return;}
    setVotes(await unwrap(apiClient.getTodayVotes()));
  }
  useEffect(() => {
    let active = true;
    void refresh(true).catch(e => {if(active)reportError(e,()=>refresh(true));});
    if (apiClient.getToken()) void unwrap(apiClient.getMe()).then(d => {if(active){setUser(d.user);void refreshVotes().catch(e=>reportError(e,refreshVotes));}}).catch(e=>{if(active)reportError(e,()=>unwrap(apiClient.getMe()).then(d=>setUser(d.user)));});
    const interval = setInterval(() => {
      if(!active || document.visibilityState!=='visible') return;
      setDate(localDate());
      refreshCycle.current+=1;
      void refresh(refreshCycle.current%5===0).catch(e=>{if(tabRef.current==='rankings'||tabRef.current==='ranking')reportError(e,()=>refresh(true));});
      if(refreshCycle.current%5===0) void refreshIdolOverview();
    },60000);
    return () => {active=false;clearInterval(interval);};
  },[]);
  useEffect(() => { setVoteConfirmation(null);setSelections({male:emptyBallot(),female:emptyBallot()}); }, [date,user?.id]);
  useEffect(() => { if(user) void refreshVotes().catch(e=>{if(tabRef.current==='voting')reportError(e,refreshVotes);}); },[date,user?.id]);
  useEffect(() => {
    if(!votes || votes.competitionDate!==date) return;
    setSelections(previous=>{
      const fromBallot=(items:Votes['maleBallot']['items'])=>Array.from({length:5},(_,i)=>items.find(it=>it.rankPosition===i+1)?.artistId || '');
      return {
        male:votes.maleBallot.status==='saved'?fromBallot(votes.maleBallot.items):previous.male,
        female:votes.femaleBallot.status==='saved'?fromBallot(votes.femaleBallot.items):previous.female,
      };
    });
  },[votes?.competitionDate,votes?.maleBallot.status,votes?.maleBallot.items,votes?.femaleBallot.status,votes?.femaleBallot.items,date]);
  useEffect(() => {
    // Existing standings stay visible while a returning view refreshes.
    if (tab==='rankings' || tab==='ranking') { void refresh().catch(e=>reportError(e,()=>refresh(true))); void refreshIdolOverview(); }
    if (tab==='archive') void refreshArchives().catch(e=>reportError(e,refreshArchives));
  }, [tab]);
  async function action(work: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current=true;setBusy(true);setError(null);retryAction.current=null;setNotice('');
    try { await work(); } catch(e) {reportError(e,work);if(!apiClient.getToken()){setUser(null);setVotes(null);}} finally {actionLock.current=false;setBusy(false);}
  }
  async function submitVote() {
    const target=category;
    if (!canVote || voteLocks.current[target]) return;
    voteLocks.current[target]=true;
    setSavingVotes(previous=>({...previous,[target]:true}));setError(null);setNotice('');
    const items=selection.map((artistId,i)=>({artistId,rankPosition:i+1}));
    try {
      await unwrap(apiClient.submitBallot(target,items,date));
      setVotes(previous=>previous && previous.competitionDate===date ? {...previous,[target==='male'?'maleBallot':'femaleBallot']:{status:'saved',items}} : previous);
      setVoteConfirmation(target);
    } catch(e) {
      reportError(e,()=>submitVote());
      if(!apiClient.getToken()){setUser(null);setVotes(null);}
    }
    finally {
      voteLocks.current[target]=false;
      setSavingVotes(previous=>({...previous,[target]:false}));
    }
  }
  const season = overview?.season;
  const champion = overview?.standings.absoluteChampion;
  const homeSlides: { artistName: string; src: string }[] = [
    { artistName: 'TWICE', src: homeBannerOne },
    { artistName: 'SEVENTEEN', src: homeBannerTwo },
    { artistName: 'LE SSERAFIM', src: homeBannerThree },
    { artistName: 'Xdinary Heroes', src: homeBannerFour },
    { artistName: 'NMIXX', src: homeBannerFive },
    { artistName: 'B.I', src: homeBannerSix },
    { artistName: 'RESCENE', src: homeBannerSeven },
  ];
  useEffect(() => {
    if (homeSlides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setHeroSlide(current => (current + 1) % homeSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, [homeSlides.length]);
  useEffect(() => { if (heroSlide >= homeSlides.length) setHeroSlide(0); }, [heroSlide, homeSlides.length]);
  const eligible = artists.filter(a=>a.category===category && a.isEligible && a.status==='approved' && a.eligibilityEffectiveDate<=date);
  const selection = selections[category];
  const currentBallot = votes?.[category==='male'?'maleBallot':'femaleBallot'];
  const votedToday = votes?.competitionDate===date && currentBallot?.status==='saved';
  const otherCategory: Category = category==='male'?'female':'male';
  const otherVoted = votes?.competitionDate===date && votes?.[otherCategory==='male'?'maleBallot':'femaleBallot'].status==='saved';
  const canVote = !!user && !!season && season.startDate<=date && votes?.competitionDate===date && !votes?.isLocked && !votedToday;
  return <div className="league-app">
    <header className="site-header"><div className="header-inner">
      <a href="/" className="brand" aria-label="Fan Choice Awards, inicio"><span className="brand-mark"><img src="/icons/favicon-48.png?v=2" alt="" width="48" height="48"/></span><span>Fan Choice <b>Awards</b></span></a>
      <div className="header-actions">
        <button className="theme-toggle" type="button" aria-label={theme==='dark'?'Cambiar al tema Día':'Cambiar al tema Noche'} title={theme==='dark'?'Tema Día':'Tema Noche'} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
        {user ? <details className="account-menu"><summary aria-label={`Menú de usuario: ${user.displayName}`}><UserRound size={17}/><span>{user.displayName}</span><ChevronDown className="account-chevron" size={15}/></summary><div className="account-menu-panel"><p className="account-menu-name">{user.displayName}</p><span className="account-menu-role">{user.role==='admin'?'Administración':'Participante'}</span>{user.role==='admin'&&<button type="button" onClick={e=>{navigate('admin');e.currentTarget.closest('details')?.removeAttribute('open');}}>Abrir administración <ArrowRight size={15}/></button>}<button type="button" className="account-logout" onClick={e=>{apiClient.setToken(null);setUser(null);setVotes(null);navigate('rankings');setNotice('Sesión cerrada.');e.currentTarget.closest('details')?.removeAttribute('open');}}><LogOut size={15}/> Cerrar sesión</button></div></details> : <button className="login-header-button" onClick={()=>setShowLogin(true)}><UserRound size={16}/> Entrar</button>}
      </div>
      <nav className="site-nav" aria-label="Navegación principal">{[['rankings','Inicio'],['ranking','Ranking'],['voting','Votar'],['periodic','Mega Voto'],['idols','Idols'],['history','Stats · Spotify'],['archive','Archivo']].map(([id,label])=><button key={id} type="button" onClick={()=>navigate(id)} aria-current={tab===id?'page':undefined} className={tab===id?'nav-tab is-active':'nav-tab'}>{label}</button>)}</nav>
    </div></header>
    <main data-section={tab} className={'page-content space-y-7 '+(tab==='rankings'?'rankings-home':'')}>
      {error && !showLogin && <ErrorNotice error={error} onRetry={()=>{const retry=retryAction.current;if(retry)void action(retry);else setError(null);}} onDismiss={()=>{setError(null);retryAction.current=null;}}/>}
      {notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 flex items-center gap-2"><CheckCircle2 size={18}/>{notice}</p>}
      {!overview && tab==='rankings' && !error && <LoadingSkeleton hero/>}
      {tab==='rankings' && overview && <>
      <section className="season-hero season-hero-premium" aria-roledescription="carrusel" aria-label="Destacados de la temporada"><img src={homeSlides[heroSlide].src} alt="" loading="eager" fetchPriority="high" decoding="async" width={1920} height={1080} className="hero-image"/><div className="hero-content"><p className="eyebrow"><Sparkles size={14}/> Fan Choice · Music Awards</p><h1>Fan Choice <span>Awards</span></h1><p className="hero-season-name">{season?.name || 'Entre temporadas'}</p><p className="hero-caption">{homeSlides[heroSlide].artistName} · Foto destacada · K-pop & J-pop</p><div className="hero-actions"><button className={button} onClick={()=>navigate('voting')}>Votar ahora <ArrowRight size={16}/></button><button className="hero-secondary-action" onClick={()=>navigate('idols')}>Explorar idols</button></div></div><div className="hero-side-note"><div className="season-seal"><span>SEASON</span><strong>02</strong><span>{season?.status==='active'?'EN VIVO':'AWARDS'}</span></div><div className="hero-stat"><Users size={17}/><span><strong>{artists.length}</strong> artistas</span></div></div>{homeSlides.length > 1 && <div className="hero-carousel-controls" aria-label="Controles de destacados"><span>{String(heroSlide + 1).padStart(2,'0')} <i/> {String(homeSlides.length).padStart(2,'0')}</span><button type="button" aria-label="Imagen anterior" onClick={()=>setHeroSlide(current=>(current-1+homeSlides.length)%homeSlides.length)}><ArrowLeft size={16}/></button><button type="button" aria-label="Siguiente imagen" onClick={()=>setHeroSlide(current=>(current+1)%homeSlides.length)}><ArrowRight size={16}/></button></div>}<span className="hero-watermark" aria-hidden="true">FC</span><div className="hero-bottomline"><span><i/> {season?.status==='active'?'Temporada activa · en vivo':'Ranking de temporada'}</span><span>Panamá · K-pop · J-pop</span></div></section>
        <section className="winner-stage"><div className="home-section-heading winner-section-heading"><div><p className="home-section-kicker">La cima de la temporada</p><h2>Los líderes</h2></div><button className="home-link-button" onClick={()=>navigate('ranking')}>Ver ranking completo <ArrowRight size={15}/></button></div><div className="winner-grid">
          <article className="winner-card winner-overall"><div className="winner-card-art"><span>01</span><div className="winner-orbit"/></div><div className="winner-overall-copy"><p className="winner-card-label"><Trophy size={14}/> Campeón absoluto · Artistas</p><div className="winner-main-identity"><div className="champion-photo"><span className="photo-initials" aria-hidden="true">{season && champion && champion.cumulativePoints>0 ? champion.artist.displayName.split(' ').map(word=>word[0]).slice(0,2).join('') : 'FC'}</span>{season && champion && champion.cumulativePoints>0 && champion.artist.imageUrl && <img src={champion.artist.imageUrl.replace('ab6761610000e5eb','ab6761610000f178')} alt={champion.artist.displayName} loading="eager" decoding="async" width={108} height={108} onError={e=>{if(e.currentTarget.getAttribute('src')!==champion.artist.imageUrl){e.currentTarget.src=champion.artist.imageUrl!;}else{e.currentTarget.style.display='none';}}}/>}</div><div className="champion-info"><h3>{season && champion && champion.cumulativePoints>0 ? champion.artist.displayName : 'Aún sin ganador'}</h3><p className="winner-category">{season && champion?.cumulativePoints ? (champion.artist.artistType==='group'?'Grupo':'Solista')+' · '+(champion.artist.category==='male'?'Categoría hombres':'Categoría mujeres') : 'Los votos definirán al campeón absoluto'}</p></div></div><div className="winner-scoreline"><strong>{season ? champion?.cumulativePoints || 0 : 0}</strong><span>puntos acumulados</span></div></div></article>
          <IdolWinnerCard category="male" winner={idolOverview?.rankings.male[0]}/><IdolWinnerCard category="female" winner={idolOverview?.rankings.female[0]}/>
        </div></section>
      </>}
      {tab==='ranking' && overview && <RankingsPage season={season || null} standings={overview.standings} idols={idolOverview} idolError={idolOverviewError ? `${idolOverviewError.code}: ${idolOverviewError.message}` : null} onRetryIdols={()=>void refreshIdolOverview()}/>}
      {tab==='ranking' && !overview && !error && <LoadingSkeleton/>}
      {tab==='idols' && <Suspense fallback={<LoadingSkeleton/>}><IdolLeague key={user?.id || 'public'} user={user} onLogin={()=>setShowLogin(true)}/></Suspense>}
      {tab==='periodic' && <Suspense fallback={<LoadingSkeleton/>}><PeriodicVoting key={user?.id||'public'} user={user} onLogin={()=>setShowLogin(true)}/></Suspense>}
      {tab==='history' && <Suspense fallback={<LoadingSkeleton/>}><LifetimeHistory key={user?.id || 'public'} artists={artists} isAdmin={user?.role==='admin'} cache={historyCache}/></Suspense>}
      {tab==='voting' && <section className={card+' max-w-3xl mx-auto'}><div className="flex justify-between gap-4"><div><p className="text-emerald-300 text-xs uppercase tracking-widest">Votación diaria</p><h1 className="text-3xl font-bold mt-2">Tu Top 5</h1><p className="text-neutral-400 mt-2">{date} · Panamá · hasta las 23:59</p></div><Lock className="text-neutral-600"/></div>
        {!user ? <div className="mt-8"><p className="mb-4">Inicia sesión para guardar tu selección.</p><button className={button} onClick={()=>setShowLogin(true)}>Entrar</button></div> : <>
          {!season && <p className="mt-6 text-amber-300">No hay una temporada activa.</p>}
          <div className="category-tabs">{(['male','female'] as Category[]).map(c=><button key={c} aria-pressed={category===c} onClick={()=>{setCategory(c);setNotice('');}} className={'category-tab '+(category===c?'is-active':'')}>{c==='male'?'Hombres':'Mujeres'}</button>)}</div>
          {!votes || votes.competitionDate!==date ? <p className="text-neutral-400 py-6" role="status">Cargando tu votación de hoy…</p> : votedToday ? <div className="saved-vote">
            <div className="saved-vote-heading"><div className="vote-success-icon"><CheckCircle2 aria-hidden="true"/></div><div><p className="eyebrow">{category==='male'?'Hombres':'Mujeres'} · confirmado</p><h2>Ya votaste hoy</h2><p>Tu Top 5 está guardado. Gracias por participar.</p></div></div>
            {season && <NextVoteClock competitionDate={date}/>}
            <div className="saved-ballot"><h3>Tu selección de hoy</h3><ol>{[...(currentBallot?.items || [])].sort((a,b)=>a.rankPosition-b.rankPosition).map(item=><li key={item.rankPosition}><span className="saved-ballot-rank">{String(item.rankPosition).padStart(2,'0')}</span><strong>{artists.find(artist=>artist.id===item.artistId)?.displayName || 'Artista del catálogo'}</strong><span className="saved-ballot-points">{6-item.rankPosition} pts</span></li>)}</ol></div>
            {season && !otherVoted && <button type="button" className={button+' other-vote-button'} onClick={()=>setCategory(otherCategory)}>Votar en {otherCategory==='male'?'Hombres':'Mujeres'} <span aria-hidden="true">→</span></button>}
            {otherVoted && <p className="both-votes-done"><CheckCircle2 size={16} aria-hidden="true"/> Ya completaste ambas categorías.</p>}
          </div> : <>
          <div className="space-y-4">{selection.map((id,i)=><label key={i} className="flex items-center gap-4"><span className="text-emerald-300 font-bold text-xl w-8">{i+1}</span><select aria-label={`Artista en posición ${i+1}`} className={field} value={id} disabled={!canVote || savingVotes[category]} onChange={e=>setSelections(previous=>({...previous,[category]:previous[category].map((v,j)=>j===i?e.target.value:v)}))}><option value="">Selecciona un artista</option>{eligible.map(a=><option key={a.id} value={a.id} disabled={selection.includes(a.id)&&id!==a.id}>{a.displayName}</option>)}</select><span className="text-sm text-neutral-500 w-14">{5-i} pts</span></label>)}</div>
          <button className={button+' mt-7'} disabled={savingVotes[category] || !canVote || selection.some(v=>!v) || new Set(selection).size!==5} onClick={()=>void submitVote()}>{savingVotes[category]?'Guardando…':'Guardar Top 5'}</button><p className="text-xs text-neutral-500 mt-4">Un Top 5 por categoría y día. Puntos: 5, 4, 3, 2 y 1.</p>
          </>}

        </>}
      </section>}
      {tab==='archive' && <><h1 className="text-3xl font-bold">Archivo de temporadas</h1>{!archivesLoaded && !error && <LoadingSkeleton/>}{archivesLoaded && !archives.length && <p className={card}>Aún no hay temporadas cerradas.</p>}<div className="flex flex-wrap gap-3">{archives.map(a=><button key={a.seasonId} className={card+' text-left hover:border-emerald-600'} disabled={busy} onClick={()=>void action(async()=>{const data=await unwrap(apiClient.getArchivedSeason(a.seasonId));setArchive(data.archive);})}><CalendarDays className="text-emerald-400 mb-2"/><strong>{a.name}</strong><p className="text-sm text-neutral-500">Cerrada {time(a.closedAt)}</p></button>)}</div>{archive && <><section className={card}><h2 className="text-2xl font-bold">{archive.season.name}</h2><p className="mt-3">Campeón: <strong className="text-amber-300">{archive.absoluteChampion.artist.displayName}</strong></p><p className="text-neutral-400 mt-2">{archive.totalVotesCast} selecciones votadas · {archive.totalStreamsLogged} reproducciones · Cerrada por {archive.closedByDisplayName}</p></section><CategoryRankings key={archive.season.id} maleRows={archive.maleTop10} femaleRows={archive.femaleTop10}/><ArchivedIdolRankings rankings={archive.idolRankings}/></>}</>}
      {tab==='admin' && user?.role==='admin' && <><h1 className="text-3xl font-bold">Administración</h1><div className="grid lg:grid-cols-2 gap-6">
        <section className={card}><h2 className="text-xl font-bold mb-3">Sincronizar reproducciones</h2><p className="text-neutral-400 text-sm mb-5">Actualización automática cada 15 minutos. Elige un día para sincronizarlo.</p><input aria-label="Fecha de sincronización" type="date" max={date} className={field} value={syncDate} onChange={e=>setSyncDate(e.target.value)}/><button disabled={busy} className={button+' mt-4'} onClick={()=>void action(async()=>{const d=await unwrap(apiClient.triggerSync(syncDate));await refresh(true);setNotice(`Sincronización completada: ${d.syncResult.recordsProcessed} registros guardados.${d.syncResult.ignoredArtists?.length ? ' Fuera del catálogo: ' + d.syncResult.ignoredArtists.join(', ') + '.' : ''}`);})}>{busy?'Procesando…':'Sincronizar día'}</button></section>
        <section className={card}><h2 className="text-xl font-bold mb-3">{season?'Cerrar temporada':'Crear temporada'}</h2>{season ? <><p className="text-neutral-400 text-sm mb-4">Se congelarán los resultados de {season.name}. Esta operación no se puede deshacer desde la aplicación. Escribe FREEZE_SEASON para confirmar.</p><input aria-label="Confirmar cierre" className={field} value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="FREEZE_SEASON"/><button className={button+' mt-4'} disabled={busy||confirmation!=='FREEZE_SEASON'} onClick={()=>void action(async()=>{await unwrap(apiClient.request(`/admin/seasons/${season.id}/close`,{method:'POST',body:JSON.stringify({confirmCode:confirmation})}));setConfirmation('');await Promise.all([refresh(),refreshArchives()]);setNotice('Temporada cerrada. Sus resultados están guardados en el archivo.');})}>Cerrar y archivar</button></> : <form className="space-y-3" onSubmit={e=>{e.preventDefault();void action(async()=>{await unwrap(apiClient.request('/admin/seasons',{method:'POST',body:JSON.stringify({name:seasonName,description:seasonDescription,startDate:seasonStart})}));await refresh();setSeasonName('');setNotice('Temporada creada. La importación automática recuperará sus reproducciones.');});}}><input required maxLength={100} aria-label="Nombre de temporada" placeholder="Nombre de la temporada" className={field} value={seasonName} onChange={e=>setSeasonName(e.target.value)}/><textarea aria-label="Descripción" placeholder="Descripción (opcional)" className={field} value={seasonDescription} onChange={e=>setSeasonDescription(e.target.value)}/><input required aria-label="Inicio de temporada" type="date" className={field} value={seasonStart} onChange={e=>setSeasonStart(e.target.value)}/><button disabled={busy} className={button}>Crear temporada</button></form>}</section>
      </div><section className={card}><h2 className="text-xl font-bold mb-4">Añadir artista al catálogo</h2><form className="grid md:grid-cols-3 gap-4" onSubmit={e=>{e.preventDefault();void action(async()=>{await unwrap(apiClient.request('/admin/artists',{method:'POST',body:JSON.stringify(artistForm)}));await refresh(true);setArtistForm({...artistForm,displayName:'',spotifyArtistId:'',imageUrl:''});setNotice('Artista guardado en el catálogo.');});}}>
        <input aria-label="Nombre del artista" required placeholder="Nombre del artista" maxLength={150} className={field} value={artistForm.displayName} onChange={e=>setArtistForm({...artistForm,displayName:e.target.value})}/><input aria-label="ID de Spotify" required pattern="[A-Za-z0-9]{22}" placeholder="ID de Spotify (22 caracteres)" className={field} value={artistForm.spotifyArtistId} onChange={e=>setArtistForm({...artistForm,spotifyArtistId:e.target.value.trim()})}/><select aria-label="Categoría" className={field} value={artistForm.category} onChange={e=>setArtistForm({...artistForm,category:e.target.value})}><option value="male">Hombres</option><option value="female">Mujeres</option></select><select aria-label="Tipo de artista" className={field} value={artistForm.artistType} onChange={e=>setArtistForm({...artistForm,artistType:e.target.value})}><option value="group">Grupo</option><option value="soloist">Solista</option></select><select aria-label="Escena musical" className={field} value={artistForm.musicScene} onChange={e=>setArtistForm({...artistForm,musicScene:e.target.value})}><option value="kpop">K-pop</option><option value="jpop">J-pop</option><option value="both">Ambas</option></select><input aria-label="País de origen" required pattern="[A-Z]{2}" placeholder="País: KR / JP" className={field} value={artistForm.originCountry} onChange={e=>setArtistForm({...artistForm,originCountry:e.target.value.toUpperCase()})}/><input aria-label="URL de imagen" type="url" placeholder="Imagen HTTPS (opcional)" className={field+' md:col-span-2'} value={artistForm.imageUrl} onChange={e=>setArtistForm({...artistForm,imageUrl:e.target.value})}/><button disabled={busy} className={button}><Plus className="inline w-4 mr-2"/>Añadir artista</button>
      </form></section><section className={card}><div className="flex flex-wrap justify-between gap-4 mb-5"><h2 className="text-xl font-bold">Catálogo · {artists.length} artistas</h2><input aria-label="Buscar artista" className={field+' max-w-xs'} placeholder="Buscar artista…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{artists.filter(a=>a.displayName.toLowerCase().includes(search.toLowerCase())).map(a=><div key={a.id} className="flex gap-3 items-center border border-neutral-800 rounded-xl p-3">{a.imageUrl && <img src={a.imageUrl} alt="" loading="lazy" decoding="async" width={40} height={40} className="w-10 h-10 object-cover rounded-full"/>}<div><p className="font-semibold text-sm">{a.displayName}</p><p className="text-xs text-neutral-500">{a.category==='male'?'Hombres':'Mujeres'} · {a.musicScene}</p></div></div>)}</div></section></>}
      <footer className="border-t border-neutral-800 pt-6 text-xs text-neutral-500 flex flex-wrap justify-between gap-3"><span>Fan Choice Most Populars</span><span>Votos + Bonus · Panamá</span></footer>
    </main>
    {voteConfirmation && <VoteConfirmation category={voteConfirmation} onClose={()=>setVoteConfirmation(null)}/>}
    {showLogin && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-5"><section role="dialog" aria-modal="true" aria-labelledby="login-title" className={card+' w-full max-w-md bg-neutral-950'}><h2 id="login-title" className="text-2xl font-bold mb-2">Entrar</h2><p className="text-neutral-400 text-sm mb-6">Usa tu usuario y contraseña para votar.</p><form className="space-y-4" onSubmit={e=>{e.preventDefault();void action(async()=>{const d=await unwrap(apiClient.login(username.trim(),password));apiClient.setToken(d.token);setUser(d.user);setPassword('');await refreshVotes();setShowLogin(false);setNotice(`Bienvenido, ${d.user.displayName}.`);});}}><input autoFocus required autoComplete="username" aria-label="Usuario" className={field} placeholder="Usuario" value={username} onChange={e=>setUsername(e.target.value)}/><input required type="password" autoComplete="current-password" aria-label="Contraseña" className={field} placeholder="Contraseña" value={password} onChange={e=>setPassword(e.target.value)}/>{error && <ErrorNotice compact error={error} onDismiss={()=>setError(null)}/>}<div className="flex justify-between items-center"><button type="button" className="text-neutral-400" disabled={busy} onClick={()=>{setShowLogin(false);setPassword('');setError(null);}}>Cancelar</button><button disabled={busy} className={button}>{busy?'Entrando…':'Entrar'}</button></div></form></section></div>}
  </div>;
}

export default App;
