(() => {
  const status = document.getElementById('guest-admin-status');
  const form = document.getElementById('guest-admin-form');
  const submitButton = document.getElementById('guest-admin-submit');
  const guestsList = document.getElementById('admin-guests-list');

  if (!status || !form || !submitButton || !guestsList) {
    return;
  }

  const fields = {
    name: document.getElementById('admin-guest-name'),
    email: document.getElementById('admin-guest-email'),
    rsvp: document.getElementById('admin-guest-rsvp'),
    additionalGuests: document.getElementById('admin-guest-additional-guests'),
    dietaryRequirements: document.getElementById('admin-guest-dietary'),
    rsvpMessage: document.getElementById('admin-guest-rsvp-message'),
  };

  if (Object.values(fields).some((el) => !el)) {
    return;
  }

  let isSubmitting = false;

  const setSubmittingState = (submitting) => {
    isSubmitting = submitting;
    submitButton.disabled = submitting;
    submitButton.textContent = submitting ? 'Adding...' : 'Add guest';
  };

  const formatGuestCard = (guest) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'admin-guest-card';

    const name = document.createElement('h3');
    name.textContent = guest.name || 'Unnamed guest';

    const meta = document.createElement('p');
    meta.className = 'admin-guest-meta';
    meta.textContent = `${guest.email || 'No email'} | RSVP: ${guest.rsvp || 'pending'}`;

    const details = document.createElement('p');
    details.className = 'admin-guest-meta';
    const extra = Number.parseInt(guest.additionalGuests, 10) || 0;
    const dietary = guest.dietaryRequirements || 'None';
    details.textContent = `Additional guests: ${extra} | Dietary: ${dietary}`;

    const message = document.createElement('p');
    message.className = 'admin-guest-meta';
    message.textContent = `RSVP message: ${guest.rsvpMessage || 'None'}`;

    wrapper.appendChild(name);
    wrapper.appendChild(meta);
    wrapper.appendChild(details);
    wrapper.appendChild(message);

    return wrapper;
  };

  const renderGuests = (guests) => {
    guestsList.innerHTML = '';

    if (!Array.isArray(guests) || guests.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'admin-guest-empty';
      empty.textContent = 'No guests found.';
      guestsList.appendChild(empty);
      guestsList.hidden = false;
      return;
    }

    guests.forEach((guest) => {
      guestsList.appendChild(formatGuestCard(guest));
    });

    guestsList.hidden = false;
  };

  const fetchGuests = async () => {
    const response = await fetch('/api/private/guests', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to load guests right now.');
    }

    const data = await response.json();
    return Array.isArray(data?.guests) ? data.guests : [];
  };

  const addGuest = async () => {
    const response = await fetch('/api/private/guests', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        rsvp: fields.rsvp.value,
        additionalGuests: Number.parseInt(fields.additionalGuests.value, 10) || 0,
        dietaryRequirements: fields.dietaryRequirements.value.trim(),
        rsvpMessage: fields.rsvpMessage.value.trim(),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to add guest right now.');
    }

    return response.json();
  };

  const resetForm = () => {
    form.reset();
    fields.rsvp.value = 'pending';
    fields.additionalGuests.value = '0';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmittingState(true);
    status.textContent = 'Adding guest...';

    try {
      await addGuest();
      resetForm();
      const guests = await fetchGuests();
      renderGuests(guests);
      status.textContent = `Loaded ${guests.length} guest${guests.length === 1 ? '' : 's'}.`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setSubmittingState(false);
    }
  });

  fetchGuests()
    .then((guests) => {
      renderGuests(guests);
      form.hidden = false;
      status.textContent = `Loaded ${guests.length} guest${guests.length === 1 ? '' : 's'}.`;
    })
    .catch((error) => {
      guestsList.hidden = true;
      form.hidden = true;
      status.textContent = error.message;
    });
})();
