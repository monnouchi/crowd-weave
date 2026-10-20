import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { moveAnimals } from '../crowd.js';

const released = { left: false, right: false };

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

test('dogs and cats are solid and never yield to the courtesy call', () => {
  for (const stage of [0, 2]) {
    const g = createGame(stage, 17);
    g.phase = 'playing';
    g.crowd = [];
    const animal = g.animals[0];
    g.player.x = animal.x;
    animal.speed = 0;
    animal.y = g.player.y - 23;
    step(g, 0.025, released);
    assert.equal(g.hits, 1, animal.kind);
    assert.equal(g.lastContactId, animal.id);
    const before = animal.x;
    step(g, 0.025, { ...released, call: true });
    assert.equal(g.callReadyAt, 0);
    assert.equal(animal.x, before);
    assert.equal(animal.courtesy, undefined);
    assert.ok(g.player.y > animal.y, `${animal.kind} remains solid`);
  }
});
