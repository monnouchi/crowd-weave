import test from "node:test";
import assert from "node:assert/strict";
import { createGame, nextRunSeed, seedForRun, step } from "../logic.js";
import {
  BEST_STORAGE_KEY, MAX_LOCAL_BESTS, readLocalBest, recordLocalBest,
  seedShareUrl,
} from "../src/replay.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("a faster replay for the same seed and stage becomes the local best", () => {
  const local = storage();
  assert.deepEqual(recordLocalBest(local,
    { seed: 17, stage: 1, elapsed: 20, hits: 1 }), {
    best: { seed: 17, stage: 1, elapsed: 20, hits: 1 },
    improved: true, stored: true,
  });
  assert.equal(recordLocalBest(local,
    { seed: 17, stage: 1, elapsed: 21, hits: 0 }).improved, false);
  assert.equal(recordLocalBest(local,
    { seed: 17, stage: 1, elapsed: 20, hits: 0 }).improved, true);
  assert.deepEqual(readLocalBest(local, 17, 1),
    { seed: 17, stage: 1, elapsed: 20, hits: 0 });
  assert.equal(readLocalBest(local, 18, 1), null);
  assert.equal(readLocalBest(local, 17, 2), null);
  assert.equal(recordLocalBest(local,
    { seed: 17, stage: 5, elapsed: 88, hits: 3 }).stored, true);
  assert.equal(readLocalBest(local, 17, 5)?.elapsed, 88);
});

test("storage errors and corrupt contents do not stop a result", () => {
  const blocked = {
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Storage blocked"); },
  };
  const result = { seed: 0, stage: 0, elapsed: 12.3456, hits: 0 };
  assert.deepEqual(recordLocalBest(blocked, result), {
    best: { ...result, elapsed: 12.346 }, improved: true, stored: false,
  });
  assert.equal(readLocalBest(blocked, 0, 0), null);
  const local = storage();
  local.setItem(BEST_STORAGE_KEY, "{broken");
  assert.equal(recordLocalBest(local, result).stored, true);
  assert.equal(readLocalBest(local, 0, 0)?.elapsed, 12.346);
});

test("local best history is versioned, bounded, and contains only game data", () => {
  const local = storage();
  for (let seed = 0; seed < MAX_LOCAL_BESTS + 5; seed++)
    recordLocalBest(local, { seed, stage: 0, elapsed: 10 + seed, hits: 0 });
  const saved = JSON.parse(local.getItem(BEST_STORAGE_KEY));
  assert.equal(saved.version, 1);
  assert.equal(saved.records.length, MAX_LOCAL_BESTS);
  assert.deepEqual(Object.keys(saved.records[0]).sort(),
    ["elapsed", "hits", "seed", "stage"]);
  assert.equal(readLocalBest(local, 0, 0), null);
  assert.equal(readLocalBest(local, MAX_LOCAL_BESTS + 4, 0)?.hits, 0);
});

test("share URL keeps the game path and only the deterministic seed", () => {
  assert.equal(seedShareUrl("https://example.test/crowd-weave/?v=old#scene", 17),
    "https://example.test/crowd-weave/?seed=17");
  assert.equal(seedShareUrl("http://127.0.0.1:4175/", 0xffffffff),
    "http://127.0.0.1:4175/?seed=4294967295");
  assert.throws(() => seedShareUrl("https://example.test/", -1), RangeError);
  assert.throws(() => seedShareUrl("file:///tmp/index.html", 1), TypeError);
});

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
      assert.equal(g.crowd.length, [14, 24, 49, 54, 58][stage]);
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
