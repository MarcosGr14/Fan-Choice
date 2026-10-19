import { runScoringEngineTests } from './scoringEngine.test';
import { runDomainServicesTests } from '../services/services.test';
import { runApiIntegrationTests } from '../server.test';

async function main() {
  console.log('--- 1. RUNNING SCORING ENGINE DETERMINISTIC TESTS ---');
  const engineResult = runScoringEngineTests();
  console.log(`Passed: ${engineResult.passed}, Failed: ${engineResult.failed}`);

  console.log('\n--- 2. RUNNING DOMAIN SERVICES TESTS (VOTING & SEASON) ---');
  const servicesResult = runDomainServicesTests();
  console.log(`Passed: ${servicesResult.passed}, Failed: ${servicesResult.failed}`);

  console.log('\n--- 3. RUNNING REST API V1 INTEGRATION TESTS ---');
  const apiResult = await runApiIntegrationTests();
  console.log(`Passed: ${apiResult.passed}, Failed: ${apiResult.failed}`);

  const totalPassed = engineResult.passed + servicesResult.passed + apiResult.passed;
  const totalFailed = engineResult.failed + servicesResult.failed + apiResult.failed;
  const allErrors = [...engineResult.errors, ...servicesResult.errors, ...apiResult.errors];

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${totalPassed}`);
  console.log(`TOTAL FAILED: ${totalFailed}`);
  console.log(`========================================`);

  if (allErrors.length > 0) {
    console.error('Errors:');
    allErrors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ ALL TESTS (PHASE 2 & PHASE 3) PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
