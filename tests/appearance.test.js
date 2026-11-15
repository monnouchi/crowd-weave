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
      let beforeFollowers = [];
      for (let frame = 0; frame < 700 && game.phase === "playing"; frame++) {
        beforeFollowers = game.party.members.map((person) => ({ x: person.x, y: person.y }));
        step(game, 0.025, {});
      }
      assert.equal(game.phase, "finished");
      assert.ok(game.party.members.every((person, index) =>
        Math.hypot(person.x - beforeFollowers[index].x,
          person.y - beforeFollowers[index].y) < 8),
      "arrival never warps a companion");
    }
  }
});

test("original looks and crowd assignments stay stable with the dedicated partner", () => {
  const originals = [
    ["#eec4a0", "#3c343c", "crop", "shirt", 1],
    ["#c38d69", "#292e3c", "bob", "coat", .96],
    ["#f5dbbc", "#876348", "long", "skirt", 1],
    ["#ad7357", "#d0c9c4", "short", "cardigan", 1.06, true],
    ["#e3ac86", "#58403a", "bun", "shirt", .96],
    ["#906446", "#242f39", "curls", "jacket", 1.06],
    ["#f3d0ab", "#b9b4a9", "bob", "coat", 1, true],
    ["#c68b65", "#3b2f32", "long", "shirt", .96],
    ["#e7bd95", "#af9e8b", "thinning", "cardigan", 1.06, true],
    ["#bd8261", "#42333b", "short", "skirt", 1],
    ["#f1d2b7", "#71543c", "curls", "jacket", .96],
    ["#a87756", "#242e3d", "bun", "coat", 1.06],
  ];
  for (const id of [-25, -12, -1, ...Array.from({ length: 50 }, (_, i) => i)]) {
    const look = appearanceFor({ id });
    const expected = originals[((id % 12) + 12) % 12];
    assert.deepEqual([look.skin, look.hair, look.style, look.outfit, look.width,
      ...(look.older ? [look.older] : [])], expected);
  }
  const dedicated = appearanceFor({ appearanceId: 12 });
  assert.equal(dedicated.style, "long");
  assert.ok(!originals.some(([skin, hair]) => skin === dedicated.skin && hair === dedicated.hair));
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(createGame(stage).meetingPartner.appearanceId, 12);
    assert.deepEqual(appearanceFor(createGame(stage).meetingPartner), dedicated);
    assert.deepEqual(appearanceFor(createGame(stage + 1).party.members.at(-1)), dedicated);
  }
});


test("all looks have the specified silhouette and accessory assignments", () => {
  const expected = [
    ["regular", "cap", "backpack"], ["slim", "long", "shoulderBag"],
    ["regular", "long", "shoppingBag"], ["broad", "bald", "none"],
    ["slim", "bun", "none"], ["broad", "hood", "guitarCase"],
    ["regular", "long", "shoppingBag"], ["slim", "long", "shoulderBag"],
    ["broad", "bald", "none"], ["regular", "cap", "none"],
    ["slim", "hood", "backpack"], ["broad", "bun", "guitarCase"],
    ["regular", "long", "toteBag"],
  ];
  for (const [id, fields] of expected.entries()) {
    const look = appearanceFor({ appearanceId: id });
    assert.deepEqual([look.archetype, look.headMass, look.accessory], fields);
    assert.equal(look.archetype, look.width <= .96 ? "slim" : look.width >= 1.06 ? "broad" : "regular");
  }
});

test("crowd silhouettes are varied and the friend is uniquely marked", () => {
  const crowd = Array.from({ length: 12 }, (_, appearanceId) => appearanceFor({ appearanceId }));
  assert.equal(new Set(crowd.map((look) => look.archetype)).size, 3);
  assert.equal(new Set(crowd.map((look) => look.headMass)).size, 5);
  assert.ok(new Set(crowd.map((look) => look.accessory)).size >= 3);
  assert.ok(crowd.every((look) => !look.star && look.accessory !== "toteBag"));
  const friend = appearanceFor({ appearanceId: 12 });
  assert.equal(friend.star, true);
  assert.equal(friend.accessory, "toteBag");
});
