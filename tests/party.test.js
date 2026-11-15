import test from "node:test";
import assert from "node:assert/strict";
import { createParty, moveParty, regroupReady, sampleTrail } from "../party.js";
import { createGame, step } from "../logic.js";
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
test("followers follow a lateral path without reversing trail progress", () => {
  const player = { x: 240, y: 0 },
    p = createParty(1, player);
  let last = p.members[0].s;
  for (let i = 0; i < 25; i++) {
    player.x += 4;
    moveParty(p, player, 0.05);
    const m = p.members[0];
    // A lateral trail lies at the player’s y; the safety margin keeps the
    // visible friend just behind it instead of exactly on that path.
    assert.ok(m.y >= player.y + 1);
    assert.ok(m.s >= last);
    last = m.s;
  }
  assert.ok(p.members[0].x > 240);
  assert.ok(Math.abs(p.members[0].y - 1) < 0.000001);
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
test("a blocked friend cannot trigger a reunion before physically catching up", () => {
  const player = { x: 240, y: 600 };
  const party = createParty(1, player);
  party.members[0].s -= 40;
  party.members[0].y += 40;
  for (let i = 0; i < 45; i++)
    moveParty(party, player, 0.025, {
      braking: true, resolveFollower: () => 0,
    });
  assert.equal(party.reunionArmed, true);
  assert.equal(regroupReady(party), false);
  assert.equal(party.members[0].y, 670);
  let previous = party.members[0].y;
  for (let i = 0; i < 30; i++) {
    moveParty(party, player, 0.025, { braking: true });
    assert.ok(previous - party.members[0].y <= 140 * 0.025 + 0.01);
    previous = party.members[0].y;
  }
  assert.equal(regroupReady(party), true);
});

test("the reunion wave occurs once on real catch-up and pauses with the game", () => {
  const g = createGame(1, 17);
  g.phase = "playing";
  g.crowd = [];
  g.animals = [];
  g.player.y = 600;
  g.party = createParty(1, g.player);
  g.party.members[0].s -= 40;
  g.party.members[0].y += 40;
  for (let i = 0; i < 50; i++) step(g, 0.025, { left: true, right: true });
  assert.equal(g.reunionSerial, 1);
  assert.ok(g.reunionUntil > g.worldTime - 1);
  assert.equal(g.hits, 0);
  for (let i = 0; i < 50; i++) step(g, 0.025, { left: true, right: true });
  assert.equal(g.reunionSerial, 1);
  g.phase = "paused";
  const frozen = g.worldTime;
  step(g, 1, {});
  assert.equal(g.worldTime, frozen);
  assert.equal(createGame(1, 17).reunionSerial, 0);
  const alreadyTogether = createGame(1, 17);
  alreadyTogether.phase = "playing";
  alreadyTogether.crowd = [];
  alreadyTogether.animals = [];
  for (let i = 0; i < 50; i++)
    step(alreadyTogether, 0.025, { left: true, right: true });
  assert.equal(alreadyTogether.reunionSerial, 0);
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
test("Item W: a follower passes through pedestrians without contact, reaction or lost progress", () => {
  const g = fixture(), m = g.party.members[1];
  m.s -= 40;
  m.y += 40;
  const p = {
    ...createGame().crowd[0], id: 77, x: m.x, y: m.y,
    state: "reading", wait: 100, vx: 0, vy: 0,
  };
  g.crowd = [p];
  g.animals = [];
  g.combo.flow = 20;
  const noCrowd = structuredClone(g);
  noCrowd.crowd = [];
  const noFollower = structuredClone(g);
  noFollower.party.members = [];
  const initialS = m.s;
  for (let i = 0; i < 10; i++) {
    step(g, 0.025, { left: true, right: true });
    step(noCrowd, 0.025, { left: true, right: true });
    step(noFollower, 0.025, { left: true, right: true });
    assert.deepEqual(g.party.members[1], noCrowd.party.members[1]);
    assert.deepEqual(g.crowd, noFollower.crowd);
    assert.deepEqual(g.combo, noFollower.combo);
    assert.equal(g.hits, 0);
    assert.ok(g.memberHits.every((hits) => hits === 0));
    assert.deepEqual(g.touchingIds, []);
  }
  assert.ok(m.s > initialS, "the overlapping friend continues along the trail");
  assert.equal(p.reaction, null);
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
test("arrival finishes immediately while companions remain on their actual trail", () => {
  const g = createGame(4);
  g.crowd = [];
  g.phase = "playing";
  for (let i = 0; i < 600 && !g.arriving; i++) step(g, 0.05, {});
  assert.equal(g.arriving, true);
  assert.equal(g.phase, "finished");
  assert.ok(g.party.members.some((m) => !m.docked));
  assert.ok(g.party.members.every((m) =>
    Number.isFinite(m.x) && Number.isFinite(m.y) && m.y > g.player.y));
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
  // Item W: friends pass through spectators while the trail sheds old turns.
  assert.ok(points < 256);
});
