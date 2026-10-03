import test from "node:test";
import assert from "node:assert/strict";
import { EnterLatch, primaryCommand } from "../input.js";
test("primary command maps ready, paused and all five results; play has no action", () => {
  assert.equal(primaryCommand("ready", 0), "start");
  assert.equal(primaryCommand("paused", 2), "resume");
  for (let stage = 0; stage < 4; stage++)
    assert.equal(primaryCommand("finished", stage), "next");
  assert.equal(primaryCommand("finished", 4), "retry");
  assert.equal(primaryCommand("playing", 3), null);
});
test("one physical Enter press cannot advance multiple states until released", () => {
  const key = new EnterLatch();
  assert.equal(key.press(), true);
  assert.equal(key.press({ repeat: true }), false);
  assert.equal(key.press(), false);
  key.release();
  assert.equal(key.press(), true);
});
test("text entry, composition, modifiers and repeats do not arm shortcuts", () => {
  const key = new EnterLatch();
  for (const option of [
    { editable: true },
    { composing: true },
    { modified: true },
    { repeat: true },
  ])
    assert.equal(key.press(option), false);
  assert.equal(key.held, false);
  assert.equal(key.press(), true);
  key.release();
  assert.equal(key.held, false);
});
