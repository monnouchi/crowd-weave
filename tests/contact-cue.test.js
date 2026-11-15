import test from "node:test";
import assert from "node:assert/strict";
import { CONTACT_CUE_INTERVAL } from "../logic.js";
import { createRun, beginRun, updateRun } from "../src/run.js";
import { createParty } from "../party.js";

const brake = { brake: true };
function fixture() {
  const run = createRun(0, 17);
  beginRun(run);
  run.player.y = 400;
  run.crossings = []; run.traffic = null; run.animals = [];
  const person = { ...run.crowd[0], id: 98765, x: run.player.x, y: run.player.y,
    state: "meeting", habit: "meeting", wait: 100, vx: 0, vy: 0 };
  run.crowd = [];
  return { run, person };
}
function tick(run) {
  updateRun(run, 0.05, brake);
  return run.events.filter((event) => event.kind === "contact").length;
}

test("party members in contact or nearby never produce player feedback", () => {
  for (const state of ["following", "docking", "docked", "stunned", "recovering"]) {
    const { run, person } = fixture();
    run.party = createParty(1, run.player);
    const member = run.party.members[0];
    Object.assign(member, { x: run.player.x, y: run.player.y, state,
      docking: state === "docking", docked: state === "docked" });
    // Exercise the membership marker even if a party body appears among actors.
    Object.assign(person, { friend: true, x: run.player.x, y: run.player.y });
    run.crowd = [person];
    run.combo.flow = 5; run.combo.nextDecayAt = 100;
    let cues = 0;
    for (let i = 0; i < 80; i++) cues += tick(run);
    assert.equal(run.hits, 0, state);
    assert.equal(cues, 0, state);
    assert.equal(run.combo.flow, 5, state);
    assert.equal(run.stun, 0, state);
    assert.equal(person.comboContacted, undefined, state);
    assert.equal(run.combo.nearMissSerial, 0, state);
  }
});

test("contact cues latch per episode and respect the cooldown", () => {
  const { run, person } = fixture();
  run.crowd = [person];
  let cues = tick(run);
  assert.equal(cues, 1);
  for (let i = 0; i < 32; i++) cues += tick(run);
  assert.equal(cues, 1);
  assert.equal(run.hits, 1);
  assert.equal(run.stun, 0);
  person.x = 400; tick(run);
  person.x = run.player.x; person.y = run.player.y;
  assert.equal(tick(run), 0, "new contact before cue cooldown is silent");
  assert.equal(run.hits, 2, "cue cooldown does not suppress scoring");
  while (run.worldTime < CONTACT_CUE_INTERVAL + 1.7) cues += tick(run);
  assert.equal(cues, 1, "remaining in contact cannot trigger a delayed cue");
  person.x = 400; tick(run);
  person.x = run.player.x; person.y = run.player.y;
  assert.equal(tick(run), 1, "a new contact after cooldown cues again");
  assert.equal(run.hits, 3);
});
