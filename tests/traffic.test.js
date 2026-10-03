import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step } from "../logic.js";
import { createParty } from "../party.js";
import { updateTraffic, crossingTime } from "../traffic.js";
import { planRoute, routeInput } from "../validation/plan-route.js";
function fixture(stage = 3) {
  const g = createGame(stage);
  g.phase = "playing";
  g.crowd = [];
  return g;
}
function simulate(g, seconds, input = {}) {
  for (let n = 0; n < Math.round(seconds / 0.025); n++) step(g, 0.025, input);
}
function overlap(v, p) {
  const dx = Math.max(Math.abs(v.x - p.x) - v.width / 2, 0),
    dy = Math.max(Math.abs(v.y - p.y) - (v.kind === "car" ? 15 : 8), 0);
  return dx * dx + dy * dy < p.r * p.r;
}
test("traffic belongs only to outdoor scenes and initial road is clear", () => {
  for (let stage = 0; stage < 5; stage++) {
    const g = createGame(stage);
    assert.equal(!!g.traffic, stage === 1 || stage === 3);
    if (g.traffic) assert.ok(g.crowd.every((p) => p.y < 280 || p.y > 385));
  }
});
test("paused/background clock freezes lights, cars and time penalties", () => {
  const g = fixture();
  simulate(g, 1);
  g.phase = "paused";
  const before = structuredClone(g);
  step(g, 0.05, {});
  assert.deepEqual(g, before);
  g.phase = "playing";
  step(g, 0.025, {});
  assert.equal(g.worldTime, before.worldTime + 0.025);
});
test("red entry is voluntary and produces one violation for the entire crossing", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(3, g.player);
  simulate(g, 0.3);
  assert.ok(g.player.y < 379, "red does not automatically brake the player");
  assert.equal(g.traffic.violations, 1);
  assert.equal(g.traffic.violationEvent.id, 1);
  assert.equal(g.traffic.violationEvent.memberId, 1);
  const event = g.traffic.violationEvent;
  assert.ok(Math.abs(g.elapsed - g.worldTime - 2) < 1e-8);
  simulate(g, 1);
  assert.equal(g.traffic.violations, 1);
  assert.equal(
    g.traffic.violationEvent,
    event,
    "no repeat for members or frames",
  );
  const calm = fixture();
  calm.player.y = 380;
  calm.party = createParty(3, calm.player);
  simulate(calm, 1, { left: true, right: true });
  assert.equal(calm.traffic.violations, 0);
  assert.equal(calm.player.y, 380);
});
test("green entry stays legal through late green and red, with the tail protected", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(3, g.player);
  g.worldTime = 4.2;
  g.traffic.vehicle.active = false;
  step(g, 0.025, {});
  assert.ok(g.traffic.reserved);
  assert.ok(g.player.y < 379);
  const late = fixture();
  late.player.y = 380;
  late.party = createParty(3, late.player);
  late.worldTime = late.traffic.greenEnd - crossingTime(late.party) + 0.05;
  late.traffic.vehicle.active = false;
  step(late, 0.025, {});
  assert.ok(late.player.y < 379);
  assert.equal(late.traffic.reserved, true);
  assert.equal(late.traffic.enteredOnGreen, true);
  assert.equal(late.traffic.violations, 0);
  simulate(late, 5, { left: true, right: true });
  assert.equal(late.traffic.nominalGreen, false);
  assert.equal(late.traffic.reserved, true);
  assert.equal(late.traffic.violations, 0);
  assert.equal(late.traffic.violationEvent, null);
});
test("alignment and crossing width are bounded without changing body sizes", () => {
  const g = fixture();
  g.worldTime = 4.2;
  g.traffic.vehicle.active = false;
  g.player.x = 100;
  g.player.y = 380;
  g.party = createParty(3, g.player);
  step(g, 0.025, { right: true });
  assert.equal(g.player.y, 379);
  assert.equal(g.traffic.violations, 0);
  assert.equal(g.player.r, 12);
  g.player.x = 310;
  g.party = createParty(3, g.player);
  step(g, 0.025, {});
  simulate(g, 0.6, { right: true });
  assert.ok(g.player.x <= 318);
  assert.ok(g.party.members.every((m) => m.r === 9));
});
test("a delayed last member reserves the road beyond red and vehicles yield", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(4, g.player);
  g.worldTime = 4.2;
  g.traffic.vehicle.active = false;
  step(g, 0.025, {});
  simulate(g, 6, { left: true, right: true });
  assert.equal(g.traffic.nominalGreen, false);
  assert.equal(g.traffic.reserved, true);
  const x = g.traffic.vehicle.x;
  simulate(g, 0.5, { left: true, right: true });
  assert.equal(g.traffic.vehicle.x, x);
  assert.equal(g.traffic.vehicle.entered, false);
  simulate(g, 2.5);
  assert.equal(g.traffic.reserved, true, "fourth companion is still protected");
  simulate(g, 0.5);
  assert.ok(g.party.members.every((m) => m.y + m.r < g.traffic.top));
  step(g, 0.025, {});
  assert.equal(g.traffic.reserved, false);
});
test("cars and bicycles remain separate from all people across seeds and cycles", () => {
  const kinds = new Set();
  for (const stage of [1, 3])
    for (const seed of [17, 2026, 1402485690 + stage * 97]) {
      const g = createGame(stage, seed);
      g.phase = "playing";
      let waiting = 0;
      for (let n = 0; n < 2200; n++) {
        step(g, 0.025, { left: true, right: true });
        const v = g.traffic.vehicle;
        kinds.add(v.kind);
        for (const p of [
          ...g.crowd.filter((p) => p.active),
          g.player,
          ...g.party.members,
        ])
          if (v.active && v.entered)
            assert.ok(
              !overlap(v, p),
              `stage${stage} seed${seed} tick${n} ${v.kind} p${p.id} ${v.x}/${p.x}/${p.y}`,
            );
        const active = g.crowd.filter((p) => p.active);
        for (let i = 0; i < active.length; i++)
          for (let j = i + 1; j < active.length; j++)
            assert.ok(
              Math.hypot(active[i].x - active[j].x, active[i].y - active[j].y) >
                27,
              `pedestrian overlap ${stage}/${seed}/${n}/${active[i].id}/${active[j].id}`,
            );
        waiting += g.crowd.filter((p) => p.trafficWait).length;
      }
      assert.ok(waiting > 0, "pedestrians wait for signal");
    }
  assert.deepEqual([...kinds].sort(), ["bicycle", "car"]);
});
test("outdoor alternate seeds allow all-member zero-contact zero-violation arrival", () => {
  for (const stage of [1, 3])
    for (const seed of [17, 2026]) {
      const route = planRoute(stage, seed, 32);
      assert.ok(route, `stage${stage} seed${seed}`);
      const g = createGame(stage, seed);
      g.phase = "playing";
      for (const a of route.path)
        for (let k = 0; k < 4; k++) {
          step(g, 0.025, routeInput(a));
          const v = g.traffic.vehicle;
          if (v.active && v.entered)
            for (const p of [
              g.player,
              ...g.party.members,
              ...g.crowd.filter((p) => p.active),
            ])
              assert.ok(
                !overlap(v, p),
                "moving party and all pedestrians remain safe",
              );
        }
      assert.equal(g.phase, "finished");
      assert.equal(g.hits, 0);
      assert.equal(g.traffic.violations, 0);
    }
});

