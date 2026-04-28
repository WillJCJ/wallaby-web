import { WALLABY_CONFIG } from '../../config.js';
import {
  clampAngularVelocity,
  clampVelocity,
  getPagePos,
} from './utils.js';

/**
 * Push a wallaby away from the pointer using a distance-falloff impulse.
 * @param {object} state - The wallaby state object
 * @param {PointerEvent} event - The pointer event
 * @returns {void}
 */
export const applyHoverPush = (state, event) => {
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
 * @param {object} state - The wallaby state object
 * @param {PointerEvent} event - The pointer event
 * @returns {void}
 */
export const applyHoverSpin = (state, event) => {
  const { SIZE, HOVER_ANGULAR_SCALE } = WALLABY_CONFIG;
  const pos = getPagePos(event);

  if (state.hoverPtrX === null) {
    state.hoverPtrX = pos.x;
    state.hoverPtrY = pos.y;
    return;
  }

  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  const dx = state.hoverPtrX - centerX;
  const dy = state.hoverPtrY - centerY;
  const r = Math.hypot(dx, dy);

  if (r > 1) {
    const moveDx = pos.x - state.hoverPtrX;
    const moveDy = pos.y - state.hoverPtrY;
    const tangential = (moveDx * -dy + moveDy * dx) / r;
    state.omega += tangential * HOVER_ANGULAR_SCALE;
    clampAngularVelocity(state);
  }

  state.hoverPtrX = pos.x;
  state.hoverPtrY = pos.y;
};

/**
 * Apply a tap impulse directed away from the click point relative to the wallaby centre.
 * @param {object} state - The wallaby state object
 * @param {PointerEvent} event - The pointer event
 * @returns {void}
 */
export const applyTapImpulse = (state, event) => {
  const { SIZE, CLICK_IMPULSE } = WALLABY_CONFIG;
  const pos = getPagePos(event);
  const centerX = state.x + SIZE / 2;
  const centerY = state.y + SIZE / 2;
  let dx = centerX - pos.x;
  let dy = centerY - pos.y;
  const dist = Math.hypot(dx, dy);

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
