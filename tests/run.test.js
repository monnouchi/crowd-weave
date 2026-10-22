import test from "node:test";
import assert from "node:assert/strict";
import {
  STORY_STAGES,
  createRun,
  beginRun,
  updateRun,
  pauseRun,
  resumeRun,
  advanceRun,
  retryRun,
  restartRun,
  availableCallTargets,
} from "../src/run.js";

const tick = (run, seconds, controls = {}) => {
  for (let n = 0; n < Math.round(seconds / 0.05); n++)
    updateRun(run, 0.05, controls);
};

test("five chapters have a real, initially safe sequence of flow gates", () => {
  assert.equal(STORY_STAGES.length, 5);
  for (let stage = 0; stage < 5; stage++) {
    const run = createRun(stage, 17);
    assert.equal(run.phase, "ready");
    assert.equal(run.story, STORY_STAGES[stage]);
    assert.ok(run._flowGates.length >= 2);
    assert.ok(run._flowGates.every((gate) => gate.people.length === 2));
    assert.ok(run._flowGates.every((gate) =>
      gate.people.every((person) => run.crowd.includes(person))));
    for (const gate of run._flowGates)
      for (const person of gate.people)
        assert.ok(run.crowd.every((other) => other === person ||
          Math.hypot(person.x - other.x, person.y - other.y) >= 37));
  }
});

test("a flow gate visibly breathes open and closed while the player waits", () => {
  const run = createRun(0, 17);
  const gate = run._flowGates[0];
  const gap = () => gate.people[1].x - gate.people[0].x;
  assert.ok(gap() < 50);
  beginRun(run);
  tick(run, 0.65, { brake: true });
  assert.ok(gap() > 125, `open gap ${gap()}`);
  assert.ok(run.flow.open > 0.8);
  tick(run, 2, { brake: true });
  assert.ok(gap() < 60, `closed gap ${gap()}`);
  assert.ok(run.flow.open < 0.2);
  assert.equal(run.player.y, run.startY);
});

test("one polite call moves actual nearby people and held input fires once", () => {
  const run = createRun(0, 17);
  run.player.y = run._flowGates[0].y + 50;
  beginRun(run);
  const positions = run.crowd.map((person) => [person.x, person.y]);
  const viable = availableCallTargets(run);
  assert.ok(viable.includes(run._flowGates[0].people[0].id));
  assert.ok(viable.includes(run._flowGates[0].people[1].id));
  assert.deepEqual(run.crowd.map((person) => [person.x, person.y]), positions);
  updateRun(run, 0.05, { brake: true });
  assert.equal(run.callReady, true);
  assert.ok(run.callTargets.length >= 2);
  updateRun(run, 0.05, { brake: true, call: true });
  assert.equal(run.events[0]?.kind, "call");
  assert.ok(run.events[0].count >= 2);
  assert.equal(run.callReady, false);
  assert.ok(run._flowGates[0].heldUntil > run.worldTime);
  assert.ok(run._flowGates[0].people.every((person) =>
    person.acknowledge || person.courtesy));
  const readyAt = run.callReadyAt;
  updateRun(run, 0.05, { brake: true, call: true });
  assert.equal(run.callReadyAt, readyAt);
  assert.ok(!run.events.some((event) => event.kind === "call"));
});

test("call affordance stays dark at a crossing or when nobody can give way", () => {
  const road = createRun(1, 17);
  road.player.y = road.crossings[0].bottom + 35;
  beginRun(road);
  updateRun(road, 0.05, { brake: true });
  assert.deepEqual(road.callTargets, []);
  assert.equal(road.callReady, false);

  const edge = createRun(0, 17);
  edge.player.x = 100;
  edge.player.y = 600;
  edge.crowd = [{ ...edge.crowd[0], id: 9099, x: 55, y: 550,
    active: true, courtesy: null }];
  beginRun(edge);
  updateRun(edge, 0.05, { brake: true });
  assert.deepEqual(edge.callTargets, []);
  assert.equal(edge.callReady, false);
});

