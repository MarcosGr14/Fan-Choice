// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: REST API V1 ROUTES ROUTER
// ==============================================================================

import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { rateLimiter } from '../middleware/security';

// Controllers
import * as authController from '../controllers/authController';
import * as leagueController from '../controllers/leagueController';
import * as voteController from '../controllers/voteController';
import * as archiveController from '../controllers/archiveController';
import * as adminController from '../controllers/adminController';
import { leagueStore } from '../repositories/leagueStore';
import { syncLifetime } from '../services/lifetimeService';
import { CONFIG } from '../config';

const router = Router();

// --- 1. HEALTH CHECK ---
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: CONFIG.APP_DISPLAY_NAME,
    timezone: CONFIG.LEAGUE_TIMEZONE,
    timestamp: new Date().toISOString(),
  });
});

// --- 2. AUTHENTICATION ---
router.post('/auth/login', rateLimiter(10, 60000), authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// --- 3. LEAGUE PUBLIC DATA ---
router.get('/league/overview', leagueController.getLeagueOverview);
router.get('/league/artists', leagueController.getArtistsCatalog);

// --- 4. VOTING (AUTHENTICATED) ---
router.get('/votes/today', authenticate, voteController.getTodayVotes);
router.put('/votes/ballot', authenticate, voteController.submitBallot);

// --- 5. HISTORICAL ARCHIVE ---
router.get('/archive/seasons', archiveController.listArchivedSeasons);
router.get('/archive/seasons/:seasonId', archiveController.getArchivedSeasonDetails);

// --- 6. ADMIN GOVERNANCE (ROLE = 'admin') ---
router.post('/admin/seasons', authenticate, requireAdmin, adminController.createSeason);
router.post('/admin/seasons/:seasonId/close', authenticate, requireAdmin, adminController.closeSeason);
router.post('/admin/artists', authenticate, requireAdmin, adminController.addCuratedArtist);
router.post('/admin/sync/trigger', authenticate, requireAdmin, adminController.triggerSync);

router.get('/league/listening-history', async (_req, res) => {
  const cached = await leagueStore.loadLifetime();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...cached, available: !!cached });
});
router.post('/admin/sync/history', authenticate, requireAdmin, async (_req, res) => {
  try {
    const snapshot = await syncLifetime();
    res.json({success:true,totalStreams:snapshot.summary.combined_streams,totalArtists:snapshot.total_records});
  } catch (error: any) { res.status(502).json({success:false,error:error.message}); }
});

// Express 4 does not forward rejected async handlers automatically.
for (const layer of (router as any).stack) {
  if (!layer.route) continue;
  for (const handler of layer.route.stack) {
    const original = handler.handle;
    handler.handle = (req: any, res: any, next: any) => {
      try { Promise.resolve(original(req, res, next)).catch(next); }
      catch (error) { next(error); }
    };
  }
}
export default router;
