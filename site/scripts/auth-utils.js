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
      const response = await fetch('/cdn-cgi/access/get-identity', {
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json().catch(() => null);
      const email = data?.email || data?.user_email || data?.identity?.email || null;
      return typeof email === 'string' && email ? email : null;
    } catch {
      return null;
    }
  };

  window.WallabyAuth = {
    AUTH_EMAIL_STORAGE_KEY,
    getStoredAuthEmail,
    setStoredAuthEmail,
    fetchAuthEmail,
  };
})();
