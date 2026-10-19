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
