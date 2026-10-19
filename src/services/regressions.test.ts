import { validateLifetimeSnapshot } from './lifetimeService';
import assert from 'node:assert/strict';
import { LeagueStore } from '../repositories/leagueStore';
import { SpotifyDuoChartsProvider } from './spotifyDuoProvider';

export async function runRegressionTests() {
  const emptyHistory = {success:true,scope:'lifetime',synced_at:new Date().toISOString(),accounts:[],summary:{account_1_streams:0,account_2_streams:0,combined_streams:0,first_played_at:null,last_played_at:null},total_records:0,records:[]};
  assert.doesNotThrow(() => validateLifetimeSnapshot(emptyHistory));
  assert.throws(() => validateLifetimeSnapshot({...emptyHistory,scope:'daily'}));
  assert.throws(() => validateLifetimeSnapshot({...emptyHistory,summary:{...emptyHistory.summary,combined_streams:1}}));
  assert.throws(() => validateLifetimeSnapshot({...emptyHistory,total_records:2}));
  const store = new LeagueStore();
  const ballot = structuredClone([...store.ballots.values()][0]);
  const oldBallot = store.getBallot(ballot.participantId, ballot.category, ballot.competitionDate);
  ballot.items[0].pointsAwarded = 99 as any;
  (store as any).persistence = {
    saveBallot: async () => { throw new Error('Database unavailable'); },
    saveListeningStats: async () => { throw new Error('Database unavailable'); },
  };
  await assert.rejects(store.saveBallot(ballot), /Database unavailable/);
  assert.deepEqual(store.getBallot(ballot.participantId, ballot.category, ballot.competitionDate), oldBallot);
  await assert.rejects(store.saveListeningRecordsPersisted('2026-10-18', []), /Database unavailable/);
  assert.equal(store.dailyListening.has('2026-10-18'), false);
  (store as any).persistence = null;
  await store.saveBallot(oldBallot!);
  assert.ok(store.dailyScores.get(ballot.competitionDate)?.size);
  const tomorrow = new Date(`${ballot.competitionDate}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const standings = store.computeCumulativeStandings(tomorrow.toISOString().slice(0, 10));
  assert.ok([...standings.maleStats, ...standings.femaleStats].every(s => s.todayPoints === 0));

  const originalFetch = globalThis.fetch;
  try {
    const provider = new SpotifyDuoChartsProvider('https://example.invalid', 'test');
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 200 });
    assert.equal((await provider.getDailyListeningStats('2026-10-18')).status, 'failed');
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, date: '2026-10-18', records: [] }), { status: 200 });
    assert.equal((await provider.getDailyListeningStats('2026-10-18')).status, 'success');
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, date: '2026-10-17', records: [] }), { status: 200 });
    assert.equal((await provider.getDailyListeningStats('2026-10-18')).status, 'failed');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('✅ Regression checks passed (database failures, score refresh, daily totals, provider validation).');
}
