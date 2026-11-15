import { updateTraffic, crossingTime } from "../traffic.js";
import {
  createGame,
  step,
  goalFor,
  arrivalPoint,
  setArrivalSlots,
  FLOW_TIERS,
  flowTier,
} from "../logic.js";
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
      (p) => (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < (m.r + 13 + 2.5) ** 2,
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
  const target = arrivalPoint(model.stage, head);
  setArrivalSlots(party, model.stage, head);
  for (let tick = 0; tick < 200; tick++) {
    const dx = target.x - head.x,
      dy = 84 - head.y,
      d = Math.hypot(dx, dy),
      ratio = d ? Math.min(1, 2.5 / d) : 0;
    head.x += dx * ratio;
    head.y += dy * ratio;
    moveParty(party, head, 0.025, { arriving: true });
    model.worldTime += 0.025;
    updateTraffic(model, 0.025);
    // The planner advances the crowd with the same static obstacles the
    // real step() applies (animals), so planned positions are the
    // positions the replay will actually meet. (V2-5: the denser crowd
    // made the old obstacle-free approximation diverge at coarse steps.)
    moveCrowd(people, 0.025, model.crossings, model.animals);
    if (!safeTeam(head, party, people.filter(visiblePerson))) return null;
    if (
      partyArrived(party) &&
      Math.hypot(head.x - target.x, head.y - 84) < 0.01
    )
      return (tick + 1) * 0.025;
  }
  return null;
}
// Time-expanded search replays all followers against the actual seeded pedestrians.
// No crowd removal, position edits, or collision suppression is used to find routes.
export function planRoute(stage, seed, maxSeconds = 25, initialWait = 0,
  simulationStep = 0.025) {
  const model = createGame(stage, seed),
    crowd = model.crowd,
    goal = goalFor(stage),
    startY = model.startY,
    maxProgress = Math.ceil((startY - 85) / 7.5),
    rowWidth = maxProgress + 2;
  for (let n = 0; n < Math.round(initialWait / simulationStep); n++) {
    model.phase = "playing";
    step(model, simulationStep, { left: true, right: true });
  }
  let nodes = new Map([
    [
      21 * rowWidth,
      {
        x: 240,
        f: 0,
        path: "B".repeat(Math.round(initialWait / 0.1)),
        party: model.party,
        reserved: 0,
      },
    ],
  ]);
  const dt = 0.1,
    substeps = Math.round(dt / simulationStep);
  for (let tick = 0; tick < maxSeconds / dt; tick++) {
    const snapshots = [],
      signals = [];
    for (let k = 0; k < substeps; k++) {
      model.worldTime += dt / substeps;
      updateTraffic(model, dt / substeps);
      moveCrowd(crowd, dt / substeps, model.crossings, model.animals);
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
          if (stage !== 4 && head.y < 107 && (head.x < 174 || head.x > 306)) {
            safe = false;
            break;
          }
          if (stage === 4 && head.y < 650 && (head.x < 48 || head.x > 432)) {
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
            head.y <= 85 + 0.000001 &&
            head.x >= goal.x &&
            head.x <= goal.x + goal.w;
          const target = arrivalPoint(stage, head);
          if (arriving) setArrivalSlots(party, stage, head);
          if (arriving && party.members.length) {
            const ax = target.x - head.x,
              ay = 84 - head.y,
              d = Math.hypot(ax, ay),
              r = d ? Math.min(1, 2.5 / d) : 0;
            head.x += ax * r;
            head.y += ay * r;
          }
          moveParty(party, head, simulationStep, { braking: action === "B", arriving });
          safe = safeTeam(head, party, snapshots[k]);
        }
        if (!safe) continue;
        const path = node.path + action;
        if (y <= 85 && x >= goal.x && x <= goal.x + goal.w) {
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
              path: path + "B".repeat(Math.ceil((settle + 0.5) / dt)),
              seconds: initialWait + (tick + 1) * dt + settle + 0.5,
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

// Track each 0.1-second segment with zero depth epsilon and a 1-unit lateral
// deadband; the optional observer preserves per-substep checks in route tests.
export function replayPlannedRoute(g, route, substep = 0.025, afterStep) {
  // Closed-loop replay: track the planned trajectory instead of replaying
  // inputs open-loop. Under v2 the pace varies with FLOW (tier x kick), so
  // the driver predicts the forward advance of each substep and brakes
  // whenever moving would overshoot the planned depth by more than 0.5.
  // Depth discipline wins over lateral correction: steering may create a
  // lead of at most 4 units, and only to fix a lateral error over 4.
  let x = 240, y = g.startY;
  const substeps = Math.round(0.1 / substep), dt = 0.1 / substeps;
  for (const action of route.path) {
    const endX = Math.max(30, Math.min(450, x + (action === "L" ? -10 : action === "R" ? 10 : 0)));
    const endY = y - (action === "B" ? 0 : 7.5);
    for (let k = 0; k < substeps; k++) {
      const fraction = (k + 1) / substeps;
      const targetX = x + (endX - x) * fraction;
      const targetY = y + (endY - y) * fraction;
      const kick = g.worldTime < g.combo.kickUntil ? 1.25 : 1;
      const advance = 75 * FLOW_TIERS[flowTier(g.combo.flow)].multiplier * kick * dt;
      const errorX = targetX - g.player.x;
      const behind = g.player.y - targetY; // positive: behind plan; negative: ahead
      let move = false;
      if (behind > 0.5) move = true;
      else if (g.player.y - advance >= targetY - 0.5) move = true;
      else if (Math.abs(errorX) > 4 && behind > -4) move = true;
      step(g, dt, move
        ? { left: errorX < -1, right: errorX > 1 }
        : { left: true, right: true });
      if (afterStep) afterStep();
    }
    x = endX;
    y = endY;
  }
}

export function replayPlannedRouteAtBasePace(g, route, substep = 0.025, afterStep) {
  // Fairness-proof replay at the exact pace the planner proved: FLOW is
  // pinned to zero after every substep, so the v2 speed tiers and the
  // near-miss kick never engage and the head reproduces the planned
  // trajectory (and its crowd-avoidance coupling) as in the v1 replays.
  // Pass detection, courtesy, traffic and arrival all stay live; only the
  // combo pace is held at base. Full-physics completion is covered
  // separately by the v2 driver test in tests/combo.test.js.
  return replayPlannedRoute(g, route, substep, () => {
    g.combo.flow = 0;
    g.combo.kickUntil = 0;
    if (afterStep) afterStep();
  });
}
