import { describe, it, expect } from 'vitest';
import {
  parseJsonBody,
  toInteger,
  normalizeRsvp,
  validateGuestPayload,
  validateGuestSelfPayload,
} from '../validation.js';

// ---------------------------------------------------------------------------
// parseJsonBody
// ---------------------------------------------------------------------------

describe('parseJsonBody', () => {
  it('parses valid JSON from a request body', async () => {
    const req = new Request('http://example.com', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'content-type': 'application/json' },
    });
    const result = await parseJsonBody(req);
    expect(result).toEqual({ name: 'Test' });
  });

  it('returns null for invalid JSON', async () => {
    const req = new Request('http://example.com', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    });
    const result = await parseJsonBody(req);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toInteger
// ---------------------------------------------------------------------------

describe('toInteger', () => {
  it('parses a numeric string', () => {
    expect(toInteger('3')).toBe(3);
  });

  it('parses a number value', () => {
    expect(toInteger(5)).toBe(5);
  });

  it('returns the fallback for a non-numeric value', () => {
    expect(toInteger('abc', 0)).toBe(0);
  });

  it('returns the fallback for undefined', () => {
    expect(toInteger(undefined, 0)).toBe(0);
  });

  it('uses 0 as default fallback', () => {
    expect(toInteger(null)).toBe(0);
  });

  it('parses a float string to integer', () => {
    expect(toInteger('2.9')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// normalizeRsvp
// ---------------------------------------------------------------------------

describe('normalizeRsvp', () => {
  it.each(['pending', 'yes', 'no'])('accepts valid value "%s"', (val) => {
    expect(normalizeRsvp(val)).toBe(val);
  });

  it('normalises uppercase to lowercase', () => {
    expect(normalizeRsvp('YES')).toBe('yes');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeRsvp('  no  ')).toBe('no');
  });

  it('defaults to "pending" when value is null', () => {
    expect(normalizeRsvp(null)).toBe('pending');
  });

  it('defaults to "pending" when value is undefined', () => {
    expect(normalizeRsvp(undefined)).toBe('pending');
  });

  it('returns null for an unknown value', () => {
    expect(normalizeRsvp('maybe')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateGuestPayload
// ---------------------------------------------------------------------------

describe('validateGuestPayload', () => {
  const valid = {
    name: 'Jane Doe',
    email: 'Jane@Example.com',
    rsvp: 'yes',
    additionalGuests: 1,
    dietaryRequirements: 'vegan',
    rsvpMessage: 'Can\'t wait!',
  };

  it('returns a value for a valid payload', () => {
    const result = validateGuestPayload(valid);
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@example.com',
      rsvp: 'yes',
      additionalGuests: 1,
      dietaryRequirements: 'vegan',
      rsvpMessage: "Can't wait!",
    });
  });

  it('lowercases the email', () => {
    const result = validateGuestPayload({ ...valid, email: 'UPPER@CASE.COM' });
    expect(result.value.email).toBe('upper@case.com');
  });

  it('trims whitespace from name and email', () => {
    const result = validateGuestPayload({ ...valid, name: '  Jane  ', email: '  jane@example.com  ' });
    expect(result.value.name).toBe('Jane');
    expect(result.value.email).toBe('jane@example.com');
  });

  it('returns an error when name is missing', () => {
    const result = validateGuestPayload({ ...valid, name: '' });
    expect(result.error).toBe('name is required');
  });

  it('returns an error when email is missing', () => {
    const result = validateGuestPayload({ ...valid, email: '' });
    expect(result.error).toBe('email is required');
  });

  it('returns an error for an invalid rsvp value', () => {
    const result = validateGuestPayload({ ...valid, rsvp: 'dunno' });
    expect(result.error).toBe('rsvp must be one of: pending, yes, no');
  });

  it('returns an error for negative additionalGuests', () => {
    const result = validateGuestPayload({ ...valid, additionalGuests: -1 });
    expect(result.error).toBe('additionalGuests must be 0 or greater');
  });

  it('accepts 0 additionalGuests', () => {
    const result = validateGuestPayload({ ...valid, additionalGuests: 0 });
    expect(result.error).toBeUndefined();
    expect(result.value.additionalGuests).toBe(0);
  });

  it('treats missing optional fields as empty strings', () => {
    // eslint-disable-next-line no-unused-vars
    const { dietaryRequirements, rsvpMessage, ...minimal } = valid;
    const result = validateGuestPayload(minimal);
    expect(result.value.dietaryRequirements).toBe('');
    expect(result.value.rsvpMessage).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateGuestSelfPayload
// ---------------------------------------------------------------------------

describe('validateGuestSelfPayload', () => {
  const existingGuest = {
    rsvp: 'pending',
    additional_guests: 0,
    dietary_requirements: '',
    rsvp_message: '',
  };

  it('falls back to existing values when no fields are provided', () => {
    const result = validateGuestSelfPayload({}, existingGuest);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({
      rsvp: 'pending',
      additionalGuests: 0,
      dietaryRequirements: '',
      rsvpMessage: '',
    });
  });

  it('updates only the fields that are provided', () => {
    const result = validateGuestSelfPayload({ rsvp: 'yes', additionalGuests: 2 }, existingGuest);
    expect(result.value.rsvp).toBe('yes');
    expect(result.value.additionalGuests).toBe(2);
    expect(result.value.dietaryRequirements).toBe('');
  });

  it('returns an error for an invalid rsvp value', () => {
    const result = validateGuestSelfPayload({ rsvp: 'invalid' }, existingGuest);
    expect(result.error).toBe('rsvp must be one of: pending, yes, no');
  });

  it('returns an error for a non-integer additionalGuests value', () => {
    const result = validateGuestSelfPayload({ additionalGuests: 'abc' }, existingGuest);
    expect(result.error).toBe('additionalGuests must be 0 or greater');
  });

  it('returns an error for negative additionalGuests', () => {
    const result = validateGuestSelfPayload({ additionalGuests: -1 }, existingGuest);
    expect(result.error).toBe('additionalGuests must be 0 or greater');
  });

  it('trims dietaryRequirements and rsvpMessage', () => {
    const result = validateGuestSelfPayload(
      { dietaryRequirements: '  vegan  ', rsvpMessage: '  hi  ' },
      existingGuest
    );
    expect(result.value.dietaryRequirements).toBe('vegan');
    expect(result.value.rsvpMessage).toBe('hi');
  });
});
