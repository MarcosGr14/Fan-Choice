-- ==============================================================================
-- K-POP / J-POP RANKINGS LEAGUE: MIGRATION 001 — INITIAL SCHEMA
-- PostgreSQL 15+ compatible (Supabase & Railway)
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'admin')),
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ARTISTS CATALOG TABLE
CREATE TABLE IF NOT EXISTS artists_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotify_artist_id VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    search_normalized_name VARCHAR(150) NOT NULL,
    image_url TEXT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('male', 'female')),
    artist_type VARCHAR(10) NOT NULL CHECK (artist_type IN ('soloist', 'group')),
    group_type VARCHAR(15) CHECK (group_type IN ('boy_group', 'girl_group', 'mixed_group')),
    music_scene VARCHAR(10) NOT NULL CHECK (music_scene IN ('kpop', 'jpop', 'both')),
    origin_country VARCHAR(2) NOT NULL DEFAULT 'KR',
    status VARCHAR(15) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'deactivated')),
    is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    eligibility_effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_category_status ON artists_catalog (category, status, is_eligible);
CREATE INDEX IF NOT EXISTS idx_artists_search_norm ON artists_catalog (search_normalized_name);

-- 3. SEASONS TABLE
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    start_date DATE NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES participants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crucial: At most ONE season can be active at any given moment
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_season ON seasons ((1)) WHERE status = 'active';

-- 4. DAILY VOTES TABLE
CREATE TABLE IF NOT EXISTS daily_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('male', 'female')),
    competition_date DATE NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_participant_daily_vote UNIQUE (season_id, participant_id, category, competition_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_votes_lookup ON daily_votes (season_id, competition_date, category);

-- 5. DAILY VOTE ITEMS TABLE
CREATE TABLE IF NOT EXISTS daily_vote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_vote_id UUID NOT NULL REFERENCES daily_votes(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists_catalog(id) ON DELETE RESTRICT,
    rank_position SMALLINT NOT NULL CHECK (rank_position BETWEEN 1 AND 5),
    points_awarded SMALLINT NOT NULL CHECK (points_awarded BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vote_rank UNIQUE (daily_vote_id, rank_position),
    CONSTRAINT uq_vote_artist UNIQUE (daily_vote_id, artist_id),
    CONSTRAINT ck_position_points CHECK (
        (rank_position = 1 AND points_awarded = 5) OR
        (rank_position = 2 AND points_awarded = 4) OR
        (rank_position = 3 AND points_awarded = 3) OR
        (rank_position = 4 AND points_awarded = 2) OR
        (rank_position = 5 AND points_awarded = 1)
    )
);

-- 6. DAILY LISTENING STATS TABLE
CREATE TABLE IF NOT EXISTS daily_listening_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES artists_catalog(id) ON DELETE RESTRICT,
    competition_date DATE NOT NULL,
    account_1_streams INTEGER NOT NULL DEFAULT 0 CHECK (account_1_streams >= 0),
    account_2_streams INTEGER NOT NULL DEFAULT 0 CHECK (account_2_streams >= 0),
    combined_streams INTEGER NOT NULL DEFAULT 0 CHECK (combined_streams >= 0),
    calculated_bonus_points SMALLINT NOT NULL DEFAULT 0 CHECK (calculated_bonus_points BETWEEN 0 AND 5),
    data_status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (data_status IN ('available', 'incomplete', 'unavailable', 'mock')),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_artist_date_listening UNIQUE (artist_id, competition_date)
);

CREATE INDEX IF NOT EXISTS idx_listening_date ON daily_listening_stats (competition_date);

-- 7. DAILY SCORES TABLE (Consolidated daily ledger)
CREATE TABLE IF NOT EXISTS daily_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
    artist_id UUID NOT NULL REFERENCES artists_catalog(id) ON DELETE RESTRICT,
    competition_date DATE NOT NULL,
    vote_points SMALLINT NOT NULL DEFAULT 0 CHECK (vote_points BETWEEN 0 AND 10),
    listening_bonus SMALLINT NOT NULL DEFAULT 0 CHECK (listening_bonus BETWEEN 0 AND 5),
    total_daily_points SMALLINT NOT NULL DEFAULT 0 CHECK (total_daily_points BETWEEN 0 AND 15),
    cumulative_season_points INTEGER NOT NULL DEFAULT 0,
    daily_streams INTEGER NOT NULL DEFAULT 0,
    cumulative_season_streams INTEGER NOT NULL DEFAULT 0,
    current_rank SMALLINT,
    previous_rank SMALLINT,
    rank_delta SMALLINT DEFAULT 0,
    is_new_entry BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_scores UNIQUE (season_id, artist_id, competition_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_season_date ON daily_scores (season_id, competition_date, current_rank);

-- 8. SEASON RESULTS TABLE (Immutable Frozen Archive)
CREATE TABLE IF NOT EXISTS season_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
    artist_id UUID NOT NULL REFERENCES artists_catalog(id) ON DELETE RESTRICT,
    category VARCHAR(10) NOT NULL CHECK (category IN ('male', 'female')),
    final_rank SMALLINT NOT NULL,
    is_category_champion BOOLEAN NOT NULL DEFAULT FALSE,
    is_absolute_champion BOOLEAN NOT NULL DEFAULT FALSE,
    final_points INTEGER NOT NULL,
    total_vote_points INTEGER NOT NULL,
    total_bonus_points INTEGER NOT NULL,
    total_streams INTEGER NOT NULL,
    days_scored INTEGER NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_season_artist_result UNIQUE (season_id, artist_id)
);

CREATE INDEX IF NOT EXISTS idx_season_results_ranking ON season_results (season_id, category, final_rank);

-- 9. SYNC RUNS TABLE
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_date DATE NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    execution_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES participants(id),
    action VARCHAR(50) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id UUID,
    payload_before JSONB,
    payload_after JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
