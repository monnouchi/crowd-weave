import {
  createTraffic,
  trafficSpec,
  updateTraffic,
  constrainTraffic,
  trafficSpecs,
  vehicleContact,
} from "./traffic.js";
import { createParty, moveParty, partyArrived } from "./party.js";
import { BODY_GAP, resolvePlayerMove, followerProgress } from "./bodies.js";
import {
  makeCrowd,
  extendJourney,
  moveCrowd,
  visiblePerson,
  reactToContact,
  makeRoomForFollower,
} from "./crowd.js";
export const W = 480,
  H = 680,
  START = { x: 240, y: 1165 },
  GOAL = { x: 175, y: 20, w: 130, h: 65 };
export const FRONT_BARRIER_Y = 20;
export function goalFor(stage) {
  return stage === 4 ? { x: 95, y: 20, w: 290, h: 65 } : GOAL;
}
export function arrivalPoint(stage, player) {
  return { x: stage === 4 ? player.x : 240, y: 84 };
}
export function setArrivalSlots(party, stage, player) {
  if (stage === 4 && !party.dockSlots) {
    const x = player.x;
    party.dockSlots = [
      { x: x - 30, y: 84 },
      { x: x + 30, y: 84 },
      { x: x - 30, y: 54 },
      { x: x + 30, y: 54 },
    ].map((slot, i) =>
      i >= 2 && Math.abs(slot.x - 240) < 26
        ? {
            ...slot,
            x: slot.x < 240 || (slot.x === 240 && i === 2) ? 214 : 266,
          }
        : slot,
    );
  }
}
// Entropy is sampled once per playthrough, never in the simulation loop.
export function nextRunSeed(previous, entropy) {
  const candidate = entropy >>> 0;
  return candidate === previous ? (candidate + 1) >>> 0 : candidate;
}
export function seedForRun(runSeed, stage) {
  let value = (runSeed + Math.imul(stage + 1, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}
export const MEETING_PARTNER = Object.freeze({
  x: 240,
  y: 54,
  r: 12,
  partner: true,
  state: "waiting",
  ux: 0,
  uy: 1,
  walk: 0,
});
export const STAGES = [
  { name: "ひとりで出発", count: 14, speed: 30, startY: 1165, baseCrowd: 6 },
  { name: "住宅街から最寄り駅へ", count: 24, speed: 35, startY: 1165, baseCrowd: 12 },
  { name: "駅のカフェで合流", count: 49, speed: 40, startY: 1505, baseCrowd: 31 },
  { name: "会場前のにぎわい", count: 54, speed: 45, startY: 2165, baseCrowd: 30 },
  { name: "ライブの最前方へ", count: 58, speed: 50, startY: 1805, baseCrowd: 40 },
];
export const SCENES = [
  {
    place: "住宅街の角",
    landmark: "home",
    environment: "residential",
    purpose: "家を出て、住宅街の角で友だちと合流",
    intro: "家をひとりで出発。住宅街の角で友だちに会おう。",
    bubble: "一緒に行こう！",
    arrival: "最初の友だちと合流。駅へ出発！",
    shirt: "#d5ab53",
    visualScale: 1,
    floor: "#eeecdc",
    backgroundCount: 2,
  },
  {
    place: "最寄り駅の入口",
    landmark: "station",
    environment: "station",
    purpose: "住宅街を抜け、最寄り駅の入口へ",
    intro: "住宅街を抜けよう。最寄り駅の入口でもうひとりと合流。",
    bubble: "こっちだよ！",
    arrival: "駅の入口で合流。カフェに向かおう！",
    shirt: "#83a9bb",
    visualScale: 1,
    floor: "#e7ece1",
    backgroundCount: 3,
  },
  {
    place: "駅のカフェ",
    landmark: "cafe",
    environment: "cafe",
    purpose: "横切る人の流れを見ながら、駅のカフェへ",
    intro: "駅の人の流れを渡って、カフェにいる友だちと合流しよう。",
    bubble: "席、空いてるよ！",
    arrival: "カフェで合流。次は会場の最寄り駅！",
    shirt: "#cc8b74",
    visualScale: 1,
    floor: "#e9ecdf",
    backgroundCount: 6,
  },
  {
    place: "郊外の会場前",
    landmark: "venue",
    environment: "venue",
    weather: "rain",
    purpose: "雨の駅前から大通りと公園を抜け、郊外の会場へ",
    intro: "郊外の会場へ。4車線の大通りと公園側の横断歩道を渡ろう。",
    bubble: "雨、大丈夫？",
    arrival: "郊外の会場前で合流。いよいよ中へ！",
    shirt: "#9788a9",
    visualScale: 1,
    floor: "#dfe7e5",
    backgroundCount: 6,
  },
  {
    place: "ステージ前",
    landmark: "party",
    environment: "party",
    purpose: "ロビーでチケットを確認し、ホールの最前列へ",
    intro: "受付と大きな扉を通り、観客のすきまを縫ってステージ前へ。",
    bubble: "ここから一緒に楽しもう！",
    arrival: "ステージ前に到着。みんなでライブを楽しもう！",
    shirt: "#c4a46c",
    visualScale: 1,
    floor: "#e6e0e9",
    backgroundCount: 8,
  },
].map((scene) => ({ ...scene, targetKind: "friend" }));
function extendVenue(crowd, crossings) {
  const project = (y) => (y < 0 ? y : y > 680 ? 1260 : y * 1.75);
  for (const p of crowd) {
    p.y = project(p.y);
    p.entry.y = project(p.entry.y);
    p.route = p.route.map((q) => ({ ...q, y: project(q.y) }));
    p.boundsH = 1180;
    for (const q of p.route)
      for (const t of crossings)
        if (q.y > t.top - 25 && q.y < t.bottom + 25)
          q.y = q.y - t.top < t.bottom - q.y ? t.top - 50 : t.bottom + 50;
    if (p.habit === "queuing") {
      p.x = 415;
      p.y = 1010 + (p.id - 1) * 42;
      p.route[0] = { x: 415, y: 1010 };
    }
    if (p.id === 7) {
      p.x = 65;
      p.y = 975;
      p.route[0] = { x: 65, y: 975 };
    }
  }
  const placed = [],
    handled = new Set();
  const valid = (points) =>
    points.every(
      (p) =>
        p.x >= 45 &&
        p.x <= 435 &&
        !crossings.some((t) => p.y > t.top - 25 && p.y < t.bottom + 25) &&
        placed.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 38),
    );
  for (const p of crowd) {
    if (handled.has(p.id)) continue;
    const group = p.group ? crowd.filter((q) => q.group === p.group) : [p];
    const center = {
      x: group.reduce((n, q) => n + q.x, 0) / group.length,
      y: group.reduce((n, q) => n + q.y, 0) / group.length,
    };
    let offsets = group.map((q) => ({ x: q.x - center.x, y: q.y - center.y }));
    if (group.length === 2) {
      const dx = group[1].x - group[0].x,
        dy = group[1].y - group[0].y,
        d = Math.hypot(dx, dy) || 1;
      offsets = [
        { x: (-dx / d) * 22.5, y: (-dy / d) * 22.5 },
        { x: (dx / d) * 22.5, y: (dy / d) * 22.5 },
      ];
    }
    const candidates = [center];
    for (const y of [
      145, 200, 250, 425, 480, 550, 620, 690, 735, 970, 1030, 1060,
    ])
      for (let x = 55; x < 430; x += 42) candidates.push({ x, y });
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.y - center.y) -
        Math.hypot(b.x - center.x, b.y - center.y),
    );
    const position = candidates.find((v) =>
      valid(offsets.map((o) => ({ x: v.x + o.x, y: v.y + o.y }))),
    );
    if (!position) throw new Error("No safe venue placement");
    group.forEach((q, i) => {
      q.x = position.x + offsets[i].x;
      q.y = position.y + offsets[i].y;
      placed.push(q);
      handled.add(q.id);
    });
  }
  for (const p of crowd) {
    const t = p.route[p.leg],
      d = Math.hypot(t.x - p.x, t.y - p.y) || 1;
    p.ux = (t.x - p.x) / d;
    p.uy = (t.y - p.y) / d;
    p.vx = p.state === "walking" ? p.ux * p.pace : 0;
    p.vy = p.state === "walking" ? p.uy * p.pace : 0;
  }
}
const PASSING_PEOPLE = [
  { ids: [4, 5], preferredY: 455, minY: 220, maxY: 550 },
  { ids: [9, 10], preferredY: 500, minY: 395, maxY: 560 },
  { ids: [26, 27], preferredY: 545, minY: 480, maxY: 610 },
  { ids: [18, 19], preferredY: 1010, minY: 955, maxY: 1060 },
  { ids: [33, 34], preferredY: 630, minY: 590, maxY: 650 },
];
function placePassingPair(crowd, stage) {
  const { ids, preferredY, minY, maxY } = PASSING_PEOPLE[stage],
    people = ids.map((id) => crowd[id]),
    centers = [220, 260],
    others = crowd.filter((p) => !people.includes(p) && p.active),
    nearPair = (p, y, limit) =>
      centers.some((x) => Math.hypot(p.x - x, p.y - y) < limit),
    clearance = (y) =>
      Math.min(
        ...others.flatMap((p) =>
          centers.map((x) => Math.hypot(p.x - x, p.y - y)),
        ),
      ),
    candidates = Array.from(
      { length: Math.floor((maxY - minY) / 4) + 1 },
      (_, i) => minY + i * 4,
    ).sort((a, b) => Math.abs(a - preferredY) - Math.abs(b - preferredY)),
    clearY = candidates.find((value) => clearance(value) >= 39),
    y =
      clearY ??
      [...candidates].sort(
        (a, b) =>
          others.filter((p) => nearPair(p, a, 39)).length -
            others.filter((p) => nearPair(p, b, 39)).length ||
          clearance(b) - clearance(a),
      )[0];
  // A rare seed can fill every central starting slot. Move only the few
  // conflicting walkers to open space near the edge before the run begins.
  for (const q of others.filter((p) => nearPair(p, y, 39))) {
    const options = [];
    for (let cy = minY; cy <= maxY; cy += 12)
      for (const x of [60, 420, 80, 400, 100, 380, 120, 360, 140, 340])
        options.push({ x, y: cy });
    options.sort(
      (a, b) =>
        Math.hypot(a.x - q.x, a.y - q.y) -
        Math.hypot(b.x - q.x, b.y - q.y),
    );
    const spot = options.find(
      ({ x, y: cy }) =>
        centers.every((center) => Math.hypot(x - center, cy - y) >= 44) &&
        crowd.every(
          (other) =>
            other === q ||
            people.includes(other) ||
            !other.active ||
            Math.hypot(other.x - x, other.y - cy) >= 39,
        ),
    );
    if (!spot) throw new Error("No space beside passing person");
    Object.assign(q, spot);
  }
  people.forEach((person, index) => {
    const x = centers[index];
    Object.assign(person, {
      x,
      y,
      anchor: true,
      habit: "meeting",
      state: "meeting",
      pauseDuration: 0,
      wait: 0,
      route: [{ x, y }],
      leg: 0,
      vx: 0,
      vy: 0,
      ux: index ? -1 : 1,
      uy: 0,
    });
    if (person.spot) person.spot = { x, y };
  });
}
export function createGame(stage = 0, seed = 1402485690 + stage * 97) {
  const config = STAGES[stage];
  const scene = SCENES[stage];
  const start = { x: START.x, y: config.startY };
  const crossings = trafficSpecs(stage).map((spec) =>
    createTraffic(stage, spec),
  );
  const crowd = makeCrowd(
    config.count,
    config.speed,
    seed,
    scene.environment,
    trafficSpec(stage),
  );
  if (stage === 3) extendVenue(crowd, crossings);
  extendJourney(crowd, stage, seed, config);
  placePassingPair(crowd, stage);
  return {
    stage,
    phase: "ready",
    startY: start.y,
    worldHeight: config.startY + 55,
    player: { ...start, r: 12 },
    party: createParty(stage, start),
    arriving: false,
    lastContactMember: 0,
    memberHits: Array(stage + 1).fill(0),
    scene,
    meetingPartner: {
      ...MEETING_PARTNER,
      appearanceId: stage + 3,
      shirt: scene.shirt,
      targetKind: scene.targetKind,
      visualScale: scene.visualScale,
    },
    elapsed: 0,
    worldTime: 0,
    crossings,
    traffic: crossings[0] || null,
    hits: 0,
    cooldown: 0,
    stun: 0,
    lastContactId: null,
    touchingIds: [],
    seed,
    crowd,
  };
}
export function step(g, dt, input) {
  if (g.phase !== "playing") return;
  dt = Math.max(0, Math.min(dt, 0.05));
  g.elapsed += dt;
  g.worldTime += dt;
  const previousTeam = [g.player, ...g.party.members].map((p) => ({ ...p }));
  updateTraffic(g, dt);
  moveCrowd(g.crowd, dt, g.crossings);
  const people = g.crowd.filter(visiblePerson),
    blockedContacts = new Map();
  const previousPlayer = { ...g.player };
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.stun = Math.max(0, g.stun - dt);
  if (!g.stun && !g.arriving) {
    const brake = input.left && input.right;
    if (!brake) {
      g.player.x +=
        (Number.isFinite(input.axis)
          ? Math.max(-1, Math.min(1, input.axis))
          : Number(!!input.right) - Number(!!input.left)) *
        100 *
        dt;
      g.player.y -= 75 * dt;
    }
  }
  g.player.x = Math.max(30, Math.min(W - 30, g.player.x));
  g.player.y = Math.max(
    g.stage === 4 ? FRONT_BARRIER_Y + g.player.r : 32,
    Math.min(g.worldHeight - 25, g.player.y),
  );
  // Shops, hedges and the hall wall leave the destination's central entrance.
  if (
    g.stage !== 4 &&
    (g.player.x < 174 || g.player.x > 306) &&
    g.player.y < 107
  )
    g.player.y = 107;
  if (g.stage === 4) {
    if (g.player.y < 650) g.player.x = Math.max(48, Math.min(432, g.player.x));
    for (const [top, bottom] of [
      [790, 825],
      [685, 720],
    ]) {
      if (
        previousPlayer.y >= bottom + 12 &&
        g.player.y < bottom + 12 &&
        (g.player.x < 142 || g.player.x > 338)
      )
        g.player.y = bottom + 12;
      if (g.player.y < bottom + 12 && g.player.y > top - 12)
        g.player.x = Math.max(142, Math.min(338, g.player.x));
    }
    if (!g.ticketChecked && g.player.y < 790) g.ticketChecked = true;
  }
  if (!g.arriving) {
    const result = resolvePlayerMove(
      previousPlayer,
      g.player,
      g.player.r,
      people,
    );
    Object.assign(g.player, result.point);
    for (const id of result.contacts) blockedContacts.set(id, 0);
  }
  constrainTraffic(g, previousPlayer, input);
  g.player.x = Math.max(30, Math.min(W - 30, g.player.x));
  g.player.y = Math.max(
    g.stage === 4 ? FRONT_BARRIER_Y + g.player.r : 32,
    Math.min(g.worldHeight - 25, g.player.y),
  );
  const goal = goalFor(g.stage);
  if (
    !g.arriving &&
    g.player.x >= goal.x &&
    g.player.x <= goal.x + goal.w &&
    g.player.y <= goal.y + goal.h + 0.000001
  ) {
    g.arriving = true;
    g.arrivalTarget = arrivalPoint(g.stage, g.player);
    setArrivalSlots(g.party, g.stage, g.player);
  }
  if (g.arriving && g.party.members.length && !g.stun) {
    const dx = g.arrivalTarget.x - g.player.x,
      dy = 84 - g.player.y,
      d = Math.hypot(dx, dy),
      ratio = d ? Math.min(1, (100 * dt) / d) : 0;
    g.player.x += dx * ratio;
    g.player.y += dy * ratio;
  }
  moveParty(g.party, g.player, dt, {
    braking: !!(input.left && input.right),
    stunned: g.stun > 0,
    arriving: g.arriving,
    resolveFollower: g.arriving
      ? undefined
      : (member, next) => {
          const result = followerProgress(member, next, member.r, people);
          for (const id of result.contacts)
            if (!blockedContacts.has(id) || blockedContacts.get(id) === 0)
              blockedContacts.set(id, member.id);
          return result.fraction;
        },
  });
  for (const [id, memberId] of blockedContacts) {
    if (!memberId) continue;
    const person = people.find((p) => p.id === id),
      friend = g.party.members.find((m) => m.id === memberId);
    if (person && friend) makeRoomForFollower(person, friend);
  }
  const crash = vehicleContact(g, previousTeam);
  if (crash) {
    g.phase = "gameover";
    g.crash = crash;
    return;
  }
  let contacted = null,
    contactMember = null,
    nearest = Infinity;
  const touching = [];
  const team = [{ ...g.player, id: 0 }, ...g.party.members];
  for (const p of people) {
    let overlaps = false;
    for (const member of team) {
      const distance = Math.hypot(p.x - member.x, p.y - member.y);
      if (
        distance < p.r + member.r + BODY_GAP + 0.3 ||
        blockedContacts.get(p.id) === member.id
      ) {
        overlaps = true;
        if (
          !g.cooldown &&
          !g.touchingIds.includes(p.id) &&
          distance < nearest
        ) {
          contacted = p;
          contactMember = member;
          nearest = distance;
        }
      }
    }
    if (overlaps) touching.push(p.id);
  }
  g.touchingIds = touching;
  if (contacted) {
    reactToContact(contacted, contactMember);
    g.lastContactMember = contactMember.id;
    g.memberHits[contactMember.id]++;
    const hitFriend = g.party.members.find((m) => m.id === contactMember.id);
    if (hitFriend) hitFriend.flash = 1.4;
    g.lastContactId = contacted.id;
    g.hits++;
    g.elapsed += 2;
    g.cooldown = 1.4;
    g.stun = 0.35;
  }
  if (
    g.arriving &&
    partyArrived(g.party) &&
    (!g.party.members.length ||
      Math.hypot(g.player.x - g.arrivalTarget.x, g.player.y - 84) < 0.01)
  ) {
    g.phase = "finished";
    g.meetingPartner.state = "met";
  }
}

