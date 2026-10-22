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

test("five chapters have destination walkers, never timed flow gates", () => {
  assert.equal(STORY_STAGES.length, 5);
  for (let stage = 0; stage < 5; stage++) {
    const run = createRun(stage, 17);
    assert.equal(run.phase, "ready");
    assert.equal(run.story, STORY_STAGES[stage]);
    assert.ok(run._crowdSections.length >= 2);
    assert.equal(run._flowGates, undefined);
    assert.ok(run.crowd.every((person) => !person.flowGate));
    const walkers = run.crowd.filter((person) =>
      person.originName === "通りの手前" && person.state === "walking");
    assert.ok(walkers.length >= 2);
    const positions = walkers.map((person) => ({
      person, x: person.x, y: person.y,
    }));
    beginRun(run);
    tick(run, 2, { brake: true });
    const advancing = positions.filter(({ person, y }) => person.y < y - 12);
    assert.ok(advancing.length >= 2,
      `chapter ${stage} walkers advance north`);
    for (const { person, x, y } of advancing) {
      const dx = person.x - x, dy = person.y - y;
      assert.ok(Math.abs(dy) > 8, `person ${person.id} does not crab-walk`);
      assert.ok((dx * person.ux + dy * person.uy) /
        Math.hypot(dx, dy) > 0.5,
      `person ${person.id} faces their direction of travel`);
    }
  }
});

test("a diagonal crossing advances along its route while the player waits", () => {
  const run = createRun(0, 17);
  const crossing = run.crowd.find((person) =>
    person.flow === "crossing" && person.x === 190 &&
    person.y > run.startY - 200);
  assert.ok(crossing);
  const start = { x: crossing.x, y: crossing.y };
  beginRun(run);
  tick(run, 1, { brake: true });
  assert.ok(Math.abs(crossing.x - start.x) > 10);
  assert.ok(Math.abs(crossing.y - start.y) > 3);
  assert.equal(run.player.y, run.startY);
});

test("the later encounter merges diagonally toward its own destination", () => {
  for (const seed of [17, 1402485690, 21, 33]) {
    const run = createRun(0, seed);
    const person = run.crowd.find((p) => p.id === 4);
    assert.equal(person.flow, "crossing");
    assert.equal(person.destinationName, "商店街");
    assert.ok(run.crowd.every((other) => other === person || !other.active ||
      Math.hypot(person.x - other.x, person.y - other.y) >= 38),
    `seed ${seed} has safe initial spacing`);
    const start = { x: person.x, y: person.y };
    beginRun(run);
    tick(run, 2, { brake: true });
    const dx = person.x - start.x, dy = person.y - start.y;
    assert.ok(dx < -10 && dy < -15,
      `seed ${seed} advances northwest rather than pacing sideways`);
    assert.ok((dx * person.ux + dy * person.uy) / Math.hypot(dx, dy) > 0.5,
      "the body faces the merging walk");
  }
});

test("a late contact cannot push the player backward for seconds", () => {
  for (const seed of [17, 1402485690, 21, 33]) {
    const run = createRun(0, seed);
    beginRun(run);
    const twoSeconds = 40;
    const trail = [run.player.y];
    let largestRetreat = 0;
    let priorHits = 0;
    let contactedMerger = false;
    for (let n = 0; n < 600 && run.phase === "playing"; n++) {
      updateRun(run, 0.05);
      trail.push(run.player.y);
      if (trail.length > twoSeconds + 1) trail.shift();
      largestRetreat = Math.max(largestRetreat,
        run.player.y - Math.min(...trail));
      if (run.hits > priorHits) {
        const merger = run.crowd.find((person) => person.id === 4);
        contactedMerger ||= Math.hypot(run.player.x - merger.x,
          run.player.y - merger.y) < run.player.r + merger.r + 2;
        priorHits = run.hits;
      }
    }
    assert.ok(run.hits >= 1, `seed ${seed} exercises contact recovery`);
    if (seed !== 33) assert.ok(contactedMerger,
      `seed ${seed} exercises the later merging contact`);
    assert.equal(run.phase, "finished", `seed ${seed} remains traversable`);
    assert.ok(largestRetreat < 20,
      `seed ${seed} retreats ${largestRetreat.toFixed(1)} units in two seconds`);
    assert.ok(run.elapsed < 23,
      `seed ${seed} does not spend seconds trapped after contact`);
  }
});

