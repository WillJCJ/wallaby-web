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
  const SPIN_SPEED_DEG_PER_SEC = 240;
  const HOVER_ACCELERATION_PER_SEC = 0.9;

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  const syncLayerHeight = () => {
    layer.style.height = `${document.documentElement.scrollHeight}px`;
  };

  syncLayerHeight();
  window.addEventListener('resize', syncLayerHeight);

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
      const yMin = header ? header.offsetTop + header.offsetHeight : 0;
      const pageBottom = document.documentElement.scrollHeight;
      const yMax = (footer ? footer.offsetTop : pageBottom) - SIZE;
      return { yMin, yMax };
    };

    const { yMin, yMax } = getYBounds();

    const state = {
      x: Math.random() * (window.innerWidth - SIZE),
      y: yMin + Math.random() * Math.max(0, yMax - yMin),
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      rotation: Math.random() * 360,
      isSpinning: false,
      speedMultiplier: 1,
      el,
      img,
      getYBounds,
    };

    el.addEventListener('mouseenter', () => {
      state.isSpinning = true;
    });

    el.addEventListener('mouseleave', () => {
      state.isSpinning = false;
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
      if (s.isSpinning) {
        s.speedMultiplier += HOVER_ACCELERATION_PER_SEC * (dt / 1000);
      }

      s.x += s.vx * s.speedMultiplier * (dt / BASE_FRAME_MS);
      s.y += s.vy * s.speedMultiplier * (dt / BASE_FRAME_MS);

      if (s.isSpinning) {
        s.rotation = (s.rotation + SPIN_SPEED_DEG_PER_SEC * (dt / 1000)) % 360;
      }

      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      if (s.x >= w - SIZE) { s.x = w - SIZE; s.vx = -Math.abs(s.vx); }
      if (s.y <= yMin) { s.y = yMin; s.vy = Math.abs(s.vy); }
      if (s.y >= boundedYMax) { s.y = boundedYMax; s.vy = -Math.abs(s.vy); }

      s.el.style.transform = `translate(${s.x}px,${s.y}px)`;
      s.img.style.transform = `rotate(${s.rotation}deg)`;
    });

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
})();
