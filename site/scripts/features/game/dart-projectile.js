export const createDartProjectile = ({
  startX,
  startY,
  targetX,
  targetY,
  arcHeight,
}) => {
  const horizontalDistance = targetX - startX;
  const direction = Math.sign(horizontalDistance);
  const state = {
    x: startX,
    y: startY,
    progress: 0,
    angle: Math.atan2(targetY - startY, horizontalDistance),
    landed: horizontalDistance === 0,
  };

  const update = (deltaSeconds, speed) => {
    if (state.landed) {
      state.x += direction * speed * deltaSeconds;
      state.angle = direction < 0 ? Math.PI : 0;
      return state;
    }

    state.x += direction * speed * deltaSeconds;
    state.progress = Math.min(1, Math.abs(state.x - startX) / Math.abs(horizontalDistance));
    if (state.progress >= 1) {
      state.x = targetX;
      state.landed = true;
    }

    state.y = startY
            + (targetY - startY) * state.progress
            - 4 * arcHeight * state.progress * (1 - state.progress);
    const verticalTangent = targetY - startY - 4 * arcHeight * (1 - 2 * state.progress);
    state.angle = Math.atan2(verticalTangent, horizontalDistance);

    return state;
  };

  return { state, update };
};
