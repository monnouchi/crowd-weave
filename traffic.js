// Original traffic rules for the two outdoor approaches. All clocks are game clocks.
export function trafficSpec(stage) {
  return stage === 1 || stage === 3
    ? {
        top: 300,
        bottom: 365,
        left: 150,
        right: 330,
        period: 9,
        greenStart: 2.5,
        greenEnd: 9,
        phaseOffset: 6.7,
        lanes: 2,
      }
    : null;
}
export function trafficSpecs(stage) {
  if (stage === 3)
    return [
      {
        ...trafficSpec(stage),
        id: "avenue",
        top: 780,
        bottom: 925,
        lanes: 4,
        period: 11.5,
        greenEnd: 11.5,
        phaseOffset: 10.1,
      },
      {
        ...trafficSpec(stage),
        id: "park",
        top: 300,
        bottom: 365,
        phaseOffset: 8,
      },
    ];
  const spec = trafficSpec(stage);
  return spec ? [{ ...spec, id: "station" }] : [];
}
export function activeTraffic(g) {
  const crossings = g.crossings || (g.traffic ? [g.traffic] : []);
  return (
    crossings.find((t) => t.reserved) ||
    crossings.find((t) => g.player.y >= t.top - 30) ||
    crossings.at(-1) ||
    null
  );
}
export function trafficViolations(g) {
  return (g.crossings || (g.traffic ? [g.traffic] : [])).reduce(
    (n, t) => n + t.violations,
    0,
  );
}
export function walkerTraffic(p, target, traffic) {
  if (!Array.isArray(traffic)) return traffic;
  const north = target.y < p.y;
  return (
    [...traffic]
      .sort((a, b) => (north ? b.top - a.top : a.top - b.top))
      .find((t) =>
        north
          ? p.y > t.top - 60 && target.y < t.top
          : p.y < t.bottom + 60 && target.y > t.bottom,
      ) || null
  );
}
function vehicle(id) {
  const bicycle = id % 2 === 1;
  return {
    id,
    kind: bicycle ? "bicycle" : "car",
    x: bicycle ? 620 : -140,
    y: bicycle ? 346 : 319,
    direction: bicycle ? -1 : 1,
    speed: bicycle ? 235 : 250,
    width: bicycle ? 32 : 58,
    active: true,
    entered: false,
  };
}
export function createTraffic(stage, spec = trafficSpec(stage)) {
  return spec
    ? {
        ...spec,
        green: false,
        nominalGreen: false,
        remaining: spec.greenStart,
        canEnter: false,
        reserved: false,
        crossing: false,
        redId: 0,
        vehicle: {
          ...vehicle(0),
          y: spec.top + (spec.bottom - spec.top) * 0.375,
        },
        violations: 0,
        violationEvent: null,
        enteredOnGreen: false,
        vehicleClear: true,
        message: "",
      }
    : null;
}
export function crossingTime(party, crossing = { top: 300, bottom: 365 }) {
  // Full crossing, head/tail body margin, maximum trail spacing and reaction margin.
  return (
    (crossing.bottom - crossing.top + 24 + party.members.length * 30) / 75 +
    0.65
  );
}
export function updateTraffic(g, dt) {
  for (const t of g.crossings || (g.traffic ? [g.traffic] : []))
    updateCrossing(g, t, dt);
  g.traffic = activeTraffic(g);
}
function updateCrossing(g, t, dt) {
  const clock = g.worldTime + (t.phaseOffset || 0);
  const phase = clock % t.period;
  t.nominalGreen = phase >= t.greenStart && phase < t.greenEnd;
  t.remaining = t.nominalGreen
    ? t.greenEnd - phase
    : phase < t.greenStart
      ? t.greenStart - phase
      : t.period - phase + t.greenStart;
  const team = [g.player, ...g.party.members];
  if (t.crossing && team.every((p) => p.y + p.r < t.top - 2)) {
    t.reserved = false;
    t.crossing = false;
  }
  const redId = Math.floor((clock + t.period - t.greenEnd) / t.period);
  if (t.redId !== redId) {
    t.redId = redId;
    t.vehicle = vehicle(redId);
    t.vehicle.y =
      t.top +
      (t.bottom - t.top) * (t.vehicle.kind === "bicycle" ? 0.875 : 0.375);
  }
  const v = t.vehicle;
  const occupied = [
    ...g.crowd.filter((p) => p.active),
    ...(t.reserved ? team : []),
  ].some(
    (p) =>
      p.y + p.r > t.top - 5 &&
      p.y - p.r < t.bottom + 5 &&
      p.x + p.r > -10 &&
      p.x - p.r < 490,
  );
  v.previousX = v.x;
  v.wasActive = v.active;
  if (v.active) {
    // Traffic yields before entering whenever anyone is in the road. A reserved
    // party never loses its crossing even if a pedestrian contact delays the tail.
    if (v.entered || (!t.nominalGreen && !t.reserved && !occupied)) {
      v.x += v.direction * v.speed * dt;
      if (
        Math.max(v.previousX, v.x) + v.width / 2 > 0 &&
        Math.min(v.previousX, v.x) - v.width / 2 < 480
      )
        v.entered = true;
    } else if (t.nominalGreen && !v.entered) v.active = false;
    if (v.x > 640 || v.x < -160) v.active = false;
  }
  const cleared =
    !v.active ||
    !v.entered ||
    (v.direction > 0
      ? v.x > t.right + v.width / 2 + 28
      : v.x < t.left - v.width / 2 - 28);
  t.vehicleClear = cleared;
  t.green = t.nominalGreen && cleared;
  t.canEnter =
    t.reserved || (t.green && t.remaining >= crossingTime(g.party, t));
  t.warning = t.green && !t.canEnter;
}
export function constrainTraffic(g, previous, input) {
  for (const t of g.crossings || (g.traffic ? [g.traffic] : []))
    constrainCrossing(g, t, previous, input);
}
function constrainCrossing(g, t, previous, input) {
  if (t.crossing) {
    if (g.player.y + g.player.r >= t.top && g.player.y - g.player.r <= t.bottom)
      g.player.x = Math.max(
        t.left + g.player.r,
        Math.min(t.right - g.player.r, g.player.x),
      );
    return;
  }
  const stop = t.bottom + g.player.r + 2;
  if (previous.y >= stop && g.player.y < stop) {
    const aligned =
      g.player.x >= t.left + g.player.r && g.player.x <= t.right - g.player.r;
    if (aligned) {
      t.crossing = true;
      t.reserved = t.nominalGreen && t.vehicleClear;
      t.enteredOnGreen = t.nominalGreen;
      if (!t.nominalGreen) {
        t.violations++;
        g.elapsed += 2;
        const member = g.party.members[0];
        t.violationEvent = {
          id: `${t.id || "road"}:${t.violations}`,
          memberId: member?.id || 0,
          message: member
            ? t.violations % 2
              ? "おい、赤だぞ！"
              : "止まれよ！"
            : "",
        };
        g.violationEvent = t.violationEvent;
      }
      t.message = "仲間全員で横断中";
      return;
    }
    g.player.y = stop;
    // Only the marked crossing's physical approach constrains lateral entry.
    // Signal color and an occupied vehicle lane never apply the player's brake.
    t.message = "横断歩道へ寄ろう";
  }
}
function crossingLane(p, target, t) {
  if (!t) return null;
  // Keep opposing flows apart through the approach, crossing and exit. Groups
  // share a lane; their original destinations and walking habits stay intact.
  const north = target.y < t.top && p.y > t.top - 60;
  const south = target.y > t.bottom && p.y < t.bottom + 60;
  if (!north && !south) return null;
  const identity = p.group
      ? [...p.group].reduce((n, char) => n + char.charCodeAt(0), 0)
      : p.id,
    lane = (north ? t.right - 40 : t.left + 40) + ((identity % 3) - 1) * 6;
  return { north, lane };
}
export function trafficWaypoint(p, target, t) {
  const crossing = crossingLane(p, target, t);
  if (!crossing) return target;
  const { north, lane } = crossing;
  if (
    Math.abs(p.x - lane) > 8 &&
    (north ? p.y >= t.bottom + 15 : p.y <= t.top - 15)
  )
    return {
      x: lane,
      y: north ? Math.min(p.y, t.bottom + 60) : Math.max(p.y, t.top - 60),
    };
  return {
    x: lane,
    y: north ? t.top - 60 : t.bottom + 60,
  };
}
export function trafficBlocks(p, vy, t, dt) {
  if (!t) return false;
  const crossing = crossingLane(p, p.route[p.leg], t);
  const enough =
    t.green &&
    (!crossing || Math.abs(p.x - crossing.lane) <= 12) &&
    t.remaining > (t.bottom - t.top + 26) / Math.max(12, p.pace) + 0.7;
  if (enough) return false;
  return (
    (vy < 0 && p.y >= t.bottom + 15 && p.y + vy * dt < t.bottom + 15) ||
    (vy > 0 && p.y <= t.top - 15 && p.y + vy * dt > t.top - 15)
  );
}

