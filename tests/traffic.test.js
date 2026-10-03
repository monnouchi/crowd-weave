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
test("red emergency stop is forgiving and counted once per red; braking prevents it", () => {
  const g = fixture();
  g.player.y = 380;
  g.party = createParty(3, g.player);
  simulate(g, 0.3);
  assert.equal(g.player.y, 379);
  assert.equal(g.traffic.safetyStops, 1);
  assert.ok(Math.abs(g.elapsed - g.worldTime - 2) < 1e-8);
  simulate(g, 1);
  assert.equal(g.traffic.safetyStops, 1);
  const calm = fixture();
  calm.player.y = 380;
  calm.party = createParty(3, calm.player);
  simulate(calm, 1, { left: true, right: true });
  assert.equal(calm.traffic.safetyStops, 0);
  assert.equal(calm.player.y, 380);
});
test("party may enter only with enough green for every member; late green waits safely", () => {
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
  late.worldTime = 9.5 - crossingTime(late.party) + 0.05;
  late.traffic.vehicle.active = false;
  step(late, 0.025, {});
  assert.equal(late.player.y, 379);
  assert.equal(late.traffic.reserved, false);
  assert.equal(late.traffic.safetyStops, 0);
  assert.equal(late.traffic.warning, true);
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
  assert.equal(g.traffic.safetyStops, 0);
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
  g.party = createParty(3, g.player);
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
test("outdoor alternate seeds allow all-member zero-contact zero-emergency arrival", () => {
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
      assert.equal(g.traffic.safetyStops, 0);
    }
});
