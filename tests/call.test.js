import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCallRipple, activeSpeech, CALL_RIPPLE_DURATION,
  cancelCallGesture, createGame, step,
} from '../logic.js';
import { OneShotControl } from '../input.js';

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

test('one call press opens a person-only gap and confirms with a ripple', () => {
  const g = crowded();
  const from = { ...g.player };
  pressCall(g);
  assert.equal(activeSpeech(g)?.text, 'すみませーん！');
  assert.equal(g.callReadyAt, 0);
  assert.equal(g.callSerial, 1);
  assert.equal(g.callResponseCount, 2);
  assert.deepEqual(activeCallRipple(g), {
    x: from.x, y: from.y, progress: 0, mode: 'recognized',
  });
  assert.ok(g.crowd.every((p) => p.courtesy));
  assert.ok(g.crowd.every((p) => p.acknowledge));
  const before = g.crowd.map((p) => p.x);
  for (let i = 0; i < 24; i++) step(g, 0.025, idle);
  assert.ok(activeCallRipple(g)?.progress > 0.8);
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
