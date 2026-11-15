import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, flowTier, NEAR_MISS_CLEARANCE } from "../logic.js";
import { planRoute, replayPlannedRoute } from "../validation/plan-route.js";
import { makeCrowd, askCrowdToMove } from "../crowd.js";
import { createParty } from "../party.js";
import { createTraffic } from "../traffic.js";
import { createRun, beginRun, updateRun } from "../src/run.js";

function game() {
  const g = createGame(0, 17);
  g.phase = "playing"; g.crowd = []; g.animals = [];
  return g;
}
function person(g, dx, overrides = {}) {
  const p = { ...makeCrowd(1, 30, 1)[0], id: `test-${g.worldTime}-${g.crowd.length}`,
    x: g.player.x + dx, y: g.player.y - 1, state: "meeting", wait: 10, ...overrides };
  g.crowd.push(p); return p;
}
const tick = (g, input = {}) => step(g, .05, input);
const brake = { left: true, right: true };

test("clean and near passes score at their resulting tier, once per person", () => {
  const g = game();
  const p = person(g, 60); tick(g);
  assert.equal(g.combo.flow, 1); assert.equal(g.combo.score, 100);
  g.crowd = []; person(g, 30); tick(g);
  assert.equal(g.combo.flow, 3); assert.equal(g.combo.score, 500);
  assert.ok(g.combo.kickUntil > g.worldTime);
  g.crowd = [p]; p.y = g.player.y - 1; tick(g);
  assert.equal(g.combo.flow, 3);
  assert.equal(g.combo.maxFlow, 3);
});
test("near threshold is tighter than a wide pass, and yielded people never score", () => {
  const near = game(); person(near, 25 + NEAR_MISS_CLEARANCE - 0.1); tick(near);
  assert.equal(near.combo.flow, 2);
  const wide = game(); person(wide, 25 + NEAR_MISS_CLEARANCE + 0.1); tick(wide);
  assert.equal(wide.combo.flow, 1); assert.equal(wide.combo.kickUntil, 0);
  const yielded = game(); person(yielded, 60, { yieldedToCall: true }); tick(yielded);
  assert.equal(yielded.combo.flow, 0);
});
test("call sets a sticky yielded flag on its targets", () => {
  const g = game(); const p = person(g, 0, { y: g.player.y - 50 });
  assert.ok(askCrowdToMove(g.crowd, g.player, [], 0) > 0);
  assert.equal(p.yieldedToCall, true);
});
test("contact clears flow and kick and prevents later credit for that person", () => {
  const g = game(); g.player.y = 400; g.combo.flow = 15; g.combo.kickUntil = 10;
  const p = person(g, 0, { y: g.player.y }); tick(g);
  assert.equal(g.hits, 1); assert.equal(g.combo.flow, 0);
  assert.equal(flowTier(g.combo.flow), 0); assert.equal(g.combo.kickUntil, 0);
  g.stun = 0; g.cooldown = 0; p.x = g.player.x + 60; p.y = g.player.y - 1; tick(g);
  assert.equal(g.combo.flow, 0);
});
test("decay uses playing time, including braking, and a pass refreshes it", () => {
  const g = game(); person(g, 60); tick(g); g.crowd = [];
  for (let i = 0; i < 40; i++) tick(g, brake);
  assert.equal(g.combo.flow, 1);
  person(g, 60); tick(g); g.crowd = [];
  for (let i = 0; i < 59; i++) tick(g, brake);
  assert.equal(g.combo.flow, 2);
  tick(g, brake); tick(g, brake); assert.equal(g.combo.flow, 1);
  for (let i = 0; i < 20; i++) tick(g, brake);
  assert.equal(g.combo.flow, 0);
});
test("tiers increase forward speed and braking still stops it", () => {
  const low = game(), high = game(); high.combo.flow = 15;
  const y = low.player.y; tick(low); tick(high);
  assert.ok(y - high.player.y > y - low.player.y);
  const before = high.player.y; tick(high, brake); assert.equal(high.player.y, before);
});
test("a new red-light violation clears flow even without a companion speaker", () => {
  const g = game(); g.crossings = [createTraffic(1)]; g.traffic = g.crossings[0];
  g.traffic.phaseOffset = 0; g.player.y = 380; g.party = createParty(0, g.player);
  g.combo.flow = 8; g.combo.kickUntil = 10; tick(g);
  assert.ok(g.violationEvent); assert.equal(g.combo.flow, 0); assert.equal(g.combo.kickUntil, 0);
});
test("a crossing during a hop earns a near-miss", () => {
  const g = game(); g.hop = { side: 1, remaining: 36 };
  person(g, 42); tick(g, { hopEnabled: true });
  assert.equal(g.combo.flow, 2);
});
test("run emits near-miss and records stage score and maximum flow", () => {
  const run = createRun(0, 17); beginRun(run); run.crowd = []; run.animals = [];
  person(run, 30); updateRun(run, .05);
  assert.ok(run.events.some((event) => event.kind === "nearMiss"));
  run.crowd = []; run.player.y = 86; run.player.x = 240; updateRun(run, .05);
  assert.equal(run.phase, "finished");
  assert.equal(run.records[0].score, 200); assert.equal(run.records[0].maxFlow, 2);
});
test("scripted seeded play has identical combo trajectories", () => {
  function simulate() {
    const g = game(); const result = [];
    for (let i = 0; i < 160; i++) {
      if (i % 30 === 0) { g.crowd = []; person(g, i % 60 ? 60 : 30); }
      tick(g, i % 20 < 5 ? brake : {});
      result.push({ ...g.combo });
    }
    return result;
  }
  assert.deepEqual(simulate(), simulate());
});

test("v2 full-physics driver completes every stage with the whole party", () => {
  // Companion to the base-pace fairness replays: with the combo pace fully
  // live (tiers and near-miss kick), a trajectory-tracking driver still
  // finishes every stage. Contacts stay bounded (measured 0/1/0/2/3 per
  // stage when this test was added) and FLOW demonstrably engages.
  for (let stage = 0; stage < 5; stage++) {
    const route = planRoute(stage, undefined, 50);
    assert.ok(route, `stage ${stage} route`);
    const g = createGame(stage);
    g.phase = "playing";
    replayPlannedRoute(g, route);
    for (let i = 0; i < 160 && g.phase === "playing"; i++) step(g, 0.025, {});
    assert.equal(g.phase, "finished", `stage ${stage} finishes`);
    assert.ok(g.hits <= 5, `stage ${stage} hits=${g.hits}`);
    assert.ok(g.combo.maxFlow >= 5, `stage ${stage} maxFlow=${g.combo.maxFlow}`);
  }
});
