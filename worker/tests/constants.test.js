import { describe, it, expect } from 'vitest';
import { HTTP_STATUS, RSVP_VALUES } from '../constants.js';

describe('HTTP_STATUS', () => {
  it('exports the expected status codes', () => {
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.METHOD_NOT_ALLOWED).toBe(405);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
  });
});

describe('RSVP_VALUES', () => {
  it('is a Set', () => {
    expect(RSVP_VALUES).toBeInstanceOf(Set);
  });

  it('contains the expected values', () => {
    expect(RSVP_VALUES.has('pending')).toBe(true);
    expect(RSVP_VALUES.has('yes')).toBe(true);
    expect(RSVP_VALUES.has('no')).toBe(true);
  });

  it('does not contain unexpected values', () => {
    expect(RSVP_VALUES.has('maybe')).toBe(false);
    expect(RSVP_VALUES.has('')).toBe(false);
  });
});
