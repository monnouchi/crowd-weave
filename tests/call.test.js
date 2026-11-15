import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCallRipple, activeSpeech, CALL_RIPPLE_DURATION,
  cancelCallGesture, createGame, step,
} from '../logic.js';
import { OneShotControl } from '../input.js';
import { CALL_AREA, courtesyCallWindow, courtesyUnavailableReason } from '../crowd.js';
import { callAreaFrame, renderWorld } from '../src/render.js';
import { createRun, beginRun, updateRun } from '../src/run.js';

const idle = { left: false, right: false };
function crowded(stage = 0) {
  const g = createGame(stage, 17);
  g.phase = 'playing';
  const y = g.player.y - 30;
  g.crowd = g.crowd.slice(0, 2).map((p, i) => ({
    ...p, id: 900 + i, x: g.player.x + (i ? 20 : -20), y,
    anchor: true, active: true, state: 'meeting', habit: 'meeting',
    wait: 100, route: [{ x: g.player.x + (i ? 20 : -20), y }],
  }));
  return g;
}
function pressCall(g, steering = idle) {
  step(g, 0.025, { ...steering, call: true });
}

test('call window measures the best available position without mutating state', () => {
  const g = crowded();
  g.crowd = [{ ...g.crowd[0], x: g.player.x, y: g.player.y - 56 }];
  const before = structuredClone({ crowd: g.crowd, player: g.player });
  const window = courtesyCallWindow(g.crowd, g.player);
  assert.ok(window > 0.95 && window <= 1);
  assert.equal(courtesyCallWindow(g.crowd, g.player), window);
  assert.deepEqual({ crowd: g.crowd, player: g.player }, before);

  g.crowd[0].y = g.player.y - 105;
  assert.ok(courtesyCallWindow(g.crowd, g.player) < 0.05);
  g.crowd[0].y = g.player.y - 56;
  g.crowd[0].x = g.player.x + 67;
  assert.ok(courtesyCallWindow(g.crowd, g.player) < 0.1);
  g.crowd[0].y = g.player.y - 120;
  assert.equal(courtesyCallWindow(g.crowd, g.player), null);
  assert.equal(courtesyCallWindow([], g.player), null);
});

test('run exposes a call window consistent with availability while playing', () => {
  const run = createRun(0, 17);
  beginRun(run);
  updateRun(run, 0.025, idle);
  assert.equal(run.callWindow === null, !run.callReady);
  if (run.callWindow !== null)
    assert.ok(run.callWindow >= 0 && run.callWindow <= 1);
});

test('one call press opens a person-only gap and confirms with a ripple', () => {
  const g = crowded();
  const from = { ...g.player };
  pressCall(g);
  assert.equal(activeSpeech(g)?.text, 'すみませーん！');
  assert.equal(g.callReadyAt, 0);
  assert.equal(g.callSerial, 1);
  assert.equal(g.callResponseCount, 2);
  assert.deepEqual(activeCallRipple(g), {
    x: from.x, y: from.y, progress: 0, age: 0, mode: 'recognized',
    responders: g.crowd.map(({ x, y }) => ({ x, y })),
  });
  assert.ok(g.crowd.every((p) => p.courtesy));
  assert.ok(g.crowd.every((p) => p.acknowledge));
  const before = g.crowd.map((p) => p.x);
  for (let i = 0; i < 24; i++) step(g, 0.025, idle);
  assert.ok(activeCallRipple(g)?.progress > 0.6);
  assert.ok(g.crowd[0].x < before[0] - 20);
  assert.ok(g.crowd[1].x > before[1] + 20);
  for (let i = 0; i < 35; i++) step(g, 0.025, idle);
  assert.equal(activeCallRipple(g), null);
});

test('only people who actually give way look back and bow briefly', () => {
  const g = crowded();
  g.crowd.push({ ...g.crowd[0], id: 950, x: 85,
    route: [{ x: 85, y: g.player.y - 30 }] });
  pressCall(g);
  assert.ok(g.crowd.slice(0, 2).every((p) => p.acknowledge));
  assert.equal(g.crowd[2].acknowledge, undefined);
  const face = g.crowd[0].acknowledge;
  assert.ok(face.faceY > 0, 'the responder faces the caller behind them');
  g.phase = 'paused';
  step(g, 1, idle);
  assert.equal(g.crowd[0].acknowledge, face);
  g.phase = 'playing';
  for (let i = 0; i < 31; i++) step(g, 0.025, idle);
  assert.equal(g.crowd[0].acknowledge, null);
});

