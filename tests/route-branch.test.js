import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step } from '../logic.js';
import { createParty } from '../party.js';

function length(points) {
  return points.slice(1).reduce((total, point, i) =>
    total + Math.hypot(point.x - points[i].x, point.y - points[i].y), 0);
}

test('the station has a visibly longer, wider way around its crowded shortcut', () => {
  for (const seed of [0, 17, 33, 2026]) {
    const g = createGame(1, seed);
    const branch = g.routeBranch;
    const pair = g.crowd.filter((p) => p.anchor);
    assert.ok(branch);
    assert.equal(pair.length, 2);
    assert.ok(length(branch.wide) > length(branch.short) + 100);
    assert.ok(branch.wide.slice(1, -1).every((point) =>
      pair.every((person) => Math.abs(person.x - point.x) > 80)));
    assert.ok(g.crossings.every((road) => branch.merge.y >= road.bottom + 20));
  }
  for (const stage of [0, 2, 3, 4])
    assert.equal(createGame(stage, 17).routeBranch, null);
});

test('existing left steering lets the friend follow the detour without contact', () => {
  const g = createGame(1, 17);
  g.phase = 'playing';
  g.crowd = g.crowd.filter((p) => p.anchor);
  g.player.y = g.routeBranch.fork.y + 10;
  g.party = createParty(1, g.player);
  for (let i = 0; i < 300 && g.player.y > g.routeBranch.merge.y; i++)
    step(g, 0.025, i < 52 ? { left: true } : {});
  assert.equal(g.hits, 0);
  assert.equal(g.player.x, 110);
  assert.equal(g.party.members[0].x, 110);
  assert.ok(g.party.members[0].y < g.crowd[0].y);
  assert.equal(g.phase, 'playing');
});

test('the central shortcut remains passable with the existing one-tap call', () => {
  const g = createGame(1, 17);
  g.phase = 'playing';
  g.crowd = g.crowd.filter((p) => p.anchor);
  g.player.y = g.routeBranch.fork.y + 10;
  g.party = createParty(1, g.player);
  let called = false;
  for (let i = 0; i < 300 && g.player.y > g.routeBranch.merge.y; i++) {
    const input = {};
    if (!called && g.player.y <= g.crowd[0].y + 100) {
      input.call = true;
      called = true;
    }
    step(g, 0.025, input);
  }
  assert.ok(called);
  assert.ok(g.callReadyAt > 0);
  assert.equal(g.hits, 0);
  assert.equal(g.player.x, 240);
  assert.equal(g.phase, 'playing');
});
