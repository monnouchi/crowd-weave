import {
  createTraffic,
  trafficSpec,
  updateTraffic,
  constrainTraffic,
  trafficSpecs,
} from "./traffic.js";
import { createParty, moveParty, partyArrived } from "./party.js";
import {
  makeCrowd,
  moveCrowd,
  visiblePerson,
  reactToContact,
} from "./crowd.js";
export const W = 480,
  H = 680,
  START = { x: 240, y: 625 },
  GOAL = { x: 175, y: 20, w: 130, h: 65 };
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
  { name: "ひとりで出発", count: 6, speed: 30 },
  { name: "住宅街から最寄り駅へ", count: 12, speed: 35 },
  { name: "駅のカフェで合流", count: 20, speed: 40 },
  { name: "会場前のにぎわい", count: 30, speed: 45 },
  { name: "ライブの最前方へ", count: 40, speed: 50 },
];
export const SCENES = [
  {
    place: "住宅街の角",
    landmark: "home",
    environment: "residential",
    purpose: "家を出て、住宅街の角で友だちと合流",
    intro: "家をひとりで出発。住宅街の角で友だちに会おう。",
    bubble: "一緒に駅へ行こう！",
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
    bubble: "駅の入口にいるよ！",
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
    purpose: "駅構内の横の人流を渡り、壁沿いのカフェへ",
    intro: "駅のカフェで合流し、郊外のライブ会場へ向かおう。",
    bubble: "カフェで待ってるよ！",
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
    bubble: "入口の軒下にいるよ！",
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
export function createGame(stage = 0, seed = 1402485690 + stage * 97) {
  const config = STAGES[stage];
  const scene = SCENES[stage];
  const start =
    stage === 3
      ? { x: 240, y: 1125 }
      : stage === 4
        ? { x: 240, y: 945 }
        : START;
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
  return {
    stage,
    phase: "ready",
    startY: start.y,
    worldHeight: stage === 3 ? 1180 : stage === 4 ? 1000 : H,
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
  updateTraffic(g, dt);
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
  constrainTraffic(g, previousPlayer, input);
  g.player.x = Math.max(30, Math.min(W - 30, g.player.x));
  g.player.y = Math.max(32, Math.min(g.worldHeight - 25, g.player.y));
  // Shops, hedges and the hall wall leave the destination's central entrance.
  if ((g.player.x < 174 || g.player.x > 306) && g.player.y < 107)
    g.player.y = 107;
  if (g.stage === 4) {
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
  if (
    !g.arriving &&
    g.player.x >= GOAL.x &&
    g.player.x <= GOAL.x + GOAL.w &&
    g.player.y <= GOAL.y + GOAL.h + 0.000001
  )
    g.arriving = true;
  if (g.arriving && g.party.members.length && !g.stun) {
    const dx = 240 - g.player.x,
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
  });
  moveCrowd(g.crowd, dt, g.crossings);
  let contacted = null,
    contactMember = null,
    nearest = Infinity;
  const touching = [];
  const team = [{ ...g.player, id: 0 }, ...g.party.members];
  for (const p of g.crowd) {
    if (!visiblePerson(p)) continue;
    let overlaps = false;
    for (const member of team) {
      const distance = Math.hypot(p.x - member.x, p.y - member.y);
      if (distance < p.r + member.r) {
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
      Math.hypot(g.player.x - 240, g.player.y - 84) < 0.01)
  ) {
    g.phase = "finished";
    g.meetingPartner.state = "met";
  }
}
