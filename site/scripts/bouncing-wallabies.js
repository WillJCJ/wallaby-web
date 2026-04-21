import { WALLABY_CONFIG } from './config.js';

/**
 * Calculate the velocity magnitude (speed) of a wallaby
 * @param {number} vx - Horizontal velocity
 * @param {number} vy - Vertical velocity
 * @returns {number} Speed magnitude
 */
const getSpeed = (vx, vy) => Math.hypot(vx, vy);

/**
 * Calculate drop-shadow filter value based on wallaby speed
 * @param {number} speed - Current speed of the wallaby
 * @returns {string} CSS filter value
 */
const calculateShadowFilter = (speed) => {
  const { SHADOW_MIN_SPEED, SHADOW_MAX_RADIUS, MAX_SPEED, SHADOW_COLOR } = WALLABY_CONFIG;
  const shadowProgress = Math.max(
    0,
    Math.min(1, (speed - SHADOW_MIN_SPEED) / (MAX_SPEED - SHADOW_MIN_SPEED))
  );
  const shadowRadius = SHADOW_MAX_RADIUS * shadowProgress;
  return `drop-shadow(0px 0px ${shadowRadius}px ${SHADOW_COLOR})`;
};

/**
 * Clamp velocity to maximum speed
 * @param {object} state - Wallaby state object
 */
const clampVelocity = (state) => {
  const speed = getSpeed(state.vx, state.vy);

  if (speed <= WALLABY_CONFIG.MAX_SPEED) {
    return;
  }

  const scale = WALLABY_CONFIG.MAX_SPEED / speed;
  state.vx *= scale;
  state.vy *= scale;
};

const clampAngularVelocity = (state) => {
  const { MAX_ANGULAR_SPEED } = WALLABY_CONFIG;
  if (Math.abs(state.omega) > MAX_ANGULAR_SPEED) {
    state.omega = Math.sign(state.omega) * MAX_ANGULAR_SPEED;
  }
};

/**
 * Get bounding rectangles for all wallaby cards on the page
 * Coordinates are in scroll-aware document space
 * @returns {Array} Array of bound objects with left, right, top, bottom
 */
const getCardBounds = () => {
  const cardElements = Array.from(document.querySelectorAll('.wallaby-card'));
  return cardElements.map((card) => {
    const rect = card.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });
};

/**
 * Check if a wallaby at position (x, y) intersects any card
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {Array} cardBounds - Array of card bounds
 * @returns {boolean} True if intersection detected
 */
const intersectsAnyCard = (x, y, cardBounds) => {
  const { SIZE } = WALLABY_CONFIG;
  return cardBounds.some(
    (bounds) =>
      x < bounds.right && x + SIZE > bounds.left && y < bounds.bottom && y + SIZE > bounds.top
  );
};

/**
 * Apply hover/push force from pointer to wallaby state
 * @param {object} state - Wallaby state object
 * @param {PointerEvent} event - Pointer event
 */
const applyHoverPush = (state, event) => {
  const { SIZE, HOVER_PUSH_IMPULSE, HOVER_PUSH_RADIUS } = WALLABY_CONFIG;
  const pointerX = event.pageX ?? event.clientX + window.scrollX;
  const pointerY = event.pageY ?? event.clientY + window.scrollY;
  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  let offsetX = centerX - pointerX;
  let offsetY = centerY - pointerY;
  let distance = Math.hypot(offsetX, offsetY);

  if (distance >= HOVER_PUSH_RADIUS) {
    return;
  }

  if (distance < 1) {
    offsetX = 0;
    offsetY = -1;
    distance = 1;
  }

  const distanceFalloff = 1 - distance / HOVER_PUSH_RADIUS;
  const pushStrength = HOVER_PUSH_IMPULSE * distanceFalloff * distanceFalloff;
  const normalizedX = offsetX / distance;
  const normalizedY = offsetY / distance;

  state.vx += normalizedX * pushStrength;
  state.vy += normalizedY * pushStrength;
  clampVelocity(state);
};

/**
 * Apply a rotational impulse based on pointer orbit around the wallaby.
 * Projects pointer movement onto the tangent of the circle, converting
 * tangential pointer velocity into angular momentum.
 * @param {object} state - Wallaby state object
 * @param {PointerEvent} event - Pointer event
 */
