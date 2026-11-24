import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary';
import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(error => console.warn('No se pudo activar el modo instalable:', error)); });

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
