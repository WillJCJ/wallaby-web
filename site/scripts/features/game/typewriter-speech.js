export const getSpeechDuration = (lines, characterSeconds, linePauseSeconds) => (
  lines.reduce((duration, line) => duration + line.length * characterSeconds + linePauseSeconds, 0)
);

export const getSpeechBubbleFrame = (lines, elapsed, characterSeconds, linePauseSeconds) => {
  let lineStart = 0;
  let index = 0;

  for (const fullText of lines) {
    const typingDuration = fullText.length * characterSeconds;
    const lineDuration = typingDuration + linePauseSeconds;

    if (elapsed < lineStart + lineDuration) {
      const lineElapsed = Math.max(0, elapsed - lineStart);
      const visibleCharacters = Math.min(
        fullText.length,
        Math.floor(lineElapsed / characterSeconds) + 1
      );
      return {
        index,
        fullText,
        text: fullText.slice(0, visibleCharacters),
      };
    }

    lineStart += lineDuration;
    index += 1;
  }

  return null;
};
