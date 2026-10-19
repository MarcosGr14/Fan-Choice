# PROJECT BLUEPRINT — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED MASTER SPECIFICATION  
> **Target Audience:** Software Architect, Full-Stack Engineers, UX/UI Designers, Database Administrators, QA, and Antigravity Execution Agent.  
> **Provisional Name:** K-pop / J-pop Rankings League (Configurable via environment variable `APP_DISPLAY_NAME`).

---

## 1. Executive Summary & Vision

The **K-pop / J-pop Rankings League** is a standalone, private, high-stakes musical competition platform for exactly **two authenticated participants**. 

It establishes two concurrent competitive ladders:
1. **Male Top 10** (Boy groups and male soloists in K-pop / J-pop)
2. **Female Top 10** (Girl groups and female soloists in K-pop / J-pop)
3. **Absolute League Champion** (The single artist with the highest combined points across both categories)

Points derive strictly from two verified sources:
- **Daily Participant Ballots:** Each of the two authorized participants selects their top 5 artists in each category (ranked 1st through 5th: 5, 4, 3, 2, 1 points). Maximum 10 vote points daily per artist.
- **Verified Listening Scrobble Bonus:** Aggregated daily streams across both participants' Spotify accounts, ingested strictly via read-only synchronization from *Spotify Duo Charts*, mapped via a tiered non-linear bonus curve (1 to 5 bonus points).

The platform tracks position movements ($\Delta$), day-over-day surges, podium rankings (Top 3), new debuts, historical head-to-head records, and seals each season with an immutable archival ledger.

---

## 2. Core Business Principles & Non-Negotiable Invariants

### 2.1. Manual Season Lifecycle (Strict Rule)
- **Zero Automatic Expirations:** Seasons **NEVER** close automatically at month-end, year-end, or after a fixed number of days.
- **Zero Automatic Resets:** Scores never zero out unless a new season is explicitly created.
- **Strict Single-Active Season Invariant:** At most **one** season can have status `'active'` at any given time. Database constraints (`EXCLUDE` or partial unique index) enforce this at the persistence layer.
- **Manual 2-Step Freeze Action:** An administrator must trigger season closure explicitly. Closing a season executes an atomic, transactional consolidation:
  1. Closes active daily voting.
  2. Freezes final standings for Male Top 10, Female Top 10, and Absolute Champion.
  3. Records audit metadata (`closed_at`, `closed_by_participant_id`, final snapshot hash).
  4. Changes status to `'archived'`.
  5. Renders the season 100% read-only forever.
- **Post-Closure Season Creation:** The administrator manually creates and names the subsequent season when ready.

### 2.2. Voting Day vs. Season Independence
- Seasons may last days, weeks, months, or quarters.
- Daily voting operates on a strict localized calendar day (default: `America/Panama`, configurable via `LEAGUE_TIMEZONE`).
- Participants can update and re-save their 5-slot ballot freely throughout the calendar day.
- At **23:59:59.999** in `LEAGUE_TIMEZONE`, the day's ballot locks permanently.
- Daily lockout does **NOT** alter the season state.

### 2.3. Absolute Project Independence
- This application is **100% autonomous**. It possesses its own repository, database schema, server process, authentication tokens, CI pipeline, and Railway deployment.
- *Spotify Duo Charts* is accessed exclusively as a read-only external data feed.
- Under **no circumstances** may this application write to, migrate, modify, or couple its schema with Spotify Duo Charts.
- Development proceeds via a clean `ListeningDataProvider` abstraction with a verified `MockListeningDataProvider` until the external audit is completed.

---

## 3. Participant Model

- **Cardinality:** Exactly 2 authorized competitors (e.g., Participant A and Participant B).
- **Public Registration:** Explicitly disabled. No signup page, open invitation links, or unauthenticated writes.
- **Role Hierarchy:**
  - `participant`: Can view league standings, history, and edit own daily ballots prior to daily cutoff.
  - `admin`: Super-set of participant permissions; can create/close seasons, manage artist catalog, trigger syncs, and adjust scoring parameters.
- **Display Identifiers:** Names, avatars, and slugs are dynamically sourced from the `participants` database table and configuration (e.g., `PARTICIPANT_1_NAME`, `PARTICIPANT_2_NAME`), never hardcoded in templates.

---

## 4. Curated Artist Catalog

No arbitrary Spotify artist can receive points or appear on ballots. Only expressly approved artists compete.

### Catalog Schema Requirements:
- `spotify_artist_id`: Canonical alphanumeric Spotify ID (unique, primary foreign key to listening data).
- `display_name`: Official public stage name.
- `search_normalized_name`: Lowercased, diacritic-stripped, alias-indexed for instant client-side lookup.
- `category`: `'male'` | `'female'` (strictly bifurcated competitive brackets).
- `artist_type`: `'soloist'` | `'group'`.
- `group_type`: `'boy_group'` | `'girl_group'` | `'mixed_group'` (mixed groups are quarantined from voting until an admin rule assigns competitive bracket).
- `music_scene`: `'kpop'` | `'jpop'` | `'both'`.
- `origin_country`: 2-letter ISO (e.g., `'KR'`, `'JP'`).
- `status`: `'approved'` | `'pending'` | `'deactivated'`.
- `eligibility_effective_date`: Date the artist entered active eligibility. Mid-season additions begin accruing points from that day forward without altering prior days' rankings.

---

## 5. Summary of System Interfaces

| Module | Primary Responsibility | Key Inputs / Outputs |
| :--- | :--- | :--- |
| **Scoring Engine** | Deterministic point calculation, tie-breaking, ladder sorting | Ballots + Scrobble Stats $\rightarrow$ Daily & Season Standings |
| **Voting Service** | Ballot drafting, validation (5 unique artists), daily lockouts | Participant inputs $\rightarrow$ Validated `daily_votes` |
| **Season Manager** | State transitions (`draft` $\rightarrow$ `active` $\rightarrow$ `archived`), freeze snapshots | Admin actions $\rightarrow$ Atomic consolidation |
| **Catalog Manager** | Artist curation, classification, Spotify ID verification | Admin inputs $\rightarrow$ `artists_catalog` |
| **Listening Ingestion** | Fetch scrobbles, calculate bonuses, maintain idempotency | Duo Charts API $\rightarrow$ `daily_listening_stats` |
| **League UI** | Presentation, podiums, visual cards, interactive ballot builder | REST API $\rightarrow$ Tailored DOM / React interface |
