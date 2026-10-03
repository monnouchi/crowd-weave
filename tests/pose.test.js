import test from "node:test";
import assert from "node:assert/strict";
import { updatePlayerPose } from "../pose.js";
import { createGame, step } from "../logic.js";
test("head and shoulder lean follow measured left/right motion smoothly", () => {
  const left = updatePlayerPose({ lean: 0 }, -100, 0.05),
    right = updatePlayerPose({ lean: 0 }, 100, 0.05);
  assert.ok(left.lean < 0 && left.lean > -0.14);
  assert.ok(right.lean > 0 && right.lean < 0.14);
  assert.ok(Math.abs(left.lean + right.lean) < 1e-12);
});
test("release and both-button brake recover to a neutral stance", () => {
  let pose = { lean: 0.14 };
  for (let i = 0; i < 30; i++) pose = updatePlayerPose(pose, 0, 0.05);
  assert.ok(Math.abs(pose.lean) < 0.0001);
  const g = createGame();
  g.phase = "playing";
  g.crowd = [];
  const x = g.player.x;
  step(g, 0.05, { left: true, right: true });
  assert.equal(g.player.x - x, 0);
});
test("boundary produces no false lean and pose never alters anchor or hitbox", () => {
  const a = createGame(),
    b = createGame();
  a.phase = b.phase = "playing";
  a.crowd = b.crowd = [];
  let pose = { lean: 0 };
  for (let i = 0; i < 100; i++) {
    const x = a.player.x;
    step(a, 0.05, { right: true });
    pose = updatePlayerPose(pose, (a.player.x - x) / 0.05, 0.05);
    step(b, 0.05, { right: true });
    assert.deepEqual(a, b);
    assert.equal(a.player.r, 12);
  }
  assert.equal(a.player.x, 450);
  assert.ok(Math.abs(pose.lean) < 0.0001);
});
test("reduced motion removes decorative leaning immediately", () => {
  assert.deepEqual(updatePlayerPose({ lean: 0.14 }, 100, 0.05, true), {
    lean: 0,
  });
});
