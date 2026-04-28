const SELECTORS = {
  cards: '.wallaby-card',
  fullImage: '.wallaby-card-image-full',
};

function loadFullImage(card) {
  const img = card.querySelector(SELECTORS.fullImage);
  if (!img || img.dataset.loaded === 'true') {
    return;
  }

  const src = img.dataset.src;
  const srcset = img.dataset.srcset;
  const sizes = img.dataset.sizes;

  if (src) {
    img.src = src;
  }
  if (srcset) {
    img.srcset = srcset;
  }
  if (sizes) {
    img.sizes = sizes;
  }

  img.dataset.loaded = 'true';
}

function wireWallabyCards() {
  const cards = document.querySelectorAll(SELECTORS.cards);
  cards.forEach((card) => {
    if (card.open) {
      loadFullImage(card);
    }

    card.addEventListener('toggle', () => {
      if (card.open) {
        loadFullImage(card);
      }
    });
  });
}

wireWallabyCards();
