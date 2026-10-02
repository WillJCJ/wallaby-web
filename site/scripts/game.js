import { createOnlineHelpers } from './features/game/online.js';
import { createSpawnHelpers } from './features/game/spawn.js';
import { setupGameInput } from './features/game/input.js';
import { createRunFlow } from './features/game/run-flow.js';
import { createVeterinarianEncounter } from './features/game/veterinarian-encounter.js';
import { createDartProjectile } from './features/game/dart-projectile.js';
import { createDartSleepTransition } from './features/game/dart-sleep-transition.js';
import { getSpeechBubbleFrame, getSpeechDuration } from './features/game/typewriter-speech.js';
import { getAuth } from './shared/auth-state.js';
import { createSparkSystem } from './utils/sparks.js';

(() => {
  const canvas = document.getElementById('wallaby-game-canvas');
  const scoreEl = document.getElementById('wallaby-game-score');
  const bestEl = document.getElementById('wallaby-game-best');
  const jumpBtn = document.getElementById('wallaby-game-jump-btn');
  const hardModeToggle = document.getElementById('wallaby-game-hard-mode');
  const onlineStatusEl = document.getElementById('wallaby-game-online-status');
  const topScoresEl = document.getElementById('wallaby-game-top-scores');
  const signInWarningEl = document.getElementById('wallaby-game-signin-warning');

  if (!canvas || !canvas.getContext) {
    return;
  }

  // Apply the vendor-specific tap highlight override from JS so CSS lint rules stay unchanged.
  canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  if (jumpBtn) {
    jumpBtn.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  }

  if (window.matchMedia('(pointer: coarse)').matches) {
    canvas.tabIndex = -1;
  }

  const ctx = canvas.getContext('2d');
  const sparks = createSparkSystem(ctx);
  const BEST_KEY = 'wallabyfest-game-best-v2'; // bump version to reset local best scores if needed
  const HIGH_SCORES_ENDPOINT = '/api/game/high-scores';
  const START_RUN_ENDPOINT = '/api/private/game/runs/start';
  const TOP_SCORES_LIMIT = 10;

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = HEIGHT - 65;
  const GRAVITY = 2200;
  const JUMP_VELOCITY = -720;
  const START_SPEED = 320;
  const MAX_SPEED = 1200;
  const SPEED_GROWTH = 8;
  const START_SPEED_HARD_MODE = MAX_SPEED * 0.5;
  const VETERINARIAN_TRIGGER_SPEED_RATIO = 0.2; // Change this to 0.3 or so later
  const VETERINARIAN_TRUCK_WIDTH = 166;
  const VETERINARIAN_DEPTH_OFFSET = 12;
  const VETERINARIAN_APPROACH_SPEED = 300;
  const VETERINARIAN_DRIVE_SPEED = 340;
  //
  const encounterSentences = ['You\'ve been making too many joeys.', 'It\'s got to stop.', 'I\'m here for your balls!'];
  const VETERINARIAN_SPEECH_CHARACTER_SECONDS = 0.05;
  const VETERINARIAN_SPEECH_DISPLAY_SECONDS = 1.5;
  const VETERINARIAN_HOLD_SECONDS = getSpeechDuration(
    encounterSentences,
    VETERINARIAN_SPEECH_CHARACTER_SECONDS,
    VETERINARIAN_SPEECH_DISPLAY_SECONDS
  );
  const VETERINARIAN_DART_ARC_HEIGHT = 36;
  const VETERINARIAN_DART_LANDING_OFFSET = 16;
  const VETERINARIAN_DART_INITIAL_COUNT = 5;
  const VETERINARIAN_DART_COUNT_INCREMENT = 2;
  const VETERINARIAN_DART_INTERVAL_MIN_SECONDS = 0.5;
  const VETERINARIAN_DART_INTERVAL_MAX_SECONDS = 3;
  const VETERINARIAN_RETURN_INTERVAL_SECONDS = 30; // Shortened for testing purposes
  const VETERINARIAN_RETURN_INTERVAL_SECONDS_HARD_MODE = 5;
  const VETERINARIAN_DART_CLEAR_SECONDS = 0.3;
  const VETERINARIAN_DART_POST_GAP_SECONDS = 1.1;
  const VETERINARIAN_DART_COLLISION_WIDTH = 22;
  const VETERINARIAN_DART_COLLISION_HEIGHT = 10;
  const VETERINARIAN_MUZZLE_FLASH_SECONDS = 0.12;
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

  let runIsHardMode = false;
  let runStartSpeed = START_SPEED;

  const COLOURS_DAY = {
    sky: '#79c8ff',
    groundLine: '#4a8c42',
    grass: '#6fbe4e',
    grassDark: '#4a8c42',
    grassBlade: '#88cf64',
    wallabyBody: '#858078',
    wallabyBelly: '#c4bdae',
    wallabyEar: '#665f55',
    wallabyEye: '#1f2937',
    goatEye: '#1f2937',
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
    wallabyBody: '#5d5a55',
    wallabyBelly: '#969084',
    wallabyEar: '#46433e',
    wallabyEye: '#17202e',
    goatEye: '#dbe7ff',
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
      // eslint-disable-next-line security/detect-object-injection -- Keys come from internal static palette constants.
      active[key] = interpolateColour(COLOURS_DAY[key], COLOURS_NIGHT[key], nightBlend);
    });
    return active;
  };

  let activeColours = buildActiveColours(0);
  let wallabySparkTimer = 0;
  let speedometerSparkTimer = 0;
  let speedometerDisplayRatio = 0;

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

  const veterinarianEncounter = createVeterinarianEncounter({
    screenWidth: WIDTH,
    truckWidth: VETERINARIAN_TRUCK_WIDTH,
    triggerSpeedRatio: VETERINARIAN_TRIGGER_SPEED_RATIO,
    midpointX: WIDTH / 2 - VETERINARIAN_TRUCK_WIDTH / 2,
    approachSpeed: VETERINARIAN_APPROACH_SPEED,
    driveSpeed: VETERINARIAN_DRIVE_SPEED,
    holdDuration: VETERINARIAN_HOLD_SECONDS,
    returnIntervalSeconds: () => (runIsHardMode
      ? VETERINARIAN_RETURN_INTERVAL_SECONDS_HARD_MODE
      : VETERINARIAN_RETURN_INTERVAL_SECONDS),
    initialDartCount: VETERINARIAN_DART_INITIAL_COUNT,
    dartCountIncrement: VETERINARIAN_DART_COUNT_INCREMENT,
  });
  let veterinarianDarts = [];
  let veterinarianDartsFired = 0;
  let veterinarianDartVolleyStarted = false;
  let veterinarianDartClearElapsed = 0;
  let veterinarianDartNextShotIn = 0;
  let veterinarianDartPostGap = 0;
  let veterinarianDartPostGapStarted = false;
  let veterinarianMuzzleFlash = null;
  let dartSleepTransition = null;
  let wallabySleepAngle = 0;
  let sleepBlackoutAlpha = 0;
  const resetVeterinarianEncounter = () => {
    runIsHardMode = Boolean(hardModeToggle?.checked);
    runStartSpeed = runIsHardMode ? START_SPEED_HARD_MODE : START_SPEED;
    veterinarianEncounter.reset();
    veterinarianDarts = [];
    veterinarianDartsFired = 0;
    veterinarianDartVolleyStarted = false;
    veterinarianDartClearElapsed = 0;
    veterinarianDartNextShotIn = 0;
    veterinarianDartPostGap = 0;
    veterinarianDartPostGapStarted = false;
    veterinarianMuzzleFlash = null;
    dartSleepTransition = null;
    wallabySleepAngle = 0;
    sleepBlackoutAlpha = 0;
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

  const online = createOnlineHelpers({
    onlineStatusEl,
    signInWarningEl,
    topScoresEl,
    topScoresLimit: TOP_SCORES_LIMIT,
    highScoresEndpoint: HIGH_SCORES_ENDPOINT,
    startRunEndpoint: START_RUN_ENDPOINT,
    getAuth,
  });

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const {
    spawnCloud,
    spawnTree,
    spawnCamp,
    spawnQuailGroup,
    spawnObstacle,
  } = createSpawnHelpers({
    state,
    width: WIDTH,
    groundY: GROUND_Y,
    randomBetween,
  });
  const runFlow = createRunFlow({
    state,
    startSpeed: () => runStartSpeed,
    groundY: GROUND_Y,
    jumpVelocity: JUMP_VELOCITY,
    width: WIDTH,
    randomBetween,
    spawnCloud,
    spawnTree,
    jumpBtn,
    bestEl,
    bestKey: BEST_KEY,
    online,
    onReset: resetVeterinarianEncounter,
  });

  const inputState = setupGameInput({
    canvas,
    jumpBtn,
    shouldTriggerAction: () => state.status !== 'running' || state.wallaby.grounded,
    onAction: runFlow.handleInput,
  });

  const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => (
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
  );

  // eslint-disable-next-line complexity -- Core game loop intentionally coordinates physics, spawning, scoring, and collisions.
  const update = (dt) => {
    if (dartSleepTransition) {
      const frame = dartSleepTransition.update(dt);
      wallabySleepAngle = frame.fallAngle;
      sleepBlackoutAlpha = frame.blackoutAlpha;
      if (frame.complete) {
        dartSleepTransition = null;
        runFlow.endGame();
      }
      return;
    }

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
      while (state.clouds.length < 3) { spawnCloud(); }
      state.trees.forEach((t) => { t.x -= t.speed * 0.3 * dt; });
      state.trees = state.trees.filter((t) => t.x + 60 > 0);
      while (state.trees.length < 4) { spawnTree(); }
      state.camps.forEach((c) => { c.x -= c.speed * 0.3 * dt; c.flicker += dt * 6; });
      state.camps = state.camps.filter((c) => c.x + 80 > 0);
      state.quails.forEach((q) => { q.x -= q.speed * 0.3 * dt; q.bobPhase += dt * 8; });
      state.quails = state.quails.filter((q) => q.x + 20 > 0);
      return;
    }

    state.time += dt;
    state.speed = Math.min(MAX_SPEED, runStartSpeed + state.time * SPEED_GROWTH);
    state.score += dt * 10 + state.speed * dt * 0.02;
    scoreEl.textContent = Math.floor(state.score);

    if (veterinarianMuzzleFlash) {
      veterinarianMuzzleFlash.remaining -= dt;
      if (veterinarianMuzzleFlash.remaining <= 0) {
        veterinarianMuzzleFlash = null;
      }
    }

    // Wallaby physics
    const w = state.wallaby;
    w.vy += GRAVITY * dt;
    w.y += w.vy * dt;
    if (w.y >= GROUND_Y) {
      w.y = GROUND_Y;
      w.vy = 0;
      w.grounded = true;
      if (inputState.held) {
        runFlow.jump();
        if (jumpBtn) { jumpBtn.classList.add('is-pressed'); }
      }
    }
    if (w.grounded) {
      w.legPhase = (w.legPhase + dt * state.speed * 0.04) % (Math.PI * 2);
    }

    const speedRatio = Math.max(0, Math.min(1, (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED)));
    const veterinarianPhaseBeforeUpdate = veterinarianEncounter.state.phase;
    veterinarianEncounter.update(dt, speedRatio);
    if (veterinarianPhaseBeforeUpdate === 'cooldown' && veterinarianEncounter.state.phase === 'waiting') {
      veterinarianDarts = [];
      veterinarianDartsFired = 0;
      veterinarianDartVolleyStarted = false;
      veterinarianDartClearElapsed = 0;
      veterinarianDartNextShotIn = 0;
      veterinarianDartPostGap = 0;
      veterinarianDartPostGapStarted = false;
    }
    veterinarianDartPostGap = Math.max(0, veterinarianDartPostGap - dt);

    const veterinarianPhase = veterinarianEncounter.state.phase;
    if (veterinarianPhase === 'stationed' && !veterinarianDartVolleyStarted) {
      if (state.obstacles.length === 0) {
        veterinarianDartClearElapsed += dt;
      } else {
        veterinarianDartClearElapsed = 0;
      }

      if (veterinarianDartClearElapsed >= VETERINARIAN_DART_CLEAR_SECONDS) {
        veterinarianDartVolleyStarted = true;
        veterinarianDartClearElapsed = 0;
      }
    } else if (veterinarianPhase !== 'stationed') {
      veterinarianDartClearElapsed = 0;
    }

    if (veterinarianPhase === 'stationed'
      && veterinarianDartVolleyStarted
      && veterinarianDartsFired < veterinarianEncounter.getDartCount()) {
      veterinarianDartNextShotIn = Math.max(0, veterinarianDartNextShotIn - dt);
      if (veterinarianDartNextShotIn === 0) {
        const truckX = veterinarianEncounter.state.x;
        const truckGroundY = GROUND_Y + VETERINARIAN_DEPTH_OFFSET;
        const gunX = truckX + 45;
        const gunY = truckGroundY - 67;
        const targetX = state.wallaby.x;
        const targetY = state.wallaby.y - state.wallaby.height * 0.7;
        const aimAngle = Math.atan2(targetY - gunY, targetX - gunX);
        const muzzleDistance = 37;
        const muzzleX = gunX + Math.cos(aimAngle) * muzzleDistance;
        const muzzleY = gunY + Math.sin(aimAngle) * muzzleDistance;
        veterinarianDarts.push(createDartProjectile({
          startX: muzzleX,
          startY: muzzleY,
          targetX,
          targetY: GROUND_Y - VETERINARIAN_DART_LANDING_OFFSET,
          arcHeight: VETERINARIAN_DART_ARC_HEIGHT,
        }));
        veterinarianMuzzleFlash = {
          x: muzzleX,
          y: muzzleY,
          angle: aimAngle,
          remaining: VETERINARIAN_MUZZLE_FLASH_SECONDS,
        };
        veterinarianDartsFired += 1;
        veterinarianDartNextShotIn = randomBetween(
          VETERINARIAN_DART_INTERVAL_MIN_SECONDS,
          VETERINARIAN_DART_INTERVAL_MAX_SECONDS
        );

        if (veterinarianDartsFired === veterinarianEncounter.getDartCount()) {
          veterinarianEncounter.driveOff();
        }
      }
    }

    veterinarianDarts.forEach((dart) => dart.update(dt, state.speed));

    if (speedRatio >= 1 && w.grounded) {
      wallabySparkTimer += dt;
      while (wallabySparkTimer >= 0.12) {
        wallabySparkTimer -= 0.12;
        sparks.spawn(w.x - 4, w.y - 2, {
          count: 3,
          minSpeed: 20,
          maxSpeed: 80,
          minLifetime: 0.16,
          maxLifetime: 0.3,
          minSize: 1,
          maxSize: 2.2,
          upwardBias: 25,
          followWorld: true,
          worldSpeedScale: 0.3,
        });
        sparks.spawn(w.x + 10, w.y - 2, {
          count: 3,
          minSpeed: 20,
          maxSpeed: 80,
          minLifetime: 0.16,
          maxLifetime: 0.3,
          minSize: 1,
          maxSize: 2.2,
          upwardBias: 25,
          followWorld: true,
          worldSpeedScale: 0.3,
        });
      }
    } else {
      wallabySparkTimer = 0;
    }

    // Ground scroll
    state.groundOffset += state.speed * dt;

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
    const veterinarianDartSafetyActive = veterinarianEncounter.state.phase === 'driving-right'
      || veterinarianEncounter.state.phase === 'stationed'
      || veterinarianEncounter.state.phase === 'driving-off'
      || veterinarianDarts.length > 0
      || veterinarianDartPostGap > 0;
    if (!veterinarianDartSafetyActive) {
      state.nextObstacleIn -= dt;
      if (state.nextObstacleIn <= 0) {
        spawnObstacle();
      }
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
        runFlow.endGame();
        break;
      }
    }

    if (state.status === 'running' && veterinarianDarts.length > 0) {
      for (const projectile of veterinarianDarts) {
        const dart = projectile.state;
        const dartLeft = dart.x - VETERINARIAN_DART_COLLISION_WIDTH / 2;
        const dartTop = dart.y - VETERINARIAN_DART_COLLISION_HEIGHT / 2;
        if (rectsOverlap(
          wx,
          wy,
          ww,
          wh,
          dartLeft,
          dartTop,
          VETERINARIAN_DART_COLLISION_WIDTH,
          VETERINARIAN_DART_COLLISION_HEIGHT
        )) {
          dartSleepTransition = createDartSleepTransition();
          veterinarianDarts = [];
          veterinarianMuzzleFlash = null;
          break;
        }
      }

      if (state.status === 'running') {
        const activeDarts = veterinarianDarts.filter((projectile) => (
          projectile.state.x + VETERINARIAN_DART_COLLISION_WIDTH > 0
        ));
        if (activeDarts.length === 0
          && veterinarianDartsFired === veterinarianEncounter.getDartCount()
          && !veterinarianDartPostGapStarted) {
          veterinarianDartPostGap = VETERINARIAN_DART_POST_GAP_SECONDS;
          veterinarianDartPostGapStarted = true;
          state.nextObstacleIn = Math.max(state.nextObstacleIn, VETERINARIAN_DART_POST_GAP_SECONDS);
        }
        veterinarianDarts = activeDarts;
      }
    }

    if (state.status !== 'running') {
      veterinarianDarts = [];
      veterinarianMuzzleFlash = null;
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

    // Grass variation is seeded by world cell so it stays fixed as it scrolls.
    ctx.strokeStyle = activeColours.grassBlade;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const cellWidth = 14;
    const firstCell = Math.floor(state.groundOffset / cellWidth) - 1;
    const lastCell = Math.ceil((state.groundOffset + WIDTH) / cellWidth);
    for (let cell = firstCell; cell <= lastCell; cell += 1) {
      let seed = (cell ^ 0x9e3779b9) >>> 0;
      seed = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
      seed = Math.imul(seed ^ (seed >>> 15), 0x735a2d97);
      const variation = (seed ^ (seed >>> 15)) >>> 0;
      const random = variation / 4294967296;

      if (random < 0.24) {
        continue;
      }

      const x = Math.round(cell * cellWidth - state.groundOffset);
      const baseY = GROUND_Y + 8 + Math.floor(random * 6);
      const heightOne = 4 + Math.floor(random * 5);
      const heightTwo = 5 + Math.floor(((variation >>> 8) / 16777216) * 5);

      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 2, baseY - heightOne);
      ctx.moveTo(x + 3, baseY);
      ctx.lineTo(x + 5, baseY - heightTwo);
      if ((variation & 1) === 0) {
        ctx.moveTo(x + 6, baseY);
        ctx.lineTo(x + 9, baseY - 4 - (variation % 4));
      }
    }
    ctx.stroke();
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
    ctx.fillStyle = activeColours.goatEye;
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

  const drawVeterinarianTruck = () => {
    const { phase, x } = veterinarianEncounter.state;
    if (phase === 'waiting') { return; }

    const targetX = state.wallaby.x - (x + 45);
    const truckGroundY = GROUND_Y + VETERINARIAN_DEPTH_OFFSET;
    const targetY = state.wallaby.y - state.wallaby.height * 0.7 - (truckGroundY - 67);
    const aimAngle = phase === 'approaching' || phase === 'approaching-pass'
      ? 0
      : Math.atan2(targetY, targetX);
    const aimX = Math.cos(aimAngle);
    const aimY = Math.sin(aimAngle);

    ctx.save();
    ctx.translate(x, truckGroundY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(82, 2, 84, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    [32, 132].forEach((wheelX) => {
      ctx.fillStyle = '#202a28';
      ctx.beginPath();
      ctx.arc(wheelX, -14, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a7aaa2';
      ctx.beginPath();
      ctx.arc(wheelX, -14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555f59';
      ctx.beginPath();
      ctx.arc(wheelX, -14, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#303d36';
    ctx.fillRect(8, -40, 151, 14);
    ctx.fillStyle = '#536b4d';
    ctx.fillRect(4, -58, 159, 22);
    ctx.fillRect(5, -67, 60, 10);
    ctx.fillRect(6, -71, 58, 5);
    ctx.fillStyle = '#354b37';
    ctx.fillRect(11, -64, 48, 8);

    ctx.fillStyle = '#627b58';
    ctx.fillRect(65, -91, 67, 39);
    ctx.fillRect(63, -101, 70, 12);
    ctx.fillStyle = '#a9d5dc';
    ctx.fillRect(72, -88, 23, 26);
    ctx.fillRect(101, -88, 24, 26);
    ctx.fillStyle = '#465d45';
    ctx.fillRect(97, -91, 4, 35);
    ctx.fillRect(70, -59, 63, 7);

    ctx.fillStyle = '#647a55';
    ctx.fillRect(128, -55, 33, 18);
    ctx.fillStyle = '#293630';
    ctx.fillRect(157, -48, 8, 14);
    ctx.fillStyle = '#f2d27c';
    ctx.fillRect(158, -54, 5, 6);
    ctx.fillStyle = '#9aa39a';
    ctx.fillRect(0, -37, 10, 5);

    // Vet stands in the pickup bed in a white coat with a medical cross.
    ctx.fillStyle = '#e8e5dc';
    ctx.beginPath();
    ctx.moveTo(25, -75);
    ctx.lineTo(47, -75);
    ctx.lineTo(52, -57);
    ctx.lineTo(21, -57);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2f6b55';
    ctx.fillRect(33, -69, 3, 9);
    ctx.fillRect(30, -66, 9, 3);
    ctx.fillStyle = '#d9a47b';
    ctx.beginPath();
    ctx.arc(37, -87, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#51443a';
    ctx.beginPath();
    ctx.arc(37, -90, 7, Math.PI, Math.PI * 2);
    ctx.fill();

    const shoulderX = 45;
    const shoulderY = -67;
    const gripX = shoulderX + aimX * 12;
    const gripY = shoulderY + aimY * 12;
    const muzzleX = shoulderX + aimX * 32;
    const muzzleY = shoulderY + aimY * 32;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#e8e5dc';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(43, -65);
    ctx.lineTo(gripX, gripY);
    ctx.stroke();
    ctx.strokeStyle = '#39434a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(muzzleX, muzzleY);
    ctx.stroke();
    ctx.strokeStyle = '#f5c842';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(muzzleX, muzzleY);
    ctx.lineTo(muzzleX + aimX * 5, muzzleY + aimY * 5);
    ctx.stroke();

    // Boxy pickup details and rear-mounted spare wheel.
    ctx.strokeStyle = '#354b37';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, -58, 61, 22);
    ctx.strokeRect(65, -91, 67, 39);
    ctx.fillStyle = '#202a28';
    ctx.beginPath();
    ctx.arc(13, -47, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9aa39a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(13, -47, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  const drawWallaby = () => {
    const w = state.wallaby;
    const cx = w.x;
    const footY = w.y;

    ctx.save();
    ctx.translate(cx, footY);
    ctx.rotate(wallabySleepAngle);

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

    if (wallabySleepAngle < Math.PI / 2) {
      // Keep ground shadow while upright; remove it once the wallaby lies down.
      const shadowScale = Math.max(0.3, 1 - (GROUND_Y - footY) / 180);
      ctx.fillStyle = activeColours.shadow;
      ctx.beginPath();
      ctx.ellipse(cx, GROUND_Y + 2, 20 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawVeterinarianDart = (projectile) => {
    const { x, y, angle } = projectile.state;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1.3, 1.3);
    ctx.fillStyle = '#56636b';
    ctx.fillRect(-10, -2, 18, 4);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(-11, -2.5, 4, 5);
    ctx.beginPath();
    ctx.moveTo(-8, -1.5);
    ctx.lineTo(-18, -7);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 1.5);
    ctx.lineTo(-18, 7);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5c842';
    ctx.beginPath();
    ctx.moveTo(8, -2.5);
    ctx.lineTo(15, 0);
    ctx.lineTo(8, 2.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawVeterinarianMuzzleFlash = () => {
    if (!veterinarianMuzzleFlash) { return; }

    const { x, y, angle, remaining } = veterinarianMuzzleFlash;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.max(0, remaining / VETERINARIAN_MUZZLE_FLASH_SECONDS);
    ctx.fillStyle = '#fff3a3';
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(9, -3);
    ctx.lineTo(20, 0);
    ctx.lineTo(9, 3);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.arc(1, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawVeterinarianSpeechBubble = () => {
    const encounterState = veterinarianEncounter.state;
    if (encounterState.phase !== 'alongside') { return; }

    const speechFrame = getSpeechBubbleFrame(
      encounterSentences,
      encounterState.elapsed,
      VETERINARIAN_SPEECH_CHARACTER_SECONDS,
      VETERINARIAN_SPEECH_DISPLAY_SECONDS
    );
    if (!speechFrame) { return; }

    ctx.save();
    ctx.font = '18px monospace';
    const padding = 10;
    const bubbleWidth = Math.ceil(ctx.measureText(speechFrame.fullText).width) + padding * 2;
    const bubbleHeight = 38;
    const bubbleX = Math.max(8, Math.min(
      WIDTH - bubbleWidth - 8,
      encounterState.x + 20
    ));
    const bubbleY = Math.max(8, GROUND_Y + VETERINARIAN_DEPTH_OFFSET - 147);
    const bubbleBottom = bubbleY + bubbleHeight;
    const vetX = encounterState.x + 37;
    const tailX = Math.max(bubbleX + 18, Math.min(bubbleX + bubbleWidth - 18, vetX));

    ctx.beginPath();
    ctx.moveTo(bubbleX + 7, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth - 7, bubbleY);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + 7);
    ctx.lineTo(bubbleX + bubbleWidth, bubbleBottom - 7);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleBottom, bubbleX + bubbleWidth - 7, bubbleBottom);
    ctx.lineTo(tailX + 7, bubbleBottom);
    ctx.lineTo(tailX, bubbleBottom + 13);
    ctx.lineTo(tailX - 7, bubbleBottom);
    ctx.lineTo(bubbleX + 7, bubbleBottom);
    ctx.quadraticCurveTo(bubbleX, bubbleBottom, bubbleX, bubbleBottom - 7);
    ctx.lineTo(bubbleX, bubbleY + 7);
    ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + 7, bubbleY);
    ctx.closePath();
    ctx.fillStyle = '#fffef5';
    ctx.strokeStyle = '#303b40';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#202a28';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(speechFrame.text, bubbleX + padding, bubbleY + bubbleHeight / 2);
    ctx.restore();
  };

  const drawOverlay = () => {
    if (state.status === 'running') { return; }
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
      ctx.fillStyle = sleepBlackoutAlpha >= 1 ? '#000' : activeColours.overlay;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillText(state.lastRunWasHighScore ? 'New high score!' : 'Ouch!', WIDTH / 2, HEIGHT / 2 - 18);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = activeColours.text;
      ctx.fillText(`Score: ${Math.floor(state.score)}   Best: ${state.best}`, WIDTH / 2, HEIGHT / 2 + 8);
    }
  };

  const drawSleepBlackout = () => {
    if (sleepBlackoutAlpha <= 0) { return; }

    ctx.save();
    ctx.globalAlpha = sleepBlackoutAlpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  };

  const drawSpeedometer = (deltaSeconds) => {
    const centerX = 36;
    const centerY = 38;
    const radius = 20;
    const startAngle = Math.PI * 0.75;
    const sweepAngle = Math.PI * 1.5;
    const currentSpeedRatio = Math.max(0, Math.min(1, (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED)));
    if (state.status === 'over') {
      speedometerDisplayRatio *= Math.exp(-14 * deltaSeconds);
    } else {
      speedometerDisplayRatio = currentSpeedRatio;
    }
    const speedRatio = speedometerDisplayRatio;
    const needleBaseAngle = startAngle + sweepAngle * speedRatio;
    const needleShake = speedRatio >= 1
      ? Math.sin(performance.now() / 24) * 0.035
      : 0;
    const needleAngle = needleBaseAngle + needleShake;
    const arcColour = speedRatio <= 0.5
      ? interpolateColour('#39a853', '#facc15', speedRatio * 2)
      : interpolateColour('#facc15', '#ef4444', (speedRatio - 0.5) * 2);
    const needleColour = '#facc15';

    ctx.save();
    ctx.fillStyle = activeColours.overlay;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = activeColours.shadowLight;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sweepAngle);
    ctx.stroke();

    ctx.strokeStyle = arcColour;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, needleAngle);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = needleColour;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(needleAngle) * (radius - 6),
      centerY + Math.sin(needleAngle) * (radius - 6)
    );
    ctx.stroke();

    ctx.fillStyle = needleColour;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state.status === 'running' && speedRatio >= 1) {
      speedometerSparkTimer += deltaSeconds;
      while (speedometerSparkTimer >= 0.14) {
        speedometerSparkTimer -= 0.14;
        sparks.spawn(
          centerX + Math.cos(needleBaseAngle) * radius,
          centerY + Math.sin(needleBaseAngle) * radius,
          {
            count: 2,
            minSpeed: 20,
            maxSpeed: 70,
            minLifetime: 0.16,
            maxLifetime: 0.3,
            minSize: 1,
            maxSize: 2.2,
            upwardBias: 20,
          }
        );
      }
    } else {
      speedometerSparkTimer = 0;
    }
  };

  const render = (deltaSeconds) => {
    if (hardModeToggle) {
      hardModeToggle.disabled = state.status === 'running' || Boolean(dartSleepTransition);
    }
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
    drawVeterinarianTruck();
    drawVeterinarianSpeechBubble();
    drawVeterinarianMuzzleFlash();
    veterinarianDarts.forEach(drawVeterinarianDart);
    sparks.draw(deltaSeconds, state.speed);
    drawSpeedometer(deltaSeconds);
    drawSleepBlackout();
    drawOverlay();
  };

  // Prime initial state so the ready screen shows a wallaby, trees and clouds.
  runFlow.resetRun();

  online.initOnlineScores();

  window.addEventListener('wallabyauth:statechange', online.handleAuthStateChange);

  let lastTime = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
