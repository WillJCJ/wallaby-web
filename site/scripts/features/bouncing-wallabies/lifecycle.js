export const createSpawnPositionResolver = ({ size, getCardBounds, intersectsAnyCard }) => (
  getYBounds
) => {
  const cardBounds = getCardBounds();
  const { yMin, yMax } = getYBounds();
  const boundedYMax = Math.max(yMin, yMax);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = Math.random() * Math.max(0, window.innerWidth - size);
    const y = yMin + Math.random() * Math.max(0, boundedYMax - yMin);
    if (!intersectsAnyCard(x, y, cardBounds)) return { x, y };
  }

  return { x: Math.random() * Math.max(0, window.innerWidth - size), y: yMin };
};

export const createWallabyFactory = ({
  layer,
  header,
  footer,
  size,
  albinoChance,
  wallabyImg,
  albinoImg,
  idleOpacity,
  activeOpacity,
  getSpawnPosition,
  getPagePos,
  applyHoverPush,
  applyHoverSpin,
  applyTapImpulse,
}) => () => {
  const el = document.createElement('div');
  el.className = 'wallaby-bouncer';

  const isAlbino = Math.random() < albinoChance;
  const img = document.createElement('img');
  img.src = isAlbino ? albinoImg : wallabyImg;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  el.appendChild(img);

  const baseSpeed = 1 + Math.random() * 1.5;
  const angle = Math.random() * 2 * Math.PI;

  const getYBounds = () => {
    const yMin = header ? header.offsetTop + header.offsetHeight : 0;
    const pageBottom = document.documentElement.scrollHeight;
    const yMax = (footer ? footer.offsetTop : pageBottom) - size;
    return { yMin, yMax };
  };

  const spawn = getSpawnPosition(getYBounds);

  const state = {
    x: spawn.x,
    y: spawn.y,
    vx: Math.cos(angle) * baseSpeed,
    vy: Math.sin(angle) * baseSpeed,
    rotation: Math.random() * 360,
    omega: 0,
    isAlbino,
    activeTouchPointerId: null,
    hoverPtrX: null,
    hoverPtrY: null,
    el,
    img,
    getYBounds,
  };

  const setOpacity = (active) => {
    el.style.opacity = active ? activeOpacity : idleOpacity;
  };

  setOpacity(false);

  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    setOpacity(true);
    applyHoverPush(state, event);
    const pos = getPagePos(event);
    state.hoverPtrX = pos.x;
    state.hoverPtrY = pos.y;
  });

  el.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') {
      if (state.hoverPtrX !== null) {
        applyHoverPush(state, event);
        applyHoverSpin(state, event);
      }
      return;
    }

    if (state.activeTouchPointerId === event.pointerId) {
      applyHoverPush(state, event);
      applyHoverSpin(state, event);
    }
  });

  el.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    setOpacity(false);
    state.hoverPtrX = null;
    state.hoverPtrY = null;
  });

  el.addEventListener('pointerdown', (event) => {
    applyTapImpulse(state, event);

    if (event.pointerType === 'mouse') return;

    state.activeTouchPointerId = event.pointerId;
    setOpacity(true);
    el.setPointerCapture(event.pointerId);
    const pos = getPagePos(event);
    state.hoverPtrX = pos.x;
    state.hoverPtrY = pos.y;
  });

  const stopTouchInteraction = (event) => {
    if (event.pointerType === 'mouse') return;
    if (state.activeTouchPointerId !== event.pointerId) return;

    state.activeTouchPointerId = null;
    setOpacity(false);
    state.hoverPtrX = null;
    state.hoverPtrY = null;
  };

  el.addEventListener('pointerup', stopTouchInteraction);
  el.addEventListener('pointercancel', stopTouchInteraction);

  layer.appendChild(el);
  return state;
};
