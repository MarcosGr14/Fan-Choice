-- Run before deploying the expanded daily ballots. Existing ballots remain valid.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.daily_vote_items
  DROP CONSTRAINT IF EXISTS daily_vote_items_rank_position_check,
  DROP CONSTRAINT IF EXISTS ck_position_points,
  ADD CONSTRAINT daily_vote_items_rank_position_check CHECK (rank_position BETWEEN 1 AND 10),
  ADD CONSTRAINT ck_position_points CHECK (points_awarded = GREATEST(1, 6 - rank_position));

ALTER TABLE public.idol_submissions
  DROP CONSTRAINT IF EXISTS idol_submissions_check,
  DROP CONSTRAINT IF EXISTS idol_submissions_ballot_size_check,
  ADD CONSTRAINT idol_submissions_ballot_size_check CHECK (
    (kind = 'favorites' AND category = 'all') OR
    (kind = 'daily' AND category IN ('male', 'female') AND jsonb_array_length(idol_ids) BETWEEN 10 AND 25)
  );

COMMIT;
