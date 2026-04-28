export const setupGameInput = ({
  canvas,
  jumpBtn,
  shouldTriggerAction,
  onAction,
}) => {
  const inputState = {
    held: false,
    lastTouchInteractionAt: 0,
  };

  const markTouchInteraction = (event) => {
    if (event?.pointerType && event.pointerType !== 'mouse') {
      inputState.lastTouchInteractionAt = Date.now();
    }
  };

  const clearTouchFocus = (event) => {
    if (!event?.pointerType || event.pointerType === 'mouse') {
      return;
    }

    inputState.lastTouchInteractionAt = Date.now();

    if (event.currentTarget instanceof HTMLElement) {
      requestAnimationFrame(() => {
        event.currentTarget.blur();
      });
    }
  };

  const blurOnTouchFocus = (element) => {
    element.addEventListener('focus', () => {
      if (Date.now() - inputState.lastTouchInteractionAt > 500) {
        return;
      }

      requestAnimationFrame(() => {
        element.blur();
      });
    });
  };

  const pressInput = (event) => {
    if (event) event.preventDefault();
    clearTouchFocus(event);
    inputState.held = true;
    if (jumpBtn) jumpBtn.classList.add('is-pressed');
    if (shouldTriggerAction()) {
      onAction(event);
    }
  };

  const releaseInput = (event) => {
    clearTouchFocus(event);
    inputState.held = false;
    if (jumpBtn) jumpBtn.classList.remove('is-pressed');
  };

  const isJumpKey = (key) => key === ' ' || key === 'ArrowUp' || key === 'Enter';

  const holdInput = (event) => {
    if (event) event.preventDefault();
    inputState.held = true;
    if (jumpBtn) jumpBtn.classList.add('is-pressed');
  };

  blurOnTouchFocus(canvas);
  if (jumpBtn) {
    blurOnTouchFocus(jumpBtn);
  }

  canvas.addEventListener('pointerdown', markTouchInteraction);
  canvas.addEventListener('pointerdown', pressInput);
  canvas.addEventListener('pointerup', releaseInput);
  canvas.addEventListener('pointercancel', releaseInput);
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', markTouchInteraction);
    jumpBtn.addEventListener('pointerdown', pressInput);
    jumpBtn.addEventListener('pointerup', releaseInput);
    jumpBtn.addEventListener('pointercancel', releaseInput);
    jumpBtn.addEventListener('pointerleave', releaseInput);
  }

  canvas.addEventListener('keydown', (event) => {
    if (!isJumpKey(event.key)) return;
    if (event.repeat) {
      holdInput(event);
      return;
    }
    pressInput(event);
  });

  canvas.addEventListener('keyup', (event) => {
    if (!isJumpKey(event.key)) return;
    releaseInput();
  });

  window.addEventListener('keydown', (event) => {
    if (document.activeElement === canvas) return;
    if (event.target !== document.body) return;
    if (!isJumpKey(event.key)) return;
    if (event.repeat) {
      holdInput(event);
      return;
    }
    pressInput(event);
  });

  window.addEventListener('keyup', (event) => {
    if (!isJumpKey(event.key)) return;
    releaseInput();
  });

  window.addEventListener('blur', releaseInput);

  return inputState;
};
