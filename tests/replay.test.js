import test from "node:test";
import assert from "node:assert/strict";
import { createGame, nextRunSeed, seedForRun, step } from "../logic.js";
test("new runs avoid repeating entropy and fixed seeds reproduce all five scenes", () => {
  assert.equal(nextRunSeed(0xffffffff, 0xffffffff), 0);
  assert.equal(nextRunSeed(17, 2026), 2026);
  for (let stage = 0; stage < 5; stage++) {
    const a = createGame(stage, seedForRun(17, stage)),
      b = createGame(stage, seedForRun(17, stage)),
      c = createGame(stage, seedForRun(2026, stage));
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.crowd, c.crowd);
    a.phase = b.phase = "playing";
    for (let n = 0; n < 200; n++) {
      step(a, 0.025, { left: true, right: true });
      step(b, 0.025, { left: true, right: true });
    }
    assert.deepEqual(a, b);
  }
});
test("bounded variation changes destinations, pace, dwell, entry timing and venue groups while keeping each scene flow", () => {
  const games = [17, 2026, 97, 4004].map((seed) =>
    Array.from({ length: 5 }, (_, stage) =>
      createGame(stage, seedForRun(seed, stage)),
    ),
  );
  for (let stage = 0; stage < 5; stage++) {
    assert.ok(
      new Set(
        games.map((g) =>
          JSON.stringify(
            g[stage].crowd.map((p) => [
              p.x,
              p.y,
              p.route,
              p.pace,
              p.wait,
              p.pauseDuration,
            ]),
          ),
        ),
      ).size > 1,
    );
    for (const run of games) {
      const g = run[stage];
      assert.equal(g.crowd.length, [6, 12, 20, 30, 40][stage]);
      if (stage === 1)
        assert.ok(g.crowd.filter((p) => p.flow !== "crossing").length >= 10);
      if (stage === 2)
        assert.ok(g.crowd.filter((p) => p.flow === "crossing").length >= 12);
      if (stage === 4)
        assert.ok(
          g.crowd.every(
            (p) => p.entry.y >= 620 && p.route.every((t) => t.y >= 33),
          ),
        );
    }
  }
  assert.ok(
    new Set(
      games.map((g) =>
        JSON.stringify(
          g[3].crowd
            .filter((p) => p.group?.startsWith("visitors"))
            .map((p) => p.id),
        ),
      ),
    ).size > 1,
  );
});
