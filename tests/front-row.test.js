import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  step,
  goalFor,
  FRONT_BARRIER_Y,
  advanceAudienceAmbience,
} from "../logic.js";
import { moveCrowd, visiblePerson } from "../crowd.js";
import { planRoute, routeInput } from "../validation/plan-route.js";

test("front row spans the hall, with all arrival positions on the audience side of the barrier", () => {
  for (const x of [95, 210, 240, 270, 280, 385]) {
    const g = createGame(4);
    g.crowd = [];
    g.phase = "playing";
    g.player.x = x;
    g.player.y = 112;
    // Followers start behind the leader and really walk to their own positions.
    for (const m of g.party.members) {
      m.x = x;
    }
    g.party.trail = g.party.trail.map((p) => ({ ...p, x }));
    for (let n = 0; n < 400 && g.phase === "playing"; n++) step(g, 0.025, {});
    assert.equal(g.phase, "finished");
    assert.equal(g.player.x, x);
    for (const p of [g.player, ...g.party.members, g.meetingPartner]) {
      assert.ok(p.y - p.r >= FRONT_BARRIER_Y);
      assert.ok(p.x - p.r >= 36 && p.x + p.r <= 444);
    }
    assert.ok(g.party.members.every((m) => m.docked));
    for (const m of g.party.members)
      assert.ok(
        Math.hypot(m.x - g.meetingPartner.x, m.y - g.meetingPartner.y) >=
          m.r + g.meetingPartner.r,
      );
  }
  const g = createGame(4);
  g.phase = "playing";
  g.crowd = [];
  g.player.x = 50;
  g.player.y = 40;
  for (let n = 0; n < 10; n++) step(g, 0.05, {});
  assert.equal(g.player.y, FRONT_BARRIER_Y + g.player.r);
  assert.equal(g.arriving, false);
  assert.ok(goalFor(4).w > 200);
});

test("spectators occupy the front row, stay visible and never enter the stage over a long circulation", () => {
  const g = createGame(4);
  assert.ok(g.crowd.filter((p) => p.y < 85).length >= 4);
  assert.ok(g.crowd.filter((p) => p.y < 85).every(visiblePerson));
  for (let n = 0; n < 3520; n++) {
    moveCrowd(g.crowd, 0.025);
    for (const p of g.crowd)
      if (p.active) assert.ok(p.y - p.r >= FRONT_BARRIER_Y);
  }
  assert.ok(g.crowd.some((p) => p.cycle > 0));
  assert.ok(g.crowd.every((p) => p.entry.y >= 620));
});

test("arrival spectators continue moving without changing the result, and background/reduced motion freezes ambience", () => {
  const g = createGame(4),
    route = planRoute(4, g.seed, 35);
  assert.ok(route);
  g.phase = "playing";
  for (const action of route.path)
    for (let n = 0; n < 4; n++) step(g, 0.025, routeInput(action));
  assert.equal(g.phase, "finished");
  const result = {
    elapsed: g.elapsed,
    hits: g.hits,
    worldTime: g.worldTime,
    party: structuredClone(g.party),
    player: { ...g.player },
  };
  const before = JSON.stringify(g.crowd);
  for (let n = 0; n < 400; n++) advanceAudienceAmbience(g, 0.025);
  assert.notEqual(JSON.stringify(g.crowd), before);
  assert.ok(Math.abs(g.ambientTime - 10) < 1e-8);
  assert.deepEqual(
    {
      elapsed: g.elapsed,
      hits: g.hits,
      worldTime: g.worldTime,
      party: g.party,
      player: g.player,
    },
    result,
  );
  const frozen = structuredClone(g);
  advanceAudienceAmbience(g, 1, { active: false });
  advanceAudienceAmbience(g, 1, { reducedMotion: true });
  assert.deepEqual(g, frozen);
  for (const p of g.crowd)
    if (p.active) assert.ok(p.y - p.r >= FRONT_BARRIER_Y);
});
