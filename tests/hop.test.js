import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, HOP_DISTANCE, HOP_TAP_WINDOW, HOP_COOLDOWN } from "../logic.js";
import { createRun, beginRun, updateRun } from "../src/run.js";

function game() {
  const g = createGame(0, 17);
  g.phase = "playing";
  g.crowd = [];
  g.animals = [];
  return g;
}
const tick = (g, input = {}, dt = 0.05) => step(g, dt, { ...input, hopEnabled: true });
const tapPair = (g, side) => {
  tick(g, { [side]: true });
  tick(g);
  tick(g, { [side]: true });
};

test("two same-side taps move exactly the hop distance in either direction", () => {
  for (const [side, sign] of [["left", -1], ["right", 1]]) {
    const g = game();
    tick(g, { [side]: true });
    tick(g);
    const before = g.player.x;
    tick(g, { [side]: true });
    while (g.hop) tick(g);
    assert.equal(g.player.x - before, sign * HOP_DISTANCE);
  }
});

test("taps beyond the window start a new candidate instead of hopping", () => {
  const g = game();
  tick(g, { left: true });
  for (let t = 0; t < HOP_TAP_WINDOW + 0.05; t += 0.05) tick(g);
  tick(g, { left: true });
  assert.equal(g.hop, null);
  assert.equal(g.hopReadyAt, 0);
  assert.equal(g.hopTapSide, -1);
});

test("an opposite tap becomes the first tap for that direction", () => {
  const g = game();
  tick(g, { left: true });
  tick(g);
  tick(g, { right: true });
  assert.equal(g.hop, null);
  assert.equal(g.hopTapSide, 1);
  tick(g);
  tick(g, { right: true });
  assert.equal(g.hop.side, 1);
});

test("cooldown consumes an immediate tap pair and allows a later pair", () => {
  const g = game();
  tapPair(g, "right");
  const readyAt = g.hopReadyAt;
  assert.ok(Math.abs(readyAt - (g.worldTime + HOP_COOLDOWN)) < 1e-9);
  while (g.hop) tick(g);
  tick(g, { right: true });
  tick(g);
  tick(g, { right: true });
  assert.equal(g.hop, null);
  assert.equal(g.hopTapAt, null);
  assert.equal(g.hopReadyAt, readyAt);
  while (g.worldTime < readyAt) tick(g);
  tick(g);
  tapPair(g, "right");
  assert.ok(g.hop);
});

test("braking cancels a pending tap and interrupts an active hop", () => {
  const g = game();
  tick(g, { left: true });
  tick(g, { left: true, right: true });
  assert.equal(g.hopTapAt, null);
  tick(g);
  tick(g, { left: true });
  assert.equal(g.hop, null);
  tick(g);
  tick(g, { left: true });
  assert.ok(g.hop);
  const x = g.player.x, y = g.player.y, readyAt = g.hopReadyAt;
  tick(g, { left: true, right: true });
  assert.equal(g.hop, null);
  assert.equal(g.player.x, x);
  assert.equal(g.player.y, y);
  assert.equal(g.hopReadyAt, readyAt);
});

test("arrival and stun cancel the gesture", () => {
  for (const state of ["arriving", "stun"]) {
    const g = game();
    tick(g, { left: true });
    g[state] = state === "stun" ? 1 : true;
    tick(g);
    assert.equal(g.hopTapAt, null);
    assert.equal(g.hop, null);
  }
});

test("updateRun enables a double tap and treats brake as cancellation", () => {
  const run = createRun(0, 17);
  beginRun(run);
  run.crowd = [];
  run.animals = [];
  updateRun(run, 0.05, { right: true });
  updateRun(run, 0.05, {});
  updateRun(run, 0.05, { right: true });
  assert.equal(run.hop?.side, 1);
  updateRun(run, 0.05, { brake: true });
  assert.equal(run.hop, null);
});
