(() => {
  const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';
  const AUTH_STATE_CHANGE_EVENT = 'wallabyauth:statechange';

  const notifyAuthStateChange = (email) => {
    try {
      window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT, {
        detail: { email: email || null },
      }));
    } catch {
      // Ignore event dispatch failures.
    }
  };

  const getStoredAuthEmail = () => {
    try {
      return window.localStorage.getItem(AUTH_EMAIL_STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const setStoredAuthEmail = (email) => {
    try {
      if (email) {
        window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, email);
      } else {
        window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access failures.
    }

    notifyAuthStateChange(email);
  };

  const fetchSignedIn = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json().catch(() => null);
      return data?.signedIn ? true : null;
    } catch {
      return null;
    }
  };

  const devLogin = async (email) => {
    const response = await fetch('/api/dev-auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Login failed (${response.status})`);
    }

    return response.json();
  };

  const devLogout = async () => {
    const response = await fetch('/api/dev-auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Logout failed (${response.status})`);
    }

    return response.json();
  };

  window.WallabyAuth = {
    AUTH_EMAIL_STORAGE_KEY,
    AUTH_STATE_CHANGE_EVENT,
    getStoredAuthEmail,
    setStoredAuthEmail,
    fetchSignedIn,
    devLogin,
    devLogout,
  };
})();
