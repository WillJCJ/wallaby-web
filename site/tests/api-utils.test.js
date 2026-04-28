import { describe, it, expect, vi } from 'vitest';
import { apiFetch } from '../scripts/api-utils.js';

global.fetch = vi.fn();

describe('apiFetch', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls fetch with correct defaults', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: vi.fn() });
    await apiFetch('/api/test');
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
    }));
  });

  it('throws error with server message on non-ok response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad request' }),
    });
    await expect(apiFetch('/api/test')).rejects.toThrow('Bad request');
  });

  it('throws generic error if no error message in response', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(apiFetch('/api/test')).rejects.toThrow('Request failed (500)');
  });

  it('handles fetch network error', async () => {
    fetch.mockRejectedValueOnce(new Error('Network fail'));
    await expect(apiFetch('/api/test')).rejects.toThrow('Network fail');
  });
});
