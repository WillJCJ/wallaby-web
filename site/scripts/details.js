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

  const init = async () => {
    if (typeof auth?.fetchSignedIn === 'function') {
      const signedIn = await auth.fetchSignedIn();
      if (signedIn !== true) {
        setSectionVisible(false);
        return;
      }
    }

    loadDetails();
  };

  init();
})();
