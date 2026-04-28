const STATUS_TONE_CLASSES = {
  success: 'private-status--success',
  warning: 'private-status--warning',
  failure: 'private-status--failure',
};

const STATUS_TONE_CLASS_LIST = Object.values(STATUS_TONE_CLASSES);

const getStatusToneClass = (tone) => {
  if (tone === 'success') return STATUS_TONE_CLASSES.success;
  if (tone === 'warning') return STATUS_TONE_CLASSES.warning;
  if (tone === 'failure') return STATUS_TONE_CLASSES.failure;
  return null;
};

export const createStatusSetter = (statusEl, options = {}) => {
  const hideWhenEmpty = options.hideWhenEmpty !== false;

  return (message, tone = null) => {
    if (!statusEl) {
      return;
    }

    statusEl.classList.remove(...STATUS_TONE_CLASS_LIST);

    if (!message) {
      statusEl.textContent = '';
      statusEl.hidden = hideWhenEmpty;
      return;
    }

    const toneClass = getStatusToneClass(tone);
    if (toneClass) {
      statusEl.classList.add(toneClass);
    }

    statusEl.textContent = message;
    statusEl.hidden = false;
  };
};