test('both-side brake, including double taps and signal waits, never calls', () => {
  const g = crowded(1);
  g.player.y = g.traffic.bottom + 35;
  const original = { ...g.player };
  const chord = { left: true, right: true };
  for (let i = 0; i < 20; i++) {
    const beforeBrake = g.player.y;
    step(g, 0.025, chord);
    assert.equal(g.player.y, beforeBrake);
    step(g, 0.025, idle);
  }
  assert.equal(g.callReadyAt, 0);
  assert.equal(g.callRipple, null);
  assert.notEqual(g.speech?.kind, 'call');
  assert.equal(g.hopReadyAt, 0);
  assert.equal(g.player.x, original.x);
});

test('a held call fires once, while every released tap can renew a response', () => {
  const g = crowded();
  pressCall(g);
  const serial = g.speechSequence;
  const callSerial = g.callSerial;
  const first = g.callRipple;
  for (let i = 0; i < 8; i++) pressCall(g);
  assert.equal(g.callRipple, first);
  assert.equal(g.callSerial, callSerial);
  step(g, 0.025, idle);
  pressCall(g);
  assert.equal(g.callRipple.mode, 'recognized');
  assert.ok(g.callRipple.started > first.started);
  assert.equal(g.callReadyAt, 0);
  assert.equal(g.callSerial, callSerial + 1);
  assert.ok(g.callResponseCount >= 1);
  assert.ok(g.speechSequence > serial);
});

test('adjacent one-shot taps each fire even without an intervening false frame', () => {
  const g = crowded();
  step(g, 0.025, { ...idle, call: true, callPulse: true });
  assert.equal(g.callSerial, 1);
  assert.ok(g.callResponseCount >= 1);
  step(g, 0.025, { ...idle, call: true, callPulse: true });
  assert.equal(g.callSerial, 2);
  assert.ok(g.callResponseCount >= 1);
});

test('short taps survive frames; holding and clearing a control do not queue calls', () => {
  const g = crowded();
  const control = new OneShotControl();
  control.press();
  control.release();
  assert.equal(control.take(), true);
  step(g, 0.025, { ...idle, call: true });
  const first = g.callRipple;
  control.press();
  control.press();
  assert.equal(control.take(), true);
  assert.equal(control.take(), false);
  control.clear();
  assert.equal(control.take(), false);
  for (let i = 0; i < 430; i++) step(g, 0.025, idle);
  assert.equal(g.callRipple, first);
});

test('no nearby people confirms a call; restricted crossing cannot move a crowd', () => {
  const empty = createGame(0, 17);
  empty.phase = 'playing';
  empty.crowd = [];
  pressCall(empty);
  assert.equal(empty.callReadyAt, 0);
  assert.equal(empty.callResponseCount, 0);
  assert.equal(activeCallRipple(empty)?.mode, 'recognized');
  assert.equal(activeSpeech(empty), null);
  const road = crowded(1);
  road.player.y = road.traffic.bottom + 35;
  road.crowd.forEach((p) => p.y = road.player.y - 30);
  pressCall(road);
  assert.equal(road.callReadyAt, 0);
  assert.equal(road.callResponseCount, 0);
  assert.equal(road.crowd.some((p) => p.courtesy), false);
  assert.equal(activeCallRipple(road)?.mode, 'unavailable');
});

test('failed calls report crossing suppression and an empty ahead window', () => {
  const road = createRun(1, 17);
  road.player.y = road.crossings[0].bottom + 35;
  beginRun(road);
  updateRun(road, 0.025, { brake: true, call: true });
  assert.ok(road.events.some((event) =>
    event.kind === 'callEmpty' && event.reason === 'crossing'));

  const empty = createRun(0, 17);
  empty.crowd = [];
  beginRun(empty);
  updateRun(empty, 0.025, { brake: true, call: true });
  assert.ok(empty.events.some((event) =>
    event.kind === 'callEmpty' && event.reason === 'nobody'));
});

