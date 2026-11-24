// Set these before importing any module that reads configuration.
// Tests must never connect to Supabase or the real listening provider.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.USE_MOCK_LISTENING_DATA = 'true';
const { runRegressionTests } = await import('../services/regressions.test');
const { runPeriodicVotingTests } = await import('../services/periodicVoting.test');
await runRegressionTests();
const { runScoringEngineTests } = await import('../engine/scoringEngine.test');
const { runDomainServicesTests } = await import('../services/services.test');
const { runApiIntegrationTests } = await import('../server.test');

async function main() {
  console.log('--- 1. RUNNING SCORING ENGINE DETERMINISTIC TESTS ---');
  const engineResult = runScoringEngineTests();
  console.log(`Passed: ${engineResult.passed}, Failed: ${engineResult.failed}`);

  console.log('\n--- 2. RUNNING DOMAIN SERVICES TESTS (VOTING & SEASON) ---');
  const servicesResult = runDomainServicesTests();
  console.log(`Passed: ${servicesResult.passed}, Failed: ${servicesResult.failed}`);

  console.log('\n--- 3. RUNNING PERIODIC VOTING TESTS ---');
  let periodicPassed = 0;
  let periodicFailed = 0;
  const periodicErrors: string[] = [];
  try { periodicPassed = runPeriodicVotingTests(); }
  catch (error) { periodicFailed = 1; periodicErrors.push(error instanceof Error ? error.message : String(error)); }
  console.log(`Passed: ${periodicPassed}, Failed: ${periodicFailed}`);

  console.log('\n--- 4. RUNNING REST API V1 INTEGRATION TESTS ---');
  const apiResult = await runApiIntegrationTests();
  console.log(`Passed: ${apiResult.passed}, Failed: ${apiResult.failed}`);

  const totalPassed = engineResult.passed + servicesResult.passed + periodicPassed + apiResult.passed;
  const totalFailed = engineResult.failed + servicesResult.failed + periodicFailed + apiResult.failed;
  const allErrors = [...engineResult.errors, ...servicesResult.errors, ...periodicErrors, ...apiResult.errors];

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${totalPassed}`);
  console.log(`TOTAL FAILED: ${totalFailed}`);
  console.log(`========================================`);

  if (allErrors.length > 0) {
    console.error('Errors:');
    allErrors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS PASSED!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