// Arrival animation advances independently of the immutable race result.
export function advanceAudienceAmbience(
  g,
  dt,
  { active = true, reducedMotion = false } = {},
) {
  if (g.stage !== 4 || g.phase !== "finished" || !active || reducedMotion)
    return;
  dt = Math.max(0, Math.min(0.05, dt));
  if (!dt) return;
  g.ambientTime = (g.ambientTime || 0) + dt;
  moveCrowd(g.crowd, dt, [], [g.player, ...g.party.members, g.meetingPartner]);
}

// A visual join does not add a second copy to the current gameplay party.
export function joiningFriend(g, reducedMotion = false) {
  if (g.phase !== "finished" || g.stage >= 4) return null;
  const progress = reducedMotion ? 1 : Math.min(1, (g.joinTime || 0) / 0.8);
  const target = {
    x: g.stage < 2 ? 270 : g.stage === 2 ? 210 : 270,
    y: g.stage < 2 ? 84 : 54,
  };
  const dx = target.x - g.meetingPartner.x,
    dy = target.y - g.meetingPartner.y,
    distance = Math.hypot(dx, dy) || 1;
  return {
    ...g.meetingPartner,
    partner: false,
    friend: true,
    id: g.stage + 1,
    newFriend: true,
    x: g.meetingPartner.x + dx * progress,
    y: g.meetingPartner.y + dy * progress,
    ux: progress < 1 ? dx / distance : 0,
    uy: progress < 1 ? dy / distance : -1,
    state: progress < 1 ? "joining" : "celebrating",
    joinProgress: progress,
  };
}
export function advanceJoining(
  g,
  dt,
  { active = true, reducedMotion = false } = {},
) {
  if (g.phase !== "finished" || g.stage >= 4 || !active || reducedMotion)
    return;
  g.joinTime = Math.min(
    0.8,
    (g.joinTime || 0) + Math.max(0, Math.min(0.05, dt)),
  );
}
