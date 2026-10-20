import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelHopGesture, createGame, HOP_COOLDOWN, HOP_DISTANCE,
  HOP_SPEED, step,
} from '../logic.js';

const released = { left: false, right: false, hopEnabled: true };
const side = (right) => ({ left: !right, right, hopEnabled: true });
function ready(stage = 0) {
  const g = createGame(stage, 17);
  g.phase = 'playing';
  g.crowd = [];
  g.animals = [];
  return g;
}
function doubleSide(g, right) {
  step(g, 0.025, side(right));
  step(g, 0.025, released);
  step(g, 0.025, side(right));
}

test('left and right double taps produce a bounded, faster swept sidestep', () => {
  for (const right of [false, true]) {
    const g = ready();
    const start = g.player.x;
    step(g, 0.025, side(right));
    assert.equal(Math.abs(g.player.x - start), 2.5, 'single press still steers normally');
    step(g, 0.025, released);
    const beforeHop = g.player.x;
    step(g, 0.025, side(right));
    assert.ok(Math.abs(g.player.x - beforeHop) > 2.5);
    assert.ok(Math.abs(g.player.x - beforeHop) <= HOP_SPEED * 0.025 + 0.01);
    assert.ok(g.hop);
    let last = g.player.x;
    for (let i = 0; i < 12; i++) {
      step(g, 0.025, released);
      assert.ok(Math.abs(g.player.x - last) <= HOP_SPEED * 0.025 + 0.01);
      last = g.player.x;
    }
    assert.equal(g.hop, null);
    assert.ok(Math.abs(g.player.x - start) <= HOP_DISTANCE + 2.6);
    assert.ok(g.hopReadyAt >= HOP_COOLDOWN);
  }
});

test('held keys, opposite taps and a brake chord never count as a same-side double tap', () => {
  const g = ready();
  for (let i = 0; i < 30; i++) step(g, 0.025, side(true));
  assert.equal(g.hopReadyAt, 0);
  step(g, 0.025, released);
  step(g, 0.025, side(false));
  assert.equal(g.hopReadyAt, 0);
  step(g, 0.025, released);
  step(g, 0.025, { left: true, right: true, hopEnabled: true });
  assert.equal(g.hopReadyAt, 0);
  assert.equal(g.hop, null);
  assert.equal(g.callReadyAt, 0);
  step(g, 0.025, released);
  doubleSide(g, true);
  assert.equal(g.callReadyAt, 0, 'same-side gesture cannot trigger courtesy');
  assert.ok(g.hopReadyAt > 0);
});

test('hop stops at people, animals, field edges and hall doorway without tunneling', () => {
  for (const kind of ['person', 'animal']) {
    const g = ready();
    const blocker = { ...createGame(0, 17).crowd[0], id: kind === 'animal' ? 2000 : 900,
      x: g.player.x + 35, y: g.player.y, r: 12, active: true,
      anchor: true, state: 'meeting', wait: 100,
      route: [{ x: g.player.x + 35, y: g.player.y }] };
    if (kind === 'animal') {
      Object.assign(blocker, { animal: true, minX: blocker.x, maxX: blocker.x,
        kind: 'dog', speed: 0, time: 0 });
      g.animals = [blocker];
    } else g.crowd = [blocker];
    doubleSide(g, true);
    for (let i = 0; i < 10; i++) step(g, 0.025, released);
    assert.ok(g.player.x < blocker.x - 20, kind);
    assert.equal(g.hop, null);
    assert.equal(g.hits, 1, kind);
  }
  const edge = ready();
  edge.player.x = 447;
  doubleSide(edge, true);
  assert.ok(edge.player.x <= 450);
  assert.equal(edge.hop, null);
  const hall = ready(4);
  hall.player.x = 150;
  hall.player.y = 700;
  doubleSide(hall, false);
  assert.ok(hall.player.x >= 142, 'physical hall gate remains solid');
  assert.equal(hall.hop, null);
});

test('cooldown, pause, cancel and fresh stage prevent stale hops', () => {
  const g = ready();
  doubleSide(g, true);
  const firstReady = g.hopReadyAt;
  for (let i = 0; i < 20; i++) step(g, 0.025, released);
  doubleSide(g, true);
  assert.equal(g.hopReadyAt, firstReady);
  step(g, 0.025, released);
  step(g, 0.025, side(true));
  cancelHopGesture(g);
  assert.equal(g.hop, null);
  g.phase = 'paused';
  const frozen = JSON.stringify(g);
  step(g, 0.025, released);
  assert.equal(JSON.stringify(g), frozen);
  assert.equal(createGame(0, 17).hopTapAt, null);
  assert.equal(createGame(1, 17).hopReadyAt, 0);
});
