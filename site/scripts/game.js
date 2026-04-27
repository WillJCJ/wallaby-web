(() => {
  const canvas = document.getElementById('wallaby-game-canvas');
  const scoreEl = document.getElementById('wallaby-game-score');
  const bestEl = document.getElementById('wallaby-game-best');
  const jumpBtn = document.getElementById('wallaby-game-jump-btn');
  const onlineStatusEl = document.getElementById('wallaby-game-online-status');
  const topScoresEl = document.getElementById('wallaby-game-top-scores');
  const personalBestEl = document.getElementById('wallaby-game-personal-best');
  let btnHeld = false;

  if (!canvas || !canvas.getContext) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const BEST_KEY = 'wallabyfest-game-best';
  const HIGH_SCORES_ENDPOINT = '/api/game/high-scores';
  const START_RUN_ENDPOINT = '/api/private/game/runs/start';
  const TOP_SCORES_LIMIT = 10;

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = HEIGHT - 65;
  const GRAVITY = 2200;
  const JUMP_VELOCITY = -720;
  const START_SPEED = 320;
  const MAX_SPEED = 720;
  const SPEED_GROWTH = 8;
  const DAY_NIGHT_SCORE_CYCLE = 1000;
  const HALF_DAY_NIGHT_CYCLE = DAY_NIGHT_SCORE_CYCLE / 2;
  const MOON_PHASES = [
    { kind: 'waxing', shadowOffsetRatio: 0.55 }, // waxing crescent
    { kind: 'waxing', shadowOffsetRatio: 1.0 },  // first quarter (half)
    { kind: 'waxing', shadowOffsetRatio: 1.45 }, // waxing gibbous
    { kind: 'full' },                            // full moon
    { kind: 'waning', shadowOffsetRatio: 1.45 }, // waning gibbous
    { kind: 'waning', shadowOffsetRatio: 1.0 },  // last quarter (half)
    { kind: 'waning', shadowOffsetRatio: 0.55 }, // waning crescent
  ];

  const COLOURS_DAY = {
    sky: '#79c8ff',
    groundLine: '#4a8c42',
    grass: '#6fbe4e',
    grassDark: '#4a8c42',
    grassBlade: '#88cf64',
    wallabyBody: '#b87630',
    wallabyBelly: '#d1ac7b',
    wallabyEar: '#8f5a25',
    wallabyEye: '#1f2937',
    goatBody: '#f1f3f5',
    goatBelly: '#ffffff',
    goatHoof: '#4b5563',
    goatHorn: '#8b7355',
    goatFace: '#dbcdb6',
    treeTrunk: '#7a4f2e',
    treeCanopy: '#4f9b3d',
    treeCanopyDark: '#3f7f32',
    cloud: '#e5e7eb',
    tentCanvas: '#d78748',
    tentCanvasDark: '#b86a31',
    tentPole: '#7a4f2e',
    tentDoor: '#6a3e23',
    fireLog: '#7a4f2e',
    // Keep flames invisible in daytime; the night palette fades them in.
    fireOuter: 'rgba(245, 165, 36, 0)',
    fireInner: 'rgba(253, 230, 138, 0)',
    fireEmber: 'rgba(220, 38, 38, 0)',
    quailBody: '#9b734c',
    quailBelly: '#e5cfaf',
    quailHead: '#7b5638',
    quailBeak: '#8a4b24',
    quailPlume: '#5e3b25',
    chickenBody: '#fafafa',
    chickenWing: '#e2ddd3',
    chickenComb: '#dc2626',
    chickenBeak: '#f5a524',
    chickenLeg: '#f5a524',
    chickenEye: '#1f2937',
    text: '#f9fafb',
    accent: '#f5c842',
    sunGlow: 'rgba(255, 227, 145, 0.35)',
    sunBody: '#ffd166',
    moonBody: '#f2e3b0',
    moonCraterA: '#ddcfa1',
    moonCraterB: '#d2c392',
    shadow: 'rgba(0, 0, 0, 0.35)',
    shadowLight: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(26, 26, 46, 0.72)',
  };

  const COLOURS_NIGHT = {
    sky: '#0b1f44',
    groundLine: '#2b5730',
    grass: '#2f6036',
    grassDark: '#22482a',
    grassBlade: '#3e7a45',
    wallabyBody: '#8f5f2d',
    wallabyBelly: '#b39268',
    wallabyEar: '#714820',
    wallabyEye: '#dbe7ff',
    goatBody: '#d4dce8',
    goatBelly: '#edf2fa',
    goatHoof: '#344054',
    goatHorn: '#7a6a57',
    goatFace: '#c4b7a3',
    treeTrunk: '#68452a',
    treeCanopy: '#2f6738',
    treeCanopyDark: '#224c2b',
    cloud: '#8e99ad',
    tentCanvas: '#e98a3c',
    tentCanvasDark: '#975a2f',
    tentPole: '#68452a',
    tentDoor: '#57341f',
    fireLog: '#7a4f2e',
    fireOuter: '#e39423',
    fireInner: '#f6d580',
    fireEmber: '#bf2f2f',
    // Quails fly away at night (despite being flightless I think?)
    quailBody: 'rgba(125, 95, 67, 0)',
    quailBelly: 'rgba(203, 185, 153, 0)',
    quailHead: 'rgba(102, 73, 49, 0)',
    quailBeak: 'rgba(117, 65, 31, 0)',
    quailPlume: 'rgba(81, 51, 31, 0)',
    chickenBody: '#e7ecf2',
    chickenWing: '#d0d8e2',
    chickenComb: '#b12a2a',
    chickenBeak: '#dd9823',
    chickenLeg: '#dd9823',
    chickenEye: '#111827',
    text: '#e8efff',
    accent: '#e3c060',
    sunGlow: 'rgba(255, 206, 120, 0.28)',
    sunBody: '#f5c36f',
    moonBody: '#eddca8',
    moonCraterA: '#d5c594',
    moonCraterB: '#cab986',
    shadow: 'rgba(6, 15, 36, 0.45)',
    shadowLight: 'rgba(6, 15, 36, 0.38)',
    overlay: 'rgba(6, 15, 36, 0.78)',
  };

  const parseColour = (value) => {
    if (value.startsWith('#')) {
      const hex = value.slice(1);
      if (hex.length === 3) {
        return {
          r: Number.parseInt(hex[0] + hex[0], 16),
          g: Number.parseInt(hex[1] + hex[1], 16),
          b: Number.parseInt(hex[2] + hex[2], 16),
          a: 1,
        };
      }

      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }

    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return { r: 0, g: 0, b: 0, a: 1 };
    }

    const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
    return {
      r: Number.isFinite(parts[0]) ? parts[0] : 0,
      g: Number.isFinite(parts[1]) ? parts[1] : 0,
      b: Number.isFinite(parts[2]) ? parts[2] : 0,
      a: Number.isFinite(parts[3]) ? parts[3] : 1,
    };
  };

  const interpolateColour = (dayValue, nightValue, blend) => {
    const day = parseColour(dayValue);
    const night = parseColour(nightValue);
    const t = Math.max(0, Math.min(1, blend));
    const r = Math.round(day.r + (night.r - day.r) * t);
    const g = Math.round(day.g + (night.g - day.g) * t);
    const b = Math.round(day.b + (night.b - day.b) * t);
    const a = day.a + (night.a - day.a) * t;
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  };

  const buildActiveColours = (nightBlend) => {
    const active = {};
    Object.keys(COLOURS_DAY).forEach((key) => {
      active[key] = interpolateColour(COLOURS_DAY[key], COLOURS_NIGHT[key], nightBlend);
    });
    return active;
  };

  let activeColours = buildActiveColours(0);

  const state = {
    status: 'ready', // ready | running | over
    time: 0,
    speed: START_SPEED,
    score: 0,
    best: 0,
    wallaby: {
      x: 72,
      y: GROUND_Y,
      vy: 0,
      width: 52,
      height: 46,
      grounded: true,
      legPhase: 0,
    },
    obstacles: [],
    clouds: [],
    trees: [],
    camps: [],
    quails: [],
    groundOffset: 0,
    nextObstacleIn: 0.8,
    nightBlend: 0,
    wasNight: false,
    moonPhaseIndex: 0,
    lastRunWasHighScore: false,
  };

  try {
    const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (Number.isFinite(stored) && stored > 0) {
      state.best = stored;
    }
  } catch {
    // storage may be unavailable; ignore
  }
  bestEl.textContent = state.best;

  let authEmail = null;
  let runCounter = 0;
  let activeRun = null;

  const clearOnlineStatus = () => {
    if (!onlineStatusEl) return;
    onlineStatusEl.hidden = true;
    onlineStatusEl.textContent = '';
    onlineStatusEl.className = 'wallaby-game__online-status';
  };

  const showOnlineStatusError = (message) => {
    if (!onlineStatusEl) return;
    onlineStatusEl.textContent = message;
    onlineStatusEl.hidden = false;
    onlineStatusEl.className = 'wallaby-game__online-status wallaby-game__online-status--error';
  };

  const normaliseLeaderboard = (payload) => {
    if (!payload || !Array.isArray(payload.leaderboard)) {
      return [];
    }

    return payload.leaderboard
      .map((row) => ({
        displayName: typeof row.displayName === 'string' ? row.displayName : 'Guest',
        score: Number.parseInt(row.score, 10) || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_SCORES_LIMIT);
  };

  const renderLeaderboard = (rows) => {
    if (!topScoresEl) return;
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
      name.textContent = row.displayName;
      score.className = 'wallaby-game__score-value';
      score.textContent = String(row.score);
      li.append(name, score);
      topScoresEl.appendChild(li);
    });
  };

  const renderMyBest = (myBest) => {
    if (!personalBestEl) return;
    if (!myBest || typeof myBest.score !== 'number') {
      personalBestEl.hidden = true;
      personalBestEl.textContent = '';
      return;
    }

    personalBestEl.hidden = false;
    personalBestEl.textContent = `Your online best: ${myBest.score}`;
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
      const payload = await apiJson(HIGH_SCORES_ENDPOINT, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      renderLeaderboard(normaliseLeaderboard(payload));
      renderMyBest(payload.myBest || null);
      clearOnlineStatus();
    } catch {
      showOnlineStatusError('Online leaderboard is unavailable.');
    }
  };

  const startRunSync = async (run) => {
    if (!authEmail || !run) {
      return;
    }

    try {
      const payload = await apiJson(START_RUN_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (activeRun && activeRun.token === run.token && typeof payload.runId === 'string') {
        activeRun.runId = payload.runId;
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

    if (!authEmail) {
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
      renderMyBest(payload.myBest || null);
      clearOnlineStatus();
    } catch {
      showOnlineStatusError('Could not submit score online.');
    }
  };

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const spawnCloud = (x) => {
    state.clouds.push({
      x: x ?? WIDTH + randomBetween(20, 120),
      y: randomBetween(20, 90),
      scale: randomBetween(0.6, 1.1),
      speed: randomBetween(30, 55),
    });
  };

  const spawnTree = (x) => {
    state.trees.push({
      x: x ?? WIDTH + randomBetween(40, 180),
      // Trees sit on the horizon line (top of grass strip).
      baseY: GROUND_Y + randomBetween(-2, 4),
      scale: randomBetween(0.7, 1.15),
      speed: randomBetween(55, 75),
      variant: Math.random() < 0.5 ? 0 : 1,
    });
  };

  const spawnCamp = (x) => {
    state.camps.push({
      x: x ?? WIDTH + randomBetween(80, 240),
      baseY: GROUND_Y + randomBetween(-1, 3),
      scale: randomBetween(0.9, 1.15),
      speed: randomBetween(55, 75),
      flicker: Math.random() * Math.PI * 2,
    });
  };

  const spawnQuailGroup = (x) => {
    const groupX = x ?? WIDTH + randomBetween(40, 180);
    const count = 3 + Math.floor(Math.random() * 3);
    const speed = randomBetween(55, 75);
    const scale = randomBetween(0.7, 1.0);
    for (let i = 0; i < count; i++) {
      state.quails.push({
        x: groupX + i * randomBetween(10, 16),
        baseY: GROUND_Y + randomBetween(-2, 4),
        scale: scale * randomBetween(0.85, 1.1),
        speed,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  };

  const spawnObstacle = () => {
    // Mix goats with the occasional hopping chicken.
    const isChicken = Math.random() < 0.3;
    if (isChicken) {
      const scale = randomBetween(0.7, 1.0);
      const width = 30 * scale;
      const height = 26 * scale;
      state.obstacles.push({
        type: 'chicken',
        x: WIDTH + 20,
        width,
        height,
        scale,
        legPhase: Math.random() * Math.PI * 2,
        hopPhase: Math.random() * Math.PI * 2,
      });
    } else {
      const scale = randomBetween(0.5, 1.5);
      const width = 44 * scale;
      const height = 34 * scale;
      state.obstacles.push({
        type: 'goat',
        x: WIDTH + 20,
        width,
        height,
        scale,
        legPhase: Math.random() * Math.PI * 2,
      });
    }
    // Gap scales with speed so faster runs keep the same rhythm.
    const minGap = Math.max(0.6, 260 / state.speed);
    const maxGap = Math.max(1.1, 520 / state.speed);
    state.nextObstacleIn = randomBetween(minGap, maxGap);
  };

  const resetRun = () => {
    state.time = 0;
    state.speed = START_SPEED;
    state.score = 0;
    state.lastRunWasHighScore = false;
    state.obstacles.length = 0;
    state.clouds.length = 0;
    state.trees.length = 0;
    state.camps.length = 0;
    state.quails.length = 0;
    state.wallaby.y = GROUND_Y;
    state.wallaby.vy = 0;
    state.wallaby.grounded = true;
    state.wallaby.legPhase = 0;
    state.groundOffset = 0;
    state.nextObstacleIn = 0.8;
    state.nightBlend = 0;
    for (let i = 0; i < 3; i++) {
      spawnCloud(randomBetween(0, WIDTH));
    }
    for (let i = 0; i < 4; i++) {
      spawnTree(randomBetween(0, WIDTH));
    }
  };

  const jump = () => {
    if (!state.wallaby.grounded) return;
    state.wallaby.vy = JUMP_VELOCITY;
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
    void startRunSync(activeRun);
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
        localStorage.setItem(BEST_KEY, String(state.best));
      } catch {
        // ignore storage errors
      }
    }
    state.lastRunWasHighScore = hasNewHighScore;
    if (jumpBtn) {
      jumpBtn.textContent = 'Restart';
      jumpBtn.setAttribute('aria-label', 'Restart game');
    }

    void finishRunSync(runToFinish, finalScore, Math.max(0, Math.round(state.time * 1000)));
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

  const pressInput = (e) => {
    if (e) e.preventDefault();
    btnHeld = true;
    if (jumpBtn) jumpBtn.classList.add('is-pressed');
    if (state.status !== 'running' || state.wallaby.grounded) {
      handleInput(e);
    }
  };

  const releaseInput = () => {
    btnHeld = false;
    if (jumpBtn) jumpBtn.classList.remove('is-pressed');
  };

  canvas.addEventListener('pointerdown', pressInput);
  canvas.addEventListener('pointerup', releaseInput);
  canvas.addEventListener('pointercancel', releaseInput);
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', pressInput);
    jumpBtn.addEventListener('pointerup', releaseInput);
    jumpBtn.addEventListener('pointercancel', releaseInput);
    jumpBtn.addEventListener('pointerleave', releaseInput);
  }
  canvas.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'Enter') {
      handleInput(event);
    }
  });
  window.addEventListener('keydown', (event) => {
    if (document.activeElement === canvas) return;
    if (event.key === ' ' && event.target === document.body) {
      handleInput(event);
    }
  });

  const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => (
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
  );

  const update = (dt) => {
    const scorePhase = state.score % DAY_NIGHT_SCORE_CYCLE;
    const isNight = scorePhase > HALF_DAY_NIGHT_CYCLE;
    if (isNight && !state.wasNight) {
      state.moonPhaseIndex = (state.moonPhaseIndex + 1) % MOON_PHASES.length;
    }
    state.wasNight = isNight;

    const targetNightBlend = isNight ? 1 : 0;
    const blendStep = Math.min(1, dt * 4);
    state.nightBlend += (targetNightBlend - state.nightBlend) * blendStep;

    if (state.status !== 'running') {
      // Drift scenery gently on the title/game-over screen.
      state.clouds.forEach((c) => { c.x -= c.speed * 0.3 * dt; });
      state.clouds = state.clouds.filter((c) => c.x + 60 > 0);
      while (state.clouds.length < 3) spawnCloud();
      state.trees.forEach((t) => { t.x -= t.speed * 0.3 * dt; });
      state.trees = state.trees.filter((t) => t.x + 60 > 0);
      while (state.trees.length < 4) spawnTree();
      state.camps.forEach((c) => { c.x -= c.speed * 0.3 * dt; c.flicker += dt * 6; });
      state.camps = state.camps.filter((c) => c.x + 80 > 0);
      state.quails.forEach((q) => { q.x -= q.speed * 0.3 * dt; q.bobPhase += dt * 8; });
      state.quails = state.quails.filter((q) => q.x + 20 > 0);
      return;
    }

    state.time += dt;
    state.speed = Math.min(MAX_SPEED, START_SPEED + state.time * SPEED_GROWTH);
    state.score += dt * 10 + state.speed * dt * 0.02;
    scoreEl.textContent = Math.floor(state.score);

    // Wallaby physics
    const w = state.wallaby;
    w.vy += GRAVITY * dt;
    w.y += w.vy * dt;
    if (w.y >= GROUND_Y) {
      w.y = GROUND_Y;
      w.vy = 0;
      w.grounded = true;
      if (btnHeld) {
        jump();
        if (jumpBtn) jumpBtn.classList.add('is-pressed');
      }
    }
    if (w.grounded) {
      w.legPhase = (w.legPhase + dt * state.speed * 0.04) % (Math.PI * 2);
    }

    // Ground scroll
    state.groundOffset = (state.groundOffset + state.speed * dt) % 40;

    // Clouds
    state.clouds.forEach((c) => { c.x -= c.speed * dt; });
    state.clouds = state.clouds.filter((c) => c.x + 60 > 0);
    if (state.clouds.length < 3 && Math.random() < 0.6 * dt) {
      spawnCloud();
    }

    // Trees (parallax: slower than ground)
    state.trees.forEach((t) => { t.x -= t.speed * dt; });
    state.trees = state.trees.filter((t) => t.x + 60 > 0);
    if (state.trees.length < 4 && Math.random() < 1.2 * dt) {
      spawnTree();
    }

    // Camps (tent + campfire) — rare background dressing.
    state.camps.forEach((c) => { c.x -= c.speed * dt; c.flicker += dt * 6; });
    state.camps = state.camps.filter((c) => c.x + 80 > 0);
    if (state.camps.length < 1 && Math.random() < 0.06 * dt) {
      spawnCamp();
    }

    // Quail groups — occasional background flock.
    state.quails.forEach((q) => { q.x -= q.speed * dt; q.bobPhase += dt * 8; });
    state.quails = state.quails.filter((q) => q.x + 20 > 0);
    if (state.quails.length < 6 && Math.random() < 0.15 * dt) {
      spawnQuailGroup();
    }

    // Obstacles
    state.nextObstacleIn -= dt;
    if (state.nextObstacleIn <= 0) {
      spawnObstacle();
    }
    state.obstacles.forEach((o) => {
      o.x -= state.speed * dt;
      o.legPhase = (o.legPhase + dt * 10) % (Math.PI * 2);
      if (o.type === 'chicken') {
        o.hopPhase = (o.hopPhase + dt * 6) % (Math.PI * 2);
      }
    });
    state.obstacles = state.obstacles.filter((o) => o.x + o.width > -10);

    // Collision
    const hitboxPad = 6;
    const wx = w.x - w.width / 2 + hitboxPad;
    const wy = w.y - w.height + hitboxPad;
    const ww = w.width - hitboxPad * 2;
    const wh = w.height - hitboxPad;
    for (const o of state.obstacles) {
      const ox = o.x;
      const hop = o.type === 'chicken' ? Math.max(0, Math.sin(o.hopPhase)) * 27 : 0;
      const oy = GROUND_Y - o.height - hop;
      if (rectsOverlap(wx, wy, ww, wh, ox, oy, o.width, o.height)) {
        endGame();
        break;
      }
    }
  };

  const drawCloud = (cloud) => {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);
    ctx.scale(cloud.scale, cloud.scale);
    ctx.fillStyle = activeColours.cloud;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.arc(12, -4, 12, 0, Math.PI * 2);
    ctx.arc(26, 0, 10, 0, Math.PI * 2);
    ctx.arc(14, 6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawSkyBodies = (scorePhase) => {
    const dayProgress = Math.max(0, Math.min(1, scorePhase / HALF_DAY_NIGHT_CYCLE));
    const nightProgress = Math.max(0, Math.min(1, (scorePhase - HALF_DAY_NIGHT_CYCLE) / HALF_DAY_NIGHT_CYCLE));

    const getArcPosition = (progress) => {
      const x = -50 + (WIDTH + 100) * progress;
      const arc = (progress - 0.5) * 2;
      const y = 88 + arc * arc * 142;
      return { x, y };
    };

    // Sun travels during the day half of the score cycle.
    const sunPos = getArcPosition(dayProgress);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - state.nightBlend);
    ctx.fillStyle = activeColours.sunGlow;
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = activeColours.sunBody;
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Moon travels during the night half of the score cycle.
    const moonPos = getArcPosition(nightProgress);
    const moonRadius = 13;
    const moonPhase = MOON_PHASES[state.moonPhaseIndex];
    const litDirection = moonPhase.kind === 'full' ? 0 : moonPhase.kind === 'waxing' ? 1 : -1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, state.nightBlend);
    ctx.fillStyle = activeColours.moonBody;
    ctx.beginPath();
    ctx.arc(moonPos.x, moonPos.y, moonRadius, 0, Math.PI * 2);
    ctx.fill();

    // Craters are offset toward the illuminated side so they remain on the bright face.
    const craterOffsetX = litDirection * 3;
    ctx.fillStyle = activeColours.moonCraterA;
    ctx.beginPath();
    ctx.arc(moonPos.x + craterOffsetX - 3, moonPos.y - 2, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = activeColours.moonCraterB;
    ctx.beginPath();
    ctx.arc(moonPos.x + craterOffsetX + 2.5, moonPos.y + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();

    if (moonPhase.kind !== 'full') {
      const direction = moonPhase.kind === 'waxing' ? -1 : 1;
      const cutoutX = moonPos.x + direction * moonRadius * moonPhase.shadowOffsetRatio;
      ctx.fillStyle = activeColours.sky;
      ctx.beginPath();
      ctx.arc(cutoutX, moonPos.y, moonRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawTree = (tree) => {
    ctx.save();
    ctx.translate(tree.x, tree.baseY);
    ctx.scale(tree.scale, tree.scale);

    // Trunk
    ctx.fillStyle = activeColours.treeTrunk;
    ctx.fillRect(-3, -32, 6, 32);

    // Canopy (back layer)
    ctx.fillStyle = activeColours.treeCanopyDark;
    ctx.beginPath();
    ctx.ellipse(-8, -38, 14, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -36, 13, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -50, 15, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Canopy (front highlight)
    ctx.fillStyle = activeColours.treeCanopy;
    if (tree.variant === 0) {
      ctx.beginPath();
      ctx.arc(-4, -44, 12, 0, Math.PI * 2);
      ctx.arc(8, -40, 10, 0, Math.PI * 2);
      ctx.arc(2, -54, 11, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(-10, -40, 10, 0, Math.PI * 2);
      ctx.arc(6, -44, 11, 0, Math.PI * 2);
      ctx.arc(-2, -52, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawCamp = (camp) => {
    ctx.save();
    ctx.translate(camp.x, camp.baseY);
    ctx.scale(camp.scale, camp.scale);

    // Tent shadow on the ground
    ctx.fillStyle = activeColours.shadow;
    ctx.beginPath();
    ctx.ellipse(-4, 2, 34, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tent body (triangle)
    ctx.fillStyle = activeColours.tentCanvas;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(0, -34);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fill();

    // Shaded side
    ctx.fillStyle = activeColours.tentCanvasDark;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(26, 0);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fill();

    // Door flap
    ctx.fillStyle = activeColours.tentDoor;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, -22);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fill();

    // Ridge pole tip
    ctx.strokeStyle = activeColours.tentPole;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(0, -32);
    ctx.stroke();

    // Campfire to the left of the tent
    const fx = -38;
    const fy = -2;
    ctx.strokeStyle = activeColours.fireLog;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy);
    ctx.lineTo(fx + 8, fy);
    ctx.moveTo(fx - 6, fy + 2);
    ctx.lineTo(fx + 6, fy - 2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    const flick = 1 + Math.sin(camp.flicker) * 0.12;
    ctx.fillStyle = activeColours.fireOuter;
    ctx.beginPath();
    ctx.moveTo(fx - 6, fy - 1);
    ctx.quadraticCurveTo(fx - 3, fy - 10 * flick, fx, fy - 14 * flick);
    ctx.quadraticCurveTo(fx + 3, fy - 10 * flick, fx + 6, fy - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = activeColours.fireInner;
    ctx.beginPath();
    ctx.moveTo(fx - 3, fy - 1);
    ctx.quadraticCurveTo(fx - 1, fy - 6 * flick, fx, fy - 9 * flick);
    ctx.quadraticCurveTo(fx + 1, fy - 6 * flick, fx + 3, fy - 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = activeColours.fireEmber;
    ctx.beginPath();
    ctx.arc(fx - 4, fy, 1.2, 0, Math.PI * 2);
    ctx.arc(fx + 5, fy + 1, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const drawQuail = (quail) => {
    const bob = Math.sin(quail.bobPhase) * 0.6;
    ctx.save();
    ctx.translate(quail.x, quail.baseY + bob);
    ctx.scale(quail.scale, quail.scale);

    ctx.fillStyle = activeColours.quailBody;
    ctx.beginPath();
    ctx.ellipse(0, -5, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.quailBelly;
    ctx.beginPath();
    ctx.ellipse(-1, -4, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.quailHead;
    ctx.beginPath();
    ctx.arc(5, -9, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = activeColours.quailPlume;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(5, -12);
    ctx.quadraticCurveTo(3, -15, 4, -17);
    ctx.stroke();

    ctx.fillStyle = activeColours.quailBeak;
    ctx.beginPath();
    ctx.moveTo(7, -9);
    ctx.lineTo(9, -8);
    ctx.lineTo(7, -7.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = activeColours.quailBeak;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-2, 2);
    ctx.moveTo(2, 0);
    ctx.lineTo(2, 2);
    ctx.stroke();

    ctx.restore();
  };

  const drawChicken = (o) => {
    const hop = Math.max(0, Math.sin(o.hopPhase)) * 21;
    const baseY = GROUND_Y - hop;
    const s = o.scale;
    ctx.save();
    ctx.translate(o.x + o.width / 2, baseY);

    const shadowScale = Math.max(0.4, 1 - hop / 30);
    ctx.fillStyle = activeColours.shadowLight;
    ctx.beginPath();
    ctx.ellipse(0, hop + 2, o.width * 0.4 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.chickenBody;
    ctx.beginPath();
    ctx.ellipse(0, -o.height * 0.55, o.width * 0.4, o.height * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.chickenWing;
    ctx.beginPath();
    ctx.ellipse(-o.width * 0.05, -o.height * 0.55, o.width * 0.22, o.height * 0.25, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.chickenBody;
    ctx.beginPath();
    ctx.arc(o.width * 0.32, -o.height * 0.95, o.width * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.chickenComb;
    ctx.beginPath();
    ctx.arc(o.width * 0.28, -o.height * 1.12, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(o.width * 0.34, -o.height * 1.16, 2.4 * s, 0, Math.PI * 2);
    ctx.arc(o.width * 0.4, -o.height * 1.12, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(o.width * 0.38, -o.height * 0.82, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = activeColours.chickenBeak;
    ctx.beginPath();
    ctx.moveTo(o.width * 0.48, -o.height * 0.93);
    ctx.lineTo(o.width * 0.56, -o.height * 0.9);
    ctx.lineTo(o.width * 0.48, -o.height * 0.87);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = activeColours.chickenEye;
    ctx.beginPath();
    ctx.arc(o.width * 0.38, -o.height * 0.96, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = activeColours.chickenLeg;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    const swing = Math.sin(o.legPhase) * 2 * s;
    const legLen = hop > 1 ? o.height * 0.18 : o.height * 0.3;
    ctx.beginPath();
    ctx.moveTo(-o.width * 0.08 + swing, -o.height * 0.1);
    ctx.lineTo(-o.width * 0.08 + swing, -o.height * 0.1 + legLen);
    ctx.moveTo(o.width * 0.08 - swing, -o.height * 0.1);
    ctx.lineTo(o.width * 0.08 - swing, -o.height * 0.1 + legLen);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.restore();
  };

  const drawObstacle = (o) => {
    if (o.type === 'chicken') {
      drawChicken(o);
    } else {
      drawGoat(o);
    }
  };

  const drawGround = () => {
    // Grass strip
    ctx.fillStyle = activeColours.grass;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // Darker band near the bottom for depth
    ctx.fillStyle = activeColours.grassDark;
    ctx.fillRect(0, HEIGHT - 14, WIDTH, 14);

    // Horizon line
    ctx.strokeStyle = activeColours.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 0.5);
    ctx.lineTo(WIDTH, GROUND_Y + 0.5);
    ctx.stroke();

    // Scrolling grass tufts
    ctx.strokeStyle = activeColours.grassBlade;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let x = -state.groundOffset; x < WIDTH; x += 20) {
      const baseY = GROUND_Y + 10 + ((x * 7) % 6);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 2, baseY - 6);
      ctx.moveTo(x + 4, baseY);
      ctx.lineTo(x + 4, baseY - 8);
      ctx.moveTo(x + 8, baseY);
      ctx.lineTo(x + 10, baseY - 5);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  };

  const drawGoat = (o) => {
    const baseY = GROUND_Y;
    const s = o.scale;
    ctx.save();
    ctx.translate(o.x + o.width / 2, baseY);

    // Body
    ctx.fillStyle = activeColours.goatBody;
    ctx.beginPath();
    ctx.ellipse(0, -o.height * 0.5, o.width * 0.45, o.height * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = activeColours.goatBelly;
    ctx.beginPath();
    ctx.ellipse(-2, -o.height * 0.4, o.width * 0.28, o.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = activeColours.goatBody;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.42, -o.height * 0.75, o.width * 0.2, o.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = activeColours.goatFace;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.56, -o.height * 0.68, o.width * 0.1, o.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = activeColours.goatHorn;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(o.width * 0.36, -o.height * 0.92);
    ctx.quadraticCurveTo(o.width * 0.3, -o.height * 1.1, o.width * 0.42, -o.height * 1.15);
    ctx.moveTo(o.width * 0.46, -o.height * 0.94);
    ctx.quadraticCurveTo(o.width * 0.42, -o.height * 1.12, o.width * 0.54, -o.height * 1.15);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Ear
    ctx.fillStyle = activeColours.goatFace;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.3, -o.height * 0.88, 4 * s, 3 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = activeColours.wallabyEye;
    ctx.beginPath();
    ctx.arc(o.width * 0.48, -o.height * 0.76, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = activeColours.goatBody;
    ctx.beginPath();
    ctx.ellipse(-o.width * 0.42, -o.height * 0.7, 4 * s, 5 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Legs (simple trotting animation)
    ctx.fillStyle = activeColours.goatBody;
    const swing = Math.sin(o.legPhase) * 2 * s;
    const legW = 4 * s;
    const legH = o.height * 0.35;
    const legTop = -legH;
    ctx.fillRect(o.width * 0.22 - legW / 2 + swing, legTop, legW, legH);
    ctx.fillRect(o.width * 0.32 - legW / 2 - swing, legTop, legW, legH);
    ctx.fillRect(-o.width * 0.3 - legW / 2 - swing, legTop, legW, legH);
    ctx.fillRect(-o.width * 0.2 - legW / 2 + swing, legTop, legW, legH);
    // Hooves
    ctx.fillStyle = activeColours.goatHoof;
    ctx.fillRect(o.width * 0.22 - legW / 2 + swing, -3, legW, 3);
    ctx.fillRect(o.width * 0.32 - legW / 2 - swing, -3, legW, 3);
    ctx.fillRect(-o.width * 0.3 - legW / 2 - swing, -3, legW, 3);
    ctx.fillRect(-o.width * 0.2 - legW / 2 + swing, -3, legW, 3);

    ctx.restore();
  };

  const drawWallaby = () => {
    const w = state.wallaby;
    const cx = w.x;
    const footY = w.y;

    ctx.save();
    ctx.translate(cx, footY);

    // Tail
    ctx.fillStyle = activeColours.wallabyBody;
    ctx.beginPath();
    ctx.moveTo(-w.width / 2 + 4, -w.height * 0.45);
    ctx.quadraticCurveTo(-w.width / 2 - 16, -w.height * 0.1, -w.width / 2 - 22, -2);
    ctx.quadraticCurveTo(-w.width / 2 - 10, -w.height * 0.2, -w.width / 2 + 2, -w.height * 0.3);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = activeColours.wallabyBody;
    ctx.beginPath();
    ctx.ellipse(-4, -w.height * 0.45, w.width * 0.42, w.height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = activeColours.wallabyBelly;
    ctx.beginPath();
    ctx.ellipse(-2, -w.height * 0.35, w.width * 0.22, w.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = activeColours.wallabyBody;
    ctx.beginPath();
    ctx.ellipse(w.width * 0.28, -w.height * 0.75, w.width * 0.22, w.height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.beginPath();
    ctx.ellipse(w.width * 0.45, -w.height * 0.66, w.width * 0.1, w.height * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = activeColours.wallabyEar;
    ctx.beginPath();
    ctx.ellipse(w.width * 0.22, -w.height * 0.98, 4, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w.width * 0.32, -w.height * 1.0, 4, 10, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = activeColours.wallabyEye;
    ctx.beginPath();
    ctx.arc(w.width * 0.34, -w.height * 0.78, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Legs — animate when grounded
    ctx.fillStyle = activeColours.wallabyBody;
    const legSwing = w.grounded ? Math.sin(w.legPhase) * 5 : -6;
    // Back leg (tucked bigger)
    ctx.beginPath();
    ctx.ellipse(-w.width * 0.1, -w.height * 0.15, 10, w.grounded ? 14 : 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Front leg
    ctx.beginPath();
    ctx.ellipse(w.width * 0.18 + legSwing * 0.2, -w.height * 0.1 - (w.grounded ? 0 : 6), 6, w.grounded ? 10 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Arm
    ctx.beginPath();
    ctx.ellipse(w.width * 0.22, -w.height * 0.55, 4, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Subtle shadow under wallaby
    const shadowScale = Math.max(0.3, 1 - (GROUND_Y - footY) / 180);
    ctx.fillStyle = activeColours.shadow;
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y + 2, 20 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawOverlay = () => {
    if (state.status === 'running') return;
    ctx.fillStyle = activeColours.overlay;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = activeColours.text;
    ctx.textAlign = 'center';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    if (state.status === 'ready') {
      ctx.fillText('Wallaby Run', WIDTH / 2, HEIGHT / 2 - 10);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = activeColours.accent;
      ctx.fillText('Tap, click, or press space to start', WIDTH / 2, HEIGHT / 2 + 20);
    } else if (state.status === 'over') {
      ctx.fillText(state.lastRunWasHighScore ? 'New high score!' : 'Ouch!', WIDTH / 2, HEIGHT / 2 - 18);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = activeColours.text;
      ctx.fillText(`Score: ${Math.floor(state.score)}   Best: ${state.best}`, WIDTH / 2, HEIGHT / 2 + 8);
    }
  };

  const render = () => {
    activeColours = buildActiveColours(state.nightBlend);
    const scorePhase = state.score % DAY_NIGHT_SCORE_CYCLE;
    ctx.fillStyle = activeColours.sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawSkyBodies(scorePhase);
    state.clouds.forEach(drawCloud);
    state.trees.forEach(drawTree);
    state.camps.forEach(drawCamp);
    state.quails.forEach(drawQuail);
    drawGround();
    state.obstacles.forEach(drawObstacle);
    drawWallaby();
    drawOverlay();
  };

  // Prime initial state so the ready screen shows a wallaby, trees and clouds.
  resetRun();

  const initOnlineScores = () => {
    const fetchAuthEmail = window.WallabyAuth?.fetchAuthEmail;
    if (typeof fetchAuthEmail !== 'function') {
      clearOnlineStatus();
      void refreshOnlineScores();
      return;
    }

    clearOnlineStatus();
    fetchAuthEmail()
      .then((email) => {
        authEmail = typeof email === 'string' && email ? email : null;
      })
      .catch(() => {
        authEmail = null;
      })
      .finally(() => {
        void refreshOnlineScores();
      });
  };

  initOnlineScores();

  window.addEventListener('wallabyauth:statechange', (event) => {
    const email = event?.detail?.email;
    authEmail = typeof email === 'string' && email ? email : null;
    void refreshOnlineScores();
  });

  let lastTime = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
