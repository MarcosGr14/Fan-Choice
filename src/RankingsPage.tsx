import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ArrowDown, ArrowUp, Crown, Trophy } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import type { ArtistCumulativeStats, Category, Season } from './types';
import type { IdolOverview, IdolStanding } from './types/idols';
import { IdolPortrait } from './IdolPortrait';

type ArtistStandings = { maleStats: ArtistCumulativeStats[]; femaleStats: ArtistCumulativeStats[]; absoluteChampion: ArtistCumulativeStats | null };
type Props = {
  season: Season | null;
  standings: ArtistStandings;
  idols: IdolOverview | null;
  idolError: string | null;
  onRetryIdols: () => void;
};
type Board = 'artists' | 'idols';
const categories: Category[] = ['male', 'female'];
const categoryName = (category: Category) => category === 'male' ? 'Hombres' : 'Mujeres';
const format = (value: number) => value.toLocaleString('es');

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setDisplay(value); return; }
    const start = performance.now();
    const from = display;
    let frame = 0;
    const update = (now: number) => {
      const progress = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(display)}</>;
}

function Portrait({ src, name, initials, priority = false }: { src?: string; name: string; initials: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="ranking-portrait">
    <span aria-hidden="true">{initials}</span>
    {src && !failed && <img src={src} alt={name} loading={priority ? 'eager' : 'lazy'} decoding="async" width={88} height={88} onError={() => setFailed(true)} />}
  </div>;
}

function VoteBars({ row, maxVotes, maxStreams }: { row: ArtistCumulativeStats; maxVotes: number; maxStreams: number }) {
  const votes = row.cumulativeVotePoints;
  const streams = row.cumulativeStreams;
  return <div className="ranking-bars">
    <div className="ranking-bar-item"><div><span>Puntos de voto</span><strong>{format(votes)}</strong></div><div className="ranking-bar-track" role="meter" aria-label={`Puntos de voto de ${row.artist.displayName}`} aria-valuemin={0} aria-valuemax={Math.max(maxVotes, 1)} aria-valuenow={votes}><i className="ranking-bar-votes" style={{ width: `${maxVotes ? votes / maxVotes * 100 : 0}%` }} /></div></div>
    <div className="ranking-bar-item"><div><span>Reproducciones</span><strong>{format(streams)}</strong></div><div className="ranking-bar-track" role="meter" aria-label={`Reproducciones de ${row.artist.displayName}`} aria-valuemin={0} aria-valuemax={Math.max(maxStreams, 1)} aria-valuenow={streams}><i className="ranking-bar-streams" style={{ width: `${maxStreams ? streams / maxStreams * 100 : 0}%` }} /></div></div>
    <div className="ranking-bonus"><span>Bonus de escucha</span><strong>{format(row.cumulativeBonusPoints)}</strong></div>
  </div>;
}

function ArtistEntry({ row, rank, maxVotes, maxStreams, compact = false }: { row: ArtistCumulativeStats; rank: number; maxVotes: number; maxStreams: number; compact?: boolean }) {
  const initials = row.artist.displayName.split(' ').map((word) => word[0]).slice(0, 2).join('');
  const image = row.artist.imageUrl?.replace('ab6761610000e5eb', 'ab6761610000f178');
  return <motion.li layout="position" layoutId={`artist-${row.artist.id}`} transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }} className={`ranking-artist-entry${rank === 1 ? ' ranking-first' : ''}${compact ? ' ranking-artist-compact' : ''}`}>
    <span className="ranking-entry-position">{String(rank).padStart(2, '0')}</span>
    <Portrait src={image} name={row.artist.displayName} initials={initials} priority={rank <= 3} />
    <div className="ranking-entry-name"><h3>{row.artist.displayName}</h3><p>{row.artist.artistType === 'group' ? 'Grupo' : 'Solista'} · {row.artist.originCountry}</p><span className={`ranking-movement ${row.isNewEntry || row.rankDelta > 0 ? 'is-up' : row.rankDelta < 0 ? 'is-down' : ''}`}>{row.isNewEntry ? 'Nuevo' : row.rankDelta > 0 ? <><ArrowUp size={12} /> {row.rankDelta}</> : row.rankDelta < 0 ? <><ArrowDown size={12} /> {Math.abs(row.rankDelta)}</> : 'Sin cambio'}</span></div>
    <VoteBars row={row} maxVotes={maxVotes} maxStreams={maxStreams} />
    <div className="ranking-total"><span>Puntos</span><strong><AnimatedNumber value={row.cumulativePoints} /></strong></div>
  </motion.li>;
}

