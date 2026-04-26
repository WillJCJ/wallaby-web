const STATUS_TONE_CLASSES = {
  success: 'private-status--success',
  warning: 'private-status--warning',
  failure: 'private-status--failure',
};

const STATUS_TONE_CLASS_LIST = Object.values(STATUS_TONE_CLASSES);

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

    if (tone && STATUS_TONE_CLASSES[tone]) {
      statusEl.classList.add(STATUS_TONE_CLASSES[tone]);
    }

    statusEl.textContent = message;
    statusEl.hidden = false;
  };
};