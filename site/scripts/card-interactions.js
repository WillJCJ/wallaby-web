/**
 * Card expand/collapse interaction handlers
 * Manages wallaby card toggle, details, and document-level close triggers
 */

const initializeCardInteractions = () => {
  const cards = Array.from(document.querySelectorAll('.wallaby-card'));

  if (cards.length === 0) {
    return;
  }

  /**
   * Close a wallaby card
   * @param {HTMLElement} card
   */
  const closeCard = (card) => {
    const toggle = card.querySelector('.wallaby-card-toggle');
    card.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

  /**
   * Open a wallaby card and close all others
   * @param {HTMLElement} card
   */
  const openCard = (card) => {
    const toggle = card.querySelector('.wallaby-card-toggle');

    cards.forEach((otherCard) => {
      if (otherCard !== card) {
        closeCard(otherCard);
      }
    });

    card.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  // Initialize all cards as closed
  cards.forEach(closeCard);

  // Card toggle button handler
  cards.forEach((card) => {
    const toggle = card.querySelector('.wallaby-card-toggle');
    const details = card.querySelector('.wallaby-card-details');

    toggle.addEventListener('click', () => {
      if (card.classList.contains('is-open')) {
        closeCard(card);
        return;
      }

      openCard(card);
    });

    // Details area click also closes
    details.addEventListener('click', () => {
      if (card.classList.contains('is-open')) {
        closeCard(card);
      }
    });
  });

  // Close cards when clicking outside them
  document.addEventListener('click', (event) => {
    if (cards.some((card) => card.contains(event.target))) {
      return;
    }

    cards.forEach(closeCard);
  });

  // Close cards on Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    cards.forEach(closeCard);
  });
};

initializeCardInteractions();
