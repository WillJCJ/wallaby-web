const setSignedOutNav = (profileLink, logoutLink, loginLink) => {
  profileLink.hidden = true;
  logoutLink.hidden = true;
  loginLink.hidden = false;
};

const setSignedInNav = (profileLink, logoutLink, loginLink) => {
  profileLink.hidden = false;
  logoutLink.hidden = false;
  loginLink.hidden = true;
};

const isLocalHost = () => ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const applyAuthNavState = (authNavElements, email) => {
  if (!authNavElements) {
    return;
  }

  const { profileLink, logoutLink, loginLink } = authNavElements;

  if (email) {
    setSignedInNav(profileLink, logoutLink, loginLink);
    return;
  }

  setSignedOutNav(profileLink, logoutLink, loginLink);
};

const setupLogout = (logoutLink, auth, setStoredAuthEmail, flashStorageKey) => {
  if (!logoutLink) {
    return;
  }

  if (isLocalHost()) {
    logoutLink.href = '#';
    logoutLink.addEventListener('click', async (event) => {
      event.preventDefault();

      try {
        await auth?.devLogout?.();
      } catch {
        // Ignore logout failures and still clear local state.
      }

      setStoredAuthEmail(null);
      try {
        window.sessionStorage.setItem(flashStorageKey, 'logout-success');
      } catch {
        // Ignore sessionStorage access failures.
      }

      window.location.replace('/');
    });

    return;
  }

  const logoutUrl = new URL('/cdn-cgi/access/logout', window.location.origin);
  logoutUrl.searchParams.set('returnTo', `${window.location.origin}/`);
  logoutLink.href = logoutUrl.toString();

  logoutLink.addEventListener('click', () => {
    setStoredAuthEmail(null);
    try {
      window.sessionStorage.setItem(flashStorageKey, 'logout-success');
    } catch {
      // Ignore sessionStorage access failures.
    }
  });
};

export const initializeAuthNav = async ({
  auth,
  getStoredAuthEmail,
  setStoredAuthEmail,
  fetchSignedIn,
  authStateChangeEvent,
  flashStorageKey,
}) => {
  const profileLink = document.getElementById('nav-profile-link');
  const logoutLink = document.getElementById('nav-logout-link');
  const loginLink = document.getElementById('nav-login-link');

  if (!profileLink || !logoutLink || !loginLink) {
    return;
  }

  const authNavElements = { profileLink, logoutLink, loginLink };

  setupLogout(logoutLink, auth, setStoredAuthEmail, flashStorageKey);

  const storedEmail = getStoredAuthEmail();
  applyAuthNavState(authNavElements, storedEmail);

  const isSignedIn = await fetchSignedIn();

  if (isSignedIn) {
    setStoredAuthEmail(storedEmail || 'authenticated');
  } else if (storedEmail) {
    applyAuthNavState(authNavElements, storedEmail);
  } else {
    setStoredAuthEmail(null);
  }

  window.addEventListener(authStateChangeEvent, (event) => {
    applyAuthNavState(authNavElements, event.detail?.email || null);
  });
};
