import { describe, it, expect } from 'vitest';
import {
  parseJsonBody,
  toInteger,
  normalizeRsvp,
  validateGuestPayload,
  validateGuestAccessTogglePayload,
  validateGuestsSyncPayload,
  validateGuestSelfPayload,
  validateAccessRequestPayload,
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
     
    const { dietaryRequirements: _dietaryRequirements, rsvpMessage: _rsvpMessage, ...minimal } = valid;
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

// ---------------------------------------------------------------------------
// validateGuestAccessTogglePayload
// ---------------------------------------------------------------------------

describe('validateGuestAccessTogglePayload', () => {
  it('accepts a valid boolean payload', () => {
    const result = validateGuestAccessTogglePayload({ accessEnabled: true });
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ accessEnabled: true });
  });

  it('accepts null payload for bodyless endpoints', () => {
    const result = validateGuestAccessTogglePayload(null);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({});
  });

  it('rejects non-object payloads', () => {
    const result = validateGuestAccessTogglePayload('oops');
    expect(result.error).toBe('payload must be an object');
  });

  it('rejects missing accessEnabled field', () => {
    const result = validateGuestAccessTogglePayload({});
    expect(result.error).toBe('accessEnabled is required');
  });

  it('rejects non-boolean accessEnabled', () => {
    const result = validateGuestAccessTogglePayload({ accessEnabled: 'yes' });
    expect(result.error).toBe('accessEnabled must be a boolean');
  });
});

// ---------------------------------------------------------------------------
// validateAccessRequestPayload
// ---------------------------------------------------------------------------

describe('validateAccessRequestPayload', () => {
  const valid = { name: 'Alice Smith', email: 'Alice@Example.com' };

  it('returns a value for a valid payload', () => {
    const result = validateAccessRequestPayload(valid);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ name: 'Alice Smith', email: 'alice@example.com' });
  });

  it('lowercases and trims the email', () => {
    const result = validateAccessRequestPayload({ name: 'Alice', email: '  Alice@Example.COM  ' });
    expect(result.value.email).toBe('alice@example.com');
  });

  it('trims whitespace from name', () => {
    const result = validateAccessRequestPayload({ name: '  Alice  ', email: 'alice@example.com' });
    expect(result.value.name).toBe('Alice');
  });

  it('returns an error when name is empty', () => {
    const result = validateAccessRequestPayload({ name: '', email: 'alice@example.com' });
    expect(result.error).toMatch(/name/i);
  });

  it('returns an error when name is too long', () => {
    const result = validateAccessRequestPayload({ name: 'A'.repeat(121), email: 'alice@example.com' });
    expect(result.error).toMatch(/too long/i);
  });

  it('returns an error when email is empty', () => {
    const result = validateAccessRequestPayload({ name: 'Alice', email: '' });
    expect(result.error).toMatch(/email/i);
  });

  it('returns an error when email is too long', () => {
    const result = validateAccessRequestPayload({ name: 'Alice', email: `${'a'.repeat(315)  }@x.com` });
    expect(result.error).toMatch(/too long/i);
  });

  it('returns an error for an invalid email format', () => {
    const result = validateAccessRequestPayload({ name: 'Alice', email: 'not-an-email' });
    expect(result.error).toMatch(/email/i);
  });

  it('returns an error when name contains HTML-ish characters', () => {
    const result = validateAccessRequestPayload({ name: 'Alice<script>', email: 'alice@example.com' });
    expect(result.error).toMatch(/invalid characters/i);
  });

  it('accepts names with apostrophes', () => {
    const result = validateAccessRequestPayload({ name: "O'Brien", email: 'obrien@example.com' });
    expect(result.error).toBeUndefined();
  });

  it('accepts names with hyphens', () => {
    const result = validateAccessRequestPayload({ name: 'Anne-Marie', email: 'anne@example.com' });
    expect(result.error).toBeUndefined();
  });

  it('accepts names with European special characters', () => {
    const result = validateAccessRequestPayload({ name: 'Ångström', email: 'ang@example.com' });
    expect(result.error).toBeUndefined();
  });

  it('accepts names with accented characters', () => {
    const result = validateAccessRequestPayload({ name: 'Renée Dupont', email: 'renee@example.com' });
    expect(result.error).toBeUndefined();
  });

  it('returns an error for a null payload', () => {
    const result = validateAccessRequestPayload(null);
    expect(result.error).toBeTruthy();
  });

  it('returns an error for a non-object payload', () => {
    const result = validateAccessRequestPayload('string');
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// validateGuestsSyncPayload
// ---------------------------------------------------------------------------

describe('validateGuestsSyncPayload', () => {
  it('defaults to full mode when payload is null', () => {
    const result = validateGuestsSyncPayload(null);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ mode: 'full' });
  });

  it('accepts dry-run mode', () => {
    const result = validateGuestsSyncPayload({ mode: 'dry-run' });
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ mode: 'dry-run' });
  });

  it('rejects non-object payloads', () => {
    const result = validateGuestsSyncPayload('bad');
    expect(result.error).toBe('payload must be an object');
  });

  it('rejects invalid mode values', () => {
    const result = validateGuestsSyncPayload({ mode: 'incremental' });
    expect(result.error).toBe('mode must be one of: full, dry-run');
  });
});
