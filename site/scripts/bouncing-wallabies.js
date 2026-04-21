import { WALLABY_CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Return the magnitude of a 2D velocity vector.
 * @param {number} vx
 * @param {number} vy
 * @returns {number}
 */
const getSpeed = (vx, vy) => Math.hypot(vx, vy);

/**
 * Resolve page-space coordinates from a pointer event.
 * Falls back to clientX/Y + scroll offset when pageX/Y are absent.
 * @param {PointerEvent} event
 * @returns {{ x: number, y: number }}
 */
const getPagePos = (event) => ({
  x: event.pageX ?? event.clientX + window.scrollX,
  y: event.pageY ?? event.clientY + window.scrollY,
});

// ---------------------------------------------------------------------------
// Physics helpers
// ---------------------------------------------------------------------------

/**
 * Calculate a CSS drop-shadow filter string scaled by wallaby speed.
 * @param {number} speed
 * @returns {string}
 */
const calculateShadowFilter = (speed) => {
  const { SHADOW_MIN_SPEED, SHADOW_MAX_RADIUS, MAX_SPEED, SHADOW_COLOR } = WALLABY_CONFIG;
  const progress = Math.max(0, Math.min(1, (speed - SHADOW_MIN_SPEED) / (MAX_SPEED - SHADOW_MIN_SPEED)));
  return `drop-shadow(0px 0px ${SHADOW_MAX_RADIUS * progress}px ${SHADOW_COLOR})`;
};

/**
 * Clamp a wallaby's linear speed to MAX_SPEED.
 * @param {object} state
 */
const clampVelocity = (state) => {
  const speed = getSpeed(state.vx, state.vy);
  if (speed <= WALLABY_CONFIG.MAX_SPEED) return;
  const scale = WALLABY_CONFIG.MAX_SPEED / speed;
  state.vx *= scale;
  state.vy *= scale;
};

/**
 * Clamp a wallaby's angular speed to ±MAX_ANGULAR_SPEED.
 * @param {object} state
 */
const clampAngularVelocity = (state) => {
  const { MAX_ANGULAR_SPEED } = WALLABY_CONFIG;
  if (Math.abs(state.omega) > MAX_ANGULAR_SPEED) {
    state.omega = Math.sign(state.omega) * MAX_ANGULAR_SPEED;
  }
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Return bounding boxes for all `.wallaby-card` elements in document space.
 * @returns {Array<{ left: number, right: number, top: number, bottom: number }>}
 */
const getCardBounds = () =>
  Array.from(document.querySelectorAll('.wallaby-card')).map((card) => {
    const rect = card.getBoundingClientRect();
    return {
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    };
  });

/**
 * Return true if the wallaby box at (x, y) overlaps any card.
 * @param {number} x
 * @param {number} y
 * @param {Array} cardBounds
 * @returns {boolean}
 */
const intersectsAnyCard = (x, y, cardBounds) => {
  const { SIZE } = WALLABY_CONFIG;
  return cardBounds.some(
    (b) => x < b.right && x + SIZE > b.left && y < b.bottom && y + SIZE > b.top
  );
};

// ---------------------------------------------------------------------------
// Pointer interaction helpers
// ---------------------------------------------------------------------------

/**
 * Push a wallaby away from the pointer using a distance-falloff impulse.
 * @param {object} state
 * @param {PointerEvent} event
 */
const applyHoverPush = (state, event) => {
  const { SIZE, HOVER_PUSH_IMPULSE, HOVER_PUSH_RADIUS } = WALLABY_CONFIG;
  const pos = getPagePos(event);
  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  let dx = centerX - pos.x;
  let dy = centerY - pos.y;
  let dist = Math.hypot(dx, dy);

  if (dist >= HOVER_PUSH_RADIUS) return;

  if (dist < 1) {
    dx = 0;
    dy = -1;
    dist = 1;
  }

  const falloff = 1 - dist / HOVER_PUSH_RADIUS;
  const strength = HOVER_PUSH_IMPULSE * falloff * falloff;
  state.vx += (dx / dist) * strength;
  state.vy += (dy / dist) * strength;
  clampVelocity(state);
};

/**
 * Add a rotational impulse based on pointer orbit around the wallaby.
 * Projects pointer movement onto the tangent of the circle, converting
 * tangential pointer velocity into angular momentum.
 * @param {object} state
 * @param {PointerEvent} event
 */
const applyHoverSpin = (state, event) => {
  const { SIZE, HOVER_ANGULAR_SCALE } = WALLABY_CONFIG;
  const pos = getPagePos(event);

  if (state.hoverPtrX === null) {
    state.hoverPtrX = pos.x;
    state.hoverPtrY = pos.y;
    return;
  }

  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  // Radius vector from wallaby centre to last known pointer position.
  const dx = state.hoverPtrX - centerX;
  const dy = state.hoverPtrY - centerY;
  const r = Math.hypot(dx, dy);

  if (r > 1) {
    const moveDx = pos.x - state.hoverPtrX;
    const moveDy = pos.y - state.hoverPtrY;
    // Project movement onto the unit tangent (-dy/r, dx/r).
    const tangential = (moveDx * -dy + moveDy * dx) / r;
    state.omega += tangential * HOVER_ANGULAR_SCALE;
    clampAngularVelocity(state);
  }

  state.hoverPtrX = pos.x;
  state.hoverPtrY = pos.y;
};

/**
 * Apply a tap impulse directed away from the click point relative to the wallaby centre.
 * @param {object} state
 * @param {PointerEvent} event
 */
const applyTapImpulse = (state, event) => {
  const { SIZE, CLICK_IMPULSE } = WALLABY_CONFIG;
  const pos = getPagePos(event);
  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  let dx = centerX - pos.x;
  let dy = centerY - pos.y;
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

// ---------------------------------------------------------------------------
// Main initialisation
// ---------------------------------------------------------------------------

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

  // --- DOM layout layer ---

  const layer = document.createElement('div');
  layer.className = 'wallaby-bouncer-layer';
  document.body.appendChild(layer);

  const syncLayerHeight = () => {
    layer.style.height = `${document.documentElement.scrollHeight}px`;
  };
  syncLayerHeight();
  window.addEventListener('resize', syncLayerHeight);

  // --- Spark / indicator canvas ---

  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.setAttribute('aria-hidden', 'true');
  sparkCanvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(sparkCanvas);
  const sparkCtx = sparkCanvas.getContext('2d');

  const resizeSparkCanvas = () => {
    sparkCanvas.width = window.innerWidth;
    sparkCanvas.height = window.innerHeight;
  };
  resizeSparkCanvas();
  window.addEventListener('resize', resizeSparkCanvas);

  const SPARK_COLORS = ['#ffd700', '#ffc200', '#ffaa00', '#fff4a0'];
  const SPARK_GRAVITY = 0.25;
  const SPARK_COUNT = 20;
  let sparks = [];

  /** Spawn gold spark particles at a client-space coordinate. */
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

  /**
   * Spawn sparks at a page-space position, converting to client coords.
   * All collision handlers work in page space; this is the single conversion point.
   */
  const spawnSparksAtPage = (pageX, pageY) => {
    spawnSparks(pageX - window.scrollX, pageY - window.scrollY);
  };

  /** Update and draw live spark particles onto the canvas. */
  const drawSparks = () => {
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
  };

  /**
   * Draw a gold edge-glow indicator for any albino wallaby outside the viewport.
   * Casts a ray from the viewport centre to the wallaby, finds where it
   * intersects the screen edge, and paints a radial gradient glow there.
   * @param {Array} states
   */
  const drawAlbinoIndicators = (states) => {
    const W = sparkCanvas.width;
    const H = sparkCanvas.height;
    const midX = W / 2;
    const midY = H / 2;

    states.forEach((s) => {
      if (!s.isAlbino) return;

      const clientX = s.x + SIZE / 2 - window.scrollX;
      const clientY = s.y + SIZE / 2 - window.scrollY;
      if (clientX >= 0 && clientX <= W && clientY >= 0 && clientY <= H) return;

      // Parametric ray from screen centre toward wallaby; t = scale to reach the nearest edge.
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
  };

  // --- Collision resolution ---

  // Converts a tangential sliding velocity into a signed angular impulse (deg/s).
  // Derivation: torque = lever × Jt, Δω = Jt × (2 / radius), converted to degrees.
  const spinFactor = COLLISION_FRICTION * (2 / (SIZE / 2)) * (180 / Math.PI);

  /**
   * Bounce a wallaby off any card it is overlapping.
   * Uses the previous-frame position to determine which face was hit, applying
   * a velocity reflection and a friction torque from the tangential sliding speed.
   * @param {object} state
   * @param {number} prevX
   * @param {number} prevY
   * @param {Array} cardBounds
   */
  const resolveCardCollisions = (state, prevX, prevY, cardBounds) => {
    cardBounds.forEach((bounds) => {
      const overlaps =
        state.x < bounds.right &&
        state.x + SIZE > bounds.left &&
        state.y < bounds.bottom &&
        state.y + SIZE > bounds.top;

      if (!overlaps) return;

      const cx = state.x + SIZE / 2;
      const cy = state.y + SIZE / 2;

      // Emit sparks at a page-space point if this wallaby is albino.
      const spark = (pageX, pageY) => {
        if (state.isAlbino) spawnSparksAtPage(pageX, pageY);
      };

      // Use the previous-frame position to determine which face was crossed.
      // Tangential spin factor signs:
      //   left face:   tangential = vy, sign −1
      //   right face:  tangential = vy, sign +1
      //   top face:    tangential = vx, sign +1
      //   bottom face: tangential = vx, sign −1
      if (prevX + SIZE <= bounds.left) {
        state.x = bounds.left - SIZE;
        state.omega += -state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = -Math.abs(state.vx);
        spark(cx + SIZE / 2, cy);
        return;
      }

      if (prevX >= bounds.right) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - SIZE / 2, cy);
        return;
      }

      if (prevY + SIZE <= bounds.top) {
        state.y = bounds.top - SIZE;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + SIZE / 2);
        return;
      }

      if (prevY >= bounds.bottom) {
        state.y = bounds.bottom;
        state.omega += -state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = Math.abs(state.vy);
        spark(cx, cy - SIZE / 2);
        return;
      }

      // Previous position was already inside the card (e.g. on spawn or after teleport).
      // Fall back to minimum-overlap resolution.
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
      } else if (minOverlap === overlapRight) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - SIZE / 2, cy);
      } else if (minOverlap === overlapTop) {
        state.y = bounds.top - SIZE;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + SIZE / 2);
      } else {
        state.y = bounds.bottom;
        state.omega += -state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = Math.abs(state.vy);
        spark(cx, cy - SIZE / 2);
      }
    });
  };

  /**
   * Resolve pairwise wallaby–wallaby collisions.
   * Treats wallabies as equal-mass circles for stable elastic bounces,
   * then applies a tangential friction impulse to impart counter-rotation.
   * @param {Array} states
   */
  const resolveWallabyCollisions = (states) => {
    const radius = SIZE / 2;
    const minDist = radius * 2;
    const minDistSq = minDist * minDist;

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
        let distSq = dx * dx + dy * dy;

        if (distSq > minDistSq) continue;

        // Avoid division by zero if two wallabies are exactly on top of each other.
        if (distSq < 0.0001) {
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distSq = 1;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping wallabies so they cannot stick together.
        const overlap = minDist - dist;
        if (overlap > 0) {
          const sep = overlap / 2;
          a.x -= nx * sep;
          a.y -= ny * sep;
          b.x += nx * sep;
          b.y += ny * sep;
        }

        const relVx = b.vx - a.vx;
        const relVy = b.vy - a.vy;
        const velAlongNormal = relVx * nx + relVy * ny;

        if (velAlongNormal >= 0) continue;

        // Equal-mass elastic impulse along the collision normal.
        const impulse = -velAlongNormal;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        clampVelocity(a);
        clampVelocity(b);

        // Spawn sparks at the contact point for albino wallabies.
        // Contact point = centre of A + radius in the normal direction.
        if (a.isAlbino || b.isAlbino) {
          spawnSparksAtPage((a.x + radius) + nx * radius, (a.y + radius) + ny * radius);
        }

        // Tangential friction impulse — imparts opposite spin on each wallaby.
        // Tangent is perpendicular to the normal: (−ny, nx).
        // Lever arm = radius; Δω = Jt × (2/radius), converted to degrees.
        const vRelTangential = relVx * -ny + relVy * nx;
        const Jt = COLLISION_FRICTION * -vRelTangential;
        const deltaOmegaDeg = Jt * (2 / radius) * (180 / Math.PI);
        a.omega += deltaOmegaDeg;
        b.omega -= deltaOmegaDeg;
        clampAngularVelocity(a);
        clampAngularVelocity(b);
      }
    }
  };

  // --- Wallaby lifecycle ---

  const header = document.querySelector('header');
  const footer = document.querySelector('footer');

  /**
   * Find a collision-free spawn position, trying 40 random locations before
   * falling back to the top of the scrollable area.
   * @param {Function} getYBounds
   * @returns {{ x: number, y: number }}
   */
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

  /** Set a wallaby element's opacity based on whether it is active (hovered/touched). */
  const setOpacity = (el, active) => {
    el.style.opacity = active ? WALLABY_ACTIVE_OPACITY : WALLABY_IDLE_OPACITY;
  };

  /**
   * Create and attach a single wallaby with its physics state and pointer handlers.
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

    // Mouse hover — push and spin while cursor is over the element.
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
        // hoverPtrX is non-null while the mouse is over the element.
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

    // Touch — tap impulse on contact; push/spin while dragging.
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

  // --- Animation loop ---

  // One wallaby per 90 px of screen width.
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

      // Integrate position.
      s.x += s.vx * (dt / BASE_FRAME_MS);
      s.y += s.vy * (dt / BASE_FRAME_MS);

      // Apply angular damping then update rotation.
      s.omega *= ANGULAR_DAMPING ** (dt / BASE_FRAME_MS);
      // Couple maximum spin to linear speed. Without this, tangential friction
      // injects angular energy without removing linear energy, so slow-moving
      // wallabies can accumulate enough omega to appear to orbit.
      // At max speed the full MAX_ANGULAR_SPEED cap applies; at rest, omega → 0.
      const speed = getSpeed(s.vx, s.vy);
      const omegaCap = speed * (MAX_ANGULAR_SPEED / MAX_SPEED);
      if (Math.abs(s.omega) > omegaCap) s.omega = Math.sign(s.omega) * omegaCap;
      s.rotation = ((s.rotation + s.omega * (dt / 1000)) % 360 + 360) % 360;

      // Viewport boundary bounces.
      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      if (s.x <= 0) {
        s.x = 0;
        s.omega += -s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = Math.abs(s.vx);
        if (s.isAlbino) spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.x >= w - SIZE) {
        s.x = w - SIZE;
        s.omega += s.vy * spinFactor;
        clampAngularVelocity(s);
        s.vx = -Math.abs(s.vx);
        if (s.isAlbino) spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.y <= yMin) {
        s.y = yMin;
        s.omega += s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = Math.abs(s.vy);
        if (s.isAlbino) spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }
      if (s.y >= boundedYMax) {
        s.y = boundedYMax;
        s.omega += -s.vx * spinFactor;
        clampAngularVelocity(s);
        s.vy = -Math.abs(s.vy);
        if (s.isAlbino) spawnSparksAtPage(s.x + SIZE / 2, s.y + SIZE / 2);
      }

      resolveCardCollisions(s, prevX, prevY, cardBounds);

      // Re-clamp x after card collision corrections.
      s.x = Math.max(0, Math.min(w - SIZE, s.x));
    });

    resolveWallabyCollisions(wallabies);

    wallabies.forEach((s) => {
      const { yMin, yMax } = s.getYBounds();
      const boundedYMax = Math.max(yMin, yMax);

      s.y = Math.max(yMin, Math.min(boundedYMax, s.y));

      // Combined translate+rotate on a single element preserves the transform-origin
      // at the collision circle centre, avoiding sub-pixel pivot drift under GPU compositing.
      s.el.style.transform = `translate(${s.x}px,${s.y}px) rotate(${s.rotation}deg)`;

      // Albinos use only the gold drop-shadow — no pink speed glow.
      s.img.style.filter = s.isAlbino
        ? 'drop-shadow(0 0 3px #ffd700) drop-shadow(0 0 6px #ffd700)'
        : calculateShadowFilter(getSpeed(s.vx, s.vy));
    });

    // Draw canvas overlays.
    sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
    drawAlbinoIndicators(wallabies);
    drawSparks();

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

initializeBouncingWallabies();
