import { describe, it, expect } from 'vitest';
import { jsonResponse } from '../response.js';

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
