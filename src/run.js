import { createGame, step, STAGES, SCENES } from "../logic.js";
import { availableCourtesyTargets } from "../crowd.js";

// Five short chapters of the same journey. The snippets are invitations from
// people already on the way, rather than instructions interrupting the run.
export const STORY_STAGES = Object.freeze([
  {
    title: "街の呼吸",
    place: "住宅街の角",
    message: "「角で待ってる。急がなくていいよ」",
    cue: "人の向きが変わる、その一拍を見よう。",
    clear: "ひとり目と合流。次の道へ。",
  },
  {
    title: "改札の波",
    place: "最寄り駅",
    message: "「駅前にいるよ。人の流れがすごい！」",
    cue: "止まって待つと、道が開く瞬間がある。",
    clear: "駅を抜けた。次の待ち合わせへ。",
  },
  {
    title: "窓の明かり",
    place: "駅のカフェ",
    message: "「窓ぎわから見えてる。あと少し」",
    cue: "前の人に声をかけて、すきまをつくろう。",
    clear: "カフェに到着。次は会場へ。",
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
    clear: "間に合った。最前列に立った。",
  },
]);

// These are scoring stretches, not actors or moving walls. Existing seeded
// walkers pass through them on routes to destinations of their own.
const BUSY_STRETCHES = [
  [980, 760], [1030, 890, 730], [1330, 1150, 920],
  [1970, 1750, 1500, 1260], [1580, 1270, 980],
];
const MAX_DT = 0.05;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function redirect(person, x, y, run) {
  person.anchor = false;
  person.habit = "direct";
  person.state = "walking";
  person.wait = 0;
  person.flow = "along";
  person.origin = "south";
  person.destination = "north";
  person.originName = "通りの手前";
  person.destinationName = run.story.place;
  const destinationX = clamp(x, 70, 410);
  person.route = [
    { x: destinationX, y: Math.max(105, y) },
    { x: destinationX, y: -80 },
  ];
  person.entry = { x: person.x, y: run.startY + 75 };
  person.leg = 0;
  const dx = destinationX - person.x;
  const dy = person.route[0].y - person.y;
  const length = Math.hypot(dx, dy) || 1;
  person.ux = dx / length;
  person.uy = dy / length;
  person.vx = person.ux * person.pace;
  person.vy = person.uy * person.pace;
}

function sendAcrossFlow(person, run) {
  // One resident walks diagonally from the side toward the shops. The player
  // reads a merging path in the later stretch, distinct from overtaking the
  // first commuter. Keeping the person northbound avoids head-on body shoves.
  const positions = [
    [340, 670], [350, 640], [330, 700],
    [360, 615], [320, 725], [345, 585],
  ];
  const opening = positions.find(([x, y]) => run.crowd.every((other) =>
    other === person || !other.active ||
    Math.hypot(other.x - x, other.y - y) >= 42));
  if (!opening) return false;
  const [x, y] = opening;
  const target = { x: 170, y: 300 };
  const dx = target.x - x, dy = target.y - y;
  const distance = Math.hypot(dx, dy);
  Object.assign(person, {
    x, y, anchor: false, habit: "direct", state: "walking", wait: 0,
    flow: "crossing", origin: "east", destination: "north",
    originName: "住宅街の東側", destinationName: "商店街",
    route: [target, { x: 170, y: -80 }],
    entry: { x: 340, y: run.startY + 75 }, leg: 0,
    ux: dx / distance, uy: dy / distance,
    vx: dx / distance * person.pace,
    vy: dy / distance * person.pace,
  });
  return true;
}

function naturalizeCrowd(run) {
  const anchors = run.crowd.filter((person) => person.anchor)
    .sort((a, b) => a.x - b.x);
  const anchorY = anchors.length
    ? anchors.reduce((sum, person) => sum + person.y, 0) / anchors.length
    : null;
  // The pair inherited from the old overhead game now walks toward the
  // destination. Their paths diverge *while advancing*, never in a timed
  // left-right oscillation made solely to obstruct the player.
  anchors.forEach((person, index) => {
    if (run.stage === 0 && index === 0 && sendAcrossFlow(person, run))
      return;
    redirect(person, person.x + (index ? 72 : -72),
      person.y - 210, run);
  });
  for (const person of run.crowd) {
    // A real walker notices somebody approaching from behind. The ordinary
    // crowd solver uses this reference only for the first-person run.
    person.awarePlayer = run.player;
    if (person.anchor || anchors.includes(person)) continue;
    if (person.environment !== "party" &&
        person.state === "meeting" &&
        person.x > 125 && person.x < 355 &&
        person.y > 160 && person.y < run.startY - 130) {
      // The first street has one slower commuter already walking up the
      // center. Passing them teaches the difference between reading a gap,
      // steering around it, and asking for room. They keep moving north.
      if (run.stage === 0 && person.y > run.startY - 330 &&
          run.crowd.every((other) => other === person || !other.active ||
            Math.hypot(other.x - 241, other.y - person.y) > 38)) {
        person.x = 241;
        redirect(person, 255, person.y - 165, run);
        continue;
      }
      const side = person.x < 240 ? -1 : 1;
      redirect(person, person.x + side * 95, person.y - 165, run);
      continue;
    }
    if (person.flow !== "crossing" || person.state !== "walking")
      continue;
    const target = person.route[person.leg];
    if (!target) continue;
    const dx = target.x - person.x;
    if (Math.abs(dx) < 75 ||
        Math.abs(target.y - person.y) >= Math.abs(dx) * .28) continue;
    const direction = person.id % 4 < 2 ? -1 : 1;
    let destinationY = clamp(person.y + direction *
      Math.min(190, Math.max(95, Math.abs(dx) * .38)),
    115, run.startY + 45);
    for (const crossing of run.crossings)
      if (destinationY > crossing.top - 45 &&
          destinationY < crossing.bottom + 45)
        destinationY = direction < 0
          ? crossing.top - 50 : crossing.bottom + 50;
    target.y = destinationY;
    const dy = target.y - person.y;
    const length = Math.hypot(dx, dy) || 1;
    person.ux = dx / length;
    person.uy = dy / length;
    person.vx = person.ux * person.pace;
    person.vy = person.uy * person.pace;
  }
  return [anchorY, ...(BUSY_STRETCHES[run.stage] || [])]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a)
    .map((y, id) => ({ id, y, entered: false, completed: false,
      populated: false, startHits: 0 }));
}

