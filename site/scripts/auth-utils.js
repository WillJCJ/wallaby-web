(() => {
  const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';

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
        return;
      }

      window.localStorage.removeItem(AUTH_EMAIL_STORAGE_KEY);
    } catch {
      // Ignore storage access failures.
    }
  };

  const fetchAuthEmail = async () => {
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
      const email = data?.email || null;
      return typeof email === 'string' && email ? email : null;
    } catch {
      return null;
    }
  };

  const devStatus = async () => {
    const response = await fetch('/api/dev-auth/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return { enabled: false, email: null };
    }

    const data = await response.json().catch(() => null);
    return {
      enabled: Boolean(data?.enabled),
      email: typeof data?.email === 'string' && data.email ? data.email : null,
    };
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
    getStoredAuthEmail,
    setStoredAuthEmail,
    fetchAuthEmail,
    devStatus,
    devLogin,
    devLogout,
  };
})();
