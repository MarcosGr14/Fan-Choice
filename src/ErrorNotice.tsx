import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { ApiRequestError } from './services/apiClient';

export type UserError = { message: string; code: string };

export function toUserError(error: unknown): UserError {
  if (error instanceof ApiRequestError) return { message: error.message, code: error.code };
  if (error && typeof error === 'object' && 'message' in error) {
    const value = error as { message?: unknown; code?: unknown };
    return {
      message: typeof value.message === 'string' ? value.message : 'No se pudo completar la operación.',
      code: typeof value.code === 'string' ? value.code : 'APP_ERROR',
    };
  }
  return { message: 'No se pudo completar la operación. Inténtalo de nuevo.', code: 'APP_ERROR' };
}

export function userErrorFromResponse(message: string | null | undefined, code?: string | null, fallback = 'No se pudo completar la solicitud.') {
  return { message: message || fallback, code: code || 'REQUEST_ERROR' };
}

export function ErrorNotice({error, onRetry, onDismiss, compact = false}: {
  error: UserError;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  return <div className={'error-notice' + (compact ? ' error-notice-compact' : '')} role="alert" aria-live="assertive" aria-atomic="true">
    <AlertCircle className="error-notice-icon" aria-hidden="true"/>
    <div className="error-notice-copy"><strong>No se pudo completar</strong><p>{error.message}</p><code>{error.code}</code></div>
    <div className="error-notice-actions">
      {onRetry && <button type="button" className="error-notice-retry" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/> Reintentar</button>}
      {onDismiss && <button type="button" className="error-notice-dismiss" aria-label="Cerrar aviso" onClick={onDismiss}><X size={17} aria-hidden="true"/></button>}
    </div>
  </div>;
}
