import { dismissAccessRequest, fetchAccessRequests } from './api.js';
import { formatAdminDateTime } from './format.js';

export const createAccessRequestsRenderer = ({
  requestsPanel,
  requestsList,
  requestTemplate,
  desktopRequestLayout,
  setStatus,
  fields,
  setAddFormExpanded,
  addPanel,
}) => {
  const renderAccessRequests = (requests) => {
    requestsList.innerHTML = '';

    if (!Array.isArray(requests) || requests.length === 0) {
      requestsPanel.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();

    requests.forEach((req) => {
      const node = requestTemplate.content.cloneNode(true);
      const details = node.querySelector('.admin-request-item');
      const summary = node.querySelector('.admin-request-summary');
      const nameEl = node.querySelector('.admin-request-name');
      const summaryEmailEl = node.querySelector('.admin-request-summary-email');
      const timeEl = node.querySelector('.admin-request-time');
      const emailEl = node.querySelector('.admin-request-email');
      const createButtons = node.querySelectorAll('.admin-request-create-button');
      const dismissButtons = node.querySelectorAll('.admin-request-dismiss-button');

      if (!details || !summary || !nameEl || !summaryEmailEl || !timeEl || !emailEl || createButtons.length === 0 || dismissButtons.length === 0) {
        return;
      }

      nameEl.textContent = req.name || '—';
      summaryEmailEl.textContent = req.email || '—';
      timeEl.textContent = formatAdminDateTime(req.requestedAt);
      emailEl.textContent = req.email || '—';

      const handleCreate = (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Pre-populate the add-guest form with the request details and scroll to it
        if (fields.name) fields.name.value = req.name || '';
        if (fields.email) fields.email.value = req.email || '';
        setAddFormExpanded(true);
        addPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      const handleDismiss = async (event, buttonGroup) => {
        event.preventDefault();
        event.stopPropagation();

        buttonGroup.forEach((button) => {
          button.disabled = true;
          button.textContent = 'Dismissing...';
        });

        try {
          await dismissAccessRequest(req.requestId);
          await refreshAccessRequests();
        } catch (error) {
          setStatus(error.message, 'failure');
          buttonGroup.forEach((button) => {
            button.disabled = false;
            button.textContent = 'Dismiss';
          });
        }
      };

      createButtons.forEach((button) => {
        button.addEventListener('click', handleCreate);
      });

      dismissButtons.forEach((button) => {
        button.addEventListener('click', (event) => handleDismiss(event, dismissButtons));
      });

      if (desktopRequestLayout.matches) {
        details.open = false;
      }

      summary.addEventListener('click', (event) => {
        if (desktopRequestLayout.matches) {
          event.preventDefault();
        }
      });

      fragment.appendChild(node);
    });

    requestsList.appendChild(fragment);
    requestsPanel.hidden = false;
  };

  const refreshAccessRequests = async () => {
    const requests = await fetchAccessRequests();
    renderAccessRequests(requests);
  };

  return { renderAccessRequests, refreshAccessRequests };
};
