import { createGame } from "../logic.js";
import { moveCrowd, visiblePerson } from "../crowd.js";
import { moveParty, partyArrived } from "../party.js";
const copyParty = (p) => ({
  ...p,
  trail: p.trail.map((t) => ({ ...t })),
  members: p.members.map((m) => ({ ...m })),
});
function safeTeam(head, party, people) {
  return ![{ ...head, r: 12 }, ...party.members].some((m) =>
    people.some(
      (p) => (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < (m.r + 13 + 0.5) ** 2,
    ),
  );
}
function gatherSafely(head, party, crowd) {
  const people = crowd.map((p) => ({
    ...p,
    route: p.route.map((t) => ({ ...t })),
    entry: { ...p.entry },
    reaction: p.reaction ? { ...p.reaction } : null,
  }));
  for (let tick = 0; tick < 200; tick++) {
    const dx = 240 - head.x,
      dy = 84 - head.y,
      d = Math.hypot(dx, dy),
      ratio = d ? Math.min(1, 2.5 / d) : 0;
    head.x += dx * ratio;
    head.y += dy * ratio;
    moveParty(party, head, 0.025, { arriving: true });
    moveCrowd(people, 0.025);
    if (!safeTeam(head, party, people.filter(visiblePerson))) return null;
    if (partyArrived(party) && Math.hypot(head.x - 240, head.y - 84) < 0.01)
      return (tick + 1) * 0.025;
  }
  return null;
}
// Time-expanded search replays all followers against the actual seeded pedestrians.
// No crowd removal, position edits, or collision suppression is used to find routes.
export function planRoute(stage, seed, maxSeconds = 25) {
  const model = createGame(stage, seed),
    crowd = model.crowd;
  let nodes = new Map([
    [21 * 80, { x: 240, f: 0, path: "", party: model.party }],
  ]);
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
        if (next.has(key) || f > 72) continue;
        const party = copyParty(node.party);
        let safe = true,
          head;
        for (let k = 0; k < substeps && safe; k++) {
          const fraction = (k + 1) / substeps;
          head = {
            x: node.x + (x - node.x) * fraction,
            y: 625 - 7.5 * node.f + dy * fraction,
          };
          const arriving =
            head.y <= 85 + 0.000001 && head.x >= 175 && head.x <= 305;
          if (arriving && party.members.length) {
            const ax = 240 - head.x,
              ay = 84 - head.y,
              d = Math.hypot(ax, ay),
              r = d ? Math.min(1, 2.5 / d) : 0;
            head.x += ax * r;
            head.y += ay * r;
          }
          moveParty(party, head, 0.025, { braking: action === "B", arriving });
          safe = safeTeam(head, party, snapshots[k]);
        }
        if (!safe) continue;
        const path = node.path + action;
        if (y <= 85 && x >= 175 && x <= 305) {
          const settle = party.members.length
            ? gatherSafely(head, party, crowd)
            : 0;
          if (settle !== null)
            return {
              path: path + "B".repeat(Math.ceil(settle / dt)),
              seconds: (tick + 1) * dt + settle,
            };
          continue;
        }
        next.set(key, { x, f, path, party });
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
