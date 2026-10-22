import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, GOAL } from "../logic.js";
import { createParty } from "../party.js";
import { trafficViolations, crossingTime, updateTraffic } from "../traffic.js";
import { planRoute, routeInput } from "../validation/plan-route.js";
const run = (g, seconds, input = {}) => {
  for (let n = 0; n < Math.round(seconds / 0.025); n++) step(g, 0.025, input);
};
test("all five journeys double their original straight travel distances", () => {
  assert.deepEqual(
    Array.from({ length: 5 }, (_, i) => createGame(i).startY - GOAL.y - GOAL.h),
    [1080, 1080, 1420, 2080, 1720],
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
test("new pedestrian bands have visible encounters and recovery space in every stage", () => {
  const layouts = [
    { base: 6, bands: [760, 980], size: 4 },
    { base: 12, bands: [730, 890, 1030], size: 4 },
    { base: 31, bands: [920, 1150, 1330], size: 6 },
    { base: 30, bands: [1260, 1500, 1750, 1970], size: 6 },
    { base: 40, bands: [980, 1270, 1580], size: 6 },
  ];
  for (const seed of [17, 2026])
    layouts.forEach(({ base, bands, size }, stage) => {
      const g = createGame(stage, seed);
      const added = g.crowd.filter((p) => p.id >= base);
      assert.equal(added.length, bands.length * size);
      for (const y of bands) {
        const wave = added.filter((p) => Math.abs(p.y - y) < 45);
        assert.equal(wave.length, size);
        assert.ok(wave.some((p) => p.state !== "walking"));
        assert.ok(wave.every((p) => p.y < g.worldHeight - 25));
      }
      for (let i = 1; i < bands.length; i++) {
        const middle = (bands[i - 1] + bands[i]) / 2;
        assert.ok(added.every((p) => Math.abs(p.y - middle) > 25));
      }
    });
});
test("fixed initial signal phases give normal forward arrivals a visible red and short wait", () => {
  for (const stage of [1, 3]) {
    const g = createGame(stage);
    g.phase = "playing";
    g.crowd = [];
    const t = g.crossings[0];
    let firstRed;
    for (let n = 0; n < 1000 && !t.crossing && g.phase === "playing"; n++) {
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
  assert.equal(live.crowd.filter((p) => p.state === "watching" && p.y < 900).length, 24);
  assert.equal(live.crowd.filter((p) => p.state === "watching" && p.y > 900).length, 18);
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
    live.crowd.every((p) => p.route.every((t) => t.y >= 33)),
    "nobody enters or exits through the stage",
  );
  live.phase = "playing";
  for (let n = 0; n < 4000 && live.phase === "playing"; n++)
    step(live, 0.025, {});
  assert.equal(live.phase, "playing");
  assert.ok(live.player.y > live.crowd.find((p) => p.anchor).y);
  assert.equal(live.ticketChecked, true);
});
test("longer cafe has six moving crossing waves and a passable meeting group even at low frame rate", () => {
  for (const seed of [17, 2026, 1402485884, 2567361276]) {
    const g = createGame(2, seed);
    assert.equal(g.startY - GOAL.y - GOAL.h, 1420);
    for (let i = 0; i < g.crowd.length; i++) {
      assert.ok(Math.hypot(g.crowd[i].x - g.player.x,
        g.crowd[i].y - g.player.y) > 60);
      for (let j = i + 1; j < g.crowd.length; j++)
        assert.ok(Math.hypot(g.crowd[i].x - g.crowd[j].x,
          g.crowd[i].y - g.crowd[j].y) > 37,
        `initial pedestrian overlap ${seed}/${i}/${j}`);
    }
    for (const y of [245, 445, 640])
      assert.ok(g.crowd.filter((p) => p.flow === "crossing" &&
        Math.abs(p.entry.y - y) < 45).length >= 4);
    const meeting = g.crowd.filter((p) => p.role === "待ち合わせ中の人");
    assert.equal(meeting.length, 3);
    assert.ok(meeting.every((p) => p.state === "meeting" && p.wait > 10));
    const route = planRoute(2, seed, 45);
    assert.ok(route, `route ${seed}`);
    const clean = createGame(2, seed);
    clean.phase = "playing";
    for (const action of route.path)
      for (let frame = 0; frame < 2; frame++) step(clean, 0.05, routeInput(action));
    for (let frame = 0; frame < 40 && clean.phase === "playing"; frame++)
      step(clean, 0.05, { left: true, right: true });
    assert.equal(clean.phase, "finished");
    assert.equal(clean.hits, 0);
    assert.ok(clean.party.members.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const straight = createGame(2, seed);
    straight.phase = "playing";
    for (let frame = 0; frame < 800 && straight.phase === "playing"; frame++)
      step(straight, 0.05, {});
    assert.equal(straight.phase, "playing");
    assert.ok(straight.player.y > straight.crowd.find((p) => p.anchor).y);
    assert.ok(straight.hits >= 1, "straight route encounters the new flow");
  }
});
test("all revised busy scenes retain all-member zero-contact routes across different seeds", () => {
  for (const stage of [2, 3, 4])
    for (const seed of [17, 2026]) {
      const result = planRoute(stage, seed, 50);
      assert.ok(result, `${stage}/${seed}`);
      const g = createGame(stage, seed);
      g.phase = "playing";
      for (const action of result.path)
        for (let k = 0; k < 4; k++) step(g, 0.025, routeInput(action));
      assert.equal(g.phase, "finished");
      assert.equal(g.hits, 0);
      assert.equal(trafficViolations(g), 0);
      assert.ok(g.party.members.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
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
    const route = planRoute(3, seed, 50);
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
