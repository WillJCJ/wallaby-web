export const FLASH_STORAGE_KEY = 'wallabyfest-flash-message';

export const showFlashCard = (message, type) => {
  const card = document.createElement('div');
  card.className = `flash-card flash-card--${type}`;
  card.textContent = message;
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');

  let removed = false;
  const removeCard = () => {
    if (removed) {
      return;
    }

    removed = true;
    card.remove();
  };

  const header = document.querySelector('header');
  if (header) {
    const headerOffset = Math.max(8, Math.round(header.getBoundingClientRect().height + 8));
    card.style.setProperty('--flash-card-top', `${headerOffset}px`);
  }

  document.body.appendChild(card);

  card.addEventListener('transitionend', (event) => {
    if (event.target === card && event.propertyName === 'opacity') {
      removeCard();
    }
  });

  window.setTimeout(() => {
    card.classList.add('flash-card--hidden');
    window.setTimeout(removeCard, 1000);
  }, 4500);
};

export const showStoredFlashMessage = () => {
  try {
    const flashMessage = window.sessionStorage.getItem(FLASH_STORAGE_KEY);
    if (!flashMessage) {
      return;
    }

    window.sessionStorage.removeItem(FLASH_STORAGE_KEY);
    if (flashMessage === 'logout-success') {
      showFlashCard('Logout successful', 'success');
    }
  } catch {
    // Ignore sessionStorage access failures.
  }
};
