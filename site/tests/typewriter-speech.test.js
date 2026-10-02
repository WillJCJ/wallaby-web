import { describe, expect, it } from 'vitest';

import { getSpeechBubbleFrame, getSpeechDuration } from '../scripts/features/game/typewriter-speech.js';

describe('typewriter speech', () => {
  const lines = ['Hi.', 'Bye.'];

  it('types each line character by character and keeps it visible during its pause', () => {
    expect(getSpeechBubbleFrame(lines, 0, 0.1, 0.2)).toMatchObject({ index: 0, text: 'H' });
    expect(getSpeechBubbleFrame(lines, 0.1, 0.1, 0.2)).toMatchObject({ index: 0, text: 'Hi' });
    expect(getSpeechBubbleFrame(lines, 0.4, 0.1, 0.2)).toMatchObject({ index: 0, text: 'Hi.' });
    expect(getSpeechBubbleFrame(lines, 0.5, 0.1, 0.2)).toMatchObject({ index: 1, text: 'B' });
  });

  it('calculates total speech time and returns no line after sequence ends', () => {
    expect(getSpeechDuration(lines, 0.1, 0.2)).toBeCloseTo(1.1);
    expect(getSpeechBubbleFrame(lines, 1.1, 0.1, 0.2)).toBeNull();
  });
});
