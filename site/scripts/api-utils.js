/**
 * Shared fetch utility for API calls.
 *
 * Applies credentials: 'same-origin' and cache: 'no-store' by default,
 * and parses the JSON error body on non-ok responses to produce a consistent
 * thrown Error with the server-supplied message.
 */
export const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response;
};
