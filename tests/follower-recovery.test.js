import test from "node:test";
import assert from "node:assert/strict";
import { createParty, moveParty, FOLLOWER_PROGRESS_MARGIN, LEASH_STALL_SECONDS } from "../party.js";
import { followerProgress } from "../bodies.js";
import { makeRoomForFollower } from "../crowd.js";

test("an anchored blocker triggers recovery and the party resumes in order", () => {
  const player = { x: 240, y: 600 }, party = createParty(2, player);
  const [friend] = party.members, ids = party.members.map((m) => m.id);
  const anchor = { id: 9, x: 240, y: 608, r: 13, anchor: true };
  assert.equal(followerProgress(friend, { x: 240, y: 625 }, friend.r, [anchor]).fraction, 0);
  makeRoomForFollower(anchor, friend);
  assert.equal(anchor.y, 608);
  for (let n = 0; n < 300 && !friend.recoveryCount; n++) {
    player.y -= 1;
    moveParty(party, player, 0.05, { resolveFollower: (m, p) =>
      followerProgress(m, p, m.r, [anchor]).fraction });
  }
  assert.equal(friend.recoveryCount, 1);
  assert.ok(friend.y >= player.y + FOLLOWER_PROGRESS_MARGIN);
  assert.ok(Math.abs(friend.x - player.x) >= 24);
  assert.deepEqual(party.members.map((m) => m.id), ids);
  const s = friend.s;
  for (let n = 0; n < 20; n++) {
    player.y -= 1;
    moveParty(party, player, 0.05);
  }
  assert.ok(friend.s > s);
  assert.equal(friend.recovering, 0);
});

test("a stationary lagging friend recovers even when the player waits", () => {
  const player = { x: 240, y: 600 }, party = createParty(1, player);
  const m = party.members[0];
  m.y += 200; m.s -= 200;
  for (let t = 0; t < LEASH_STALL_SECONDS + 0.2; t += 0.05)
    moveParty(party, player, 0.05, { resolveFollower: () => 0 });
  assert.equal(m.recoveryCount, 1);
  assert.ok(m.y >= player.y + FOLLOWER_PROGRESS_MARGIN);
});
