const formatLocalTimestamp = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export const showDeploymentVersion = () => {
  const versionLabel = document.getElementById('footer-version');

  if (!versionLabel) {
    return;
  }

  fetch('/api/env', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Unable to load environment info');
      }

      return response.json();
    })
    .then((data) => {
      const deploymentId = data?.versionId || data?.deploymentId;
      const hasDeploymentId = typeof deploymentId === 'string' && deploymentId.length > 0;
      const localUpdatedAt = formatLocalTimestamp(data?.versionTimestamp);
      const label = [
        localUpdatedAt ? `Last updated ${localUpdatedAt}` : null,
        hasDeploymentId ? `version ${deploymentId.slice(0, 8)}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      if (label) {
        versionLabel.textContent = label;
        versionLabel.hidden = false;
      }
    })
    .catch(() => {
      // Ignore env info failures to keep footer unobtrusive.
    });
};
