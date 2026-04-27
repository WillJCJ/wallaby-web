-- Seed one game run and score per local guest.
-- Uses subqueries to resolve guest_id by email so this stays
-- correct regardless of how guest_id was generated.

INSERT INTO game_runs (run_id, guest_id, started_at_ms, finished_at_ms, submitted_score, duration_ms)
SELECT 'seed-run-admin', guest_id, 1745700000000, 1745700045000, 420, 45000
FROM guests WHERE email = 'admin@example.com';

INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
SELECT 'seed-run-admin', guest_id, 420, 45000
FROM guests WHERE email = 'admin@example.com';

INSERT INTO game_runs (run_id, guest_id, started_at_ms, finished_at_ms, submitted_score, duration_ms)
SELECT 'seed-run-alex', guest_id, 1745700100000, 1745700155000, 850, 55000
FROM guests WHERE email = 'alex@example.com';

INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
SELECT 'seed-run-alex', guest_id, 850, 55000
FROM guests WHERE email = 'alex@example.com';

INSERT INTO game_runs (run_id, guest_id, started_at_ms, finished_at_ms, submitted_score, duration_ms)
SELECT 'seed-run-mia', guest_id, 1745700200000, 1745700248000, 310, 48000
FROM guests WHERE email = 'mia@example.com';

INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
SELECT 'seed-run-mia', guest_id, 310, 48000
FROM guests WHERE email = 'mia@example.com';

INSERT INTO game_runs (run_id, guest_id, started_at_ms, finished_at_ms, submitted_score, duration_ms)
SELECT 'seed-run-sam', guest_id, 1745700300000, 1745700338000, 1200, 38000
FROM guests WHERE email = 'sam@example.com';

INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
SELECT 'seed-run-sam', guest_id, 1200, 38000
FROM guests WHERE email = 'sam@example.com';

INSERT INTO game_runs (run_id, guest_id, started_at_ms, finished_at_ms, submitted_score, duration_ms)
SELECT 'seed-run-priya', guest_id, 1745700400000, 1745700451000, 670, 51000
FROM guests WHERE email = 'priya@example.com';

INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
SELECT 'seed-run-priya', guest_id, 670, 51000
FROM guests WHERE email = 'priya@example.com';
