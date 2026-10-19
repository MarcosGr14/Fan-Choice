import { leagueStore } from '../repositories/leagueStore';
import { syncService } from './syncService';
import { dateRange, today } from './dates';
import { syncLifetime } from './lifetimeService';
import { syncListeningRange } from './rangeSync';
import { CONFIG } from '../config';

// The server owns this schedule. It runs only while the app server is running.
// Catch up missing days, then refresh recent days for delayed Spotify history.
export async function importSeasonHistory(force = false) {
  const plan = await leagueStore.withFreshState(async () => {
    const season = leagueStore.getActiveSeason();
    if (!season || season.startDate > today()) return [];
    const completed = await leagueStore.successfulSyncDates();
    const recent = new Date(`${today()}T12:00:00Z`);
    recent.setUTCDate(recent.getUTCDate() - 2);
    const recentDate = recent.toISOString().slice(0,10);
    return dateRange(season.startDate, today()).filter(date => force || !completed.has(date) || date >= recentDate);
  });
  if (plan.length && !CONFIG.USE_MOCK_LISTENING_DATA) {
    return leagueStore.withFreshState(async () => {
      const active=leagueStore.getActiveSeason();
      if(!active || active.startDate>today()) return [];
      return syncListeningRange(plan[0]<active.startDate ? active.startDate : plan[0],today());
    });
  }
  const results = [];
  for (const date of plan) {
    const result = await leagueStore.withFreshState(async () => {
      const season = leagueStore.getActiveSeason();
      if (!season || date < season.startDate) return null;
      return syncService.syncDailyStats(date);
    });
    if (result) results.push({ date, ...result });
  }
  return results;
}

export function startAutoSync() {
  if (CONFIG.NODE_ENV === 'test' || CONFIG.USE_MOCK_LISTENING_DATA || !leagueStore.isPersistent()) return () => {};
  let running = false;
  let stopped = false;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const results = await importSeasonHistory();
      await leagueStore.withFreshState(() => syncLifetime());
      console.log(`[AutoSync] ${results.filter(r=>r.success).length}/${results.length} días sincronizados.`);
    } catch (error) { console.error('[AutoSync]', error); }
    finally { running = false; }
  };
  const initial = setTimeout(() => { void run(); }, 1000);
  const timer = setInterval(() => { void run(); }, 15 * 60 * 1000);
  timer.unref(); initial.unref();
  return () => { stopped = true; clearTimeout(initial);clearInterval(timer); };
}
