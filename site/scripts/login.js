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
  const useTurnstile = !isLocalHost;
  const requestedNext = new URL(window.location.href).searchParams.get('next') || '/profile/';

  const resolveNextPath = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/')) {
      return '/profile/';
    }

    // Prevent protocol-relative and other external redirects.
    if (value.startsWith('//')) {
      return '/profile/';
    }

    return value;
  };

  const nextPath = resolveNextPath(requestedNext);

  let turnstileToken = null;

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

      // Ensure users can see the full form, including actions near the bottom.
      requestAnimationFrame(() => {
        requestForm.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
      });
    });
  }

  if (requestCancel && requestForm && requestToggle) {
    requestCancel.addEventListener('click', () => {
      requestForm.hidden = true;
      requestToggle.hidden = false;
      requestStatus.hidden = true;
      requestStatus.textContent = '';
      requestForm.reset();
      turnstileToken = null;
    });
  }

  if (requestForm && requestSubmit && requestStatus) {
    requestForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      requestSubmit.disabled = true;
      requestStatus.hidden = true;
      requestStatus.textContent = '';

      const name = requestNameInput?.value?.trim() || '';
      const email = requestEmailInput?.value?.trim() || '';

      try {
        const body = { name, email };
        if (turnstileToken) {
          body.turnstileToken = turnstileToken;
        }
        await fetch('/api/access-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        requestForm.hidden = true;
        if (requestToggle) requestToggle.hidden = false;
        requestStatus.textContent = 'Your request has been received. The organiser will be in touch.';
        requestStatus.hidden = false;
      } catch {
        requestStatus.textContent = 'Unable to send your request. Please try again later.';
        requestStatus.hidden = false;
      } finally {
        requestSubmit.disabled = false;
        turnstileToken = null;
      }
    });
  }

  const setStatus = (message) => {
    if (!status) {
      return;
    }

    if (!message) {
      status.hidden = true;
      status.textContent = '';
      return;
    }

    status.hidden = false;
    status.textContent = message;
  };

  const redirectAfterLogin = () => {
    window.location.replace(nextPath);
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
    setStatus('Local login form unavailable.');
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
    setStatus('Signing in...');

    try {
      const result = await auth?.devLogin?.(devEmail.value || '');
      const email = result?.email || devEmail.value || '';
      auth?.setStoredAuthEmail(email);
      redirectAfterLogin();
    } catch (error) {
      const message = error.message || 'Unable to sign in locally.';
      if (message.includes('403')) {
        setStatus('Local dev login is disabled for this host.');
      } else {
        setStatus(message);
      }
    } finally {
      setSubmitting(false);
    }
  });
})();
