import { trafficWaypoint, trafficBlocks } from "./traffic.js";
// Seeded destination-driven station walkers. No random decisions during a frame.
export function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export const PLACES = {
  north: "北口・コンコース",
  south: "改札",
  west: "1・2番ホーム",
  east: "3・4番ホーム",
};
export const FLOW_PROFILES = {
  residential: {
    pace: 0.78,
    space: 52,
    spaceRange: 14,
    acceleration: 4,
    queue: false,
    role: "近所の人",
    places: {
      north: "住宅街の角",
      south: "自宅側",
      west: "商店街",
      east: "公園",
    },
  },
  station: {
    pace: 1.1,
    space: 42,
    spaceRange: 18,
    acceleration: 5,
    queue: true,
    role: "駅利用者",
    places: PLACES,
  },
  cafe: {
    pace: 0.8,
    space: 46,
    spaceRange: 16,
    acceleration: 4,
    queue: true,
    role: "カフェの客",
    places: {
      north: "カフェ入口",
      south: "駅通路",
      west: "注文口",
      east: "待合席",
    },
  },
  venue: {
    pace: 0.92,
    space: 44,
    spaceRange: 16,
    acceleration: 4,
    queue: true,
    role: "来場する友人",
    places: {
      north: "会場入口",
      south: "会場最寄り駅",
      west: "受付",
      east: "待ち合わせ",
    },
  },
  party: {
    pace: 0.55,
    space: 35,
    spaceRange: 12,
    acceleration: 3,
    queue: true,
    role: "ライブの観客",
    places: {
      north: "ステージ前",
      south: "会場入口",
      west: "ドリンク",
      east: "ロビー",
    },
  },
};
function aim(p) {
  const target = p.route[p.leg];
  const dx = target.x - p.x,
    dy = target.y - p.y,
    d = Math.hypot(dx, dy) || 1;
  p.ux = dx / d;
  p.uy = dy / d;
}
export function makeCrowd(
  count,
  speed,
  seed,
  environment = "station",
  traffic = null,
) {
  const profile = FLOW_PROFILES[environment] || FLOW_PROFILES.station;
  const queueY = traffic ? 175 : 370,
    readerY = traffic ? 175 : 320;
  const rand = random(seed),
    crowd = [];
  for (let id = 0; id < count; id++) {
    const flow =
      id % 10 < (environment === "party" ? 7 : 5)
        ? "along"
        : id % 10 < (environment === "cafe" ? 8 : 9)
          ? "opposing"
          : "crossing";
    const urgency =
      environment === "residential" ||
      environment === "cafe" ||
      environment === "party"
        ? id % 3 === 0
          ? "relaxed"
          : "steady"
        : environment === "station"
          ? id % 3 === 0
            ? "hurried"
            : id % 7 === 0
              ? "relaxed"
              : "steady"
          : id % 5 === 0
            ? "hurried"
            : id % 3 === 0
              ? "relaxed"
              : "steady";
    const lane = 65 + rand() * 350,
      slope = (rand() - 0.5) * 60;
    const eastbound = id % 2 === 0;
    const origin =
      flow === "along"
        ? "south"
        : flow === "opposing"
          ? "north"
          : eastbound
            ? "west"
            : "east";
    const destination =
      flow === "along"
        ? "north"
        : flow === "opposing"
          ? "south"
          : eastbound
            ? "east"
            : "west";
    const a =
      flow === "crossing"
        ? {
            x: eastbound ? -60 : 540,
            y: (eastbound ? 230 : 430) + (rand() - 0.5) * (traffic ? 30 : 90),
          }
        : { x: lane, y: flow === "along" ? 760 : -80 };
    const b =
      flow === "crossing"
        ? {
            x: eastbound ? 540 : -60,
            y: a.y + (rand() - 0.5) * 35,
          }
        : {
            x: Math.max(50, Math.min(430, lane + slope)),
            y: flow === "along" ? -80 : 760,
          };
    const habit =
      profile.queue && id >= 1 && id <= 3
        ? "queuing"
        : environment === "residential" && id === 2
          ? "meeting"
          : environment === "cafe" && id % 4 === 0
            ? "meeting"
            : environment === "party" && id % 8 === 0
              ? "meeting"
              : urgency === "hurried"
                ? "direct"
                : id % 11 === 0
                  ? "meeting"
                  : id % 7 === 0
                    ? "reading"
                    : "direct";
    const stop =
      habit === "queuing"
        ? { x: 415, y: queueY }
        : habit === "direct"
          ? null
          : {
              x: id === 7 ? 65 : lane < 240 ? 65 : 415,
              y:
                habit === "meeting"
                  ? environment === "cafe" || environment === "party"
                    ? 160
                    : 520
                  : readerY,
            };
    const route = stop ? [stop, b] : [b];
    let x, y;
    for (let attempt = 0; attempt < 500; attempt++) {
      x = 50 + rand() * 380;
      y =
        flow === "crossing"
          ? a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x)) + (rand() - 0.5) * 20
          : 140 + rand() * 405;
      if (
        (environment === "venue" || environment === "party") &&
        id >= 20 &&
        id % 6 === 3
      ) {
        const q = crowd.at(-1),
          angle = rand() * Math.PI * 2;
        if (q) {
          x = q.x + Math.cos(angle) * 45;
          y = q.y + Math.sin(angle) * 45;
          if (x < 50 || x > 430 || y < 140 || y > 545) continue;
        }
      }
      if (habit === "queuing") {
        x = 415;
        y = queueY + (id - 1) * 42;
      }
      if (id === 16 || id === 17) {
        x = id === 17 ? 120 : 165;
        y = 540;
      }
      if (environment === "residential" && id === 2) {
        x = 65;
        y = 520;
      }
      if (id === 7) {
        x = 65;
        y = readerY;
      }
      const reserved =
        habit === "queuing" ||
        id === 7 ||
        id === 16 ||
        id === 17 ||
        (environment === "residential" && id === 2) ||
        ([queueY, queueY + 42, queueY + 84].every(
          (qy) => Math.hypot(x - 415, y - qy) > 38,
        ) &&
          Math.hypot(x - 65, y - readerY) > 38 &&
          Math.hypot(x - 120, y - 540) > 38 &&
          Math.hypot(x - 165, y - 540) > 38 &&
          (environment !== "residential" || Math.hypot(x - 65, y - 520) > 38));
      if (traffic && y > traffic.top - 20 && y < traffic.bottom + 20) continue;
      if (reserved && crowd.every((p) => Math.hypot(p.x - x, p.y - y) > 38))
        break;
    }
    if (flow !== "crossing") b.x = Math.max(50, Math.min(430, x + slope));
    // Starting positions are walkers already en route, rather than simultaneous entries.
    const pace =
      speed *
      profile.pace *
      (0.8 + rand() * 0.28) *
      (urgency === "hurried" ? 1.15 : urgency === "relaxed" ? 0.78 : 1);
    const p = {
      id,
      environment,
      role: profile.role,
      originName: profile.places[origin],
      destinationName: profile.places[destination],
      acceleration: profile.acceleration,
      flow,
      suitcase: id % 20 === 4,
      archetype:
        urgency === "hurried"
          ? "brisk"
          : urgency === "relaxed"
            ? "careful"
            : "ordinary",
      origin,
      destination,
      urgency,
      habit,
      x,
      y,
      entry: a,
      route,
      leg: 0,
      pace,
      personalSpace: profile.space + rand() * profile.spaceRange,
      yielding: 0.7 + rand() * 0.6,
      pauseDuration:
        habit === "queuing"
          ? 3
          : habit === "meeting"
            ? 6 + rand() * 3
            : 4 + rand() * 3,
      ux: 0,
      uy: 0,
      vx: 0,
      vy: 0,
      r: 13,
      color: id % 4,
      active: true,
      state: "walking",
      wait: 0,
      cycle: 0,
      walk: rand() * 30,
      reaction: null,
    };
    if (
      habit === "queuing" ||
      id === 7 ||
      (environment === "residential" && id === 2)
    ) {
      p.state = habit;
      p.wait = p.pauseDuration;
      p.ux = 0;
      p.uy = -1;
    } else aim(p);
    p.vx = p.state === "walking" ? p.ux * pace : 0;
    p.vy = p.state === "walking" ? p.uy * pace : 0;
    if (id === 16 || id === 17) {
      p.group = "family";
      p.origin = "south";
      p.destination = "north";
      p.flow = "along";
      b.y = -80;
      b.x = id === 17 ? 110 : 155;
      p.archetype = id === 17 ? "curious-child" : "companion";
      p.habit = "interest";
      p.pauseDuration = id === 17 ? 1.2 : 1.8;
      p.pace = speed * profile.pace * 0.78;
      p.route = [{ x: id === 17 ? 110 : 155, y: 500 }, b];
      p.leg = 0;
      aim(p);
    }
    if (
      (environment === "venue" || environment === "party") &&
      id >= 20 &&
      (id % 6 === 2 || id % 6 === 3)
    ) {
      p.group = `visitors-${Math.floor(id / 6)}`;
      p.archetype = "visitor";
      const partner = crowd.find((q) => q.group === p.group);
      if (partner) {
        p.color = partner.color;
        p.pace = partner.pace;
        p.flow = partner.flow;
        p.origin = partner.origin;
        p.destination = partner.destination;
        p.destinationName = partner.destinationName;
        const end = partner.route.at(-1);
        p.route = [{ x: Math.max(50, Math.min(430, end.x + 40)), y: end.y }];
        p.leg = 0;
        p.habit = "direct";
        aim(p);
      }
    }
    if (environment === "venue" && traffic) {
      p.weather = "rain";
      const identity = p.group
        ? [...p.group].reduce((n, char) => n + char.charCodeAt(0), 0)
        : id;
      p.umbrella = identity % 3 !== 0;
      if (!p.umbrella) {
        if (!p.group || !crowd.some((q) => q.group === p.group)) p.pace *= 1.12;
        p.weatherRole = "傘がなく、入口へ急ぐ";
        if (!p.group && p.habit === "direct" && p.flow !== "crossing") {
          // A short shelter stop precedes the original destination. Existing
          // readers, families, queues and visitor groups keep their routes.
          const southSide = p.y > traffic.bottom;
          p.route.unshift({
            x: southSide ? 65 : 415,
            y: southSide ? 520 : 175,
          });
          p.habit = "shelter";
          p.pauseDuration = 2.5;
          p.weatherRole = "傘がなく、近い軒下へ急ぐ";
          aim(p);
        }
      } else p.weatherRole = "傘を差して目的地へ歩く";
      p.vx = p.state === "walking" ? p.ux * p.pace : 0;
      p.vy = p.state === "walking" ? p.uy * p.pace : 0;
    }
    crowd.push(p);
  }
  return crowd;
}
export function reactToContact(p, player) {
  if (p.reaction) return;
  const dx = player.x - p.x,
    dy = player.y - p.y,
    d = Math.hypot(dx, dy);
  p.reaction = {
    remaining: 0.7,
    faceX: d ? dx / d : -p.ux,
    faceY: d ? dy / d : -p.uy,
  };
  p.vx = 0;
  p.vy = 0;
}
export function moveCrowd(crowd, dt, traffic = null) {
  const velocities = crowd.map((p) => {
    if (!p.active || p.state !== "walking" || p.reaction) return null;
    const target = trafficWaypoint(p, p.route[p.leg], traffic),
      dx = target.x - p.x,
      dy = target.y - p.y,
      d = Math.hypot(dx, dy) || 1;
    const ux = dx / d,
      uy = dy / d;
    let vx = ux * p.pace,
      vy = uy * p.pace,
      paceFactor = 1;
    for (const q of crowd) {
      if (q === p || !q.active) continue;
      const rx = p.x - q.x,
        ry = p.y - q.y,
        distance = Math.hypot(rx, ry);
      if (distance > p.personalSpace || distance < 0.001) continue;
      const ahead = -(rx * ux + ry * uy),
        side = Math.abs(rx * uy - ry * ux);
      if (ahead > 0 && side < 28) {
        paceFactor = Math.min(
          paceFactor,
          0.35 + 0.65 * Math.min(1, distance / p.personalSpace),
        );
        const turn = (1 - distance / p.personalSpace) * 30 * p.yielding;
        vx += -uy * turn;
        vy += ux * turn;
      }
      if (distance < 38) {
        const push = (1 - distance / 38) * 48 * p.yielding;
        vx += (rx / distance) * push;
        vy += (ry / distance) * push;
      }
    }
    if (p.archetype === "curious-child")
      paceFactor *= 0.85 + 0.15 * Math.sin(p.walk / 35);
    if (p.group) {
      const companion = crowd.find(
        (q) => q !== p && q.group === p.group && q.active,
      );
      if (companion && Math.hypot(p.x - companion.x, p.y - companion.y) > 75)
        paceFactor *= 0.65;
    }
    vx *= paceFactor;
    vy *= paceFactor;
    const blend = 1 - Math.exp(-dt * (p.acceleration || 5));
    if (trafficBlocks(p, vy, traffic, dt)) {
      p.trafficWait = true;
      // A red light stops forward motion, but people can still settle sideways
      // into their flow's queue. Freezing both axes made a wall across the path.
      return { vx: p.vx + (vx - p.vx) * blend, vy: 0, ux, uy };
    }
    p.trafficWait = false;
    return {
      vx: p.vx + (vx - p.vx) * blend,
      vy: p.vy + (vy - p.vy) * blend,
      ux,
      uy,
    };
  });
  // Local velocity constraint keeps bodies apart without snapping positions.
  // A stopped reader never moves merely because another walker approaches.
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < crowd.length; i++)
      for (let j = i + 1; j < crowd.length; j++) {
        const p = crowd[i],
          q = crowd[j];
        if (!p.active || !q.active) continue;
        const dx = p.x - q.x,
          dy = p.y - q.y,
          d = Math.hypot(dx, dy);
        if (d >= 38 || d < 0.001) continue;
        const a = velocities[i]?.locked ? null : velocities[i],
          b = velocities[j]?.locked ? null : velocities[j];
        if (!a && !b) continue;
        const nx = dx / d,
          ny = dy / d,
          relative =
            ((a?.vx || 0) - (b?.vx || 0)) * nx +
            ((a?.vy || 0) - (b?.vy || 0)) * ny;
        const minimum = ((traffic ? 32 : 28) - d) / dt;
        if (relative >= minimum) continue;
        const correction = (minimum - relative) / (a && b ? 2 : 1);
        if (a) {
          a.vx += nx * correction;
          a.vy += ny * correction;
        }
        if (b) {
          b.vx -= nx * correction;
          b.vy -= ny * correction;
        }
      }
  crowd.forEach((p, i) => {
    if (!p.active) {
      p.wait -= dt;
      if (
        p.wait <= 0 &&
        crowd.every(
          (q) =>
            q === p ||
            !q.active ||
            Math.hypot(q.x - p.entry.x, q.y - p.entry.y) > p.personalSpace,
        )
      ) {
        p.x = p.entry.x;
        p.y = p.entry.y;
        p.leg = 0;
        p.state = "walking";
        p.active = true;
        aim(p);
        p.vx = p.ux * p.pace;
        p.vy = p.uy * p.pace;
      }
      return;
    }
    if (p.reaction) {
      p.reaction.remaining = Math.max(0, p.reaction.remaining - dt);
      if (p.reaction.remaining === 0) p.reaction = null;
      return;
    }
    if (p.state !== "walking") {
      if (
        p.state === "queuing" &&
        crowd.some(
          (q) =>
            q.active &&
            q.habit === "queuing" &&
            q.id < p.id &&
            q.cycle === p.cycle &&
            q.leg === 0,
        )
      )
        return;
      p.wait -= dt;
      if (p.wait <= 0) {
        if (
          p.state !== "queuing" ||
          Math.hypot(p.x - p.route[0].x, p.y - p.route[0].y) < 8
        )
          p.leg++;
        p.state = "walking";
        aim(p);
      }
      return;
    }
    if (trafficBlocks(p, velocities[i].vy, traffic, dt)) {
      velocities[i].vy = 0;
      p.trafficWait = true;
    }
    Object.assign(p, velocities[i]);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.walk += Math.hypot(p.vx, p.vy) * dt;
    const target = p.route[p.leg];
    if (Math.hypot(target.x - p.x, target.y - p.y) < 8) {
      if (p.leg < p.route.length - 1) {
        p.state = p.habit;
        p.wait = p.pauseDuration;
        p.vx = 0;
        p.vy = 0;
      } else {
        p.active = false;
        p.state = "entry";
        p.cycle++;
        p.wait = 0.8 + ((p.id * 17 + p.cycle * 13) % 23) / 10;
      }
    }
  });
}
export function visiblePerson(p) {
  return p.active && p.x > 18 && p.x < 462 && p.y > 110 && p.y < 670;
}