const applyHoverSpin = (state, event) => {
  const { SIZE, HOVER_ANGULAR_SCALE } = WALLABY_CONFIG;
  const ptrX = event.pageX ?? event.clientX + window.scrollX;
  const ptrY = event.pageY ?? event.clientY + window.scrollY;

  if (state.hoverPtrX === null) {
    state.hoverPtrX = ptrX;
    state.hoverPtrY = ptrY;
    return;
  }

  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  // Radius vector from wallaby centre to last pointer position
  const dx = state.hoverPtrX - centerX;
  const dy = state.hoverPtrY - centerY;
  const r = Math.hypot(dx, dy);

  if (r > 1) {
    const moveDx = ptrX - state.hoverPtrX;
    const moveDy = ptrY - state.hoverPtrY;
    // Project pointer movement onto the unit tangent (-dy/r, dx/r)
    const tangentialVelocity = (moveDx * -dy + moveDy * dx) / r;
    state.omega += tangentialVelocity * HOVER_ANGULAR_SCALE;
    clampAngularVelocity(state);
  }

  state.hoverPtrX = ptrX;
  state.hoverPtrY = ptrY;
};

/**
 * Apply a random directional impulse to a wallaby state.
 * @param {object} state - Wallaby state object
 */
const applyTapImpulse = (state, event) => {
  const { SIZE, CLICK_IMPULSE } = WALLABY_CONFIG;
  const ptrX = event.pageX ?? event.clientX + window.scrollX;
  const ptrY = event.pageY ?? event.clientY + window.scrollY;
  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  let dx = centerX - ptrX;
  let dy = centerY - ptrY;
  const dist = Math.hypot(dx, dy);

  // If the pointer is exactly on the centre, fall back to a random direction.
  if (dist < 1) {
    const angle = Math.random() * Math.PI * 2;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  } else {
    dx /= dist;
    dy /= dist;
  }

  state.vx += dx * CLICK_IMPULSE;
  state.vy += dy * CLICK_IMPULSE;
  clampVelocity(state);
};

/**
 * Initialize bouncing wallaby animation
 * Creates a layer of bouncing wallabies with physics simulation,
 * collision detection, and pointer interaction
 */

