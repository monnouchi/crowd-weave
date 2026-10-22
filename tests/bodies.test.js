import test from "node:test";
import assert from "node:assert/strict";
import { createGame, seedForRun, step } from "../logic.js";
import { BODY_GAP } from "../bodies.js";
import { createParty } from "../party.js";
import { planRoute, routeInput } from "../validation/plan-route.js";

test("a visible pair blocks idle progress without repeated time penalties", () => {
  const g = createGame(0, seedForRun(17, 0));
  g.crowd = g.crowd.filter((p) => p.anchor);
  g.phase = "playing";
  for (let frame = 0; frame < 2000; frame++) step(g, 0.05, {});
  const pair = g.crowd;
  assert.equal(g.phase, "playing");
  assert.equal(g.player.x, 240);
  assert.ok(g.player.y > pair[0].y);
  assert.equal(g.hits, 1, "standing against the same pair is one contact");
  assert.ok(
    pair.every(
      (p) =>
        Math.hypot(g.player.x - p.x, g.player.y - p.y) >=
        g.player.r + p.r + BODY_GAP - 0.01,
    ),
  );
});

test("either direction recovers from a bump and goes around the rendered bodies", () => {
  for (const direction of ["left", "right"]) {
    const g = createGame(0, seedForRun(17, 0));
    g.crowd = g.crowd.filter((p) => p.anchor);
    g.phase = "playing";
    for (let frame = 0; frame < 260; frame++) step(g, 0.05, {});
    const y = g.crowd[0].y;
    for (let frame = 0; frame < 36; frame++) {
      step(g, 0.05, { [direction]: true });
      assert.ok(
        g.crowd.every(
          (p) =>
            Math.hypot(g.player.x - p.x, g.player.y - p.y) >=
            g.player.r + p.r - 0.01,
        ),
      );
    }
    for (let frame = 0; frame < 30; frame++) step(g, 0.05, {});
    assert.ok(g.player.y < y - 30, direction);
    assert.equal(g.hits, 1, direction);
  }
});

test("a follower stalled by a bystander regroups without piling up forever", () => {
  const g = createGame(2);
  g.crowd = [];
  g.phase = "playing";
  g.player.y = 625;
  g.party = createParty(2, g.player);
  for (let frame = 0; frame < 48; frame++) step(g, 0.05, {});
  const y = g.party.members[0].y + 10;
  const bystander = {
    ...createGame(2).crowd[0],
    id: 99,
    x: 240,
    y,
    state: "meeting",
    habit: "meeting",
    wait: 100,
    route: [{ x: 240, y }, { x: 410, y }],
    leg: 0,
    vx: 0,
    vy: 0,
    reaction: null,
    active: true,
  };
  g.crowd = [bystander];
  let maxTrail = 0;
  for (let frame = 0; frame < 700 && g.phase === "playing"; frame++) {
    step(g, 0.05, {});
    maxTrail = Math.max(maxTrail, g.party.trail.length);
  }
  assert.equal(g.phase, "finished");
  assert.equal(g.hits, 1);
  assert.equal(g.lastContactMember, 1);
  assert.ok(bystander.x > 300, "the bystander gives the delayed friend room");
  const finalFollowers = g.party.members.map((member) => [member.x, member.y]);
  step(g, 0.05, {});
  assert.deepEqual(g.party.members.map((member) => [member.x, member.y]), finalFollowers,
    "the result preserves companions' real positions");
  assert.ok(maxTrail < 128);
});

test("many seeds keep both side routes open and idle runs short of the goal", () => {
  for (let runSeed = 0; runSeed < 32; runSeed++)
    for (let stage = 0; stage < 5; stage++) {
      const g = createGame(stage, seedForRun(runSeed, stage));
      const pair = g.crowd.filter((p) => p.anchor);
      assert.equal(pair.length, 2);
      assert.deepEqual(
        pair.map((p) => p.x),
        [220, 260],
      );
      assert.equal(pair[0].y, pair[1].y);
      for (const x of [155, 325])
        assert.ok(
          pair.every(
            (p) => Math.hypot(x - p.x, p.y - pair[0].y) > 35,
          ),
        );
      g.phase = "playing";
      for (let frame = 0; frame < 900 && g.phase === "playing"; frame++)
        step(g, 0.05, {});
      assert.notEqual(g.phase, "finished", `${runSeed}/${stage}`);
    }
});

test("dense audience still clears after contact and every friend can finish", () => {
  const route = planRoute(4, seedForRun(0, 4), 45, 1);
  assert.ok(route);
  const g = createGame(4, seedForRun(2, 4));
  g.phase = "playing";
  let maxTrail = 0;
  for (const action of route.path)
    for (let frame = 0; frame < 4; frame++) {
      step(g, 0.025, routeInput(action));
      maxTrail = Math.max(maxTrail, g.party.trail.length);
    }
  for (let frame = 0; frame < 1200 && g.phase === "playing"; frame++) {
    step(g, 0.025, {});
    maxTrail = Math.max(maxTrail, g.party.trail.length);
  }
  assert.equal(g.phase, "finished");
  assert.ok(g.hits > 0, "a crowded route retains the contact penalty");
  assert.ok(g.party.members.every((member) => Number.isFinite(member.x) && Number.isFinite(member.y)));
  assert.ok(maxTrail < 128, "friends regroup instead of accumulating a stuck trail");
});

test("all stages still have a contact-free route at the capped low frame rate", () => {
  for (let stage = 0; stage < 5; stage++) {
    const route = planRoute(stage, undefined, 50, stage === 4 ? 1 : 0, 0.05);
    assert.ok(route, `stage ${stage + 1}`);
    const g = createGame(stage);
    g.phase = "playing";
    for (const action of route.path)
      for (let frame = 0; frame < 2; frame++)
        step(g, 0.05, routeInput(action));
    for (let frame = 0; frame < 40 && g.phase === "playing"; frame++)
      step(g, 0.05, { left: true, right: true });
    assert.equal(g.phase, "finished", `stage ${stage + 1}`);
    assert.equal(g.hits, 0);
    assert.ok(g.party.members.every((member) => Number.isFinite(member.x) && Number.isFinite(member.y)));
  }
});
