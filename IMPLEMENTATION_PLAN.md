# IMPLEMENTATION PLAN — K-POP / J-POP RANKINGS LEAGUE

> **Status:** MASTER ROADMAP & ANTIGRAVITY EXECUTION PHASES  
> **Target Platform:** Node.js, Express, PostgreSQL / Supabase, Railway Deployment.

---

## Phase 0: Read-Only Audit of Spotify Duo Charts (MANDATORY GATEWAY)

> **Antigravity Rule:** You must NEVER write to or migrate Spotify Duo Charts. Perform a purely read-only inspection of its codebase first.

- [ ] **0.1. Repository Inspection:** Check package dependencies, database client (`pg`, `prisma`, `supabase-js`, or `drizzle`), and existing endpoints.
- [ ] **0.2. Data Model Verification:**
  - Verify if tracks are mapped to artists with canonical Spotify Artist IDs.
  - Check timestamps: are they UTC `TIMESTAMPTZ`? What is the user identifier format?
  - Verify scrobble aggregation granularity: are streams aggregated daily or raw play events?
- [ ] **0.3. Integration Contract Proposal:**
  - If a read-only endpoint already provides daily streams per artist, document its request/response shape.
  - If missing, draft the minimal RFC proposing an endpoint like `GET /api/v1/export/daily-artist-scrobbles?date=YYYY-MM-DD` secured by a shared `X-INTEGRATION-SECRET`.
  - Obtain user approval prior to touching Duo Charts.
- [ ] **0.4. Milestone Delivery:** Produce `AUDIT_REPORT_SPOTIFY_DUO_CHARTS.md`.

---

## Phase 1: Standalone Database & Migration Pipeline

- [ ] **1.1. Supabase / PostgreSQL Provisioning:** Setup independent database project.
- [ ] **1.2. Execute Migration:** Apply `db/migrations/001_initial_schema.sql`.
- [ ] **1.3. Verification of Constraints:**
  - Confirm partial unique index `idx_single_active_season` prevents two active seasons.
  - Confirm `daily_vote_items` checks prevent duplicated artists and invalid points mapping.
- [ ] **1.4. Seed Initial Data:**
  - Insert initial two participants (`alex`, `sam`) with bcrypt hashes.
  - Insert curated seed catalog of 24 top K-pop/J-pop artists across Male and Female categories.
  - Insert Inaugural Season (`Season 1`).

---

## Phase 2: Core Domain Services & Scoring Engine

- [ ] **2.1. Pure Scoring Engine (`src/engine/scoringEngine.ts`):**
  - Implement deterministic sorting with the 5-step tie-breaker cascade.
  - Implement bonus tier mapper for Spotify streams.
  - Write complete unit test suite (`scoringEngine.test.ts`).
- [ ] **2.2. Listening Data Provider (`src/integrations/`):**
  - Implement `MockListeningDataProvider` with realistic deterministic streams.
  - Implement `SpotifyDuoChartsClient` adapter matching the audited contract.
- [ ] **2.3. Voting Service (`src/services/votingService.ts`):**
  - Enforce 5 unique artists per category ballot.
  - Enforce `LEAGUE_TIMEZONE` daily cutoff.
  - Handle atomic update of ballots.
- [ ] **2.4. Season Service (`src/services/seasonService.ts`):**
  - Enforce manual season lifecycle.
  - Implement transactional `closeSeason` with immutable snapshot in `season_results`.

---

## Phase 3: REST API Layer & Security Hardening

- [ ] **3.1. Express Server Setup:** Mount routes, body parsers, CORS whitelist, helmet security headers.
- [ ] **3.2. Authentication Middleware:** Verify JWT / secure session cookie; attach participant profile.
- [ ] **3.3. Admin Authorization Guard:** Restrict season creation/closure and catalog mutation to role `'admin'`.
- [ ] **3.4. Idempotent Sync Job (`src/jobs/syncJob.ts`):** Scheduled or triggered daily listening sync with atomic upserts into `daily_listening_stats` and `daily_scores`.

---

## Phase 4: Frontend Application & Realtime Polish

- [ ] **4.1. Visual Layout:** Implement Obsidian Dark aesthetic with Plus Jakarta Sans and JetBrains Mono.
- [ ] **4.2. Top 3 Podium Cards:** High-prominence display for Top 3 in Male and Female ladders.
- [ ] **4.3. Interactive Ballot Builder:** Drag/button reorder for 5 ranked slots with points preview and catalog search.
- [ ] **4.4. Historical Archive Inspector:** Read-only browsable archive of closed seasons.
- [ ] **4.5. Admin Console:** Season management (with freeze preview modal), catalog editor, and sync trigger.

---

## Phase 5: CI/CD Pipeline & Railway Deployment

- [ ] **5.1. GitHub Actions CI:** Workflow running `npm run lint`, `npm run test`, and `npm run build`.
- [ ] **5.2. Railway Deployment:**
  - Standalone service linked to the independent repository.
  - Environment variables configured via Railway dashboard.
  - Zero-downtime health check on `/api/v1/health`.
- [ ] **5.3. Antigravity Verification:** Run end-to-end user acceptance tests.
