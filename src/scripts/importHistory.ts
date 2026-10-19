import { leagueStore } from '../repositories/leagueStore';
import { importSeasonHistory } from '../services/autoSync';
try {
  await leagueStore.initFromDatabase();
  const results = await importSeasonHistory(true);
  for (const r of results) console.log(`${r.date}: ${r.success ? 'OK' : 'ERROR'} · ${r.recordsProcessed} registros · ${r.errorMessage || ''}`);
  if (results.some(r=>!r.success)) process.exitCode = 1;
} finally { await leagueStore.close(); }
