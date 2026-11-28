// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: REST API INTEGRATION TEST SUITE
// ==============================================================================

import { app } from './server';
import http from 'http';

export async function runApiIntegrationTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`Assertion failed: ${testName}`);
    }
  }

  // Spin up an ephemeral HTTP server on random available port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const rootRes = await fetch(`${baseUrl}/`);
    assert(rootRes.status === 200, 'GET / must show API entry page');
    assert(rootRes.headers.get('content-type')?.includes('text/html') === true, 'Root must return HTML');
    const missingRes = await fetch(`${baseUrl}/api/v1/not-found`);
    assert(missingRes.status === 404, 'Unknown API endpoint must still return 404');

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    assert(healthRes.status === 200, 'GET /api/v1/health must return 200');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'Health status must be ok');

    // 2. Auth Login - Valid Admin (Alex)
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alex', password: 'LeaguePass2026!' }),
    });
    assert(loginRes.status === 200, 'POST /api/v1/auth/login with valid credentials must return 200');
    const loginData = await loginRes.json();
    assert(loginData.success === true, 'Login response success must be true');
    assert(typeof loginData.token === 'string' && loginData.token.length > 20, 'Login must issue JWT token');
    const adminToken = loginData.token;

    // 3. Auth Login - Valid Participant (Sam)
    const samLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sam', password: 'LeaguePass2026!' }),
    });
    const samToken = (await samLoginRes.json()).token;

    // 4. Auth Login - Invalid Credentials
    const badLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alex', password: 'WrongPassword' }),
    });
    assert(badLoginRes.status === 401, 'POST /api/v1/auth/login with invalid password must return 401');

    // 5. Auth Me - With and without token
    const unauthMeRes = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert(unauthMeRes.status === 401, 'GET /api/v1/auth/me without token must return 401');

    const authMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(authMeRes.status === 200, 'GET /api/v1/auth/me with Bearer token must return 200');
    const meData = await authMeRes.json();
    assert(meData.user.username === 'alex', 'Profile must match authenticated user');

    // 6. League Overview
    const overviewRes = await fetch(`${baseUrl}/api/v1/league/overview`);
    assert(overviewRes.status === 200, 'GET /api/v1/league/overview must return 200');
    const overview = await overviewRes.json();
    assert(overview.season !== null, 'Season overview must be present');
    assert(Array.isArray(overview.maleTop10), 'Male Top 10 must be an array');
    assert(Array.isArray(overview.femaleTop10), 'Female Top 10 must be an array');
    assert(overview.absoluteChampion !== null, 'Absolute Champion must be present');

    // 7. League Artists Catalog
    const catalogRes = await fetch(`${baseUrl}/api/v1/league/artists`);
    assert(catalogRes.status === 200, 'GET /api/v1/league/artists must return 200');
    const catalog = await catalogRes.json();
    assert(catalog.total >= 24, 'Artists catalog must contain at least 24 artists');

    // Periodic vote API: authentication, catalog, validation, persistence and one-vote rule.
    const periodicPublicRes=await fetch(`${baseUrl}/api/v1/periodic`);
    assert(periodicPublicRes.status===200,'Periodic catalog is public');
    const periodicCatalog=await periodicPublicRes.json();
    assert(periodicCatalog.periods.weekly_artists===periodicCatalog.periods.weekly_idols,'Weekly categories share one Monday period');
    const periodicNoAuth=await fetch(`${baseUrl}/api/v1/periodic/me`);
    assert(periodicNoAuth.status===401,'Periodic personal status requires authentication');
    const maleArtists=periodicCatalog.artists.filter((a:any)=>a.category==='male'&&a.artistType==='group').slice(0,10).map((a:any)=>a.id);
    const femaleArtists=periodicCatalog.artists.filter((a:any)=>a.category==='female'&&a.artistType==='group').slice(0,10).map((a:any)=>a.id);
    const maleIdols=periodicCatalog.idols.filter((a:any)=>a.category==='male').slice(0,25).map((a:any)=>a.id);
    const femaleIdols=periodicCatalog.idols.filter((a:any)=>a.category==='female').slice(0,25).map((a:any)=>a.id);
    const weeklyArtistBody={kind:'weekly_artists',seasonId:periodicCatalog.season.id,periodKey:periodicCatalog.periods.weekly_artists,selections:{male:maleArtists,female:femaleArtists}};
    const invalidPeriodic=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken}`},body:JSON.stringify({...weeklyArtistBody,selections:{male:maleArtists.slice(0,9),female:femaleArtists}})});
    assert(invalidPeriodic.status===400,'Periodic API rejects incomplete Top 10');
    const validPeriodic=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken}`},body:JSON.stringify(weeklyArtistBody)});
    assert(validPeriodic.status===201,'Periodic API records a valid weekly artist ballot');
    const refreshedStandings=await (await fetch(`${baseUrl}/api/v1/league/overview`)).json();
    const newlyScored=refreshedStandings.standings.maleStats.find((row:any)=>row.artist.id===maleArtists[0]);
    const baselineArtist=overview.standings.maleStats.find((row:any)=>row.artist.id===maleArtists[0]);
    assert(newlyScored.cumulativePoints===baselineArtist.cumulativePoints+25,'Weekly artist first-place points enter the season standings');
    const duplicatePeriodic=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken}`},body:JSON.stringify(weeklyArtistBody)});
    assert(duplicatePeriodic.status===409,'Periodic API prevents a second vote in the same period');
    const myPeriodic=await fetch(`${baseUrl}/api/v1/periodic/me`,{headers:{Authorization:`Bearer ${adminToken}`}});
    assert((await myPeriodic.json()).periods.weekly_artists.submission!==null,'Personal periodic status returns saved selections');
    const weeklyIdolBody={kind:'weekly_idols',seasonId:periodicCatalog.season.id,periodKey:periodicCatalog.periods.weekly_idols,selections:{male:maleIdols,female:femaleIdols}};
    const validWeeklyIdols=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${samToken}`},body:JSON.stringify(weeklyIdolBody)});
    assert(validWeeklyIdols.status===201,'Periodic API records a valid weekly idol ballot');
    const monthlyIdolBody={kind:'monthly_idols',seasonId:periodicCatalog.season.id,periodKey:periodicCatalog.periods.monthly_idols,selections:{male:maleIdols.slice(0,2),female:femaleIdols.slice(0,2)}};
    const validMonthlyIdols=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${samToken}`},body:JSON.stringify(monthlyIdolBody)});
    assert(validMonthlyIdols.status===201,'Periodic API records bias and bias-wrecker selections');
    const monthlyArtistBody={kind:'monthly_artists',seasonId:periodicCatalog.season.id,periodKey:periodicCatalog.periods.monthly_artists,selections:{male:maleArtists.slice(0,1),female:femaleArtists.slice(0,1)}};
    const validMonthlyArtists=await fetch(`${baseUrl}/api/v1/periodic/votes`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${adminToken}`},body:JSON.stringify(monthlyArtistBody)});
    assert(validMonthlyArtists.status===201,'Periodic API records monthly artist favorites');
    const afterMonthlyStandings=await (await fetch(`${baseUrl}/api/v1/league/overview`)).json();
    const totalSpecial=afterMonthlyStandings.standings.maleStats.find((row:any)=>row.artist.id===maleArtists[0]).cumulativePoints-baselineArtist.cumulativePoints;
    assert(totalSpecial===75,'Weekly and monthly artist points add to season totals');
    const leaderboard=await (await fetch(`${baseUrl}/api/v1/periodic`)).json();
    assert(leaderboard.results.weekly_artists.male.length>0,'Periodic results show the current vote leaderboard');
    assert(leaderboard.results.weekly_idols.male[0].points===50,'Weekly idol winner receives 50 points');
    const idolRankings=await (await fetch(`${baseUrl}/api/v1/idols`)).json();
    assert(idolRankings.rankings.female.some((row:any)=>row.periodicPoints===125),'Monthly bias combines 75 monthly points with the 50-point weekly idol win');

    assert(idolRankings.rankings.female.find((row:any)=>row.id===femaleIdols[24])?.periodicPoints===8,
      'The 25th weekly idol scores 8 season points');
    const idolHeaders = {'Content-Type':'application/json',Authorization:`Bearer ${samToken}`};
    const dailyIdolBody = {seasonId:periodicCatalog.season.id,competitionDate:idolRankings.competitionDate};
    const postIdols = (body: object) => fetch(`${baseUrl}/api/v1/idols/votes`, {
      method:'POST', headers:idolHeaders, body:JSON.stringify({...dailyIdolBody,...body}),
    });
    assert((await postIdols({kind:'favorites',category:'all',idolIds:[femaleIdols[0]]})).status===201,
      'Season favorites remain available');
    assert((await postIdols({kind:'daily',category:'female',idolIds:femaleIdols})).status===201,
      'Daily idol API accepts 25 selections');
    const dailyRanks = await (await fetch(`${baseUrl}/api/v1/idols`)).json();
    const dailyIdolPoints = [30,25,25,25,25,20,20,20,20,20,15,15,15,15,15,14,13,12,11,10,9,8,7,6,5];
    assert(femaleIdols.every((id:string,index:number)=>dailyRanks.rankings.female.find((row:any)=>row.id===id)?.votePoints===dailyIdolPoints[index]),
      'All 25 daily idol positions match the new points');
    const savedIdols = await (await fetch(`${baseUrl}/api/v1/idols/me`,{headers:idolHeaders})).json();
    assert(savedIdols.dailyScoringVersions.female===2,'The saved idol ballot reports its scoring version');

    // 8. Votes Today Status
    const votesRes = await fetch(`${baseUrl}/api/v1/votes/today`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(votesRes.status === 200, 'GET /api/v1/votes/today must return 200');
    const votesData = await votesRes.json();
    assert(votesData.timezone === 'America/Panama', 'Votes today must reflect America/Panama timezone');

    // 9. Submit Valid Ballot
    const submitRes = await fetch(`${baseUrl}/api/v1/votes/ballot`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: 'female',
        items: [
          { rankPosition: 1, artistId: 'art-newjeans' },
          { rankPosition: 2, artistId: 'art-aespa' },
          { rankPosition: 3, artistId: 'art-twice' },
          { rankPosition: 4, artistId: 'art-ive' },
          { rankPosition: 5, artistId: 'art-yoasobi' },
        ],
      }),
    });
    assert(submitRes.status === 200, 'PUT /api/v1/votes/ballot with valid 5 items must return 200');
    const savedArtists = await submitRes.json();
    assert(savedArtists.ballot.items.map((item:any)=>item.pointsAwarded).join(',')==='50,45,40,35,30',
      'New artist ballots save the increased points');

    // 10. Submit Invalid Ballot (Duplicate Artist)
    const dupSubmitRes = await fetch(`${baseUrl}/api/v1/votes/ballot`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        category: 'female',
        items: [
          { rankPosition: 1, artistId: 'art-nj' },
          { rankPosition: 2, artistId: 'art-nj' }, // duplicate
          { rankPosition: 3, artistId: 'art-twice' },
          { rankPosition: 4, artistId: 'art-ive' },
          { rankPosition: 5, artistId: 'art-lsf' },
        ],
      }),
    });
    assert(dupSubmitRes.status === 400, 'PUT /api/v1/votes/ballot with duplicate artist must return 400');

    // 11. Archive List
    const archiveRes = await fetch(`${baseUrl}/api/v1/archive/seasons`);
    assert(archiveRes.status === 200, 'GET /api/v1/archive/seasons must return 200');
    const archiveData = await archiveRes.json();
    assert(archiveData.total >= 1, 'Archive list must contain sample historical season');

    // 12. Admin RBAC Guard: Sam (participant role) cannot trigger admin sync
    const samSyncRes = await fetch(`${baseUrl}/api/v1/admin/sync/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${samToken}`,
      },
      body: JSON.stringify({ date: '2026-10-18' }),
    });
    assert(samSyncRes.status === 403, 'Participant role must receive 403 on admin endpoints');

    // 13. Admin Trigger Sync: Alex (admin role) can trigger sync
    const adminSyncRes = await fetch(`${baseUrl}/api/v1/admin/sync/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ date: '2026-10-18' }),
    });
    assert(adminSyncRes.status === 200, 'Admin role can trigger listening data sync');
    const syncData = await adminSyncRes.json();
    assert(syncData.success === true, 'Sync result success must be true');
    assert(syncData.syncResult.recordsProcessed >= 20, 'Sync should process sample records');

  } catch (err: any) {
    errors.push(`Network or unhandled error: ${err.message}`);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return { passed, failed, errors };
}
