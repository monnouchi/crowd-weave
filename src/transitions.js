// Course travel proceeds toward decreasing y; joins remain valid on both sides
// of a crossing, even after course.index advances.
export function courseTransition(run, halfWidth) {
  if (!run?.course?.offsets || !Number.isFinite(run.player?.y)) return null;
  const offsets = run.course.offsets;
  for (let from = 0; from < offsets.length - 1; from++) {
    const distance = offsets[from] + 84 - run.player.y;
    if (Math.abs(distance) <= halfWidth) {
      const x = (distance / halfWidth + 1) / 2;
      return { from, to: from + 1, t: x * x * (3 - 2 * x), distance };
    }
  }
  return null;
}

export const DIP_HALF_WIDTH = 30; // 0.8 s at the base 75 units/s
export const DIP_PEAK = 0.35;
export function boundaryDip(run, reducedMotion = false) {
  if (reducedMotion) return 0;
  const transition = courseTransition(run, DIP_HALF_WIDTH);
  if (!transition) return 0;
  const x = 1 - Math.abs(transition.distance) / DIP_HALF_WIDTH;
  return DIP_PEAK * x * x * (3 - 2 * x);
}

// 1 second at base pace; reduced motion keeps the overlap to 0.6 seconds.
export const AUDIO_HALF_WIDTH = 37.5;
export const AUDIO_REDUCED_HALF_WIDTH = 22.5;
export function courseMusicMix(run, reducedMotion = false) {
  const transition = courseTransition(run, reducedMotion ? AUDIO_REDUCED_HALF_WIDTH : AUDIO_HALF_WIDTH);
  if (!transition) return null;
  return { ...transition, outgoing: 1 - transition.t, incoming: transition.t };
}
