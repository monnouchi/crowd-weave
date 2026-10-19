import test from "node:test";
import assert from "node:assert/strict";
import { activeSpeech, createGame, step } from "../logic.js";
import { createParty } from "../party.js";

function playing(stage = 0) {
  const game = createGame(stage, 17);
  game.phase = "playing";
  game.crowd = [];
  return game;
}

function bystander(game, id = 99) {
  return {
    ...createGame(0, 17).crowd[0], id,
    x: game.player.x, y: game.player.y,
    anchor: true, state: "meeting", habit: "meeting", wait: 100,
    route: [{ x: game.player.x, y: game.player.y }],
  };
}

test("YOU speaks once on contact, stays quiet through sustained touch, and alternates after a new collision", () => {
  const g = playing();
  const person = bystander(g);
  g.crowd = [person];
  step(g, 0.025, {});
  assert.equal(g.hits, 1);
  assert.deepEqual(
    { kind: activeSpeech(g)?.kind, speakerId: activeSpeech(g)?.speakerId,
      text: activeSpeech(g)?.text },
    { kind: "contact", speakerId: 0, text: "おおっと！" },
  );
  const serial = g.speech.serial;
  for (let i = 0; i < 70; i++) step(g, 0.025, { left: true, right: true });
  assert.equal(g.hits, 1);
  assert.equal(g.speechSequence, serial);
  person.x = 400;
  step(g, 0.025, { left: true, right: true });
  person.x = g.player.x;
  person.y = g.player.y;
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.hits, 2, "a distinct touch still counts during speech cooldown");
  assert.equal(g.speechSequence, serial, "it does not create rapid new speech");
  person.x = 400;
  const nextTouch = Math.max(g.contactSpeechReadyAt + 0.05,
    g.worldTime + g.cooldown + 0.05);
  while (g.worldTime < nextTouch)
    step(g, 0.025, { left: true, right: true });
  assert.equal(activeSpeech(g), null);
  person.x = g.player.x;
  person.y = g.player.y;
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.hits, 3);
  assert.equal(activeSpeech(g)?.text, "うわっ！");
  assert.equal(g.contactSpeechCount, 2);
});

test("a friend says wait only after falling far behind, then rearms after reunion", () => {
  const g = playing(1);
  step(g, 0.025, { left: true, right: true });
  assert.equal(activeSpeech(g), null);
  const friend = g.party.members[0];
  g.stun = 0.3;
  friend.y += 115;
  step(g, 0.025, { left: true, right: true });
  assert.equal(activeSpeech(g)?.kind, "wait");
  assert.equal(activeSpeech(g)?.speakerId, friend.id);
  assert.equal(activeSpeech(g)?.text, "待って〜！");
  const first = g.speech.serial;
  for (let i = 0; i < 10; i++) step(g, 0.025, { left: true, right: true });
  assert.equal(g.speech.serial, first);
  friend.y = g.player.y + 30;
  g.stun = 0.3;
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.waitSpeechArmed, true);
  for (let i = 0; i < 220; i++) step(g, 0.025, { left: true, right: true });
  g.stun = 0.3;
  friend.y = g.player.y + 150;
  step(g, 0.025, { left: true, right: true });
  assert.equal(activeSpeech(g)?.kind, "wait");
  assert.equal(g.speech.serial, first + 1);
});

test("a red-entry warning belongs to the friend and replaces lower-priority chatter", () => {
  const g = playing(1);
  g.crowd = [bystander(g)];
  step(g, 0.025, {});
  assert.equal(activeSpeech(g)?.kind, "contact");
  g.crowd = [];
  g.stun = 0;
  g.player.y = 380;
  g.party = createParty(1, g.player);
  step(g, 0.025, {});
  assert.equal(g.traffic.violations, 1);
  assert.equal(activeSpeech(g)?.kind, "hazard");
  assert.equal(activeSpeech(g)?.speakerId, 1);
  assert.equal(activeSpeech(g)?.text, "赤信号だぞ！");
  const warning = g.speech.serial;
  g.stun = 0.3;
  g.party.members[0].y += 120;
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.speech.serial, warning, "separation does not cover a hazard");
  assert.equal(g.waitSpeechArmed, true, "waiting can speak after the warning ends");
});

test("a friend-only contact never puts YOU's words in the wrong mouth; pause and new stages reset speech", () => {
  const g = playing(1);
  const person = bystander(g);
  person.x = g.party.members[0].x;
  person.y = g.party.members[0].y;
  g.crowd = [person];
  step(g, 0.025, { left: true, right: true });
  assert.equal(g.lastContactMember, 1);
  assert.equal(activeSpeech(g), null);
  g.crowd = [];
  g.stun = 0.3;
  g.party.members[0].y += 120;
  step(g, 0.025, { left: true, right: true });
  assert.equal(activeSpeech(g)?.kind, "wait");
  g.phase = "paused";
  const frozen = structuredClone(g.speech);
  step(g, 0.05, {});
  assert.deepEqual(g.speech, frozen);
  assert.equal(createGame(1, 17).speech, null);
  assert.equal(createGame(2, 17).speechSequence, 0);
});
