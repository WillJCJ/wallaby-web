import { describe, it, expect } from 'vitest';
import { requireGuestsDb } from '../db.js';

describe('requireGuestsDb', () => {
  it('returns null when GUESTS_DB is present', () => {
    const env = { GUESTS_DB: {} };
    expect(requireGuestsDb(env)).toBeNull();
  });

  it('returns a 500 response when GUESTS_DB is absent', async () => {
    const result = requireGuestsDb({});
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toBe('Guests database is not configured');
    expect(typeof body.hint).toBe('string');
  });
});