test("deliberate side route and timely calls keep the finale moving", () => {
  const run = createRun(4, 17);
  beginRun(run);
  let previousCall = false;
  let successfulCalls = 0;
  for (let n = 0; n < 1000 && run.phase === "playing"; n++) {
    // Use existing controls: move along a side, return through the central
    // door, then take a side of the audience while calling to nearby people.
    const targetX = run.player.y > 900 ? 120 :
      run.player.y > 650 ? 240 : 360;
    const direction = Math.abs(targetX - run.player.x) < 2 ? 0 :
      Math.sign(targetX - run.player.x);
    const nearby = run.crowd.some((person) => person.active &&
      person.y < run.player.y - 10 &&
      person.y > run.player.y - 105 &&
      Math.abs(person.x - run.player.x) < 62);
    const call = nearby && run.worldTime >= run.callReadyAt && !previousCall;
    updateRun(run, 0.05, {
      left: direction < 0, right: direction > 0, call,
    });
    if (run.events.some((event) => event.kind === "call"))
      successfulCalls++;
    previousCall = call;
  }
  assert.equal(run.phase, "finished");
  assert.ok(run.elapsed < 50, `finale elapsed ${run.elapsed}`);
  assert.ok(run.hits <= 4, `finale contacts ${run.hits}`);
  assert.ok(successfulCalls >= 3);
  assert.equal(run.party.members.length, 4);
  assert.ok(run.party.members.every((member) => member.docked));
});

test("timing the call changes a stage-zero race outcome", () => {
  const plain = createRun(0, 17);
  beginRun(plain);
  for (let n = 0; n < 650 && plain.phase === "playing"; n++)
    updateRun(plain, 0.05);

  const calling = createRun(0, 17);
  beginRun(calling);
  let calls = 0;
  let previousCall = false;
  for (let n = 0; n < 650 && calling.phase === "playing"; n++) {
    const distance = calling.flow.active
      ? calling.player.y - calling.flow.zoneY : Infinity;
    const call = distance > 0 && distance < 100 &&
      calling.flow.open < 0.55 &&
      calling.worldTime >= calling.callReadyAt && !previousCall;
    updateRun(calling, 0.05, { call });
    if (calling.events.some((event) => event.kind === "call")) calls++;
    previousCall = call;
  }
  assert.equal(plain.phase, "finished");
  assert.equal(calling.phase, "finished");
  assert.ok(calls >= 1);
  assert.ok(calling.hits < plain.hits,
    `call hits ${calling.hits}, unassisted ${plain.hits}`);
  assert.ok(calling.elapsed < plain.elapsed);
});

test("pause freezes simulation; long frame is clamped; results advance and retry", () => {
  const run = createRun(0, 17);
  beginRun(run);
  updateRun(run, 8, { brake: true });
  assert.ok(run.worldTime <= 0.05 + 1e-9);
  assert.equal(pauseRun(run), true);
  const snapshot = {
    time: run.worldTime,
    elapsed: run.elapsed,
    crowd: run.crowd.map((person) => [person.x, person.y]),
  };
  updateRun(run, 8, { right: true, call: true });
  assert.equal(run.worldTime, snapshot.time);
  assert.equal(run.elapsed, snapshot.elapsed);
  assert.deepEqual(run.crowd.map((person) => [person.x, person.y]),
    snapshot.crowd);
  assert.equal(resumeRun(run), true);

  // Stage zero has no followers; placing the player at the entrance exercises
  // the same finish and record path used after ordinary traversal.
  run.crowd = [];
  run._flowGates = [];
  run.player.y = 86;
  updateRun(run, 0.05);
  assert.equal(run.phase, "finished");
  assert.deepEqual(run.records.map((record) => record.stage), [0]);
  assert.equal(run.totalElapsed, run.records[0].elapsed);
  assert.equal(run.events.at(-1).kind, "stageClear");
  updateRun(run, 0.05);
  assert.deepEqual(run.events, []);

  const next = advanceRun(run);
  assert.equal(next.stage, 1);
  assert.equal(next.phase, "ready");
  assert.deepEqual(next.records, run.records);
  assert.equal(next.totalElapsed, run.elapsed);
  next.phase = "gameover";
  const retry = retryRun(next);
  assert.equal(retry.stage, 1);
  assert.equal(retry.phase, "ready");
  assert.deepEqual(retry.records, run.records);
  assert.deepEqual(restartRun(31).records, []);
});
