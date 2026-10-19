import test from "node:test";
import assert from "node:assert/strict";
import { createGame, seedForRun } from "../logic.js";
import { GOAL_HOUSES, streetHouses, houseDoor, makeProjector, drawStageOne3D, drawPerson } from "../stage1-3d-render.js";

test("stage 1 homes have road-facing wall doors, a central open approach, and visible depth", () => {
  assert.equal(GOAL_HOUSES.length, 2);
  for (const house of [...GOAL_HOUSES, ...streetHouses()]) {
    const door = houseDoor(house);
    assert.equal(door.x, house.face === "east" ? house.x + house.w : house.x);
    assert.ok(door.y > house.y && door.y < house.y + house.d);
    assert.ok(door.top < 42, "the entrance must remain below the roof eave");
  }
  for (const house of streetHouses())
    assert.ok(house.face === "east" ? house.x + house.w <= 30 : house.x >= 450);
  assert.ok(GOAL_HOUSES[0].x + GOAL_HOUSES[0].w < 174);
  assert.ok(GOAL_HOUSES[1].x > 306);
  const camera = makeProjector(390, 844, 350);
  const ground = camera.point(160, 340, 0);
  const roof = camera.point(160, 340, 42);
  assert.ok(ground.y - roof.y > 20, "a house wall must have legible vertical height on mobile");
  assert.ok(camera.point(160, 340, 0).x !== camera.point(160, 380, 0).x,
    "the street-facing side must be visible in the oblique view");
});

test("the 3D draw uses the existing model without changing simulation state", () => {
  const game = createGame(0, seedForRun(17, 0));
  const before = structuredClone(game);
  const ctx = new Proxy({}, {
    get: (object, key) => key in object ? object[key] : () => {},
    set: (object, key, value) => ((object[key] = value), true),
  });
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw Error("drawing must not consume game randomness"); };
    drawStageOne3D(ctx, game, { width: 390, height: 844 });
    drawStageOne3D(ctx, game, { width: 1024, height: 768 });
  } finally {
    Math.random = originalRandom;
  }
  assert.deepEqual(game, before);
});
test("3D walkers turn their stride and held hand with actual movement", () => {
  const actor = { x: 100, y: 100, r: 11, id: 1, state: "walking" };
  const projector = { scale: 1, point: (x, y) => ({ x, y }) };
  for (const [ux, uy] of [[0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
    const lines = [];
    let path = [];
    const values = {};
    const ctx = new Proxy(values, {
      get(object, key) {
        if (key in object) return object[key];
        if (key === "beginPath") return () => { path = []; };
        if (key === "moveTo" || key === "lineTo")
          return (x, y) => path.push([x, y]);
        if (key === "stroke") return () => {
          if (object.strokeStyle === "#334b55" && object.lineWidth === 4.8)
            lines.push(path);
        };
        return () => {};
      },
      set(object, key, value) { object[key] = value; return true; },
    });
    const pose = { ux, uy, moving: true, speed: 70, distance: 7 };
    const { rightHand, frame } = drawPerson(ctx, projector, actor, { pose });
    const length = Math.hypot(ux, uy),
      forward = [ux / length, uy / length],
      right = [-forward[1], forward[0]];
    assert.equal(lines.length, 2);
    for (const [index, line] of lines.entries()) {
      const displacement = [line[1][0] - line[0][0],
        line[1][1] - line[0][1]];
      const sideways = displacement[0] * right[0] + displacement[1] * right[1];
      const ahead = displacement[0] * forward[0] + displacement[1] * forward[1];
      assert.ok(Math.abs(sideways) < 1e-8, "feet stride along travel, not sideways");
      assert.ok(Math.abs(ahead - frame.stride * (index ? 1 : -1)) < 1e-8);
    }
    const handSide = (rightHand[0] - actor.x) * right[0] +
      (rightHand[1] - actor.y) * right[1];
    assert.ok(Math.abs(handSide - 12) < 1e-8);
  }
  const still = new Proxy({}, {
    get: (object, key) => key in object ? object[key] : () => {},
    set: (object, key, value) => ((object[key] = value), true),
  });
  const rightward = { ux: 1, uy: 0, moving: false, speed: 0, distance: 7 };
  const stopped = drawPerson(still, projector, actor, { pose: rightward });
  assert.equal(stopped.frame.stride, 0);
  assert.deepEqual(stopped.frame.forward, { x: 1, y: 0 });
  const reduced = drawPerson(still, projector, actor, {
    pose: { ...rightward, moving: true, speed: 70 }, reducedMotion: true,
  });
  assert.equal(reduced.frame.stride, 0);
  assert.deepEqual(reduced.frame.forward, { x: 1, y: 0 });
});