function ArtistBoard({ category, rows }: { category: Category; rows: ArtistCumulativeStats[] }) {
  const topTen = rows.slice(0, 10);
  const maxVotes = Math.max(0, ...topTen.map((row) => row.cumulativeVotePoints));
  const maxStreams = Math.max(0, ...topTen.map((row) => row.cumulativeStreams));
  return <section className={`ranking-board ranking-board-${category}`} aria-label={`Top 10 de artistas: ${categoryName(category)}`}>
    <header className="ranking-board-heading"><div><p className="ranking-eyebrow">Artistas · Top 10</p><h2>{categoryName(category)}</h2></div><span className="ranking-category-mark">{category === 'male' ? 'Categoría masculina' : 'Categoría femenina'}</span></header>
    {topTen.length === 0 ? <p className="ranking-empty">Todavía no hay artistas en esta categoría.</p> : <>
      <ol className="ranking-podium">{topTen.slice(0, 3).map((row, index) => <ArtistEntry key={row.artist.id} row={row} rank={index + 1} maxVotes={maxVotes} maxStreams={maxStreams} />)}</ol>
      {topTen.length > 3 && <ol className="ranking-rest" start={4}>{topTen.slice(3).map((row, index) => <ArtistEntry key={row.artist.id} row={row} rank={index + 4} maxVotes={maxVotes} maxStreams={maxStreams} compact />)}</ol>}
    </>}
  </section>;
}

function IdolEntry({ idol, rank, compact = false }: { idol: IdolStanding; rank: number; compact?: boolean }) {
  return <motion.li layout="position" layoutId={`idol-${idol.id}`} transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }} className={`ranking-idol-entry${rank === 1 ? ' ranking-first' : ''}${compact ? ' ranking-idol-compact' : ''}`}>
    <span className="ranking-entry-position">{String(rank).padStart(2, '0')}</span>
    <IdolPortrait idol={idol} priority={rank <= 3} />
    <div className="ranking-entry-name"><h3>{idol.name}</h3><p>{idol.group}</p>{rank === 1 && <span className="ranking-movement">{idol.points > 0 ? 'Líder actual' : 'Aún sin votos'}</span>}</div>
    <div className="ranking-idol-breakdown"><span>Favoritos <strong>{format(idol.favoritePoints)}</strong></span><span>Votos <strong>{format(idol.votePoints)}</strong></span><span>Mega voto <strong>{format(idol.periodicPoints || 0)}</strong></span></div>
    <div className="ranking-total"><span>Puntos</span><strong><AnimatedNumber value={idol.points} /></strong></div>
  </motion.li>;
}

function IdolBoard({ category, rows }: { category: Category; rows: IdolStanding[] }) {
  const topTen = rows.slice(0, 10);
  return <section className={`ranking-board ranking-board-${category}`} aria-label={`Top 10 de idols: ${categoryName(category)}`}>
    <header className="ranking-board-heading"><div><p className="ranking-eyebrow">Idols · Top 10</p><h2>{categoryName(category)}</h2></div><span className="ranking-category-mark">{category === 'male' ? 'Categoría masculina' : 'Categoría femenina'}</span></header>
    {!rows.length && <p className="ranking-empty">Todavía no hay idols en esta categoría.</p>}
    {topTen.length > 0 && <>
      <ol className="ranking-podium ranking-idol-podium">{topTen.slice(0, 3).map((idol, index) => <IdolEntry key={idol.id} idol={idol} rank={index + 1} />)}</ol>
      {topTen.length > 3 && <ol className="ranking-rest ranking-idol-list" start={4}>{topTen.slice(3).map((idol, index) => <IdolEntry key={idol.id} idol={idol} rank={index + 4} compact />)}</ol>}
    </>}
  </section>;
}

