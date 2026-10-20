BEGIN;
CREATE TABLE IF NOT EXISTS idol_submissions (
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('favorites','daily')),
  category TEXT NOT NULL CHECK (category IN ('all','male','female')),
  competition_date DATE NOT NULL,
  idol_ids JSONB NOT NULL CHECK (jsonb_typeof(idol_ids) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'favorites' AND category = 'all') OR
         (kind = 'daily' AND category IN ('male','female') AND jsonb_array_length(idol_ids) = 10))
);
CREATE UNIQUE INDEX IF NOT EXISTS idol_favorites_once ON idol_submissions (season_id,participant_id) WHERE kind='favorites';
CREATE UNIQUE INDEX IF NOT EXISTS idol_daily_once ON idol_submissions (season_id,participant_id,category,competition_date) WHERE kind='daily';
ALTER TABLE idol_submissions ENABLE ROW LEVEL SECURITY;
COMMIT;
