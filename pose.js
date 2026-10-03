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
