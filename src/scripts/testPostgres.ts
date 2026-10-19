// Destructive setup is restricted to a disposable loopback test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/league_test';
process.env.JWT_SECRET = 'local-integration-tests-only-secret';
process.env.USE_MOCK_LISTENING_DATA = 'false';
process.env.SPOTIFY_DUO_CHARTS_API_URL = 'https://provider.invalid';
const { default: pg } = await import('pg');
const { readFile } = await import('node:fs/promises');
const { hashPassword } = await import('../services/passwordHash');
const { today } = await import('../services/dates');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await pool.query(await readFile('db/migrations/001_initial_schema.sql','utf8'));
await pool.query(await readFile('db/migrations/002_lifetime_listening.sql','utf8'));
await pool.query(await readFile('db/seeds/001_seed_initial_data.sql','utf8'));
await pool.query('UPDATE participants SET password_hash=$1', [hashPassword('TestPassword2026!')]);
const { app } = await import('../server');
const { leagueStore, LeagueStore } = await import('../repositories/leagueStore');
await leagueStore.initFromDatabase();
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening',resolve));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/v1`;
let checks = 0;
function check(value: unknown, message: string) { if (!value) throw new Error(message); checks++; }
async function request(path: string, method='GET', body?: unknown, token?: string) {
  const response = await fetch(base+path,{method, headers:{'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{})}, ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
const realFetch = globalThis.fetch;
try {
  const admin = await request('/auth/login','POST',{username:'marcos',password:'TestPassword2026!'});
  check(admin.status===200,'Admin login');
  const member = await request('/auth/login','POST',{username:'jackie',password:'TestPassword2026!'});
  check(member.status===200,'Participant login');
  const token=admin.data.token;
  const beforeHistory=(await request('/league/overview')).data.standings;
  const snapshot={success:true,scope:'lifetime',summary:{combined_streams:123456},records:[]};
  await leagueStore.saveLifetime(snapshot);
  check((await request('/league/listening-history')).data.snapshot.summary.combined_streams===123456,'Lifetime snapshot API reads persisted data');
  const historyReader=new LeagueStore();await historyReader.initFromDatabase();
  check((await historyReader.loadLifetime())?.snapshot.summary.combined_streams===123456,'Lifetime survives restart');await historyReader.close();
  check(JSON.stringify((await request('/league/overview')).data.standings)===JSON.stringify(beforeHistory),'Lifetime import does not change season points');
  check((await request('/admin/sync/history','POST',{},member.data.token)).status===403,'Lifetime sync requires admin');
  check((await request('/auth/login','POST',{username:'jackie',password:'incorrect'})).status===401,'Reject wrong password');
  check((await request('/admin/artists','POST',{},member.data.token)).status===403,'Participant cannot manage artists');
  const catalog=(await request('/league/artists')).data.artists;
  const selected=catalog.filter((a:any)=>a.category==='male').slice(0,5);
  const ballot={category:'male',items:selected.map((a:any,i:number)=>({artistId:a.id,rankPosition:i+1}))};
  check((await request('/votes/ballot','PUT',ballot,token)).status===200,'Save real PostgreSQL ballot');
  check((await request('/votes/today','GET',undefined,token)).data.maleBallot.items.length===5,'Reload saved ballot');
  check((await request('/votes/ballot','PUT',{category:'male',items:[null,null,null,null,null]},token)).status===400,'Malformed ballot rejected');
  const second = new LeagueStore();await second.initFromDatabase();
  check(second.getBallot(admin.data.user.id,'male',today())?.items.length===5,'Ballot survives separate store initialization');
  const leader=second.computeCumulativeStandings().maleStats.find(s=>s.artist.id===selected[0].id);
  check(leader?.cumulativeVotePoints===5,'Vote points survive restart without streams');await second.close();
  globalThis.fetch = async (input:any,init?:any) => {
    if(String(input).startsWith('https://provider.invalid')) return new Response(JSON.stringify({success:true,date:today(),records:[{spotify_artist_id:selected[0].spotifyArtistId,artist_name:selected[0].displayName,competition_date:today(),account_1_streams:3,account_2_streams:1,combined_streams:4,image_url:'https://example.com/artist.jpg'}]}),{status:200});
    return realFetch(input,init);
  };
  check((await request('/admin/sync/trigger','POST',{date:today()},token)).status===200,'Sync commits streams');
  check((await request('/admin/sync/trigger','POST',{date:today()},token)).status===200,'Repeated sync succeeds');
  check(Number((await pool.query('SELECT sum(combined_streams) n FROM daily_listening_stats')).rows[0].n)===4,'Sync does not duplicate streams');
  check((await pool.query('SELECT image_url FROM artists_catalog WHERE id=$1',[selected[0].id])).rows[0].image_url==='https://example.com/artist.jpg','Image persisted');
  const previousDay=new Date(`${today()}T12:00:00Z`);previousDay.setUTCDate(previousDay.getUTCDate()-1);
  const priorDate=previousDay.toISOString().slice(0,10);
  const makeRecord=(date:string,streams:number)=>({spotifyArtistId:selected[0].spotifyArtistId,artistName:selected[0].displayName,competitionDate:date,account1Streams:streams,account2Streams:0,combinedStreams:streams,dataStatus:'available' as const});
  const imported=new Map([[priorDate,[makeRecord(priorDate,6)]],[today(),[makeRecord(today(),4)]]]);
  await leagueStore.saveListeningRange(priorDate,today(),imported);
  await leagueStore.saveListeningRange(priorDate,today(),imported);
  const importedStandings=(await request('/league/overview')).data.standings.maleStats.find((s:any)=>s.artist.id===selected[0].id);
  check(importedStandings.cumulativeStreams===10,'Year backfill is idempotent');
  check(importedStandings.cumulativeBonusPoints===5,'Historical bonus uses daily tiers (6 streams=3, 4 streams=2)');
  check(importedStandings.cumulativePoints===10,'Historical daily bonuses combine with votes');
  const newArtist={displayName:'Test Artist',spotifyArtistId:'1234567890123456789012',category:'female',artistType:'soloist',musicScene:'jpop',originCountry:'JP'};
  check((await request('/admin/artists','POST',newArtist,token)).status===201,'Create artist with UUID');
  check((await request('/admin/artists','POST',newArtist,token)).status===409,'Duplicate artist rejected');
  check((await pool.query('SELECT count(*) n FROM artists_catalog WHERE spotify_artist_id=$1',[newArtist.spotifyArtistId])).rows[0].n==='1','Artist persisted');
  const season=(await request('/league/overview')).data.season;
  check((await request('/admin/seasons','POST',{name:'Duplicate'},token)).status===409,'Only one active season');
  check((await request(`/admin/seasons/${season.id}/close`,'POST',{confirmCode:'wrong'},token)).status===400,'Closure needs explicit code');
  const { SeasonService } = await import('../services/seasonService');
  const { PostgresPersistence } = await import('../repositories/postgresPersistence');
  const stats=leagueStore.computeCumulativeStandings();
  const proposed=new SeasonService().closeSeason(leagueStore.getActiveSeason()!, {seasonId:season.id,adminParticipantId:admin.data.user.id,adminDisplayName:'Marcos',maleStats:stats.maleStats,femaleStats:stats.femaleStats});
  const persistence=new PostgresPersistence(process.env.DATABASE_URL!);
  let rolledBack=false;
  try { await persistence.archiveSeason(proposed.archivedRecord,[...proposed.frozenResults,proposed.frozenResults[0]]); }
  catch { rolledBack=true; }
  finally { await persistence.close(); }
  check(rolledBack,'Invalid archive fails');
  check((await pool.query('SELECT status FROM seasons WHERE id=$1',[season.id])).rows[0].status==='active','Failed closure rolls back season status');
  check((await pool.query('SELECT count(*) n FROM season_results WHERE season_id=$1',[season.id])).rows[0].n==='0','Failed closure leaves no partial archive');
  const closed=await request(`/admin/seasons/${season.id}/close`,'POST',{confirmCode:'FREEZE_SEASON'},token);
  check(closed.status===200,'Close season transaction');
  check(closed.data.archivedRecord.totalVotesCast===5,'Archive vote count');
  check(closed.data.archivedRecord.totalStreamsLogged===10,'Archive stream count');
  const third = new LeagueStore();await third.initFromDatabase();
  check(third.archivedSeasons.get(season.id)?.totalStreamsLogged===10,'Archive survives restart');
  check(!third.getActiveSeason(),'Closed season remains closed');await third.close();
  check((await request(`/archive/seasons/${season.id}`)).data.archive.totalVotesCast===5,'Archive API restores snapshot');
  check((await request('/votes/ballot','PUT',ballot,token)).status===403,'Cannot vote without active season');
  const nextDate=new Date(`${today()}T12:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate()+1);
  const created=await request('/admin/seasons','POST',{name:'Season 2',startDate:nextDate.toISOString().slice(0,10)},token);
  check(created.status===201,'Create next season');
  check((await request('/votes/ballot','PUT',ballot,token)).status===403,'Cannot vote before future season starts');
  check((await request('/league/overview')).data.standings.maleStats.every((s:any)=>s.cumulativePoints===0),'New season starts with zero points');
  check((await pool.query('SELECT count(*) n FROM season_results WHERE season_id=$1',[season.id])).rows[0].n==='30','Frozen results include all artists');
  console.log(`PostgreSQL lifecycle: ${checks} checks passed.`);
} finally {
  globalThis.fetch=realFetch;
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await leagueStore.close();await pool.end();
}
