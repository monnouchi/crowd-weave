import test from "node:test";
import assert from "node:assert/strict";
import { createWalkingPose, updateWalkingPose, facingView } from "../pose.js";
import { drawCharacter } from "../character.js";
import { createGame, step } from "../logic.js";
const directions = [
  [0, -1, "back"],
  [1, -1, "back-right"],
  [1, 0, "right"],
  [1, 1, "front-right"],
  [0, 1, "front"],
  [-1, 1, "front-left"],
  [-1, 0, "left"],
  [-1, -1, "back-left"],
];
function context() {
  const values = { globalAlpha: 1 };
  return new Proxy(values, {
    get: (t, k) => (k in t ? t[k] : () => {}),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  });
}
test("eight world directions select upright front, back or profile views", () => {
  for (const [x, y, view] of directions) {
    const before = createWalkingPose({ x: 100, y: 100 });
    const after = updateWalkingPose(
      before,
      { x: 100 + x * 2, y: 100 + y * 2 },
      0.04,
    );
    assert.equal(facingView(after), view);
    assert.equal(after.moving, true);
    assert.ok(after.speed > 0);
  }
});
test("actual lateral or returning movement wins over the previous forward heading", () => {
  let p = createWalkingPose({ x: 240, y: 379 }, { x: 0, y: -1 });
  p = updateWalkingPose(p, { x: 245, y: 379 }, 0.05);
  assert.equal(facingView(p), "right");
  p = updateWalkingPose(p, { x: 245, y: 384 }, 0.05);
  assert.equal(facingView(p), "front");
  assert.equal(p.speed, 100);
});
test("a faster scrolling camera never changes the world direction or animates a waiting person", () => {
  const previous = { x: 200, y: 300 },
    next = { x: 200, y: 299 };
  const screenDelta = next.y + 105 - (previous.y + 100);
  assert.ok(screenDelta > 0, "on-screen position moves down");
  const pose = updateWalkingPose(createWalkingPose(previous), next, 0.05);
  assert.equal(facingView(pose), "back");
  const waiting = createWalkingPose({ x: 240, y: 54 }, { x: 0, y: 1 });
  for (const camera of [100, 105, -300]) {
    assert.notEqual(waiting.y + camera, waiting.y);
    const still = updateWalkingPose(waiting, { x: 240, y: 54 }, 0.05);
    assert.equal(still.moving, false);
    assert.equal(still.distance, 0);
    assert.equal(facingView(still), "front");
  }
});
test("stopping keeps the last heading, plants both feet, and an explicit look can turn the head", () => {
  let pose = updateWalkingPose(
    createWalkingPose({ x: 0, y: 0 }),
    { x: -2, y: -2 },
    0.04,
  );
  const distance = pose.distance;
  pose = updateWalkingPose(pose, { x: -2, y: -2 }, 0.04);
  assert.equal(facingView(pose), "back-left");
  assert.equal(pose.moving, false);
  assert.equal(pose.distance, distance);
  const drawn = drawCharacter(
    context(),
    { x: 0, y: 0, r: 13, color: 0, state: "walking", walk: 999 },
    { pose },
  );
  assert.equal(drawn.stride, 0);
  const turn = updateWalkingPose(pose, { x: -2, y: -2 }, 0.04, {
    canMove: false,
    look: { x: 0, y: 1 },
  });
  assert.equal(facingView(turn), "front");
  assert.equal(turn.moving, false);
});
test("pause, zero-time, re-entry and result-tableau jumps are not walking steps", () => {
  const pose = createWalkingPose({ x: 100, y: 100 }, { x: 1, y: 0 });
  for (const [point, dt, options] of [
    [{ x: 102, y: 100 }, 0.05, { canMove: false }],
    [{ x: 102, y: 100 }, 0, {}],
    [{ x: 100, y: -80 }, 0.05, {}],
    [{ x: 140, y: -43 }, 0.05, { reset: true }],
  ]) {
    const p = updateWalkingPose(pose, point, dt, options);
    assert.equal(p.moving, false);
    assert.equal(p.speed, 0);
    assert.equal(p.distance, 0);
  }
});
test("rendering all roles and directions cannot change world positions, headings or hitboxes", () => {
  const a = createGame(4),
    b = structuredClone(a),
    people = [
      { ...a.player, player: true },
      ...a.crowd,
      ...a.party.members,
      a.meetingPartner,
    ];
  for (const person of people)
    for (const [x, y, view] of directions) {
      const p = Object.freeze(structuredClone(person)),
        pose = Object.freeze({
          ...createWalkingPose(p, { x, y }),
          moving: true,
          speed: 50,
          distance: 7,
        });
      const before = structuredClone(p);
      const result = drawCharacter(context(), p, { pose, player: !!p.player });
      assert.equal(result.view, view);
      assert.deepEqual(p, before);
    }
  assert.deepEqual(a, b);
  a.phase = b.phase = "playing";
  for (let i = 0; i < 40; i++) {
    step(a, 0.025, { right: true });
    step(b, 0.025, { right: true });
  }
  assert.deepEqual(a, b);
});
test("reduced motion suppresses gait without losing the essential facing direction", () => {
  const pose = {
    ...createWalkingPose({ x: 0, y: 0 }, { x: 1, y: -1 }),
    moving: true,
    speed: 75,
    distance: 7,
  };
  const p = { x: 0, y: 0, r: 12, color: 0 };
  assert.notEqual(drawCharacter(context(), p, { pose }).stride, 0);
  const reduced = drawCharacter(context(), p, { pose, reducedMotion: true });
  assert.equal(reduced.stride, 0);
  assert.equal(reduced.view, "back-right");
});
