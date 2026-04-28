export const createRunFlow = ({
  state,
  startSpeed,
  groundY,
  jumpVelocity,
  width,
  randomBetween,
  spawnCloud,
  spawnTree,
  jumpBtn,
  bestEl,
  bestKey,
  online,
}) => {
  let runCounter = 0;
  let activeRun = null;

  const resetRun = () => {
    state.time = 0;
    state.speed = startSpeed;
    state.score = 0;
    state.lastRunWasHighScore = false;
    state.obstacles.length = 0;
    state.clouds.length = 0;
    state.trees.length = 0;
    state.camps.length = 0;
    state.quails.length = 0;
    state.wallaby.y = groundY;
    state.wallaby.vy = 0;
    state.wallaby.grounded = true;
    state.wallaby.legPhase = 0;
    state.groundOffset = 0;
    state.nextObstacleIn = 0.8;
    state.nightBlend = 0;
    for (let i = 0; i < 3; i++) {
      spawnCloud(randomBetween(0, width));
    }
    for (let i = 0; i < 4; i++) {
      spawnTree(randomBetween(0, width));
    }
  };

  const jump = () => {
    if (!state.wallaby.grounded) return;
    state.wallaby.vy = jumpVelocity;
    state.wallaby.grounded = false;
  };

  const startGame = () => {
    resetRun();
    state.status = 'running';
    if (jumpBtn) {
      jumpBtn.textContent = 'Jump';
      jumpBtn.setAttribute('aria-label', 'Jump');
    }
    jump();

    runCounter += 1;
    activeRun = {
      token: runCounter,
      runId: null,
      finished: false,
    };
    void online.startRunSync(activeRun);
  };

  const endGame = () => {
    state.status = 'over';
    const finalScore = Math.floor(state.score);
    const hasNewHighScore = finalScore > state.best;
    const runToFinish = activeRun;
    activeRun = null;
    if (hasNewHighScore) {
      state.best = finalScore;
      bestEl.textContent = state.best;
      try {
        localStorage.setItem(bestKey, String(state.best));
      } catch {
        // ignore storage errors
      }
    }
    state.lastRunWasHighScore = hasNewHighScore;
    if (jumpBtn) {
      jumpBtn.textContent = 'Restart';
      jumpBtn.setAttribute('aria-label', 'Restart game');
    }

    void online.finishRunSync(runToFinish, finalScore, Math.max(0, Math.round(state.time * 1000)));
  };

  const handleInput = (event) => {
    if (event) {
      event.preventDefault();
    }
    if (state.status === 'running') {
      jump();
    } else {
      startGame();
    }
  };

  return {
    resetRun,
    jump,
    startGame,
    endGame,
    handleInput,
  };
};
