export const createDartSleepTransition = ({
  fallSeconds = 0.45,
  blinkCount = 3,
  blinkCycleSeconds = 0.6,
  finalBlinkCloseSeconds = 0.8,
  finalBlackHoldSeconds = 0.35,
} = {}) => {
  const closeSeconds = blinkCycleSeconds / 2;
  const previousBlinksDuration = (blinkCount - 1) * blinkCycleSeconds;
  const duration = fallSeconds
    + previousBlinksDuration
    + finalBlinkCloseSeconds
    + finalBlackHoldSeconds;
  let elapsed = 0;

  const update = (deltaSeconds) => {
    elapsed = Math.min(duration, elapsed + deltaSeconds);
    const fallProgress = Math.min(1, elapsed / fallSeconds);
    const blinkElapsed = Math.max(0, elapsed - fallSeconds);
    const easing = (progress) => progress * progress * (3 - 2 * progress);

    let blackoutAlpha;
    if (elapsed >= duration) {
      blackoutAlpha = 1;
    } else if (blinkElapsed < previousBlinksDuration) {
      const blinkIndex = Math.floor(blinkElapsed / blinkCycleSeconds);
      const cycleProgress = blinkElapsed - blinkIndex * blinkCycleSeconds;
      blackoutAlpha = cycleProgress < closeSeconds
        ? easing(cycleProgress / closeSeconds)
        : 1 - easing((cycleProgress - closeSeconds) / closeSeconds);
    } else if (blinkElapsed < previousBlinksDuration + finalBlinkCloseSeconds) {
      const finalBlinkElapsed = blinkElapsed - previousBlinksDuration;
      blackoutAlpha = easing(finalBlinkElapsed / finalBlinkCloseSeconds);
    } else {
      blackoutAlpha = 1;
    }

    return {
      fallProgress,
      fallAngle: Math.PI / 2 * easing(fallProgress),
      blackoutAlpha,
      complete: elapsed >= duration,
    };
  };

  return { duration, update };
};
