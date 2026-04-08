(() => {
  const auth = window.WallabyAuth;
  const fetchAuthEmail = auth?.fetchAuthEmail || (async () => null);
  const setStoredAuthEmail = auth?.setStoredAuthEmail || (() => {});

  fetchAuthEmail().then((email) => {
    if (!email) {
      return;
    }

    setStoredAuthEmail(email);

    window.location.replace('/profile/');
  });
})();
