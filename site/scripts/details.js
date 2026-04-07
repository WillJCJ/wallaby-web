(() => {
  const status = document.getElementById('private-status');
  const list = document.getElementById('private-list');
  const address = document.getElementById('private-address');
  const gateCode = document.getElementById('private-gate-code');
  const notes = document.getElementById('private-notes');

  if (!status || !list || !address || !gateCode || !notes) {
    return;
  }

  const showError = (message) => {
    status.textContent = message;
    list.hidden = true;
  };

  fetch('/api/private/details', {
    method: 'GET',
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to load private details right now.');
      }

      return response.json();
    })
    .then((data) => {
      address.textContent = data.address || 'Not configured';
      gateCode.textContent = data.gateCode || 'Not configured';
      notes.textContent = data.arrivalNotes || 'No extra notes.';

      list.hidden = false;
      status.textContent = 'Authenticated. Private details loaded.';
    })
    .catch((error) => {
      showError(error.message);
    });
})();
