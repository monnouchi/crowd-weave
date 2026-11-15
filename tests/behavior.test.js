import test from "node:test";
import assert from "node:assert/strict";
import { makeCrowd, moveCrowd } from "../crowd.js";

const DT = 0.025;

// --- Part A: assignment, lanes, archetype behaviours ---------------------

test("archetype assignment is deterministic per seed and flow stays majority", () => {
  const a = makeCrowd(49, 40, 123, "station");
  const b = makeCrowd(49, 40, 123, "station");
  assert.equal(a.length, 49);
  assert.deepEqual(a.map((p) => p.behavior), b.map((p) => p.behavior));
  const counts = {};
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const p of makeCrowd(49, 40, seed, "station"))
      counts[p.behavior] = (counts[p.behavior] || 0) + 1;
  }
  for (const kind of ["phone", "stopper", "crosser", "against", "chat", "pair"])
    assert.ok(counts[kind] > 0, `expected some ${kind} walkers, got ${JSON.stringify(counts)}`);
  assert.ok(counts.flow > counts.phone + counts.stopper + counts.crosser +
    counts.against, "flow walkers must remain the majority layer");
});

test("flow lanes: entry bands separate along (west) from oncoming (east)", () => {
  // Lane-coherent exits were rejected (they erased verified routes), so the
  // lane model is asserted where it lives: the entry band / laneInfo centre
  // each walker respawns from and steers back into over repeated cycles.
  const along = [], opposing = [];
  for (const seed of [11, 12, 13]) {
    for (const p of makeCrowd(49, 40, seed, "station")) {
      if (p.flow === "along") along.push(p.laneInfo.centre);
      else if (p.flow === "opposing" && p.behavior !== "against")
        opposing.push(p.laneInfo.centre);
    }
  }
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(along.length > 10 && opposing.length > 10);
  assert.ok(mean(along) < mean(opposing) - 40,
    `lane bands must separate: along ${mean(along)} vs opposing ${mean(opposing)}`);
  const against = makeCrowd(49, 40, 11, "station")
    .filter((p) => p.behavior === "against");
  for (const p of against)
    assert.ok(p.laneInfo.centre < 295,
      "against walkers deliberately use the player's west band");
});

test("phone walkers are markedly slower than the flow pace", () => {
  const crowd = makeCrowd(49, 40, 21, "station");
  const phones = crowd.filter((p) => p.behavior === "phone");
  assert.ok(phones.length > 0);
  // The phone factor is 0.72 (calibrated so platoons capped by the
  // pace-of-person-ahead rule still drain at signal queues). It is pinned
  // structurally: fullPace records the uncut pace and pace is exactly the
  // factored value, strictly below the walker's own full pace.
  for (const p of phones) {
    assert.ok(p.fullPace > 0, "full pace recorded");
    assert.ok(
      Math.abs(p.pace - p.fullPace * 0.72) < 0.001,
      `phone pace ${p.pace} vs full ${p.fullPace}`,
    );
  }
});

test("stopper: every stop is preceded by a readable deceleration", () => {
  let stopper = null;
  for (const seed of [3, 4, 5, 6, 7]) {
    stopper = makeCrowd(49, 40, seed, "station")
      .find((p) => p.behavior === "stopper" && p.state === "walking");
    if (stopper) break;
  }
  assert.ok(stopper, "a walking stopper exists in some seed");
  const crowd = [stopper];
  let stoppedAt = -1, factorBefore = null, factorLate = null;
  for (let step = 0; step < 2400; step++) {
    moveCrowd(crowd, DT);
    if (stopper.stopPhase === "stopped" && stoppedAt < 0) {
      stoppedAt = step;
      break;
    }
    if (stopper.stopPhase === "decelerating") {
      if (factorBefore === null) factorBefore = stopper.stopFactor;
      factorLate = stopper.stopFactor;
    }
  }
  assert.ok(stoppedAt > 0, "the stopper eventually stops");
  assert.ok(factorBefore !== null && factorBefore > 0.5,
    "0.5s+ before the stop he is still mostly moving");
  assert.ok(factorLate !== null && factorLate < 0.35,
    "just before the stop he has clearly slowed (telegraph)");
});

