import { updateTraffic, crossingTime } from "../traffic.js";
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
      (p) => (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < (m.r + 13 + 1.5) ** 2,
    ),
  );
}
function gatherSafely(head, party, crowd, model) {
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
    model.worldTime += 0.025;
    updateTraffic(model, 0.025);
    moveCrowd(people, 0.025, model.crossings);
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
    crowd = model.crowd,
    startY = model.startY,
    maxProgress = Math.ceil((startY - 85) / 7.5),
    rowWidth = maxProgress + 2;
  let nodes = new Map([
    [
      21 * rowWidth,
      { x: 240, f: 0, path: "", party: model.party, reserved: 0 },
    ],
  ]);
  const dt = 0.1,
    substeps = 4;
  for (let tick = 0; tick < maxSeconds / dt; tick++) {
    const snapshots = [],
      signals = [];
    for (let k = 0; k < substeps; k++) {
      model.worldTime += dt / substeps;
      updateTraffic(model, dt / substeps);
      moveCrowd(crowd, dt / substeps, model.crossings);
      signals.push(model.crossings.map((t) => ({ ...t })));
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
          y = startY - 7.5 * f,
          key = ((x - 30) / 10) * rowWidth + f;
        if (next.has(key) || f > maxProgress) continue;
        const party = copyParty(node.party);
        let reserved = node.reserved;
        let safe = true,
          head;
        for (let k = 0; k < substeps && safe; k++) {
          const fraction = (k + 1) / substeps;
          head = {
            x: node.x + (x - node.x) * fraction,
            y: startY - 7.5 * node.f + dy * fraction,
          };
          const previousY = startY - 7.5 * node.f + dy * (k / substeps);
          if (head.y < 107 && (head.x < 174 || head.x > 306)) {
            safe = false;
            break;
          }
          if (
            stage === 4 &&
            ((head.y < 837 && head.y > 778) ||
              (head.y < 732 && head.y > 673)) &&
            (head.x < 142 || head.x > 338)
          ) {
            safe = false;
            break;
          }
          for (const [roadIndex, t] of signals[k].entries()) {
            const bit = 1 << roadIndex;
            if (
              !(reserved & bit) &&
              previousY >= t.bottom + 14 &&
              head.y < t.bottom + 14
            ) {
              if (
                head.x < t.left + 12 ||
                head.x > t.right - 12 ||
                !t.green ||
                t.remaining < crossingTime(party, t) + 0.15 ||
                t.greenEnd - t.greenStart - t.remaining < 0.15
              ) {
                safe = false;
                break;
              }
              reserved |= bit;
            }
            if (
              reserved & bit &&
              head.y + 12 >= t.top &&
              head.y - 12 <= t.bottom &&
              (head.x < t.left + 12 || head.x > t.right - 12)
            ) {
              safe = false;
              break;
            }
          }
          if (!safe) break;
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
            ? gatherSafely(head, party, crowd, {
                ...model,
                player: head,
                party,
                crowd,
                crossings: structuredClone(model.crossings),
                traffic: model.traffic ? structuredClone(model.traffic) : null,
              })
            : 0;
          if (settle !== null)
            return {
              path: path + "B".repeat(Math.ceil(settle / dt)),
              seconds: (tick + 1) * dt + settle,
            };
          continue;
        }
        next.set(key, { x, f, path, party, reserved });
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
