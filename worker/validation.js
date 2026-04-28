import { RSVP_VALUES } from './constants.js';

export const parseJsonBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
};

export const normalizeRsvp = (value) => {
  const rsvp = String(value ?? 'pending').trim().toLowerCase();
  return RSVP_VALUES.has(rsvp) ? rsvp : null;
};

// eslint-disable-next-line complexity -- Guest payload validates and coerces each independent field with distinct type and length rules.
export const validateGuestPayload = (payload) => {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const rsvp = normalizeRsvp(payload?.rsvp);
  const additionalGuests = toInteger(payload?.additionalGuests, 0);
  const dietaryRequirements = typeof payload?.dietaryRequirements === 'string'
    ? payload.dietaryRequirements.trim()
    : '';
  const rsvpMessage = typeof payload?.rsvpMessage === 'string'
    ? payload.rsvpMessage.trim()
    : '';

  if (!name) {
    return { error: 'name is required' };
  }

  if (!email) {
    return { error: 'email is required' };
  }

  if (!rsvp) {
    return { error: 'rsvp must be one of: pending, yes, no' };
  }

  if (additionalGuests < 0) {
    return { error: 'additionalGuests must be 0 or greater' };
  }

  return {
    value: {
      name,
      email,
      rsvp,
      additionalGuests,
      dietaryRequirements,
      rsvpMessage,
    },
  };
};

export const validateGuestSelfPayload = (payload, existingGuest) => {
  const hasRsvp = Object.prototype.hasOwnProperty.call(payload, 'rsvp');
  const hasAdditionalGuests = Object.prototype.hasOwnProperty.call(payload, 'additionalGuests');
  const hasDietaryRequirements = Object.prototype.hasOwnProperty.call(payload, 'dietaryRequirements');
  const hasRsvpMessage = Object.prototype.hasOwnProperty.call(payload, 'rsvpMessage');

  const rsvp = hasRsvp ? normalizeRsvp(payload.rsvp) : existingGuest.rsvp;

  if (!rsvp) {
    return { error: 'rsvp must be one of: pending, yes, no' };
  }

  let additionalGuests = existingGuest.additional_guests;

  if (hasAdditionalGuests) {
    const parsed = Number.parseInt(payload.additionalGuests, 10);

    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: 'additionalGuests must be 0 or greater' };
    }

    additionalGuests = parsed;
  }

  const dietaryRequirements = hasDietaryRequirements
    ? String(payload.dietaryRequirements ?? '').trim()
    : existingGuest.dietary_requirements;

  const rsvpMessage = hasRsvpMessage
    ? String(payload.rsvpMessage ?? '').trim()
    : existingGuest.rsvp_message;

  return {
    value: {
      rsvp,
      additionalGuests,
      dietaryRequirements,
      rsvpMessage,
    },
  };
};

export const validateGuestAccessTogglePayload = (payload) => {
  if (payload === null || payload === undefined) {
    return { value: {} };
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'payload must be an object' };
  }

  if (!Object.prototype.hasOwnProperty.call(payload, 'accessEnabled')) {
    return { error: 'accessEnabled is required' };
  }

  if (typeof payload.accessEnabled !== 'boolean') {
    return { error: 'accessEnabled must be a boolean' };
  }

  return { value: { accessEnabled: payload.accessEnabled } };
};

export const validateGuestsSyncPayload = (payload) => {
  if (payload === null || payload === undefined) {
    return { value: { mode: 'full' } };
  }

  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'payload must be an object' };
  }

  const rawMode = (payload.mode === null || payload.mode === undefined) ? 'full' : String(payload.mode).trim().toLowerCase();
  if (rawMode !== 'full' && rawMode !== 'dry-run') {
    return { error: 'mode must be one of: full, dry-run' };
  }

  return { value: { mode: rawMode } };
};

// Validates a public access-request submission (name + email only).
// Uses a Unicode-aware name allowlist to support European and other special characters.
// Does NOT use the admin guest validators — this is a stricter, narrower surface.
const VALID_NAME_RE = /^[\p{L}\p{M}\p{N} '\-.]+$/u;

// eslint-disable-next-line complexity -- Access request payload validates name and email with format, length, and character rules.
export const validateAccessRequestPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'Invalid request body' };
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

  if (!name) {
    return { error: 'Name is required' };
  }

  if (name.length > 120) {
    return { error: 'Name is too long' };
  }

  if (!VALID_NAME_RE.test(name)) {
    return { error: 'Name contains invalid characters' };
  }

  if (!email) {
    return { error: 'Email is required' };
  }

  if (email.length > 320) {
    return { error: 'Email is too long' };
  }

  // RFC-5321-ish: local@domain.tld — deliberately simple but sufficient.
  const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!VALID_EMAIL_RE.test(email)) {
    return { error: 'Email is not valid' };
  }

  return { value: { name, email } };
};
