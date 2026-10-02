import { createSparkSystem } from '../../utils/sparks.js';

/**
 * Create canvas overlay and spark/indicator rendering helpers.
 * @param {number} size - Wallaby sprite size
 * @returns {{
 *   canvas: HTMLCanvasElement,
 *   context: CanvasRenderingContext2D,
 *   clear: () => void,
 *   spawnSparksAtPage: (pageX: number, pageY: number) => void,
 *   drawSparks: (deltaSeconds?: number) => void,
 *   drawAlbinoIndicators: (states: Array<object>) => void,
 * }} Overlay helpers
 */
export const createOverlaySystem = (size) => {
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.setAttribute('aria-hidden', 'true');
  sparkCanvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(sparkCanvas);
  const sparkCtx = sparkCanvas.getContext('2d');

  const resizeSparkCanvas = () => {
    sparkCanvas.width = window.innerWidth;
    sparkCanvas.height = window.innerHeight;
  };
  resizeSparkCanvas();
  window.addEventListener('resize', resizeSparkCanvas);

  const sparkSystem = createSparkSystem(sparkCtx);

  const spawnSparksAtPage = (pageX, pageY) => {
    sparkSystem.spawn(pageX - window.scrollX, pageY - window.scrollY, {
      count: 20,
      minSpeed: 90,
      maxSpeed: 360,
      minLifetime: 0.46,
      maxLifetime: 0.93,
      minSize: 1.5,
      maxSize: 3.5,
      upwardBias: 90,
    });
  };

  const drawSparks = (deltaSeconds) => sparkSystem.draw(deltaSeconds);

  const drawAlbinoIndicators = (states) => {
    const W = sparkCanvas.width;
    const H = sparkCanvas.height;
    const midX = W / 2;
    const midY = H / 2;

    states.forEach((s) => {
      if (!s.isAlbino) { return; }

      const clientX = s.x + size / 2 - window.scrollX;
      const clientY = s.y + size / 2 - window.scrollY;
      if (clientX >= 0 && clientX <= W && clientY >= 0 && clientY <= H) { return; }

      const dx = clientX - midX;
      const dy = clientY - midY;
      let t = Infinity;
      if (dx > 0) { t = Math.min(t, (W - midX) / dx); }
      if (dx < 0) { t = Math.min(t, -midX / dx); }
      if (dy > 0) { t = Math.min(t, (H - midY) / dy); }
      if (dy < 0) { t = Math.min(t, -midY / dy); }

      const edgeX = midX + dx * t;
      const edgeY = midY + dy * t;
      const glowRadius = 110;
      const grad = sparkCtx.createRadialGradient(edgeX, edgeY, 0, edgeX, edgeY, glowRadius);
      grad.addColorStop(0, 'rgba(255,215,0,0.85)');
      grad.addColorStop(0.4, 'rgba(255,180,0,0.45)');
      grad.addColorStop(1, 'rgba(255,140,0,0)');
      sparkCtx.fillStyle = grad;
      sparkCtx.beginPath();
      sparkCtx.arc(edgeX, edgeY, glowRadius, 0, Math.PI * 2);
      sparkCtx.fill();
    });
  };

  return {
    canvas: sparkCanvas,
    context: sparkCtx,
    clear: () => sparkCtx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height),
    spawnSparksAtPage,
    drawSparks,
    drawAlbinoIndicators,
  };
};
