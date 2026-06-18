import { apiFetch } from '../../utils/api.js';
import { deleteGuest, fetchGuestLastSeen, sendGuestInvitation, setGuestAccess } from './api.js';
import { getRowElements } from './elements.js';
import { formatAdminDateTime, normalizeAccessEnabled } from './format.js';

export const createGuestTableRenderer = ({
  guestRowTemplate,
  isLastSeenDebugEnabled,
  setStatus,
  onRefreshNeeded,
  onGuestUpdated,
  guestsTableBody,
  guestsEmpty,
  guestsTableWrap,
  guestsSyncHeader,
  guestsList,
}) => {
  const guestActionInFlight = new Set();

  const withGuestAction = async (guestId, action) => {
    if (guestActionInFlight.has(guestId)) {
      return null;
    }

    guestActionInFlight.add(guestId);

    try {
      return await action();
    } finally {
      guestActionInFlight.delete(guestId);
    }
  };

  // eslint-disable-next-line complexity -- Rendering/edit wiring for one row intentionally keeps all linked controls co-located.
  const createGuestRows = (guest, allInSync = false, syncActionInProgress = false) => {
    const isAccessEnabled = normalizeAccessEnabled(guest.accessEnabled);
    const fragment = guestRowTemplate.content.cloneNode(true);
    const rowElements = getRowElements(fragment);

    if (!rowElements) {
      return document.createDocumentFragment();
    }

    const {
      row,
      detailRow,
      detailCell,
      viewSection,
      emailValue,
      dietaryValue,
      rsvpMessageValue,
      lastSeenValue,
      guestIdInline,
      inviteDebugItem,
      editButton,
      deleteButton,
      editSection,
      editName,
      editEmail,
      editRsvp,
      editAdditional,
      editDietary,
      editRsvpMessage,
      cancelEditButton,
      nameCell,
      rsvpCell,
      countCell,
      accessStateIcon,
      toggleAccessButton,
      syncCell,
      syncOkIcon,
      syncWarning,
      syncTrigger,
      syncTooltip,
      viewActions,
    } = rowElements;

    const AUTO_SAVE_DELAY_MS = 700;
    const editFields = [editName, editEmail, editRsvp, editAdditional, editDietary, editRsvpMessage];
    let autoSaveTimeoutId = null;
    let saveInFlight = false;
    let pendingSave = false;
    let guestRecord = { ...guest };

    const normalizeDraftValue = (field, value) => {
      if (field === 'additionalGuests') {
        return Number.parseInt(String(value ?? 0), 10) || 0;
      }

      return (value ?? '').toString().trim();
    };

    const getDraftPayload = () => ({
      name: editName.value.trim(),
      email: editEmail.value.trim(),
      rsvp: editRsvp.value,
      additionalGuests: Number.parseInt(editAdditional.value, 10) || 0,
      dietaryRequirements: editDietary.value.trim(),
      rsvpMessage: editRsvpMessage.value.trim(),
    });

    const hasDraftChanges = () => {
      const draft = getDraftPayload();
      return (
        normalizeDraftValue('name', draft.name) !== normalizeDraftValue('name', guestRecord.name)
        || normalizeDraftValue('email', draft.email) !== normalizeDraftValue('email', guestRecord.email)
        || normalizeDraftValue('rsvp', draft.rsvp) !== normalizeDraftValue('rsvp', guestRecord.rsvp)
        || normalizeDraftValue('additionalGuests', draft.additionalGuests) !== normalizeDraftValue('additionalGuests', guestRecord.additionalGuests)
        || normalizeDraftValue('dietaryRequirements', draft.dietaryRequirements) !== normalizeDraftValue('dietaryRequirements', guestRecord.dietaryRequirements)
        || normalizeDraftValue('rsvpMessage', draft.rsvpMessage) !== normalizeDraftValue('rsvpMessage', guestRecord.rsvpMessage)
      );
    };

    const clearAutoSaveTimer = () => {
      if (!autoSaveTimeoutId) {
        return;
      }

      window.clearTimeout(autoSaveTimeoutId);
      autoSaveTimeoutId = null;
    };

    const syncEditFieldsFromGuest = () => {
      editName.value = guestRecord.name || '';
      editEmail.value = guestRecord.email || '';
      editRsvp.value = guestRecord.rsvp || 'pending';
      editAdditional.value = String(Number.parseInt(guestRecord.additionalGuests, 10) || 0);
      editDietary.value = guestRecord.dietaryRequirements || '';
      editRsvpMessage.value = guestRecord.rsvpMessage || '';
    };

    const applyGuestToView = () => {
      emailValue.textContent = guestRecord.email || '—';
      dietaryValue.textContent = guestRecord.dietaryRequirements || '—';
      rsvpMessageValue.textContent = guestRecord.rsvpMessage || '—';
      guestIdInline.textContent = `Guest ID: ${guestRecord.id || '—'}`;
      nameCell.textContent = guestRecord.name || 'Unnamed guest';
      rsvpCell.textContent = guestRecord.rsvp || 'pending';
      countCell.textContent = String(Number.parseInt(guestRecord.additionalGuests, 10) || 0);
      syncEditFieldsFromGuest();
    };

    const setEditFieldsDisabled = (disabled) => {
      editFields.forEach((field) => {
        field.disabled = disabled;
      });
      cancelEditButton.disabled = disabled;
    };

    row.style.cursor = 'pointer';
    detailCell.colSpan = allInSync ? 4 : 5;
    applyGuestToView();
    inviteDebugItem.hidden = !isLastSeenDebugEnabled;

    accessStateIcon.className = `admin-access-state ${isAccessEnabled ? 'admin-access-state--enabled' : 'admin-access-state--disabled'}`;
    accessStateIcon.textContent = isAccessEnabled ? '✓' : '✕';
    accessStateIcon.title = isAccessEnabled ? 'Access enabled' : 'Access disabled';
    accessStateIcon.setAttribute('aria-label', isAccessEnabled ? 'Access enabled' : 'Access disabled');
    toggleAccessButton.textContent = isAccessEnabled ? 'Disable' : 'Enable';
    toggleAccessButton.disabled = guestActionInFlight.has(guest.id) || syncActionInProgress;
    syncCell.hidden = allInSync;
    deleteButton.disabled = guestActionInFlight.has(guest.id) || syncActionInProgress;

    const sendInvitationButton = document.createElement('button');
    sendInvitationButton.type = 'button';
    sendInvitationButton.className = 'login-button admin-guest-edit-button';
    sendInvitationButton.textContent = 'Send invitation';

    const setInvitationButtonVisible = (visible) => {
      if (visible) {
        if (!viewActions.contains(sendInvitationButton)) {
          viewActions.appendChild(sendInvitationButton);
        }
      } else if (viewActions.contains(sendInvitationButton)) {
        sendInvitationButton.remove();
      }
    };

    const updateLastSeenUI = (lastSeen) => {
      const hasLastSeen = typeof lastSeen === 'string' && lastSeen.trim() !== '';
      lastSeenValue.textContent = hasLastSeen ? formatAdminDateTime(lastSeen) : 'Never';

      const shouldShowSendInvitation = isAccessEnabled && !hasLastSeen;
      setInvitationButtonVisible(shouldShowSendInvitation);

      if (isLastSeenDebugEnabled) {
        inviteDebugItem.textContent =
          `Debug: raw accessEnabled=${JSON.stringify(guest.accessEnabled)}, `
          + `normalised=${isAccessEnabled}, lastSeenRaw=${JSON.stringify(lastSeen)}, `
          + `hasLastSeen=${hasLastSeen}, showInvite=${shouldShowSendInvitation}`;

        console.warn('[last_seen debug]', {
          guestId: guest.id,
          email: guest.email,
          rawAccessEnabled: guest.accessEnabled,
          isAccessEnabled,
          lastSeen,
          hasLastSeen,
          shouldShowSendInvitation,
        });
      }
    };

    sendInvitationButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      sendInvitationButton.disabled = true;
      sendInvitationButton.textContent = 'Sending...';
      try {
        const response = await sendGuestInvitation(guest.id);
        const message = response?.message || 'Invitation queued';
        setStatus(`${message} for ${guest.email || guest.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      } finally {
        sendInvitationButton.disabled = false;
        sendInvitationButton.textContent = 'Send invitation';
      }
    });

    // Fetch once and drive both last-seen text + invitation visibility from the same value.
    fetchGuestLastSeen(guest.id, isLastSeenDebugEnabled).then(updateLastSeenUI);

    const enterEditMode = () => {
      viewSection.hidden = true;
      editSection.hidden = false;
      row.classList.add('admin-guest-row--editing');
      detailRow.hidden = false;
      row.setAttribute('aria-expanded', 'true');
      setStatus('Editing guest. Changes save automatically.', 'warning');
    };

    const exitEditMode = () => {
      clearAutoSaveTimer();
      viewSection.hidden = false;
      editSection.hidden = true;
      row.classList.remove('admin-guest-row--editing');
      setEditFieldsDisabled(false);
    };

    editButton.addEventListener('click', () => {
      enterEditMode();
    });

    deleteButton.addEventListener('click', async (event) => {
      event.stopPropagation();

      const guestLabel = guest.name || guest.email || `guest ${guest.id}`;
      const confirmed = window.confirm(`Delete ${guestLabel}? This cannot be undone.`);
      if (!confirmed) {
        return;
      }

      try {
        await withGuestAction(guest.id, async () => {
          await deleteGuest(guest.id);
        });
        await onRefreshNeeded();
        setStatus(`Deleted ${guestLabel}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      }
    });

    cancelEditButton.addEventListener('click', () => {
      syncEditFieldsFromGuest();
      exitEditMode();
      setStatus('Edit cancelled.', 'warning');
    });

    const saveDraft = async () => {
      clearAutoSaveTimer();

      if (!hasDraftChanges()) {
        return;
      }

      if (saveInFlight) {
        pendingSave = true;
        return;
      }

      const payload = getDraftPayload();
      saveInFlight = true;
      setEditFieldsDisabled(true);
      setStatus(`Saving ${payload.name || guestRecord.name}...`, 'warning');

      try {
        const updated = await (await apiFetch(`/api/private/guests/${guestRecord.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })).json();

        guestRecord = updated?.guest ? { ...updated.guest } : { ...guestRecord, ...payload };
        applyGuestToView();

        if (typeof onGuestUpdated === 'function') {
          onGuestUpdated(guestRecord);
        }

        setStatus(`Saved ${guestRecord.name || payload.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      } finally {
        saveInFlight = false;
        setEditFieldsDisabled(false);

        if (pendingSave) {
          pendingSave = false;
          void saveDraft();
        }
      }
    };

    const scheduleSave = () => {
      if (saveInFlight) {
        pendingSave = true;
        return;
      }

      clearAutoSaveTimer();
      autoSaveTimeoutId = window.setTimeout(() => {
        void saveDraft();
      }, AUTO_SAVE_DELAY_MS);
    };

    editFields.forEach((fieldEl) => {
      fieldEl.addEventListener('input', () => {
        if (fieldEl === editRsvp) {
          void saveDraft();
          return;
        }

        scheduleSave();
      });

      fieldEl.addEventListener('change', () => {
        if (fieldEl === editRsvp) {
          void saveDraft();
          return;
        }

        scheduleSave();
      });

      fieldEl.addEventListener('blur', () => {
        void saveDraft();
      });

      fieldEl.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          syncEditFieldsFromGuest();
          exitEditMode();
          setStatus('Edit cancelled.', 'warning');
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          void saveDraft();
        }
      });
    });

    detailRow.appendChild(detailCell);

    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) {return;}
      if (row.classList.contains('admin-guest-row--editing')) {return;}
      const expanded = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!expanded));
      detailRow.hidden = expanded;
    });

    toggleAccessButton.addEventListener('click', async () => {
      const nextEnabled = !isAccessEnabled;
      setStatus(`${nextEnabled ? 'Enabling' : 'Disabling'} access for ${guest.email || guest.name}...`, 'warning');

      try {
        await withGuestAction(guest.id, async () => {
          await setGuestAccess(guest.id, nextEnabled);
        });
        await onRefreshNeeded();
        setStatus(`${nextEnabled ? 'Enabled' : 'Disabled'} access for ${guest.email || guest.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      }
    });

    const isSyncOk = guest.syncStatus === 'in_sync' && !guest.syncError;

    if (isSyncOk) {
      syncOkIcon.hidden = false;
      syncWarning.hidden = true;
      syncOkIcon.title = 'In sync';
    } else {
      const message = guest.syncError || `Sync status: ${guest.syncStatus || 'unknown'}`;
      syncOkIcon.hidden = true;
      syncWarning.hidden = false;
      syncTrigger.setAttribute('aria-label', message);
      syncTrigger.title = message;
      syncTooltip.textContent = message;
    }

    return fragment;
  };

  const renderGuests = (guests, syncActionInProgress = false) => {
    guestsTableBody.innerHTML = '';

    if (!Array.isArray(guests) || guests.length === 0) {
      guestsEmpty.hidden = false;
      guestsTableWrap.hidden = true;
      guestsList.hidden = false;
      return;
    }

    const allInSync = guests.every((g) => g.syncStatus === 'in_sync' && !g.syncError);
    const fragment = document.createDocumentFragment();

    guestsEmpty.hidden = true;
    guestsTableWrap.hidden = false;
    guestsSyncHeader.hidden = allInSync;

    guests.forEach((guest) => {
      fragment.appendChild(createGuestRows(guest, allInSync, syncActionInProgress));
    });

    guestsTableBody.appendChild(fragment);
    guestsList.hidden = false;
  };

  return { renderGuests };
};
