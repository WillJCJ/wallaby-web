(() => {
  const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';
  const status = document.getElementById('guest-profile-status');
  const list = document.getElementById('guest-profile-list');
  const guestName = document.getElementById('guest-name');
  const guestEmail = document.getElementById('guest-email');
  const guestRsvp = document.getElementById('guest-rsvp');
  const additionalGuests = document.getElementById('guest-additional-guests');
  const dietaryRequirements = document.getElementById('guest-dietary-requirements');
  const rsvpMessage = document.getElementById('guest-rsvp-message');

  if (
    !status ||
    !list ||
    !guestName ||
    !guestEmail ||
    !guestRsvp ||
    !additionalGuests ||
    !dietaryRequirements ||
    !rsvpMessage
  ) {
    return;
  }

  const showError = (message) => {
    status.textContent = message;
    list.hidden = true;
  };

  fetch('/api/private/guests/me', {
    method: 'GET',
    credentials: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to load your guest profile right now.');
      }

      return response.json();
    })
    .then((data) => {
      const guest = data?.guest;

      if (!guest) {
        throw new Error('Unable to find your guest profile.');
      }

      guestName.textContent = guest.name || 'Not set';
      guestEmail.textContent = guest.email || 'Not set';
      guestRsvp.textContent = guest.rsvp || 'pending';
      additionalGuests.textContent = String(guest.additionalGuests ?? 0);
      dietaryRequirements.textContent = guest.dietaryRequirements || 'None';
      rsvpMessage.textContent = guest.rsvpMessage || 'None';

      try {
        if (guest.email) {
          window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, guest.email);
        }
      } catch {
        // Ignore storage access failures.
      }

      list.hidden = false;
      status.textContent = 'Authenticated. Profile loaded.';
    })
    .catch((error) => {
      showError(error.message);
    });
})();
