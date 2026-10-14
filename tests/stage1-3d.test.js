import test from "node:test";
import assert from "node:assert/strict";
import { createGame, seedForRun } from "../logic.js";
import { GOAL_HOUSES, streetHouses, houseDoor, makeProjector, drawStageOne3D } from "../stage1-3d-render.js";

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