const initializeBouncingWallabies = () => {
  const {
    WALLABY_IMG,
    WALLABY_ALBINO_IMG,
    ALBINO_CHANCE,
    SIZE,
    BASE_FRAME_MS,
    MAX_FRAME_MS,
    ANGULAR_DAMPING,
    COLLISION_FRICTION,
    WALLABY_IDLE_OPACITY,
    WALLABY_ACTIVE_OPACITY,
  } = WALLABY_CONFIG;

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  // Spark particle canvas — fixed overlay, always on top
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.setAttribute('aria-hidden', 'true');
  sparkCanvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(sparkCanvas);
  const sparkCtx = sparkCanvas.getContext('2d');
  let sparks = [];

  const resizeSparkCanvas = () => {
    sparkCanvas.width = window.innerWidth;
    sparkCanvas.height = window.innerHeight;
  };
  resizeSparkCanvas();
  window.addEventListener('resize', resizeSparkCanvas);

  const SPARK_COLORS = ['#ffd700', '#ffc200', '#ffaa00', '#fff4a0'];
  const SPARK_GRAVITY = 0.25;
  const SPARK_COUNT = 20;

  const spawnSparks = (clientX, clientY) => {
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      sparks.push({
        x: clientX,
        y: clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 1,
        decay: 0.018 + Math.random() * 0.018,
        size: 1.5 + Math.random() * 2,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
      });
    }
  };

  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  // Converts a tangential sliding velocity into a signed angular impulse (deg/s).
  // Derivation: torque = lever * Jt, Δω = Jt * (2 / radius), converted to degrees.
  const spinFactor = COLLISION_FRICTION * (2 / (SIZE / 2)) * (180 / Math.PI);

  /**
   * Sync the animation layer height to document height
   * Called on resize and initialization
   */
  const syncLayerHeight = () => {
    layer.style.height = `${document.documentElement.scrollHeight}px`;
  };

  syncLayerHeight();
  window.addEventListener('resize', syncLayerHeight);

  /**
   * Resolve collision between wallaby and all cards
   * Updates wallaby position and velocity to bounce off cards
   * @param {object} state - Wallaby state
   * @param {number} prevX - Previous X position
   * @param {number} prevY - Previous Y position
   * @param {Array} cardBounds - Array of card bounds
   */
  const resolveCardCollisions = (state, prevX, prevY, cardBounds) => {
    cardBounds.forEach((bounds) => {
      const overlaps =
        state.x < bounds.right &&
        state.x + SIZE > bounds.left &&
        state.y < bounds.bottom &&
        state.y + SIZE > bounds.top;

      if (!overlaps) {
        return;
      }

      const prevLeft = prevX;
      const prevRight = prevX + SIZE;
      const prevTop = prevY;
      const prevBottom = prevY + SIZE;

      // Determine collision side and bounce accordingly.
      // Each face also imparts a rotational impulse from the tangential sliding velocity:
      //   vertical faces (left/right): tangential = vy; left → sign −1, right → sign +1
      //   horizontal faces (top/bottom): tangential = vx; top → sign +1, bottom → sign −1
      // Helper: emit sparks at a page-space point if this wallaby is albino.
      const spark = (pageX, pageY) => {
        if (state.isAlbino) {
          spawnSparks(pageX - window.scrollX, pageY - window.scrollY);
        }
      };

      // Contact point helpers per face (page-space centre of near edge of wallaby).
      const cx = state.x + SIZE / 2;
      const cy = state.y + SIZE / 2;

      if (prevRight <= bounds.left) {
        state.x = bounds.left - SIZE;
        state.omega += -state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = -Math.abs(state.vx);
        spark(cx + SIZE / 2, cy);
        return;
      }

      if (prevLeft >= bounds.right) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - SIZE / 2, cy);
        return;
      }

      if (prevBottom <= bounds.top) {
        state.y = bounds.top - SIZE;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + SIZE / 2);
        return;
      }

      if (prevTop >= bounds.bottom) {
        state.y = bounds.bottom;
        state.omega += -state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = Math.abs(state.vy);
        spark(cx, cy - SIZE / 2);
        return;
      }

      // If previous position doesn't help, use minimum overlap
      const overlapLeft = state.x + SIZE - bounds.left;
      const overlapRight = bounds.right - state.x;
      const overlapTop = state.y + SIZE - bounds.top;
      const overlapBottom = bounds.bottom - state.y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft) {
        state.x = bounds.left - SIZE;
        state.omega += -state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = -Math.abs(state.vx);
        spark(cx + SIZE / 2, cy);
        return;
      }

      if (minOverlap === overlapRight) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - SIZE / 2, cy);
        return;
      }

      if (minOverlap === overlapTop) {
        state.y = bounds.top - SIZE;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + SIZE / 2);
        return;
      }

      state.omega += -state.vx * spinFactor;
      clampAngularVelocity(state);
      state.y = bounds.bottom;
      state.vy = Math.abs(state.vy);
      spark(cx, cy - SIZE / 2);
    });
  };

  /**
   * Resolve pairwise wallaby collisions.
   * Treat wallabies as equal-mass circles for stable bounce behavior.
   * @param {Array} states - Array of wallaby state objects
   */
  const resolveWallabyCollisions = (states) => {
    const radius = SIZE / 2;
    const minDistance = radius * 2;
    const minDistanceSq = minDistance * minDistance;

    for (let i = 0; i < states.length; i += 1) {
      const a = states[i];

      for (let j = i + 1; j < states.length; j += 1) {
        const b = states[j];

        const ax = a.x + radius;
        const ay = a.y + radius;
        const bx = b.x + radius;
        const by = b.y + radius;
        let dx = bx - ax;
        let dy = by - ay;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq > minDistanceSq) {
          continue;
        }

        // Avoid division by zero if two wallabies are exactly on top of each other.
        if (distanceSq < 0.0001) {
          const randomAngle = Math.random() * Math.PI * 2;
          dx = Math.cos(randomAngle);
          dy = Math.sin(randomAngle);
          distanceSq = 1;
        }

        const distance = Math.sqrt(distanceSq);
        const nx = dx / distance;
        const ny = dy / distance;

        // Separate overlapping wallabies so they cannot stick together.
        const overlap = minDistance - distance;
        if (overlap > 0) {
          const separation = overlap / 2;
          a.x -= nx * separation;
          a.y -= ny * separation;
          b.x += nx * separation;
          b.y += ny * separation;
        }

        const relativeVelocityX = b.vx - a.vx;
        const relativeVelocityY = b.vy - a.vy;
        const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

        if (velocityAlongNormal >= 0) {
          continue;
        }

        // Equal-mass elastic collision along the collision normal.
        const impulse = -velocityAlongNormal;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;

        clampVelocity(a);
        clampVelocity(b);

        // Spawn sparks at the contact point for albino wallabies.
        // Contact point = centre of A + radius in the normal direction, converted to client coords.
        if (a.isAlbino || b.isAlbino) {
          const contactX = (a.x + radius) + nx * radius - window.scrollX;
          const contactY = (a.y + radius) + ny * radius - window.scrollY;
          spawnSparks(contactX, contactY);
        }

        // Tangential (friction) impulse — imparts opposite spin on each wallaby.
        // Tangent is perpendicular to normal: (-ny, nx).
        // Lever arm = radius; moment of inertia factor gives Δω = Jt * 2/radius.
        const vRelTangential =
          relativeVelocityX * -ny + relativeVelocityY * nx;
        const Jt = COLLISION_FRICTION * -vRelTangential;
        const deltaOmegaDeg = Jt * (2 / radius) * (180 / Math.PI);
        a.omega += deltaOmegaDeg;
        b.omega -= deltaOmegaDeg;
        clampAngularVelocity(a);
        clampAngularVelocity(b);
      }
    }
  };

  /**
   * Find a valid spawn position for a new wallaby
   * Tries 40 random positions before falling back to top of viewport
   * @param {Function} getYBounds - Function to get Y bounds
   * @returns {object} Position {x, y}
   */
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

  /**
   * Create a wallaby state object with physics and interaction
   * @returns {object} Wallaby state
   */
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

    const spawnPosition = getSpawnPosition(getYBounds);

    const state = {
      x: spawnPosition.x,
      y: spawnPosition.y,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed,
      rotation: Math.random() * 360,
      omega: 0,
      isSpinning: false,
      isAlbino,
      activeTouchPointerId: null,
      hoverPtrX: null,
      hoverPtrY: null,
      el,
      img,
      getYBounds,
    };

    el.style.opacity = `${WALLABY_IDLE_OPACITY}`;

    // Pointer events: mouse hover
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') {
        return;
      }

      state.isSpinning = true;
      el.style.opacity = `${WALLABY_ACTIVE_OPACITY}`;
      applyHoverPush(state, event);
      // Seed hover pointer position so the first pointermove has a reference
      state.hoverPtrX = event.pageX ?? event.clientX + window.scrollX;
      state.hoverPtrY = event.pageY ?? event.clientY + window.scrollY;
    });

    el.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') {
        if (state.isSpinning) {
          applyHoverPush(state, event);
          applyHoverSpin(state, event);
        }

        return;
      }

      // Touch movement
      if (state.activeTouchPointerId === event.pointerId) {
        applyHoverPush(state, event);
        applyHoverSpin(state, event);
      }
    });

    el.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') {
        return;
      }

      state.isSpinning = false;
      el.style.opacity = `${WALLABY_IDLE_OPACITY}`;
      state.hoverPtrX = null;
      state.hoverPtrY = null;
    });

    // Touch events
    el.addEventListener('pointerdown', (event) => {
      applyTapImpulse(state, event);

      if (event.pointerType === 'mouse') {
        return;
      }

      state.activeTouchPointerId = event.pointerId;
      state.isSpinning = true;
      el.style.opacity = `${WALLABY_ACTIVE_OPACITY}`;
      el.setPointerCapture(event.pointerId);
      // Seed hover pointer position for touch orbit spin
      state.hoverPtrX = event.pageX ?? event.clientX + window.scrollX;
      state.hoverPtrY = event.pageY ?? event.clientY + window.scrollY;
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
      state.hoverPtrX = null;
      state.hoverPtrY = null;
    };

    el.addEventListener('pointerup', stopTouchInteraction);
    el.addEventListener('pointercancel', stopTouchInteraction);

    layer.appendChild(el);
    return state;
  };

  // One wallaby per 90px of screen width — more room, more wallabies.
  const count = Math.max(1, Math.floor(window.innerWidth / 90));
  const wallabies = Array.from({ length: count }, createWallaby);

  // Animation loop
  let lastTime = null;

  const tick = (now) => {
    const dt = lastTime === null ? BASE_FRAME_MS : Math.min(now - lastTime, MAX_FRAME_MS);
    lastTime = now;

    const w = window.innerWidth;
    const cardBounds = getCardBounds();

    wallabies.forEach((s) => {
      const prevX = s.x;
      const prevY = s.y;

      // Update position
      s.x += s.vx * (dt / BASE_FRAME_MS);
      s.y += s.vy * (dt / BASE_FRAME_MS);

      // Angular damping and rotation update
      s.omega *= ANGULAR_DAMPING ** (dt / BASE_FRAME_MS);
      // Couple maximum spin to linear speed. Without this, the tangential friction
      // impulse injects angular energy without removing linear energy, so omega can
      // accumulate to the point where a slow-moving wallaby appears to orbit.
      // At max speed the full MAX_ANGULAR_SPEED cap applies; at rest, omega → 0.
      const currentSpeed = getSpeed(s.vx, s.vy);
      const omegaCap = currentSpeed * (WALLABY_CONFIG.MAX_ANGULAR_SPEED / WALLABY_CONFIG.MAX_SPEED);
      if (Math.abs(s.omega) > omegaCap) {
        s.omega = Math.sign(s.omega) * omegaCap;
      }
      s.rotation = ((s.rotation + s.omega * (dt / 1000)) % 360 + 360) % 360;

      // Boundary clamping
      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) {
        s.x = 0;
        s.omega += -s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = Math.abs(s.vx);
      }
      if (s.x >= w - SIZE) {
        s.x = w - SIZE;
        s.omega += s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = -Math.abs(s.vx);
      }
      if (s.y <= yMin) {
        s.y = yMin;
        s.omega += s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = Math.abs(s.vy);
      }
      if (s.y >= boundedYMax) {
        s.y = boundedYMax;
        s.omega += -s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = -Math.abs(s.vy);
      }

      // Collision resolution
      resolveCardCollisions(s, prevX, prevY, cardBounds);

      // Keep wallabies within horizontal bounds after collision corrections.
      if (s.x <= 0) {
        s.x = 0;
      }
      if (s.x >= w - SIZE) {
        s.x = w - SIZE;
      }
    });

    resolveWallabyCollisions(wallabies);

    wallabies.forEach((s) => {
      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.y <= yMin) {
        s.y = yMin;
      }
      if (s.y >= boundedYMax) {
        s.y = boundedYMax;
      }

      // Apply transforms and effects.
      // Rotation is combined onto the same element as translation so there is
      // a single transform-origin (50% 50% of el = the collision circle centre).
      // Nested transforms on separate elements risk sub-pixel pivot drift under
      // browser compositing with will-change: transform.
      s.el.style.transform = `translate(${s.x}px,${s.y}px) rotate(${s.rotation}deg)`;

      const speed = getSpeed(s.vx, s.vy);
      const speedFilter = calculateShadowFilter(speed);
      // Albinos use only the gold outline — no pink speed glow.
      s.img.style.filter = s.isAlbino
        ? 'drop-shadow(0 0 3px #ffd700) drop-shadow(0 0 6px #ffd700)'
        : speedFilter;
    });

    // Update and draw sparks
    sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);

    // Draw off-screen indicators for albino wallabies.
    // For each albino that is outside the viewport, find where the ray from the
    // screen centre to the wallaby intersects the screen edge and paint a pulsing
    // gold radial gradient glow there, bleeding inward from the edge.
    const W = sparkCanvas.width;
    const H = sparkCanvas.height;
    wallabies.forEach((s) => {
      if (!s.isAlbino) return;
      const clientX = s.x + SIZE / 2 - window.scrollX;
      const clientY = s.y + SIZE / 2 - window.scrollY;
      if (clientX >= 0 && clientX <= W && clientY >= 0 && clientY <= H) return;

      // Parametric ray from screen centre toward wallaby; t = smallest positive
      // scale that reaches any edge.
      const midX = W / 2;
      const midY = H / 2;
      const dx = clientX - midX;
      const dy = clientY - midY;
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (W - midX) / dx);
      if (dx < 0) t = Math.min(t, -midX / dx);
      if (dy > 0) t = Math.min(t, (H - midY) / dy);
      if (dy < 0) t = Math.min(t, -midY / dy);

      const edgeX = midX + dx * t;
      const edgeY = midY + dy * t;

      const glowRadius = 110;
      const grad = sparkCtx.createRadialGradient(edgeX, edgeY, 0, edgeX, edgeY, glowRadius);
      grad.addColorStop(0, 'rgba(255,215,0,0.85)');
      grad.addColorStop(0.4, 'rgba(255,180,0,0.45)');
      grad.addColorStop(1, 'rgba(255,140,0,0)');
      sparkCtx.fillStyle = grad;
      sparkCtx.beginPath();
      sparkCtx.arc(edgeX, edgeY, glowRadius, 0, Math.PI * 2);
      sparkCtx.fill();
    });

    sparks = sparks.filter((p) => p.life > 0);
    sparks.forEach((p) => {
      p.vy += SPARK_GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      sparkCtx.globalAlpha = Math.max(0, p.life);
      sparkCtx.fillStyle = p.color;
      sparkCtx.beginPath();
      sparkCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      sparkCtx.fill();
    });
    sparkCtx.globalAlpha = 1;

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

initializeBouncingWallabies();