test('courtesy diagnostic distinguishes blocked people and leaves state unchanged', () => {
  const player = { x: 100, y: 600 };
  const person = { id: 1, x: 55, y: 550, r: 13, active: true, animal: false };
  const crowd = [person];
  const before = structuredClone(crowd);
  assert.equal(courtesyUnavailableReason(crowd, player), 'noRoom');
  assert.deepEqual(crowd, before);
  assert.equal(courtesyUnavailableReason(crowd, { x: 240, y: 600 }), 'nobody');
  assert.equal(courtesyUnavailableReason([{ ...person, x: 100 }], player), null);
});

test('pause, restart and canceled input leave no stale call', () => {
  const g = crowded();
  pressCall(g);
  g.phase = 'paused';
  cancelCallGesture(g);
  const frozen = activeCallRipple(g);
  step(g, CALL_RIPPLE_DURATION * 2, { ...idle, call: true });
  assert.deepEqual(activeCallRipple(g), frozen);
  g.phase = 'playing';
  step(g, 0.025, idle);
  assert.equal(createGame(0, 17).callHeld, false);
  assert.equal(createGame(1, 17).callReadyAt, 0);
  assert.equal(createGame(1, 17).callRipple, null);
});


test('call outline uses shared bounds, lingers, and respects reduced motion', () => {
  const ripple = { x: 240, y: 600, age: .3, responders: [] };
  const full = callAreaFrame(ripple);
  assert.deepEqual([full.left, full.right, full.near, full.far],
    [240 - CALL_AREA.halfWidth, 240 + CALL_AREA.halfWidth, 600 - CALL_AREA.near, 600 - CALL_AREA.far]);
  const custom = callAreaFrame(ripple, false, { halfWidth: 22, near: 5, far: 80 });
  assert.deepEqual([custom.left, custom.right, custom.near, custom.far], [218, 262, 595, 520]);
  assert.equal(callAreaFrame({ ...ripple, age: .6 }).far, full.far);
  assert.equal(callAreaFrame({ ...ripple, age: .6 }).alpha, 1);
  assert.equal(callAreaFrame({ ...ripple, age: 0 }, true).far, full.far);
});

test('call highlights only captured responders when the sweep reaches them', () => {
  const g = crowded();
  g.crowd.push({ ...g.crowd[0], id: 950, x: 85 });
  const positions = g.crowd.map(({ x, y }) => ({ x, y }));
  pressCall(g);
  const ripple = activeCallRipple(g);
  assert.deepEqual(ripple.responders, positions.slice(0, 2));
  assert.equal(callAreaFrame(ripple).responders.length, 0);
  assert.deepEqual(callAreaFrame({ ...ripple, age: .1 }).responders, positions.slice(0, 2));
  assert.deepEqual(callAreaFrame(ripple, true).responders, positions.slice(0, 2));
  assert.equal(callAreaFrame({ ...ripple, age: .6 }).responders.length, 0);
});

test('renderer strokes the static reduced-motion area and captured responder marks', () => {
  const g = crowded();
  pressCall(g);
  const strokes = [];
  let path = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient' || name === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (name === 'measureText') return () => ({ width: 20 });
      if (name === 'beginPath') return () => { path = []; };
      if (['moveTo', 'lineTo', 'ellipse', 'closePath'].includes(name))
        return (...args) => path.push([name, ...args]);
      if (name === 'stroke') return () => strokes.push({ color: target.strokeStyle, path: [...path] });
      return () => {};
    },
  });
  renderWorld(ctx, g, { width: 390, height: 700, reducedMotion: true });
  const highlights = strokes.filter((stroke) => stroke.color === '#fff3a6');
  assert.equal(highlights.length, 3);
  assert.deepEqual(highlights[0].path.map(([name]) => name),
    ['moveTo', 'lineTo', 'lineTo', 'lineTo', 'closePath']);
  assert.ok(highlights.slice(1).every(({ path }) => path[0][0] === 'ellipse'));
});
