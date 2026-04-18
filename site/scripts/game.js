(() => {
  const canvas = document.getElementById('wallaby-game-canvas');
  const scoreEl = document.getElementById('wallaby-game-score');
  const bestEl = document.getElementById('wallaby-game-best');
  const hintEl = document.getElementById('wallaby-game-hint');

  if (!canvas || !canvas.getContext) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const BEST_KEY = 'wallabyfest-game-best';

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const GROUND_Y = HEIGHT - 40;
  const GRAVITY = 2200;
  const JUMP_VELOCITY = -720;
  const START_SPEED = 320;
  const MAX_SPEED = 720;
  const SPEED_GROWTH = 8;

  const COLOURS = {
    sky: '#1a1a2e',
    groundLine: '#1f3a20',
    grass: '#2f6b32',
    grassDark: '#244f26',
    grassBlade: '#3f8a44',
    wallabyBody: '#9d6620',
    wallabyBelly: '#bb9864',
    wallabyEar: '#7b3c20',
    wallabyEye: '#111827',
    goatBody: '#e8e6df',
    goatBelly: '#f7f5ee',
    goatHoof: '#2a2a33',
    goatHorn: '#5a4a35',
    goatFace: '#cdbfa6',
    treeTrunk: '#3a2a1b',
    treeCanopy: '#1f4a24',
    treeCanopyDark: '#173619',
    cloud: '#2d2d3a',
    text: '#e8e6df',
    accent: '#f5c842',
  };

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
    groundOffset: 0,
    nextObstacleIn: 0.8,
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

  const spawnObstacle = () => {
    // Goat size varies a little so timing stays interesting.
    const scale = randomBetween(0.5, 1.5);
    const width = 44 * scale;
    const height = 34 * scale;
    state.obstacles.push({
      x: WIDTH + 20,
      width,
      height,
      scale,
      legPhase: Math.random() * Math.PI * 2,
    });
    // Gap scales with speed so faster runs keep the same rhythm.
    const minGap = Math.max(0.6, 260 / state.speed);
    const maxGap = Math.max(1.1, 520 / state.speed);
    state.nextObstacleIn = randomBetween(minGap, maxGap);
  };

  const resetRun = () => {
    state.time = 0;
    state.speed = START_SPEED;
    state.score = 0;
    state.obstacles.length = 0;
    state.clouds.length = 0;
    state.trees.length = 0;
    state.wallaby.y = GROUND_Y;
    state.wallaby.vy = 0;
    state.wallaby.grounded = true;
    state.wallaby.legPhase = 0;
    state.groundOffset = 0;
    state.nextObstacleIn = 0.8;
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
    hintEl.textContent = 'Hop the goats. Good luck!';
    jump();
  };

  const endGame = () => {
    state.status = 'over';
    const finalScore = Math.floor(state.score);
    if (finalScore > state.best) {
      state.best = finalScore;
      bestEl.textContent = state.best;
      try {
        localStorage.setItem(BEST_KEY, String(state.best));
      } catch {
        // ignore storage errors
      }
    }
    hintEl.textContent = 'Crashed! Tap or press space to run again.';
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

  canvas.addEventListener('pointerdown', handleInput);
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
    if (state.status !== 'running') {
      // Drift scenery gently on the title/game-over screen.
      state.clouds.forEach((c) => { c.x -= c.speed * 0.3 * dt; });
      state.clouds = state.clouds.filter((c) => c.x + 60 > 0);
      while (state.clouds.length < 3) spawnCloud();
      state.trees.forEach((t) => { t.x -= t.speed * 0.3 * dt; });
      state.trees = state.trees.filter((t) => t.x + 60 > 0);
      while (state.trees.length < 4) spawnTree();
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

    // Obstacles
    state.nextObstacleIn -= dt;
    if (state.nextObstacleIn <= 0) {
      spawnObstacle();
    }
    state.obstacles.forEach((o) => {
      o.x -= state.speed * dt;
      o.legPhase = (o.legPhase + dt * 10) % (Math.PI * 2);
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
      const oy = GROUND_Y - o.height;
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
    ctx.fillStyle = COLOURS.cloud;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.arc(12, -4, 12, 0, Math.PI * 2);
    ctx.arc(26, 0, 10, 0, Math.PI * 2);
    ctx.arc(14, 6, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawTree = (tree) => {
    ctx.save();
    ctx.translate(tree.x, tree.baseY);
    ctx.scale(tree.scale, tree.scale);

    // Trunk
    ctx.fillStyle = COLOURS.treeTrunk;
    ctx.fillRect(-3, -32, 6, 32);

    // Canopy (back layer)
    ctx.fillStyle = COLOURS.treeCanopyDark;
    ctx.beginPath();
    ctx.arc(-8, -38, 14, 0, Math.PI * 2);
    ctx.arc(10, -36, 13, 0, Math.PI * 2);
    ctx.arc(0, -50, 15, 0, Math.PI * 2);
    ctx.fill();

    // Canopy (front highlight)
    ctx.fillStyle = COLOURS.treeCanopy;
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

  const drawGround = () => {
    // Grass strip
    ctx.fillStyle = COLOURS.grass;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // Darker band near the bottom for depth
    ctx.fillStyle = COLOURS.grassDark;
    ctx.fillRect(0, HEIGHT - 14, WIDTH, 14);

    // Horizon line
    ctx.strokeStyle = COLOURS.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 0.5);
    ctx.lineTo(WIDTH, GROUND_Y + 0.5);
    ctx.stroke();

    // Scrolling grass tufts
    ctx.strokeStyle = COLOURS.grassBlade;
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
    ctx.fillStyle = COLOURS.goatBody;
    ctx.beginPath();
    ctx.ellipse(0, -o.height * 0.5, o.width * 0.45, o.height * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = COLOURS.goatBelly;
    ctx.beginPath();
    ctx.ellipse(-2, -o.height * 0.4, o.width * 0.28, o.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = COLOURS.goatBody;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.42, -o.height * 0.75, o.width * 0.2, o.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = COLOURS.goatFace;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.56, -o.height * 0.68, o.width * 0.1, o.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = COLOURS.goatHorn;
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
    ctx.fillStyle = COLOURS.goatFace;
    ctx.beginPath();
    ctx.ellipse(o.width * 0.3, -o.height * 0.88, 4 * s, 3 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = COLOURS.wallabyEye;
    ctx.beginPath();
    ctx.arc(o.width * 0.48, -o.height * 0.76, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = COLOURS.goatBody;
    ctx.beginPath();
    ctx.ellipse(-o.width * 0.42, -o.height * 0.7, 4 * s, 5 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Legs (simple trotting animation)
    ctx.fillStyle = COLOURS.goatBody;
    const swing = Math.sin(o.legPhase) * 2 * s;
    const legW = 4 * s;
    const legH = o.height * 0.35;
    const legTop = -legH;
    ctx.fillRect(o.width * 0.22 - legW / 2 + swing, legTop, legW, legH);
    ctx.fillRect(o.width * 0.32 - legW / 2 - swing, legTop, legW, legH);
    ctx.fillRect(-o.width * 0.3 - legW / 2 - swing, legTop, legW, legH);
    ctx.fillRect(-o.width * 0.2 - legW / 2 + swing, legTop, legW, legH);
    // Hooves
    ctx.fillStyle = COLOURS.goatHoof;
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
    ctx.fillStyle = COLOURS.wallabyBody;
    ctx.beginPath();
    ctx.moveTo(-w.width / 2 + 4, -w.height * 0.45);
    ctx.quadraticCurveTo(-w.width / 2 - 16, -w.height * 0.1, -w.width / 2 - 22, -2);
    ctx.quadraticCurveTo(-w.width / 2 - 10, -w.height * 0.2, -w.width / 2 + 2, -w.height * 0.3);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = COLOURS.wallabyBody;
    ctx.beginPath();
    ctx.ellipse(-4, -w.height * 0.45, w.width * 0.42, w.height * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = COLOURS.wallabyBelly;
    ctx.beginPath();
    ctx.ellipse(-2, -w.height * 0.35, w.width * 0.22, w.height * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = COLOURS.wallabyBody;
    ctx.beginPath();
    ctx.ellipse(w.width * 0.28, -w.height * 0.75, w.width * 0.22, w.height * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.beginPath();
    ctx.ellipse(w.width * 0.45, -w.height * 0.66, w.width * 0.1, w.height * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = COLOURS.wallabyEar;
    ctx.beginPath();
    ctx.ellipse(w.width * 0.22, -w.height * 0.98, 4, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w.width * 0.32, -w.height * 1.0, 4, 10, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = COLOURS.wallabyEye;
    ctx.beginPath();
    ctx.arc(w.width * 0.34, -w.height * 0.78, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Legs — animate when grounded
    ctx.fillStyle = COLOURS.wallabyBody;
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
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y + 2, 20 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawOverlay = () => {
    if (state.status === 'running') return;
    ctx.fillStyle = 'rgba(26,26,46,0.72)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = COLOURS.text;
    ctx.textAlign = 'center';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    if (state.status === 'ready') {
      ctx.fillText('Wallaby Run', WIDTH / 2, HEIGHT / 2 - 10);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = COLOURS.accent;
      ctx.fillText('Tap, click, or press space to start', WIDTH / 2, HEIGHT / 2 + 20);
    } else if (state.status === 'over') {
      ctx.fillText('Ouch!', WIDTH / 2, HEIGHT / 2 - 18);
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = COLOURS.text;
      ctx.fillText(`Score: ${Math.floor(state.score)}   Best: ${state.best}`, WIDTH / 2, HEIGHT / 2 + 8);
      ctx.fillStyle = COLOURS.accent;
      ctx.fillText('Tap or press space to run again', WIDTH / 2, HEIGHT / 2 + 32);
    }
  };

  const render = () => {
    ctx.fillStyle = COLOURS.sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    state.clouds.forEach(drawCloud);
    state.trees.forEach(drawTree);
    drawGround();
    state.obstacles.forEach(drawGoat);
    drawWallaby();
    drawOverlay();
  };

  // Prime initial state so the ready screen shows a wallaby, trees and clouds.
  resetRun();

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
