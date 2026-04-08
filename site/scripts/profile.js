(() => {
  const AUTH_EMAIL_STORAGE_KEY = 'wallabyfest-auth-email';
  const status = document.getElementById('guest-profile-status');
  const list = document.getElementById('guest-profile-list');
  const form = document.getElementById('guest-profile-form');
  const guestName = document.getElementById('guest-name');
  const guestEmail = document.getElementById('guest-email');
  const guestRsvp = document.getElementById('guest-rsvp');
  const additionalGuests = document.getElementById('guest-additional-guests');
  const dietaryRequirements = document.getElementById('guest-dietary-requirements');
  const rsvpMessage = document.getElementById('guest-rsvp-message');
  const formRsvp = document.getElementById('guest-profile-rsvp');
  const formAdditionalGuests = document.getElementById('guest-profile-additional-guests');
  const formDietaryRequirements = document.getElementById('guest-profile-dietary');
  const formRsvpMessage = document.getElementById('guest-profile-rsvp-message');
  const saveButton = form.querySelector('button[type="submit"]');

  let isSaving = false;
  let initialFormData = '';

  if (
    !status ||
    !list ||
    !form ||
    !guestName ||
    !guestEmail ||
    !guestRsvp ||
    !additionalGuests ||
    !dietaryRequirements ||
    !rsvpMessage ||
    !formRsvp ||
    !formAdditionalGuests ||
    !formDietaryRequirements ||
    !formRsvpMessage ||
    !saveButton
  ) {
    return;
  }

  const getFormDataSnapshot = () => JSON.stringify({
    rsvp: formRsvp.value,
    additionalGuests: Number.parseInt(formAdditionalGuests.value, 10) || 0,
    dietaryRequirements: formDietaryRequirements.value,
    rsvpMessage: formRsvpMessage.value,
  });

  const hasUnsavedChanges = () => initialFormData !== '' && getFormDataSnapshot() !== initialFormData;

  const handleBeforeUnload = (event) => {
    if (!hasUnsavedChanges()) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  };

  const setSaveButtonState = (saving) => {
    isSaving = saving;
    saveButton.disabled = saving;
    saveButton.textContent = saving ? 'Saving...' : 'Save RSVP';
  };

  const renderGuest = (guest) => {
    guestName.textContent = guest.name || 'Not set';
    guestEmail.textContent = guest.email || 'Not set';
    guestRsvp.textContent = guest.rsvp || 'pending';
    additionalGuests.textContent = String(guest.additionalGuests ?? 0);
    dietaryRequirements.textContent = guest.dietaryRequirements || 'None';
    rsvpMessage.textContent = guest.rsvpMessage || 'None';
  };

  const fillForm = (guest) => {
    formRsvp.value = guest.rsvp || 'pending';
    formAdditionalGuests.value = String(guest.additionalGuests ?? 0);
    formDietaryRequirements.value = guest.dietaryRequirements || '';
    formRsvpMessage.value = guest.rsvpMessage || '';
    initialFormData = getFormDataSnapshot();
  };

  const showError = (message) => {
    status.textContent = message;
    list.hidden = true;
    form.hidden = true;
  };

  const fetchGuest = async () => {
    const response = await fetch('/api/private/guests/me', {
      method: 'GET',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to load your guest profile right now.');
    }

    const data = await response.json();
    const guest = data?.guest;

    if (!guest) {
      throw new Error('Unable to find your guest profile.');
    }

    return guest;
  };

  const saveGuest = async () => {
    const response = await fetch('/api/private/guests/me', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        rsvp: formRsvp.value,
        additionalGuests: Number.parseInt(formAdditionalGuests.value, 10) || 0,
        dietaryRequirements: formDietaryRequirements.value,
        rsvpMessage: formRsvpMessage.value,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to save your profile right now.');
    }

    const data = await response.json();
    const guest = data?.guest;

    if (!guest) {
      throw new Error('Profile was saved but no profile data was returned.');
    }

    return guest;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    status.textContent = 'Saving profile...';
    setSaveButtonState(true);

    try {
      const guest = await saveGuest();
      renderGuest(guest);
      fillForm(guest);
      status.textContent = 'Profile updated.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setSaveButtonState(false);
    }
  });

  form.addEventListener('input', () => {
    if (isSaving) {
      return;
    }

    if (hasUnsavedChanges()) {
      status.textContent = 'You have unsaved changes.';
    }
  });

  window.addEventListener('beforeunload', handleBeforeUnload);

  fetchGuest()
    .then((guest) => {
      renderGuest(guest);
      fillForm(guest);

      try {
        if (guest.email) {
          window.localStorage.setItem(AUTH_EMAIL_STORAGE_KEY, guest.email);
        }
      } catch {
        // Ignore storage access failures.
      }

      list.hidden = false;
      form.hidden = false;
      setSaveButtonState(false);
      status.textContent = 'Authenticated. Profile loaded.';
    })
    .catch((error) => {
      showError(error.message);
    });
})();
