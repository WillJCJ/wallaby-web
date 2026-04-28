const createLeaderboardHelpers = ({ topScoresEl, topScoresLimit }) => {
  const normaliseLeaderboard = (payload) => {
    if (!payload || !Array.isArray(payload.leaderboard)) {
      return [];
    }

    return payload.leaderboard
      .map((row) => ({
        displayName: typeof row.displayName === 'string' ? row.displayName : 'Guest',
        score: Number.parseInt(row.score, 10) || 0,
        isViewer: Boolean(row.isViewer),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topScoresLimit);
  };

  const renderLeaderboard = (rows) => {
    if (!topScoresEl) {return;}
    topScoresEl.textContent = '';

    if (!rows.length) {
      const empty = document.createElement('li');
      empty.className = 'wallaby-game__empty';
      empty.textContent = 'No online scores yet.';
      topScoresEl.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('span');
      name.className = 'wallaby-game__score-name';
      if (row.isViewer) {
        name.classList.add('wallaby-game__score-name--mine');
      }
      name.textContent = row.displayName;
      score.className = 'wallaby-game__score-value';
      score.textContent = String(row.score);
      li.append(name, score);
      topScoresEl.appendChild(li);
    });
  };

  return {
    normaliseLeaderboard,
    renderLeaderboard,
  };
};

export const createOnlineHelpers = ({
  onlineStatusEl,
  signInWarningEl,
  topScoresEl,
  topScoresLimit,
  highScoresEndpoint,
  startRunEndpoint,
  getAuth,
}) => {
  const { normaliseLeaderboard, renderLeaderboard } = createLeaderboardHelpers({
    topScoresEl,
    topScoresLimit,
  });
  let isSignedIn = false;

  const clearOnlineStatus = () => {
    if (!onlineStatusEl) {return;}
    onlineStatusEl.hidden = true;
    onlineStatusEl.textContent = '';
    onlineStatusEl.className = 'wallaby-game__online-status';
  };

  const showOnlineStatusError = (message) => {
    if (!onlineStatusEl) {return;}
    onlineStatusEl.textContent = message;
    onlineStatusEl.hidden = false;
    onlineStatusEl.className = 'wallaby-game__online-status wallaby-game__online-status--error';
  };

  const renderSignInWarning = () => {
    if (!signInWarningEl) {return;}
    signInWarningEl.hidden = isSignedIn;
  };

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return response.json().catch(() => ({}));
  };

  const refreshOnlineScores = async () => {
    try {
      const payload = await apiJson(highScoresEndpoint, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      renderLeaderboard(normaliseLeaderboard(payload));
      clearOnlineStatus();
    } catch {
      showOnlineStatusError('Online leaderboard is unavailable.');
    }
  };

  const startRunSync = async (run) => {
    if (!isSignedIn || !run) {
      return;
    }

    try {
      const payload = await apiJson(startRunEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (typeof payload.runId === 'string') {
        run.runId = payload.runId;
      }
    } catch {
      showOnlineStatusError('Could not start online run sync.');
    }
  };

  const finishRunSync = async (run, score, durationMs) => {
    if (!run || run.finished) {
      return;
    }
    run.finished = true;

    if (!isSignedIn) {
      return;
    }

    if (!run.runId) {
      showOnlineStatusError('Could not submit score online.');
      return;
    }

    try {
      const payload = await apiJson(
        `/api/private/game/runs/${encodeURIComponent(run.runId)}/finish`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ score, durationMs }),
        }
      );

      renderLeaderboard(normaliseLeaderboard(payload));
      clearOnlineStatus();
    } catch {
      showOnlineStatusError('Could not submit score online.');
    }
  };

  const initOnlineScores = () => {
    clearOnlineStatus();
    const auth = getAuth();
    const fetchSignedIn = auth?.fetchSignedIn;
    if (typeof fetchSignedIn !== 'function') {
      isSignedIn = Boolean(auth?.getStoredAuthEmail?.());
      renderSignInWarning();
      void refreshOnlineScores();
      return;
    }

    fetchSignedIn()
      .then((signedIn) => {
        isSignedIn = Boolean(signedIn) || Boolean(auth?.getStoredAuthEmail?.());
        renderSignInWarning();
      })
      .catch(() => {
        isSignedIn = Boolean(auth?.getStoredAuthEmail?.());
        renderSignInWarning();
      })
      .finally(() => {
        void refreshOnlineScores();
      });
  };

  const handleAuthStateChange = (event) => {
    isSignedIn = Boolean(event?.detail?.email);
    renderSignInWarning();
    void refreshOnlineScores();
  };

  return {
    startRunSync,
    finishRunSync,
    initOnlineScores,
    handleAuthStateChange,
  };
};
