import test from "node:test";
import assert from "node:assert/strict";
import { appearanceFor } from "../character.js";
import { createGame, joiningFriend, advanceJoining } from "../logic.js";
test("each street arrival visibly joins the exact next friend without changing the current party", () => {
  for (let stage = 0; stage < 4; stage++) {
    const g = createGame(stage);
    g.phase = "finished";
    const party = structuredClone(g.party),
      initial = joiningFriend(g);
    assert.equal(initial.id, stage + 1);
    assert.equal(initial.appearanceId, g.meetingPartner.appearanceId);
    assert.equal(initial.shirt, g.meetingPartner.shirt);
    assert.equal(initial.x, g.meetingPartner.x);
    assert.equal(initial.y, g.meetingPartner.y);
    for (let n = 0; n < 32; n++) advanceJoining(g, 0.025);
    const joined = joiningFriend(g);
    assert.equal(joined.joinProgress, 1);
    assert.notEqual(joined.x, initial.x);
    assert.equal(joined.state, "celebrating");
    assert.deepEqual(g.party, party);
    const next = createGame(stage + 1);
    const member = next.party.members.find((m) => m.id === joined.id);
    assert.ok(member);
    assert.equal(member.shirt, joined.shirt);
    assert.deepEqual(appearanceFor(member), appearanceFor(joined));
  }
  const finale = createGame(4);
  finale.phase = "finished";
  assert.equal(joiningFriend(finale), null);
  assert.equal(finale.party.members.length, 4);
});
test("join has no forced wait, supports reduced motion and background, and leaves score immutable", () => {
  const g = createGame(2);
  g.phase = "finished";
  g.elapsed = 10;
  g.hits = 1;
  const frozen = structuredClone(g);
  advanceJoining(g, 0.5, { active: false });
  advanceJoining(g, 0.5, { reducedMotion: true });
  assert.deepEqual(g, frozen);
  assert.equal(joiningFriend(g, true).joinProgress, 1);
  advanceJoining(g, 0.05);
  assert.equal(g.elapsed, 10);
  assert.equal(g.hits, 1);
  assert.equal(g.worldTime, 0);
});
