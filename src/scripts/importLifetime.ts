import { leagueStore } from '../repositories/leagueStore';
import { syncLifetime } from '../services/lifetimeService';
try {
  await leagueStore.initFromDatabase();
  const snapshot = await leagueStore.withFreshState(() => syncLifetime());
  console.log(JSON.stringify({totalStreams:snapshot.summary.combined_streams,artists:snapshot.total_records,firstRecorded:snapshot.summary.first_played_at,accounts:snapshot.accounts.map(a=>a.nombre_display)}));
} finally { await leagueStore.close(); }
