import test from "node:test";
import assert from "node:assert/strict";
import {
  askCrowdToMove, availableCourtesyTargets,
} from "../crowd.js";
import { createRun, beginRun, updateRun } from "../src/run.js";

const walker = (id, x, y) => ({
  id, x, y, r: 13, active: true, animal: false,
  state: "walking", pace: 25, vx: 0, vy: -25,
  ux: 0, uy: -1, route: [{ x, y: 200 }], leg: 0,
});

test("a call selects the open side instead of crossing a neighbor", () => {
  const player = { x: 240, y: 570 };
  const person = walker(1, 240, 500);
  const rightNeighbor = walker(2, 278, 500);
  rightNeighbor.animal = true; // Obstacle in the gap, never a responder.
  const crowd = [person, rightNeighbor];
  const before = crowd.map(({ x, y }) => [x, y]);
  const targets = availableCourtesyTargets(crowd, player);
  assert.equal(targets.length, 1);
  assert.ok(targets[0].targetX < person.x,
    "the swept right path is blocked; the left path is open");
  assert.deepEqual(crowd.map(({ x, y }) => [x, y]), before);
  assert.equal(askCrowdToMove(crowd, player), 1);
  assert.equal(person.courtesy.targetX, targets[0].targetX);
  assert.equal(person.courtesy.phase, "prepare");
  assert.equal(rightNeighbor.courtesy, undefined);
});

test("wall room breaks an otherwise equal choice toward open pavement", () => {
  const person = walker(3, 95, 500);
  const player = { x: 95, y: 570 };
  const [choice] = availableCourtesyTargets([person], player);
  assert.ok(choice.targetX > person.x, "the wall-side landing is too tight");
  assert.ok(choice.targetX <= 425);
});

test("a clear landing still rejects a shoulder path through somebody", () => {
  const person = walker(4, 240, 500);
  const neighbor = walker(5, 258, 522);
  Object.assign(neighbor, { state: "meeting", vx: 0, vy: 0,
    animal: true });
  assert.ok(Math.hypot(neighbor.x - 278, neighbor.y - 490) > 29,
    "the right endpoint itself is clear");
  const [choice] = availableCourtesyTargets([person, neighbor],
    { x: 240, y: 570 });
  assert.ok(choice.targetX < person.x,
    "the chosen route avoids a nearby person's shoulder");
});

test("the warning beat keeps forward travel and repeat taps do not restart it", () => {
  const run = createRun(0, 17);
  const person = run.crowd.find((p) => p.id === 12);
  run.player.y = person.y + 70;
  beginRun(run);
  const start = { x: person.x, y: person.y };
  updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.equal(run.callResponseCount, 1);
  assert.equal(person.courtesy.phase, "prepare");
  assert.ok(person.y < start.y, "the commuter does not stop for the cue");
  const targetX = person.courtesy.targetX;
  updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.equal(run.callResponseCount, 1);
  assert.equal(person.courtesy.targetX, targetX);
  assert.equal(person.courtesy.phase, "prepare");
  updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.equal(person.courtesy.phase, "yield",
    "another tap cannot extend the preparation beat");
  const beforeYield = person.x;
  updateRun(run, 0.05, { brake: true });
  assert.ok(Math.abs(person.x - beforeYield) > 2,
    "the visible lateral step follows the warning");
  for (let n = 0; n < 16; n++)
    updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.ok(Math.abs(person.x - start.x) <= 39,
    "rapid taps never stack shifts toward the wall");
  assert.ok(person.y < start.y - 8,
    "the person continues toward their destination while giving way");
  assert.ok(run.callSerial >= 19);
});
