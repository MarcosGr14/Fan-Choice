-- Snapshot of Duo Charts lifetime totals; never used to calculate season points.
CREATE TABLE IF NOT EXISTS lifetime_listening_snapshot (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lifetime_listening_snapshot ENABLE ROW LEVEL SECURITY;
-- Access through the server's PostgreSQL connection only (no browser policies).
