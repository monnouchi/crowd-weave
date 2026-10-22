import test from "node:test";
import assert from "node:assert/strict";
import { appearanceFor } from "../src/appearance.js";
import { createGame, step } from "../logic.js";

test("new crowd keeps stable varied looks as friends join", () => {
  const looks = Array.from({ length: 40 }, (_, id) => appearanceFor({ id, x: 200 }));
  assert.ok(new Set(looks.map((look) => look.skin)).size >= 5);
  assert.ok(new Set(looks.map((look) => look.hair)).size >= 5);
  assert.ok(looks.some((look) => look.older));
  for (let stage = 0; stage < 4; stage++) {
    const waiting = createGame(stage).meetingPartner;
    const joined = createGame(stage + 1).party.members.at(-1);
    assert.deepEqual(appearanceFor(waiting), appearanceFor(joined));
  }
});

test("destination side walls are physical while either edge of the entrance works", () => {
  for (let stage = 0; stage < 4; stage++) {
    for (const x of [50, 430]) {
      const game = createGame(stage);
      game.phase = "playing";
      game.crowd = [];
      game.crossings = [];
      game.traffic = null;
      game.player.x = x;
      game.player.y = 112;
      for (let frame = 0; frame < 50; frame++) step(game, 0.025, {});
      assert.equal(game.player.y, 107);
      assert.equal(game.phase, "playing");
    }
    for (const x of [175, 305]) {
      const game = createGame(stage);
      game.phase = "playing";
      game.crowd = [];
      game.crossings = [];
      game.traffic = null;
      game.player.x = x;
      game.player.y = 112;
      for (let frame = 0; frame < 700 && game.phase === "playing"; frame++)
        step(game, 0.025, {});
      assert.equal(game.phase, "finished");
      assert.ok(game.party.members.every((person) => person.docked));
    }
  }
});
