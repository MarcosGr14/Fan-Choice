import React from 'react';

export function LoadingSkeleton({ hero = false }: { hero?: boolean }) {
  return <section className="loading-skeleton" role="status" aria-label="Cargando clasificación" aria-busy="true">
    <span className="sr-only">Cargando datos…</span>
    <div aria-hidden="true">
      {hero && <div className="skeleton-hero skeleton-shimmer"><span className="skeleton-bar"/><span className="skeleton-bar skeleton-title"/></div>}
      <div className="skeleton-summary">{[0, 1, 2].map(i => <div key={i} className="skeleton-summary-card skeleton-shimmer"><span className="skeleton-bar"/><span className="skeleton-bar skeleton-title"/></div>)}</div>
      <div className="skeleton-section-title skeleton-bar"/>
      <div className="ranking-list">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={'artist-row skeleton-row skeleton-shimmer '+(i<3?'podium-row':'')}>
        <span className="rank-position skeleton-bar"/>
        <span className="artist-photo skeleton-block"/>
        <div className="artist-identity"><span className="skeleton-bar skeleton-name"/><span className="skeleton-bar"/></div>
        <div className="artist-metrics">{[0, 1, 2].map(j => <span key={j} className="metric skeleton-block"/>)}</div>
        <span className="artist-total skeleton-block"/>
      </div>)}</div>
    </div>
  </section>;
}
