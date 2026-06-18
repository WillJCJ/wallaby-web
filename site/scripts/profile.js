import { apiFetch } from './utils/api.js';
import { setStoredAuthEmail } from './shared/auth-state.js';
import { createStatusSetter } from './utils/status.js';

// eslint-disable-next-line complexity -- Profile IIFE wires many independent DOM sections; splitting would obscure shared state.
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
  let queuedSaveField = null;
  const AUTO_SAVE_DELAY_MS = 600;
  const saveTimers = new Map();

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

  const getFieldConfig = (field) => {
    if (field === 'rsvp') {return fieldConfig.rsvp;}
    if (field === 'additionalGuests') {return fieldConfig.additionalGuests;}
    if (field === 'dietaryRequirements') {return fieldConfig.dietaryRequirements;}
    if (field === 'rsvpMessage') {return fieldConfig.rsvpMessage;}
    return null;
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
      button.textContent = isSavingCurrentField ? '…' : '✎';

      const config = getFieldConfig(field);
      const fieldLabel = config?.label || 'field';

      if (isSavingCurrentField) {
        button.setAttribute('aria-label', `Saving ${fieldLabel}`);
      } else if (isCurrentField) {
        button.setAttribute('aria-label', `Editing ${fieldLabel}. Changes save automatically.`);
      } else {
        button.setAttribute('aria-label', `Edit ${fieldLabel} (saves automatically)`);
      }
    });
  };

  const toDisplayRsvp = (value) => {
    if (!value) {return 'Pending';}
    if (value === 'yes') {return 'Yes';}
    if (value === 'no') {return 'No';}
    return 'Pending';
  };

  const toDisplayValue = (field, value) => {
    if (field === 'rsvp') {
      return toDisplayRsvp(value);
    }

    if (field === 'additionalGuests') {
      return String(value ?? 0);
    }

    const config = getFieldConfig(field);
    return value && String(value).trim() ? String(value) : (config?.emptyLabel || '');
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

    const currentConfig = getFieldConfig(editingField);
    if (editingField && currentConfig) {
      currentConfig.editorEl.focus();
    }
  };

  const clearSaveTimer = (field) => {
    const timeoutId = saveTimers.get(field);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      saveTimers.delete(field);
    }
  };

  const clearAllSaveTimers = () => {
    saveTimers.forEach((timeoutId) => window.clearTimeout(timeoutId));
    saveTimers.clear();
  };

  const setSavingField = (field) => {
    savingField = field;
    setFieldActionState();
  };

  const getFieldValueFromEditor = (field) => {
    const config = getFieldConfig(field);
    if (!config) {return null;}

    if (config.editorType === 'number') {
      return Number.parseInt(config.editorEl.value, 10) || 0;
    }

    return config.editorEl.value;
  };

  const normalizeFieldValue = (field, value) => {
    if (field === 'additionalGuests') {
      return Number.parseInt(String(value ?? 0), 10) || 0;
    }

    if (field === 'rsvp') {
      return value || 'pending';
    }

    return value ?? '';
  };

  const hasFieldChanged = (field) => {
    if (!currentGuest) {
      return false;
    }

    const getCurrentGuestFieldValue = () => {
      if (field === 'rsvp') {
        return currentGuest.rsvp;
      }

      if (field === 'additionalGuests') {
        return currentGuest.additionalGuests;
      }

      if (field === 'dietaryRequirements') {
        return currentGuest.dietaryRequirements;
      }

      if (field === 'rsvpMessage') {
        return currentGuest.rsvpMessage;
      }

      return null;
    };

    const currentValue = normalizeFieldValue(field, getCurrentGuestFieldValue());
    const editedValue = normalizeFieldValue(field, getFieldValueFromEditor(field));
    return currentValue !== editedValue;
  };

  // eslint-disable-next-line complexity -- Payload builder covers all editable fields with fallback logic per field type.
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
    const config = getFieldConfig(field);
    if (!config || savingField || !currentGuest) {
      return;
    }

    clearSaveTimer(field);

    if (!hasFieldChanged(field)) {
      return;
    }

    const payload = buildUpdatePayload(field);

    setStatus(`Saving ${config.label.toLowerCase()}...`, 'warning');
    setSavingField(field);

    try {
      const guest = await saveGuest(payload);
      currentGuest = guest;
      renderGuest(guest);
      setStatus(`${config.label} updated.`, 'success');
    } catch (error) {
      setStatus(error.message, 'failure');
    } finally {
      setSavingField(null);

      if (queuedSaveField === field) {
        queuedSaveField = null;
        if (hasFieldChanged(field)) {
          void saveField(field);
        }
      }
    }
  };

  const scheduleFieldSave = (field) => {
    if (field !== editingField) {
      return;
    }

    clearSaveTimer(field);
    const timeoutId = window.setTimeout(() => {
      if (savingField === field) {
        queuedSaveField = field;
        return;
      }

      void saveField(field);
    }, AUTO_SAVE_DELAY_MS);

    saveTimers.set(field, timeoutId);
  };

  const revertCurrentEdit = (field) => {
    if (!currentGuest) {
      return;
    }

    clearSaveTimer(field);
    syncEditorValues(currentGuest);
    setEditingField(null);
    setStatus(`${getFieldConfig(field)?.label || 'Field'} unchanged.`, 'warning');
  };

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.action;
      const config = getFieldConfig(field);

      if (!field || !config) {
        return;
      }

      if (savingField) {
        return;
      }

      if (editingField !== field) {
        clearAllSaveTimers();
        setEditingField(field);
        setStatus(`${config.label} will save automatically.`, 'warning');
        return;
      }

      revertCurrentEdit(field);
    });
  });

  Object.entries(fieldConfig).forEach(([field, config]) => {
    const saveOnInteraction = () => {
      if (editingField !== field) {
        return;
      }

      if (savingField === field) {
        queuedSaveField = field;
        return;
      }

      void saveField(field);
    };

    config.editorEl.addEventListener('input', () => {
      if (config.editorType === 'select') {
        saveOnInteraction();
        return;
      }

      scheduleFieldSave(field);
    });

    config.editorEl.addEventListener('change', saveOnInteraction);

    config.editorEl.addEventListener('blur', saveOnInteraction);

    config.editorEl.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        revertCurrentEdit(field);
      }

      if (event.key === 'Enter' && config.editorEl.tagName !== 'TEXTAREA') {
        event.preventDefault();
        saveOnInteraction();
      }
    });
  });

  fetchGuest()
    .then((guest) => {
      currentGuest = guest;
      renderGuest(guest);

      if (guest.email) {
        setStoredAuthEmail(guest.email);
      }

      recordVisit();

      list.hidden = false;
      clearAllSaveTimers();
      setEditingField(null);
      setStatus('');
    })
    .catch((error) => {
      showError(error.message);
    });
})();
