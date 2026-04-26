import { describe, expect, it, vi } from 'vitest';
import {
  buildUpdatedPolicyPayload,
  fetchAccessPolicy,
  getAccessPolicyEmailDrift,
  getAccessPolicySyncConfig,
  listManagedPolicyEmails,
  normalizeEmailList,
  syncAccessPolicyFromGuests,
  updateAccessPolicy,
} from '../access-policy-sync.js';

describe('normalizeEmailList', () => {
  it('normalises, deduplicates, and sorts emails', () => {
    const result = normalizeEmailList([
      ' B@example.com ',
      'a@example.com',
      'b@example.com',
      'A@example.com',
      '',
      null,
    ]);

    expect(result).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('getAccessPolicySyncConfig', () => {
  it('returns parsed config when all env values exist', () => {
    const result = getAccessPolicySyncConfig({
      CF_ACCOUNT_ID: 'acc',
      CF_ACCESS_API_TOKEN: 'token',
      CF_ACCESS_POLICY_ID: 'policy',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.accountId).toBe('acc');
  });

  it('returns error when required values are missing', () => {
    const result = getAccessPolicySyncConfig({ CF_ACCOUNT_ID: 'acc' });
    expect(result.error).toBeTruthy();
    expect(result.error.missing).toContain('CF_ACCESS_API_TOKEN');
  });
});

describe('buildUpdatedPolicyPayload', () => {
  it('preserves non-email include rules and replaces managed email rules', () => {
    const existingPolicy = {
      id: 'policy-id',
      include: [
        { email: { email: 'old@example.com' } },
        { email_domain: { domain: 'example.org' } },
      ],
      require: [{ country: { country: 'GB' } }],
    };

    const updated = buildUpdatedPolicyPayload(existingPolicy, ['new@example.com']);
    expect(updated.include).toEqual([
      { email_domain: { domain: 'example.org' } },
      { email: { email: 'new@example.com' } },
    ]);
    expect(updated.require).toEqual([{ country: { country: 'GB' } }]);
  });

  it('adds a placeholder email include when the resulting include list would be empty', () => {
    const existingPolicy = {
      id: 'policy-id',
      include: [{ email: { email: 'old@example.com' } }],
    };

    const updated = buildUpdatedPolicyPayload(existingPolicy, []);
    expect(updated.include).toEqual([
      { email: { email: 'wallabyfest-access-placeholder@invalid.invalid' } },
    ]);
  });
});

describe('listManagedPolicyEmails', () => {
  it('returns sorted managed include emails', () => {
    const result = listManagedPolicyEmails({
      include: [
        { email: { email: 'B@example.com' } },
        { email_domain: { domain: 'example.org' } },
        { email: { email: 'a@example.com' } },
      ],
    });

    expect(result).toEqual(['a@example.com', 'b@example.com']);
  });

  it('ignores the managed placeholder include email', () => {
    const result = listManagedPolicyEmails({
      include: [
        { email: { email: 'wallabyfest-access-placeholder@invalid.invalid' } },
        { email: { email: 'friend@example.com' } },
      ],
    });

    expect(result).toEqual(['friend@example.com']);
  });
});

describe('fetchAccessPolicy', () => {
  it('returns policy value on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: { id: 'policy-id', include: [] },
    }), { status: 200 }));

    const result = await fetchAccessPolicy({
      accountId: 'acc',
      policyId: 'policy',
      apiToken: 'token',
    }, fetchImpl);

    expect(result.value.id).toBe('policy-id');
  });

  it('returns structured error on failure', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      errors: [{ message: 'bad token' }],
    }), { status: 403 }));

    const result = await fetchAccessPolicy({
      accountId: 'acc',
      policyId: 'policy',
      apiToken: 'token',
    }, fetchImpl);

    expect(result.error).toBeTruthy();
    expect(result.error.status).toBe(403);
    expect(result.error.retryable).toBe(false);
  });
});

describe('updateAccessPolicy', () => {
  it('returns updated policy value on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: { id: 'policy-id', include: [] },
    }), { status: 200 }));

    const result = await updateAccessPolicy({
      accountId: 'acc',
      policyId: 'policy',
      apiToken: 'token',
    }, {
      id: 'policy-id',
      include: [],
      name: 'Policy',
    }, fetchImpl);

    expect(result.value.id).toBe('policy-id');
  });
});

describe('syncAccessPolicyFromGuests', () => {
  it('syncs desired access emails from guests to policy', async () => {
    const prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({
        results: [
          { email: 'Admin@example.com' },
          { email: 'friend@example.com' },
          { email: 'admin@example.com' },
        ],
      }),
    });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        result: { id: 'policy-id', include: [] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        result: { id: 'policy-id', include: [] },
      }), { status: 200 }));

    const result = await syncAccessPolicyFromGuests({
      CF_ACCOUNT_ID: 'acc',
      CF_ACCESS_API_TOKEN: 'token',
      CF_ACCESS_POLICY_ID: 'policy',
      GUESTS_DB: { prepare },
    }, fetchImpl);

    expect(result.error).toBeUndefined();
    expect(result.value.desiredEmails).toEqual(['admin@example.com', 'friend@example.com']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('uses placeholder include when no guest emails are access-enabled', async () => {
    const prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
    });

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        result: { id: 'policy-id', include: [] },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        result: { id: 'policy-id', include: [] },
      }), { status: 200 }));

    const result = await syncAccessPolicyFromGuests({
      CF_ACCOUNT_ID: 'acc',
      CF_ACCESS_API_TOKEN: 'token',
      CF_ACCESS_POLICY_ID: 'policy',
      GUESTS_DB: { prepare },
    }, fetchImpl);

    expect(result.error).toBeUndefined();
    expect(result.value.desiredEmails).toEqual([]);

    const putBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(putBody.include).toEqual([
      { email: { email: 'wallabyfest-access-placeholder@invalid.invalid' } },
    ]);
  });
});

describe('getAccessPolicyEmailDrift', () => {
  it('returns drift when desired and policy emails differ', async () => {
    const prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({
        results: [{ email: 'admin@example.com' }, { email: 'friend@example.com' }],
      }),
    });

    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      result: {
        id: 'policy-id',
        include: [
          { email: { email: 'admin@example.com' } },
          { email: { email: 'other@example.com' } },
        ],
      },
    }), { status: 200 }));

    const result = await getAccessPolicyEmailDrift({
      CF_ACCOUNT_ID: 'acc',
      CF_ACCESS_API_TOKEN: 'token',
      CF_ACCESS_POLICY_ID: 'policy',
      GUESTS_DB: { prepare },
    }, fetchImpl);

    expect(result.error).toBeUndefined();
    expect(result.value.drift).toBe(true);
    expect(result.value.missingFromPolicy).toEqual(['friend@example.com']);
    expect(result.value.extraInPolicy).toEqual(['other@example.com']);
  });
});
