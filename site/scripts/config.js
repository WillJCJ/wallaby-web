/**
 * Configuration for wallaby animation and card interactions
 */
export const WALLABY_CONFIG = {
  // Wallaby bounce animation
  WALLABY_IMG: '/images/wallaby.svg',
  WALLABY_ALBINO_IMG: '/images/wallaby-albino.svg',
  ALBINO_CHANCE: 0.005, // chance of albino wallaby on each spawn
  COUNT: 10,
  SIZE: 60,
  BASE_FRAME_MS: 16,
  MAX_FRAME_MS: 50,
  MAX_COLLISION_PAIRS_PER_FRAME: 140,
  HOVER_PUSH_IMPULSE: 0.1,
  HOVER_PUSH_RADIUS: 90,
  CLICK_IMPULSE: 5,
  MAX_SPEED: 15,

  // Shadow effect
  SHADOW_MIN_SPEED: 8,
  SHADOW_MAX_RADIUS: 40,
  SHADOW_COLOR: 'rgba(244, 35, 139, 0.7)',

  // Angular velocity physics
  ANGULAR_DAMPING: 0.997,    // per-frame omega multiplier; higher = less damping, spins longer (max 1.0)
  MAX_ANGULAR_SPEED: 2700,    // deg/s cap; higher = faster maximum spin
  COLLISION_FRICTION: 5,   // tangential impulse fraction converted to spin; higher = more spin per collision
  HOVER_ANGULAR_SCALE: 5,    // pointer orbital velocity → deg/s; higher = more spin from hovering

  // Opacity states
  WALLABY_IDLE_OPACITY: 0.9,
  WALLABY_ACTIVE_OPACITY: 1,
};
