export const createVeterinarianEncounter = ({
  screenWidth,
  truckWidth,
  triggerSpeedRatio,
  midpointX,
  approachSpeed,
  driveSpeed,
  holdDuration,
  returnIntervalSeconds,
  initialDartCount,
  dartCountIncrement,
}) => {
  const parkedX = screenWidth - truckWidth - 10;
  let completedReturns = 0;
  const state = {
    phase: 'waiting',
    x: -truckWidth,
    elapsed: 0,
  };

  const reset = () => {
    state.phase = 'waiting';
    state.x = -truckWidth;
    state.elapsed = 0;
    completedReturns = 0;
  };

  const getDartCount = () => initialDartCount + completedReturns * dartCountIncrement;

  const driveOff = () => {
    if (state.phase === 'stationed') {
      state.phase = 'driving-off';
      state.elapsed = 0;
    }
  };

  // eslint-disable-next-line complexity -- The state machine advances each encounter phase.
  const update = (deltaSeconds, speedRatio) => {
    if (state.phase === 'waiting') {
      if (speedRatio < triggerSpeedRatio) {
        return;
      }
      state.phase = completedReturns === 0 ? 'approaching' : 'approaching-pass';
    }

    if (state.phase === 'approaching-pass') {
      state.x = Math.min(midpointX, state.x + approachSpeed * deltaSeconds);
      if (state.x >= midpointX) {
        state.phase = 'driving-right';
      }
      return;
    }

    if (state.phase === 'approaching') {
      state.x = Math.min(midpointX, state.x + approachSpeed * deltaSeconds);
      if (state.x >= midpointX) {
        state.phase = 'alongside';
        state.elapsed = 0;
      }
      return;
    }

    if (state.phase === 'alongside') {
      state.elapsed += deltaSeconds;
      if (state.elapsed >= holdDuration) {
        state.phase = 'driving-right';
        state.elapsed = 0;
      }
      return;
    }

    if (state.phase === 'driving-right') {
      state.x = Math.min(parkedX, state.x + driveSpeed * deltaSeconds);
      if (state.x >= parkedX) {
        state.phase = 'stationed';
      }
      return;
    }

    if (state.phase === 'driving-off') {
      state.x = Math.min(screenWidth, state.x + driveSpeed * deltaSeconds);
      if (state.x >= screenWidth) {
        state.phase = 'cooldown';
        state.elapsed = 0;
      }
      return;
    }

    if (state.phase === 'cooldown') {
      state.elapsed += deltaSeconds;
      const interval = typeof returnIntervalSeconds === 'function'
        ? returnIntervalSeconds()
        : returnIntervalSeconds;
      if (state.elapsed >= interval) {
        state.phase = 'waiting';
        state.x = -truckWidth;
        state.elapsed = 0;
        completedReturns += 1;
      }
    }
  };

  return { state, reset, update, driveOff, getDartCount };
};
