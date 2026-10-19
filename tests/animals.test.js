import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { moveAnimals } from '../crowd.js';

const chord = { left: true, right: true, call: true };
const released = { left: false, right: false, call: true };

test('a dog patrols the neighborhood and rainy approach, a cat patrols near the cafe', () => {
  const kinds = ['dog', null, 'cat', 'dog', null];
  for (let stage = 0; stage < 5; stage++) {
    const g = createGame(stage, 17);
    assert.equal(g.animals[0]?.kind || null, kinds[stage]);
    if (!g.animals.length) continue;
    const p = g.animals[0];
    assert.ok(p.x >= p.minX && p.x <= p.maxX);
    assert.ok(p.maxX - p.minX < 85, 'short patrol leaves the middle open');
    assert.ok(p.maxX < 425 || p.minX > 55);
    assert.ok(g.crossings.every((t) => p.y < t.top - 45 || p.y > t.bottom + 45));
    for (let i = 0; i < 300; i++) {
      const old = p.x;
      moveAnimals(g.animals, 0.025);
      assert.ok(p.x >= p.minX - 0.01 && p.x <= p.maxX + 0.01);
      assert.ok(Math.abs(p.x - old) <= p.speed * 0.025 + 0.01);
    }
  }
});

test('animals are solid, score normal contact, and never yield to the courtesy call', () => {
  const g = createGame(0, 17);
  g.phase = 'playing';
  g.crowd = [];
  const dog = g.animals[0];
  g.player.x = dog.x;
  dog.speed = 0;
  dog.y = g.player.y - 23;
  step(g, 0.025, released);
  assert.equal(g.hits, 1);
  assert.equal(g.lastContactId, dog.id);
  const before = dog.x;
  step(g, 0.025, chord);
  step(g, 0.025, released);
  step(g, 0.025, chord);
  assert.equal(g.callReadyAt, 0);
  assert.equal(dog.x, before);
  assert.equal(dog.courtesy, undefined);
  assert.ok(g.player.y > dog.y, 'the dog remains a solid obstacle');
});
