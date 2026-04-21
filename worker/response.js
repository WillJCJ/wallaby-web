import { HTTP_STATUS } from './constants.js';

export const jsonResponse = (payload, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
};

export const badRequest = (message = 'Bad Request') =>
  jsonResponse({ error: message }, { status: HTTP_STATUS.BAD_REQUEST });

export const unauthorized = () =>
  jsonResponse({ error: 'Unauthorized' }, { status: HTTP_STATUS.UNAUTHORIZED });

export const forbidden = () =>
  jsonResponse({ error: 'Forbidden' }, { status: HTTP_STATUS.FORBIDDEN });

export const notFound = (message = 'Not Found') =>
  jsonResponse({ error: message }, { status: HTTP_STATUS.NOT_FOUND });

export const methodNotAllowed = () =>
  jsonResponse({ error: 'Method Not Allowed' }, { status: HTTP_STATUS.METHOD_NOT_ALLOWED });

export const internalError = (message = 'Internal Server Error') =>
  jsonResponse({ error: message }, { status: HTTP_STATUS.INTERNAL_SERVER_ERROR });
