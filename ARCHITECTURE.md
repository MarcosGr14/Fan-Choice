# ARCHITECTURE SPECIFICATION — K-POP / J-POP RANKINGS LEAGUE

> **Status:** APPROVED SYSTEM ARCHITECTURE  
> **Audience:** System Architects, Backend Engineers, DevOps, Antigravity Agent.

---

## 1. Architectural Philosophy & Layered Topology

The application is structured according to **Clean Architecture / Hexagonal Architecture** principles, enforcing a strict unidirectional dependency graph:

```
[ Frontend Client (Vite / React / Tailwind) ]
                     │  (HTTP / JSON REST)
                     ▼
[ Presentation Layer: Express Routes & Controllers ]
                     │
                     ▼
[ Business Domain: Services & Scoring Engine ]  ◄── [ ListeningDataProvider Interface ]
                     │                                            │
                     ▼                                            ▼
[ Persistence Layer: Repositories & SQL ]            [ Mock or Spotify Duo Adapter ]
                     │
                     ▼
[ Database: PostgreSQL (Supabase / Railway) ]
```

### Key Architectural Boundaries:
1. **The Scoring Engine is Pure & Isolated:** Zero network calls, zero ORM/database queries, zero filesystem dependencies inside the calculation function. It receives pure data structs and returns deterministic results.
2. **Provider Abstraction for External Listening Data:** The domain interacts with listening data exclusively through the `ListeningDataProvider` contract. Whether data comes from `MockListeningDataProvider` (in development/testing) or `SpotifyDuoChartsClient` (in production), the scoring engine does not know or care.
3. **Transactional Isolation for Season Closure:** All mutations involved in closing a season execute inside an atomic PostgreSQL transaction with serializable or read-committed isolation to ensure no partial state is persisted.

---

## 2. Directory Structure

```
├── .env.example                     # Environment template with full variable catalog
├── README.md                        # Project overview and quickstart
├── PROJECT_BLUEPRINT.md             # Core product rules and requirements
├── ARCHITECTURE.md                  # This file
├── DATA_MODEL.md                    # Database tables, keys, constraints
├── API_CONTRACT.md                  # REST endpoints specification
├── SCORING_RULES.md                 # Scoring algorithms, tie-breakers, formulas
├── DESIGN_SYSTEM.md                 # UI design language, tokens, podium specs
├── IMPLEMENTATION_PLAN.md           # Antigravity execution phases & checklist
├── TEST_PLAN.md                     # Test vectors and verification matrices
├── SECURITY.md                      # Threat model and security policies
├── ANTIGRAVITY_HANDOFF.md           # Operational step-by-step handoff
├── db/
│   └── migrations/
│       └── 001_initial_schema.sql   # Consolidated PostgreSQL migration script
├── src/
│   ├── config/                      # Validated environment configurations
│   ├── controllers/                 # Express request/response handlers
│   ├── routes/                      # Route declarations and middleware binding
│   ├── services/                    # Business orchestration services
│   │   ├── seasonService.ts         # Season lifecycle and freezing
│   │   ├── votingService.ts         # Ballot handling and validation
│   │   ├── catalogService.ts        # Artist directory operations
│   │   └── syncService.ts           # Listening data ingestion pipeline
│   ├── engine/                      # Pure business logic
│   │   ├── scoringEngine.ts         # Deterministic calculations & tie-breakers
│   │   └── scoringEngine.test.ts    # Test suite covering all scoring vectors
│   ├── integrations/
│   │   ├── listeningDataProvider.ts # Provider interface definition
│   │   ├── mockListeningProvider.ts # Offline mock adapter for development
│   │   └── duoChartsAdapter.ts      # Production HTTP adapter for Spotify Duo Charts
│   ├── middleware/                  # Auth, rate-limiting, error handling, validation
│   ├── repositories/                # Typed SQL queries using `pg` or Supabase client
│   ├── types/                       # Shared TypeScript interfaces and DTOs
│   ├── assets/                      # Curated images and visual assets
│   └── client/                      # Frontend Single Page App
└── tests/
    ├── unit/
    └── integration/
```

---

## 3. Core Component Responsibilities

### 3.1. `src/engine/scoringEngine.ts`
- **Inputs:** 
  - List of active approved artists.
  - Set of daily ballots (Participant 1 and Participant 2) for date $D$.
  - Daily aggregated scrobble counts per artist for date $D$.
  - Historical cumulative points up to date $D-1$.
- **Outputs:**
  - Daily points per artist (Vote points + Spotify bonus).
  - Updated season cumulative points.
  - Ranked Male Top 10 and Female Top 10 with rank deltas ($\Delta$).
  - Absolute Champion identification with deterministic tie resolution.

### 3.2. `src/integrations/listeningDataProvider.ts`
Interface definition:
```typescript
export interface DailyArtistListeningRecord {
  spotifyArtistId: string;
  artistName: string;
  date: string; // YYYY-MM-DD
  account1Streams: number;
  account2Streams: number;
  combinedStreams: number;
  dataStatus: 'available' | 'incomplete' | 'unavailable';
}

export interface ListeningDataProvider {
  getDailyListeningStats(date: string): Promise<{
    records: DailyArtistListeningRecord[];
    syncTimestamp: string;
    isMock: boolean;
  }>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
```

### 3.3. `src/services/seasonService.ts`
- Handles the state machine:
  $$\text{Draft} \longrightarrow \text{Active} \longrightarrow \text{Archived}$$
- Prohibits setting any season to `active` if `SELECT COUNT(*) FROM seasons WHERE status = 'active'` $> 0$.
- In the `closeSeason` method:
  1. Opens PostgreSQL transaction (`BEGIN`).
  2. Aggregates final daily points for all days within `[start_date, CURRENT_DATE]`.
  3. Computes final Male Top 10, Female Top 10, and Absolute Champion.
  4. Inserts immutable rows into `season_results`.
  5. Updates `seasons.status = 'archived'`, `seasons.closed_at = NOW()`, `seasons.closed_by = admin_id`.
  6. Commits transaction (`COMMIT`).

---

## 4. Timezone & Date Boundary Architecture

All date grouping and ballot closures are governed by the application's canonical timezone:
- Default: `America/Panama` (UTC-5, does not observe Daylight Saving Time).
- Configurable via `LEAGUE_TIMEZONE` env variable.
- All database timestamps are stored in UTC (`TIMESTAMPTZ`), but daily ballot records store `competition_date DATE NOT NULL` computed via `timezone(LEAGUE_TIMEZONE, NOW())::DATE`.
- This guarantees zero drift regardless of whether the backend server runs in US-East, Europe, or Docker locally.
