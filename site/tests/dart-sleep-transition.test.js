import { describe, expect, it } from 'vitest';

import { createDartSleepTransition } from '../scripts/features/game/dart-sleep-transition.js';

describe('createDartSleepTransition', () => {
  it('uses slower default fall and blink timing', () => {
    expect(createDartSleepTransition().duration).toBeCloseTo(2.8);
  });

  it('falls over before blinking three times and ends on a black frame', () => {
    const transition = createDartSleepTransition({
      fallSeconds: 0.3,
      blinkCount: 3,
      blinkCycleSeconds: 0.4,
      finalBlinkCloseSeconds: 0.4,
      finalBlackHoldSeconds: 0.2,
    });

    const fall = transition.update(0.3);
    expect(fall.fallAngle).toBeCloseTo(Math.PI / 2);
    expect(fall.blackoutAlpha).toBe(0);
    expect(fall.complete).toBe(false);

    expect(transition.update(0.2).blackoutAlpha).toBeCloseTo(1);
    expect(transition.update(0.2).blackoutAlpha).toBe(0);
    expect(transition.update(0.2).blackoutAlpha).toBeCloseTo(1);
    expect(transition.update(0.2).blackoutAlpha).toBe(0);
    const finalBlinkMiddle = transition.update(0.2);
    expect(finalBlinkMiddle.blackoutAlpha).toBeGreaterThan(0);
    expect(finalBlinkMiddle.blackoutAlpha).toBeLessThan(1);
    expect(transition.update(0.2).blackoutAlpha).toBe(1);
    expect(transition.update(0.1).complete).toBe(false);
    expect(transition.update(0.1).complete).toBe(true);
    expect(transition.update(1).blackoutAlpha).toBe(1);
  });
});
