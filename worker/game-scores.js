import {
  getAuthenticatedEmail,
  normalizeAuthenticatedEmail,
  requireAuthenticatedEmail,
  resolveAuthenticatedEmail,
} from './auth.js';
import { requireGuestsDb } from './db.js';
import {
  badRequest,
  internalError,
  jsonResponse,
  methodNotAllowed,
  notFound,
} from './response.js';

const SCOREBOARD_LIMIT = 10;
const MIN_RUN_DURATION_MS = 1200;
const MAX_SCORE_PER_SECOND = 35;
const SCORE_GRACE_POINTS = 50;
const MAX_DURATION_MISMATCH_MS = 10_000;

const toInt = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const splitNameParts = (name) => String(name || '').trim().split(/\s+/).filter(Boolean);

export const formatDisplayName = (name) => {
  const parts = splitNameParts(name);
  if (parts.length >= 2) {
    const firstName = parts[0];
    const initial = parts[1][0]?.toUpperCase() || '';
    return initial ? `${firstName} ${initial}` : firstName;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return 'Anonymous';
};

export const getMaxPlausibleScore = (elapsedMs) => {
  const elapsedSeconds = Math.max(0, elapsedMs / 1000);
  return Math.floor(elapsedSeconds * MAX_SCORE_PER_SECOND + SCORE_GRACE_POINTS);
};

const loadGuestByEmail = async (db, email) => db
  .prepare('SELECT guest_id, name, email FROM guests WHERE lower(email) = lower(?)')
  .bind(email)
  .first();

const loadLeaderboard = async (db, viewerGuestId = null) => {
  const rows = await db
    .prepare(
      `SELECT
         hs.guest_id,
         g.name,
         g.email,
         hs.score,
         MIN(gs.duration_ms) AS duration_ms
       FROM game_high_scores hs
       JOIN guests g ON g.guest_id = hs.guest_id
       JOIN game_scores gs
         ON gs.guest_id = hs.guest_id
        AND gs.score = hs.score
       GROUP BY hs.guest_id, g.name, g.email, hs.score
       ORDER BY hs.score DESC, duration_ms ASC
       LIMIT ?`
    )
    .bind(SCOREBOARD_LIMIT)
    .all();

  const results = rows?.results || [];
  return results.map((row, index) => ({
    rank: index + 1,
    displayName: formatDisplayName(row.name),
    score: row.score,
    isViewer: viewerGuestId ? row.guest_id === viewerGuestId : false,
    durationMs: row.duration_ms,
    updatedAt: null,
  }));
};

const loadMyBest = async (db, guestId) => {
  const row = await db
    .prepare(
      `SELECT
         hs.guest_id,
         g.name,
         g.email,
         hs.score,
         MIN(gs.duration_ms) AS duration_ms
       FROM game_high_scores hs
       JOIN guests g ON g.guest_id = hs.guest_id
       JOIN game_scores gs
         ON gs.guest_id = hs.guest_id
        AND gs.score = hs.score
       WHERE hs.guest_id = ?
       GROUP BY hs.guest_id, g.name, g.email, hs.score`
    )
    .bind(guestId)
    .first();

  if (!row) {
    return null;
  }

  return {
    displayName: formatDisplayName(row.name),
    score: row.score,
    durationMs: row.duration_ms,
    updatedAt: null,
  };
};

const parseRunIdFromPath = (pathname) => {
  const prefix = '/api/private/game/runs/';
  const suffix = '/finish';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }

  const encoded = pathname.slice(prefix.length, -suffix.length);
  const runId = decodeURIComponent(encoded || '').trim();
  return runId || null;
};

const parseFinishPayload = async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: badRequest('Invalid JSON body') };
  }

  const score = toInt(body?.score);
  const durationMs = toInt(body?.durationMs);

  if (score === null || score < 0) {
    return { error: badRequest('score must be a non-negative integer') };
  }

  if (durationMs === null || durationMs < 0) {
    return { error: badRequest('durationMs must be a non-negative integer') };
  }

  return { score, durationMs };
};

export const handleGameHighScores = async (request, env) => {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const dbError = requireGuestsDb(env);
  if (dbError) {
    return dbError;
  }

  const authenticatedEmail = await resolveAuthenticatedEmail(request, env)
    || getAuthenticatedEmail(request);
  const email = authenticatedEmail ? normalizeAuthenticatedEmail(authenticatedEmail) : null;
  const guest = email ? await loadGuestByEmail(env.GUESTS_DB, email) : null;
  const guestId = guest?.guest_id || null;
  const [leaderboard, myBest] = await Promise.all([
    loadLeaderboard(env.GUESTS_DB, guestId),
    guestId ? loadMyBest(env.GUESTS_DB, guestId) : Promise.resolve(null),
  ]);

  return jsonResponse({ leaderboard, myBest });
};

