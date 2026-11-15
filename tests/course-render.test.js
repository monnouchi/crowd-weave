import test from "node:test";
import assert from "node:assert/strict";
import { createCourseRun, createRun, STAGES } from "../src/run.js";
import { courseThemeBlend, lerpTheme, overheadRow, overheadProjection, renderWorld, THEMES } from "../src/render.js";

function drawingContext() {
  const fills = [];
  const stack = [];
  const gradient = () => ({ addColorStop() {} });
  const values = { globalAlpha: 1, canvas: { width: 1280, height: 844 }, fills };
  return new Proxy(values, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === "save") return () => stack.push(target.globalAlpha);
      if (name === "restore") return () => { target.globalAlpha = stack.pop(); };
      if (name === "createLinearGradient" || name === "createRadialGradient") return gradient;
      if (name === "measureText") return (text) => ({ width: String(text).length * 12 });
      if (name === "fill" || name === "fillRect") return () => fills.push({ style: target.fillStyle, alpha: target.globalAlpha });
      return () => {};
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

test("shopfronts crossfade from outdoor awnings to indoor concourse bays", () => {
  const run = createCourseRun(17);
  const fillsAt = (index, y) => {
    place(run, index, y);
    const ctx = drawingContext();
    renderWorld(ctx, run, { width: 1280, height: 844 });
    return ctx.fills;
  };
  const outdoor = fillsAt(1, run.course.offsets[1] + STAGES[1].startY / 2);
  assert.ok(outdoor.some(fill => fill.style === "#4a7b89" && fill.alpha === 1));
  assert.ok(!outdoor.some(fill => fill.style === "#477e7c"));
  const indoor = fillsAt(2, run.course.offsets[2] + STAGES[2].startY / 2);
  assert.ok(indoor.some(fill => fill.style === "#477e7c" && fill.alpha === 1));
  assert.ok(indoor.some(fill => fill.style === "#915f60" && fill.alpha === 1));
  assert.ok(!indoor.some(fill => ["#af5e5d", "#f2d2aa"].includes(fill.style)));
  for (const index of [1, 2]) {
    const midpoint = fillsAt(index, run.course.offsets[index] + 84);
    assert.ok(midpoint.some(fill => fill.style === "#477e7c" && fill.alpha === .5));
    const awning = index === 1 ? "#4a7b89" : "#af5e5d";
    assert.ok(midpoint.some(fill => fill.style === awning && fill.alpha === .5));
  }
});

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

test("sun visibility follows each theme and its course boundary blend", () => {
  assert.deepEqual(THEMES.map(theme => theme.sun), [1, 1, 0, 0, 0]);
  const run = createCourseRun(17);
  const sunAlpha = () => {
    const ctx = drawingContext();
    renderWorld(ctx, run, { width: 390, height: 844 });
    return ctx.fills.find(fill => fill.style === "#fff1d4b8")?.alpha ?? 0;
  };
  for (let index = 0; index < THEMES.length; index++) {
    place(run, index, run.course.offsets[index] + STAGES[index].startY / 2);
    assert.equal(sunAlpha(), THEMES[index].sun, `segment ${index}`);
  }
  place(run, 1, run.course.offsets[1] + 84);
  const blend = courseThemeBlend(run);
  const midpoint = lerpTheme(THEMES[blend.from], THEMES[blend.to], blend.t).sun;
  assert.ok(midpoint > THEMES[2].sun && midpoint < THEMES[1].sun);
  assert.equal(sunAlpha(), midpoint);
  place(run, 3, run.course.offsets[3] + STAGES[3].startY / 2);
  const ctx = drawingContext();
  renderWorld(ctx, run, { width: 390, height: 844 });
  assert.ok(!ctx.fills.some(fill => ["#fff1d4b8", "#dae5dd35"].includes(fill.style)));
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


test("overhead rows stay in segment coordinates and project as the player advances", () => {
  const run = createCourseRun(17);
  for (const stage of [2, 4]) {
    const origin = run.course.offsets[stage];
    const rows = Array.from({ length: 40 }, (_, row) => overheadRow(17, stage, row, origin));
    assert.ok(rows.some(row => row.kind < 0));
    assert.ok(new Set(rows.map(row => row.y % (stage === 4 ? 155 : 175))).size > 10);
    for (let i = 1; i < rows.length; i++)
      assert.ok(rows[i].kind < 0 || rows[i - 1].kind < 0 || rows[i].kind !== rows[i - 1].kind);
    const row = rows[0];
    assert.deepEqual(row, overheadRow(17, stage, 0, origin));
    assert.equal(overheadRow(17, stage, 0, origin + 500).y, row.y + 500);
    place(run, stage, row.y + 600);
    const first = overheadProjection(run, { width: 390, height: 844 }, 240, row.y, 228);
    run.player.y -= 100;
    const second = overheadProjection(run, { width: 390, height: 844 }, 240, row.y, 228);
    assert.ok(first && second);
    assert.ok(second.y < first.y);
    assert.ok(Math.abs((second.y - 844 * .43) / (first.y - 844 * .43) - first.depth / second.depth) < 1e-10);
    assert.deepEqual(row, overheadRow(17, stage, 0, origin));
  }
});

test("overhead drawing uses the projected world row and boundary alpha", () => {
  const run = createCourseRun(17);
  for (const stage of [2, 4]) {
    place(run, stage - 1, run.course.offsets[stage - 1] + 84);
    const ctx = drawingContext();
    const paths = [];
    let path = [];
    ctx.beginPath = () => { path = []; };
    ctx.moveTo = (x, y) => path.push({ x, y });
    ctx.lineTo = (x, y) => path.push({ x, y });
    ctx.fill = () => paths.push({ points: [...path], style: ctx.fillStyle, alpha: ctx.globalAlpha });
    ctx.stroke = () => paths.push({ points: [...path], style: ctx.strokeStyle, alpha: ctx.globalAlpha });
    renderWorld(ctx, run, { width: 390, height: 844 });
    const style = stage === 2 ? "#b99582" : "#8290a281";
    const calls = paths.filter(call => call.style === style);
    assert.ok(calls.length > 0);
    assert.ok(calls.every(call => call.alpha === .5));
    const origin = run.course.offsets[stage];
    const stride = stage === 2 ? 175 : 155;
    const matches = calls.some(call => Array.from({ length: 30 }, (_, i) => i - 10).some(row => {
      const item = overheadRow(run.seed, stage, row, origin);
      if (item.kind < 0) return false;
      const expected = overheadProjection(run, { width: 390, height: 844 }, 35,
        item.y - (stage === 2 ? 7 : 0), stage === 2 ? 235 : 228);
      return expected && call.points.some(point => Math.abs(point.x - expected.x) < 1e-8 && Math.abs(point.y - expected.y) < 1e-8);
    }));
    assert.ok(matches, `stage ${stage} drew a projected row`);
  }
});
