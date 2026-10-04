import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, STAGES } from "../logic.js";
import {
  moveCrowd,
  makeCrowd,
  visiblePerson,
  reactToContact,
} from "../crowd.js";
import { planRoute, routeInput } from "../validation/plan-route.js";
import { performance } from "node:perf_hooks";
import { TwoButtons } from "../input.js";
const playing = (stage = 0) => {
  const g = createGame(stage);
  g.phase = "playing";
  return g;
};
test("automatic forward, left/right, simultaneous brake, bounds", () => {
  const g = playing();
  g.crowd = [];
  step(g, 0.05, {});
  assert.equal(g.player.y, 621.25);
  step(g, 0.05, { left: true });
  assert.equal(g.player.x, 235);
  const before = { ...g.player };
  step(g, 0.05, { left: true, right: true });
  assert.deepEqual(g.player, before);
  step(g, 0.05, { right: true });
  assert.equal(g.player.x, 240);
  for (let i = 0; i < 1000; i++) step(g, 0.05, { right: true });
  assert.equal(g.player.x, 450);
  assert.equal(g.player.y, 107);
});
test("collision adds two seconds, stops movement briefly and has cooldown", () => {
  const g = playing();
  g.player.y = 400;
  g.crowd = [
    {
      ...makeCrowd(1, 30, 1)[0],
      x: g.player.x,
      y: g.player.y,
      state: "meeting",
      wait: 10,
    },
  ];
  step(g, 0.05, {});
  assert.equal(g.hits, 1);
  assert.equal(g.elapsed, 2.05);
  const y = g.player.y;
  step(g, 0.05, {});
  assert.equal(g.player.y, y);
  for (let i = 0; i < 15; i++) step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 1);
});
test("goal completes and timer freezes; paused and ready freeze", () => {
  const g = playing();
  g.player.y = 86;
  g.crowd = [];
  step(g, 0.05, {});
  assert.equal(g.phase, "finished");
  const before = JSON.stringify(g);
  step(g, 0.05, { left: true });
  assert.equal(JSON.stringify(g), before);
  for (const phase of ["ready", "paused"]) {
    const h = createGame();
    h.phase = phase;
    const old = JSON.stringify(h);
    step(h, 0.05, {});
    assert.equal(JSON.stringify(h), old);
  }
});
test("increasing density, purposeful and individual agents, safe initial spacing", () => {
  assert.deepEqual(
    STAGES.map((_, i) => createGame(i).crowd.length),
    [6, 12, 20, 30, 40],
  );
  for (let stage = 0; stage < 5; stage++)
    for (const seed of [1402485690 + stage * 97, 17, 2026]) {
      const g = createGame(stage, seed);
      assert.ok(
        g.crowd.every(
          (p) =>
            p.origin &&
            p.destination &&
            p.origin !== p.destination &&
            p.route.length &&
            p.pace > 0 &&
            p.personalSpace > 0 &&
            p.yielding > 0,
        ),
      );
      assert.ok(
        g.crowd.every(
          (p) => Math.hypot(p.x - g.player.x, p.y - g.player.y) > 60,
        ),
      );
      for (let i = 0; i < g.crowd.length; i++)
        for (let j = i + 1; j < g.crowd.length; j++)
          assert.ok(
            Math.hypot(
              g.crowd[i].x - g.crowd[j].x,
              g.crowd[i].y - g.crowd[j].y,
            ) > 37,
          );
      assert.ok(
        new Set(g.crowd.map((p) => p.flow)).size >=
          (stage === 4 ? 1 : stage === 0 || stage === 2 ? 2 : 3),
      );
      assert.ok(new Set(g.crowd.map((p) => p.pace)).size > 5);
    }
});
test("seeded simulation repeats exactly, with different spacing for different seeds", () => {
  const a = createGame(4, 31),
    b = createGame(4, 31),
    c = createGame(4, 32);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.crowd, c.crowd);
  for (let n = 0; n < 1000; n++) {
    moveCrowd(a.crowd, 0.025);
    moveCrowd(b.crowd, 0.025);
  }
  assert.deepEqual(a, b);
});
test("route followers cross, stop for reasons, yield smoothly and re-enter off road", () => {
  const g = createGame(2);
  let stopped = 0,
    reentered = 0,
    crossed = false;
  const initial = new Map(g.crowd.map((p) => [p.id, { x: p.x, y: p.y }]));
  for (let n = 0; n < 2400; n++) {
    const previous = g.crowd.map((p) => ({ x: p.x, y: p.y, active: p.active }));
    moveCrowd(g.crowd, 0.025);
    for (let i = 0; i < g.crowd.length; i++)
      for (let j = i + 1; j < g.crowd.length; j++)
        if (g.crowd[i].active && g.crowd[j].active)
          assert.ok(
            Math.hypot(
              g.crowd[i].x - g.crowd[j].x,
              g.crowd[i].y - g.crowd[j].y,
            ) > 27,
            "walking bodies remain separate",
          );
    g.crowd.forEach((p, i) => {
      if (p.flow === "crossing" && Math.abs(p.x - initial.get(p.id).x) > 100)
        crossed = true;
      if (p.state === "reading" || p.state === "meeting") {
        stopped++;
        assert.equal(p.vx, 0);
        assert.equal(p.vy, 0);
      }
      if (previous[i].active && p.active)
        assert.ok(Math.hypot(p.x - previous[i].x, p.y - previous[i].y) < 2.5);
      if (!previous[i].active && p.active) {
        reentered++;
        assert.ok(!visiblePerson(p));
      }
    });
  }
  for (let i = 0; i < g.crowd.length; i++)
    for (let j = i + 1; j < g.crowd.length; j++)
      if (g.crowd[i].active && g.crowd[j].active)
        assert.ok(
          Math.hypot(g.crowd[i].x - g.crowd[j].x, g.crowd[i].y - g.crowd[j].y) >
            26.9,
        );
  assert.ok(stopped > 0);
  assert.ok(reentered > 0);
  assert.ok(
    crossed,
    "a crossing pedestrian traverses the corridor during the simulation",
  );
  const same = makeCrowd(2, 40, 9);
  for (const p of same) {
    p.route = [{ x: 240, y: 0 }];
    p.x = 240;
    p.state = "walking";
    p.pace = 40;
    p.ux = 0;
    p.uy = -1;
    p.vx = 0;
    p.vy = -40;
  }
  same[0].y = 350;
  same[1].y = 320;
  moveCrowd(same, 0.05);
  assert.ok(Math.abs(same[0].vx) > 0);
  assert.ok(Math.abs(same[0].vy) < 40);
});
test("all stages have a verified clean route, including the full-party signal window", () => {
  for (let stage = 0; stage < 5; stage++) {
    const result = planRoute(stage);
    assert.ok(result, `stage ${stage + 1} route`);
    const g = playing(stage);
    for (const action of result.path)
      for (let k = 0; k < 4; k++) step(g, 0.025, routeInput(action));
    assert.equal(g.phase, "finished");
    assert.equal(g.hits, 0, `stage ${stage + 1} contact`);
    const careless = playing(stage);
    for (let n = 0; n < 4000 && careless.phase === "playing"; n++)
      step(careless, 0.025, {});
    assert.ok(
      g.traffic
        ? ["finished", "gameover"].includes(careless.phase)
        : careless.phase === "finished",
    );
    if (g.traffic) {
      assert.equal(g.traffic.violations, 0);
      assert.ok(g.elapsed < 30, "safe waiting has a bounded completion time");
    } else
      assert.ok(
        careless.hits
          ? g.elapsed < careless.elapsed
          : g.elapsed <= careless.elapsed + 0.001,
        `stage ${stage + 1} ${g.elapsed} vs ${careless.elapsed}`,
      );
  }
});
test("alternate-seed busy stations retain fair routes", () => {
  for (const seed of [17, 2026, 33]) {
    const result = planRoute(4, seed);
    assert.ok(result);
    const g = createGame(4, seed);
    g.phase = "playing";
    for (const action of result.path)
      for (let k = 0; k < 4; k++) step(g, 0.025, routeInput(action));
    assert.equal(g.phase, "finished");
    assert.equal(g.hits, 0);
  }
});
test("brake stops player but station traffic continues; paused model freezes", () => {
  const g = playing(4),
    before = { ...g.player },
    crowdBefore = JSON.stringify(g.crowd);
  step(g, 0.05, { left: true, right: true });
  assert.deepEqual(g.player, before);
  assert.notEqual(JSON.stringify(g.crowd), crowdBefore);
  g.phase = "paused";
  const paused = JSON.stringify(g);
  step(g, 0.05, {});
  assert.equal(JSON.stringify(g), paused);
});
test("40-agent simulation performance and finite state", () => {
  const g = createGame(4),
    begin = performance.now();
  for (let n = 0; n < 3600; n++) moveCrowd(g.crowd, 1 / 60);
  const elapsed = performance.now() - begin;
  assert.ok(
    elapsed < 3000,
    `60 seconds simulation took ${elapsed.toFixed(0)} ms`,
  );
  assert.ok(g.crowd.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  console.log(
    `40 pedestrians / 3600 updates: ${elapsed.toFixed(1)} ms on this Mac Node runtime (not hardware-port evidence)`,
  );
});
test("independent touch sources, both brake, release one, cancel clear", () => {
  const b = new TwoButtons();
  b.press(1, "left");
  b.press(2, "right");
  assert.deepEqual(b.read(), { left: true, right: true });
  b.release(1);
  assert.deepEqual(b.read(), { left: false, right: true });
  b.press(3, "right");
  b.release(2);
  assert.equal(b.read().right, true);
  b.clear();
  assert.deepEqual(b.read(), { left: false, right: false });
});
test("background delta remains capped", () => {
  const g = playing();
  step(g, 60, {});
  assert.equal(g.elapsed, 0.05);
});

test("meeting partner has a clear purpose, is not a crowd obstacle and cannot penalize arrival", () => {
  for (let stage = 0; stage < 5; stage++) {
    const g = playing(stage);
    assert.ok(g.scene.purpose && g.scene.bubble && g.scene.arrival);
    assert.equal(g.meetingPartner.state, "waiting");
    assert.ok(!g.crowd.includes(g.meetingPartner));
    g.crowd = [];
    g.player.x = g.meetingPartner.x;
    g.player.y = g.meetingPartner.y;
    step(g, 0.025, {});
    if (stage > 0)
      assert.equal(g.phase, "playing", "leader arrival alone does not finish");
    for (let n = 0; n < 600 && g.phase === "playing"; n++) step(g, 0.025, {});
    assert.equal(g.phase, "finished");
    assert.equal(g.hits, 0);
    assert.equal(g.meetingPartner.state, "met");
    assert.ok(g.elapsed >= 0.025);
  }
});

test("only the contacted pedestrian reacts, cooldown prevents repeated reactions, then route and individuality resume", () => {
  const g = playing();
  g.player.y = 400;
  g.crowd = makeCrowd(2, 40, 9);
  const [a, b] = g.crowd;
  a.x = 240;
  a.y = 397;
  b.x = 340;
  b.y = 400;
  const profile = {
    destination: a.destination,
    origin: a.origin,
    route: JSON.stringify(a.route),
    leg: a.leg,
    pace: a.pace,
    urgency: a.urgency,
    personalSpace: a.personalSpace,
    yielding: a.yielding,
    habit: a.habit,
  };
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.lastContactId, a.id);
  assert.ok(a.reaction);
  assert.equal(b.reaction, null);
  assert.equal(g.hits, 1);
  const x = a.x,
    y = a.y;
  for (let i = 0; i < 10; i++) step(g, 0.05, { left: true, right: true });
  assert.equal(a.x, x);
  assert.equal(a.y, y);
  assert.equal(g.hits, 1);
  assert.ok(a.reaction.remaining < 0.7);
  for (let i = 0; i < 5; i++) step(g, 0.05, { left: true, right: true });
  assert.equal(a.reaction, null);
  assert.equal(g.hits, 1);
  assert.ok(Math.hypot(a.vx, a.vy) > 0);
  assert.deepEqual(
    {
      destination: a.destination,
      origin: a.origin,
      route: JSON.stringify(a.route),
      leg: a.leg,
      pace: a.pace,
      urgency: a.urgency,
      personalSpace: a.personalSpace,
      yielding: a.yielding,
      habit: a.habit,
    },
    profile,
  );
});
test("brief anger preserves a reader's remaining pause and does not advance their route", () => {
  const p = makeCrowd(1, 40, 9)[0];
  p.state = "reading";
  p.wait = 2;
  p.vx = p.vy = 0;
  const leg = p.leg;
  reactToContact(p, { x: p.x + 5, y: p.y });
  for (let i = 0; i < 15; i++) moveCrowd([p], 0.05);
  assert.equal(p.reaction, null);
  assert.equal(p.state, "reading");
  assert.equal(p.leg, leg);
  assert.ok(p.wait > 1.8);
  moveCrowd([p], 0.05);
  assert.ok(p.wait < 2);
});

