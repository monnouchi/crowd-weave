import test from "node:test";
import assert from "node:assert/strict";
import { GOAL_APPROACH, WORLD_EDGE, HALL_LIMITS, FRONT_BARRIER_Y } from "../logic.js";
import { approachBarrierSpans } from "../src/render.js";

test("approach furniture follows unchanged player limits and leaves each opening clear", () => {
  assert.deepEqual(GOAL_APPROACH, { left: 174, right: 306, y: 107 });
  assert.deepEqual(WORLD_EDGE, { left: 30, right: 450 });
  assert.deepEqual(HALL_LIMITS, { left: 48, right: 432, end: 650,
    doorLeft: 142, doorRight: 338, margin: 12, doors: [[790, 825], [685, 720]] });
  assert.equal(FRONT_BARRIER_Y, 20);
  for (let stage = 0; stage < 4; stage++) {
    const goal = approachBarrierSpans(stage, -300).filter((s) => s.kind === "goal");
    assert.deepEqual(goal.map(({ x1, x2, y1, y2 }) => [x1, x2, y1, y2]),
      [[30, 174, -193, -193], [306, 450, -193, -193]]);
    assert.ok(goal.every((s) => s.x2 <= GOAL_APPROACH.left || s.x1 >= GOAL_APPROACH.right));
  }
  const hall = approachBarrierSpans(4);
  for (const [top, bottom] of HALL_LIMITS.doors) {
    const y = bottom + HALL_LIMITS.margin;
    assert.deepEqual(hall.filter((s) => s.kind === "door" && s.y1 === y && s.y2 === y)
      .map((s) => [s.x1, s.x2]), [[30, 142], [338, 450]]);
    for (const x of [142, 338]) assert.ok(hall.some((s) => s.kind === "door" &&
      s.x1 === x && s.x2 === x && s.y1 === top - 12 && s.y2 === y));
  }
  assert.ok(hall.some((s) => s.kind === "front" && s.y1 === FRONT_BARRIER_Y));
});
