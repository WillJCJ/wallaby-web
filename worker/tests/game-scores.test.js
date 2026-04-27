import { describe, it, expect } from 'vitest';
import {
  formatDisplayName,
  getMaxPlausibleScore,
  handleGameHighScores,
  handleGameRunFinish,
} from '../game-scores.js';

const makeRequest = (url, options = {}) => new Request(url, options);

const makeDb = ({
  runRow = null,
  guestRow = null,
  leaderboardRows = [],
  myBestRow = null,
  updateRunResult = { success: true, meta: { changes: 1 } },
  updateScoreResult = { success: true },
} = {}) => ({
  prepare(sql) {
    return {
      bind() {
        return {
          first: async () => {
            if (sql.includes('FROM game_runs')) return runRow;
            if (sql.includes('FROM guests')) return guestRow;
            if (sql.includes('FROM game_high_scores')) return myBestRow;
            return null;
          },
          all: async () => {
            if (sql.includes('FROM game_high_scores')) {
              return { results: leaderboardRows };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('UPDATE game_runs')) return updateRunResult;
            if (sql.includes('INSERT INTO game_scores')) return updateScoreResult;
            return { success: true };
          },
        };
      },
    };
  },
});

describe('game-scores formatDisplayName', () => {
  it('formats first name plus initial', () => {
    expect(formatDisplayName('Will Connor Jones')).toBe('Will C');
  });

  it('uses first name when no surname exists', () => {
    expect(formatDisplayName('Wallaby')).toBe('Wallaby');
  });

  it('falls back to "Anonymous" when name missing', () => {
    expect(formatDisplayName('')).toBe('Anonymous');
  });
});

describe('game-scores plausibility', () => {
  it('calculates a bounded max score from elapsed time', () => {
    expect(getMaxPlausibleScore(10_000)).toBeGreaterThan(300);
    expect(getMaxPlausibleScore(10_000)).toBeLessThan(500);
  });
});

describe('game-scores handlers', () => {
  it('returns leaderboard without requiring authentication', async () => {
    const req = makeRequest('https://example.com/api/private/game/high-scores');

    const env = {
      GUESTS_DB: makeDb({
        leaderboardRows: [{ guest_id: 'guest-1', name: 'Will Connor', email: 'player@example.com', score: 321, duration_ms: 14000 }],
      }),
    };

    const res = await handleGameHighScores(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leaderboard).toHaveLength(1);
    expect(body.myBest).toBeNull();
  });

  it('returns leaderboard and personal best for authenticated request', async () => {
    const req = makeRequest('https://example.com/api/private/game/high-scores', {
      headers: { 'CF-Access-Authenticated-User-Email': 'player@example.com' },
    });

    const env = {
      GUESTS_DB: makeDb({
        guestRow: { guest_id: 'guest-1', name: 'Will Connor', email: 'player@example.com' },
        leaderboardRows: [{ guest_id: 'guest-1', name: 'Will Connor', email: 'player@example.com', score: 321, duration_ms: 14000 }],
        myBestRow: { name: 'Will Connor', email: 'player@example.com', score: 321, duration_ms: 14000 },
      }),
    };

    const res = await handleGameHighScores(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leaderboard).toHaveLength(1);
    expect(body.leaderboard[0].isViewer).toBe(true);
    expect(body.myBest.score).toBe(321);
  });

  it('rejects implausible score submissions', async () => {
    const req = makeRequest('https://example.com/api/private/game/runs/abc123/finish', {
      method: 'POST',
      headers: {
        'CF-Access-Authenticated-User-Email': 'player@example.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ score: 10_000, durationMs: 2_000 }),
    });

    const env = {
      GUESTS_DB: makeDb({
        guestRow: { guest_id: 'guest-1', name: 'Will Connor', email: 'player@example.com' },
        runRow: {
          run_id: 'abc123',
          guest_id: 'guest-1',
          started_at_ms: Date.now() - 2_000,
          finished_at_ms: null,
        },
      }),
    };

    const res = await handleGameRunFinish(req, env, '/api/private/game/runs/abc123/finish');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('plausible');
  });
});
