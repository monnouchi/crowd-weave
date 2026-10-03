import {
  createTraffic,
  trafficSpec,
  updateTraffic,
  constrainTraffic,
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
    purpose: "駅のカフェで友だちと待ち合わせ",
    intro: "駅のカフェで合流し、郊外のライブ会場へ向かおう。",
    bubble: "カフェで待ってるよ！",
    arrival: "カフェで合流。次は会場の最寄り駅！",
    shirt: "#cc8b74",
    visualScale: 1,
    floor: "#e9ecdf",
    backgroundCount: 6,
  },
  {
    place: "ライブ会場前",
    landmark: "venue",
    environment: "venue",
    weather: "rain",
    purpose: "雨の会場最寄り駅から、会場前の軒下へ",
    intro: "雨の会場前へ。傘の人と、軒下へ急ぐ人の流れを読もう。",
    bubble: "入口の軒下にいるよ！",
    arrival: "会場前で合流。いよいよ中へ！",
    shirt: "#9788a9",
    visualScale: 1,
    floor: "#dfe7e5",
    backgroundCount: 6,
  },
  {
    place: "ステージ前",
    landmark: "party",
    environment: "party",
    purpose: "ライブ会場の中を抜け、ステージ前へ",
    intro: "ライブ会場へ。人のすきまを読んで、ステージ前の友だちのもとへ。",
    bubble: "ここから一緒に楽しもう！",
    arrival: "ステージ前に到着。みんなでライブを楽しもう！",
    shirt: "#c4a46c",
    visualScale: 1,
    floor: "#e6e0e9",
    backgroundCount: 8,
  },
].map((scene) => ({ ...scene, targetKind: "friend" }));
export function createGame(stage = 0, seed = 1402485690 + stage * 97) {
  const config = STAGES[stage];
  const scene = SCENES[stage];
  return {
    stage,
    phase: "ready",
    player: { ...START, r: 12 },
    party: createParty(stage, { ...START }),
    arriving: false,
    lastContactMember: 0,
    memberHits: Array(stage + 1).fill(0),
    scene,
    meetingPartner: {
      ...MEETING_PARTNER,
      shirt: scene.shirt,
      targetKind: scene.targetKind,
      visualScale: scene.visualScale,
    },
    elapsed: 0,
    worldTime: 0,
    traffic: createTraffic(stage),
    hits: 0,
    cooldown: 0,
    stun: 0,
    lastContactId: null,
    touchingIds: [],
    seed,
    crowd: makeCrowd(
      config.count,
      config.speed,
      seed,
      scene.environment,
      trafficSpec(stage),
    ),
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
  g.player.y = Math.max(32, Math.min(H - 25, g.player.y));
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
  moveCrowd(g.crowd, dt, g.traffic);
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
