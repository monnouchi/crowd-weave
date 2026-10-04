import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, GOAL } from "../logic.js";
import { createParty } from "../party.js";
import { trafficViolations, crossingTime, updateTraffic } from "../traffic.js";
import { planRoute, routeInput } from "../validation/plan-route.js";
const run = (g, seconds, input = {}) => {
  for (let n = 0; n < Math.round(seconds / 0.025); n++) step(g, 0.025, input);
};
test("stage lengths preserve the first three courses and add actual outdoor and indoor entrance distance", () => {
  assert.deepEqual(
    Array.from({ length: 5 }, (_, i) => createGame(i).startY - GOAL.y - GOAL.h),
    [540, 540, 540, 1040, 860],
  );
  const g = createGame(3);
  assert.equal(g.crossings.length, 2);
  assert.equal(g.crossings[0].lanes, 4);
  assert.ok(g.crossings[0].bottom - g.crossings[0].top >= 140);
  assert.equal(g.crossings[1].lanes, 2);
  assert.ok(
    g.crossings.every(
      (t) =>
        t.greenEnd - t.greenStart > crossingTime(createParty(4, g.player), t),
    ),
  );
});
test("fixed initial signal phases give normal forward arrivals a visible red and short wait", () => {
  for (const stage of [1, 3]) {
    const g = createGame(stage);
    g.phase = "playing";
    g.crowd = [];
    const t = g.crossings[0];
    let firstRed;
    for (let n = 0; n < 1000 && !t.reserved; n++) {
      const before = g.player.y;
      step(g, 0.025, {});
      if (!firstRed && !t.nominalGreen && before > t.bottom + 14)
        firstRed = { y: before, time: g.worldTime };
    }
    assert.ok(firstRed);
    assert.ok(firstRed.y - (t.bottom + 14) > 60, "red has distance to react");
    assert.equal(t.enteredOnGreen, false);
    assert.equal(t.violations, 1);
    assert.ok(t.remaining < 2);
    assert.ok(t.remaining > 0.3);
    const wait = createGame(stage);
    wait.phase = "playing";
    wait.crowd = [];
    while (wait.player.y > wait.crossings[0].bottom + 35) step(wait, 0.025, {});
    const y = wait.player.y;
    let seconds = 0;
    while (!wait.crossings[0].canEnter && seconds < 5) {
      step(wait, 0.025, { left: true, right: true });
      seconds += 0.025;
    }
    assert.ok(seconds < 2.5);
    assert.equal(wait.player.y, y);
    assert.equal(wait.elapsed, wait.worldTime);
    assert.equal(trafficViolations(wait), 0);
    run(wait, 0.6);
    assert.equal(wait.crossings[0].enteredOnGreen, true);
    assert.equal(trafficViolations(wait), 0);
  }
});
test("each of the two outdoor crossings owns one violation, and green entry protects the entire team", () => {
  const g = createGame(3);
  g.phase = "playing";
  g.crowd = [];
  for (const t of g.crossings) {
    g.player.y = t.bottom + 15;
    g.party = createParty(4, g.player);
    g.worldTime = ((t.period - t.phaseOffset) % t.period) + 0.2;
    t.vehicle.active = false;
    step(g, 0.025, {});
    assert.equal(t.violations, 1);
    const event = t.violationEvent;
    run(g, 0.3);
    assert.equal(t.violationEvent, event);
    t.reserved = false;
  }
  assert.equal(trafficViolations(g), 2);
  assert.notEqual(
    g.crossings[0].violationEvent.id,
    g.crossings[1].violationEvent.id,
  );
  for (const target of createGame(3).crossings) {
    const h = createGame(3);
    h.phase = "playing";
    h.crowd = [];
    const t = h.crossings.find((q) => q.id === target.id);
    h.player.y = t.bottom + 15;
    h.party = createParty(4, h.player);
    h.worldTime = (t.greenStart + 1 - t.phaseOffset + t.period) % t.period;
    t.vehicle.active = false;
    step(h, 0.025, {});
    assert.equal(t.enteredOnGreen, true);
    assert.equal(t.reserved, true);
    run(h, t.period, { left: true, right: true });
    assert.equal(t.reserved, true);
    assert.equal(trafficViolations(h), 0);
    assert.equal(t.vehicle.entered, false);
  }
});
test("cafe has primarily lateral station traffic; the concert gathers northward with viewing and no fixed empty lane", () => {
  const cafe = createGame(2);
  assert.ok(cafe.crowd.filter((p) => p.flow === "crossing").length >= 12);
  assert.ok(
    cafe.crowd
      .filter((p) => p.flow === "crossing")
      .every((p) => p.destination === "west" || p.destination === "east"),
  );
  const live = createGame(4);
  assert.ok(
    live.crowd.every((p) => p.flow === "along" && p.destination === "north"),
  );
  assert.equal(live.crowd.filter((p) => p.state === "watching").length, 24);
  assert.ok(
    live.crowd.filter((p) => p.y < 360).length >
      live.crowd.filter((p) => p.y > 700).length,
  );
  assert.ok(live.crowd.some((p) => p.glowStick));
  assert.ok(
    live.crowd.filter((p) => p.x > 180 && p.x < 300).length >= 6,
    "central area has spectators too",
  );
  assert.ok(
    live.crowd.every((p) => p.route.every((t) => t.y >= 145)),
    "nobody enters or exits through the stage",
  );
  live.phase = "playing";
  for (let n = 0; n < 4000 && live.phase === "playing"; n++)
    step(live, 0.025, {});
  assert.equal(live.phase, "finished");
  assert.ok(live.hits > 0, "straight forward does not bypass the audience");
  assert.equal(live.ticketChecked, true);
});
test("all revised busy scenes retain all-member zero-contact routes across different seeds", () => {
  for (const stage of [2, 3, 4])
    for (const seed of [17, 2026]) {
      const result = planRoute(stage, seed, 35);
      assert.ok(result, `${stage}/${seed}`);
      const g = createGame(stage, seed);
      g.phase = "playing";
      for (const action of result.path)
        for (let k = 0; k < 4; k++) step(g, 0.025, routeInput(action));
      assert.equal(g.phase, "finished");
      assert.equal(g.hits, 0);
      assert.equal(trafficViolations(g), 0);
      assert.ok(g.party.members.every((p) => p.docked));
      if (stage === 4) {
        assert.ok(result.path.includes("L") || result.path.includes("R"));
        assert.equal(g.ticketChecked, true);
      }
    }
});

test("both outdoor roads keep cars and bicycles apart from the complete moving party and crowd", () => {
  for (const seed of [17, 2026]) {
    const g = createGame(3, seed);
    g.phase = "playing";
    const route = planRoute(3, seed, 35);
    assert.ok(route);
    const kinds = new Set();
    for (const action of route.path)
      for (let k = 0; k < 4; k++) {
        step(g, 0.025, routeInput(action));
        for (const t of g.crossings) {
          const v = t.vehicle;
          kinds.add(v.kind);
          if (!v.active || !v.entered) continue;
          for (const p of [
            ...g.crowd.filter((p) => p.active),
            g.player,
            ...g.party.members,
          ]) {
            const dx = Math.max(Math.abs(v.x - p.x) - v.width / 2, 0),
              dy = Math.max(
                Math.abs(v.y - p.y) - (v.kind === "car" ? 15 : 8),
                0,
              );
            assert.ok(
              dx * dx + dy * dy >= p.r * p.r,
              `${t.id}/${seed}/${p.id}`,
            );
          }
        }
      }
    assert.equal(g.phase, "finished");
    assert.ok(kinds.has("car") && kinds.has("bicycle"));
  }
});
