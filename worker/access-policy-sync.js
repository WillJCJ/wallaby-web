const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const EMPTY_INCLUDE_PLACEHOLDER_EMAIL = 'wallabyfest-access-placeholder@invalid.invalid';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const normalizeEmailList = (emails) => {
  const unique = new Set();
  for (const email of emails || []) {
    const normalised = normalizeEmail(email);
    if (!normalised) continue;
    unique.add(normalised);
  }

  return Array.from(unique.values()).sort();
};

export const getAccessPolicySyncConfig = (env = {}) => {
  const missing = [];
  if (!String(env.CF_ACCOUNT_ID || '').trim()) missing.push('CF_ACCOUNT_ID');
  if (!String(env.CF_ACCESS_API_TOKEN || '').trim()) missing.push('CF_ACCESS_API_TOKEN');
  if (!String(env.CF_ACCESS_POLICY_ID || '').trim()) missing.push('CF_ACCESS_POLICY_ID');
  if (missing.length > 0) {
    return {
      error: {
        code: 'missing_config',
        message: `Missing required config: ${missing.join(', ')}`,
        missing,
      },
    };
  }

  return {
    value: {
      accountId: String(env.CF_ACCOUNT_ID).trim(),
      apiToken: String(env.CF_ACCESS_API_TOKEN).trim(),
      policyId: String(env.CF_ACCESS_POLICY_ID).trim(),
    },
  };
};

const makePolicyUrl = (config) => (
  `${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/access/policies/${config.policyId}`
);

const buildCloudflareError = async (response, fallbackMessage) => {
  const body = await response.json().catch(() => null);
  const firstError = Array.isArray(body?.errors) && body.errors.length > 0 ? body.errors[0] : null;
  const message = firstError?.message || fallbackMessage;
  return {
    code: 'cloudflare_api_error',
    status: response.status,
    retryable: response.status >= 500 || response.status === 429,
    message,
    details: firstError || null,
  };
};

export const fetchAccessPolicy = async (config, fetchImpl = fetch) => {
  const response = await fetchImpl(makePolicyUrl(config), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return { error: await buildCloudflareError(response, 'Unable to fetch Access policy') };
  }

  const body = await response.json().catch(() => null);
  if (!body?.success || !body?.result) {
    return {
      error: {
        code: 'invalid_response',
        message: 'Cloudflare Access policy response did not contain a valid result',
        retryable: false,
      },
    };
  }

  return { value: body.result };
};

const isManagedEmailIncludeRule = (rule) => {
  if (!rule || typeof rule !== 'object') {
    return false;
  }

  const emailRule = rule.email;
  return typeof emailRule === 'object' && emailRule !== null && typeof emailRule.email === 'string';
};

const buildEmailIncludeRule = (email) => ({
  email: { email },
});

export const listManagedPolicyEmails = (policy) => {
  const include = Array.isArray(policy?.include) ? policy.include : [];
  const emails = include
    .filter(isManagedEmailIncludeRule)
    .map((rule) => rule.email.email)
    .filter((email) => normalizeEmail(email) !== EMPTY_INCLUDE_PLACEHOLDER_EMAIL);

  return normalizeEmailList(emails);
};

const compareEmailSets = (desiredEmails, policyEmails) => {
  const desiredSet = new Set(desiredEmails);
  const policySet = new Set(policyEmails);

  const missingFromPolicy = desiredEmails.filter((email) => !policySet.has(email));
  const extraInPolicy = policyEmails.filter((email) => !desiredSet.has(email));

  return {
    drift: missingFromPolicy.length > 0 || extraInPolicy.length > 0,
    missingFromPolicy,
    extraInPolicy,
  };
};

export const buildUpdatedPolicyPayload = (existingPolicy, managedEmails) => {
  const include = Array.isArray(existingPolicy.include) ? existingPolicy.include : [];
  const unmanagedInclude = include.filter((rule) => !isManagedEmailIncludeRule(rule));
  const managedInclude = managedEmails.length > 0
    ? managedEmails.map(buildEmailIncludeRule)
    : [buildEmailIncludeRule(EMPTY_INCLUDE_PLACEHOLDER_EMAIL)];

  const nextInclude = [...unmanagedInclude, ...managedInclude];

  return {
    ...existingPolicy,
    include: nextInclude.length > 0 ? nextInclude : [buildEmailIncludeRule(EMPTY_INCLUDE_PLACEHOLDER_EMAIL)],
  };
};

const sanitisePolicyPayload = (policy) => {
  const payload = { ...(policy || {}) };
  delete payload.id;
  delete payload.app_count;
  delete payload.created_at;
  delete payload.updated_at;
  delete payload.reusable;
  return payload;
};

export const updateAccessPolicy = async (config, policyPayload, fetchImpl = fetch) => {
  const response = await fetchImpl(makePolicyUrl(config), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(sanitisePolicyPayload(policyPayload)),
  });

  if (!response.ok) {
    return { error: await buildCloudflareError(response, 'Unable to update Access policy') };
  }

  const body = await response.json().catch(() => null);
  if (!body?.success || !body?.result) {
    return {
      error: {
        code: 'invalid_response',
        message: 'Cloudflare Access policy update response did not contain a valid result',
        retryable: false,
      },
    };
  }

  return { value: body.result };
};

export const listDesiredAccessEmails = async (db) => {
  const result = await db
    .prepare('SELECT email FROM guests WHERE access_enabled = 1 ORDER BY email COLLATE NOCASE ASC')
    .all();

  const emails = (result?.results || []).map((row) => row.email);
  return normalizeEmailList(emails);
};

export const syncAccessPolicyFromGuests = async (env, fetchImpl = fetch) => {
  const configResult = getAccessPolicySyncConfig(env);
  if (configResult.error) {
    return { error: configResult.error };
  }

  const config = configResult.value;
  const desiredEmails = await listDesiredAccessEmails(env.GUESTS_DB);

  const policyResult = await fetchAccessPolicy(config, fetchImpl);
  if (policyResult.error) {
    return { error: policyResult.error };
  }

  const nextPolicyPayload = buildUpdatedPolicyPayload(policyResult.value, desiredEmails);
  const updateResult = await updateAccessPolicy(config, nextPolicyPayload, fetchImpl);
  if (updateResult.error) {
    return { error: updateResult.error };
  }

  return {
    value: {
      desiredEmails,
      policy: updateResult.value,
    },
  };
};

export const getAccessPolicyEmailDrift = async (env, fetchImpl = fetch) => {
  const configResult = getAccessPolicySyncConfig(env);
  if (configResult.error) {
    return { error: configResult.error };
  }

  const desiredEmails = await listDesiredAccessEmails(env.GUESTS_DB);
  const policyResult = await fetchAccessPolicy(configResult.value, fetchImpl);
  if (policyResult.error) {
    return { error: policyResult.error };
  }

  const policyEmails = listManagedPolicyEmails(policyResult.value);
  const comparison = compareEmailSets(desiredEmails, policyEmails);

  return {
    value: {
      desiredEmails,
      policyEmails,
      ...comparison,
    },
  };
};