export const handleGameRunStart = async (request, env) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const auth = await requireAuthenticatedEmail(request, env);
  if (auth.error) {
    return auth.error;
  }

  const dbError = requireGuestsDb(env);
  if (dbError) {
    return dbError;
  }

  const email = normalizeAuthenticatedEmail(auth.email);
  const guest = await loadGuestByEmail(env.GUESTS_DB, email);
  if (!guest?.guest_id) {
    return notFound('Guest not found');
  }

  const runId = crypto.randomUUID();
  const startedAtMs = Date.now();

  const result = await env.GUESTS_DB
    .prepare(
      `INSERT INTO game_runs (
         run_id,
         guest_id,
         started_at_ms,
         finished_at_ms,
         submitted_score,
         duration_ms
       ) VALUES (?, ?, ?, NULL, NULL, NULL)`
    )
    .bind(runId, guest.guest_id, startedAtMs)
    .run();

  if (!result.success) {
    return internalError('Unable to start game run');
  }

  return jsonResponse({ runId, startedAtMs });
};

export const handleGameRunFinish = async (request, env, pathname) => {
  if (request.method !== 'POST') {
    return methodNotAllowed();
  }

  const auth = await requireAuthenticatedEmail(request, env);
  if (auth.error) {
    return auth.error;
  }

  const dbError = requireGuestsDb(env);
  if (dbError) {
    return dbError;
  }

  const runId = parseRunIdFromPath(pathname);
  if (!runId) {
    return badRequest('run id is required');
  }

  const payload = await parseFinishPayload(request);
  if (payload.error) {
    return payload.error;
  }

  const email = normalizeAuthenticatedEmail(auth.email);
  const guest = await loadGuestByEmail(env.GUESTS_DB, email);
  if (!guest?.guest_id) {
    return notFound('Guest not found');
  }

  const run = await env.GUESTS_DB
    .prepare(
      `SELECT run_id, guest_id, started_at_ms, finished_at_ms
       FROM game_runs
       WHERE run_id = ?`
    )
    .bind(runId)
    .first();

  if (!run) {
    return notFound('Run not found');
  }

  if (run.guest_id !== guest.guest_id) {
    return notFound('Run not found');
  }

  if (run.finished_at_ms !== null) {
    return badRequest('Run already submitted');
  }

  const finishedAtMs = Date.now();
  const elapsedMs = finishedAtMs - run.started_at_ms;
  if (elapsedMs < MIN_RUN_DURATION_MS) {
    return badRequest('Run duration too short');
  }

  if (Math.abs(payload.durationMs - elapsedMs) > MAX_DURATION_MISMATCH_MS) {
    return badRequest('Run duration mismatch');
  }

  const maxPlausibleScore = getMaxPlausibleScore(elapsedMs);
  if (payload.score > maxPlausibleScore) {
    return badRequest('Submitted score is not plausible for run duration');
  }

  const finishResult = await env.GUESTS_DB
    .prepare(
      `UPDATE game_runs
       SET finished_at_ms = ?,
           submitted_score = ?,
           duration_ms = ?
       WHERE run_id = ? AND finished_at_ms IS NULL`
    )
    .bind(finishedAtMs, payload.score, payload.durationMs, runId)
    .run();

  if (!finishResult.success || finishResult.meta?.changes !== 1) {
    return internalError('Unable to finish game run');
  }

  const insertScoreResult = await env.GUESTS_DB
    .prepare(
      `INSERT INTO game_scores (run_id, guest_id, score, duration_ms)
       VALUES (?, ?, ?, ?)`
    )
    .bind(runId, guest.guest_id, payload.score, payload.durationMs)
    .run();

  if (!insertScoreResult.success) {
    return internalError('Unable to save score');
  }

  const [leaderboard, myBest] = await Promise.all([
    loadLeaderboard(env.GUESTS_DB, guest.guest_id),
    loadMyBest(env.GUESTS_DB, guest.guest_id),
  ]);

  return jsonResponse({
    ok: true,
    acceptedScore: payload.score,
    durationMs: payload.durationMs,
    leaderboard,
    myBest,
  });
};
