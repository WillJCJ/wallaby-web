/**
 * Configuration for wallaby animation and card interactions
 */
export const WALLABY_CONFIG = {
  // Wallaby bounce animation
  WALLABY_IMG: '/images/wallaby.svg',
  WALLABY_ALBINO_IMG: '/images/wallaby-albino.svg',
  ALBINO_CHANCE: 0.01,
  COUNT: 10,
  SIZE: 60,
  BASE_FRAME_MS: 16,
  MAX_FRAME_MS: 50,
  SPIN_SPEED_DEG_PER_SEC: 240,
  HOVER_PUSH_IMPULSE: 0.1,
  HOVER_PUSH_RADIUS: 90,
  CLICK_IMPULSE: 5,
  MAX_SPEED: 15,

  // Shadow effect
  SHADOW_MIN_SPEED: 8,
  SHADOW_MAX_RADIUS: 40,
  SHADOW_COLOR: 'rgba(244, 35, 139, 0.7)',

  // Opacity states
  WALLABY_IDLE_OPACITY: 0.75,
  WALLABY_ACTIVE_OPACITY: 0.9,
};
