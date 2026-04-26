const LOCALHOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const normalizeHost = (host) => String(host || '').trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');

export const isLocalHost = (host) => LOCALHOSTS.has(normalizeHost(host));

export const isWorkersPreviewHost = (host) => {
  const normalizedHost = normalizeHost(host);
  return normalizedHost.includes('-preview') && normalizedHost.endsWith('.workers.dev');
};

export const isProductionHost = (host) => normalizeHost(host) === 'wallabyfest.co.uk';