test("continuous contact is counted once and a separated new contact can react again", () => {
  const g = playing();
  g.player.y = 400;
  const p = makeCrowd(1, 40, 9)[0];
  p.x = 240;
  p.y = 400;
  p.state = "meeting";
  p.wait = 100;
  p.vx = p.vy = 0;
  g.crowd = [p];
  for (let i = 0; i < 80; i++) step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 1);
  assert.equal(p.reaction, null);
  g.player.x = 320;
  step(g, 0.05, { left: true, right: true });
  assert.equal(g.touchingIds.length, 0);
  g.player.x = 240;
  step(g, 0.05, { left: true, right: true });
  assert.equal(g.hits, 2);
  assert.ok(p.reaction);
});

test("longitudinal majority, visible reader dwell and ordered side queue", () => {
  const g = createGame(1);
  assert.ok(
    g.crowd.filter((p) => p.flow === "crossing").length >= 1 &&
      g.crowd.filter((p) => p.flow === "crossing").length <= 4,
  );
  assert.ok(g.crowd.filter((p) => p.flow !== "crossing").length >= 10);
  const reader = g.crowd.find((p) => p.id === 7);
  assert.equal(reader.state, "reading");
  assert.equal(reader.x, 65);
  assert.equal(reader.y, 175);
  const queue = g.crowd.filter((p) => p.habit === "queuing");
  assert.equal(queue.length, 3);
  assert.ok(queue.every((p) => p.state === "queuing" && p.x === 415));
  for (let n = 0; n < 80; n++) moveCrowd(g.crowd, 0.025);
  assert.equal(reader.state, "reading");
  assert.ok(queue.every((p) => p.state === "queuing"));
  for (let n = 0; n < 80; n++) moveCrowd(g.crowd, 0.025);
  assert.equal(queue[0].state, "walking");
  assert.equal(queue[1].leg, 0);
  assert.ok(new Set(g.crowd.map((p) => p.pace.toFixed(1))).size > 10);
});

