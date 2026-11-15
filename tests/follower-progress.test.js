import test from "node:test";
import assert from "node:assert/strict";
import { createParty, moveParty, FOLLOWER_PROGRESS_MARGIN } from "../party.js";

// The player reverses over the trail after the follower has caught up.
test("trail reversal constrains following movement without displacing an ahead follower", () => {
  const player = { x: 240, y: 600 };
  const party = createParty(1, player);
  for (let i = 0; i < 40; i++) {
    player.y -= 3;
    moveParty(party, player, 0.05);
  }
  for (let i = 0; i < 40; i++) moveParty(party, player, 0.05, { braking: true });
  let constrained = false;
  for (let i = 0; i < 20; i++) {
    player.y += 3;
    const m = party.members[0], before = { x: m.x, y: m.y };
    moveParty(party, player, 0.05);
    const floor = player.y + FOLLOWER_PROGRESS_MARGIN;
    if (before.y >= floor) assert.ok(m.y >= floor);
    else assert.ok(m.y >= before.y, "an ahead follower cannot advance further");
    if (m.y === floor && m.y !== before.y) {
      constrained = true;
      assert.ok(Math.abs(m.x - player.x) >= 24);
    }
  }
  assert.ok(constrained, "the reversal exercised the progress floor");
});

test("stationary, stunned and docked followers are not displaced by the guard", () => {
  for (const state of ["stationary", "stunned", "docked"]) {
    const player = { x: 240, y: 600 }, party = createParty(1, player), m = party.members[0];
    m.x = 240; m.y = 590;
    if (state === "docked") m.docked = true;
    moveParty(party, player, 0, { stunned: state === "stunned" });
    assert.deepEqual({ x: m.x, y: m.y }, { x: 240, y: 590 });
  }
});

test("a follower moving into the floor yields toward open space near either edge", () => {
  for (const x of [35, 240, 445]) {
    const player = { x, y: 600 }, party = createParty(1, player), m = party.members[0];
    party.trail = [{ x, y: 620, s: -30 }, { x, y: 590, s: 0 }];
    m.x = x; m.y = 620; m.s = -30;
    party.distance = 30;
    moveParty(party, player, 0.2);
    assert.equal(m.y, player.y + FOLLOWER_PROGRESS_MARGIN);
    assert.ok(Math.abs(m.x - player.x) >= 24);
  }
});
