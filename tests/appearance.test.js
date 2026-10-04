import test from "node:test";
import assert from "node:assert/strict";
import { appearanceFor, umbrellaRig, placeSpeech } from "../character.js";
import { createWalkingPose } from "../pose.js";
import { createGame, step } from "../logic.js";
test("stable looks cover hairstyles, clothing, skin tones, older adults and bounded builds independently of motion", () => {
  const looks = Array.from({ length: 40 }, (_, id) =>
    appearanceFor({ id, x: 200 }),
  );
  for (const key of ["skin", "style", "outfit"])
    assert.ok(new Set(looks.map((p) => p[key])).size >= 5, key);
  assert.ok(looks.some((p) => p.older));
  assert.ok(looks.every((p) => p.width >= 0.96 && p.width <= 1.06));
  for (let stage = 0; stage < 4; stage++) {
    const waiting = createGame(stage).meetingPartner,
      joined = createGame(stage + 1).party.members.at(-1);
    assert.deepEqual(appearanceFor(waiting), appearanceFor(joined));
  }
});
test("umbrella arm, hand, shaft and canopy form one rig in all eight directions; sway is restrained", () => {
  const behind = new Set();
  for (const [x, y] of [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ]) {
    const pose = createWalkingPose({ x: 0, y: 0 }, { x, y }),
      rig = umbrellaRig(pose, 24, 0),
      sway = umbrellaRig(pose, 24, 2.2);
    behind.add(rig.behind);
    assert.ok(
      Math.hypot(rig.grip.x - rig.shoulder.x, rig.grip.y - rig.shoulder.y) < 10,
    );
    assert.ok(Math.abs(rig.grip.y - rig.canopy.y - 25) < 1e-10);
    assert.ok(Math.abs(rig.canopy.x) < 10);
    assert.ok(
      Math.hypot(sway.canopy.x - rig.canopy.x, sway.canopy.y - rig.canopy.y) <
        1,
    );
  }
  assert.equal(behind.size, 2);
});
test("speech stays readable at viewport edges and chooses a position away from visible signals", () => {
  const viewport = { width: 320, height: 190 },
    width = 132,
    height = 48;
  for (const [x, y] of [
    [0, 0],
    [320, 190],
    [160, 150],
    [-30, 150],
    [350, 10],
  ]) {
    const b = placeSpeech({ x, y, width, height, viewport });
    assert.ok(b.left >= 6 && b.top >= 6);
    assert.ok(b.left + width <= 314 && b.top + height <= 184);
    assert.ok(b.anchorX >= 2 && b.anchorX <= 318);
  }
  const signal = { left: 6, right: 140, top: 70, bottom: 140 };
  const p = placeSpeech({
    x: 150,
    y: 135,
    width,
    height,
    viewport,
    obstacles: [signal],
  });
  assert.ok(p.left >= 150 || p.top + height <= 70);
});
test("destination side walls are physical, while left/right edges of central goal remain usable for every party", () => {
  for (let stage = 0; stage < 5; stage++) {
    for (const x of [50, 430]) {
      const g = createGame(stage);
      g.phase = "playing";
      g.crowd = [];
      g.crossings = [];
      g.traffic = null;
      g.player.x = x;
      g.player.y = 112;
      for (let n = 0; n < 50; n++) step(g, 0.025, {});
      assert.equal(g.player.y, 107);
      assert.equal(g.phase, "playing");
    }
    for (const x of [175, 305]) {
      const g = createGame(stage);
      g.phase = "playing";
      g.crowd = [];
      g.crossings = [];
      g.traffic = null;
      g.player.x = x;
      g.player.y = 112;
      for (let n = 0; n < 700 && g.phase === "playing"; n++) step(g, 0.025, {});
      assert.equal(g.phase, "finished");
      assert.ok(g.party.members.every((p) => p.docked));
    }
  }
});