test("crosser: head-turn telegraph precedes lateral crossing by >= 0.5s", () => {
  let crosser = null;
  for (const seed of [3, 4, 5, 6, 7, 8]) {
    crosser = makeCrowd(49, 40, seed, "station")
      .find((p) => p.behavior === "crosser" && p.state === "walking");
    if (crosser) break;
  }
  assert.ok(crosser, "a walking crosser exists in some seed");
  const crowd = [crosser];
  let telegraphAt = -1, crossingAt = -1;
  for (let step = 0; step < 2400; step++) {
    moveCrowd(crowd, DT);
    if (telegraphAt < 0 && crosser.crossingTelegraph) telegraphAt = step;
    if (crossingAt < 0 && crosser.crossPhase === "crossing") {
      crossingAt = step;
      break;
    }
  }
  assert.ok(telegraphAt >= 0 && crossingAt > telegraphAt);
  assert.ok((crossingAt - telegraphAt) * DT >= 0.5,
    `telegraph must lead crossing by >= 0.5s, got ${(crossingAt - telegraphAt) * DT}s`);
});

test("chat pairs face each other and stay put; walking pairs share a pace", () => {
  let chat = null, walkPair = null;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const crowd = makeCrowd(49, 40, seed, "station");
    chat = crowd.filter((p) => p.behavior === "chat");
    walkPair = crowd.filter((p) => p.group?.startsWith("walkpair-"));
    if (chat.length >= 2 && walkPair.length >= 2) break;
  }
  assert.ok(chat.length >= 2, "a chat pair formed");
  for (const p of chat) {
    const partner = chat.find((q) => q.id === p.chatPartner);
    assert.ok(partner, "chat partner is mutual");
    assert.equal(partner.chatPartner, p.id);
    assert.equal(p.state, "meeting");
    const d = Math.hypot(partner.x - p.x, partner.y - p.y);
    assert.ok(d < 95);
    const dot = p.ux * (partner.x - p.x) / d + p.uy * (partner.y - p.y) / d;
    assert.ok(dot > 0.5, `chat partners face each other (dot ${dot})`);
  }
  assert.ok(walkPair.length >= 2, "a walking pair formed");
  const [a, b] = walkPair;
  assert.equal(a.pace, b.pace);
  assert.ok(Math.abs(a.route.at(-1).x - b.route.at(-1).x) <= 45,
    "walking pair converges on nearby exit targets");
});

// --- Part B: negotiation --------------------------------------------------

function oncoming(behavior = "flow") {
  const base = makeCrowd(10, 40, 7, "station")
    .find((p) => p.flow === "opposing");
  return {
    ...base, behavior, flow: "opposing", habit: "direct",
    x: 240, y: 430, route: [{ x: 240, y: 900 }], leg: 0,
    state: "walking", active: true, courtesy: null, reaction: null,
    negotiate: undefined, negotiateLean: 0, group: undefined,
    anchor: false, vx: 0, vy: base.pace, ux: 0, uy: 1,
  };
}

function runEncounter(walker, script, maxSteps = 480) {
  const crowd = [walker];
  const trace = [];
  for (let step = 0; step < maxSteps; step++) {
    const ctx = script(step);
    moveCrowd(crowd, DT, null, [], ctx);
    trace.push({
      step, x: walker.x, y: walker.y,
      lean: walker.negotiateLean || 0,
      phase: walker.negotiate?.phase || null,
      mirrors: walker.negotiate?.mirrors || 0,
      side: walker.negotiate?.side || 0,
      dist: Math.hypot(walker.x - ctx.x, walker.y - ctx.y),
    });
    if (walker.y > ctx.y + 12) break;
  }
  return trace;
}

