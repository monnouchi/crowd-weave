import test from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../src/audio.js";

test("stages have distinct eight-note motifs and unchanged roots and beats", () => {
  assert.equal(STAGES.length, 5);
  for (const stage of STAGES) {
    assert.ok(Array.isArray(stage.motif));
    assert.equal(stage.motif.length, 8);
  }
  assert.deepEqual(STAGES[0].motif, [0, 3, 7, 10, 7, 3, 5, 2]);
  for (let i = 0; i < STAGES.length; i++) {
    for (let j = i + 1; j < STAGES.length; j++) {
      assert.notDeepEqual(STAGES[i].motif, STAGES[j].motif);
    }
  }
  assert.deepEqual(STAGES.map((stage) => stage.root), [196, 220, 174.61, 220, 261.63]);
  assert.deepEqual(STAGES.map((stage) => stage.beat), [0.62, 0.49, 0.58, 0.46, 0.4]);
});
