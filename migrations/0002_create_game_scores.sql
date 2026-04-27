CREATE TABLE IF NOT EXISTS game_runs (
  run_id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  submitted_score INTEGER,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
);

CREATE INDEX IF NOT EXISTS idx_game_runs_guest_started ON game_runs(guest_id, started_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_game_runs_finished ON game_runs(finished_at_ms);

CREATE TABLE IF NOT EXISTS game_scores (
  run_id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES game_runs(run_id),
  FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
  CHECK (score >= 0),
  CHECK (duration_ms >= 0)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_guest_score ON game_scores(guest_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_score ON game_scores(score DESC, duration_ms ASC);

CREATE VIEW IF NOT EXISTS game_high_scores AS
SELECT
  guest_id,
  MAX(score) AS score
FROM game_scores
GROUP BY guest_id;
