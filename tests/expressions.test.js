import test from "node:test";
import assert from "node:assert/strict";
import { makeCrowd, moveCrowd, reactToContact } from "../crowd.js";
import { createGame, step } from "../logic.js";
import { drawPedestrianFace, pedestrianExpression, pedestrianFacing } from "../src/render.js";

const tense = (expression) => ["hurried", "grim", "tired"].includes(expression);

test("seeded walkers reflect direction and hate without losing the gradient", () => {
  const crowd = Array.from({ length: 20 }, (_, i) => makeCrowd(100, 30, i + 1)).flat();
  const game = { player: { x: 240, y: 400 }, hate: 0, worldTime: 1 };
  const rate = (people, hate) => people.filter(p => tense(pedestrianExpression(p, { ...game, hate }))).length / people.length;
  const opposing = crowd.filter(p => p.uy > .18);
  const along = crowd.filter(p => p.uy < -.18);
  assert.ok(rate(opposing, 0) > rate(along, 0));
  assert.ok(rate(crowd, 1) > rate(crowd, 0) + .1);
  assert.ok(rate(crowd, 1) < 1);
  for (const p of crowd) assert.ok(!tense(pedestrianExpression({ ...p, friend: true, reaction: { remaining: 1 } }, { ...game, hate: 1 })));
  assert.equal(pedestrianExpression({ friend: true, leaveTime: 0 }, game), "grim");
});

test("back views never draw any face marks, including tense expressions", () => {
  let calls = 0;
  const ctx = new Proxy({}, { get: () => () => { calls++; }, set: () => true });
  for (const expression of ["normal", "smile", "surprised", "hurried", "grim", "tired"]) {
    drawPedestrianFace(ctx, 10, 10, 2, { headFront: false, headProfile: 0 }, expression);
    assert.equal(calls, 0, expression);
  }
});

test("a rear contact turns the head to draw the grim face until the reaction expires", () => {
  const p = { ...makeCrowd(1, 30, 1)[0], x: 100, y: 100,
    ux: 0, uy: -1, state: "walking", awarePlayer: false };
  let calls = 0;
  const ctx = new Proxy({}, { get: () => () => { calls++; }, set: () => true });
  const draw = () => drawPedestrianFace(ctx, 10, 10, 2,
    pedestrianFacing(p), pedestrianExpression(p));
  assert.equal(pedestrianFacing(p).headFront, false);
  draw();
  assert.equal(calls, 0);
  reactToContact(p, { x: 100, y: 110 });
  assert.equal(pedestrianFacing(p).headFront, true);
  assert.equal(pedestrianExpression(p), "grim");
  draw();
  assert.ok(calls > 0);
  moveCrowd([p], 1);
  assert.equal(p.reaction, null);
  assert.equal(pedestrianFacing(p).headFront, false);
  calls = 0;
  draw();
  assert.equal(calls, 0);
});

test("contact and near-miss tighten briefly then return to the base expression", () => {
  const g = createGame(0, 17); g.phase = "playing"; g.crowd = []; g.animals = [];
  const p = { ...makeCrowd(1, 30, 1)[0], x: g.player.x + 30, y: g.player.y - 1,
    state: "meeting", wait: 10 };
  g.crowd.push(p);
  const base = pedestrianExpression(p, g);
  reactToContact(p, g.player);
  assert.equal(pedestrianExpression(p, g), "grim");
  p.reaction = null;
  step(g, .05, {});
  assert.equal(g.combo.nearMissSerial, 1);
  assert.equal(pedestrianExpression(p, g), "grim");
  g.worldTime = p.tenseUntil + .01;
  assert.equal(pedestrianExpression(p, g), base);
});