test("five journey stages have distinct purpose, place and scenery", () => {
  const scenes = Array.from({ length: 5 }, (_, i) => createGame(i).scene);
  for (const key of [
    "purpose",
    "place",
    "landmark",
    "intro",
    "bubble",
    "arrival",
  ])
    assert.equal(new Set(scenes.map((s) => s[key])).size, 5, key);
  assert.deepEqual(
    scenes.map((s) => s.landmark),
    ["home", "station", "cafe", "venue", "party"],
  );
  assert.equal(scenes[0].backgroundCount, 2);
  assert.equal(scenes[4].backgroundCount, 8);
  assert.equal(
    createGame(0).crowd.filter((p) => p.habit === "queuing").length,
    0,
  );
});

test("location profiles change real speed, dwell and visitor groups", () => {
  const games = Array.from({ length: 5 }, (_, i) => createGame(i));
  assert.deepEqual(
    games.map((g) => g.crowd[0].environment),
    ["residential", "station", "cafe", "venue", "party"],
  );
  const avg = (g) => g.crowd.reduce((s, p) => s + p.pace, 0) / g.crowd.length;
  assert.ok(avg(games[1]) > avg(games[0]) * 1.3);
  assert.ok(avg(games[4]) < avg(games[3]));
  assert.equal(games[0].crowd[2].state, "meeting");
  assert.equal(games[0].crowd[2].x, 65);
  assert.equal(games[0].crowd[2].y, 520);
  assert.ok(games[2].crowd.filter((p) => p.habit === "meeting").length >= 3);
  for (const g of games.slice(3, 4)) {
    const groups = g.crowd.filter((p) => p.group?.startsWith("visitors"));
    assert.ok(groups.length >= 4);
    for (let i = 0; i < groups.length; i += 2) {
      const [a, b] = groups.slice(i, i + 2);
      assert.equal(a.destination, b.destination);
      assert.equal(a.pace, b.pace);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 90);
    }
  }
  assert.ok(games[4].crowd.every((p) => p.role === "ライブの観客"));
});
