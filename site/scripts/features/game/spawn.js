export const createSpawnHelpers = ({
  state,
  width,
  groundY,
  randomBetween,
}) => {
  const spawnCloud = (x) => {
    state.clouds.push({
      x: x ?? width + randomBetween(20, 120),
      y: randomBetween(20, 90),
      scale: randomBetween(0.6, 1.1),
      speed: randomBetween(30, 55),
    });
  };

  const spawnTree = (x) => {
    state.trees.push({
      x: x ?? width + randomBetween(40, 180),
      baseY: groundY + randomBetween(-2, 4),
      scale: randomBetween(0.7, 1.15),
      speed: randomBetween(55, 75),
      variant: Math.random() < 0.5 ? 0 : 1,
    });
  };

  const spawnCamp = (x) => {
    state.camps.push({
      x: x ?? width + randomBetween(80, 240),
      baseY: groundY + randomBetween(-1, 3),
      scale: randomBetween(0.9, 1.15),
      speed: randomBetween(55, 75),
      flicker: Math.random() * Math.PI * 2,
    });
  };

  const spawnQuailGroup = (x) => {
    const groupX = x ?? width + randomBetween(40, 180);
    const count = 3 + Math.floor(Math.random() * 3);
    const speed = randomBetween(55, 75);
    const scale = randomBetween(0.7, 1.0);
    for (let i = 0; i < count; i++) {
      state.quails.push({
        x: groupX + i * randomBetween(10, 16),
        baseY: groundY + randomBetween(-2, 4),
        scale: scale * randomBetween(0.85, 1.1),
        speed,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }
  };

  const spawnObstacle = () => {
    const isChicken = Math.random() < 0.3;
    if (isChicken) {
      const scale = randomBetween(0.7, 1.0);
      const obstacleWidth = 30 * scale;
      const obstacleHeight = 26 * scale;
      state.obstacles.push({
        type: 'chicken',
        x: width + 20,
        width: obstacleWidth,
        height: obstacleHeight,
        scale,
        legPhase: Math.random() * Math.PI * 2,
        hopPhase: Math.random() * Math.PI * 2,
      });
    } else {
      const scale = randomBetween(0.5, 1.5);
      const obstacleWidth = 44 * scale;
      const obstacleHeight = 34 * scale;
      state.obstacles.push({
        type: 'goat',
        x: width + 20,
        width: obstacleWidth,
        height: obstacleHeight,
        scale,
        legPhase: Math.random() * Math.PI * 2,
      });
    }

    const minGap = Math.max(0.6, 260 / state.speed);
    const maxGap = Math.max(1.1, 520 / state.speed);
    state.nextObstacleIn = randomBetween(minGap, maxGap);
  };

  return {
    spawnCloud,
    spawnTree,
    spawnCamp,
    spawnQuailGroup,
    spawnObstacle,
  };
};
