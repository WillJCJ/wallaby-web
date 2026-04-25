/**
 * Shared fetch utility for API calls.
 *
 * Applies credentials: 'same-origin' and cache: 'no-store' by default,
 * and parses the JSON error body on non-ok responses to produce a consistent
 * thrown Error with the server-supplied message.
 */
const buildLoginRedirectUrl = () => {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login/?next=${encodeURIComponent(next)}`;
};

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
      window.WallabyAuth?.setStoredAuthEmail(null);
      window.location.replace(buildLoginRedirectUrl());
      throw new Error('Authentication required', { cause: error });
    }

    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 && isPrivateApiRequest) {
      window.WallabyAuth?.setStoredAuthEmail(null);
      window.location.replace(buildLoginRedirectUrl());
      throw new Error('Authentication required');
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response;
};
