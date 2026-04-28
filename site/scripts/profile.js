import { apiFetch } from './api-utils.js';
import { createStatusSetter } from './status-utils.js';

(() => {
  const status = document.getElementById('guest-profile-status');
  const list = document.getElementById('guest-profile-list');
  const guestName = document.getElementById('guest-name');
  const guestEmail = document.getElementById('guest-email');
  const guestRsvp = document.getElementById('guest-rsvp');
  const additionalGuests = document.getElementById('guest-additional-guests');
  const dietaryRequirements = document.getElementById('guest-dietary-requirements');
  const rsvpMessage = document.getElementById('guest-rsvp-message');
  const rsvpEditor = document.getElementById('guest-rsvp-editor');
  const additionalGuestsEditor = document.getElementById('guest-additional-guests-editor');
  const dietaryRequirementsEditor = document.getElementById('guest-dietary-requirements-editor');
  const rsvpMessageEditor = document.getElementById('guest-rsvp-message-editor');
  const actionButtons = Array.from(document.querySelectorAll('.profile-field-action'));

  let currentGuest = null;
  let savingField = null;
  let editingField = null;

  const fieldConfig = {
    rsvp: {
      valueEl: guestRsvp,
      editorEl: rsvpEditor,
      editorType: 'select',
      emptyLabel: 'Pending',
      label: 'RSVP',
    },
    additionalGuests: {
      valueEl: additionalGuests,
      editorEl: additionalGuestsEditor,
      editorType: 'number',
      emptyLabel: '0',
      label: 'Additional guests',
    },
    dietaryRequirements: {
      valueEl: dietaryRequirements,
      editorEl: dietaryRequirementsEditor,
      editorType: 'text',
      emptyLabel: 'None',
      label: 'Dietary requirements',
    },
    rsvpMessage: {
      valueEl: rsvpMessage,
      editorEl: rsvpMessageEditor,
      editorType: 'text',
      emptyLabel: 'None',
      label: 'RSVP message',
    },
  };

  if (
    !status ||
    !list ||
    !guestName ||
    !guestEmail ||
    !guestRsvp ||
    !additionalGuests ||
    !dietaryRequirements ||
    !rsvpMessage ||
    !rsvpEditor ||
    !additionalGuestsEditor ||
    !dietaryRequirementsEditor ||
    !rsvpMessageEditor ||
    actionButtons.length === 0
  ) {
    return;
  }

  const setFieldActionState = () => {
    actionButtons.forEach((button) => {
      const field = button.dataset.action;
      const isCurrentField = field === editingField;
      const isSavingCurrentField = field === savingField;

      button.disabled = savingField !== null;
      button.textContent = isSavingCurrentField ? '…' : isCurrentField ? '✓' : '✎';

      if (isSavingCurrentField) {
        button.setAttribute('aria-label', `Saving ${fieldConfig[field]?.label || 'field'}`);
      } else if (isCurrentField) {
        button.setAttribute('aria-label', `Save ${fieldConfig[field]?.label || 'field'}`);
      } else {
        button.setAttribute('aria-label', `Edit ${fieldConfig[field]?.label || 'field'}`);
      }
    });
  };

  const toDisplayRsvp = (value) => {
    if (!value) return 'Pending';
    if (value === 'yes') return 'Yes';
    if (value === 'no') return 'No';
    return 'Pending';
  };

  const toDisplayValue = (field, value) => {
    if (field === 'rsvp') {
      return toDisplayRsvp(value);
    }

    if (field === 'additionalGuests') {
      return String(value ?? 0);
    }

    return value && String(value).trim() ? String(value) : fieldConfig[field].emptyLabel;
  };

  const syncEditorValues = (guest) => {
    rsvpEditor.value = guest.rsvp || 'pending';
    additionalGuestsEditor.value = String(guest.additionalGuests ?? 0);
    dietaryRequirementsEditor.value = guest.dietaryRequirements || '';
    rsvpMessageEditor.value = guest.rsvpMessage || '';
  };

  const setEditingField = (field) => {
    editingField = field;

    Object.entries(fieldConfig).forEach(([key, config]) => {
      const isEditing = key === editingField;

      config.valueEl.hidden = isEditing;
      config.editorEl.hidden = !isEditing;
    });

    setFieldActionState();

    if (editingField && fieldConfig[editingField]) {
      fieldConfig[editingField].editorEl.focus();
    }
  };

  const setSavingField = (field) => {
    savingField = field;
    setFieldActionState();
  };

  const getFieldValueFromEditor = (field) => {
    const config = fieldConfig[field];
    if (!config) return null;

    if (config.editorType === 'number') {
      return Number.parseInt(config.editorEl.value, 10) || 0;
    }

    return config.editorEl.value;
  };

  const buildUpdatePayload = (field) => ({
    rsvp: field === 'rsvp' ? getFieldValueFromEditor('rsvp') : (currentGuest?.rsvp || 'pending'),
    additionalGuests:
      field === 'additionalGuests'
        ? getFieldValueFromEditor('additionalGuests')
        : (currentGuest?.additionalGuests ?? 0),
    dietaryRequirements:
      field === 'dietaryRequirements'
        ? getFieldValueFromEditor('dietaryRequirements')
        : (currentGuest?.dietaryRequirements || ''),
    rsvpMessage:
      field === 'rsvpMessage'
        ? getFieldValueFromEditor('rsvpMessage')
        : (currentGuest?.rsvpMessage || ''),
  });

  const setStatus = createStatusSetter(status, { hideWhenEmpty: false });

  const renderGuest = (guest) => {
    guestName.textContent = guest.name || 'Not set';
    guestEmail.textContent = guest.email || 'Not set';
    guestRsvp.textContent = toDisplayValue('rsvp', guest.rsvp);
    additionalGuests.textContent = toDisplayValue('additionalGuests', guest.additionalGuests);
    dietaryRequirements.textContent = toDisplayValue('dietaryRequirements', guest.dietaryRequirements);
    rsvpMessage.textContent = toDisplayValue('rsvpMessage', guest.rsvpMessage);

    syncEditorValues(guest);
  };

  const showError = (message) => {
    setStatus(message, 'failure');
    list.hidden = true;
  };

  const fetchGuest = async () => {
    const data = await (await apiFetch('/api/private/guests/me')).json();
    const guest = data?.guest;

    if (!guest) {
      throw new Error('Unable to find your guest profile.');
    }

    return guest;
  };

  const recordVisit = async () => {
    try {
      await apiFetch('/api/private/guests/record-visit', { method: 'POST' });
    } catch (error) {
      // Silently fail - visit tracking is best-effort
      console.error('Failed to record visit:', error);
    }
  };

  const saveGuest = async (payload) => {
    const data = await (await apiFetch('/api/private/guests/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })).json();

    const guest = data?.guest;

    if (!guest) {
      throw new Error('Profile was saved but no profile data was returned.');
    }

    return guest;
  };

  const saveField = async (field) => {
    if (!fieldConfig[field] || savingField || !currentGuest) {
      return;
    }

    const payload = buildUpdatePayload(field);

    setStatus(`Saving ${fieldConfig[field].label.toLowerCase()}...`, 'warning');
    setSavingField(field);

    try {
      const guest = await saveGuest(payload);
      currentGuest = guest;
      renderGuest(guest);
      setEditingField(null);
      setStatus(`${fieldConfig[field].label} updated.`, 'success');
    } catch (error) {
      setStatus(error.message, 'failure');
    } finally {
      setSavingField(null);
    }
  };

  actionButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const field = button.dataset.action;

      if (!field || !fieldConfig[field]) {
        return;
      }

      if (savingField) {
        return;
      }

      if (editingField !== field) {
        setEditingField(field);
        return;
      }

      await saveField(field);
    });
  });

  Object.entries(fieldConfig).forEach(([field, config]) => {
    config.editorEl.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        syncEditorValues(currentGuest || {});
        setEditingField(null);
      }

      if (event.key === 'Enter' && config.editorEl.tagName !== 'TEXTAREA') {
        event.preventDefault();
        await saveField(field);
      }
    });
  });

  fetchGuest()
    .then((guest) => {
      currentGuest = guest;
      renderGuest(guest);

      if (guest.email) {
        window.WallabyAuth?.setStoredAuthEmail(guest.email);
      }

      recordVisit();

      list.hidden = false;
      setEditingField(null);
      setStatus('');
    })
    .catch((error) => {
      showError(error.message);
    });
})();
