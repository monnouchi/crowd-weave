import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { moveAnimals, previewTurn } from '../crowd.js';

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
    assert.equal(animal.acknowledge, undefined);
    assert.ok(g.player.y > animal.y, `${animal.kind} remains solid`);
  }
});

test('a dog braces before reversing while its patrol range and collider stay fixed', () => {
  const dog = createGame(0, 17).animals[0];
  const r = dog.r;
  let sawBraceBeforeTurn = false;
  let previousDirection = 1;
  for (let i = 0; i < 250; i++) {
    moveAnimals([dog], 0.025);
    const direction = Math.sign(dog.vx);
    if (dog.bracing && direction === previousDirection) sawBraceBeforeTurn = true;
    if (direction < 0) break;
    previousDirection = direction;
  }
  assert.ok(sawBraceBeforeTurn);
  assert.equal(dog.r, r);
  assert.ok(dog.x >= dog.minX && dog.x <= dog.maxX);
  const cat = createGame(2, 17).animals[0];
  for (let i = 0; i < 250; i++) {
    moveAnimals([cat], 0.025);
    assert.equal(cat.bracing, false);
  }
});

test('a pedestrian looks into the next leg before a real turn, without moving', () => {
  const p = { active: true, anchor: false, state: 'walking',
    x: 100, y: 130, leg: 0,
    route: [{ x: 100, y: 100 }, { x: 160, y: 100 }] };
  const before = structuredClone(p);
  assert.deepEqual(previewTurn(p), { x: 1, y: 0 });
  assert.deepEqual(p, before);
  assert.equal(previewTurn({ ...p, y: 165 }), null);
  assert.equal(previewTurn({ ...p, state: 'waiting' }), null);
  assert.equal(previewTurn({ ...p, anchor: true }), null);
  assert.equal(previewTurn({ ...p, route: [{ x: 100, y: 100 }] }), null);
});
