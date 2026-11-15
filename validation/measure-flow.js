// Planner-only crowd audit. Run with node validation/measure-flow.js.
import { createGame } from '../logic.js';
import { moveCrowd, visiblePerson } from '../crowd.js';
import { updateTraffic } from '../traffic.js';
import { planRoute, replayPlannedRouteAtBasePace } from './plan-route.js';
import { pathToFileURL } from 'node:url';

// Project expanded bodies (person radius + player radius 12 + 5 clearance)
// onto a horizontal slice. A free interval of at least 60 units is a gap.
// For the platoon, sample along walkers up to 65 units ahead of y=500.
// The player band is x=100..380; the goal band is its legal head-centre
// opening. These fixed slices are a baseline, not a moving-player audit.
export function widestGap(people, y, ahead = 0, left = 30, right = 450) {
  const intervals = people.flatMap(p => {
    const dy = Math.max(0, Math.abs(p.y - y) - ahead);
    const radius = (p.r ?? 13) + 12 + 5;
    if (dy >= radius) return [];
    const dx = Math.sqrt(radius * radius - dy * dy);
    return [[Math.max(left, p.x - dx), Math.min(right, p.x + dx)]];
  }).filter(([a,b]) => a < b).sort((a,b) => a[0] - b[0]);
  let edge = left, widest = 0;
  for (const [a,b] of intervals) { widest = Math.max(widest, a - edge); edge = Math.max(edge, b); }
  return Math.max(widest, right - edge);
}
export function measure(stage, seed, seconds = 60, dt = 0.05) {
  const g = createGame(stage, seed), samples = [], goals = [], seams = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    g.worldTime += dt; updateTraffic(g, dt);
    moveCrowd(g.crowd, dt, g.crossings, g.animals);
    const people = g.crowd.filter(visiblePerson);
    samples.push(widestGap(people, 500, 0, 100, 380));
    goals.push(widestGap(people, 125, 0, stage === 4 ? 107 : 187, stage === 4 ? 373 : 293));
    seams.push(widestGap(people.filter(p => p.flow === 'along' && p.y <= 500), 500, 65, 100, 380));
  }
  const longest = values => {
    let max = 0, run = 0;
    for (const v of values) { run = v < 60 ? run + dt : 0; max = Math.max(max, run); }
    return +max.toFixed(2);
  };
  const sorted = seams.sort((a,b) => a-b);
  return { playerBandNoGap: longest(samples), goalNoGap: longest(goals),
    seamMedian: +sorted[Math.floor(sorted.length * .5)].toFixed(1),
    seamP10: +sorted[Math.floor(sorted.length * .1)].toFixed(1) };
}
// Replay the existing deterministic, steering-and-braking-only base-pace
// route. Sample a slice 40 units in front of the moving player at each
// physics substep, using the same expanded bodies and 60-unit gap threshold.
export function measurePlayerRelative(seed, dt = 0.025) {
  const route = planRoute(1, seed, 50, 0, dt);
  if (!route) return { planned: false };
  const game = createGame(1, seed), samples = [];
  game.phase = 'playing';
  replayPlannedRouteAtBasePace(game, route, dt, () => {
    if (game.phase === 'playing')
      samples.push(widestGap(game.crowd.filter(visiblePerson), game.player.y - 40, 0, 100, 380));
  });
  let run = 0, longest = 0;
  for (const gap of samples) {
    run = gap < 60 ? run + dt : 0;
    longest = Math.max(longest, run);
  }
  return { planned: true, elapsed: game.elapsed, hits: game.hits, phase: game.phase,
    longestNoGap: +longest.toFixed(2), samples };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (let stage = 0; stage < 5; stage++) console.log(stage, measure(stage));
  const { samples, ...result } = measurePlayerRelative();
  console.log('stage 1 player-relative replay', { ...result, minGap: +Math.min(...samples).toFixed(1) });
}
