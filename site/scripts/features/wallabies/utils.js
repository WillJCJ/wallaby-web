import { WALLABY_CONFIG } from '../../config.js';

/**
 * Return the magnitude of a 2D velocity vector.
 * @param {number} vx - Horizontal velocity component
 * @param {number} vy - Vertical velocity component
 * @returns {number} The speed magnitude
 */
export const getSpeed = (vx, vy) => Math.hypot(vx, vy);

/**
 * Resolve page-space coordinates from a pointer event.
 * Falls back to clientX/Y + scroll offset when pageX/Y are absent.
 * @param {PointerEvent} event - The pointer event
 * @returns {{ x: number, y: number }} Page-space coordinates
 */
export const getPagePos = (event) => ({
  x: event.pageX ?? event.clientX + window.scrollX,
  y: event.pageY ?? event.clientY + window.scrollY,
});

/**
 * Calculate a CSS drop-shadow filter string scaled by wallaby speed.
 * @param {number} speed - The wallaby's current speed
 * @returns {string} A CSS drop-shadow filter string
 */
export const calculateShadowFilter = (speed) => {
  const { SHADOW_MIN_SPEED, SHADOW_MAX_RADIUS, MAX_SPEED, SHADOW_COLOR } = WALLABY_CONFIG;
  const progress = Math.max(0, Math.min(1, (speed - SHADOW_MIN_SPEED) / (MAX_SPEED - SHADOW_MIN_SPEED)));
  return `drop-shadow(0px 0px ${SHADOW_MAX_RADIUS * progress}px ${SHADOW_COLOR})`;
};

/**
 * Clamp a wallaby's linear speed to MAX_SPEED.
 * @param {object} state - The wallaby state object
 * @returns {void}
 */
export const clampVelocity = (state) => {
  const speed = getSpeed(state.vx, state.vy);
  if (speed <= WALLABY_CONFIG.MAX_SPEED) return;
  const scale = WALLABY_CONFIG.MAX_SPEED / speed;
  state.vx *= scale;
  state.vy *= scale;
};

/**
 * Clamp a wallaby's angular speed to +-MAX_ANGULAR_SPEED.
 * @param {object} state - The wallaby state object
 * @returns {void}
 */
export const clampAngularVelocity = (state) => {
  const { MAX_ANGULAR_SPEED } = WALLABY_CONFIG;
  if (Math.abs(state.omega) > MAX_ANGULAR_SPEED) {
    state.omega = Math.sign(state.omega) * MAX_ANGULAR_SPEED;
  }
};

/**
 * Return bounding boxes for all .wallaby-card elements in document space.
 * @returns {Array<{ left: number, right: number, top: number, bottom: number }>} Array of bounding boxes
 */
export const getCardBounds = () =>
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
 * @param {number} x - Wallaby x coordinate
 * @param {number} y - Wallaby y coordinate
 * @param {Array<{ left: number, right: number, top: number, bottom: number }>} cardBounds - Card bounding boxes
 * @returns {boolean} True if the wallaby intersects any card
 */
export const intersectsAnyCard = (x, y, cardBounds) => {
  const { SIZE } = WALLABY_CONFIG;
  return cardBounds.some(
    (b) => x < b.right && x + SIZE > b.left && y < b.bottom && y + SIZE > b.top
  );
};
