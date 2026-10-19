# ANTIGRAVITY HANDOFF GUIDE — K-POP / J-POP RANKINGS LEAGUE

> **To:** Antigravity Coding Agent  
> **From:** Senior Software Engineering Team (Architect, Full-Stack, UI/UX, PostgreSQL, Integration, QA)  
> **Subject:** Operational Execution Plan for K-pop / J-pop Rankings League Implementation

Welcome, Antigravity. This repository contains the complete architectural blueprints, database DDL schemas, deterministic scoring specifications, and an interactive prototype for the **K-pop / J-pop Rankings League**.

Your mission is to take this foundation and execute the production build cleanly, safely, and without breaking existing systems.

---

## 1. Non-Negotiable Operational Rules

1. **Phase 0 Audit is Strictly Read-Only:**  
   You will be asked to audit the existing *Spotify Duo Charts* repository. Under **no circumstances** may you run migrations, execute `INSERT`/`UPDATE`/`DELETE` queries, push commits, or modify code in Spotify Duo Charts during this audit. If an endpoint is missing, document it and request authorization.
2. **Never Mix Projects:**  
   Do not import code, secrets, or configuration from *KPop Gala* or convert Spotify Duo Charts into this project's frontend. This application is 100% standalone.
3. **Seasons are 100% Manually Governed:**  
   Do **NOT** write any cron job or logic that closes a season at month-end. Seasons stay open until an admin explicitly calls the close action.
4. **Idempotency in Sync:**  
   Re-running a Spotify sync must replace the day's scrobbles and recalculate points—never increment or duplicate.
5. **No Hallucinated Credentials or Endpoints:**  
   Use `MockListeningDataProvider` until a verified contract is audited and approved.

---

## 2. Step-by-Step Antigravity Execution Checklist

### Step 1: Read All Master Blueprints
- [ ] Read `PROJECT_BLUEPRINT.md` (Product rules, participants, independence)
- [ ] Read `ARCHITECTURE.md` (Layered topology, provider abstraction)
- [ ] Read `DATA_MODEL.md` (PostgreSQL schemas, foreign keys, unique indices)
- [ ] Read `API_CONTRACT.md` (REST schema, payloads, status codes)
- [ ] Read `SCORING_RULES.md` (Math formulas, tie-breakers, bonus tiers)
- [ ] Read `DESIGN_SYSTEM.md` (Dark Obsidian theme, 60-30-10 palette, zero-pill)
- [ ] Read `SECURITY.md` (Threat model, RBAC, secret isolation)

### Step 2: Conduct Phase 0 Audit of Spotify Duo Charts
- [ ] Inspect the repository in read-only mode.
- [ ] Locate how scrobbles are recorded (table names, Spotify Artist ID vs Track ID).
- [ ] Check if daily aggregation by artist is directly queryable or requires an endpoint.
- [ ] Write `docs/AUDIT_REPORT_SPOTIFY_DUO_CHARTS.md` with file paths, functions, and recommendations.
- [ ] If an endpoint needs to be created in Duo Charts, draft the exact code in the audit report and wait for user confirmation.

### Step 3: Database & Migration Execution
- [ ] Provision PostgreSQL instance on Supabase or Railway.
- [ ] Run `db/migrations/001_initial_schema.sql`.
- [ ] Verify that `idx_single_active_season` prevents multiple active seasons.
- [ ] Seed initial participants and the curated catalog of artists.

### Step 4: Core Engine & Test Verification
- [ ] Verify `src/engine/scoringEngine.ts` against all edge cases.
- [ ] Run test suite `npm run test` and verify that tie-breakers and bonus thresholds pass with 100% determinism.

### Step 5: Backend REST API & Middleware
- [ ] Wire Express server with `src/routes/`.
- [ ] Implement JWT/cookie authentication with bcrypt password verification.
- [ ] Implement ballot saving with validation: exactly 5 unique artists, valid category, within active competition day.
- [ ] Implement season closure endpoint with atomic transaction.

### Step 6: Frontend Integration & Polish
- [ ] Connect the interactive React UI to the Express REST API.
- [ ] Ensure the Top 3 Podium layout, Male/Female ladders, and Absolute Champion highlight visually pop with the Obsidian Dark theme.
- [ ] Ensure daily ballot drag/reorder is smooth on mobile touchscreens and desktop keyboards.
- [ ] Verify resilient image fallbacks across all artist cards.

### Step 7: Deployment to Railway & CI Configuration
- [ ] Configure GitHub Actions workflow (`.github/workflows/ci.yml`).
- [ ] Link independent repository to Railway.
- [ ] Populate environment variables based on `.env.example`.
- [ ] Run health check on `/api/v1/health` and verify production deployment.

---

## 3. Discrepancy Resolution Protocol

If you discover any conflict between the existing code and these blueprints:
1. Document the exact conflict with file path and line numbers.
2. Prioritize verifiable real-world evidence from the audit.
3. Do not blindly force changes that destroy data or violate manual season governance.
4. Report the finding clearly to the user.
