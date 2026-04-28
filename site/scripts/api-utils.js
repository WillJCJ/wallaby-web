import { clearStoredAuthEmail } from './shared/auth-state.js';

/**
 * Shared fetch utility for API calls.
 * Applies credentials: 'same-origin' and cache: 'no-store' by default,
 * and parses the JSON error body on non-ok responses to produce a consistent
 * thrown Error with the server-supplied message.
 * @param {string|Request} url - The URL or Request object to fetch
 * @param {object} options - Optional fetch parameters (headers, method, etc.)
 * @returns {Promise<Response>} The fetch response object
 */
export const apiFetch = async (url, options = {}) => {
  const requestUrl = typeof url === 'string' ? url : url?.url || '';
  const isPrivateApiRequest = requestUrl.startsWith('/api/private/');

  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...options.headers,
      },
    });
  } catch (error) {
    if (isPrivateApiRequest) {
      clearStoredAuthEmail();
      throw new Error('Authentication required. Try refreshing?', { cause: error });
    }

    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 && isPrivateApiRequest) {
      clearStoredAuthEmail();
      throw new Error('Authentication required. Try refreshing?');
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response;
};