test("manual signal waits, repeated stops and green restart never count as violations", () => {
  const g = fixture();
  g.player.y = 395;
  g.party = createParty(4, g.player);
  simulate(g, 2.6, { left: true, right: true });
  assert.equal(g.player.y, 395);
  assert.equal(g.traffic.violations, 0);
  assert.equal(g.elapsed, g.worldTime);
  simulate(g, 1);
  assert.ok(g.traffic.reserved);
  assert.equal(g.traffic.enteredOnGreen, true);
  for (let n = 0; n < 3; n++) {
    simulate(g, 0.5, { left: true, right: true });
    simulate(g, 0.3);
  }
  assert.equal(g.traffic.violations, 0);
  assert.equal(g.traffic.violationEvent, null);
});

test("red entry without companions has no imaginary speaker and reset clears the event", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(0, g.player);
  step(g, 0.025, {});
  assert.equal(g.traffic.violations, 1);
  assert.equal(g.traffic.violationEvent.memberId, 0);
  assert.equal(g.traffic.violationEvent.message, "");
  const reset = createGame(3);
  assert.equal(reset.traffic.violations, 0);
  assert.equal(reset.traffic.violationEvent, null);
});

function availableCenters(people, y, left = 162, right = 318) {
  const intervals = people
    .filter((p) => p.active && Math.abs(p.y - y) < 26)
    .map((p) => {
      const dx = Math.sqrt(26 ** 2 - (p.y - y) ** 2);
      return [Math.max(left, p.x - dx), Math.min(right, p.x + dx)];
    })
    .filter(([a, b]) => a < b)
    .sort((a, b) => a[0] - b[0]);
  let end = left,
    gap = 0;
  for (const [a, b] of intervals) {
    gap = Math.max(gap, a - end);
    end = Math.max(end, b);
  }
  return Math.max(gap, right - end);
}

