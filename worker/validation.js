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
