import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import { radarSnapshot } from "../src/radar.js";

const close = (a, b) => Math.abs(a - b) < 1e-6;
const horizontalAt = (snapshot, y) => snapshot.walls.filter((line) =>
  close(line.y1, y) && close(line.y2, y));
const verticalAt = (snapshot, x) => snapshot.walls.filter((line) =>
  close(line.x1, x) && close(line.x2, x));

test("the player-centred radar reports only nearby collision bodies", () => {
  const run = createRun(0, 17);
  Object.assign(run.player, { x: 240, y: 600 });
  run.crowd = [
    { id: 1, active: true, x: 260, y: 545, r: 13, vx: 8, vy: -20 },
    { id: 2, active: true, x: 240, y: 400, r: 13 },
    { id: 3, active: false, x: 240, y: 540, r: 13 },
  ];
  run.party.members = [{ id: 4, x: 240, y: 555, r: 13 }];
  run.animals = [
    { id: 2000, active: true, x: 250, y: 620, r: 9, vx: -30 },
    { id: 2001, active: true, x: 400, y: 580, r: 12 },
  ];
  const before = structuredClone({ player: run.player, crowd: run.crowd,
    animals: run.animals });
  const view = radarSnapshot(run);
  assert.equal(view.playerRadius, 12);
  assert.deepEqual(view.actors, [
    { id: 1, kind: "person", x: 20, y: 55, r: 13, vx: 8, vy: 20 },
    { id: 2000, kind: "animal", x: 10, y: -20, r: 9, vx: -30, vy: 0 },
  ]);
  assert.deepEqual({ player: run.player, crowd: run.crowd,
    animals: run.animals }, before);
  assert.deepEqual(radarSnapshot(run), view);
});

test("steering scrolls real walkers on the map without changing their world route", () => {
  const run = createRun(0, 17);
  Object.assign(run.player, { x: 240, y: 900 });
  const walker = run.crowd.find((person) => person.id === 7);
  assert.ok(walker?.active);
  const original = { x: walker.x, y: walker.y, seed: run.runSeed,
    route: structuredClone(walker.route) };
  const before = radarSnapshot(run).actors.find((actor) => actor.id === 7);
  assert.ok(before);

  run.player.x += 18;
  run.player.y -= 10;
  const after = radarSnapshot(run).actors.find((actor) => actor.id === 7);
  assert.equal(after.x, before.x - 18);
  assert.equal(after.y, before.y - 10);
  assert.deepEqual({ x: walker.x, y: walker.y, seed: run.runSeed,
    route: walker.route }, original);
});

test("street edges and the actual narrow goal entrance appear only nearby", () => {
  const run = createRun(0, 17);
  Object.assign(run.player, { x: 122, y: 500 });
  let view = radarSnapshot(run);
  assert.ok(verticalAt(view, -92).length >= 1);
  assert.equal(verticalAt(view, 328).length, 0);
  assert.equal(horizontalAt(view, 393).length, 0,
    "the distant goal entrance is not leaked into the local view");

  Object.assign(run.player, { x: 240, y: 145 });
  view = radarSnapshot(run);
  const entrance = horizontalAt(view, 38);
  assert.ok(entrance.some((line) => line.x2 <= -66));
  assert.ok(entrance.some((line) => line.x1 >= 66));
  assert.ok(!entrance.some((line) => line.x1 < 0 && line.x2 > 0),
    "the central opening stays clear on the map");
});

test("the crossing shows its marked lane, actual stop sides, and vehicle hitbox", () => {
  const run = createRun(1, 17);
  const crossing = run.crossings[0];
  Object.assign(run.player, { x: 240, y: crossing.bottom + 75 });
  crossing.vehicle = { id: 9, kind: "car", active: true,
    x: 260, y: crossing.top + 22, width: 58, direction: 1 };
  crossing.nominalGreen = false;
  crossing.canEnter = false;
  let view = radarSnapshot(run);
  assert.equal(view.roads.length, 1);
  assert.deepEqual(view.roads[0], {
    id: "station", front: 140, back: 75, left: -90, right: 90,
    canEnter: false, nominalGreen: false,
  });
  assert.deepEqual(view.vehicles, [{ id: "station:9", kind: "car",
    x: 20, previousX: 20, y: 118, width: 58, height: 30,
    direction: 1 }]);
  const stops = horizontalAt(view, 61);
  assert.ok(stops.some((line) => line.x2 <= -78));
  assert.ok(stops.some((line) => line.x1 >= 78));
  assert.ok(!stops.some((line) => line.x1 < 0 && line.x2 > 0));

  crossing.crossing = true;
  crossing.canEnter = true;
  view = radarSnapshot(run);
  assert.equal(view.roads[0].canEnter, true);
  assert.equal(horizontalAt(view, 61).length, 0);
  assert.ok(verticalAt(view, -78).length >= 1);
  assert.ok(verticalAt(view, 78).length >= 1);

  crossing.vehicle = { id: 10, kind: "bicycle", active: true,
    x: 250, y: crossing.top + 22, width: 32, direction: -1 };
  assert.deepEqual(radarSnapshot(run).vehicles, [{ id: "station:10",
    kind: "bicycle", x: 10, previousX: 10, y: 118, width: 32, height: 16,
    direction: -1 }]);
  crossing.vehicle.x = 600;
  crossing.vehicle.previousX = 600;
  assert.deepEqual(radarSnapshot(run).vehicles, [],
    "an unseen vehicle does not appear early on the radar");

  crossing.vehicle = { id: 11, kind: "car", active: false,
    wasActive: true, previousX: 362, x: 374,
    y: crossing.top + 22, width: 58, direction: 1 };
  assert.deepEqual(radarSnapshot(run).vehicles, [{ id: "station:11",
    kind: "car", x: 134, previousX: 122, y: 118,
    width: 58, height: 30, direction: 1 }],
  "a vehicle that just swept past the radar edge can still collide this frame");
  crossing.vehicle.wasActive = false;
  assert.deepEqual(radarSnapshot(run).vehicles, []);
});

test("both hall chokes use the same physical side limits as movement", () => {
  const run = createRun(4, 17);
  Object.assign(run.player, { x: 240, y: 860 });
  let view = radarSnapshot(run);
  const first = horizontalAt(view, 23);
  assert.ok(first.some((line) => line.x2 <= -98));
  assert.ok(first.some((line) => line.x1 >= 98));
  assert.ok(verticalAt(view, -98).length >= 1);
  assert.ok(verticalAt(view, 98).length >= 1);

  run.player.y = 745;
  view = radarSnapshot(run);
  const second = horizontalAt(view, 13);
  assert.ok(second.some((line) => line.x2 <= -98));
  assert.ok(second.some((line) => line.x1 >= 98));
});

test("every seeded chapter yields finite, bounded near-field data", () => {
  for (let stage = 0; stage < 5; stage++) {
    const run = createRun(stage, 17);
    Object.assign(run.player, { x: 240, y: run.startY / 2 });
    const first = radarSnapshot(run), second = radarSnapshot(run);
    assert.deepEqual(first, second, `stage ${stage} stays deterministic`);
    for (const actor of first.actors) {
      assert.ok(Math.abs(actor.x) <= first.side + actor.r);
      assert.ok(actor.y >= -first.behind - actor.r);
      assert.ok(actor.y <= first.ahead + actor.r);
      assert.ok([actor.x, actor.y, actor.r].every(Number.isFinite));
    }
    for (const wall of first.walls)
      assert.ok(Object.values(wall).every(Number.isFinite));
  }
});
