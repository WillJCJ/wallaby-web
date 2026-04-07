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
    const details = card.querySelector('.wallaby-card-details');

    toggle.addEventListener('click', () => {
      if (card.classList.contains('is-open')) {
        closeCard(card);
        return;
      }

      openCard(card);
    });

    details.addEventListener('click', () => {
      if (card.classList.contains('is-open')) {
        closeCard(card);
      }
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

(() => {
  const WALLABY_IMG = '/images/wallaby-bounce.png';
  const COUNT = 10;
  const SIZE = 60;
  const BASE_FRAME_MS = 16;
  const MAX_FRAME_MS = 50;

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  const wallabies = Array.from({ length: COUNT }, () => {
    const el = document.createElement('div');
    el.className = 'wallaby-bouncer';

    const img = document.createElement('img');
    img.src = WALLABY_IMG;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    el.appendChild(img);

    const baseSpeed = 1 + Math.random() * 1.5;
    const angle = Math.random() * 2 * Math.PI;

    const getYBounds = () => {
      const header = document.querySelector('header');
      const footer = document.querySelector('footer');
      const yMin = header ? header.getBoundingClientRect().bottom : 0;
      const yMax = (footer ? footer.getBoundingClientRect().top : window.innerHeight) - SIZE;
      return { yMin, yMax };
    };

    const { yMin, yMax } = getYBounds();

    const state = {
      x: Math.random() * (window.innerWidth - SIZE),
      y: yMin + Math.random() * Math.max(0, yMax - yMin),
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      el,
      getYBounds,
    };

    el.addEventListener('mouseenter', () => {
      if (el.classList.contains('is-spinning')) return;
      el.classList.add('is-spinning');
      el.addEventListener('animationend', () => el.classList.remove('is-spinning'), { once: true });
    });

    layer.appendChild(el);
    return state;
  });

  let lastTime = null;

  const tick = (now) => {
    const dt = lastTime === null ? BASE_FRAME_MS : Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;

    const w = window.innerWidth;

    wallabies.forEach((s) => {
      s.x += s.vx * (dt / BASE_FRAME_MS);
      s.y += s.vy * (dt / BASE_FRAME_MS);

      const { yMin, yMax } = s.getYBounds();

      if (s.x <= 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      if (s.x >= w - SIZE) { s.x = w - SIZE; s.vx = -Math.abs(s.vx); }
      if (s.y <= yMin) { s.y = yMin; s.vy = Math.abs(s.vy); }
      if (s.y >= yMax) { s.y = yMax; s.vy = -Math.abs(s.vy); }

      s.el.style.transform = `translate(${s.x}px,${s.y}px)`;
    });

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
})();
