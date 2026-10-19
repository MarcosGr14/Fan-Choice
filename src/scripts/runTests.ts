// Set these before importing any module that reads configuration.
// Tests must never connect to Supabase or the real listening provider.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.USE_MOCK_LISTENING_DATA = 'true';
const { runRegressionTests } = await import('../services/regressions.test');
await runRegressionTests();
await import('../engine/runTests');
