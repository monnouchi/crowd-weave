import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { createParty } from '../party.js';

function approachPair(stage, seed = 17) {
  const g = createGame(stage, seed);
  g.phase = 'playing';
  g.crowd = g.crowd.filter((person) => person.anchor);
  g.animals = [];
  g.player.y = g.cleanPass.y + 155;
  g.party = createParty(stage, g.player);
  return g;
}

test('a contact-free crossing cheers only after every friend clears the crowd', () => {
  for (const [stage, side, steerFrames] of [[0, 'left', 52], [2, 'left', 52], [4, 'right', 32]]) {
    const g = approachPair(stage);
    for (let i = 0; i < 500 && !g.cleanPass.finished; i++)
      step(g, 0.025, i < steerFrames ? { [side]: true } : {});
    assert.equal(g.cleanPass.finished, true, `stage ${stage}`);
    assert.equal(g.hits, 0, `stage ${stage}`);
    assert.equal(g.cleanPassSerial, 1, `stage ${stage}`);
    assert.ok(g.cleanPassUntil > g.worldTime);
    for (let i = 0; i < 20; i++) step(g, 0.025, {});
    assert.equal(g.cleanPassSerial, 1, `stage ${stage} awards once`);
  }
});

test('contact inside the crowded section prevents its clean-pass cheer', () => {
  const g = approachPair(0);
  for (let i = 0; i < 180 && !g.hits; i++) step(g, 0.025, {});
  assert.equal(g.hits, 1);
  for (let i = 0; i < 500 && !g.cleanPass.finished; i++)
    step(g, 0.025, i < 70 ? { left: true } : {});
  assert.equal(g.cleanPass.finished, true);
  assert.equal(g.cleanPass.spoiled, true);
  assert.equal(g.cleanPassSerial, 0);
});

test('traffic stages cannot award a cheer for approaching a vehicle', () => {
  for (const stage of [1, 3]) {
    const g = createGame(stage, 17);
    assert.ok(g.crossings.length > 0);
    assert.equal(g.cleanPass, null);
    assert.equal(g.cleanPassSerial, 0);
  }
});

test('pause freezes the short celebration and a new run clears it', () => {
  const g = approachPair(0);
  for (let i = 0; i < 500 && !g.cleanPass.finished; i++)
    step(g, 0.025, i < 52 ? { left: true } : {});
  assert.equal(g.cleanPassSerial, 1);
  const time = g.worldTime;
  g.phase = 'paused';
  step(g, 0.05, {});
  assert.equal(g.worldTime, time);
  assert.equal(g.cleanPassUntil, time + 0.85);
  assert.equal(createGame(0, 17).cleanPassSerial, 0);
});
