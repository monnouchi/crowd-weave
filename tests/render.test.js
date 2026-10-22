import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import { renderWorld } from "../src/render.js";

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
