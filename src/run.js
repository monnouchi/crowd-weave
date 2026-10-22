import { createGame, step, STAGES, SCENES } from "../logic.js";

// Five short chapters of the same journey. The snippets are invitations from
// people already on the way, rather than instructions interrupting the run.
export const STORY_STAGES = Object.freeze([
  {
    title: "街の呼吸",
    place: "住宅街の角",
    message: "「角で待ってる。急がなくていいよ」",
    cue: "人の向きが変わる、その一拍を見よう。",
    clear: "ひとり目と合流。歩幅がそろった。",
  },
  {
    title: "改札の波",
    place: "最寄り駅",
    message: "「駅前にいるよ。人の流れがすごい！」",
    cue: "止まって待つと、道が開く瞬間がある。",
    clear: "駅を抜けた。声が少し近くなる。",
  },
  {
    title: "窓の明かり",
    place: "駅のカフェ",
    message: "「窓ぎわから見えてる。あと少し」",
    cue: "前の人に声をかけて、すきまをつくろう。",
    clear: "カフェで合流。今度はみんなで。",
  },
  {
    title: "雨の向こう",
    place: "会場前",
    message: "「雨が上がる前に来て。入口で待つよ」",
    cue: "信号と人の流れを、どちらも見よう。",
    clear: "会場の灯りが見えた。最後の扉へ。",
  },
  {
    title: "同じ音へ",
    place: "ステージ前",
    message: "「前奏が聴こえる。最前列で待ってる！」",
    cue: "人波の呼吸に合わせて、最前へ。",
    clear: "間に合った。みんなで、同じ音の中へ。",
  },
]);

const GATE_WAVES = [
  [865],
  [850],
  [1170, 910],
  [1790, 1490, 1230],
  [1480, 1160, 880],
];
const GATE_BASE = [218, 262];
const GATE_OPEN = [168, 312];
const GATE_PERIOD = [5.2, 4.9, 4.6, 4.4, 4.2];
const CALL_RECOVERY = 3.8;
const MAX_DT = 0.05;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function candidateY(run, desired, otherGates) {
  const choices = [];
  for (let delta = -90; delta <= 90; delta += 5) {
    const y = desired + delta;
    if (y < 180 || y > run.startY - 140) continue;
    if (otherGates.some((gate) => Math.abs(gate.y - y) < 175)) continue;
    if (run.crossings.some((crossing) =>
      y >= crossing.top - 95 && y <= crossing.bottom + 95)) continue;
    const clearance = Math.min(...run.crowd.filter((p) => p.active).flatMap(
      (p) => GATE_BASE.map((x) => Math.hypot(p.x - x, p.y - y)),
    ));
    choices.push({ y, clearance, score: clearance - Math.abs(delta) * 0.09 });
  }
  choices.sort((a, b) => b.score - a.score);
  return choices.find((choice) => choice.clearance >= 42)?.y ?? null;
}

function makeGatePerson(template, id, x, y, side, gateId) {
  return {
    ...template,
    id,
    x,
    y,
    r: 13,
    entry: { x, y },
    route: [{ x, y }],
    spot: { x, y },
    leg: 0,
    state: "meeting",
    habit: "meeting",
    active: true,
    anchor: true,
    flowGate: gateId,
    flowSide: side,
    courtesy: null,
    acknowledge: null,
    reaction: null,
    vx: 0,
    vy: 0,
    ux: -side,
    uy: 0,
    wait: 0,
    walk: 0,
    color: id % 4,
  };
}

function installGates(run) {
  const original = run.crowd.filter((person) => person.anchor)
    .sort((a, b) => a.x - b.x);
  const gates = [];
  if (original.length >= 2) {
    const y = (original[0].y + original[1].y) / 2;
    original.slice(0, 2).forEach((person, index) => {
      person.flowGate = 0;
      person.flowSide = index ? 1 : -1;
      person.flowOriginX = person.x;
    });
    gates.push({ id: 0, y, people: original.slice(0, 2),
      base: original.slice(0, 2).map((p) => p.x),
      open: [170, 310], offset: run.stage * 0.41,
      heldUntil: 0, entered: false, completed: false, clean: false });
  }
  for (const desired of GATE_WAVES[run.stage] || []) {
    if (original.length < 2) break;
    const y = candidateY(run, desired, gates);
    if (y === null) continue;
    const id = gates.length;
    const people = GATE_BASE.map((x, index) => makeGatePerson(
      original[index], 3000 + run.stage * 20 + id * 2 + index,
      x, y, index ? 1 : -1, id,
    ));
    run.crowd.push(...people);
    gates.push({ id, y, people, base: [...GATE_BASE],
      open: [...GATE_OPEN], offset: id * 1.71 + run.stage * 0.41,
      heldUntil: 0, entered: false, completed: false, clean: false });
  }
  return gates.sort((a, b) => b.y - a.y);
}

