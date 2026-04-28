import { WALLABY_CONFIG } from './config.js';
import {
  clampVelocity,
  clampAngularVelocity,
  calculateShadowFilter,
  getCardBounds,
  getPagePos,
  getSpeed,
  intersectsAnyCard,
} from './features/bouncing-wallabies/utils.js';
import {
  applyHoverPush,
  applyHoverSpin,
  applyTapImpulse,
} from './features/bouncing-wallabies/interactions.js';
import { createOverlaySystem } from './features/bouncing-wallabies/overlay.js';
import { createCollisionResolvers } from './features/bouncing-wallabies/collisions.js';
import {
  createSpawnPositionResolver,
  createWallabyFactory,
} from './features/bouncing-wallabies/lifecycle.js';

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

  const getSpawnPosition = createSpawnPositionResolver({
    size: SIZE,
    getCardBounds,
    intersectsAnyCard,
  });

  const createWallaby = createWallabyFactory({
    layer,
    header,
    footer,
    size: SIZE,
    albinoChance: ALBINO_CHANCE,
    wallabyImg: WALLABY_IMG,
    albinoImg: WALLABY_ALBINO_IMG,
    idleOpacity: WALLABY_IDLE_OPACITY,
    activeOpacity: WALLABY_ACTIVE_OPACITY,
    getSpawnPosition,
    getPagePos,
    applyHoverPush,
    applyHoverSpin,
    applyTapImpulse,
  });

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
      if (Math.abs(s.omega) > omegaCap) {s.omega = Math.sign(s.omega) * omegaCap;}
      s.rotation = ((s.rotation + s.omega * (dt / 1000)) % 360 + 360) % 360;

      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) {
        s.x = 0;
        s.omega += -s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = Math.abs(s.vx);
        if (s.isAlbino) {overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);}
      }
      if (s.x >= w - SIZE) {
        s.x = w - SIZE;
        s.omega += s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = -Math.abs(s.vx);
        if (s.isAlbino) {overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);}
      }
      if (s.y <= yMin) {
        s.y = yMin;
        s.omega += s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = Math.abs(s.vy);
        if (s.isAlbino) {overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);}
      }
      if (s.y >= boundedYMax) {
        s.y = boundedYMax;
        s.omega += -s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = -Math.abs(s.vy);
        if (s.isAlbino) {overlay.spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);}
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