export function RankingsPage({ season, standings, idols, idolError, onRetryIdols }: Props) {
  const [board, setBoard] = useState<Board>('artists');
  const [category, setCategory] = useState<Category>('male');
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const champion = standings.absoluteChampion;
  const championHasPoints = !!champion && champion.cumulativePoints > 0;
  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    if (!touchStart.current) return;
    const deltaX = event.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    setCategory(deltaX < 0 ? 'female' : 'male');
  }

  return <MotionConfig reducedMotion="user"><div className="rankings-page">
    <header className="rankings-page-heading"><div><p className="ranking-eyebrow">Fan Choice · La competencia</p><h1>Ranking</h1><p>Dos categorías independientes. Una clasificación clara y al día.</p></div><span className="ranking-season-label">{season?.name || 'Temporada sin iniciar'}</span></header>

    <section className="absolute-champion-card" aria-label="Campeón absoluto de artistas">
      {championHasPoints && champion.artist.imageUrl ? <Portrait src={champion.artist.imageUrl.replace('ab6761610000e5eb', 'ab6761610000f178')} name={champion.artist.displayName} initials={champion.artist.displayName.split(' ').map((word) => word[0]).slice(0, 2).join('')} priority /> : <div className="absolute-champion-icon"><Trophy aria-hidden="true" /></div>}
      <div className="absolute-champion-copy"><p className="ranking-eyebrow"><Crown size={14} /> Campeón absoluto · Artistas</p><h2>{championHasPoints ? champion.artist.displayName : 'Aún sin ganador'}</h2><span>{championHasPoints ? `${champion.artist.artistType === 'group' ? 'Grupo' : 'Solista'} · categoría ${categoryName(champion.artist.category)}` : 'Los puntos acumulados de ambas categorías definirán el liderazgo.'}</span></div>
      <div className="absolute-champion-points"><strong><AnimatedNumber value={championHasPoints ? champion.cumulativePoints : 0} /></strong><span>puntos</span></div>
    </section>

    <div className="ranking-board-switch" role="tablist" aria-label="Tipo de ranking">
      <button type="button" role="tab" aria-selected={board === 'artists'} id="ranking-tab-artists" aria-controls="ranking-panel" onClick={() => setBoard('artists')}>Artistas</button>
      <button type="button" role="tab" aria-selected={board === 'idols'} id="ranking-tab-idols" aria-controls="ranking-panel" onClick={() => setBoard('idols')}>Idols</button>
    </div>

    <div className={`ranking-category-switch ranking-category-${category}`} role="group" aria-label="Elegir categoría">
      {categories.map((item) => <button key={item} type="button" aria-pressed={category === item} className={category === item ? 'is-selected' : ''} onClick={() => setCategory(item)}>{categoryName(item)}</button>)}
      <span className="ranking-swipe-hint">Desliza para cambiar de categoría</span>
    </div>

    <div id="ranking-panel" role="tabpanel" aria-labelledby={`ranking-tab-${board}`} className="ranking-board-grid" onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
      {board === 'artists' ? <>{categories.map((item) => <div key={item} className={category === item ? 'ranking-mobile-visible' : 'ranking-mobile-hidden'}><ArtistBoard category={item} rows={item === 'male' ? standings.maleStats : standings.femaleStats} /></div>)}</> : idols ? <>{categories.map((item) => <div key={item} className={category === item ? 'ranking-mobile-visible' : 'ranking-mobile-hidden'}><IdolBoard category={item} rows={idols.rankings[item]} /></div>)}</> : idolError ? <div className="ranking-idol-error" role="status"><p>No se pudo cargar el ranking de idols.</p><code>{idolError}</code><button type="button" onClick={onRetryIdols}>Reintentar</button></div> : <div className="ranking-idol-loading" role="status">Cargando el ranking de idols…</div>}
    </div>
  </div></MotionConfig>;
}