test("each call pulse renews a response without cumulative shoving", () => {
  const run = createRun(0, 17);
  const commuter = run.crowd.find((person) => person.id === 12);
  run.player.y = commuter.y + 70;
  beginRun(run);
  const positions = run.crowd.map((person) => [person.x, person.y]);
  const viable = availableCallTargets(run);
  assert.ok(viable.includes(commuter.id));
  assert.deepEqual(run.crowd.map((person) => [person.x, person.y]), positions);
  updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.equal(run.events[0]?.kind, "call");
  assert.ok(run.events[0].count >= 1);
  const targetX = commuter.courtesy.targetX;
  const before = { x: commuter.x, y: commuter.y };
  updateRun(run, 0.05, { brake: true, call: true, callPulse: true });
  assert.equal(run.events[0]?.kind, "call");
  assert.equal(commuter.courtesy.targetX, targetX);
  assert.ok(commuter.y < before.y, "giving way keeps destination progress");
  assert.ok(Math.abs(commuter.x - before.x) <= 95 * 0.05 + 1e-9);
  assert.equal(run.callReady, true);
  updateRun(run, 0.05, { brake: true, call: true });
  const serial = run.callSerial;
  updateRun(run, 0.05, { brake: true, call: true });
  assert.equal(run.callSerial, serial);
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

test("the finale finishes on player arrival without waiting for followers", () => {
  const run = createRun(4, 17);
  beginRun(run);
  let successfulCalls = 0;
  for (let n = 0; n < 1000 && run.phase === "playing"; n++) {
    // Use existing controls: move along a side, return through the central
    // door, then take a side of the audience while calling to nearby people.
    const targetX = run.player.y > 900 ? 120 :
      run.player.y > 650 ? 240 : 360;
    const direction = Math.abs(targetX - run.player.x) < 2 ? 0 :
      Math.sign(targetX - run.player.x);
    const call = run.callReady && n % 8 === 0;
    updateRun(run, 0.05, {
      left: direction < 0, right: direction > 0, call, callPulse: call,
    });
    if (run.events.some((event) => event.kind === "call"))
      successfulCalls++;
  }
  assert.equal(run.phase, "finished");
  assert.ok(run.elapsed < 50, `finale elapsed ${run.elapsed}`);
  assert.ok(run.hits <= 4, `finale contacts ${run.hits}`);
  assert.ok(successfulCalls >= 3);
  assert.equal(run.party.members.length, 4);
  assert.ok(run.party.members.some((member) => !member.docked),
    "player completion does not await every friend");
});

test("two spaced encounters reward calls or readable side routes", () => {
  const play = (mode) => {
    const run = createRun(0, 17);
    beginRun(run);
    let calls = 0;
    const streaks = [];
    for (let n = 0; n < 650 && run.phase === "playing"; n++) {
      const input = mode === "call" && (n === 55 || n === 150) ||
        mode === "oneCall" && n === 55
        ? { call: true, callPulse: true } :
        mode === "steer" && run.player.y < 1050 && run.player.y > 760 &&
          run.player.x < 308 ? { right: true } :
        mode === "steer" && run.player.y <= 760 &&
          run.player.y > 400 && run.player.x > 173
          ? { left: true } : {};
      if (mode === "steer" && run.player.y <= 400 && run.player.x < 238)
        input.right = true;
      updateRun(run, 0.05, input);
      if (run.events.some((event) => event.kind === "call")) calls++;
      for (const event of run.events)
        if (event.kind === "closePass") streaks.push(event.streak);
    }
    return { run, calls, streaks };
  };
  const plain = play("plain"), oneCall = play("oneCall"),
    calling = play("call"), steering = play("steer");
  for (const outcome of [plain, oneCall, calling, steering])
    assert.equal(outcome.run.phase, "finished");
  assert.equal(oneCall.calls, 1);
  assert.equal(oneCall.run.hits, 1,
    "the later encounter is meaningful after an early call");
  assert.equal(calling.calls, 2);
  assert.ok(calling.run.hits < plain.run.hits);
  assert.ok(calling.run.elapsed < plain.run.elapsed);
  assert.equal(steering.run.hits, 0);
  assert.ok(steering.run.elapsed <= calling.run.elapsed + 0.05);
  assert.deepEqual(calling.streaks, [1, 2, 3]);
  assert.equal(calling.run.bestStreak, 3);
  assert.equal(calling.run.records[0].bestStreak, 3);
  assert.deepEqual(plain.streaks, [1],
    "contact prevents a second clean section without hiding the first");
  assert.equal(plain.run.bestStreak, 1);
  assert.equal(plain.run.records[0].bestStreak, 1);
});

test("alternate seeds retain clean call and steering routes through both encounters", () => {
  for (const seed of [1402485690, 21, 33]) {
    for (const mode of ["call", "steer"]) {
      const run = createRun(0, seed);
      beginRun(run);
      for (let n = 0; n < 500 && run.phase === "playing"; n++) {
        let input = {};
        if (mode === "call" && (n === 55 || n === 150))
          input = { call: true, callPulse: true };
        if (mode === "steer") {
          if (run.player.y < 1050 && run.player.y > 760 &&
              run.player.x < 308) input = { right: true };
          else if (run.player.y <= 760 && run.player.y > 400 &&
              run.player.x > 173) input = { left: true };
          else if (run.player.y <= 400 && run.player.x < 238)
            input = { right: true };
        }
        updateRun(run, 0.05, input);
      }
      assert.equal(run.phase, "finished", `seed ${seed}, ${mode}`);
      assert.equal(run.hits, 0, `seed ${seed}, ${mode}`);
      assert.ok(run.elapsed <= 14.5, `seed ${seed}, ${mode}`);
    }
  }
});

test("an empty stretch never awards a no-contact crowd pass", () => {
  const run = createRun(0, 17);
  beginRun(run);
  run.crowd = [];
  const section = run._crowdSections[0];
  run.player.y = section.y + 115;
  updateRun(run, 0.05, { brake: true });
  assert.equal(section.entered, true);
  assert.equal(section.populated, false);
  run.player.y = section.y - 66;
  updateRun(run, 0.05, { brake: true });
  assert.equal(section.completed, true);
  assert.ok(!run.events.some((event) => event.kind === "closePass"));
  assert.equal(run.cleanStreak, 0);
  assert.equal(run.bestStreak, 0);
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
  run.player.y = 86;
  updateRun(run, 0.05);
  assert.equal(run.phase, "finished");
  assert.deepEqual(run.records.map((record) => record.stage), [0]);
  assert.equal(run.totalElapsed, run.records[0].elapsed);
  assert.equal(run.records[0].bestStreak, 0);
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
