import { apiFetch } from '../../utils/api.js';

export const fetchGuests = async () => {
  const data = await (await apiFetch('/api/private/guests')).json();
  return Array.isArray(data?.guests) ? data.guests : [];
};

export const fetchAccessRequests = async () => {
  const data = await (await apiFetch('/api/private/access-requests')).json();
  return Array.isArray(data?.requests) ? data.requests : [];
};

export const dismissAccessRequest = async (requestId) => {
  await apiFetch(`/api/private/access-requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });
};

export const fetchSyncStatus = async () => {
  const data = await (await apiFetch('/api/private/guests/sync-status')).json();
  return data?.summary || null;
};

export const runSync = async (mode) => {
  const data = await (await apiFetch('/api/private/guests/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  })).json();
  return data;
};

export const setGuestAccess = async (guestId, enabled) => {
  const action = enabled ? 'enable' : 'disable';
  const response = await (await apiFetch(`/api/private/guests/${guestId}/access/${action}`, {
    method: 'POST',
  })).json();
  return response;
};

export const deleteGuest = async (guestId) => {
  const response = await (await apiFetch(`/api/private/guests/${guestId}`, {
    method: 'DELETE',
  })).json();
  return response;
};

export const fetchGuestLastSeen = async (guestId, isLastSeenDebugEnabled = false) => {
  try {
    const data = await (await apiFetch(`/api/private/guests/${guestId}/last-seen`)).json();
    return data?.lastSeen || null;
  } catch (error) {
    if (isLastSeenDebugEnabled) {
      console.error('[last_seen debug] Failed to load last_seen for guest', guestId, error);
    }
    return null;
  }
};

export const sendGuestInvitation = async (guestId) => {
  const response = await (await apiFetch(`/api/private/guests/${guestId}/send-invitation`, {
    method: 'POST',
  })).json();
  return response;
};
