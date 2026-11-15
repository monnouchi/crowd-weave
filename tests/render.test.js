import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import { appearanceFor } from "../src/appearance.js";
import {
  pedestrianFacing, pedestrianSignalProjections, renderWorld, reunionWave,
  worldLabelCenterX, sideScenery, finaleFraming, FINALE_CAMERA_ADVANCE, protagonistProjection,
} from "../src/render.js";

function drawingContext() {
  const gradient = () => ({ addColorStop() {} });
  const values = { globalAlpha: 1, canvas: { width: 1280, height: 844 } };
  return new Proxy(values, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === "createLinearGradient" || name === "createRadialGradient") return gradient;
      if (name === "measureText") return (text) => ({ width: String(text).length * 12 });
      return () => {};
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

test("each chapter renders at phone and desktop sizes without changing simulation", () => {
  for (let stage = 0; stage < 5; stage++) {
    const run = createRun(stage, 17);
    for (const phase of ["ready", "playing", "finished"]) {
      run.phase = phase;
      run.player.y = Math.round(run.startY * .55);
      const before = structuredClone({
        player: run.player, crowd: run.crowd, party: run.party,
        flow: run.flow, crossings: run.crossings, records: run.records,
      });
      for (const [width, height] of [[320, 568], [390, 844], [1280, 720]])
        assert.doesNotThrow(() => renderWorld(drawingContext(), run,
          { width, height, reducedMotion: false }));
      assert.deepEqual({
        player: run.player, crowd: run.crowd, party: run.party,
        flow: run.flow, crossings: run.crossings, records: run.records,
      }, before);
    }
  }
});

test("crossing paint precedes all shadows and depth-sorted actors", () => {
  const run = createRun(1, 17);
  const road = run.crossings[0];
  run.player.x = 240;
  run.player.y = (road.top + road.bottom) / 2;
  run.crowd = [{ id: 0, x: 240, y: run.player.y + 10, active: true, ux: 0, uy: 1 }];
  run.party.members = [];
  run.meetingPartner = null;
  run.animals = [];
  road.vehicle.active = false;
  const calls = [];
  const ctx = drawingContext();
  for (const name of ["fill", "translate"]) {
    ctx[name] = (...args) => calls.push({ name, args, fill: ctx.fillStyle });
  }
  renderWorld(ctx, run, { width: 1280, height: 844, reducedMotion: true });
  const stripes = calls.flatMap((call, i) =>
    call.name === "fill" && call.fill === (road.canEnter ? "#e5f5e8" : "#e2e5de") ? [i] : []);
  const shadows = calls.flatMap((call, i) =>
    call.name === "fill" && call.fill === "#24343c70" ? [i] : []);
  // The player sorts before the nearby pedestrian and starts with a translate.
  const firstActor = calls.findIndex((call) => call.name === "translate");
  assert.ok(stripes.length > 0, "visible crosswalk stripes were drawn");
  assert.ok(shadows.length >= 2, "player and pedestrian shadows were drawn");
  assert.ok(firstActor >= 0, "the player was drawn");
  assert.ok(Math.max(...stripes) < Math.min(...shadows), "all stripes precede shadows");
  assert.ok(Math.max(...shadows) < firstActor, "all shadows precede actors");
});

test("real pedestrian lamps stay in the forward view on both road approaches", () => {
  for (const stage of [1, 3]) {
    const run = createRun(stage, 17);
    for (const road of run.crossings) {
      run.player.y = road.bottom + 154;
      road.nominalGreen = false;
      for (const approach of [154, 72]) {
        run.player.y = road.bottom + approach;
        for (const [width, height] of [[320, 568], [390, 844]]) {
          for (const x of [road.left + 5, 240, road.right - 5]) {
            run.player.x = x;
            const heads = pedestrianSignalProjections(run, road, { width, height });
            assert.ok(heads.length >= 1,
              `stage ${stage}, ${width}px, x=${x}, approach=${approach}`);
            assert.ok(heads.some((head) =>
              head.x - head.width / 2 > 0 &&
              head.x + head.width / 2 < width &&
              head.y - head.height / 2 > (width === 320 ? 130 : 170) &&
              head.y + head.height / 2 < height - 90 &&
              head.redLit && !head.walkLit),
            `visible red signal stage ${stage}, ${width}px, x=${x}, approach=${approach}`);
          }
        }
      }
      road.nominalGreen = true;
      road.blinking = false;
      assert.ok(pedestrianSignalProjections(run, road,
        { width: 320, height: 568 }).some((head) => !head.redLit && head.walkLit));
      road.blinking = true;
      road.blinkOn = false;
      assert.ok(pedestrianSignalProjections(run, road,
        { width: 320, height: 568 }).some((head) => !head.redLit && !head.walkLit));
    }
  }
});

test("walking direction changes a pedestrian's visible body orientation", () => {
  const body = (actor) => {
    const { profile, front } = pedestrianFacing(actor);
    return { profile, front };
  };
  assert.deepEqual(body({ ux: 1, uy: 0 }), {
    profile: 1, front: false,
  });
  assert.deepEqual(body({ ux: -1, uy: -.15 }), {
    profile: -1, front: false,
  });
  assert.deepEqual(body({ ux: .2, uy: -1 }), {
    profile: 0, front: false,
  });
  assert.deepEqual(body({ ux: .2, uy: 1 }), {
    profile: 0, front: true,
  });
  assert.deepEqual(body({
    ux: 1, uy: 0, acknowledge: { remaining: .3 },
  }), { profile: 0, front: true });
});

test("a walker looks into the upcoming turn while the body keeps its walking heading", () => {
  const actor = { active: true, anchor: false, state: "walking",
    x: 100, y: 130, ux: 0, uy: -1, leg: 0,
    route: [{ x: 100, y: 100 }, { x: 160, y: 100 }] };
  const before = structuredClone(actor);
  const facing = pedestrianFacing(actor);
  assert.equal(facing.profile, 0);
  assert.equal(facing.front, false);
  assert.equal(facing.headProfile, 1);
  assert.ok(facing.headLean > 0 && facing.headLean < 1.5);
  assert.ok(facing.headGaze > 0);
  assert.deepEqual(actor, before);

  const far = pedestrianFacing({ ...actor, y: 160 });
  assert.equal(far.headProfile, far.profile);
  assert.equal(far.headLean, 0);
  const bow = pedestrianFacing({ ...actor, acknowledge: { remaining: .3 } });
  assert.equal(bow.profile, 0);
  assert.equal(bow.headProfile, 0);
  assert.equal(bow.headFront, true);
});

test("courtesy preparation looks back but yielding faces its real motion", () => {
  const acknowledgment = { remaining: .65, faceX: .1, faceY: .99 };
  const prepare = pedestrianFacing({ ux: 0, uy: -1, state: "walking",
    acknowledge: acknowledgment,
    courtesy: { phase: "prepare", prepareRemaining: .02 } });
  assert.equal(prepare.profile, 0);
  assert.equal(prepare.front, false);
  assert.equal(prepare.headFront, true);

  const yieldFace = pedestrianFacing({ ux: 1, uy: 0, state: "walking",
    acknowledge: { ...acknowledgment, remaining: .6 },
    courtesy: { phase: "yield", targetX: 300 } });
  assert.equal(yieldFace.profile, 1);
  assert.equal(yieldFace.front, false);
  assert.equal(yieldFace.headProfile, 1);
  assert.ok(yieldFace.headGaze < 1);
});

test("the player's reunion wave stays brief and at the edge of phone screens", () => {
  for (const [width, height] of [[320, 568], [390, 844]]) {
    const view = { width, height };
    const game = { phase: "playing", worldTime: 10, reunionUntil: 10.9 };
    assert.equal(reunionWave(game, view)?.lift ?? 0, 0);
    game.worldTime = 10.45;
    const hand = reunionWave(game, view);
    assert.ok(hand);
    assert.ok(hand.x + 11 < width * .2);
    assert.ok(hand.y - 13 > height * .6);
    assert.ok(reunionWave(game, { ...view, reducedMotion: true }).lift <= .7);
    game.worldTime = 10.91;
    assert.equal(reunionWave(game, view), null);
  }
});

test("world speech bubbles remain readable at the edge without losing their actor", () => {
  for (const width of [320, 390]) {
    const labelWidth = 82;
    for (const sourceX of [0, 20, width - 5, width + 10]) {
      const center = worldLabelCenterX(sourceX, labelWidth, width);
      assert.ok(center != null);
      assert.ok(center - labelWidth / 2 >= 8);
      assert.ok(center + labelWidth / 2 <= width - 8);
      assert.ok(Math.abs(center - sourceX) <= labelWidth / 2 + 24);
    }
    assert.equal(worldLabelCenterX(width + 30, labelWidth, width), null);
    const pinned = worldLabelCenterX(-198, 100, width, true);
    assert.equal(pinned, 58);
    assert.ok(pinned + 50 < width / 2);
  }
});

test("the fork has no route guides, while crosswalk stripes remain", () => {
  const run = createRun(1, 17);
  run.phase = "playing";
  run.player.x = 240;
  for (const position of [run.routeBranch.fork.y + 81,
    ...run.crossings.map((road) => (road.top + road.bottom) / 2)]) {
    run.player.y = position;
    const labels = [], strokes = [], fills = [];
    const ctx = drawingContext();
    ctx.fillText = (value) => labels.push(value);
    ctx.stroke = () => strokes.push(ctx.strokeStyle);
    ctx.fill = () => fills.push(ctx.fillStyle);
    renderWorld(ctx, run, { width: 320, height: 568 });
    // The player reads the route without teaching labels or colored guide ribbons.
    assert.ok(!labels.some((label) => /ひろい道|近道/.test(label)));
    assert.ok(!strokes.includes("#e5a95eaa"), "short branch guide is absent");
    assert.ok(!strokes.includes("#86d9d0cc"), "wide branch guide is absent");
    if (run.crossings.some((road) => position === (road.top + road.bottom) / 2))
      assert.ok(fills.some((fill) => fill === "#e5f5e8" || fill === "#e2e5de"),
        "crosswalk stripes remain visible");
  }
});

test("a crossing telegraph turns the head while the body keeps its heading", () => {
  for (const side of [-1, 1]) {
    const facing = pedestrianFacing({ ux: 0, uy: -1, state: "walking",
      crossingTelegraph: side });
    assert.equal(facing.profile, 0);
    assert.equal(facing.headProfile, side);
    assert.equal(Math.sign(facing.headLean), side);
  }
});

test("hair and outfit choices change the person drawing calls", () => {
  function callsFor(headMass, outfit) {
    const run = createRun(0, 17);
    run.player.y = 500;
    run.crowd = [{ id: 0, appearanceId: 0, x: run.player.x, y: 400,
      active: true, ux: 0, uy: 1 }];
    run.party.members = [];
    run.meetingPartner = null;
    run.animals = [];
    const calls = [];
    const ctx = drawingContext();
    for (const name of ["ellipse", "roundRect", "lineTo", "quadraticCurveTo"]) {
      ctx[name] = (...args) => calls.push([name, ...args]);
    }
    const look = appearanceFor({ id: 0 });
    const saved = { headMass: look.headMass, outfit: look.outfit };
    try {
      Object.assign(look, { headMass, outfit });
      renderWorld(ctx, run, { width: 390, height: 844, reducedMotion: true });
    } finally {
      Object.assign(look, saved);
    }
    return calls;
  }
  const baseline = callsFor("cap", "shirt");
  for (const headMass of ["bun", "long"])
    assert.notDeepEqual(callsFor(headMass, "shirt"), baseline, headMass);
  for (const outfit of ["skirt", "coat"])
    assert.notDeepEqual(callsFor("cap", outfit), baseline, outfit);
});

function recordedScene(stage, { playerY = 1800, crowd = [], reducedMotion = true, worldTime = 1, phase = "playing", seed = 17 } = {}) {
  const run = createRun(stage, seed);
  run.phase = phase;
  run.player.x = 240;
  run.player.y = playerY;
  run.crowd = crowd;
  run.party.members = [];
  run.meetingPartner = null;
  run.animals = [];
  run.crossings = [];
  run.worldTime = worldTime;
  const calls = [];
  const ctx = drawingContext();
  for (const name of ["fill", "fillRect", "stroke", "ellipse", "fillText", "createRadialGradient"]) {
    const original = ctx[name];
    ctx[name] = (...args) => {
      calls.push({ name, args, fill: ctx.fillStyle, stroke: ctx.strokeStyle });
      return original(...args);
    };
  }
  renderWorld(ctx, run, { width: 1280, height: 844, reducedMotion });
  return calls;
}

test("side scenery is seeded, varied and irregular without repeated neighbours", () => {
  const sequence = (seed, stage, side) => Array.from({ length: 80 }, (_, row) =>
    sideScenery(seed, stage, side, row, 210));
  for (let stage = 0; stage < 5; stage++) for (const side of [-1, 1]) {
    const rows = sequence(17, stage, side);
    assert.deepEqual(rows, sequence(17, stage, side));
    assert.notDeepEqual(rows.map(r => r.kind), sequence(18, stage, side).map(r => r.kind));
    for (let i = 1; i < rows.length; i++)
      assert.ok(rows[i].kind < 0 || rows[i - 1].kind < 0 || rows[i].kind !== rows[i - 1].kind);
    assert.ok(new Set(rows.map(r => r.offset)).size > 10);
    const kinds = new Set(Array.from({ length: 20 }, (_, seed) => sequence(seed, stage, side)).flat().map(r => r.kind));
    for (const kind of stage === 4 ? [-1, 0, 1] : [-1, 0, 1, 2, 3]) assert.ok(kinds.has(kind));
  }
});

test("interior side scenery retains its seeded placement sequence", () => {
  const rows = Array.from({ length: 8 }, (_, row) => sideScenery(17, 2, -1, row, 210));
  assert.deepEqual(rows.map(row => row.kind), [-1, 1, -1, 1, 3, 1, 3, 0]);
  assert.deepEqual(rows.map(row => Number(row.offset.toFixed(6))),
    [-27.892784, 20.429986, 28.441617, -23.093969, 28.984428, -29.195504, 30.835277, 2.885648]);
});

test("drawn scenery kinds repeat for the same seed and vary for another", () => {
  const colors = ["#b94e50", "#d6e3dc", "#6c9b75", "#669875"];
  const kinds = seed => [900, 1800, 2800].flatMap(playerY => recordedScene(0, { seed, playerY }))
    .filter(c => (c.name === "fill" || c.name === "fillRect") && colors.includes(c.fill))
    .map(c => c.fill);
  assert.deepEqual(kinds(17), kinds(17));
  assert.notDeepEqual(kinds(17), kinds(18));
});

test("the station cafe has an indoor ceiling instead of a sun", () => {
  const colors = stage => recordedScene(stage).filter(c => c.name === "fill" || c.name === "fillRect").map(c => c.fill);
  assert.ok(colors(2).includes("#b99582"));
  assert.ok(colors(2).includes("#fff4d6"));
  for (const sun of ["#fff1d4b8", "#dae5dd35"]) assert.ok(!colors(2).includes(sun));
  for (const stage of [0, 1]) assert.ok(colors(stage).includes("#fff1d4b8"));
  for (const stage of [3, 4])
    for (const sun of ["#fff1d4b8", "#dae5dd35"]) assert.ok(!colors(stage).includes(sun));
});

test("the goal arch has a ground ring without a destination label", () => {
  for (let stage = 0; stage < 5; stage++) {
    const calls = recordedScene(stage, { playerY: 300 });
    assert.ok(!calls.some(c => c.name === "fillText" && ["合 流", "駅入口", "カフェ", "会 場", "LIVE"].includes(c.args[0])));
    assert.ok(calls.filter(c => c.name === "stroke" && c.stroke === (stage === 4 ? "#f1b77f" : ["#f0bd6d", "#f3bd69", "#ffd079", "#f6c97f"][stage])).length >= 32);
  }
});

test("signal head tops attach to the projected gantry rods", () => {
  const run = createRun(1, 17), road = run.crossings[0];
  run.player.x = 240;
  const view = { width: 390, height: 844 };
  const focal = Math.min(view.width * 1.12, view.height * .91);
  const horizon = view.height * .43;
  for (const approach of [380, 154, 72]) {
    run.player.y = road.bottom + approach;
    const heads = pedestrianSignalProjections(run, road, view);
    assert.ok(heads.length);
    const rodTop = horizon + (155 - 83) * focal / (approach + 35 + 230);
    for (const head of heads) assert.ok(Math.abs(head.y - head.height / 2 - rodTop) < 1e-6);
  }
});

test("flow speed lines fade in and out and respect reduced motion", () => {
  const run = createRun(0, 17); run.phase = "playing"; run.combo.flow = 10;
  const ctx = drawingContext(); const strokes = [];
  ctx.stroke = () => strokes.push(ctx.strokeStyle);
  const draw = (time, reducedMotion = false) => {
    run.worldTime = time; strokes.length = 0;
    renderWorld(ctx, run, { width: 390, height: 844, reducedMotion });
    return strokes.filter(s => typeof s === "string" && s.startsWith("rgba(255,241,211,"));
  };
  draw(1); assert.ok(draw(1.1).length);
  run.braking = true; draw(1.2); assert.equal(draw(1.3).length, 0);
  run.braking = false; draw(1.4); assert.equal(draw(1.5, true).length, 0);
  run.combo.flow = 0; draw(1.6); assert.equal(draw(1.7).length, 0);
});

test("venue corridor draws speakers, framed posters, banner and paired light towers", () => {
  const calls = recordedScene(4, { playerY: 1200 });
  const filled = calls.filter((c) => c.name === "fill" || c.name === "fillRect");
  for (const color of ["#20283a", "#303b50", "#edbb91", "#c57383", "#df956f", "#d78583", "#efbb87", "#87e1db20", "#e88dbc20"])
    assert.ok(filled.some((c) => c.fill === color), color);
  assert.ok(calls.filter((c) => c.name === "stroke" && c.stroke === "#8eaab2").length >= 2);
});

test("audience glow sticks have a tip and halo without radial gradients and freeze with reduced motion", () => {
  const actor = { id: 0, x: 240, y: 900, active: true, glowStick: true, vx: 20, walk: 1 };
  const render = (reducedMotion, walk) => recordedScene(4, { playerY: 1000,
    crowd: [{ ...actor, walk }], reducedMotion });
  const frozen = render(true, 1);
  const glow = frozen.filter((c) => c.name === "fill" && ["#8ae9da33", "#8ae9da"].includes(c.fill));
  assert.ok(glow.some((c) => c.fill === "#8ae9da33"));
  assert.ok(glow.some((c) => c.fill === "#8ae9da"));
  assert.equal(frozen.filter((c) => c.name === "createRadialGradient").length, 0);
  const glowEllipses = (calls) => {
    const index = calls.findIndex((c) => c.name === "fill" && c.fill === "#8ae9da33");
    return calls.slice(index - 1, index + 3);
  };
  assert.deepEqual(glowEllipses(frozen), glowEllipses(render(true, 8)));
  assert.notDeepEqual(glowEllipses(render(false, 1)), glowEllipses(render(false, 8)));
});


test("finished audience raises glow sticks even with reduced motion", () => {
  const actor = { id: 0, x: 240, y: 900, active: true, glowStick: true };
  const tip = (phase, worldTime) => {
    const calls = recordedScene(4, { playerY: 1000, crowd: [actor], phase, worldTime });
    const halo = calls.findIndex((call) => call.name === "fill" && call.fill === "#8ae9da33");
    assert.ok(halo > 0);
    assert.equal(calls[halo - 1].name, "ellipse");
    return calls[halo - 1].args;
  };
  assert.ok(tip("finished", 1)[1] < tip("playing", 1)[1]);
  assert.deepEqual(tip("finished", 1), tip("finished", 8));
});

function personCalls(appearanceId, uy = 1) {
  const run = createRun(0, 17);
  run.player.y = 500;
  run.crowd = [{ id: 0, appearanceId, x: run.player.x, y: 400,
    active: true, ux: 0, uy }];
  run.party.members = []; run.meetingPartner = null; run.animals = [];
  const calls = [];
  const ctx = drawingContext();
  for (const name of ["roundRect", "ellipse", "lineTo", "fill"]) {
    ctx[name] = (...args) => calls.push({ name, args, fill: ctx.fillStyle });
  }
  renderWorld(ctx, run, { width: 390, height: 844, reducedMotion: true });
  return calls;
}

test("slim and broad archetypes have different torso widths", () => {
  const torso = (id) => personCalls(id).find((call) =>
    call.name === "roundRect" && call.fill === "#30444baa").args[2];
  assert.ok(torso(1) < torso(3));
});

test("cap and bald head masses draw differently", () => {
  const look = appearanceFor({ appearanceId: 0 });
  const saved = look.headMass;
  try {
    look.headMass = "cap";
    const cap = personCalls(0);
    look.headMass = "bald";
    assert.notDeepEqual(cap, personCalls(0));
  } finally {
    look.headMass = saved;
  }
});

test("the dedicated friend draws a gold star", () => {
  const friend = personCalls(12);
  assert.ok(friend.some((call) => call.name === "fill" && call.fill === "#ffd66e"));
  assert.ok(!personCalls(0).some((call) => call.name === "fill" && call.fill === "#ffd66e"));
});

// ellipse() assigns its fill after recording the path, immediately before fill().
function filledEllipses(calls, color) {
  return calls.filter((call, i) => call.name === "ellipse" &&
    calls[i + 1]?.name === "fill" && calls[i + 1].fill === color);
}

test("pedestrian shadows follow projected feet and reflect stage lighting", () => {
  const shadow = (stage, y = 1700) => {
    const actor = { id: 0, x: 240, y, active: true, ux: 0, uy: 1 };
    const calls = recordedScene(stage, { playerY: 1800, crowd: [actor] });
    const alpha = ["70", "70", "28", "20", "40"][stage];
    const focal = Math.min(1280 * 1.12, 844 * .91);
    const scale = focal / Math.hypot(1800 + 230 - y, 76);
    const eye = Math.min(155, 844 * .40 * Math.hypot(230, 76) / focal);
    const foot = 844 * .43 + eye * scale;
    const matches = filledEllipses(calls, `#24343c${alpha}`).filter((call) =>
      Math.abs(call.args[2] - 13 * scale) < 1e-6);
    assert.equal(matches.length, 1);
    const fill = calls[calls.indexOf(matches[0]) + 1].fill;
    return { ellipse: matches[0].args, foot, alpha: parseInt(fill.slice(-2), 16) };
  };
  const sun = shadow(0), rain = shadow(3), indoor = shadow(2);
  assert.ok(sun.alpha > rain.alpha);
  assert.ok(sun.ellipse[3] > rain.ellipse[3]);
  assert.ok(sun.ellipse[3] > indoor.ellipse[3]);
  for (const stage of [0, 1]) {
    const result = shadow(stage);
    assert.ok(result.ellipse[1] > result.foot);
    assert.ok(result.ellipse[0] < 640);
    assert.ok(result.ellipse[1] - result.ellipse[3] < result.foot);
    const closer = shadow(stage, 1730);
    assert.ok(closer.ellipse[3] > result.ellipse[3]);
    assert.ok(closer.ellipse[1] - closer.foot > result.ellipse[1] - result.foot);
  }
});

test("back-facing heads have no eyes", () => {
  for (const id of [2, 3])
    assert.equal(filledEllipses(personCalls(id, -1), "#33434b").length, 0);
});

test("front-facing heads have two eyes", () => {
  assert.ok(filledEllipses(personCalls(2, 1), "#33434b").length >= 2);
});

test("long hair covers the back of the head while bald heads retain their scalp", () => {
  for (const id of [2, 3]) {
    const look = appearanceFor({ appearanceId: id });
    const calls = personCalls(id, -1);
    const head = filledEllipses(calls, look.skin).find((call) => call.args[2] >= 9);
    assert.ok(head);
    const covering = filledEllipses(calls, look.hair).filter((call) =>
      call.args[0] === head.args[0] && call.args[1] === head.args[1] &&
      call.args[2] >= head.args[2] * .9 && call.args[3] >= head.args[3] * .9);
    assert.equal(covering.length, id === 2 ? 1 : 0);
  }
});


test("finale camera eases from normal framing and reduced motion uses its end", () => {
  assert.equal(FINALE_CAMERA_ADVANCE, 50);
  const values = [0, .25, .5, .75, 1].map(t => finaleFraming(t));
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1]);
  assert.equal(finaleFraming(0, true), 1);
  const run = createRun(4, 17);
  run.player.y = 84;
  run.phase = "playing";
  const normal = protagonistProjection(run, { width: 390, height: 844 });
  run.phase = "finished";
  assert.deepEqual(protagonistProjection(run, { width: 390, height: 844, finaleProgress: 0 }), normal);
  assert.deepEqual(protagonistProjection(run, { width: 390, height: 844, finaleProgress: 0, reducedMotion: true }),
    protagonistProjection(run, { width: 390, height: 844, finaleProgress: 1 }));
});

test("finished arrival draws all three musicians without the foreground arch and banner", () => {
  const calls = recordedScene(4, { playerY: 84, phase: "finished" });
  const fills = calls.filter(c => c.name === "fill" || c.name === "fillRect").map(c => c.fill);
  for (const color of ["#74c3bd", "#dc927f", "#817da8", "#e5aa6e", "#365a6d"])
    assert.ok(fills.includes(color), `performer or instrument ${color}`);
  assert.ok(calls.some(c => c.name === "fillText" && c.args[0] === "LIVE"));
  for (const color of ["#5b4967", "#d78583", "#efbb87"])
    assert.ok(!fills.includes(color), `foreground architecture ${color}`);
});
