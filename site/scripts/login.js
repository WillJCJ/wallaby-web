import { createStatusSetter } from './status-utils.js';

/**
 * Initialize Turnstile script and set up token callback.
 * @param {object} config - Configuration object
 * @param {boolean} config.useTurnstile - Whether to load Turnstile
 * @param {Function} config.onTokenSuccess - Callback when token is obtained
 * @returns {void}
 */
function initTurnstile({ useTurnstile, onTokenSuccess }) {
  if (!useTurnstile) return;

  window.onTurnstileSuccess = onTokenSuccess;

  if (!document.querySelector('script[data-turnstile="true"]')) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    document.body.appendChild(script);
  }
}

/**
 * Set up request access form toggle and submission handlers.
 * @param {object} elements - DOM elements for request form
 * @param {HTMLElement} elements.toggle - Toggle button element
 * @param {HTMLElement} elements.cancel - Cancel button element
 * @param {HTMLElement} elements.form - Form element
 * @param {object} elements.elements - Additional elements object
 * @param {Function} elements.setRequestStatus - Status message setter
 * @param {Function} elements.onSubmit - Form submission handler
 * @returns {void}
 */
function setupRequestForm({ toggle, cancel, form, elements, setRequestStatus, onSubmit }) {
  if (toggle && form) {
    toggle.addEventListener('click', () => {
      form.hidden = false;
      toggle.hidden = true;
    });
  }

  if (cancel && form && toggle) {
    cancel.addEventListener('click', () => {
      form.hidden = true;
      toggle.hidden = false;
      elements.panel?.classList.remove('request-access-panel--submitted');
      setRequestStatus('');
      form.reset();
    });
  }

  if (form && elements.submit && elements.status) {
    form.addEventListener('submit', onSubmit);
  }
}

/**
 * Set up dev login form handlers.
 * @param {object} elements - DOM elements for dev form
 * @param {HTMLElement} elements.form - Form element
 * @param {HTMLElement} elements.email - Email input element
 * @param {HTMLElement} elements.submit - Submit button element
 * @param {Function} elements.setStatus - Status message setter
 * @param {Function} elements.onSubmit - Form submission handler
 * @returns {boolean} True if form was successfully initialized
 */
function setupDevForm({ form, email, submit, setStatus, onSubmit }) {
  if (!form || !email || !submit) {
    setStatus('Local login form unavailable.', 'failure');
    return false;
  }

  form.hidden = false;
  form.addEventListener('submit', onSubmit);
  return true;
}

/**
 * Check if user is already signed in and redirect if needed.
 * @param {object} auth - WallabyAuth instance
 * @param {boolean} isLocalHost - Whether running on localhost
 * @returns {Promise<void>}
 */
async function checkAuthAndRedirect(auth, isLocalHost) {
  try {
    const isSignedIn = await auth?.fetchSignedIn?.();
    if (isSignedIn) {
      window.location.replace('/profile/');
    }
  } catch (error) {
    if (!isLocalHost) throw error;
    // Ignore auth status failures for localhost
  }
}

(() => {
  const auth = window.WallabyAuth;
  const status = document.getElementById('login-status');
  const cfLoginLink = document.getElementById('cf-login-link');
  const devForm = document.getElementById('dev-auth-form');
  const devEmail = document.getElementById('dev-auth-email');
  const devSubmit = document.getElementById('dev-auth-submit');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  const requestToggle = document.getElementById('request-access-toggle');
  const requestCancel = document.getElementById('request-access-cancel');
  const requestForm = document.getElementById('request-access-form');
  const requestNameInput = document.getElementById('request-name');
  const requestEmailInput = document.getElementById('request-email');
  const requestStatus = document.getElementById('request-access-status');
  const requestSubmit = document.getElementById('request-access-submit');
  const requestTurnstile = document.getElementById('request-turnstile');
  const requestPanel = document.getElementById('request-access-panel');
  const useTurnstile = !isLocalHost;

  let turnstileToken = null;

  const setRequestStatus = createStatusSetter(requestStatus, { hideWhenEmpty: true });
  const setStatus = createStatusSetter(status, { hideWhenEmpty: true });

  // Initialize Turnstile if needed
  initTurnstile({
    useTurnstile,
    onTokenSuccess: (token) => {
      turnstileToken = token;
    },
  });

  if (!useTurnstile && requestTurnstile) {
    requestTurnstile.hidden = true;
  }

  // Set up request access form
  setupRequestForm({
    toggle: requestToggle,
    cancel: requestCancel,
    form: requestForm,
    elements: { submit: requestSubmit, status: requestStatus, panel: requestPanel },
    setRequestStatus,
    onSubmit: async (event) => {
      event.preventDefault();
      requestSubmit.disabled = true;
      setRequestStatus('');

      const name = requestNameInput?.value?.trim() || '';
      const email = requestEmailInput?.value?.trim() || '';

      try {
        const body = { name, email };
        if (turnstileToken) {
          body.turnstileToken = turnstileToken;
        }
        const response = await fetch('/api/access-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error('Request access failed');
        }
        requestForm.hidden = true;
        requestPanel?.classList.add('request-access-panel--submitted');
        if (requestToggle) {
          requestToggle.hidden = true;
          requestToggle.disabled = true;
        }
        setRequestStatus('Your request has been received! Will just got a ping on his phone to add you.', 'success');
      } catch {
        setRequestStatus('Unable to send your request. Please try again later.', 'failure');
      } finally {
        requestSubmit.disabled = false;
        turnstileToken = null;
      }
    },
  });

  const redirectAfterLogin = () => {
    window.location.replace('/profile/');
  };

  // Check auth and redirect if already signed in (production only)
  if (!isLocalHost) {
    checkAuthAndRedirect(auth, isLocalHost);
    return;
  }

  // Local development mode
  if (cfLoginLink) {
    cfLoginLink.hidden = true;
  }

  const devFormReady = setupDevForm({
    form: devForm,
    email: devEmail,
    submit: devSubmit,
    setStatus,
    onSubmit: async (event) => {
      event.preventDefault();
      devSubmit.disabled = true;
      setStatus('Signing in...', 'warning');

      try {
        const result = await auth?.devLogin?.(devEmail.value || '');
        const email = result?.email || devEmail.value || '';
        auth?.setStoredAuthEmail(email);
        redirectAfterLogin();
      } catch (error) {
        const message = error.message || 'Unable to sign in locally.';
        if (message.includes('403')) {
          setStatus('Local dev login is disabled for this host.', 'failure');
        } else {
          setStatus(message, 'failure');
        }
      } finally {
        devSubmit.disabled = false;
      }
    },
  });

  // Check auth status on load
  if (devFormReady) {
    checkAuthAndRedirect(auth, isLocalHost);
  }
})();
