import { apiFetch } from '/scripts/api-utils.js';

(() => {
  const status = document.getElementById('guest-admin-status');
  const form = document.getElementById('guest-admin-form');
  const submitButton = document.getElementById('guest-admin-submit');
  const cancelAddButton = document.getElementById('guest-admin-cancel');
  const toggleAddButton = document.getElementById('guest-admin-toggle');
  const addFormStatus = document.getElementById('guest-admin-form-status');
  const addPanel = document.getElementById('admin-add-panel');
  const guestsList = document.getElementById('admin-guests-list');
  const rsvpStats = document.getElementById('admin-rsvp-stats');
  const syncPanel = document.getElementById('admin-sync-panel');
  const syncSummary = document.getElementById('admin-sync-summary');
  const runSyncButton = document.getElementById('admin-sync-run');
  const dryRunSyncButton = document.getElementById('admin-sync-dry-run');
  const refreshSyncButton = document.getElementById('admin-sync-refresh');
  const requestsPanel = document.getElementById('admin-requests-panel');
  const requestsList = document.getElementById('admin-requests-list');

  if (
    !status ||
    !form ||
    !submitButton ||
    !cancelAddButton ||
    !toggleAddButton ||
    !addFormStatus ||
    !addPanel ||
    !guestsList ||
    !rsvpStats ||
    !syncPanel ||
    !syncSummary ||
    !runSyncButton ||
    !dryRunSyncButton ||
    !refreshSyncButton ||
    !requestsPanel ||
    !requestsList
  ) {
    return;
  }

  const fields = {
    name: document.getElementById('admin-guest-name'),
    email: document.getElementById('admin-guest-email'),
    rsvp: document.getElementById('admin-guest-rsvp'),
    additionalGuests: document.getElementById('admin-guest-additional-guests'),
  };

  if (Object.values(fields).some((el) => !el)) {
    return;
  }

  let guestsState = [];
  let isSubmitting = false;
  let isAddFormExpanded = false;
  let syncActionInProgress = false;
  let createLockedUntilFieldChange = false;
  const guestActionInFlight = new Set();
  const statusClasses = ['private-status--success', 'private-status--warning', 'private-status--failure'];
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  const isLastSeenDebugEnabled = isLocalHost && new URLSearchParams(window.location.search).has('debugLastSeen');

  const normalizeAccessEnabled = (value) => value === true
    || value === 1
    || value === '1'
    || (typeof value === 'string' && value.toLowerCase() === 'true');

  const setStatus = (message, tone = null) => {
    status.textContent = message;
    status.classList.remove(...statusClasses);

    if (tone === 'success') {
      status.classList.add('private-status--success');
    } else if (tone === 'warning') {
      status.classList.add('private-status--warning');
    } else if (tone === 'failure') {
      status.classList.add('private-status--failure');
    }
  };

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

  const formatSyncSummary = (summary) => {
    if (!summary || typeof summary !== 'object') {
      return 'Sync summary is unavailable.';
    }

    const inSync = Number(summary.inSync) || 0;
    const pending = Number(summary.pending) || 0;
    const failed = Number(summary.failed) || 0;
    const drift = Boolean(summary.drift);
    const lastSync = summary.lastSyncAt || 'Never';

    const driftLabel = drift ? 'Drift detected' : 'No drift';
    return `In sync: ${inSync} | Pending: ${pending} | Failed: ${failed} | ${driftLabel} | Last sync: ${lastSync}`;
  };

  const setSubmittingState = (submitting) => {
    isSubmitting = submitting;
    submitButton.disabled = submitting || createLockedUntilFieldChange;
    submitButton.textContent = submitting ? 'Adding...' : 'Add guest';
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

  const fetchGuests = async () => {
    const data = await (await apiFetch('/api/private/guests')).json();
    return Array.isArray(data?.guests) ? data.guests : [];
  };

  const fetchAccessRequests = async () => {
    const data = await (await apiFetch('/api/private/admin/access-requests')).json();
    return Array.isArray(data?.requests) ? data.requests : [];
  };

  const dismissAccessRequest = async (email) => {
    await apiFetch(`/api/private/admin/access-requests/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
  };

  const fetchSyncStatus = async () => {
    const data = await (await apiFetch('/api/private/guests/sync-status')).json();
    return data?.summary || null;
  };

  const runSync = async (mode) => {
    const data = await (await apiFetch('/api/private/guests/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode }),
    })).json();
    return data;
  };

  const setGuestAccess = async (guestId, enabled) => {
    const action = enabled ? 'enable' : 'disable';
    const response = await (await apiFetch(`/api/private/guests/${guestId}/access/${action}`, {
      method: 'POST',
    })).json();
    return response;
  };

  const deleteGuest = async (guestId) => {
    const response = await (await apiFetch(`/api/private/guests/${guestId}`, {
      method: 'DELETE',
    })).json();
    return response;
  };

  const fetchGuestLastSeen = async (guestId) => {
    try {
      const data = await (await apiFetch(`/api/private/guests/${guestId}/last-seen`)).json();
      return data?.lastSeen || null;
    } catch (error) {
      if (isLastSeenDebugEnabled) {
        console.error('[last_seen debug] Failed to load last_seen for guest', guestId, error);
      }
      return null;
    }
  };

  const sendGuestInvitation = async (guestId) => {
    const response = await (await apiFetch(`/api/private/guests/${guestId}/send-invitation`, {
      method: 'POST',
    })).json();
    return response;
  };

  const refreshSyncSummary = async () => {
    const summary = await fetchSyncStatus();
    setSyncSummary(formatSyncSummary(summary));
  };

  const renderAccessRequests = (requests) => {
    requestsList.innerHTML = '';

    if (!Array.isArray(requests) || requests.length === 0) {
      requestsPanel.hidden = true;
      return;
    }

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-requests-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-guests-table admin-requests-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Name', 'Email', 'Requested', 'Actions'].forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');

    requests.forEach((req) => {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.textContent = req.name || '—';
      row.appendChild(nameCell);

      const emailCell = document.createElement('td');
      emailCell.textContent = req.email || '—';
      row.appendChild(emailCell);

      const dateCell = document.createElement('td');
      dateCell.textContent = req.requestedAt
        ? new Date(req.requestedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';
      row.appendChild(dateCell);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'admin-col-actions';

      const createButton = document.createElement('button');
      createButton.type = 'button';
      createButton.className = 'login-button admin-request-create-button';
      createButton.textContent = 'Create guest';
      createButton.addEventListener('click', () => {
        // Pre-populate the add-guest form with the request details and scroll to it
        if (fields.name) fields.name.value = req.name || '';
        if (fields.email) fields.email.value = req.email || '';
        setAddFormExpanded(true);
        addPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const dismissButton = document.createElement('button');
      dismissButton.type = 'button';
      dismissButton.className = 'login-button admin-request-dismiss-button';
      dismissButton.textContent = 'Dismiss';
      dismissButton.addEventListener('click', async () => {
        dismissButton.disabled = true;
        dismissButton.textContent = 'Dismissing...';
        try {
          await dismissAccessRequest(req.email);
          await refreshAccessRequests();
        } catch (error) {
          setStatus(error.message, 'failure');
          dismissButton.disabled = false;
          dismissButton.textContent = 'Dismiss';
        }
      });

      actionsCell.appendChild(createButton);
      actionsCell.appendChild(dismissButton);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    requestsList.appendChild(tableWrap);
    requestsPanel.hidden = false;
  };

  const refreshAccessRequests = async () => {
    const requests = await fetchAccessRequests();
    renderAccessRequests(requests);
  };

  const renderRsvpStats = (guests) => {
    rsvpStats.innerHTML = '';
    if (!Array.isArray(guests) || guests.length === 0) {
      rsvpStats.hidden = true;
      return;
    }
    const counts = { yes: 0, no: 0, pending: 0 };
    let totalGuests = 0;
    guests.forEach((g) => {
      const extra = Number.parseInt(g.additionalGuests, 10) || 0;
      const headcount = 1 + extra;
      totalGuests += headcount;
      const rsvp = (g.rsvp || 'pending').toLowerCase();
      if (rsvp === 'yes') counts.yes += headcount;
      else if (rsvp === 'no') counts.no += headcount;
      else counts.pending += headcount;
    });
    const total = counts.yes + counts.no + counts.pending;

    const totalEl = document.createElement('p');
    totalEl.className = 'admin-rsvp-total';
    totalEl.textContent = `${totalGuests} total guest${totalGuests === 1 ? '' : 's'}`;
    rsvpStats.appendChild(totalEl);

    const segments = [
      ['yes', counts.yes, 'admin-rsvp-seg--yes'],
      ['pending', counts.pending, 'admin-rsvp-seg--pending'],
      ['no', counts.no, 'admin-rsvp-seg--no'],
    ].filter(([, count]) => count > 0);

    const barRow = document.createElement('div');
    barRow.className = 'admin-rsvp-bar';

    segments.forEach(([label, count, cls]) => {
      const pct = `${Math.round((count / total) * 100)}%`;

      const seg = document.createElement('div');
      seg.className = `admin-rsvp-seg ${cls}`;
      seg.style.flexBasis = pct;
      seg.title = `${label.charAt(0).toUpperCase() + label.slice(1)}: ${count}`;
      seg.textContent = String(count);
      barRow.appendChild(seg);
    });

    rsvpStats.appendChild(barRow);
    rsvpStats.hidden = false;
  };

  const refreshGuestsAndSummary = async () => {
    const [guests, summary] = await Promise.all([fetchGuests(), fetchSyncStatus()]);
    guestsState = guests;
    renderGuests(guestsState);
    renderRsvpStats(guestsState);
    setSyncSummary(formatSyncSummary(summary));
    setStatus('');
  };

  const createCell = (value, className = '') => {
    const cell = document.createElement('td');
    if (className) {
      cell.className = className;
    }
    cell.textContent = value;
    return cell;
  };

  const formatGuestRow = (guest, allInSync = false) => {
    const isAccessEnabled = normalizeAccessEnabled(guest.accessEnabled);

    const row = document.createElement('tr');
    row.className = 'admin-guest-row';
    row.setAttribute('aria-expanded', 'false');
    row.style.cursor = 'pointer';

    const detailRow = document.createElement('tr');
    detailRow.className = 'admin-guest-detail-row';
    detailRow.hidden = true;

    const detailCell = document.createElement('td');
    detailCell.colSpan = allInSync ? 4 : 5;
    detailCell.className = 'admin-guest-detail-cell';

    // --- view mode ---
    const viewSection = document.createElement('div');
    viewSection.className = 'admin-guest-detail-view';

    const detailItems = [
      ['Email', guest.email || '—'],
      ['Dietary requirements', guest.dietaryRequirements || '—'],
      ['RSVP message', guest.rsvpMessage || '—'],
    ];
    detailItems.forEach(([label, value]) => {
      const item = document.createElement('p');
      item.className = 'admin-guest-detail-item';
      const labelEl = document.createElement('strong');
      labelEl.textContent = `${label}: `;
      item.appendChild(labelEl);
      item.appendChild(document.createTextNode(value));
      viewSection.appendChild(item);
    });

    // Last seen display
    const lastSeenItem = document.createElement('p');
    lastSeenItem.className = 'admin-guest-detail-item admin-guest-detail-lastseen';
    const lastSeenLabel = document.createElement('strong');
    lastSeenLabel.textContent = 'Last seen: ';

    const lastSeenMain = document.createElement('span');
    lastSeenMain.className = 'admin-guest-detail-lastseen-main';
    const lastSeenValue = document.createElement('span');
    lastSeenValue.id = `guest-last-seen-${guest.id}`;
    lastSeenValue.textContent = 'Loading...';
    lastSeenMain.appendChild(lastSeenLabel);
    lastSeenMain.appendChild(lastSeenValue);

    const guestIdInline = document.createElement('span');
    guestIdInline.className = 'admin-guest-detail-id-inline';
    guestIdInline.textContent = `Guest ID: ${guest.id || '—'}`;

    lastSeenItem.appendChild(lastSeenMain);
    lastSeenItem.appendChild(guestIdInline);
    viewSection.appendChild(lastSeenItem);

    const inviteDebugItem = document.createElement('p');
    inviteDebugItem.className = 'admin-guest-debug';
    inviteDebugItem.hidden = !isLastSeenDebugEnabled;
    viewSection.appendChild(inviteDebugItem);

    const updateLastSeenUI = (lastSeen) => {
      const hasLastSeen = typeof lastSeen === 'string' && lastSeen.trim() !== '';
      const displayText = hasLastSeen
        ? new Date(lastSeen).toLocaleString()
        : 'Never';
      lastSeenValue.textContent = displayText;

      const shouldShowSendInvitation = isAccessEnabled && !hasLastSeen;
      setInvitationButtonVisible(shouldShowSendInvitation);

      if (isLastSeenDebugEnabled) {
        inviteDebugItem.textContent =
          `Debug: raw accessEnabled=${JSON.stringify(guest.accessEnabled)}, `
          + `normalised=${isAccessEnabled}, lastSeenRaw=${JSON.stringify(lastSeen)}, `
          + `hasLastSeen=${hasLastSeen}, showInvite=${shouldShowSendInvitation}`;

        console.log('[last_seen debug]', {
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

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'login-button admin-guest-edit-button';
    editButton.textContent = 'Edit';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'login-button admin-guest-edit-button';
    deleteButton.textContent = 'Delete';
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
    sendInvitationButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      sendInvitationButton.disabled = true;
      sendInvitationButton.textContent = 'Sending...';
      try {
        await sendGuestInvitation(guest.id);
        setStatus('Invitation sent to ' + (guest.email || guest.name), 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      } finally {
        sendInvitationButton.disabled = false;
        sendInvitationButton.textContent = 'Send invitation';
      }
    });

    const viewActions = document.createElement('div');
    viewActions.className = 'admin-guest-detail-actions';
    viewActions.appendChild(editButton);
    viewActions.appendChild(deleteButton);
    // The sendInvitationButton will be managed by setInvitationButtonVisible
    viewSection.appendChild(viewActions);

    // Fetch once and drive both last-seen text + invitation visibility from the same value.
    fetchGuestLastSeen(guest.id).then(updateLastSeenUI);

    // --- edit mode ---
    const editSection = document.createElement('div');
    editSection.className = 'admin-guest-edit-form';
    editSection.hidden = true;

    const makeEditField = (labelText, inputEl) => {
      const wrap = document.createElement('label');
      wrap.className = 'admin-guest-edit-field';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = labelText;
      wrap.appendChild(labelSpan);
      wrap.appendChild(inputEl);
      return wrap;
    };

    const editName = document.createElement('input');
    editName.type = 'text';
    editName.value = guest.name || '';
    editName.maxLength = 120;
    editName.required = true;

    const editEmail = document.createElement('input');
    editEmail.type = 'email';
    editEmail.value = guest.email || '';
    editEmail.maxLength = 320;
    editEmail.required = true;

    const editRsvp = document.createElement('select');
    ['pending', 'yes', 'no'].forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
      if (val === (guest.rsvp || 'pending')) opt.selected = true;
      editRsvp.appendChild(opt);
    });

    const editAdditional = document.createElement('input');
    editAdditional.type = 'number';
    editAdditional.min = '0';
    editAdditional.step = '1';
    editAdditional.value = String(Number.parseInt(guest.additionalGuests, 10) || 0);

    const editDietary = document.createElement('input');
    editDietary.type = 'text';
    editDietary.value = guest.dietaryRequirements || '';
    editDietary.maxLength = 600;

    const editRsvpMessage = document.createElement('input');
    editRsvpMessage.type = 'text';
    editRsvpMessage.value = guest.rsvpMessage || '';
    editRsvpMessage.maxLength = 1000;

    editSection.appendChild(makeEditField('Name', editName));
    editSection.appendChild(makeEditField('Email', editEmail));
    editSection.appendChild(makeEditField('RSVP', editRsvp));
    editSection.appendChild(makeEditField('Additional guests', editAdditional));
    editSection.appendChild(makeEditField('Dietary requirements', editDietary));
    editSection.appendChild(makeEditField('RSVP message', editRsvpMessage));

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'login-button admin-guest-edit-button';
    saveButton.textContent = 'Save';

    const cancelEditButton = document.createElement('button');
    cancelEditButton.type = 'button';
    cancelEditButton.className = 'login-button admin-guest-edit-button';
    cancelEditButton.textContent = 'Cancel';

    const editActions = document.createElement('div');
    editActions.className = 'admin-guest-edit-actions';
    editActions.appendChild(saveButton);
    editActions.appendChild(cancelEditButton);
    editSection.appendChild(editActions);

    detailCell.appendChild(viewSection);
    detailCell.appendChild(editSection);

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
        await refreshGuestsAndSummary();
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
        await refreshGuestsAndSummary();
        setStatus(`Saved ${editName.value.trim() || guest.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
      }
    });

    detailRow.appendChild(detailCell);

    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (row.classList.contains('admin-guest-row--editing')) return;
      const expanded = row.getAttribute('aria-expanded') === 'true';
      row.setAttribute('aria-expanded', String(!expanded));
      detailRow.hidden = expanded;
    });

    row._detailRow = detailRow;

    row.appendChild(createCell(guest.name || 'Unnamed guest'));
    row.appendChild(createCell(guest.rsvp || 'pending'));
    row.appendChild(createCell(String(Number.parseInt(guest.additionalGuests, 10) || 0), 'admin-col-number'));

    const accessCell = document.createElement('td');
    accessCell.className = 'admin-col-actions admin-col-access';

    const accessStateIcon = document.createElement('span');
    accessStateIcon.className = `admin-access-state ${isAccessEnabled ? 'admin-access-state--enabled' : 'admin-access-state--disabled'}`;
    accessStateIcon.textContent = isAccessEnabled ? '✓' : '✕';
    accessStateIcon.title = isAccessEnabled ? 'Access enabled' : 'Access disabled';
    accessStateIcon.setAttribute('aria-label', isAccessEnabled ? 'Access enabled' : 'Access disabled');

    const toggleAccessButton = document.createElement('button');
    toggleAccessButton.type = 'button';
    toggleAccessButton.className = 'login-button admin-guest-access-button';
    toggleAccessButton.textContent = isAccessEnabled ? 'Disable' : 'Enable';
    toggleAccessButton.disabled = guestActionInFlight.has(guest.id) || syncActionInProgress;

    toggleAccessButton.addEventListener('click', async () => {
      const nextEnabled = !isAccessEnabled;
      setStatus(`${nextEnabled ? 'Enabling' : 'Disabling'} access for ${guest.email || guest.name}...`, 'warning');

      try {
        await withGuestAction(guest.id, async () => {
          await setGuestAccess(guest.id, nextEnabled);
        });
        await refreshGuestsAndSummary();
        setStatus(`${nextEnabled ? 'Enabled' : 'Disabled'} access for ${guest.email || guest.name}.`, 'success');
      } catch (error) {
        setStatus(error.message, 'failure');
      }
    });

    accessCell.appendChild(accessStateIcon);
    accessCell.appendChild(toggleAccessButton);
    row.appendChild(accessCell);

    if (allInSync) {
      return row;
    }

    const syncCell = document.createElement('td');
    syncCell.className = 'admin-col-sync';
    const isSyncOk = guest.syncStatus === 'in_sync' && !guest.syncError;

    if (isSyncOk) {
      const syncOkIcon = document.createElement('span');
      syncOkIcon.className = 'admin-sync-icon admin-sync-icon-ok';
      syncOkIcon.textContent = '✓';
      syncOkIcon.title = 'In sync';
      syncCell.appendChild(syncOkIcon);
    } else {
      const message = guest.syncError || `Sync status: ${guest.syncStatus || 'unknown'}`;
      const tooltipWrap = document.createElement('span');
      tooltipWrap.className = 'admin-sync-tooltip-wrap';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'admin-sync-tooltip-trigger';
      trigger.setAttribute('aria-label', message);
      trigger.title = message;
      trigger.textContent = '⚠';

      const tooltip = document.createElement('span');
      tooltip.className = 'admin-sync-tooltip';
      tooltip.textContent = message;

      tooltipWrap.appendChild(trigger);
      tooltipWrap.appendChild(tooltip);
      syncCell.appendChild(tooltipWrap);
    }

    row.appendChild(syncCell);

    return row;
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

    const tableWrap = document.createElement('div');
    tableWrap.className = 'admin-guests-table-wrap';

    const table = document.createElement('table');
    table.className = 'admin-guests-table';

    const allInSync = guests.every((g) => g.syncStatus === 'in_sync' && !g.syncError);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['Name', 'RSVP', 'Guests', 'Access'];
    if (!allInSync) headers.push('Sync');
    headers.forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    guests.forEach((guest) => {
      const row = formatGuestRow(guest, allInSync);
      tbody.appendChild(row);
      tbody.appendChild(row._detailRow);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    guestsList.appendChild(tableWrap);

    guestsList.hidden = false;
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

  form.addEventListener('input', unlockCreateAfterFieldChange);
  form.addEventListener('change', unlockCreateAfterFieldChange);

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
