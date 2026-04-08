(() => {
  const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';

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

  fetchAuthEmail().then((email) => {
    if (!email) {
      return;
    }

    try {
      window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, email);
    } catch {
      // Ignore storage access failures.
    }

    window.location.replace('/profile/');
  });
})();
