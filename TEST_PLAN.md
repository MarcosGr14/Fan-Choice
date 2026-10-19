# TEST PLAN & QA SPECIFICATION — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED QA & VERIFICATION MATRIX  
> **Testing Framework:** Jest / Vitest + Supertest

---

## 1. Test Suite Architecture

```
tests/
├── unit/
│   ├── scoringEngine.test.ts          # 100% pure function math & tie-breakers
│   ├── bonusCurve.test.ts             # Spotify stream threshold mapping
│   └── timezoneHelper.test.ts         # Panama timezone date boundary checks
├── integration/
│   ├── ballotSubmission.test.ts       # 5 unique artist validation & lockouts
│   ├── seasonLifecycle.test.ts        # Manual closure & freeze transaction
│   ├── syncIdempotency.test.ts        # Re-running sync without point inflation
│   └── adminGuards.test.ts            # RBAC and unauthorized protection
└── e2e/
    └── fullSeasonFlow.test.ts         # Start season -> votes -> sync -> close
```

---

## 2. Mandatory Boundary & Edge Cases

### Case 1: Invariant Single Active Season
- **Pre-condition:** Season A is currently `status = 'active'`.
- **Action:** Attempt to call `POST /api/v1/admin/seasons` or insert season with `status = 'active'`.
- **Expected Result:** Database constraint violation or service error `409 Conflict`. Active season count remains strictly 1.

### Case 2: Ballot Validation - Duplicate Artist
- **Action:** Participant submits ballot with items: `[{pos: 1, artistId: 'bts'}, {pos: 2, artistId: 'bts'}, ...]`.
- **Expected Result:** `400 Bad Request` with message `"Ballot cannot contain duplicate artists"`. No database write occurs.

### Case 3: Ballot Validation - Incomplete Ballot
- **Action:** Participant submits only 4 items instead of 5.
- **Expected Result:** `400 Bad Request` with message `"Ballot must contain exactly 5 ranked artists"`.

### Case 4: Daily Lockout Enforcement
- **Action:** Participant attempts to update ballot after 23:59:59 Panama local time.
- **Expected Result:** `403 Forbidden` with message `"Voting for this competition date is closed"`.

### Case 5: Delayed Spotify Sync Idempotency
- **Action:** Ingest 12 streams for Artist X on Date D $\rightarrow$ awards 4 bonus points. Subsequently ingest updated log of 18 streams for Artist X on same Date D.
- **Expected Result:** Bonus points update to 5 (not $4 + 5 = 9$). Season cumulative points increase by exactly $+1$, not $+5$.

### Case 6: Deterministic Tie Resolution
- **Setup:** Artist A and Artist B both have 150 total season points.
  - Artist A has 90 vote points, 60 bonus points.
  - Artist B has 80 vote points, 70 bonus points.
- **Expected Result:** Artist A is ranked above Artist B due to Tie-Breaker 1 (Vote Dominance).
- **Secondary Tie Setup:** Both have 150 points, both have 90 vote points. Artist A has 450 total streams; Artist B has 380 total streams.
- **Expected Result:** Artist A is ranked above Artist B due to Tie-Breaker 2 (Stream Volume).

### Case 7: Transactional Season Closure
- **Action:** Trigger season closure with a simulated failure during final snapshot insertion.
- **Expected Result:** Full rollback (`ROLLBACK`). Season remains `active`, no partial `season_results` rows are committed.

### Case 8: Mid-Season Artist Addition
- **Action:** An artist is added to catalog on Day 15 of a 30-day season.
- **Expected Result:** Days 1 through 14 rankings remain unaltered. Artist begins at 0 points and can be voted for from Day 15 onward.

---

## 3. Test Runner Execution Commands

```bash
# Run pure unit tests
npm run test:unit

# Run full integration suite against test PostgreSQL container
npm run test:integration

# Run coverage audit (must maintain > 90% on scoringEngine.ts)
npm run test:coverage
```
