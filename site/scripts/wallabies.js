(() => {
  const cards = Array.from(document.querySelectorAll('.wallaby-card'));

  if (cards.length === 0) {
    return;
  }

  const closeCard = (card) => {
    const toggle = card.querySelector('.wallaby-card-toggle');

    card.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  };

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

  cards.forEach(closeCard);

  cards.forEach((card) => {
    const toggle = card.querySelector('.wallaby-card-toggle');

    toggle.addEventListener('click', () => {
      if (card.classList.contains('is-open')) {
        closeCard(card);
        return;
      }

      openCard(card);
    });
  });

  document.addEventListener('click', (event) => {
    if (cards.some((card) => card.contains(event.target))) {
      return;
    }

    cards.forEach(closeCard);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }

    cards.forEach(closeCard);
  });
})();
