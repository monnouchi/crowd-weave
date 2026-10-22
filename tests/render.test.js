import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import {
  pedestrianFacing, pedestrianSignalProjections, renderWorld, reunionWave,
  worldLabelCenterX,
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

test("both route names remain visible on a narrow screen near the fork", () => {
  const run = createRun(1, 17);
  run.phase = "playing";
  run.player.x = 240;
  run.player.y = run.routeBranch.fork.y + 81;
  const labels = [];
  const ctx = drawingContext();
  ctx.fillText = (value, x) => labels.push({ value, x });
  renderWorld(ctx, run, { width: 320, height: 568 });
  const wide = labels.find((label) => label.value.includes("ひろい道"));
  const short = labels.find((label) => label.value === "近道");
  assert.ok(wide);
  assert.ok(short);
  assert.ok(wide.x > 8 && wide.x < 160);
  assert.ok(short.x > wide.x);
});
