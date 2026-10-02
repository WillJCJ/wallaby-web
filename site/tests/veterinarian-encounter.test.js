import { describe, expect, it } from 'vitest';

import { createVeterinarianEncounter } from '../scripts/features/game/veterinarian-encounter.js';

const createEncounter = () => createVeterinarianEncounter({
  screenWidth: 400,
  truckWidth: 100,
  triggerSpeedRatio: 0.3,
  midpointX: 150,
  approachSpeed: 100,
  driveSpeed: 100,
  holdDuration: 2,
  returnIntervalSeconds: 30,
  initialDartCount: 5,
  dartCountIncrement: 2,
});

describe('createVeterinarianEncounter', () => {
  it('waits for the configured ratio, pauses at midpoint, then parks on the right', () => {
    const encounter = createEncounter();
    expect(encounter.getDartCount()).toBe(5);

    encounter.update(0.5, 0.29);
    expect(encounter.state).toEqual({ phase: 'waiting', x: -100, elapsed: 0 });

    encounter.update(0.5, 0.3);
    expect(encounter.state).toEqual({ phase: 'approaching', x: -50, elapsed: 0 });

    encounter.update(2, 0.3);
    expect(encounter.state).toEqual({ phase: 'alongside', x: 150, elapsed: 0 });

    encounter.update(2, 0.3);
    expect(encounter.state.phase).toBe('driving-right');
    encounter.update(3, 0.3);
    expect(encounter.state).toEqual({ phase: 'stationed', x: 290, elapsed: 0 });

    encounter.update(2, 0.9);
    expect(encounter.state.phase).toBe('stationed');

    encounter.driveOff();
    expect(encounter.state.phase).toBe('driving-off');
    encounter.update(2, 0.9);
    expect(encounter.state).toEqual({ phase: 'cooldown', x: 400, elapsed: 0 });

    encounter.update(29.9, 0.9);
    expect(encounter.state.phase).toBe('cooldown');
    encounter.update(0.1, 0.9);
    expect(encounter.state).toEqual({ phase: 'waiting', x: -100, elapsed: 0 });
    expect(encounter.getDartCount()).toBe(7);
    encounter.update(0.5, 0.9);
    expect(encounter.state).toEqual({ phase: 'approaching-pass', x: -50, elapsed: 0 });

    encounter.update(2, 0.9);
    expect(encounter.state).toEqual({ phase: 'driving-right', x: 150, elapsed: 0 });
    encounter.update(2, 0.9);
    expect(encounter.state).toEqual({ phase: 'stationed', x: 290, elapsed: 0 });
    encounter.update(3, 0.9);
    encounter.driveOff();
    encounter.update(2, 0.9);
    encounter.update(30, 0.9);
    expect(encounter.getDartCount()).toBe(9);
  });

  it('resets so the encounter can occur on the next run', () => {
    const encounter = createEncounter();
    encounter.update(2.5, 0.3);

    encounter.reset();

    expect(encounter.state).toEqual({ phase: 'waiting', x: -100, elapsed: 0 });
    expect(encounter.getDartCount()).toBe(5);
  });

  it('uses the configured hard-mode return interval', () => {
    const encounter = createVeterinarianEncounter({
      screenWidth: 400,
      truckWidth: 100,
      triggerSpeedRatio: 0.3,
      midpointX: 150,
      approachSpeed: 100,
      driveSpeed: 100,
      holdDuration: 2,
      returnIntervalSeconds: () => 5,
      initialDartCount: 5,
      dartCountIncrement: 2,
    });

    encounter.update(2.5, 0.3);
    encounter.update(2, 0.3);
    encounter.update(3, 0.3);
    encounter.driveOff();
    encounter.update(2, 0.3);
    encounter.update(4.9, 0.3);
    expect(encounter.state.phase).toBe('cooldown');
    encounter.update(0.1, 0.3);
    expect(encounter.state.phase).toBe('waiting');
  });
});
