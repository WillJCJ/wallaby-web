import { apiFetch } from '../../utils/api.js';
import { deleteGuest, fetchGuestLastSeen, sendGuestInvitation, setGuestAccess } from './api.js';
import { getRowElements } from './elements.js';
import { formatAdminDateTime, normalizeAccessEnabled } from './format.js';

export const createGuestTableRenderer = ({
  guestRowTemplate,
  isLastSeenDebugEnabled,
  setStatus,
  onRefreshNeeded,
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
      saveButton,
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

    row.style.cursor = 'pointer';
    detailCell.colSpan = allInSync ? 4 : 5;
    emailValue.textContent = guest.email || '—';
    dietaryValue.textContent = guest.dietaryRequirements || '—';
    rsvpMessageValue.textContent = guest.rsvpMessage || '—';
    guestIdInline.textContent = `Guest ID: ${guest.id || '—'}`;
    inviteDebugItem.hidden = !isLastSeenDebugEnabled;
    editName.value = guest.name || '';
    editEmail.value = guest.email || '';
    editRsvp.value = guest.rsvp || 'pending';
    editAdditional.value = String(Number.parseInt(guest.additionalGuests, 10) || 0);
    editDietary.value = guest.dietaryRequirements || '';
    editRsvpMessage.value = guest.rsvpMessage || '';
    nameCell.textContent = guest.name || 'Unnamed guest';
    rsvpCell.textContent = guest.rsvp || 'pending';
    countCell.textContent = String(Number.parseInt(guest.additionalGuests, 10) || 0);
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
    };

    const exitEditMode = () => {
      viewSection.hidden = false;
      editSection.hidden = true;
      row.classList.remove('admin-guest-row--editing');
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
      exitEditMode();
    });

    saveButton.addEventListener('click', async () => {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      setStatus(`Saving ${editName.value.trim() || guest.name}...`, 'warning');

      try {
        await apiFetch(`/api/private/guests/${guest.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: editName.value.trim(),
            email: editEmail.value.trim(),
            rsvp: editRsvp.value,
            additionalGuests: Number.parseInt(editAdditional.value, 10) || 0,
            dietaryRequirements: editDietary.value.trim(),
            rsvpMessage: editRsvpMessage.value.trim(),
          }),
        });
        await onRefreshNeeded();
        setStatus(`Saved ${editName.value.trim() || guest.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
      }
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
