import { trafficWaypoint, trafficBlocks, walkerTraffic } from "./traffic.js";
// Seeded destination-driven station walkers. No random decisions during a frame.
export function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
// Small side-lane patrols add readable obstacles without sealing the route.
// They stay on sidewalks, away from both road crossings and hall doorways.
export function createAnimals(stage, crowd) {
  const spec = {
    0: { kind: "dog", minX: 312, maxX: 382, y: 790, r: 12, speed: 25 },
    2: { kind: "cat", minX: 98, maxX: 174, y: 1070, r: 9, speed: 31 },
    3: { kind: "dog", minX: 318, maxX: 395, y: 1430, r: 12, speed: 24 },
  }[stage];
  if (!spec) return [];
  const middle = (spec.minX + spec.maxX) / 2;
  const candidates = [spec.y, spec.y + 70, spec.y - 70];
  const y = candidates.sort((a, b) => {
    const clearance = (cy) => Math.min(...crowd.filter((p) => p.active)
      .map((p) => Math.hypot(p.x - middle, p.y - cy)));
    return clearance(b) - clearance(a);
  })[0];
  return [{ ...spec, id: 2000 + stage, animal: true, active: true,
    x: middle, y, time: 0, vx: spec.speed, vy: 0 }];
}
export function moveAnimals(animals, dt) {
  for (const animal of animals) {
    animal.time += dt;
    const span = (animal.maxX - animal.minX) / 2;
    if (span <= 0) {
      animal.vx = 0;
      animal.bracing = false;
      continue;
    }
    const previous = animal.x;
    const phase = animal.time * animal.speed / span;
    // A dog lowers its stance shortly before reversing its patrol direction.
    animal.bracing = animal.kind === "dog" &&
      Math.sin(phase) * Math.cos(phase) > 0 &&
      Math.abs(Math.cos(phase)) < 0.4;
    animal.x = (animal.minX + animal.maxX) / 2 + span * Math.sin(phase);
    animal.vx = dt ? (animal.x - previous) / dt : 0;
  }
}

