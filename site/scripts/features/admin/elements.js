/**
 * Get all required admin page elements.
 * @returns {object|null} Object containing all required DOM elements or null if any are missing
 */
// eslint-disable-next-line complexity -- This function intentionally validates a large required DOM surface in one place.
export function getAdminElements() {
  const status = document.getElementById('guest-admin-status');
  const form = document.getElementById('guest-admin-form');
  const submitButton = document.getElementById('guest-admin-submit');
  const cancelAddButton = document.getElementById('guest-admin-cancel');
  const toggleAddButton = document.getElementById('guest-admin-toggle');
  const addFormStatus = document.getElementById('guest-admin-form-status');
  const addPanel = document.getElementById('admin-add-panel');
  const guestsList = document.getElementById('admin-guests-list');
  const rsvpStats = document.getElementById('admin-rsvp-stats');
  const rsvpTotal = document.getElementById('admin-rsvp-total');
  const rsvpBar = document.getElementById('admin-rsvp-bar');
  const rsvpYes = document.getElementById('admin-rsvp-seg-yes');
  const rsvpPending = document.getElementById('admin-rsvp-seg-pending');
  const rsvpNo = document.getElementById('admin-rsvp-seg-no');
  const syncPanel = document.getElementById('admin-sync-panel');
  const syncSummary = document.getElementById('admin-sync-summary');
  const runSyncButton = document.getElementById('admin-sync-run');
  const dryRunSyncButton = document.getElementById('admin-sync-dry-run');
  const refreshSyncButton = document.getElementById('admin-sync-refresh');
  const requestsPanel = document.getElementById('admin-requests-panel');
  const requestsList = document.getElementById('admin-requests-list');
  const requestTemplate = document.getElementById('admin-request-template');
  const guestsEmpty = document.getElementById('admin-guest-empty');
  const guestsTableWrap = document.getElementById('admin-guests-table-wrap');
  const guestsTableBody = document.getElementById('admin-guests-table-body');
  const guestsSyncHeader = document.getElementById('admin-guests-sync-header');
  const guestRowTemplate = document.getElementById('admin-guest-row-template');

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
    !rsvpTotal ||
    !rsvpBar ||
    !rsvpYes ||
    !rsvpPending ||
    !rsvpNo ||
    !syncPanel ||
    !syncSummary ||
    !runSyncButton ||
    !dryRunSyncButton ||
    !refreshSyncButton ||
    !requestsPanel ||
    !requestsList ||
    !requestTemplate ||
    !guestsEmpty ||
    !guestsTableWrap ||
    !guestsTableBody ||
    !guestsSyncHeader ||
    !guestRowTemplate
  ) {
    return null;
  }

  return {
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
  };
}

/**
 * Get form input field elements.
 * @returns {object|null} Object containing form fields or null if any are missing
 */
export function getFormFields() {
  const fields = {
    name: document.getElementById('admin-guest-name'),
    email: document.getElementById('admin-guest-email'),
    rsvp: document.getElementById('admin-guest-rsvp'),
    additionalGuests: document.getElementById('admin-guest-additional-guests'),
  };

  if (Object.values(fields).some((el) => !el)) {
    return null;
  }

  return fields;
}

/**
 * Extract and validate elements from guest row template fragment.
 * @param {DocumentFragment} fragment - Cloned template fragment
 * @returns {object|null} Object containing row elements or null if validation fails
 */
// eslint-disable-next-line complexity -- Template extraction validates many required nodes to fail fast on markup drift.
export function getRowElements(fragment) {
  const rows = fragment.querySelectorAll('tr');
  const row = rows[0];
  const detailRow = rows[1];
  const detailCell = fragment.querySelector('.admin-guest-detail-cell');
  const viewSection = fragment.querySelector('.admin-guest-detail-view');
  const emailValue = fragment.querySelector('.admin-guest-detail-email');
  const dietaryValue = fragment.querySelector('.admin-guest-detail-dietary');
  const rsvpMessageValue = fragment.querySelector('.admin-guest-detail-rsvp-message');
  const lastSeenValue = fragment.querySelector('.admin-guest-last-seen-value');
  const guestIdInline = fragment.querySelector('.admin-guest-detail-id-inline');
  const inviteDebugItem = fragment.querySelector('.admin-guest-debug');
  const editButton = fragment.querySelector('.admin-guest-edit-trigger');
  const deleteButton = fragment.querySelector('.admin-guest-delete-trigger');
  const editSection = fragment.querySelector('.admin-guest-edit-form');
  const editName = fragment.querySelector('.admin-guest-edit-name');
  const editEmail = fragment.querySelector('.admin-guest-edit-email');
  const editRsvp = fragment.querySelector('.admin-guest-edit-rsvp');
  const editAdditional = fragment.querySelector('.admin-guest-edit-additional');
  const editDietary = fragment.querySelector('.admin-guest-edit-dietary');
  const editRsvpMessage = fragment.querySelector('.admin-guest-edit-rsvp-message');
  const saveButton = fragment.querySelector('.admin-guest-save-button');
  const cancelEditButton = fragment.querySelector('.admin-guest-cancel-edit-button');
  const nameCell = fragment.querySelector('.admin-guest-name-cell');
  const rsvpCell = fragment.querySelector('.admin-guest-rsvp-cell');
  const countCell = fragment.querySelector('.admin-guest-count-cell');
  const accessStateIcon = fragment.querySelector('.admin-access-state');
  const toggleAccessButton = fragment.querySelector('.admin-guest-access-button');
  const syncCell = fragment.querySelector('.admin-guest-sync-cell');
  const syncOkIcon = fragment.querySelector('.admin-guest-sync-ok');
  const syncWarning = fragment.querySelector('.admin-guest-sync-warning');
  const syncTrigger = fragment.querySelector('.admin-sync-tooltip-trigger');
  const syncTooltip = fragment.querySelector('.admin-sync-tooltip');
  const viewActions = fragment.querySelector('.admin-guest-detail-actions');

  if (
    !row ||
    !detailRow ||
    !detailCell ||
    !viewSection ||
    !emailValue ||
    !dietaryValue ||
    !rsvpMessageValue ||
    !lastSeenValue ||
    !guestIdInline ||
    !inviteDebugItem ||
    !editButton ||
    !deleteButton ||
    !editSection ||
    !editName ||
    !editEmail ||
    !editRsvp ||
    !editAdditional ||
    !editDietary ||
    !editRsvpMessage ||
    !saveButton ||
    !cancelEditButton ||
    !nameCell ||
    !rsvpCell ||
    !countCell ||
    !accessStateIcon ||
    !toggleAccessButton ||
    !syncCell ||
    !syncOkIcon ||
    !syncWarning ||
    !syncTrigger ||
    !syncTooltip ||
    !viewActions
  ) {
    return null;
  }

  return {
    rows,
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
  };
}
