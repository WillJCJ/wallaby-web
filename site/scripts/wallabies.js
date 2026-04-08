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
  const HOVER_PUSH_IMPULSE = 0.1;
  const MAX_SPEED = 15;
  const SHADOW_MIN_SPEED = 8;
  const SHADOW_MAX_RADIUS = 40;
  const SHADOW_COLOR = 'rgba(253, 26, 120, 0.7)';
  const WALLABY_IDLE_OPACITY = 0.35;
  const WALLABY_ACTIVE_OPACITY = 0.8;

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  const cardElements = Array.from(document.querySelectorAll('.wallaby-card'));
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  const syncLayerHeight = () => {
    layer.style.height = `${document.documentElement.scrollHeight}px`;
  };

  syncLayerHeight();
  window.addEventListener('resize', syncLayerHeight);

  const clampVelocity = (state) => {
    const speed = Math.hypot(state.vx, state.vy);

    if (speed <= MAX_SPEED) {
      return;
    }

    const scale = MAX_SPEED / speed;
    state.vx *= scale;
    state.vy *= scale;
  };

  const applyHoverPush = (state, event) => {
    const pointerX = event.pageX ?? (event.clientX + window.scrollX);
    const pointerY = event.pageY ?? (event.clientY + window.scrollY);
    const centerX = state.x + SIZE / 2;
    const centerY = state.y + SIZE / 2;
    const offsetX = (pointerX - centerX) / (SIZE / 2 || 1);
    const offsetY = (pointerY - centerY) / (SIZE / 2 || 1);

    state.vx += state.hoverPushDirection * offsetX * HOVER_PUSH_IMPULSE;
    state.vy += state.hoverPushDirection * offsetY * HOVER_PUSH_IMPULSE;
    clampVelocity(state);
  };

  const getCardBounds = () => cardElements.map((card) => {
    const rect = card.getBoundingClientRect();

    return {
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });

  const intersectsAnyCard = (x, y, cardBounds) => cardBounds.some((bounds) => (
    x < bounds.right &&
    x + SIZE > bounds.left &&
    y < bounds.bottom &&
    y + SIZE > bounds.top
  ));

  const resolveCardCollisions = (state, prevX, prevY, cardBounds) => {
    cardBounds.forEach((bounds) => {
      const overlaps = (
        state.x < bounds.right &&
        state.x + SIZE > bounds.left &&
        state.y < bounds.bottom &&
        state.y + SIZE > bounds.top
      );

      if (!overlaps) {
        return;
      }

      const prevLeft = prevX;
      const prevRight = prevX + SIZE;
      const prevTop = prevY;
      const prevBottom = prevY + SIZE;

      if (prevRight <= bounds.left) {
        state.x = bounds.left - SIZE;
        state.vx = -Math.abs(state.vx);
        return;
      }

      if (prevLeft >= bounds.right) {
        state.x = bounds.right;
        state.vx = Math.abs(state.vx);
        return;
      }

      if (prevBottom <= bounds.top) {
        state.y = bounds.top - SIZE;
        state.vy = -Math.abs(state.vy);
        return;
      }

      if (prevTop >= bounds.bottom) {
        state.y = bounds.bottom;
        state.vy = Math.abs(state.vy);
        return;
      }

      const overlapLeft = state.x + SIZE - bounds.left;
      const overlapRight = bounds.right - state.x;
      const overlapTop = state.y + SIZE - bounds.top;
      const overlapBottom = bounds.bottom - state.y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft) {
        state.x = bounds.left - SIZE;
        state.vx = -Math.abs(state.vx);
        return;
      }

      if (minOverlap === overlapRight) {
        state.x = bounds.right;
        state.vx = Math.abs(state.vx);
        return;
      }

      if (minOverlap === overlapTop) {
        state.y = bounds.top - SIZE;
        state.vy = -Math.abs(state.vy);
        return;
      }

      state.y = bounds.bottom;
      state.vy = Math.abs(state.vy);
    });
  };

  const getSpawnPosition = (getYBounds) => {
    const cardBounds = getCardBounds();
    const { yMin, yMax } = getYBounds();
    const boundedYMax = Math.max(yMin, yMax);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = Math.random() * Math.max(0, window.innerWidth - SIZE);
      const y = yMin + Math.random() * Math.max(0, boundedYMax - yMin);

      if (!intersectsAnyCard(x, y, cardBounds)) {
        return { x, y };
      }
    }

    return {
      x: Math.random() * Math.max(0, window.innerWidth - SIZE),
      y: yMin,
    };
  };

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

    const spawnPosition = getSpawnPosition(getYBounds);

    const state = {
      x: spawnPosition.x,
      y: spawnPosition.y,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      hoverPushDirection: Math.random() < 0.5 ? -1 : 1,
      rotation: Math.random() * 360,
      isSpinning: false,
      activeTouchPointerId: null,
      el,
      img,
      getYBounds,
    };

    el.style.opacity = `${WALLABY_IDLE_OPACITY}`;

    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') {
        return;
      }

      state.isSpinning = true;
      el.style.opacity = `${WALLABY_ACTIVE_OPACITY}`;
      applyHoverPush(state, event);
    });

    el.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') {
        if (state.isSpinning) {
          applyHoverPush(state, event);
        }

        return;
      }

      if (state.activeTouchPointerId === event.pointerId) {
        applyHoverPush(state, event);
      }
    });

    el.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') {
        return;
      }

      state.isSpinning = false;
      el.style.opacity = `${WALLABY_IDLE_OPACITY}`;
    });

    el.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse') {
        return;
      }

      state.activeTouchPointerId = event.pointerId;
      state.isSpinning = true;
      el.style.opacity = `${WALLABY_ACTIVE_OPACITY}`;
      applyHoverPush(state, event);
      el.setPointerCapture(event.pointerId);
    });

    const stopTouchInteraction = (event) => {
      if (event.pointerType === 'mouse') {
        return;
      }

      if (state.activeTouchPointerId !== event.pointerId) {
        return;
      }

      state.activeTouchPointerId = null;
      state.isSpinning = false;
      el.style.opacity = `${WALLABY_IDLE_OPACITY}`;
    };

    el.addEventListener('pointerup', stopTouchInteraction);
    el.addEventListener('pointercancel', stopTouchInteraction);

    layer.appendChild(el);
    return state;
  });

  let lastTime = null;

  const tick = (now) => {
    const dt = lastTime === null ? BASE_FRAME_MS : Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;

    const w = window.innerWidth;
    const cardBounds = getCardBounds();

    wallabies.forEach((s) => {
      const prevX = s.x;
      const prevY = s.y;

      s.x += s.vx * (dt / BASE_FRAME_MS);
      s.y += s.vy * (dt / BASE_FRAME_MS);

      if (s.isSpinning) {
        s.rotation = (s.rotation + SPIN_SPEED_DEG_PER_SEC * (dt / 1000)) % 360;
      }

      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) { s.x = 0; s.vx = Math.abs(s.vx); }
      if (s.x >= w - SIZE) { s.x = w - SIZE; s.vx = -Math.abs(s.vx); }
      if (s.y <= yMin) { s.y = yMin; s.vy = Math.abs(s.vy); }
      if (s.y >= boundedYMax) { s.y = boundedYMax; s.vy = -Math.abs(s.vy); }

      resolveCardCollisions(s, prevX, prevY, cardBounds);

      s.el.style.transform = `translate(${s.x}px,${s.y}px)`;
      s.img.style.transform = `rotate(${s.rotation}deg)`;

      const speed = Math.hypot(s.vx, s.vy);
      const shadowProgress = Math.max(0, Math.min(1, (speed - SHADOW_MIN_SPEED) / (MAX_SPEED - SHADOW_MIN_SPEED)));
      const shadowRadius = SHADOW_MAX_RADIUS * shadowProgress;
      const dropShadowValue = `drop-shadow(0px 0px ${shadowRadius}px ${SHADOW_COLOR})`;

      s.img.style.filter = dropShadowValue;
    });

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
})();
