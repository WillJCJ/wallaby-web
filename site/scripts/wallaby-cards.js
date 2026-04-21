const initializeWallabyCards = () => {
  const cards = document.querySelectorAll('.wallaby-card');

  cards.forEach((card) => {
    const summary = card.querySelector('.wallaby-card-toggle');

    card.addEventListener('click', (event) => {
      if (!card.open) {
        return;
      }

      if (summary?.contains(event.target)) {
        return;
      }

      card.open = false;
    });
  });
};

initializeWallabyCards();