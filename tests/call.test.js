import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCallRipple, activeSpeech, CALL_COOLDOWN, CALL_RIPPLE_DURATION,
  CALL_TAP_WINDOW,
  cancelCallGesture, createGame, step,
} from '../logic.js';
import { TwoButtons } from '../input.js';

const chord = { left: true, right: true, call: true };
const released = { left: false, right: false, call: true };
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
function doubleTap(g) {
  step(g, 0.025, chord);
  step(g, 0.025, released);
  step(g, 0.025, chord);
}

test('double chord yields a narrow person-only gap while both held still brakes', () => {
  const g = crowded();
  const start = { ...g.player };
  step(g, 0.025, chord);
  assert.deepEqual(g.player, start);
  assert.equal(activeSpeech(g), null);
  step(g, 0.025, released);
  const callFrom = { ...g.player };
  step(g, 0.025, chord);
  assert.equal(activeSpeech(g)?.text, 'すみませーん！');
  assert.equal(activeSpeech(g)?.speakerId, 0);
  assert.equal(g.callReadyAt, g.worldTime + CALL_COOLDOWN);
  assert.deepEqual(activeCallRipple(g), {
    x: callFrom.x, y: callFrom.y, progress: 0,
  });
  assert.ok(g.crowd[0].courtesy && g.crowd[1].courtesy);
  const before = g.crowd.map((p) => p.x);
  for (let i = 0; i < 24; i++) step(g, 0.025, released);
  assert.ok(activeCallRipple(g)?.progress > 0.8);
  assert.ok(g.crowd[0].x < before[0] - 20);
  assert.ok(g.crowd[1].x > before[1] + 20);
  const y = g.player.y;
  for (let i = 0; i < 35; i++) step(g, 0.025, released);
  assert.equal(activeCallRipple(g), null, 'the ripple ends promptly');
  assert.ok(g.player.y < y - 25, 'player still steers through the opened path');
});

test('one stop, held chord, half-release and slow double taps do not call', () => {
  const g = crowded();
  step(g, 0.025, chord);
  for (let i = 0; i < 30; i++) step(g, 0.025, chord);
  assert.equal(g.callReadyAt, 0);
  assert.equal(activeCallRipple(g), null);
  step(g, 0.025, { left: true, right: false, call: true });
  step(g, 0.025, chord);
  assert.equal(g.callReadyAt, 0);
  step(g, 0.025, released);
  for (let i = 0; i < Math.ceil(CALL_TAP_WINDOW / 0.025) + 2; i++)
    step(g, 0.025, released);
  step(g, 0.025, chord);
  assert.equal(g.callReadyAt, 0);
  assert.notEqual(activeSpeech(g)?.kind, 'call');
  assert.equal(activeCallRipple(g), null);
});

test('keyboard chord must fully release; cooldown cannot retrigger while held', () => {
  const g = crowded();
  const buttons = new TwoButtons();
  buttons.press('key:ArrowLeft', 'left');
  buttons.press('key:ArrowRight', 'right');
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.release('key:ArrowLeft');
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.press('key:ArrowLeft', 'left');
  step(g, 0.025, { ...buttons.read(), call: true });
  assert.equal(g.callReadyAt, 0);
  buttons.clear();
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.press('key:ArrowLeft', 'left');
  buttons.press('key:ArrowRight', 'right');
  step(g, 0.025, { ...buttons.read(), call: true });
  assert.ok(g.callReadyAt > 0);
  const firstRipple = g.callRipple;
  buttons.clear();
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.press('key:ArrowLeft', 'left');
  buttons.press('key:ArrowRight', 'right');
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.clear();
  step(g, 0.025, { ...buttons.read(), call: true });
  buttons.press('key:ArrowLeft', 'left');
  buttons.press('key:ArrowRight', 'right');
  step(g, 0.025, { ...buttons.read(), call: true });
  assert.equal(g.callRipple, firstRipple,
    'a fresh double chord during cooldown must not show a new ripple');
  const serial = g.speech.serial;
  for (let i = 0; i < 430; i++) step(g, 0.025, { ...buttons.read(), call: true });
  assert.equal(g.speechSequence, serial);
  assert.equal(g.callReadyAt, CALL_COOLDOWN + 0.125);
});

test('red approach, no people, pause, restart and stage transition cancel or suppress the gesture', () => {
  const empty = createGame(0, 17);
  empty.phase = 'playing';
  empty.crowd = [];
  doubleTap(empty);
  assert.equal(empty.callReadyAt, 0);
  assert.equal(activeCallRipple(empty), null, 'no target means no success cue');
  const road = crowded(1);
  road.player.y = road.traffic.bottom + 35;
  road.crowd.forEach((p) => p.y = road.player.y - 30);
  doubleTap(road);
  assert.equal(road.callReadyAt, 0);
  assert.equal(road.crowd.some((p) => p.courtesy), false);
  assert.equal(activeCallRipple(road), null);
  const g = crowded();
  step(g, 0.025, chord);
  g.phase = 'paused';
  cancelCallGesture(g);
  const frozen = JSON.stringify(g);
  step(g, 0.025, released);
  assert.equal(JSON.stringify(g), frozen);
  g.phase = 'playing';
  step(g, 0.025, chord);
  assert.equal(g.callReadyAt, 0);
  assert.equal(createGame(0, 17).callTapAt, null);
  assert.equal(createGame(1, 17).callReadyAt, 0);
  assert.equal(createGame(1, 17).callRipple, null);
});

test('a successful cue freezes on pause and disappears after the brief window', () => {
  const g = crowded();
  doubleTap(g);
  assert.ok(activeCallRipple(g));
  g.phase = 'paused';
  const frozen = activeCallRipple(g);
  step(g, CALL_RIPPLE_DURATION * 2, released);
  assert.deepEqual(activeCallRipple(g), frozen);
  g.phase = 'playing';
  for (let i = 0; i < 28; i++) step(g, 0.025, released);
  assert.equal(activeCallRipple(g), null);
});
