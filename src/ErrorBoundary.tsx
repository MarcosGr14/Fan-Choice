import React from 'react';
import { AlertCircle, RefreshCw, Trophy } from 'lucide-react';

type State = { failed: boolean };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[UI_RENDER_ERROR]', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-crash-shell">
      <section className="app-crash-card" role="alert">
        <Trophy className="app-crash-brand" aria-hidden="true"/>
        <AlertCircle className="app-crash-icon" aria-hidden="true"/>
        <h1>No se pudo mostrar esta pantalla</h1>
        <p>La aplicación sigue disponible. Recarga la página para volver a intentarlo.</p>
        <code>UI_RENDER_ERROR</code>
        <button type="button" className="league-button" onClick={()=>window.location.reload()}><RefreshCw size={16} aria-hidden="true"/> Recargar</button>
      </section>
    </main>;
  }
}
