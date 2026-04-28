import { WALLABY_CONFIG } from './config.js';
import {
  clampVelocity,
  clampAngularVelocity,
  calculateShadowFilter,
  getCardBounds,
  getPagePos,
  getSpeed,
  intersectsAnyCard,
} from './features/wallabies/utils.js';
import {
  applyHoverPush,
  applyHoverSpin,
  applyTapImpulse,
} from './features/wallabies/interactions.js';
import { createOverlaySystem } from './features/wallabies/overlay.js';
import { createCollisionResolvers } from './features/wallabies/collisions.js';

/**
 * Initialise the bouncing wallaby animation.
 * Creates a physics-simulated layer of wallabies with collision detection
 * and pointer interaction.
 */
const initializeBouncingWallabies = () => {
  const {
    WALLABY_IMG,
    WALLABY_ALBINO_IMG,
    ALBINO_CHANCE,
    SIZE,
    BASE_FRAME_MS,
    MAX_FRAME_MS,
    MAX_SPEED,
    MAX_ANGULAR_SPEED,
    ANGULAR_DAMPING,
    COLLISION_FRICTION,
    WALLABY_IDLE_OPACITY,
    WALLABY_ACTIVE_OPACITY,
  } = WALLABY_CONFIG;

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  const syncLayerHeight = () => {
    layer.style.height = `${document.documentElement.scrollHeight}px`;
  };
  syncLayerHeight();
  window.addEventListener('resize', syncLayerHeight);

  const overlay = createOverlaySystem(SIZE);
  const {
    spinFactor,
    resolveCardCollisions,
    resolveWallabyCollisions,
  } = createCollisionResolvers({
    size: SIZE,
    collisionFriction: COLLISION_FRICTION,
    clampAngularVelocity,
    clampVelocity,
    spawnSparksAtPage: overlay.spawnSparksAtPage,
  });

  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  const getSpawnPosition = (getYBounds) => {
    const cardBounds = getCardBounds();
    const { yMin, yMax } = getYBounds();
    const boundedYMax = Math.max(yMin, yMax);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = Math.random() * Math.max(0, window.innerWidth - SIZE);
      const y = yMin + Math.random() * Math.max(0, boundedYMax - yMin);
      if (!intersectsAnyCard(x, y, cardBounds)) return { x, y };
    }

    return { x: Math.random() * Math.max(0, window.innerWidth - SIZE), y: yMin };
  };

  const setOpacity = (el, active) => {
    el.style.opacity = active ? WALLABY_ACTIVE_OPACITY : WALLABY_IDLE_OPACITY;
  };

  const createWallaby = () => {
    const el = document.createElement('div');
    el.className = 'wallaby-bouncer';

    const isAlbino = Math.random() < ALBINO_CHANCE;
    const img = document.createElement('img');
    img.src = isAlbino ? WALLABY_ALBINO_IMG : WALLABY_IMG;
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

    const spawn = getSpawnPosition(getYBounds);

    const state = {
      x: spawn.x,
      y: spawn.y,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      rotation: Math.random() * 360,
      omega: 0,
      isAlbino,
      activeTouchPointerId: null,
      hoverPtrX: null,
      hoverPtrY: null,
      el,
      img,
      getYBounds,
    };

    setOpacity(el, false);

    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      setOpacity(el, true);
      applyHoverPush(state, event);
      const pos = getPagePos(event);
      state.hoverPtrX = pos.x;
      state.hoverPtrY = pos.y;
    });

    el.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') {
        if (state.hoverPtrX !== null) {
          applyHoverPush(state, event);
          applyHoverSpin(state, event);
        }
        return;
      }

      if (state.activeTouchPointerId === event.pointerId) {
        applyHoverPush(state, event);
        applyHoverSpin(state, event);
      }
    });

    el.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      setOpacity(el, false);
      state.hoverPtrX = null;
      state.hoverPtrY = null;
    });

    el.addEventListener('pointerdown', (event) => {
      applyTapImpulse(state, event);

      if (event.pointerType === 'mouse') return;

      state.activeTouchPointerId = event.pointerId;
      setOpacity(el, true);
      el.setPointerCapture(event.pointerId);
      const pos = getPagePos(event);
      state.hoverPtrX = pos.x;
      state.hoverPtrY = pos.y;
    });

    const stopTouchInteraction = (event) => {
      if (event.pointerType === 'mouse') return;
      if (state.activeTouchPointerId !== event.pointerId) return;

      state.activeTouchPointerId = null;
      setOpacity(el, false);
      state.hoverPtrX = null;
      state.hoverPtrY = null;
    };

    el.addEventListener('pointerup', stopTouchInteraction);
    el.addEventListener('pointercancel', stopTouchInteraction);

    layer.appendChild(el);
    return state;
  };

  const count = Math.max(1, Math.floor(window.innerWidth / 90));
  const wallabies = Array.from({ length: count }, createWallaby);

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

      s.omega *= ANGULAR_DAMPING ** (dt / BASE_FRAME_MS);
      const speed = getSpeed(s.vx, s.vy);
      const omegaCap = speed * (MAX_ANGULAR_SPEED / MAX_SPEED);
      if (Math.abs(s.omega) > omegaCap) s.omega = Math.sign(s.omega) * omegaCap;
      s.rotation = ((s.rotation + s.omega * (dt / 1000)) % 360 + 360) % 360;

      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) {
        s.x = 0;
        s.omega += -s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = Math.abs(s.vx);
        if (s.isAlbino) overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.x >= w - SIZE) {
        s.x = w - SIZE;
        s.omega += s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = -Math.abs(s.vx);
        if (s.isAlbino) overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.y <= yMin) {
        s.y = yMin;
        s.omega += s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = Math.abs(s.vy);
        if (s.isAlbino) overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.y >= boundedYMax) {
        s.y = boundedYMax;
        s.omega += -s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = -Math.abs(s.vy);
        if (s.isAlbino) overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }

      resolveCardCollisions(s, prevX, prevY, cardBounds);
      s.x = Math.max(0, Math.min(w - SIZE, s.x));
    });

    resolveWallabyCollisions(wallabies);

    wallabies.forEach((s) => {
      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      s.y = Math.max(yMin, Math.min(boundedYMax, s.y));
      s.el.style.transform = `translate(${s.x}px,${s.y}px) rotate(${s.rotation}deg)`;

      s.img.style.filter = s.isAlbino
        ? 'drop-shadow(0 0 3px #ffd700) drop-shadow(0 0 6px #ffd700)'
        : calculateShadowFilter(getSpeed(s.vx, s.vy));
    });

    overlay.clear();
    overlay.drawAlbinoIndicators(wallabies);
    overlay.drawSparks();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

initializeBouncingWallabies();
