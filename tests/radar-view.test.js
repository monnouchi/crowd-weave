import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import { drawRadar, radarLayout } from "../src/radar-view.js";

function drawingContext() {
  const calls = { text: [], circles: 0, vehicles: 0 };
  const ctx = new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === "fillText") return (value) => calls.text.push(value);
      if (name === "arc") return () => { calls.circles++; };
      if (name === "strokeRect") return () => { calls.vehicles++; };
      return () => {};
    },
    set(target, name, value) { target[name] = value; return true; },
  });
  return { ctx, calls };
}

test("radar stays in the upper right periphery at phone and desktop sizes", () => {
  for (const [width, height] of [[320, 568], [320, 844],
    [390, 844], [568, 320], [1280, 720]]) {
    const panel = radarLayout({ width, height });
    assert.ok(panel);
    assert.ok(panel.x > width / 2 + 34,
      `${width}px radar stays right of the forward signal`);
    assert.ok(panel.x + panel.width <= width - 8);
    assert.ok(panel.y >= (height < 440 ? 78 : height <= 620 ? 142 : 168));
    assert.ok(panel.y + panel.height < height - 60,
      `${width}x${height} radar stays clear of touch controls`);
    assert.ok(panel.map.width >= 86 && panel.map.height >= 82);
  }
  assert.equal(radarLayout({ width: 320, height: 300 }), null);
});

test("radar draws only during play and does not change the seeded run", () => {
  const run = createRun(1, 17);
  const view = { width: 320, height: 568 };
  const { ctx, calls } = drawingContext();
  const before = structuredClone({ player: run.player, crowd: run.crowd,
    animals: run.animals, crossings: run.crossings });
  drawRadar(ctx, run, view);
  assert.deepEqual(calls.text, []);
  run.phase = "playing";
  run.player.y = run.crossings[0].bottom + 75;
  run.crowd = [{ id: 900, active: true, x: run.player.x + 20,
    y: run.player.y - 55, r: 13, environment: "street",
    boundsH: run.worldHeight, vx: 0, vy: -20 }];
  Object.assign(run.crossings[0].vehicle, {
    x: run.player.x + 8, y: run.crossings[0].top + 20,
    active: true, width: 58, kind: "car",
  });
  const playing = structuredClone({ player: run.player, crowd: run.crowd,
    animals: run.animals, crossings: run.crossings });
  drawRadar(ctx, run, view);
  assert.ok(calls.text.includes("周囲"));
  assert.ok(calls.text.some((item) => item.includes("○ 人")));
  assert.ok(calls.circles > 0, "pedestrian clearance is drawn");
  assert.ok(calls.vehicles > 0, "nearby vehicle body is drawn");
  assert.deepEqual({ player: run.player, crowd: run.crowd,
    animals: run.animals, crossings: run.crossings }, playing);
  assert.notDeepEqual(playing, before, "test really moved the player near the road");
});
