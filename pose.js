// Presentation only: takes measured world movement, never mutates game state.
export function updatePlayerPose(
  pose,
  lateralVelocity,
  dt,
  reducedMotion = false,
) {
  if (reducedMotion) return { lean: 0 };
  const target = Math.max(-1, Math.min(1, lateralVelocity / 100)) * 0.14;
  const blend = 1 - Math.exp(-Math.max(0, Math.min(0.05, dt)) * 12);
  return { lean: pose.lean + (target - pose.lean) * blend };
}

// Only world positions enter this pose. Camera translation is deliberately absent.
export function createWalkingPose(position, heading = { x: 0, y: -1 }) {
  const length = Math.hypot(heading.x, heading.y);
  return {
    x: position.x,
    y: position.y,
    ux: length ? heading.x / length : 0,
    uy: length ? heading.y / length : -1,
    distance: 0,
    speed: 0,
    moving: false,
  };
}
export function updateWalkingPose(
  previous,
  position,
  dt,
  { canMove = true, look = null, reset = false } = {},
) {
  const dx = position.x - previous.x,
    dy = position.y - previous.y,
    distance = Math.hypot(dx, dy),
    seconds = Math.max(0, Math.min(0.05, dt));
  // Re-entering a slot or changing the result tableau is not a walking step.
  const moved =
    canMove &&
    !reset &&
    seconds > 0 &&
    distance <= 16 &&
    distance / seconds > 1;
  const speed = moved ? distance / seconds : 0;
  let ux = moved ? dx / distance : previous.ux,
    uy = moved ? dy / distance : previous.uy;
  const lookLength = look ? Math.hypot(look.x, look.y) : 0;
  if (!moved && lookLength) {
    ux = look.x / lookLength;
    uy = look.y / lookLength;
  }
  return {
    x: position.x,
    y: position.y,
    ux,
    uy,
    distance: reset ? 0 : previous.distance + (moved ? distance : 0),
    speed,
    moving: moved,
  };
}
export function facingView({ ux, uy }) {
  if (Math.abs(uy) < 0.36) return ux < 0 ? "left" : "right";
  const front = uy >= 0 ? "front" : "back";
  return Math.abs(ux) > 0.36 ? `${front}-${ux < 0 ? "left" : "right"}` : front;
}
