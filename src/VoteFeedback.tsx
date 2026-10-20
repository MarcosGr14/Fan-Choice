import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Category } from './types';

export function NextVoteClock({ competitionDate }: { competitionDate: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Panamá uses UTC-5 throughout the year, regardless of the viewer's timezone.
  const nextDay = Date.parse(`${competitionDate}T00:00:00-05:00`) + 86400000;
  const remaining = Math.max(0, Math.ceil((nextDay - now) / 1000));
  const units = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60];
  return <div className="next-vote">
    <p>{remaining ? 'Vuelve a votar dentro de' : 'Actualizando tu votación…'}</p>
    <div className="vote-countdown" role="timer" aria-label={`${units[0]} horas, ${units[1]} minutos y ${units[2]} segundos`}>
      {units.map((value, i) => <div key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['Horas', 'Minutos', 'Segundos'][i]}</span></div>)}
    </div>
    <small>A las 00:00 · hora de Panamá</small>
  </div>;
}

export function VoteConfirmation({ category, onClose, topSize = 5 }: { category: Category; onClose: () => void; topSize?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="vote-confirmation" aria-labelledby="vote-confirmation-title" aria-describedby="vote-confirmation-description" onCancel={onClose}>
    <div className="vote-success-icon"><CheckCircle2 aria-hidden="true"/></div>
    <p className="eyebrow">{category === 'male' ? 'Hombres' : 'Mujeres'} · voto registrado</p>
    <h2 id="vote-confirmation-title">¡Tu voto cuenta!</h2>
    <p id="vote-confirmation-description">Tu Top {topSize} de hoy quedó guardado.</p>
    <p className="vote-confirmation-note">Mañana puedes volver a apoyar a tus favoritos.</p>
    <button autoFocus type="button" className="league-button" onClick={onClose}>Ver mi votación</button>
  </dialog>;
}
