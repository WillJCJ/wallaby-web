import { describe, expect, it } from 'vitest';

import { createDartProjectile } from '../scripts/features/game/dart-projectile.js';

describe('createDartProjectile', () => {
  it('moves horizontally at obstacle speed and follows a parabolic arc', () => {
    const dart = createDartProjectile({
      startX: 100,
      startY: 100,
      targetX: 0,
      targetY: 200,
      arcHeight: 40,
    });

    dart.update(0.5, 20);
    expect(dart.state.x).toBe(90);
    expect(dart.state.progress).toBeCloseTo(0.1);

    dart.update(2, 50);
    expect(dart.state.x).toBe(0);
    expect(dart.state.y).toBe(200);
    expect(dart.state.landed).toBe(true);

    dart.update(0.2, 50);
    expect(dart.state.x).toBe(-10);
    expect(dart.state.y).toBe(200);
  });

  it('returns the dart to target height at the end of the arc', () => {
    const dart = createDartProjectile({
      startX: 100,
      startY: 100,
      targetX: 0,
      targetY: 200,
      arcHeight: 40,
    });

    dart.update(0.5, 50);

    expect(dart.state.progress).toBe(0.25);
    expect(dart.state.y).toBe(95);
  });
});
