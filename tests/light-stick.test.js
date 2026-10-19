import test from "node:test";
import assert from "node:assert/strict";
import { drawCharacter } from "../character.js";
import { createWalkingPose } from "../pose.js";
import { drawGlowStick } from "../world-3d.js";

function recorder() {
  const values = { globalAlpha: 1 }, stack = [], strokes = [], shapes = [];
  let path = [];
  const ctx = new Proxy(values, {
    get(object, key) {
      if (key in object) return object[key];
      if (key === "save") return () => stack.push({ ...object });
      if (key === "restore") return () => Object.assign(object, stack.pop());
      if (key === "beginPath") return () => { path = []; };
      if (key === "moveTo" || key === "lineTo")
        return (x, y) => path.push([x, y]);
      if (key === "roundRect") return (x, y, width, height) =>
        shapes.push({ color: object.fillStyle, x, y, width, height });
      if (key === "stroke") return () =>
        strokes.push({ color: object.strokeStyle, width: object.lineWidth,
          path: [...path] });
      return () => {};
    },
    set(object, key, value) { object[key] = value; return true; },
  });
  return { ctx, strokes, shapes };
}

test("stage five glow sticks have a hand-held grip and a visible luminous tube in both views", () => {
  const hand = [100, 100, 17],
    projector = { scale: 1, point: (x, y, z) => ({ x, y: y - z }) };
  for (let id = 0; id < 3; id++) {
    const { ctx, strokes } = recorder();
    drawGlowStick(ctx, projector, hand, id, 1);
    const grip = strokes.find((stroke) => stroke.color === "#394e54"),
      tube = strokes.find((stroke) => stroke.width === 5.5);
    assert.deepEqual(grip.path[0], [hand[0], hand[1] - hand[2]]);
    assert.ok(tube.path[0][1] - tube.path[1][1] > 20);
    assert.ok(["#80e9d4", "#f2a2d3", "#f2d789"].includes(tube.color));
  }
  for (const overhead of [false, true]) {
    const { ctx, shapes } = recorder();
    const actor = { id: 3, x: 100, y: 100, r: 13, color: 0,
      state: "watching", glowStick: true };
    drawCharacter(ctx, actor, {
      pose: createWalkingPose(actor), live: true, overhead,
    });
    assert.ok(shapes.some((shape) =>
      shape.color === "#83efd8" &&
      shape.width >= 5 && shape.height >= 15),
    "a broad luminous tube must be drawn, not only a thin stroke");
  }
});