function cycle(gate, time, period) {
  const phase = ((time + gate.offset) / period) % 1;
  let open = 0;
  if (phase >= 0.22 && phase < 0.37)
    open = smooth((phase - 0.22) / 0.15);
  else if (phase >= 0.37 && phase < 0.68)
    open = 1;
  else if (phase >= 0.68 && phase < 0.83)
    open = 1 - smooth((phase - 0.68) / 0.15);
  const anticipation = phase >= 0.07 && phase < 0.37
    ? smooth((phase - 0.07) / 0.23) : 0;
  return { phase, open, anticipation };
}

function mayMoveGate(run, person, nextX, opening) {
  const next = { x: nextX, y: person.y };
  if (!opening && distance(next, run.player) < person.r + run.player.r + 12)
    return false;
  for (const member of run.party.members)
    if (!opening && distance(next, member) < person.r + member.r + 8)
      return false;
  return run.crowd.every((other) => other === person ||
    !other.active || other.flowGate === person.flowGate ||
    distance(next, other) >= person.r + other.r + 2);
}

function driveGates(run, dt) {
  const time = run.worldTime + dt;
  const period = GATE_PERIOD[run.stage];
  for (const gate of run._flowGates) {
    const rhythm = cycle(gate, time, period);
    const nearby = Math.abs(run.player.y - gate.y) < 55;
    const insideOpenGate = gate.people[1].x - gate.people[0].x > 90;
    const hold = time < gate.heldUntil || nearby && insideOpenGate &&
      run.player.x > gate.people[0].x - 22 &&
      run.player.x < gate.people[1].x + 22;
    const wanted = hold ? 1 : rhythm.open;
    gate.people.forEach((person, index) => {
      if (person.courtesy) return;
      const target = gate.base[index] +
        (gate.open[index] - gate.base[index]) * wanted;
      const delta = clamp(target - person.x, -98 * dt, 98 * dt);
      if (Math.abs(delta) < 0.001) {
        person.vx = 0;
        return;
      }
      const nextX = person.x + delta;
      if (!mayMoveGate(run, person, nextX, Math.abs(target - gate.base[index]) >
          Math.abs(person.x - gate.base[index]))) {
        person.vx = 0;
        return;
      }
      person.x = nextX;
      person.vx = delta / dt;
      person.ux = Math.sign(delta);
      person.walk += Math.abs(delta);
    });
  }
}

function updateFlow(run) {
  const gate = run._flowGates.find((g) =>
    g.y <= run.player.y + 65 && g.y >= run.player.y - 410);
  if (!gate) {
    run.flow = { active: false, phase: 0, open: 0,
      anticipation: 0, zoneY: 0, lane: 240, waveIndex: -1, beat: 0 };
    return;
  }
  const rhythm = cycle(gate, run.worldTime, GATE_PERIOD[run.stage]);
  const actual = clamp((gate.people[1].x - gate.people[0].x - 44) / 96, 0, 1);
  run.flow = {
    active: true,
    phase: rhythm.phase,
    open: actual,
    anticipation: rhythm.anticipation,
    zoneY: gate.y,
    zoneStartY: gate.y + 50,
    zoneEndY: gate.y - 50,
    lane: (gate.people[0].x + gate.people[1].x) / 2,
    waveIndex: gate.id,
    beat: Math.sin(rhythm.phase * Math.PI * 2),
  };
}

function updatePressure(run) {
  let pressure = 0;
  for (const p of run.crowd) {
    if (!p.active) continue;
    const ahead = run.player.y - p.y;
    const side = Math.abs(run.player.x - p.x);
    if (ahead < -12 || ahead > 170 || side > 105) continue;
    const proximity = 1 - Math.hypot(ahead * 0.9, side * 1.5) / 185;
    pressure = Math.max(pressure, proximity);
  }
  run.pressure = clamp(pressure, 0, 1);
}

// Mirror the courtesy action's feasibility checks without changing anyone's
// route or reserving a gap. The button can promise a response only when a
// person can really take a step aside at this instant.
export function availableCallTargets(run) {
  if (run.arriving || run.crossings.some((crossing) =>
    run.player.y >= crossing.top - 55 &&
    run.player.y <= crossing.bottom + 65)) return [];
  const ahead = run.crowd.filter((person) =>
    person.active && !person.animal &&
    person.y <= run.player.y - 8 &&
    person.y >= run.player.y - 105 &&
    Math.abs(person.x - run.player.x) < 68 &&
    !run.crossings.some((crossing) =>
      person.y >= crossing.top - 45 &&
      person.y <= crossing.bottom + 45) &&
    !(run.stage === 4 && person.y >= 640 && person.y <= 885));
  ahead.sort((a, b) => b.y - a.y);
  const targets = [];
  for (const person of ahead) {
    if (targets.length >= 4 || person.courtesy) continue;
    const side = person.x < run.player.x ? -1 : 1;
    for (const direction of [side, -side]) {
      const targetX = person.x + direction * 38;
      if (targetX < 55 || targetX > 425 ||
          Math.abs(targetX - run.player.x) <=
            Math.abs(person.x - run.player.x) ||
          run.crowd.some((other) => other !== person && other.active &&
            Math.hypot(other.x - targetX, other.y - person.y) <
              person.r + other.r + 5)) continue;
      targets.push(person.id);
      break;
    }
  }
  return targets;
}

