import { createStatusSetter } from '/scripts/status-utils.js';

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

  if (useTurnstile) {
    window.onTurnstileSuccess = (token) => {
      turnstileToken = token;
    };

    if (!document.querySelector('script[data-turnstile="true"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = 'true';
      document.body.appendChild(script);
    }
  } else if (requestTurnstile) {
    requestTurnstile.hidden = true;
  }

  if (requestToggle && requestForm) {
    requestToggle.addEventListener('click', () => {
      requestForm.hidden = false;
      requestToggle.hidden = true;
    });
  }

  if (requestCancel && requestForm && requestToggle) {
    requestCancel.addEventListener('click', () => {
      requestForm.hidden = true;
      requestToggle.hidden = false;
      requestPanel?.classList.remove('request-access-panel--submitted');
      setRequestStatus('');
      requestForm.reset();
      turnstileToken = null;
    });
  }

  if (requestForm && requestSubmit && requestStatus) {
    requestForm.addEventListener('submit', async (event) => {
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
        setRequestStatus('Your request has been received! Maybe ping Will a WhatsApp.', 'success');
      } catch {
        setRequestStatus('Unable to send your request. Please try again later.', 'failure');
      } finally {
        requestSubmit.disabled = false;
        turnstileToken = null;
      }
    });
  }

  const redirectAfterLogin = () => {
    window.location.replace('/profile/');
  };

  if (!isLocalHost) {
    auth?.fetchAuthEmail().then((email) => {
      if (!email) {
        return;
      }

      auth?.setStoredAuthEmail(email);
      redirectAfterLogin();
    });
    return;
  }

  if (cfLoginLink) {
    cfLoginLink.hidden = true;
  }

  if (!devForm || !devEmail || !devSubmit) {
    setStatus('Local login form unavailable.', 'failure');
    return;
  }

  devForm.hidden = false;

  const setSubmitting = (submitting) => {
    devSubmit.disabled = submitting;
    devSubmit.textContent = submitting ? 'Signing in...' : 'Sign in locally';
  };

  auth?.fetchAuthEmail?.()
    .then((email) => {
      if (!email) {
        return;
      }

      auth?.setStoredAuthEmail(email);
      redirectAfterLogin();
    })
    .catch(() => {
      // Ignore auth status failures and keep local login available.
    });

  devForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setSubmitting(true);
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
      setSubmitting(false);
    }
  });
})();
