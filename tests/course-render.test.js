import test from "node:test";
import assert from "node:assert/strict";
import { createCourseRun, createRun, STAGES } from "../src/run.js";
import { courseThemeBlend, lerpTheme, renderWorld, THEMES } from "../src/render.js";

function drawingContext() {
  const fills = [];
  const gradient = () => ({ addColorStop() {} });
  const values = { globalAlpha: 1, canvas: { width: 1280, height: 844 }, fills };
  return new Proxy(values, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === "createLinearGradient" || name === "createRadialGradient") return gradient;
      if (name === "measureText") return (text) => ({ width: String(text).length * 12 });
      if (name === "fill" || name === "fillRect") return () => fills.push({ style: target.fillStyle, alpha: target.globalAlpha });
      return () => {};
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

function place(run, index, y) {
  run.course.index = index;
  run.stage = index;
  run.segOriginY = run.course.offsets[index];
  run.player.y = y;
}

test("course theme blend follows the player through each boundary", () => {
  assert.equal(courseThemeBlend(createRun(0, 17)), null);
  const run = createCourseRun(17);
  run.course.index = 4;
  assert.equal(courseThemeBlend(run), null);
  run.course.index = 0;
  const boundary = run.course.offsets[0] + 84;
  const blends = [300, 100, 0, -100, -300].map((distance) => {
    run.player.y = boundary + distance;
    return courseThemeBlend(run);
  });
  assert.equal(blends[0].t, 0);
  assert.equal(blends.at(-1).t, 1);
  assert.ok(blends.every((blend) => blend.from === 0 && blend.to === 1));
  for (let i = 1; i < blends.length; i++) assert.ok(blends[i].t > blends[i - 1].t);
  run.course.index = 2;
  assert.deepEqual({ from: courseThemeBlend(run).from, to: courseThemeBlend(run).to }, { from: 2, to: 3 });
});

test("themes interpolate each color channel", () => {
  const [a, b] = THEMES;
  assert.deepEqual(lerpTheme(a, b, 0), a);
  assert.deepEqual(lerpTheme(a, b, 1), b);
  const midpoint = "#" + [1, 3, 5].map((i) =>
    Math.round((parseInt(a.haze.slice(i, i + 2), 16) + parseInt(b.haze.slice(i, i + 2), 16)) / 2)
      .toString(16).padStart(2, "0")).join("");
  assert.equal(lerpTheme(a, b, .5).haze, midpoint);
});

test("course renders at each segment and in boundary bands", () => {
  const run = createCourseRun(17);
  for (let index = 0; index < 5; index++) {
    place(run, index, run.course.offsets[index] + STAGES[index].startY / 2);
    assert.doesNotThrow(() => renderWorld(drawingContext(), run, { width: 390, height: 844 }));
  }
  for (const index of [1, 2]) {
    place(run, index, run.course.offsets[index] + 84);
    assert.doesNotThrow(() => renderWorld(drawingContext(), run, { width: 390, height: 844 }));
  }
});

test("course interior ceiling is drawn inside the cafe only", () => {
  const run = createCourseRun(17);
  const colors = (index) => {
    place(run, index, run.course.offsets[index] + STAGES[index].startY / 2);
    const ctx = drawingContext();
    renderWorld(ctx, run, { width: 390, height: 844 });
    return ctx.fills.map((fill) => fill.style);
  };
  assert.ok(colors(2).includes("#e8d6bb"));
  assert.ok(!colors(0).includes("#e8d6bb"));
});