test("signal queues retain people and body clearance, discharge both flows, and leave a usable gap", () => {
  for (const stage of [1, 3])
    for (const seed of [17, 2026, 1402485690 + stage * 97]) {
      const g = createGame(stage, seed);
      g.phase = "playing";
      g.player.y = 395;
      g.party = createParty(stage, g.player);
      const origins = new Map(
        g.crowd.map((p) => [
          p.id,
          { y: p.y, route: structuredClone(p.route), group: p.group },
        ]),
      );
      const north = new Set(),
        south = new Set();
      for (let n = 0; n < 2200; n++) {
        step(g, 0.025, { left: true, right: true });
        assert.equal(g.crowd.length, stage === 1 ? 12 : 30, "no crowd removal");
        const active = g.crowd.filter((p) => p.active);
        for (let i = 0; i < active.length; i++)
          for (let j = i + 1; j < active.length; j++)
            assert.ok(
              Math.hypot(active[i].x - active[j].x, active[i].y - active[j].y) >
                30,
              "queue body margin",
            );
        if (!g.traffic.nominalGreen)
          assert.ok(
            availableCenters(active, 379) > 10,
            `blocked stop line ${stage}/${seed}/${n}`,
          );
        for (const p of active) {
          const initial = origins.get(p.id);
          assert.deepEqual(p.route, initial.route, "destination preserved");
          assert.equal(p.group, initial.group, "group identity preserved");
          if (initial.y > 425 && p.y < 240) north.add(p.id);
          if (initial.y < 240 && p.y > 425) south.add(p.id);
        }
      }
      assert.ok(
        north.size && south.size,
        "both queues discharge rather than deleting people",
      );
    }
});

test("bounded signal waiting and all-member clean routes are competitive with contact-heavy straight runs", () => {
  for (const stage of [1, 3])
    for (const seed of [17, 2026, 1402485690 + stage * 97]) {
      const clean = createGame(stage, seed);
      clean.phase = "playing";
      const t = clean.traffic,
        green = t.greenEnd - t.greenStart;
      assert.equal(green, 6.5);
      assert.equal(t.period - green, 2.5);
      assert.ok(
        t.period - green + crossingTime(clean.party) < 6,
        "party entry window",
      );
      const route = planRoute(stage, seed, 32);
      assert.ok(route);
      for (const a of route.path)
        for (let k = 0; k < 4; k++) step(clean, 0.025, routeInput(a));
      const direct = createGame(stage, seed);
      direct.phase = "playing";
      for (let n = 0; n < 4000 && direct.phase === "playing"; n++)
        step(direct, 0.025, {});
      assert.equal(clean.phase, "finished");
      assert.equal(clean.hits, 0);
      assert.equal(clean.traffic.violations, 0);
      assert.equal(direct.phase, "finished");
      assert.ok(
        clean.elapsed <= direct.elapsed + 0.001,
        `${stage}/${seed}: clean ${clean.elapsed} vs straight ${direct.elapsed}`,
      );
    }
});

test("an actual passing car is cleared before entry without a red-light auto-brake penalty", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(4, g.player);
  g.worldTime = 1;
  Object.assign(g.traffic.vehicle, { x: 240, entered: true, active: true });
  step(g, 0.025, {});
  assert.equal(
    g.player.y,
    379,
    "wait for the actual vehicle, not for signal color",
  );
  assert.equal(g.traffic.violations, 0);
  assert.ok(Math.abs(g.elapsed - (g.worldTime - 1)) < 1e-9);
  for (let n = 0; n < 400 && g.phase === "playing"; n++) {
    step(g, 0.025, {});
    const v = g.traffic.vehicle;
    if (v.active && v.entered)
      for (const p of [g.player, ...g.party.members]) assert.ok(!overlap(v, p));
  }
  assert.equal(
    g.traffic.violations,
    1,
    "one red entry after the car has passed",
  );
  assert.equal(g.traffic.violationEvent.memberId, 1);
});
