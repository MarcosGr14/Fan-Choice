import React, { useState } from 'react';
import type { Idol } from './types/idols';

export function IdolPortrait({ idol, priority = false, large = false }: {
  idol: Pick<Idol, 'id' | 'name'>; priority?: boolean; large?: boolean;
}) {
  const src = `/images/idols/${encodeURIComponent(idol.id)}.webp`;
  const [failedSource, setFailedSource] = useState('');
  return <span className={'idol-portrait' + (large ? ' idol-portrait-large' : '')} aria-hidden="true">
    <span>{idol.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span>
    {failedSource !== src && <img src={src} alt="" width={large ? 144 : 72} height={large ? 144 : 72}
      loading={priority ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailedSource(src)} />}
  </span>;
}