function updateCallAvailability(run) {
  run.callTargets = availableCallTargets(run);
  run.callReady = run.phase === "playing" &&
    run.worldTime >= run.callReadyAt && run.callTargets.length > 0;
}

function syncTotals(run) {
  const recorded = run.records.some((record) => record.stage === run.stage);
  run.totalElapsed = run.records.reduce((sum, record) =>
    sum + record.elapsed, 0) + (recorded ? 0 : run.elapsed);
  run.totalHits = run.records.reduce((sum, record) =>
    sum + record.hits, 0) + (recorded ? 0 : run.hits);
}

export function createRun(stage = 0, seed = 1402485690, records = []) {
  if (!Number.isInteger(stage) || stage < 0 || stage >= STAGES.length)
    throw new RangeError("Invalid stage");
  const stageSeed = (seed + stage * 97) >>> 0;
  const run = createGame(stage, stageSeed);
  run.runSeed = seed >>> 0;
  run.records = records.map((record) => ({ ...record }));
  run.events = [];
  run.story = STORY_STAGES[stage];
  run.braking = false;
  run.speed = 0;
  run.pressure = 0;
  run._flowGates = installGates(run);
  updateFlow(run);
  updateCallAvailability(run);
  syncTotals(run);
  return run;
}

export function beginRun(run) {
  if (run.phase !== "ready") return false;
  run.phase = "playing";
  run.events = [{ kind: "start" }];
  updateCallAvailability(run);
  return true;
}

export function pauseRun(run) {
  if (run.phase !== "playing") return false;
  run.phase = "paused";
  run.speed = 0;
  run.events = [];
  updateCallAvailability(run);
  return true;
}

export function resumeRun(run) {
  if (run.phase !== "paused") return false;
  run.phase = "playing";
  run.events = [];
  updateCallAvailability(run);
  return true;
}

export function updateRun(run, dt, controls = {}) {
  run.events = [];
  if (run.phase !== "playing") return run;
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_DT);
  if (!dt) return run;
  const before = {
    y: run.player.y,
    hits: run.hits,
    callReadyAt: run.callReadyAt,
    callStarted: run.callRipple?.started,
    reunion: run.reunionSerial,
    violation: run.violationEvent?.id,
  };
  run.braking = !!controls.brake || !!(controls.left && controls.right);
  driveGates(run, dt);
  step(run, dt, {
    left: run.braking ? true : !!controls.left,
    right: run.braking ? true : !!controls.right,
    call: !!controls.call,
    hopEnabled: false,
  });
  run.speed = Math.max(0, (before.y - run.player.y) / dt);
  if (run.callRipple?.started !== before.callStarted) {
    if (run.callReadyAt > before.callReadyAt) {
      run.callReadyAt = run.worldTime + CALL_RECOVERY;
      const responders = run.crowd.filter((person) =>
        person.acknowledge?.remaining > 0).length;
      for (const gate of run._flowGates)
        if (gate.people.some((person) => person.courtesy || person.acknowledge))
          gate.heldUntil = run.worldTime + 2.3;
      run.events.push({ kind: "call", count: responders });
    } else run.events.push({ kind: "callEmpty" });
  }
  if (run.hits > before.hits) run.events.push({ kind: "contact" });
  if (run.reunionSerial > before.reunion)
    run.events.push({ kind: "reunion" });
  if (run.violationEvent?.id !== before.violation && run.violationEvent)
    run.events.push({ kind: "danger" });
  for (const gate of run._flowGates) {
    if (!gate.entered && run.player.y <= gate.y + 115 &&
        run.player.y > gate.y - 65) {
      gate.entered = true;
      gate.startHits = run.hits;
    }
    if (gate.entered && !gate.completed && run.player.y < gate.y - 65) {
      gate.completed = true;
      gate.clean = run.hits === gate.startHits;
      if (gate.clean && run.phase === "playing")
        run.events.push({ kind: "closePass", gate: gate.id });
    }
  }
  updateFlow(run);
  updatePressure(run);
  updateCallAvailability(run);
  if (run.phase === "finished") {
    if (!run.records.some((record) => record.stage === run.stage))
      run.records.push({ stage: run.stage, elapsed: run.elapsed, hits: run.hits });
    run.events.push({ kind: run.stage === 4 ? "finale" : "stageClear" });
  }
  syncTotals(run);
  return run;
}

export function advanceRun(run) {
  if (run.phase !== "finished" || run.stage >= STORY_STAGES.length - 1)
    return run;
  return createRun(run.stage + 1, run.runSeed, run.records);
}

export function retryRun(run) {
  return createRun(run.stage, run.runSeed, run.records.filter(
    (record) => record.stage < run.stage,
  ));
}

export function restartRun(seed = 1402485690) {
  return createRun(0, seed);
}

export { STAGES, SCENES };
