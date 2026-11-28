-- Run after 006 and before deploying the new daily scoring rules.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.daily_vote_items
  DROP CONSTRAINT IF EXISTS daily_vote_items_points_awarded_check,
  DROP CONSTRAINT IF EXISTS ck_position_points,
  ADD CONSTRAINT ck_position_points CHECK (
    points_awarded = GREATEST(1, 6 - rank_position)
    OR points_awarded = 5 * (11 - rank_position)
  );

ALTER TABLE public.daily_scores
  DROP CONSTRAINT IF EXISTS daily_scores_vote_points_check,
  DROP CONSTRAINT IF EXISTS daily_scores_total_daily_points_check,
  ADD CONSTRAINT daily_scores_vote_points_check CHECK (vote_points >= 0),
  ADD CONSTRAINT daily_scores_total_daily_points_check CHECK (total_daily_points >= 0);

ALTER TABLE public.idol_submissions
  ADD COLUMN IF NOT EXISTS scoring_version SMALLINT NOT NULL DEFAULT 1
    CHECK (scoring_version IN (1, 2));

COMMIT;