// Visual-only direction cue: look into the next leg before reaching a corner.
export function previewTurn(p) {
  if (!p.active || p.anchor || p.state !== "walking" || p.reaction ||
      p.courtesy || !p.route?.[p.leg + 1]) return null;
  const corner = p.route[p.leg], next = p.route[p.leg + 1];
  const intoX = corner.x - p.x, intoY = corner.y - p.y;
  const outX = next.x - corner.x, outY = next.y - corner.y;
  const into = Math.hypot(intoX, intoY), out = Math.hypot(outX, outY);
  if (into < 16 || into > 48 || out < 12) return null;
  const dot = (intoX * outX + intoY * outY) / (into * out);
  return dot < 0.7 ? { x: outX / out, y: outY / out } : null;
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
  if (environment === "party") return makeAudience(count, speed, seed);
  const profile = FLOW_PROFILES[environment] || FLOW_PROFILES.station;
  const visitorOffset = seed % 2 ? 0 : 2;
  const visitorIndex = (id) => (id - 20) % 6;
  const isVisitor = (id) =>
    id >= 20 && [visitorOffset, visitorOffset + 1].includes(visitorIndex(id));
  const queueY = traffic ? 175 : 370,
    readerY = traffic ? 175 : 320;
  const rand = random(seed),
    crowd = [];
  for (let id = 0; id < count; id++) {
    const flow =
      environment === "cafe" && id % 10 >= 2
        ? "crossing"
        : id % 10 < (environment === "party" ? 7 : 5)
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
    const cafeBand = Math.floor(id / 4) % 3;
    const a =
      flow === "crossing"
        ? {
            x: eastbound ? -60 : 540,
            y:
              environment === "cafe"
                ? [640, 445, 245][cafeBand] + (rand() - 0.5) * 82
                : (eastbound ? 230 : 430) +
                  (rand() - 0.5) * (traffic ? 30 : 90),
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
        isVisitor(id) &&
        visitorIndex(id) === visitorOffset + 1
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
        x = environment === "cafe"
          ? id === 17 ? 255 : 210
          : id === 17 ? 120 : 165;
        y = environment === "cafe" ? 735 : 540;
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
      (urgency === "hurried" ? 1.15 : urgency === "relaxed" ? 0.78 : 1) *
      (environment === "cafe" && flow === "crossing"
        ? [1, 0.78, 1.2][cafeBand]
        : 1);
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
      const familyX = environment === "cafe"
        ? id === 17 ? 255 : 210
        : id === 17 ? 110 : 155;
      p.group = "family";
      p.origin = "south";
      p.destination = "north";
      p.flow = "along";
      b.y = -80;
      b.x = familyX;
      if (environment === "cafe") p.entry = { x: familyX, y: 890 };
      p.archetype = id === 17 ? "curious-child" : "companion";
      p.habit = "interest";
      p.pauseDuration = id === 17 ? 1.2 : 1.8;
      p.pace = speed * profile.pace * 0.78;
      p.route = [{ x: familyX, y: environment === "cafe" ? 660 : 500 }, b];
      p.leg = 0;
      aim(p);
    }
    if ((environment === "venue" || environment === "party") && isVisitor(id)) {
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
  if (environment === "cafe" && count >= 31) {
    // A short conversation forms a visible island between the middle and
    // upper crossing streams. Either side remains wide enough for the party.
    const candidates = [355, 395, 515, 325, 545, 295, 485, 565].flatMap(
      (y) => [240, 220, 260, 190, 290].map((x) => ({ x, y })),
    );
    const spot = candidates.find(({ x, y }) =>
      crowd
        .slice(0, 28)
        .every((p) =>
          [x - 40, x, x + 40].every(
            (seat) => Math.hypot(p.x - seat, p.y - y) > 40,
          ),
        ),
    );
    if (!spot) throw new Error("No safe cafe meeting spot");
    for (let i = 0; i < 3; i++) {
      const p = crowd[28 + i],
        x = spot.x - 40 + 40 * i;
      Object.assign(p, {
        x,
        y: spot.y,
        entry: { x, y: 890 },
        route: [{ x, y: spot.y }, { x, y: -80 }],
        leg: 0,
        flow: "along",
        origin: "south",
        destination: "north",
        originName: profile.places.south,
        destinationName: profile.places.north,
        habit: "meeting",
        state: "meeting",
        pauseDuration: 14,
        wait: 14,
        vx: 0,
        vy: 0,
        ux: 0,
        uy: -1,
        role: "待ち合わせ中の人",
      });
    }
  }
  return crowd;
}
export function makeRoomForFollower(p, player) {
  if (p.anchor) return;
  if (p.environment === "party" && p.state === "watching") {
    // A stationary spectator makes visible room after a bump instead of
    // becoming a permanent wall across the follower's recorded route.
    let side = p.x < player.x ? -1 : 1;
    if (p.x + side * 55 < 55 || p.x + side * 55 > 425) side *= -1;
    p.route[1] = {
      x: Math.max(55, Math.min(425, p.x + side * 55)),
      y: Math.max(54, Math.min(590, p.y + 16)),
    };
    p.leg = 1;
    p.state = "walking";
    p.wait = 0;
    aim(p);
  } else if (player.friend && p.state !== "walking")
    p.wait = Math.min(p.wait, 0.8);
}
export function reactToContact(p, player) {
  // A blocked friend can receive help even when a previous contact still
  // owns the score cooldown. Scoring remains one event per touch.
  makeRoomForFollower(p, player);
  if (p.reaction) return;
  const dx = player.x - p.x,
    dy = player.y - p.y,
    d = Math.hypot(dx, dy);
  p.reaction = {
    remaining: p.awarePlayer ? 0.38 : 0.7,
    faceX: d ? dx / d : -p.ux,
    faceY: d ? dy / d : -p.uy,
  };
  if (p.awarePlayer) p.contactAvoidTarget = player;
  p.vx = 0;
  p.vy = 0;
}
const COURTESY = Object.freeze({
  reach: 38,
  minStep: 24,
  minGain: 15,
  left: 55,
  right: 425,
  bodyGap: 3,
  prepare: 0.12,
  duration: 1.1,
  lateralSpeed: 95,
  travelFactor: 0.72,
});

function courtesyChoice(p, crowd, player, reserved) {
  const choices = [];
  for (const direction of [-1, 1]) {
    const targetX = Math.max(COURTESY.left,
      Math.min(COURTESY.right, p.x + direction * COURTESY.reach));
    if (Math.abs(targetX - p.x) < COURTESY.minStep ||
        Math.abs(targetX - player.x) - Math.abs(p.x - player.x) <
          COURTESY.minGain) continue;
    let clearance = 110;
    for (const q of crowd) {
      if (q === p || !q.active) continue;
      for (const fraction of [0.45, 1]) {
        // Check the swept shoulder path as well as the destination. A free
        // endpoint alone could send somebody straight through another walker.
        const look = COURTESY.prepare +
          Math.abs(targetX - p.x) / COURTESY.lateralSpeed * fraction;
        const px = p.x + (targetX - p.x) * fraction;
        const py = p.y + (p.state === "walking" ?
          p.uy * p.pace * COURTESY.travelFactor * look : 0);
        const qx = q.x + (q.vx || 0) * Math.min(look, 0.25);
        const qy = q.y + (q.vy || 0) * Math.min(look, 0.25);
        clearance = Math.min(clearance,
          Math.hypot(qx - px, qy - py) - p.r - q.r);
      }
    }
    for (const { person, targetX: otherX } of reserved)
      clearance = Math.min(clearance,
        Math.hypot(otherX - targetX, person.y - p.y) - p.r - person.r);
    if (clearance < COURTESY.bodyGap) continue;
    const wallRoom = Math.min(targetX - COURTESY.left,
      COURTESY.right - targetX);
    const playerGain = Math.abs(targetX - player.x) -
      Math.abs(p.x - player.x);
    // Open pedestrian space dominates; wall room and the route's direction
    // break ties so a person steps into a plausible gap.
    const routeX = p.route?.[p.leg]?.x ?? p.x;
    const towardRoute = Math.sign(routeX - p.x) === direction ? 1 : 0;
    choices.push({ targetX, score:
      Math.min(clearance, 90) * 0.65 +
      Math.min(wallRoom, 100) * 0.24 +
      playerGain * 0.22 + towardRoute * 2 });
  }
  choices.sort((a, b) => b.score - a.score);
  return choices[0]?.targetX;
}

// Keep the button's availability in sync with the actual courtesy action.
// A person already stepping aside can acknowledge another call without being
// pushed progressively toward a wall.
export function availableCourtesyTargets(crowd, player, crossings = [], stage = 0) {
  const ahead = crowd.filter((p) =>
    p.active && !p.animal && p.y <= player.y - 8 &&
    p.y >= player.y - 105 && Math.abs(p.x - player.x) < 68 &&
    !crossings.some((t) => p.y >= t.top - 45 && p.y <= t.bottom + 45) &&
    !(stage === 4 && p.y >= 640 && p.y <= 885));
  ahead.sort((a, b) => b.y - a.y);
  const targets = [];
  for (const p of ahead) {
    if (targets.length >= 4) break;
    if (p.courtesy) {
      targets.push({ person: p, targetX: p.courtesy.targetX });
      continue;
    }
    const targetX = courtesyChoice(p, crowd, player, targets);
    if (targetX !== undefined) targets.push({ person: p, targetX });
  }
  return targets;
}
// A polite call changes only nearby pedestrians. The crossing, fixed walls and
// vehicles retain their normal rules, and non-human obstacles never yield.
export function askCrowdToMove(crowd, player, crossings = [], stage = 0) {
  const targets = availableCourtesyTargets(crowd, player, crossings, stage);
  for (const { person: p, targetX } of targets) {
    if (p.courtesy) p.courtesy.remaining = COURTESY.duration;
    else p.courtesy = {
      targetX, remaining: COURTESY.duration,
      phase: "prepare", prepareRemaining: COURTESY.prepare,
      direction: Math.sign(targetX - p.x), ux: p.ux, uy: p.uy,
    };
    const dx = player.x - p.x, dy = player.y - p.y;
    const distance = Math.hypot(dx, dy) || 1;
    p.acknowledge = {
      remaining: 0.72, faceX: dx / distance, faceY: dy / distance,
    };
    p.reaction = null;
  }
  return targets.length;
}
export function moveCrowd(crowd, dt, traffic = null, obstacles = []) {
  const crossings = traffic;
  const velocities = crowd.map((p) => {
    const traffic = walkerTraffic(p, p.route[p.leg], crossings);
    if (!p.active || p.anchor || p.state !== "walking" || p.reaction ||
        p.courtesy)
      return null;
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
    if (p.awarePlayer) {
      const behind = p.awarePlayer.y - p.y;
      const side = p.x - p.awarePlayer.x;
      if (behind > 8 && behind < 105 && Math.abs(side) < 47) {
        const direction = Math.sign(side) || (p.id % 2 ? 1 : -1);
        const room = direction < 0 ? p.x - 55 : 425 - p.x;
        // A small, anticipatory shoulder adjustment keeps the person's route
        // legible. The explicit call still creates a much larger gap.
        vx += direction * Math.min(28, Math.max(0, room)) *
          (1 - behind / 105) * (1 - Math.abs(side) / 47);
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
        const minimum =
          (((Array.isArray(crossings) ? crossings.length > 0 : !!crossings)
            ? 32
            : 28) -
            d) /
          dt;
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
  // After arrival, stationary friends remain real obstacles for the audience.
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < crowd.length; i++) {
      const p = crowd[i],
        v = velocities[i];
      if (!v || v.locked) continue;
      for (const q of obstacles) {
        const dx = p.x - q.x,
          dy = p.y - q.y,
          d = Math.hypot(dx, dy);
        if (d < 0.001 || d > 45) continue;
        const nx = dx / d,
          ny = dy / d;
        const minimum = (p.r + q.r + 3 - d) / dt;
        const approach = v.vx * nx + v.vy * ny;
        if (approach < minimum) {
          v.vx += nx * (minimum - approach);
          v.vy += ny * (minimum - approach);
        }
      }
    }
  crowd.forEach((p, i) => {
    if (p.acknowledge) {
      p.acknowledge.remaining = Math.max(0, p.acknowledge.remaining - dt);
      if (!p.acknowledge.remaining) p.acknowledge = null;
    }
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
        p.leg = p.environment === "party" ? 3 : 0;
        if (p.environment === "party") p.viewingRounds = 0;
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
      if (p.reaction.remaining === 0) {
        p.reaction = null;
        if (p.contactAvoidTarget) {
          const targetX = p.courtesy?.targetX ??
            courtesyChoice(p, crowd, p.contactAvoidTarget, []);
          if (targetX !== undefined) {
            if (p.courtesy) p.courtesy.remaining = Math.max(
              p.courtesy.remaining, 0.85);
            else p.courtesy = {
              targetX, remaining: 0.85,
              phase: "yield", prepareRemaining: 0,
              direction: Math.sign(targetX - p.x), ux: p.ux, uy: p.uy,
            };
          }
          p.contactAvoidTarget = null;
        }
      }
      return;
    }
    if (p.courtesy) {
      const aside = p.courtesy;
      aside.remaining -= dt;
      const preparing = aside.phase === "prepare";
      if (preparing) {
        aside.prepareRemaining = Math.max(0,
          (aside.prepareRemaining ?? 0) - dt);
        if (aside.prepareRemaining === 0) aside.phase = "yield";
      }
      const dx = aside.targetX - p.x;
      const travel = p.state === "walking"
        ? p.pace * COURTESY.travelFactor * dt : 0;
      let moveX = preparing ? aside.ux * travel :
        Math.sign(dx) * Math.min(Math.abs(dx), COURTESY.lateralSpeed * dt);
      let moveY = aside.uy * travel;
      const clear = (x, y) => crowd.every((q) => q === p || !q.active ||
        Math.hypot(q.x - x, q.y - y) >= p.r + q.r + 1);
      if (!clear(p.x + moveX, p.y + moveY)) {
        // A moving neighbour can close the planned gap. Keep walking along
        // the original route if possible instead of freezing in place.
        if (moveY && clear(p.x, p.y + moveY)) moveX = 0;
        else if (moveX && clear(p.x + moveX, p.y)) moveY = 0;
        else moveX = moveY = 0;
      }
      p.x += moveX;
      p.y += moveY;
      p.vx = dt ? moveX / dt : 0;
      p.vy = dt ? moveY / dt : 0;
      const distance = Math.hypot(moveX, moveY);
      if (distance > 0.001) {
        p.ux = moveX / distance;
        p.uy = moveY / distance;
      }
      p.walk += distance;
      if (aside.remaining <= 0) {
        p.ux = aside.ux;
        p.uy = aside.uy;
        p.courtesy = null;
      }
      return;
    }
    if (p.anchor) return;
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
        if (p.environment === "party") {
          if (p.leg === 0) p.leg = 1;
          else {
            p.viewingRounds++;
            p.leg = p.viewingRounds < 3 ? 0 : 2;
          }
          p.state = "walking";
          aim(p);
          return;
        }
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
    const traffic = walkerTraffic(p, p.route[p.leg], crossings);
    if (trafficBlocks(p, velocities[i].vy, traffic, dt)) {
      velocities[i].vy = 0;
      p.trafficWait = true;
    }
    Object.assign(p, velocities[i]);
    if (Math.hypot(p.vx, p.vy) > 1) {
      const speed = Math.hypot(p.vx, p.vy);
      p.ux = p.vx / speed;
      p.uy = p.vy / speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.walk += Math.hypot(p.vx, p.vy) * dt;
    if (p.environment === "party") {
      p.y = Math.max(33, p.y);
      p.x = Math.max(
        p.y < 600 ? 55 : -24,
        Math.min(p.y < 600 ? 425 : 504, p.x),
      );
    }
    const target = p.route[p.leg];
    if (Math.hypot(target.x - p.x, target.y - p.y) < 8) {
      if (p.environment === "party") {
        if (p.leg === 3) {
          p.leg = 0;
          aim(p);
        } else if (p.leg === 2) {
          p.active = false;
          p.state = "entry";
          p.cycle++;
          p.wait = 1;
          audienceShift(p);
        } else {
          p.state = "watching";
          p.ux = 0;
          p.uy = -1;
          p.wait =
            p.leg === 0
              ? (p.spot.y < 310 ? 18 : 8) + ((p.id * 7 + p.cycle * 11) % 12)
              : 3 + ((p.id + p.cycle) % 5);
          p.vx = p.vy = 0;
        }
        return;
      }
      if (p.leg < p.route.length - 1) {
        if (p.awarePlayer && p.habit === "direct") {
          p.leg++;
          aim(p);
        } else {
          p.state = p.habit;
          p.wait = p.pauseDuration;
          p.vx = 0;
          p.vy = 0;
        }
      } else {
        p.active = false;
        p.state = "entry";
        p.cycle++;
        p.wait = 0.8 + ((p.id * 17 + p.cycle * 13) % 23) / 10;
      }
    }
  });
}
// The concert has its own destination layout; other scene movement stays shared.
function audienceShift(p) {
  const rand = random(p.seed + p.id * 101 + p.cycle * 7919);
  p.route[1] = {
    x: Math.max(65, Math.min(415, p.spot.x + (rand() - 0.5) * 100)),
    y: Math.max(54, Math.min(p.spot.y > 900 ? 1710 : 590,
      p.spot.y + (rand() - 0.5) * 65)),
  };
}
export function makeAudience(count, speed, seed) {
  const rand = random(seed),
    crowd = [];
  for (let id = 0; id < count; id++) {
    const left = id % 2 === 0,
      watching = id < 24;
    // Poisson-like placement across the complete floor; keep the best candidate
    // if a dense front region requires a little more depth, never an overlap.
    let spot,
      bestDistance = -1;
    for (let attempt = 0; attempt < 2000; attempt++) {
      const candidate = {
        x: 65 + rand() * 350,
        y:
          (id < 4 ? 60 : id < 24 ? 125 : id < 34 ? 365 : 490) +
          rand() * (id < 4 ? 22 : id < 24 ? 230 : id < 34 ? 110 : 90),
      };
      if (Math.hypot(candidate.x - 240, candidate.y - 54) < 35) continue;
      const distance = Math.min(
        ...crowd.map((p) =>
          Math.hypot(p.spot.x - candidate.x, p.spot.y - candidate.y),
        ),
      );
      if (distance > bestDistance) {
        spot = candidate;
        bestDistance = distance;
      }
      if (distance > (id < 4 ? 84 : id < 24 ? 48 : 40)) break;
    }
    let x = spot.x,
      y = spot.y;
    if (!watching) {
      let best = -1;
      for (let attempt = 0; attempt < 2000; attempt++) {
        const cx = 65 + rand() * 350,
          cy = 350 + rand() * 260;
        const distance = Math.min(
          ...crowd.map((p) => Math.hypot(p.x - cx, p.y - cy)),
        );
        if (distance > best) {
          x = cx;
          y = cy;
          best = distance;
        }
        if (distance > 38) break;
      }
    }
    const entry = { x: left ? -24 : 504, y: 620 + rand() * 55 },
      pace = speed * 0.55 * (0.8 + rand() * 0.28);
    const p = {
      id,
      seed,
      viewingRounds: 0,
      spot,
      environment: "party",
      role: "ライブの観客",
      origin: "south",
      destination: "north",
      originName: "会場後方の出入口",
      destinationName: "ステージ前",
      flow: "along",
      urgency: "relaxed",
      habit: "watching",
      archetype: id === 17 ? "curious-child" : "ordinary",
      x,
      y,
      entry,
      route: [spot, { ...spot }, entry, { x: left ? 70 : 410, y: entry.y }],
      leg: 0,
      pace,
      personalSpace: 35 + rand() * 10,
      yielding: 1,
      acceleration: 3,
      pauseDuration: 12,
      wait: watching ? 6 + rand() * 20 : 0,
      state: watching ? "watching" : "walking",
      active: true,
      cycle: 0,
      walk: 0,
      reaction: null,
      r: 13,
      color: id % 4,
      glowStick: id % 3 === 0,
      ux: 0,
      uy: -1,
      vx: 0,
      vy: watching ? 0 : -pace,
    };
    audienceShift(p);
    if (!watching) aim(p);
    crowd.push(p);
  }
  return crowd;
}
// The old northern encounters stay intact. New, separated southern waves give
// each longer journey a readable busy stretch followed by room to recover.
export function extendJourney(crowd, stage, seed, config) {
  const layouts = [
    { bands: [760, 980], perBand: 4 },
    { bands: [730, 890, 1030], perBand: 4 },
    { bands: [920, 1150, 1330], perBand: 6 },
    { bands: [1260, 1500, 1750, 1970], perBand: 6 },
    { bands: [980, 1270, 1580], perBand: 6 },
  ];
  const { bands, perBand } = layouts[stage];
  const rand = random(seed ^ 0x9271a3d5);
  for (const p of crowd) p.boundsH = config.startY + 55;
  if (stage !== 4) for (const p of crowd.slice(0, config.baseCrowd)) {
    // Old south exits sat just outside the former short playfield. Move them
    // beyond the new edge so a returning walker never appears mid-street.
    if (p.entry.y > 650 && p.entry.x > 18 && p.entry.x < 462)
      p.entry.y = config.startY + 80;
    const last = p.route.at(-1);
    if (last.y > 650 && last.x > 18 && last.x < 462)
      last.y = config.startY + 80;
  }
  for (let i = 0; i < crowd.length - config.baseCrowd; i++) {
    const p = crowd[config.baseCrowd + i];
    const slot = i % perBand;
    const x = perBand === 4 ? [85, 190, 300, 405][slot]
      : [65, 135, 205, 275, 345, 415][slot];
    const y = bands[Math.floor(i / perBand)] + (slot % 2 ? 34 : -34)
      + (rand() - 0.5) * 12;
    p.x = x;
    p.y = y;
    p.group = undefined;
    p.anchor = false;
    p.reaction = null;
    p.leg = 0;
    p.cycle = 0;
    p.active = true;
    if (stage === 4) {
      p.spot = { x, y };
      p.entry = { x: slot % 2 ? -24 : 504, y: config.startY + 80 };
      p.route = [p.spot, { ...p.spot }, p.entry,
        { x: slot % 2 ? 70 : 410, y: p.entry.y }];
      audienceShift(p);
      p.state = "watching";
      p.wait = 5 + (i % 4) * 2;
      p.vx = p.vy = 0;
      p.ux = 0;
      p.uy = -1;
      continue;
    }
    const standing = slot === 2;
    const along = slot === 0 || slot === perBand - 1;
    const eastbound = slot % 2 === 0;
    p.entry = along ? { x, y: config.startY + 80 }
      : { x: eastbound ? -55 : 535, y };
    p.route = standing
      ? [{ x, y }, { x: x < 240 ? 65 : 415, y: y - 28 }]
      : along ? [{ x, y: -80 }]
        : [{ x: eastbound ? 535 : -55, y: y + (slot % 2 ? 20 : -20) }];
    p.flow = along ? "along" : "crossing";
    p.origin = along ? "south" : eastbound ? "west" : "east";
    p.destination = along ? "north" : eastbound ? "east" : "west";
    const profile = FLOW_PROFILES[p.environment];
    p.originName = profile.places[p.origin];
    p.destinationName = profile.places[p.destination];
    p.habit = standing ? "meeting" : "direct";
    p.state = standing ? "meeting" : "walking";
    p.pauseDuration = standing ? 8 + (i % 3) * 2 : 0;
    p.wait = p.pauseDuration;
    p.pace = config.speed * profile.pace * (0.82 + rand() * 0.22);
    aim(p);
    p.vx = standing ? 0 : p.ux * p.pace;
    p.vy = standing ? 0 : p.uy * p.pace;
  }
}
export function visiblePerson(p) {
  return (
    p.active &&
    p.x > 18 &&
    p.x < 462 &&
    p.y > (p.environment === "party" ? 32 : 110) &&
    p.y < (p.boundsH || 670)
  );
}
