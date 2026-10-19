import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../sound.js';
import { createWalkingPose, updateWalkingPose } from '../pose.js';
import { TwoButtons } from '../input.js';

function fixture() {
  const audio = new GameAudio();
  const tones = [];
  audio.context = { state: 'running' };
  audio.muted = false;
  audio.tone = (...args) => tones.push(args);
  let pose = createWalkingPose({ x: 240, y: 500 });
  function frame(dx, controls) {
    pose = updateWalkingPose(pose, { x: pose.x + dx, y: pose.y - (dx ? 1.5 : 0) },
      0.025, { canMove: true });
    const { left, right } = controls.read();
    audio.footsteps(pose, left !== right);
  }
  return { audio, tones, frame };
}

test('keyboard and touch steering produce quiet footfalls from measured walk distance, not repeated presses', () => {
  for (const id of ['key:ArrowLeft', 'pointer:17']) {
    const { audio, tones, frame } = fixture();
    const buttons = new TwoButtons();
    buttons.press(id, 'left');
    for (let i = 0; i < 40; i++) {
      buttons.press(id, 'left'); // keyboard repeat or continued pointer contact
      frame(2.5, buttons);
    }
    assert.ok(tones.length >= 6 && tones.length <= 10);
    assert.ok(tones.every((t) => t[2] < 0.002));
    assert.ok(tones.some((t) => t[0] === 102));
    assert.ok(tones.some((t) => t[0] === 117));
    const count = tones.length;
    buttons.release(id);
    for (let i = 0; i < 40; i++) frame(2.5, buttons);
    assert.equal(tones.length, count, 'automatic travel without steering stays quiet');
    audio.reset();
    assert.equal(audio.lastFootDistance, null);
  }
});

test('stationary, brake, pause, mute and restart do not leave pending footstep cues', () => {
  const { audio, tones, frame } = fixture();
  const buttons = new TwoButtons();
  buttons.press('left', 'left');
  for (let i = 0; i < 35; i++) frame(2.5, buttons);
  const movingCount = tones.length;
  assert.ok(movingCount > 0);
  for (let i = 0; i < 30; i++) frame(0, buttons);
  assert.equal(tones.length, movingCount);
  buttons.press('right', 'right');
  for (let i = 0; i < 30; i++) frame(0, buttons);
  assert.equal(tones.length, movingCount);
  buttons.release('right');
  audio.context.state = 'suspended';
  for (let i = 0; i < 20; i++) frame(2.5, buttons);
  assert.equal(tones.length, movingCount);
  audio.context.state = 'running';
  audio.muted = true;
  for (let i = 0; i < 20; i++) frame(2.5, buttons);
  assert.equal(tones.length, movingCount);
  audio.muted = false;
  audio.reset();
  frame(0, buttons);
  assert.equal(tones.length, movingCount);
});
