import { describe, expect, it, vi } from 'vitest';

import { createSparkSystem } from '../scripts/utils/sparks.js';

const createContext = () => ({
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
});

describe('createSparkSystem', () => {
  it('moves world-following sparks left with world speed', () => {
    const context = createContext();
    const sparks = createSparkSystem(context);

    sparks.spawn(50, 40, {
      count: 1,
      minSpeed: 0,
      maxSpeed: 0,
      minLifetime: 1,
      maxLifetime: 1,
      minSize: 2,
      maxSize: 2,
      upwardBias: 0,
      followWorld: true,
    });
    sparks.draw(0.1, 100);

    expect(context.arc).toHaveBeenCalledWith(45, 42.25, 2, 0, Math.PI * 2);
  });

  it('keeps screen-space sparks independent of world speed', () => {
    const context = createContext();
    const sparks = createSparkSystem(context);

    sparks.spawn(50, 40, {
      count: 1,
      minSpeed: 0,
      maxSpeed: 0,
      minLifetime: 1,
      maxLifetime: 1,
      minSize: 2,
      maxSize: 2,
      upwardBias: 0,
    });
    sparks.draw(0.1, 100);

    expect(context.arc).toHaveBeenCalledWith(50, 42.25, 2, 0, Math.PI * 2);
  });

  it('applies a reduced world-speed scale to world-following sparks', () => {
    const context = createContext();
    const sparks = createSparkSystem(context);

    sparks.spawn(50, 40, {
      count: 1,
      minSpeed: 0,
      maxSpeed: 0,
      minLifetime: 1,
      maxLifetime: 1,
      minSize: 2,
      maxSize: 2,
      upwardBias: 0,
      followWorld: true,
      worldSpeedScale: 0.75,
    });
    sparks.draw(0.05, 100);

    expect(context.arc).toHaveBeenCalledWith(46.25, 42.25, 2, 0, Math.PI * 2);
  });
});
