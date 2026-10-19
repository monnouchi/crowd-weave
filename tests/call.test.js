import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeCallRipple, activeSpeech, CALL_COOLDOWN, CALL_RIPPLE_DURATION,
  CALL_CHORD_WINDOW, CALL_TAP_WINDOW,
  cancelCallGesture, createGame, step,
} from '../logic.js';
import { TwoButtons } from '../input.js';
import { drawCallRipple } from '../character.js';

const chord = { left: true, right: true, call: true };
const released = { left: false, right: false, call: true };
const side = (name) => ({ left: name === 'left', right: name === 'right', call: true });
function hold(g, input, frames) {
  for (let i = 0; i < frames; i++) step(g, 0.025, input);
}
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
    x: callFrom.x, y: callFrom.y, progress: 0, mode: 'recognized',
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

test('staggered presses and releases in either order still complete a double chord', () => {
  for (const [first, releasedFirst, second] of [
    ['left', 'left', 'right'],
    ['right', 'right', 'left'],
    ['left', 'right', 'left'],
    ['right', 'left', 'right'],
  ]) {
    const g = crowded();
    hold(g, side(first), 8);
    step(g, 0.025, chord);
    hold(g, side(releasedFirst === 'left' ? 'right' : 'left'), 4);
    assert.notEqual(g.callTapAt, null, 'partial release keeps the first tap');
    step(g, 0.025, chord);
    assert.equal(activeCallRipple(g), null, 're-press before full release is the same tap');
    step(g, 0.025, released);
    hold(g, released, 18);
    hold(g, side(second), 10);
    assert.equal(activeCallRipple(g), null, 'one side alone cannot call');
    step(g, 0.025, chord);
    assert.equal(activeCallRipple(g)?.mode, 'recognized');
    assert.ok(g.callReadyAt > 0);
    assert.equal(g.hopReadyAt, 0, 'a chord tail cannot become a side hop');
  }
});

test('a slow second finger brakes; a late second chord starts a new sequence', () => {
  const g = crowded();
  hold(g, side('left'), Math.ceil(CALL_CHORD_WINDOW / 0.025) + 2);
  step(g, 0.025, chord);
  step(g, 0.025, released);
  step(g, 0.025, chord);
  assert.equal(activeCallRipple(g), null, 'slow steering plus brake was not tap one');
  step(g, 0.025, released);
  hold(g, released, Math.ceil(CALL_TAP_WINDOW / 0.025) + 2);
  step(g, 0.025, chord);
  assert.equal(activeCallRipple(g), null, 'the previous tap expired');
  assert.notEqual(g.callTapAt, null);
});

test('ordinary steering and same-side double-tap hop survive call detection', () => {
  const g = createGame(0, 17);
  g.phase = 'playing';
  g.crowd = [];
  g.animals = [];
  const startX = g.player.x;
  hold(g, side('left'), 15);
  assert.ok(g.player.x < startX - 10);
  step(g, 0.025, chord);
  assert.equal(g.callTapAt, null, 'late overlap is an ordinary brake');
  step(g, 0.025, released);
  step(g, 0.025, side('right'));
  step(g, 0.025, released);
  step(g, 0.025, side('right'));
  assert.ok(g.hopReadyAt > 0);
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
  const firstSerial = g.speech.serial;
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
  assert.notEqual(g.callRipple, firstRipple,
    'a fresh double chord still confirms that the input was recognized');
  assert.ok(g.callRipple.started > firstRipple.started);
  assert.equal(g.callRipple.mode, 'unavailable');
  assert.equal(g.speech.serial, firstSerial,
    'cooldown does not trigger the crowd-moving effect again');
  const cooldownRipple = g.callRipple;
  const serial = g.speech.serial;
  for (let i = 0; i < 430; i++) step(g, 0.025, { ...buttons.read(), call: true });
  assert.equal(g.speechSequence, serial);
  assert.equal(g.callRipple, cooldownRipple,
    'holding the chord does not repeat the recognition cue');
  assert.equal(g.callReadyAt, CALL_COOLDOWN + 0.125);
});

test('no people still confirms input; restricted approach, pause and restart stay safe', () => {
  const empty = createGame(0, 17);
  empty.phase = 'playing';
  empty.crowd = [];
  doubleTap(empty);
  assert.equal(empty.callReadyAt, 0);
  assert.equal(activeCallRipple(empty)?.mode, 'recognized',
    'recognition is visible even when no one needs to move');
  assert.equal(activeSpeech(empty), null);
  const road = crowded(1);
  road.player.y = road.traffic.bottom + 35;
  road.crowd.forEach((p) => p.y = road.player.y - 30);
  doubleTap(road);
  assert.equal(road.callReadyAt, 0);
  assert.equal(road.crowd.some((p) => p.courtesy), false);
  assert.equal(activeCallRipple(road)?.mode, 'unavailable');
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

test('a recognized gesture freezes its ripple on pause and ends after the brief window', () => {
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

test('an unavailable call draws a smaller, cooler single ripple', () => {
  const strokes = [];
  const ctx = { save() {}, restore() {}, beginPath() {}, arc() {},
    stroke() { strokes.push(this.strokeStyle); } };
  drawCallRipple(ctx, 20, 20, 1, 0.2, false, false);
  const recognized = strokes.splice(0);
  drawCallRipple(ctx, 20, 20, 1, 0.2, false, true);
  assert.equal(recognized.length, 4, 'recognized input has two rings');
  assert.equal(strokes.length, 2, 'unavailable effect has one ring');
  assert.notEqual(strokes[1], recognized[1], 'cooldown color is distinct');
});