test("negotiation: a committed player is yielded to, lean before shift", () => {
  const walker = oncoming();
  const trace = runEncounter(walker, (step) => ({
    x: Math.max(200, 240 - step * 1.0), y: 600,
    commitSide: step < 40 ? -1 : 0, braking: false, still: false,
  }));
  const leanStep = trace.find((t) => t.lean === 1);
  assert.ok(leanStep, "walker leans toward his yield side (+x)");
  const shiftStep = trace.find((t) => Math.abs(t.x - 240) > 4);
  assert.ok(shiftStep && shiftStep.step > leanStep.step,
    "the lean telegraph precedes the lateral shift");
  assert.ok(trace.at(-1).y > 612, "walker passes the player");
  assert.ok(Math.min(...trace.map((t) => t.dist)) >= 25.5,
    "no body contact during the negotiated pass");
});

test("negotiation: mirror dance resolves when the player holds a line", () => {
  const walker = oncoming();
  const trace = runEncounter(walker, (step) => {
    if (step < 20) return { x: 240 - step * 1.2, y: 600, commitSide: -1, braking: false, still: false };
    if (step < 32) return { x: 216 + (step - 20) * 3, y: 600, commitSide: 1, braking: false, still: false };
    return { x: 252, y: 600, commitSide: 0, braking: false, still: false };
  });
  assert.ok(trace.some((t) => t.mirrors === 1), "one mirror happened");
  assert.ok(trace.some((t) => t.side === -1), "walker retargeted to the new opposite side");
  assert.ok(trace.at(-1).y > 612, "walker passes after the player holds");
  assert.ok(Math.min(...trace.map((t) => t.dist)) >= 25.5, "no contact");
});

test("negotiation: mirror overflow makes the walker hold his lane", () => {
  const walker = oncoming();
  const trace = runEncounter(walker, (step) => {
    const side = Math.floor(step / 12) % 2 === 0 ? -1 : 1;
    return { x: 240 + side * -30, y: 600, commitSide: side, braking: false, still: false };
  }, 130);
  const giveup = trace.find((t) => t.phase === "giveup");
  assert.ok(giveup, "walker gives up yielding after the mirror cap");
  assert.ok(giveup.mirrors <= 2, "mirrors never exceed the cap");
});

test("negotiation: braking lets the walker commit to the clear side", () => {
  const walker = oncoming();
  const trace = runEncounter(walker, () => ({
    x: 232, y: 600, commitSide: 0, braking: true, still: false,
  }));
  assert.ok(trace.some((t) => t.lean === 1),
    "walker leans east, away from the braked player's side");
  assert.ok(trace.at(-1).y > 612, "walker passes the braked player");
  assert.ok(Math.min(...trace.map((t) => t.dist)) >= 25.5, "no contact");
});

test("negotiation: phone walkers never negotiate and never deviate", () => {
  const walker = oncoming("phone");
  const trace = runEncounter(walker, (step) => ({
    x: Math.max(200, 240 - step), y: 600,
    commitSide: -1, braking: false, still: false,
  }), 200);
  assert.ok(trace.every((t) => t.phase === null && t.lean === 0),
    "no negotiation state, no lean");
  assert.ok(trace.every((t) => Math.abs(t.x - 240) < 3),
    "phone walker holds his straight line");
});

test("negotiation is deterministic for identical scripted inputs", () => {
  const script = (step) => ({
    x: Math.max(200, 240 - step), y: 600,
    commitSide: step < 40 ? -1 : 0, braking: false, still: false,
  });
  const a = runEncounter(oncoming(), script);
  const b = runEncounter(oncoming(), script);
  assert.deepEqual(
    a.map((t) => [Math.round(t.x * 1000), Math.round(t.y * 1000)]),
    b.map((t) => [Math.round(t.x * 1000), Math.round(t.y * 1000)]),
  );
});
