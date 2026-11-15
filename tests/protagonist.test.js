import test from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/run.js";
import { protagonistLean, protagonistPose, protagonistProjection, renderWorld } from "../src/render.js";

function context(calls) {
  const target = { globalAlpha: 1, canvas: { width: 390, height: 700 } };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
      if (key === "measureText") return () => ({ width: 30 });
      if (key === "fill" || key === "fillRect") return () => calls.push(obj.fillStyle);
      return () => {};
    },
    set(obj, key, value) { obj[key] = value; return true; },
  });
}

test("third-person projection frames the player at shared actor scale", () => {
  const game = createRun(0, 17);
  game.player.y = 1000;
  for (const [width, height] of [[390, 700], [320, 568], [390, 844], [1280, 844]]) {
    const p = protagonistProjection(game, { width, height });
    assert.ok(p.y > 0 && p.y < height);
    assert.ok(p.y - 65 * p.scale > 0);
    if (width === 390 && height === 700) {
      assert.ok(p.y / height >= .78 && p.y / height <= .88);
      assert.ok(65 * p.scale / height >= .13 && 65 * p.scale / height <= .20);
      assert.ok(Math.abs(p.scale - Math.min(width * 1.12, height * .91) / Math.hypot(230, 76)) < 1e-10);
    }
  }
});

test("protagonist lean follows lateral steering", () => {
  const game = createRun(0, 17); game.phase = "playing";
  assert.ok(protagonistLean(game, { steer: 1 }) > 0);
  assert.ok(protagonistLean(game, { steer: -1 }) < 0);
  assert.equal(protagonistLean(game, { steer: 0 }), 0);
});

test("protagonist poses follow state and priority", () => {
  const game = createRun(0, 17); game.phase = "ready";
  assert.equal(protagonistPose(game), "idle");
  game.phase = "playing";
  assert.equal(protagonistPose(game), "walk");
  assert.equal(protagonistPose(game, { braking: true }), "brake");
  game.callRipple = { x: 0, y: 0, started: game.worldTime, mode: "recognized" };
  assert.equal(protagonistPose(game, { braking: true }), "call");
  game.hop = { remaining: 20 };
  assert.equal(protagonistPose(game), "hop");
  game.stun = .2;
  assert.equal(protagonistPose(game), "stumble");
});

test("protagonist sorts among crowd by world depth, including a tie", () => {
  const game = createRun(0, 17); game.phase = "playing"; game.player.y = 1000;
  game.crowd = [
    { id: 1, x: 210, y: 990, active: true, shirt: "#110001" },
    { id: 2, x: 240, y: 1000, active: true, shirt: "#110002" },
    { id: 3, x: 270, y: 1010, active: true, shirt: "#110003" },
  ];
  game.party.members = []; game.meetingPartner = null; game.animals = []; game.crossings = [];
  const calls = [];
  renderWorld(context(calls), game, { width: 390, height: 700, reducedMotion: true });
  const positions = ["#110001", "#110002", "#25565e", "#110003"].map((color) => calls.indexOf(color));
  assert.ok(positions.every((i) => i >= 0), positions.join(", "));
  assert.ok(positions.every((i, n) => n === 0 || i > positions[n - 1]), positions.join(", "));
});
