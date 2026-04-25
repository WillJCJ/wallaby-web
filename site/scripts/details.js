import { apiFetch } from '/scripts/api-utils.js';

(() => {
  const section = document.getElementById('private-details');
  const status = document.getElementById('private-status');
  const list = document.getElementById('private-list');
  const address = document.getElementById('private-address');
  const gateCode = document.getElementById('private-gate-code');
  const auth = window.WallabyAuth;

  if (!section || !status || !list || !address || !gateCode) {
    return;
  }

  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  const setSectionVisible = (visible) => {
    section.hidden = !visible;
  };

  const showError = (message) => {
    setSectionVisible(true);
    status.textContent = message;
    list.hidden = true;
  };

  const loadDetails = () => apiFetch('/api/private/details')
    .then((response) => response.json())
    .then((data) => {
      setSectionVisible(true);
      address.textContent = data.address || 'Not configured';
      gateCode.textContent = data.gateCode || 'Not configured';

      if (data.viewer) {
        auth?.setStoredAuthEmail(data.viewer);
      }

      list.hidden = false;
      status.textContent = '';
    })
    .catch((error) => {
      showError(error.message || 'Unable to load travel details.');
    });

  const loadWhenAuthenticated = async () => {
    if (isLocalHost) {
      const devState = await auth?.devStatus?.().catch(() => null);
      if (!devState?.email) {
        setSectionVisible(false);
        return;
      }

      auth?.setStoredAuthEmail(devState.email);
      await loadDetails();
      return;
    }

    const email = await auth?.fetchAuthEmail?.().catch(() => null);
    if (!email) {
      setSectionVisible(false);
      return;
    }

    auth?.setStoredAuthEmail(email);
    await loadDetails();
  };

  loadWhenAuthenticated();
})();
