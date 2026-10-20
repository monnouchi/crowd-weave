import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { GameAudio } from '../sound.js';

function playing() {
  const g = createGame(0, 17);
  g.phase = 'playing';
  g.crowd = [];
  g.animals = [];
  return g;
}
const left = { left: true, right: false, hopEnabled: true };
const right = { left: false, right: true, hopEnabled: true };
const released = { left: false, right: false, hopEnabled: true };

test('field edge produces one event at onset, then rearms only after moving away', () => {
  const g = playing();
  g.player.x = 30;
  step(g, 0, left);
  assert.equal(g.edgeBumpSerial, 0);
  step(g, 0.025, { left: true, right: true, hopEnabled: true });
  assert.equal(g.edgeBumpSerial, 0, 'braking at the edge is not a new hit');
  g.player.x = 31;
  step(g, 0.025, left);
  assert.equal(g.player.x, 30);
  assert.equal(g.edgeBumpSerial, 1);
  assert.equal(g.edgeContactSide, -1);
  for (let i = 0; i < 50; i++) step(g, 0.025, left);
  assert.equal(g.edgeBumpSerial, 1, 'holding against the edge is silent');
  step(g, 0.025, released);
  step(g, 0.025, left);
  assert.equal(g.edgeBumpSerial, 1, 'releasing in place is not a fresh contact');
  step(g, 0.025, right);
  step(g, 0.025, right);
  assert.ok(g.player.x > 32);
  assert.equal(g.edgeContactSide, 0);
  step(g, 0.025, left);
  step(g, 0.025, left);
  assert.equal(g.edgeBumpSerial, 2);
  assert.equal(g.player.x, 30);
});

test('a lateral hop hitting the opposite field edge remains bounded and cues once', () => {
  const g = playing();
  g.player.x = 445;
  step(g, 0.025, right);
  step(g, 0.025, released);
  step(g, 0.025, right);
  assert.equal(g.player.x, 450);
  assert.equal(g.edgeBumpSerial, 1);
  assert.equal(g.edgeContactSide, 1);
  assert.equal(g.hop, null);
  for (let i = 0; i < 20; i++) step(g, 0.025, right);
  assert.equal(g.edgeBumpSerial, 1);
  g.phase = 'paused';
  const frozen = JSON.stringify(g);
  step(g, 0.025, right);
  assert.equal(JSON.stringify(g), frozen);
  assert.equal(createGame(0, 17).edgeBumpSerial, 0);
});

test('boundary cue has its own short timbre and respects mute and suspension', () => {
  const voices = [], peaks = [];
  const c = { state: 'running', currentTime: 0, destination: {},
    createOscillator() {
      const o = { frequency: { value: 0, setValueAtTime() {},
        exponentialRampToValueAtTime() {} },
        connect() {}, disconnect() {}, start() {}, stop() {} };
      voices.push(o);
      return o;
    },
    createGain() { return { gain: { setValueAtTime() {},
      linearRampToValueAtTime(v) { peaks.push(v); },
      exponentialRampToValueAtTime() {} },
      connect() {}, disconnect() {} }; },
  };
  const audio = new GameAudio();
  audio.context = c;
  audio.effect('boundary');
  assert.equal(voices.length, 0);
  audio.muted = false;
  audio.effect('boundary');
  assert.equal(voices.length, 1);
  assert.equal(voices[0].type, 'square');
  assert.equal(voices[0].frequency.value, 470);
  const boundaryPeak = peaks.at(-1);
  audio.effect('contact');
  assert.ok(peaks.slice(-2).every((peak) => boundaryPeak < peak));
  const count = voices.length;
  c.state = 'suspended';
  audio.effect('boundary');
  assert.equal(voices.length, count);
});
