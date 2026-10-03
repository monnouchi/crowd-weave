import { createGame } from "../logic.js";
import { moveCrowd, visiblePerson } from "../crowd.js";
// Time-expanded grid search over the actual deterministic crowd simulation.
// It uses only the accepted four actions; it never edits or removes pedestrians.
export function planRoute(stage, seed, maxSeconds = 25) {
  const model = createGame(stage, seed),
    crowd = model.crowd;
  let nodes = new Map([[21 * 80, { x: 240, f: 0, path: "" }]]);
  const dt = 0.1,
    substeps = 4;
  for (let tick = 0; tick < maxSeconds / dt; tick++) {
    const snapshots = [];
    for (let k = 0; k < substeps; k++) {
      moveCrowd(crowd, dt / substeps);
      snapshots.push(
        crowd.filter(visiblePerson).map((p) => ({ x: p.x, y: p.y })),
      );
    }
    const next = new Map();
    for (const node of nodes.values())
      for (const [action, dx, dy] of [
        ["F", 0, -7.5],
        ["L", -10, -7.5],
        ["R", 10, -7.5],
        ["B", 0, 0],
      ]) {
        const x = Math.max(30, Math.min(450, node.x + dx)),
          f = node.f + (dy ? 1 : 0),
          y = 625 - 7.5 * f,
          key = ((x - 30) / 10) * 80 + f;
        if (next.has(key) || f > 79) continue;
        let safe = true;
        for (let k = 0; k < substeps && safe; k++) {
          const fraction = (k + 1) / substeps,
            px = node.x + (x - node.x) * fraction,
            py = 625 - 7.5 * node.f + dy * fraction;
          if (
            snapshots[k].some(
              (p) => (p.x - px) ** 2 + (p.y - py) ** 2 < 27.5 ** 2,
            )
          )
            safe = false;
        }
        if (!safe) continue;
        const path = node.path + action;
        if (y <= 85 && x >= 175 && x <= 305)
          return { path, seconds: (tick + 1) * dt };
        next.set(key, { x, f, path });
      }
    nodes = next;
    if (!nodes.size) return null;
  }
  return null;
}
export function routeInput(action) {
  return {
    left: action === "L" || action === "B",
    right: action === "R" || action === "B",
  };
}
