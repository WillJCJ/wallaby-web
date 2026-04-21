import { describe, it, expect } from 'vitest';
import {
  jsonResponse,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  internalError,
} from '../response.js';

describe('jsonResponse', () => {
  it('returns a Response with JSON content-type', async () => {
    const res = jsonResponse({ ok: true });
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('serialises the payload as JSON', async () => {
    const payload = { id: 1, name: 'Test' };
    const res = jsonResponse(payload);
    const body = await res.json();
    expect(body).toEqual(payload);
  });

  it('defaults to HTTP 200', () => {
    const res = jsonResponse({});
    expect(res.status).toBe(200);
  });

  it('respects a custom status code', () => {
    const res = jsonResponse({ error: 'Not Found' }, { status: 404 });
    expect(res.status).toBe(404);
  });

  it('merges additional headers', async () => {
    const res = jsonResponse({}, { headers: { 'cache-control': 'no-store' } });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('overrides content-type even if passed in headers', () => {
    const res = jsonResponse({}, { headers: { 'content-type': 'text/plain' } });
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });
});

describe('badRequest', () => {
  it('returns 400 with default message', async () => {
    const res = badRequest();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Bad Request');
  });

  it('returns 400 with a custom message', async () => {
    const res = badRequest('Missing field');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing field');
  });
});

describe('unauthorized', () => {
  it('returns 401 with Unauthorized error', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });
});

describe('forbidden', () => {
  it('returns 403 with Forbidden error', async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });
});

describe('notFound', () => {
  it('returns 404 with default message', async () => {
    const res = notFound();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Not Found');
  });

  it('returns 404 with a custom message', async () => {
    const res = notFound('Guest not found');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Guest not found');
  });
});

describe('methodNotAllowed', () => {
  it('returns 405 with Method Not Allowed error', async () => {
    const res = methodNotAllowed();
    expect(res.status).toBe(405);
    expect((await res.json()).error).toBe('Method Not Allowed');
  });
});

describe('internalError', () => {
  it('returns 500 with default message', async () => {
    const res = internalError();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal Server Error');
  });

  it('returns 500 with a custom message', async () => {
    const res = internalError('DB query failed');
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('DB query failed');
  });
});