function updateFlow(run) {
  const people = run.crowd.filter((person) =>
    person.active && !person.animal &&
    person.y < run.player.y - 7 &&
    person.y > run.player.y - 230 &&
    Math.abs(person.x - run.player.x) < 108)
    .sort((a, b) => b.y - a.y);
  const nearest = people[0];
  if (!nearest) {
    run.flow = { active: false, phase: 0, open: 1,
      anticipation: 0, zoneY: 0, lane: run.player.x,
      waveIndex: -1, beat: 0 };
    return;
  }
  const clearance = Math.min(...people
    .filter((person) => Math.abs(person.y - nearest.y) < 65)
    .map((person) =>
      Math.abs(person.x - run.player.x) - (person.r + run.player.r)));
  const futureSide = Math.abs(nearest.x + nearest.vx * .55 - run.player.x);
  const currentSide = Math.abs(nearest.x - run.player.x);
  run.flow = {
    active: true,
    phase: 0,
    open: clamp((clearance + 10) / 42, 0, 1),
    anticipation: clamp((futureSide - currentSide) / 24, 0, 1),
    zoneY: nearest.y,
    zoneStartY: nearest.y + 45,
    zoneEndY: nearest.y - 45,
    lane: run.player.x,
    waveIndex: nearest.id,
    beat: 0,
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
  return availableCourtesyTargets(run.crowd, run.player,
    run.crossings, run.stage).map(({ person }) => person.id);
}

function updateCallAvailability(run) {
  run.callTargets = availableCallTargets(run);
  run.callReady = run.phase === "playing" && run.callTargets.length > 0;
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
  run.cleanStreak = 0;
  run.bestStreak = 0;
  run._crowdSections = naturalizeCrowd(run);
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
    callSerial: run.callSerial,
    reunion: run.reunionSerial,
    violation: run.violationEvent?.id,
  };
  run.braking = !!controls.brake || !!(controls.left && controls.right);
  step(run, dt, {
    left: run.braking ? true : !!controls.left,
    right: run.braking ? true : !!controls.right,
    call: !!controls.call,
    callPulse: !!controls.callPulse,
    hopEnabled: false,
  });
  run.speed = Math.max(0, (before.y - run.player.y) / dt);
  if (run.callSerial !== before.callSerial)
    run.events.push(run.callResponseCount > 0
      ? { kind: "call", count: run.callResponseCount }
      : { kind: "callEmpty" });
  if (run.hits > before.hits) {
    run.cleanStreak = 0;
    run.events.push({ kind: "contact" });
  }
  if (run.reunionSerial > before.reunion)
    run.events.push({ kind: "reunion" });
  if (run.violationEvent?.id !== before.violation && run.violationEvent)
    run.events.push({ kind: "danger" });
  for (const section of run._crowdSections) {
    if (!section.entered && run.player.y <= section.y + 115 &&
        run.player.y > section.y - 65) {
      section.entered = true;
      section.startHits = run.hits;
      section.populated = run.crowd.filter((person) =>
        person.active && Math.abs(person.y - section.y) < 125).length >= 2;
    }
    if (section.entered && !section.completed &&
        run.player.y < section.y - 65) {
      section.completed = true;
      section.clean = run.hits === section.startHits;
      const roadNear = run.crossings.some((crossing) =>
        section.y >= crossing.top - 120 &&
        section.y <= crossing.bottom + 120);
      if (section.clean && section.populated &&
          !roadNear && run.phase === "playing") {
        run.cleanStreak++;
        run.bestStreak = Math.max(run.bestStreak, run.cleanStreak);
        run.events.push({ kind: "closePass", section: section.id,
          streak: run.cleanStreak });
      }
    }
  }
  updateFlow(run);
  updatePressure(run);
  updateCallAvailability(run);
  if (run.phase === "finished") {
    if (!run.records.some((record) => record.stage === run.stage))
      run.records.push({ stage: run.stage, elapsed: run.elapsed,
        hits: run.hits, bestStreak: run.bestStreak });
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
