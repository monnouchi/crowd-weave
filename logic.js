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
  { name: "朝の改札", count: 12, speed: 30 },
  { name: "ホームへ向かう人", count: 20, speed: 35 },
  { name: "乗り換えの時間", count: 30, speed: 40 },
  { name: "夕方の改札", count: 35, speed: 45 },
  { name: "混雑する駅", count: 40, speed: 50 },
];
export const SCENES = [
  {
    purpose: "北口のカフェ前で待ち合わせ",
    bubble: "こっちだよ！",
    arrival: "待つ人と合流！",
    shirt: "#d5ab53",
    visualScale: 1,
  },
  {
    purpose: "ホームへ向かう前に合流",
    bubble: "ここで待ってるよ！",
    arrival: "出発前に合流！",
    shirt: "#839d76",
    visualScale: 1,
  },
  {
    purpose: "乗り換え前に待ち合わせ",
    bubble: "合流したらホームへ！",
    arrival: "乗り換え前に合流！",
    shirt: "#cc8b74",
    visualScale: 1,
  },
  {
    purpose: "夕方、カフェ前で待ち合わせ",
    bubble: "おつかれさま、こっち！",
    arrival: "待ち合わせに到着！",
    shirt: "#9788a9",
    visualScale: 1,
  },
  {
    purpose: "混雑する駅で待つ人のもとへ",
    bubble: "もう少し、ここだよ！",
    arrival: "人混みを抜けて合流！",
    shirt: "#c4a46c",
    visualScale: 1,
  },
];
export function createGame(stage = 0, seed = 1402485690 + stage * 97) {
  const config = STAGES[stage];
  const scene = SCENES[stage];
  return {
    stage,
    phase: "ready",
    player: { ...START, r: 12 },
    scene,
    meetingPartner: {
      ...MEETING_PARTNER,
      shirt: scene.shirt,
      visualScale: scene.visualScale,
    },
    elapsed: 0,
    hits: 0,
    cooldown: 0,
    stun: 0,
    lastContactId: null,
    touchingIds: [],
    seed,
    crowd: makeCrowd(config.count, config.speed, seed),
  };
}
export function step(g, dt, input) {
  if (g.phase !== "playing") return;
  dt = Math.max(0, Math.min(dt, 0.05));
  g.elapsed += dt;
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.stun = Math.max(0, g.stun - dt);
  if (!g.stun) {
    const brake = input.left && input.right;
    if (!brake) {
      g.player.x += (Number(!!input.right) - Number(!!input.left)) * 100 * dt;
      g.player.y -= 75 * dt;
    }
  }
  g.player.x = Math.max(30, Math.min(W - 30, g.player.x));
  g.player.y = Math.max(32, Math.min(H - 25, g.player.y));
  moveCrowd(g.crowd, dt);
  let contacted = null,
    nearest = Infinity;
  const touching = [];
  for (const p of g.crowd) {
    const distance = Math.hypot(p.x - g.player.x, p.y - g.player.y);
    if (visiblePerson(p) && distance < p.r + g.player.r) {
      touching.push(p.id);
      if (!g.cooldown && !g.touchingIds.includes(p.id) && distance < nearest) {
        contacted = p;
        nearest = distance;
      }
    }
  }
  g.touchingIds = touching;
  if (contacted) {
    reactToContact(contacted, g.player);
    g.lastContactId = contacted.id;
    g.hits++;
    g.elapsed += 2;
    g.cooldown = 1.4;
    g.stun = 0.35;
  }
  if (
    g.player.x >= GOAL.x &&
    g.player.x <= GOAL.x + GOAL.w &&
    g.player.y <= GOAL.y + GOAL.h
  ) {
    g.phase = "finished";
    g.meetingPartner.state = "met";
  }
}
