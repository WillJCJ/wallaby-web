/**
 * Build collision resolvers used by the wallaby animation loop.
 * @param {object} deps - Collision dependencies
 * @param {number} deps.size - Wallaby sprite size
 * @param {number} deps.collisionFriction - Friction coefficient for spin impulse
 * @param {(state: object) => void} deps.clampAngularVelocity - Angular clamp helper
 * @param {(state: object) => void} deps.clampVelocity - Velocity clamp helper
 * @param {(pageX: number, pageY: number) => void} deps.spawnSparksAtPage - Spark spawner
 * @returns {{
 *   spinFactor: number,
 *   resolveCardCollisions: (state: object, prevX: number, prevY: number, cardBounds: Array<object>) => void,
 *   resolveWallabyCollisions: (states: Array<object>) => void,
 * }} Collision helpers
 */
export const createCollisionResolvers = ({
  size,
  collisionFriction,
  clampAngularVelocity,
  clampVelocity,
  spawnSparksAtPage,
}) => {
  const spinFactor = collisionFriction * (2 / (size / 2)) * (180 / Math.PI);

  const resolveCardCollisions = (state, prevX, prevY, cardBounds) => {
    cardBounds.forEach((bounds) => {
      const overlaps =
        state.x < bounds.right &&
        state.x + size > bounds.left &&
        state.y < bounds.bottom &&
        state.y + size > bounds.top;

      if (!overlaps) return;

      const cx = state.x + size / 2;
      const cy = state.y + size / 2;

      const spark = (pageX, pageY) => {
        if (state.isAlbino) spawnSparksAtPage(pageX, pageY);
      };

      if (prevX + size <= bounds.left) {
        state.x = bounds.left - size;
        state.omega += -state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = -Math.abs(state.vx);
        spark(cx + size / 2, cy);
        return;
      }

      if (prevX >= bounds.right) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - size / 2, cy);
        return;
      }

      if (prevY + size <= bounds.top) {
        state.y = bounds.top - size;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + size / 2);
        return;
      }

      if (prevY >= bounds.bottom) {
        state.y = bounds.bottom;
        state.omega += -state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = Math.abs(state.vy);
        spark(cx, cy - size / 2);
        return;
      }

      const overlapLeft = state.x + size - bounds.left;
      const overlapRight = bounds.right - state.x;
      const overlapTop = state.y + size - bounds.top;
      const overlapBottom = bounds.bottom - state.y;
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      if (minOverlap === overlapLeft) {
        state.x = bounds.left - size;
        state.omega += -state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = -Math.abs(state.vx);
        spark(cx + size / 2, cy);
      } else if (minOverlap === overlapRight) {
        state.x = bounds.right;
        state.omega += state.vy * spinFactor;
        clampAngularVelocity(state);
        state.vx = Math.abs(state.vx);
        spark(cx - size / 2, cy);
      } else if (minOverlap === overlapTop) {
        state.y = bounds.top - size;
        state.omega += state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = -Math.abs(state.vy);
        spark(cx, cy + size / 2);
      } else {
        state.y = bounds.bottom;
        state.omega += -state.vx * spinFactor;
        clampAngularVelocity(state);
        state.vy = Math.abs(state.vy);
        spark(cx, cy - size / 2);
      }
    });
  };

  const resolveWallabyCollisions = (states) => {
    const radius = size / 2;
    const minDist = radius * 2;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < states.length; i += 1) {
      // eslint-disable-next-line security/detect-object-injection -- Index-based pair iteration over local in-memory array.
      const a = states[i];

      for (let j = i + 1; j < states.length; j += 1) {
        // eslint-disable-next-line security/detect-object-injection -- Index-based pair iteration over local in-memory array.
        const b = states[j];

        const ax = a.x + radius;
        const ay = a.y + radius;
        const bx = b.x + radius;
        const by = b.y + radius;
        let dx = bx - ax;
        let dy = by - ay;
        let distSq = dx * dx + dy * dy;

        if (distSq > minDistSq) continue;

        if (distSq < 0.0001) {
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distSq = 1;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = minDist - dist;
        if (overlap > 0) {
          const sep = overlap / 2;
          a.x -= nx * sep;
          a.y -= ny * sep;
          b.x += nx * sep;
          b.y += ny * sep;
        }

        const relVx = b.vx - a.vx;
        const relVy = b.vy - a.vy;
        const velAlongNormal = relVx * nx + relVy * ny;

        if (velAlongNormal >= 0) continue;

        const impulse = -velAlongNormal;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
        clampVelocity(a);
        clampVelocity(b);

        if (a.isAlbino || b.isAlbino) {
          spawnSparksAtPage((a.x + radius) + nx * radius, (a.y + radius) + ny * radius);
        }

        const vRelTangential = relVx * -ny + relVy * nx;
        const Jt = collisionFriction * -vRelTangential;
        const deltaOmegaDeg = Jt * (2 / radius) * (180 / Math.PI);
        a.omega += deltaOmegaDeg;
        b.omega -= deltaOmegaDeg;
        clampAngularVelocity(a);
        clampAngularVelocity(b);
      }
    }
  };

  return {
    spinFactor,
    resolveCardCollisions,
    resolveWallabyCollisions,
  };
};
