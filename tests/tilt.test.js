import test from "node:test";
import assert from "node:assert/strict";
import { TiltState, tiltPermission } from "../tilt.js";
import { createGame, step } from "../logic.js";
test("sensor permission feature detection, granted, denied and rejection", async () => {
  assert.equal(
    await tiltPermission({
      isSecureContext: false,
      DeviceOrientationEvent: {},
    }),
    "unsupported",
  );
  assert.equal(await tiltPermission({ isSecureContext: true }), "unsupported");
  assert.equal(
    await tiltPermission({ isSecureContext: true, DeviceOrientationEvent: {} }),
    "granted",
  );
  for (const state of ["granted", "denied"])
    assert.equal(
      await tiltPermission({
        isSecureContext: true,
        DeviceOrientationEvent: { requestPermission: async () => state },
      }),
      state,
    );
  assert.equal(
    await tiltPermission({
      isSecureContext: true,
      DeviceOrientationEvent: {
        requestPermission: async () => {
          throw Error();
        },
      },
    }),
    "denied",
  );
});
test("tilt neutral, deadzone, smoothing, left/right and stale clearing", () => {
  const t = new TiltState();
  assert.equal(t.sample(null, 1, 0, 0), false);
  t.sample(0, 10, 0, 0);
  assert.equal(t.read(0).axis, 0);
  t.sample(0, 12, 0, 20);
  assert.equal(t.read(20).axis, 0);
  for (let n = 1; n < 20; n++) t.sample(0, 30, 0, 20 + n * 25);
  assert.ok(t.read(495).axis > 0.9);
  t.recenter();
  assert.equal(t.read(495).axis, 0);
  for (let n = 1; n < 20; n++) t.sample(0, 5, 0, 495 + n * 25);
  assert.ok(t.read(970).axis < -0.9);
  assert.equal(t.read(2000).axis, 0);
  assert.equal(t.read(2000).stale, true);
});
test("landscape orientation reinitializes neutral and maps beta", () => {
  const t = new TiltState();
  t.sample(0, 0, 0, 0);
  t.sample(40, 0, 90, 25);
  assert.equal(t.read(25).axis, 0);
  for (let n = 1; n < 20; n++) t.sample(60, 0, 90, 25 + n * 25);
  assert.ok(t.read(500).axis > 0.9);
  t.sample(60, 0, -90, 525);
  assert.equal(t.read(525).axis, 0);
});
test("brake pointers and reset clear safely; brake overrides analog movement", () => {
  const t = new TiltState();
  t.sample(0, 0, 0, 0);
  t.brakes.add(1);
  t.brakes.add(2);
  t.brakes.delete(1);
  assert.equal(t.read(10).left, true);
  assert.equal(t.read(10).right, true);
  const g = createGame();
  g.crowd = [];
  g.phase = "playing";
  const p = { ...g.player };
  step(g, 0.05, t.read(10));
  assert.deepEqual(g.player, p);
  t.reset();
  assert.equal(t.brakes.size, 0);
  assert.equal(t.read(20).stale, true);
});
test("analog tilt is bounded and keeps keyboard movement unchanged", () => {
  const g = createGame();
  g.crowd = [];
  g.phase = "playing";
  step(g, 0.05, { axis: 0.5, right: true });
  assert.equal(g.player.x, 242.5);
  step(g, 0.05, { right: true });
  assert.equal(g.player.x, 247.5);
  step(g, 0.05, { axis: 10, right: true });
  assert.equal(g.player.x, 252.5);
});
