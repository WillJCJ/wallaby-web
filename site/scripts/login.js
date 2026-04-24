(() => {
  const auth = window.WallabyAuth;
  const status = document.getElementById('login-status');
  const cfLoginLink = document.getElementById('cf-login-link');
  const devForm = document.getElementById('dev-auth-form');
  const devEmail = document.getElementById('dev-auth-email');
  const devSubmit = document.getElementById('dev-auth-submit');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

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

  const redirectToProfile = () => {
    window.location.replace('/profile/');
  };

  if (!isLocalHost) {
    auth?.fetchAuthEmail().then((email) => {
      if (!email) {
        return;
      }

      auth?.setStoredAuthEmail(email);
      redirectToProfile();
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

  const setSubmitting = (submitting) => {
    devSubmit.disabled = submitting;
    devSubmit.textContent = submitting ? 'Signing in...' : 'Sign in locally';
  };

  auth?.devStatus?.()
    .then((state) => {
      if (!state?.enabled) {
        setStatus('Local dev login is disabled. Enable DEV_AUTH_ENABLED for localhost testing.');
        return;
      }

      devForm.hidden = false;
      if (state.email) {
        auth?.setStoredAuthEmail(state.email);
        redirectToProfile();
      }
    })
    .catch(() => {
      setStatus('Unable to check local login status.');
    });

  devForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('Signing in...');

    try {
      const result = await auth?.devLogin?.(devEmail.value || '');
      const email = result?.email || devEmail.value || '';
      auth?.setStoredAuthEmail(email);
      redirectToProfile();
    } catch (error) {
      setStatus(error.message || 'Unable to sign in locally.');
    } finally {
      setSubmitting(false);
    }
  });
})();
