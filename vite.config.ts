import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Request, Response } from 'express';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ command, mode }) => {
  // Cloudflare hosts the UI; its API lives in the separate Railway service.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && process.env.CF_PAGES === '1') {
    const apiUrl = env.VITE_API_BASE_URL;
    if (!apiUrl || !/^https:\/\/[^/]+\/api\/v1\/?$/.test(apiUrl)) {
      throw new Error('Configura VITE_API_BASE_URL=https://<servicio-de-la-liga>.up.railway.app/api/v1 en Cloudflare Pages.');
    }
  }
  return {
    plugins: [react(), tailwindcss(), {
      name: 'league-local-api',
      apply: 'serve',
      async configureServer(server) {
        // Do not import server configuration or database code during a frontend build.
        const [{ app }, { startAutoSync }, { leagueStore }] = await Promise.all([
          import('./src/server'),
          import('./src/services/autoSync'),
          import('./src/repositories/leagueStore'),
        ]);
        await leagueStore.initFromDatabase();
        const stopSync = startAutoSync();
        server.middlewares.use((req, res, next) => {
          const pathname = req.url?.split('?')[0] || '';
          if (pathname === '/health' || pathname === '/api' || pathname.startsWith('/api/')) {
            app(req as Request, res as Response, next);
          } else next();
        });
        server.httpServer?.once('close', () => { stopSync(); void leagueStore.close(); });
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
