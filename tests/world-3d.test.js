import test from "node:test";
import assert from "node:assert/strict";
import { createGame, seedForRun } from "../logic.js";
import { drawWorld3D } from "../world-3d.js";

test("all five 3D scenes render at phone and desktop sizes without changing game state", () => {
  const ctx = new Proxy({}, {
    get: (object, key) => key in object ? object[key] : () => {},
    set: (object, key, value) => ((object[key] = value), true),
  });
  const originalRandom = Math.random;
  try {
    Math.random = () => { throw Error("rendering must not consume game randomness"); };
    for (let stage = 0; stage < 5; stage++) {
      const game = createGame(stage, seedForRun(17, stage));
      const before = structuredClone(game);
      for (const [width, height, top, bottom] of [
        [320, 568, 110, 490],
        [390, 844, 120, 730],
        [1024, 768, 100, 670],
      ]) {
        const { projector, resultRegion } = drawWorld3D(ctx, game, {
          width, height, top, bottom,
        });
        for (const x of [0, 240, 480]) {
          const point = projector.point(x, game.player.y, 0);
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
        }
        assert.ok(resultRegion.width >= 0 && resultRegion.height >= 0);
        assert.ok(Object.values(resultRegion).every(Number.isFinite));
        assert.ok(resultRegion.x + resultRegion.width <= width);
        assert.ok(resultRegion.y + resultRegion.height <= height);
      }
      assert.deepEqual(game, before, `stage ${stage + 1} changed during rendering`);
    }
    const final = createGame(4, seedForRun(17, 4));
    final.player.y = 84;
    final.phase = "finished";
    const { resultRegion } = drawWorld3D(ctx, final, {
      width: 390, height: 844, top: 120, bottom: 730,
    });
    assert.ok(resultRegion.width > 180 && resultRegion.height > 150,
      "the final result card should include the stage, not a narrow strip");
  } finally {
    Math.random = originalRandom;
  }
});
