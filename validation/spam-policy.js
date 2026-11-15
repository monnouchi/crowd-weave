import { CALL_AREA } from '../crowd.js';

// A wall is two pedestrians in the call footprint. The old game has no
// charge, so it is treated as always ready when establishing the baseline.
export function spamPolicy(g, input) {
  const wall = g.crowd.filter(p => p.active && !p.animal &&
    p.y <= g.player.y - CALL_AREA.near && p.y >= g.player.y - CALL_AREA.far &&
    Math.abs(p.x - g.player.x) < CALL_AREA.halfWidth).length >= 2;
  const ready = g.callGauge === undefined || g.callGauge >= 1;
  return { ...input, call: wall && ready, callPulse: wall && ready };
}
