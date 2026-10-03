import test from "node:test";
import assert from "node:assert/strict";
import { createParty, moveParty, sampleTrail } from "../party.js";
import { createGame, step, GOAL } from "../logic.js";
test("party grows one friend per completed scene with visible distinct numbers", () => {
  for (let i = 0; i < 5; i++) {
    const g = createGame(i);
    assert.equal(g.party.members.length, i);
    assert.deepEqual(
      g.party.members.map((m) => m.id),
      Array.from({ length: i }, (_, k) => k + 1),
    );
    assert.ok(g.party.members.every((m) => m.y - g.player.y <= 120));
  }
});
test("followers replay right-angle path without cutting corners or reversing progress", () => {
  const player = { x: 0, y: 0 },
    p = createParty(1, player);
  let last = p.members[0].s;
  for (let i = 0; i < 25; i++) {
    player.x += 4;
    moveParty(p, player, 0.05);
    const m = p.members[0];
    assert.ok(Math.abs(m.x) < 0.000001 || Math.abs(m.y) < 0.000001);
    assert.ok(m.s >= last);
    last = m.s;
  }
  assert.ok(p.members[0].x > 0);
  assert.ok(Math.abs(p.members[0].y) < 0.000001);
  assert.deepEqual(
    sampleTrail(
      [
        { x: 0, y: 0, s: 0 },
        { x: 0, y: 40, s: 40 },
        { x: 40, y: 40, s: 80 },
      ],
      50,
    ),
    { x: 10, y: 40 },
  );
});
test("brake regroups the party, stun freezes it, and release never walks backwards", () => {
  const player = { x: 240, y: 625 },
    p = createParty(4, player);
  for (let i = 0; i < 40; i++) moveParty(p, player, 0.025, { braking: true });
  assert.equal(p.regroup, 1);
  assert.ok(Math.abs(p.members[3].y - player.y - 96) < 0.01);
  const before = p.members.map((m) => ({ x: m.x, y: m.y, s: m.s }));
  moveParty(p, player, 0.05, { stunned: true });
  assert.deepEqual(
    p.members.map((m) => ({ x: m.x, y: m.y, s: m.s })),
    before,
  );
  for (let i = 0; i < 30; i++) {
    const last = p.members.map((m) => m.s);
    player.y -= 3.75;
    moveParty(p, player, 0.05);
    assert.ok(p.members.every((m, k) => m.s >= last[k]));
  }
});
function fixture() {
  const g = createGame(2);
  g.phase = "playing";
  g.player.x = 320;
  g.player.y = 340;
  g.party = createParty(2, g.player);
  g.crowd = [];
  return g;
}
test("a follower contact penalizes and identifies that member, not only the leader", () => {
  const g = fixture(),
    m = g.party.members[1];
  const p = {
    ...createGame().crowd[0],
    id: 77,
    x: m.x,
    y: m.y,
    state: "reading",
    wait: 100,
    vx: 0,
    vy: 0,
  };
  g.crowd = [p];
  step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 1);
  assert.equal(g.lastContactMember, 2);
  assert.equal(g.memberHits[2], 1);
  assert.ok(g.party.members[1].flash > 0);
  assert.ok(p.reaction);
  for (let i = 0; i < 60; i++) step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 1, "continuous contact is counted once");
});
test("one pedestrian overlapping two party members is one contact event", () => {
  const g = fixture();
  const p = {
    ...createGame().crowd[0],
    id: 78,
    x: 320,
    y: 355,
    state: "reading",
    wait: 100,
    vx: 0,
    vy: 0,
  };
  g.crowd = [p];
  step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 1);
  assert.equal(
    g.memberHits.reduce((a, b) => a + b, 0),
    1,
  );
  assert.deepEqual(g.touchingIds, [78]);
});
test("arrival waits for last friend and finishes with every member inside the goal", () => {
  const g = createGame(4);
  g.crowd = [];
  g.phase = "playing";
  for (let i = 0; i < 300 && !g.arriving; i++) step(g, 0.05, {});
  assert.equal(g.arriving, true);
  assert.equal(g.phase, "playing");
  assert.ok(g.party.members.some((m) => !m.docked));
  const leadTime = g.elapsed;
  for (let i = 0; i < 200 && g.phase === "playing"; i++) step(g, 0.025, {});
  assert.equal(g.phase, "finished");
  assert.ok(g.elapsed > leadTime);
  assert.ok(
    g.party.members.every(
      (m) =>
        m.docked &&
        m.x >= GOAL.x &&
        m.x <= GOAL.x + GOAL.w &&
        m.y >= GOAL.y &&
        m.y <= GOAL.y + GOAL.h,
    ),
  );
  assert.equal(g.hits, 0);
  const frozen = structuredClone(g);
  step(g, 0.05, {});
  assert.deepEqual(g, frozen);
});
test("straight trail compression is bounded during long play without dropping follower path", () => {
  const player = { x: 240, y: 625 },
    p = createParty(4, player);
  for (let i = 0; i < 6000; i++) {
    player.y -= 0.5;
    moveParty(p, player, 1 / 150);
  }
  assert.ok(p.trail.length <= 3);
  assert.ok(p.trail[0].s <= Math.min(...p.members.map((m) => m.s)));
});

test("full four-friend simulation has a bounded update budget and no unbounded trail", () => {
  const started = performance.now();
  let g = createGame(4);
  g.phase = "playing";
  let points = 0;
  for (let i = 0; i < 3600; i++) {
    step(g, 0.025, i % 100 < 50 ? { left: true } : { right: true });
    points = Math.max(points, g.party.trail.length);
    if (g.phase === "finished") {
      g = createGame(4);
      g.phase = "playing";
    }
  }
  const ms = performance.now() - started;
  console.log(
    `40 pedestrians + 4 followers / 3600 updates: ${ms.toFixed(1)} ms; max trail ${points} points on this Node runtime`,
  );
  assert.ok(ms < 5000);
  assert.ok(points < 128);
});
