export const normalizeAccessEnabled = (value) => value === true
  || value === 1
  || value === '1'
  || (typeof value === 'string' && value.toLowerCase() === 'true');

export const formatAdminDateTime = (value) => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(', ', ' ');
};

export const formatSyncSummary = (summary) => {
  if (!summary || typeof summary !== 'object') {
    return 'Sync summary is unavailable.';
  }

  const inSync = Number(summary.inSync) || 0;
  const pending = Number(summary.pending) || 0;
  const failed = Number(summary.failed) || 0;
  const drift = Boolean(summary.drift);
  const lastSync = summary.lastSyncAt || 'Never';

  const driftLabel = drift ? 'Drift detected' : 'No drift';
  return `In sync: ${inSync} | Pending: ${pending} | Failed: ${failed} | ${driftLabel} | Last sync: ${lastSync}`;
};
