import { createStatusSetter } from './utils/status.js';
import { fetchGuests, fetchSyncStatus, runSync } from './features/admin/api.js';
import { getAdminElements, getFormFields } from './features/admin/elements.js';
import { renderRsvpStats } from './features/admin/rsvp-stats.js';
import { apiFetch } from './utils/api.js';
import { formatSyncSummary } from './features/admin/format.js';
import { createAccessRequestsRenderer } from './features/admin/access-requests.js';
import { createGuestTableRenderer } from './features/admin/guest-table.js';

(() => {
  const elements = getAdminElements();
  if (!elements) {return;}

  const fields = getFormFields();
  if (!fields) {return;}

  const {
    status,
    form,
    submitButton,
    cancelAddButton,
    toggleAddButton,
    addFormStatus,
    addPanel,
    guestsList,
    rsvpStats,
    rsvpTotal,
    rsvpBar,
    rsvpYes,
    rsvpPending,
    rsvpNo,
    syncPanel,
    syncSummary,
    runSyncButton,
    dryRunSyncButton,
    refreshSyncButton,
    requestsPanel,
    requestsList,
    requestTemplate,
    guestsEmpty,
    guestsTableWrap,
    guestsTableBody,
    guestsSyncHeader,
    guestRowTemplate,
  } = elements;

  let guestsState = [];
  let isSubmitting = false;
  let isAddFormExpanded = false;
  let syncActionInProgress = false;
  let createLockedUntilFieldChange = false;
  const desktopRequestLayout = window.matchMedia('(width > 800px)');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const isLastSeenDebugEnabled = isLocalHost && new URLSearchParams(window.location.search).has('debugLastSeen');

  const setStatus = createStatusSetter(status, { hideWhenEmpty: false });

  const setAddFormExpanded = (expanded) => {
    isAddFormExpanded = expanded;
    form.hidden = !expanded;
    toggleAddButton.textContent = expanded ? 'Hide form' : 'Add guest';
  };

  const setSyncButtonsDisabled = (disabled) => {
    runSyncButton.disabled = disabled;
    dryRunSyncButton.disabled = disabled;
    refreshSyncButton.disabled = disabled;
  };

  const setSyncSummary = (summary, isError = false) => {
    syncSummary.textContent = summary;
    syncSummary.classList.toggle('admin-sync-summary-error', isError);
    syncSummary.classList.toggle('admin-sync-summary-warning', !isError && /drift|pending|failed/i.test(summary));
  };

  const setSubmittingState = (submitting) => {
    isSubmitting = submitting;
    submitButton.disabled = submitting || createLockedUntilFieldChange;
    submitButton.textContent = submitting ? 'Creating...' : 'Create guest';
  };

  const clearAddGuestStatus = () => {
    addFormStatus.hidden = true;
    addFormStatus.textContent = '';
  };

  const showAddGuestError = (message, lockUntilFieldChange = false) => {
    addFormStatus.hidden = false;
    addFormStatus.textContent = message;
    createLockedUntilFieldChange = lockUntilFieldChange;
    setSubmittingState(false);
  };

  const refreshSyncSummary = async () => {
    const summary = await fetchSyncStatus();
    setSyncSummary(formatSyncSummary(summary));
  };

  const { refreshAccessRequests } = createAccessRequestsRenderer({
    requestsPanel,
    requestsList,
    requestTemplate,
    desktopRequestLayout,
    setStatus,
    fields,
    setAddFormExpanded,
    addPanel,
  });

  const { renderGuests } = createGuestTableRenderer({
    guestRowTemplate,
    isLastSeenDebugEnabled,
    setStatus,
    onRefreshNeeded: () => refreshGuestsAndSummary(),
    guestsTableBody,
    guestsEmpty,
    guestsTableWrap,
    guestsSyncHeader,
    guestsList,
  });

  const refreshGuestsAndSummary = async () => {
    const [guests, summary] = await Promise.all([fetchGuests(), fetchSyncStatus()]);
    guestsState = guests;
    renderGuests(guestsState, syncActionInProgress);
    renderRsvpStats(guestsState, {
      rsvpStats,
      rsvpTotal,
      rsvpBar,
      rsvpYes,
      rsvpPending,
      rsvpNo,
    });
    setSyncSummary(formatSyncSummary(summary));
    setStatus('');
  };

  const addGuest = async () => {
    return (await apiFetch('/api/private/guests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        rsvp: fields.rsvp.value,
        additionalGuests: Number.parseInt(fields.additionalGuests.value, 10) || 0,
      }),
    })).json();
  };

  const hasDuplicateGuestEmail = (email) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return false;
    }

    return guestsState.some((guest) => (guest?.email || '').trim().toLowerCase() === normalizedEmail);
  };

  const resetForm = () => {
    form.reset();
    fields.rsvp.value = 'pending';
    fields.additionalGuests.value = '0';
    createLockedUntilFieldChange = false;
    clearAddGuestStatus();
    setSubmittingState(false);
  };

  const unlockCreateAfterFieldChange = () => {
    if (!createLockedUntilFieldChange) {
      return;
    }

    createLockedUntilFieldChange = false;
    clearAddGuestStatus();
    setSubmittingState(false);
  };

  let unlockQueued = false;
  const queueUnlockAfterFieldChange = () => {
    if (unlockQueued) {
      return;
    }

    unlockQueued = true;
    queueMicrotask(() => {
      unlockQueued = false;
      unlockCreateAfterFieldChange();
    });
  };

  form.addEventListener('input', queueUnlockAfterFieldChange);
  form.addEventListener('change', queueUnlockAfterFieldChange);

  toggleAddButton.addEventListener('click', () => {
    if (isAddFormExpanded) {
      clearAddGuestStatus();
      createLockedUntilFieldChange = false;
      setSubmittingState(false);
    }
    setAddFormExpanded(!isAddFormExpanded);
  });

  cancelAddButton.addEventListener('click', () => {
    resetForm();
    setAddFormExpanded(false);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearAddGuestStatus();
    setSubmittingState(true);

    if (hasDuplicateGuestEmail(fields.email.value)) {
      showAddGuestError('A guest with this email already exists. Use a different email.', true);
      return;
    }

    try {
      await addGuest();
      resetForm();
      setAddFormExpanded(false);
      await refreshGuestsAndSummary();
    } catch (error) {
      if (/already exists|unique constraint|duplicate/i.test(error.message || '')) {
        showAddGuestError('A guest with this email already exists. Use a different email.', true);
      } else {
        showAddGuestError(error.message || 'Unable to create guest.');
      }
    } finally {
      setSubmittingState(false);
    }
  });

  runSyncButton.addEventListener('click', async () => {
    if (syncActionInProgress) {
      return;
    }

    syncActionInProgress = true;
    setSyncButtonsDisabled(true);
    setSyncSummary('Running full sync...');

    try {
      const result = await runSync('full');
      const failedCount = Array.isArray(result.errors) ? result.errors.length : 0;
      if (result.ok) {
        setSyncSummary(`Full sync completed. Updated ${result.updated || 0} guest access entries.`);
      } else {
        setSyncSummary(
          `Full sync failed with ${failedCount} error${failedCount === 1 ? '' : 's'}.`,
          true
        );
      }
      await refreshGuestsAndSummary();
    } catch (error) {
      setSyncSummary(error.message, true);
      setStatus(error.message, 'failure');
    } finally {
      syncActionInProgress = false;
      setSyncButtonsDisabled(false);
    }
  });

  dryRunSyncButton.addEventListener('click', async () => {
    if (syncActionInProgress) {
      return;
    }

    syncActionInProgress = true;
    setSyncButtonsDisabled(true);
    setSyncSummary('Running dry run...');

    try {
      const result = await runSync('dry-run');
      const count = Array.isArray(result.desiredEmails) ? result.desiredEmails.length : 0;
      setSyncSummary(`Dry run completed. ${count} email${count === 1 ? '' : 's'} would be in the policy.`);
      await refreshSyncSummary();
    } catch (error) {
      setSyncSummary(error.message, true);
      setStatus(error.message, 'failure');
    } finally {
      syncActionInProgress = false;
      setSyncButtonsDisabled(false);
    }
  });

  refreshSyncButton.addEventListener('click', async () => {
    if (syncActionInProgress) {
      return;
    }

    syncActionInProgress = true;
    setSyncButtonsDisabled(true);

    try {
      await refreshSyncSummary();
    } catch (error) {
      setSyncSummary(error.message, true);
      setStatus(error.message, 'failure');
    } finally {
      syncActionInProgress = false;
      setSyncButtonsDisabled(false);
    }
  });

  refreshGuestsAndSummary()
    .then(() => {
      setAddFormExpanded(false);
      addPanel.hidden = false;
      syncPanel.hidden = false;
    })
    .catch((error) => {
      guestsList.hidden = true;
      form.hidden = true;
      addPanel.hidden = true;
      syncPanel.hidden = true;
      setStatus(error.message, 'failure');
    });

  refreshAccessRequests().catch(() => {
    // Non-fatal: pending requests panel stays hidden on error
  });
})();
