(() => {
  window.WallabyAuth?.fetchAuthEmail().then((email) => {
    if (!email) {
      return;
    }

    window.WallabyAuth?.setStoredAuthEmail(email);

    window.location.replace('/profile/');
  });
})();
