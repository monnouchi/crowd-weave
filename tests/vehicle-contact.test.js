import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step } from "../logic.js";
import { createParty } from "../party.js";
import { sweptVehicleContact, trafficViolations } from "../traffic.js";
import { primaryCommand } from "../input.js";

test("swept car and bicycle collisions cannot tunnel through a stationary or moving body", () => {
  for (const kind of ["car", "bicycle"]) {
    const v = {
      kind,
      width: kind === "car" ? 58 : 32,
      previousX: -100,
      x: 700,
      y: 300,
    };
    for (const r of [9, 12]) {
      const t = sweptVehicleContact(
        v,
        { x: 240, y: 300, r },
        { x: 240, y: 300, r },
      );
      assert.ok(t > 0 && t < 1);
      assert.equal(
        sweptVehicleContact(v, { x: 240, y: 360, r }, { x: 240, y: 360, r }),
        null,
      );
    }
    assert.ok(
      sweptVehicleContact(
        { ...v, previousX: 240, x: 240 },
        { x: 240, y: 380, r: 12 },
        { x: 240, y: 220, r: 12 },
      ) !== null,
    );
  }
  const v = { kind: "car", width: 58, previousX: 240, x: 240, y: 300 };
  assert.equal(
    sweptVehicleContact(
      v,
      { x: 279, y: 325, r: 12 },
      { x: 279, y: 325, r: 12 },
    ),
    null,
    "diagonal outside the rounded corner",
  );
});

test("every outdoor crossing ends the run immediately on a player or follower hit and freezes its score", () => {
  for (const stage of [1, 3])
    for (let road = 0; road < (stage === 3 ? 2 : 1); road++)
      for (const memberId of [0, 1]) {
        const g = createGame(stage);
        g.crowd = [];
        g.phase = "playing";
        g.worldTime = 0.5;
        g.stun = 1;
        const t = g.crossings[road],
          v = t.vehicle;
        g.player.x = 240;
        g.player.y = v.y + (memberId ? 100 : 0);
        g.party = createParty(1, g.player);
        if (memberId) {
          g.party.members[0].x = 240;
          g.party.members[0].y = v.y;
          g.party.members[0].suitcase = true;
        }
        Object.assign(v, { x: 100, speed: 3000, entered: true, active: true });
        step(g, 0.05, { left: true, right: true });
        assert.equal(g.phase, "gameover");
        assert.equal(g.crash.memberId, memberId);
        assert.equal(g.crash.crossingId, t.id || "road");
        assert.equal(g.hits, 0);
        const frozen = structuredClone(g);
        step(g, 0.05, { right: true });
        assert.deepEqual(g, frozen);
        assert.equal(primaryCommand(g.phase, g.stage), "retry-stage");
      }
});

test("an occupied red road does not apply automatic braking or end the run just for red entry", () => {
  const g = createGame(1);
  g.crowd = [];
  g.phase = "playing";
  g.worldTime = 1;
  g.traffic.phaseOffset = 0;
  g.player.y = 380;
  g.party = createParty(1, g.player);
  Object.assign(g.traffic.vehicle, { x: 240, entered: true, active: true });
  step(g, 0.025, {});
  assert.ok(g.player.y < 379);
  assert.equal(g.phase, "playing");
  assert.equal(trafficViolations(g), 1);
  assert.equal(g.traffic.reserved, false);
  assert.equal(g.traffic.crossing, true);
  const wait = createGame(1);
  wait.crowd = [];
  wait.phase = "playing";
  wait.player.y = 380;
  step(wait, 0.05, { left: true, right: true });
  assert.equal(wait.player.y, 380);
  assert.equal(trafficViolations(wait), 0);
});

test("pedestrian contacts retain the time penalty in an ordinary street", () => {
  const g = createGame(0);
  g.phase = "playing";
  g.crowd = [
    {
      ...g.crowd[0],
      x: g.player.x,
      y: g.player.y - 2,
      state: "reading",
      wait: 100,
      active: true,
    },
  ];
  step(g, 0.025, {});
  assert.equal(g.phase, "playing");
  assert.equal(g.hits, 1);
  assert.equal(g.elapsed, 2.025);
});