function segmentBox(a, b, left, top, right, bottom) {
  let enter = 0,
    leave = 1;
  for (const [start, delta, low, high] of [
    [a.x, b.x - a.x, left, right],
    [a.y, b.y - a.y, top, bottom],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < low || start > high) return null;
      continue;
    }
    let first = (low - start) / delta,
      last = (high - start) / delta;
    if (first > last) [first, last] = [last, first];
    enter = Math.max(enter, first);
    leave = Math.min(leave, last);
    if (enter > leave) return null;
  }
  return enter;
}
function segmentCircle(a, b, x, y, r) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    ox = a.x - x,
    oy = a.y - y;
  const c = ox * ox + oy * oy - r * r;
  if (c <= 0) return 0;
  const length = dx * dx + dy * dy;
  if (!length) return null;
  const dot = ox * dx + oy * dy,
    disc = dot * dot - length * c;
  if (disc < 0) return null;
  const t = (-dot - Math.sqrt(disc)) / length;
  return t >= 0 && t <= 1 ? t : null;
}
// Exact swept circle against the vehicle rectangle, including rounded corners.
// The bags keep the existing owner body radius; no extra invisible hitbox.
export function sweptVehicleContact(vehicle, previous, current) {
  const a = {
    x: previous.x - (vehicle.previousX ?? vehicle.x),
    y: previous.y - vehicle.y,
  };
  const b = { x: current.x - vehicle.x, y: current.y - vehicle.y };
  const w = vehicle.width / 2,
    h = vehicle.kind === "car" ? 15 : 8,
    r = current.r;
  const times = [
    segmentBox(a, b, -w - r, -h, w + r, h),
    segmentBox(a, b, -w, -h - r, w, h + r),
  ];
  for (const x of [-w, w])
    for (const y of [-h, h]) times.push(segmentCircle(a, b, x, y, r));
  const hits = times.filter((t) => t !== null);
  return hits.length ? Math.min(...hits) : null;
}
export function vehicleContact(g, previousTeam) {
  let first = null;
  for (const t of g.crossings || []) {
    const v = t.vehicle;
    if (!v.active && !v.wasActive) continue;
    const team = [g.player, ...g.party.members];
    for (let i = 0; i < team.length; i++) {
      const time = sweptVehicleContact(v, previousTeam[i], team[i]);
      if (time !== null && (!first || time < first.time))
        first = {
          crossingId: t.id || "road",
          vehicleKind: v.kind,
          memberId: team[i].id || 0,
          time,
        };
    }
  }
  return first;
}
