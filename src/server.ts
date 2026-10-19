// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: EXPRESS REST APPLICATION SERVER
// ==============================================================================

import express from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { CONFIG } from './config';
import { securityHeaders, corsMiddleware } from './middleware/security';
import apiRouter from './routes/api';
import { startAutoSync } from './services/autoSync';
import { leagueStore } from './repositories/leagueStore';

export const app = express();

// Security and CORS
app.use(securityHeaders);
app.use(corsMiddleware);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', server: 'rankings-league-api', timestamp: new Date().toISOString() });
});

// API v1 Routing
app.use('/api/v1', (req, res, next) => {
  void leagueStore.withFreshState(async () => {
    // A request may disconnect while waiting for the shared state lock.
    // Its close event has already fired; do not wait forever and retain the lock.
    if (res.destroyed || res.writableEnded) return;
    await new Promise<void>((resolve) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      next();
    });
  }).catch(next);
}, apiRouter);
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API]', error.message);
  if (!res.headersSent) res.status(error.type === 'entity.parse.failed' ? 400 : 503).json({ success: false, error: 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.' });
});

// Serve the built UI when deployed together with the API.
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
if (CONFIG.NODE_ENV === 'production' && existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Rankings League API</title><h1>Rankings League API</h1><p>La API está funcionando. Para abrir la interfaz, ejecuta <code>npm run dev</code>.</p><p><a href="http://localhost:3000">Abrir la aplicación local</a></p><p><a href="/api/v1/health">Estado de la API</a></p></html>');
  });
}

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint no encontrado.' });
});

// Start listening if run directly
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = CONFIG.PORT;

  // Primero se cargan los datos de la base de datos (si hay DATABASE_URL) y
  // recién después se abre el puerto, para no atender peticiones con datos de ejemplo.
  leagueStore
    .initFromDatabase()
    .then(() => {
      const stopSync = startAutoSync();
      process.once('SIGTERM', () => { stopSync(); void leagueStore.close().finally(() => process.exit(0)); });
      app.listen(port, () => {
        console.log(`🚀 [RankingsLeague] Servidor REST API escuchando en http://127.0.0.1:${port}`);
        console.log(`📌 Base URL: http://127.0.0.1:${port}/api/v1`);
        console.log(`⏱️ Zona Horaria: ${CONFIG.LEAGUE_TIMEZONE}`);
        console.log(`💾 Almacenamiento: ${leagueStore.isPersistent() ? 'Postgres (Supabase)' : 'memoria (modo demo)'}`);
      });
    })
    .catch((err: any) => {
      console.error('❌ [RankingsLeague] No se pudo iniciar:', err.message);
      process.exit(1);
    });
}