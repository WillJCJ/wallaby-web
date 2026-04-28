import { describe, it, expect } from 'vitest';
import { createStatusSetter } from '../scripts/status-utils.js';

describe('createStatusSetter', () => {
  it('returns a function', () => {
    const fn = createStatusSetter(document.createElement('div'));
    expect(typeof fn).toBe('function');
  });

  it('sets message and tone class', () => {
    const el = document.createElement('div');
    const setStatus = createStatusSetter(el);
    setStatus('Success!', 'success');
    expect(el.textContent).toBe('Success!');
    expect(el.classList.contains('private-status--success')).toBe(true);
    setStatus('', 'success');
    expect(el.textContent).toBe('');
    expect(el.hidden).toBe(true);
  });
});
