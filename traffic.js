// Original traffic rules for the two outdoor approaches. All clocks are game clocks.
export function trafficSpec(stage) {
  return stage === 1 || stage === 3
    ? {
        top: 300,
        bottom: 365,
        left: 150,
        right: 330,
        period: 12,
        greenStart: 4,
        greenEnd: 9.5,
      }
    : null;
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
export function createTraffic(stage) {
  const spec = trafficSpec(stage);
  return spec
    ? {
        ...spec,
        green: false,
        nominalGreen: false,
        remaining: 4,
        canEnter: false,
        reserved: false,
        redId: 0,
        vehicle: vehicle(0),
        safetyStops: 0,
        lastEmergencyId: -1,
        message: "",
      }
    : null;
}
export function crossingTime(party) {
  // Full crossing, head/tail body margin, maximum trail spacing and reaction margin.
  return (65 + 24 + party.members.length * 30) / 75 + 0.65;
}
export function updateTraffic(g, dt) {
  const t = g.traffic;
  if (!t) return;
  const phase = g.worldTime % t.period;
  t.nominalGreen = phase >= t.greenStart && phase < t.greenEnd;
  t.remaining = t.nominalGreen
    ? t.greenEnd - phase
    : phase < t.greenStart
      ? t.greenStart - phase
      : t.period - phase + t.greenStart;
  const team = [g.player, ...g.party.members];
  if (t.reserved && team.every((p) => p.y + p.r < t.top - 2))
    t.reserved = false;
  const redId = Math.floor((g.worldTime + t.period - t.greenEnd) / t.period);
  if (t.redId !== redId) {
    t.redId = redId;
    t.vehicle = vehicle(redId);
  }
  const v = t.vehicle;
  const occupied = [...g.crowd.filter((p) => p.active), ...team].some(
    (p) =>
      p.y + p.r > t.top - 5 &&
      p.y - p.r < t.bottom + 5 &&
      p.x + p.r > -10 &&
      p.x - p.r < 490,
  );
  if (v.active) {
    // Traffic yields before entering whenever anyone is in the road. A reserved
    // party never loses its crossing even if a pedestrian contact delays the tail.
    if (v.entered || (!t.nominalGreen && !t.reserved && !occupied)) {
      v.x += v.direction * v.speed * dt;
      if (v.x + v.width / 2 > 0 && v.x - v.width / 2 < 480) v.entered = true;
    } else if (t.nominalGreen && !v.entered) v.active = false;
    if (v.x > 640 || v.x < -160) v.active = false;
  }
  const cleared =
    !v.active ||
    !v.entered ||
    (v.direction > 0
      ? v.x > t.right + v.width / 2 + 28
      : v.x < t.left - v.width / 2 - 28);
  t.green = t.nominalGreen && cleared;
  t.canEnter = t.reserved || (t.green && t.remaining >= crossingTime(g.party));
  t.warning = t.green && !t.canEnter;
}
export function constrainTraffic(g, previous, input) {
  const t = g.traffic;
  if (!t) return;
  if (t.reserved) {
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
    if (aligned && t.canEnter) {
      t.reserved = true;
      t.message = "仲間全員で横断中";
      return;
    }
    g.player.y = stop;
    t.message = aligned
      ? t.warning
        ? "次の青まで待とう"
        : "赤信号 · 両押しで待とう"
      : "横断歩道へ寄ろう";
    const axis = Number.isFinite(input.axis)
      ? input.axis
      : Number(!!input.right) - Number(!!input.left);
    if (
      aligned &&
      !t.green &&
      Math.abs(axis) < 0.1 &&
      t.lastEmergencyId !== t.redId
    ) {
      // Forgiving emergency stop: visible time loss, never a violent impact.
      t.lastEmergencyId = t.redId;
      t.safetyStops++;
      g.elapsed += 2;
    }
  }
}
export function trafficWaypoint(p, target, t) {
  if (
    !t ||
    (p.y < t.top && target.y < t.top) ||
    (p.y > t.bottom && target.y > t.bottom)
  )
    return target;
  const north = target.y < t.top && p.y > t.top;
  const south = target.y > t.bottom && p.y < t.bottom;
  if (!north && !south) return target;
  const left = t.left + 16,
    right = t.right - 16;
  if ((north && p.y >= t.bottom + 13) || (south && p.y <= t.top - 13)) {
    if (p.x < left || p.x > right)
      return {
        x: Math.max(left, Math.min(right, p.x)),
        y: north ? t.bottom + 60 : t.top - 60,
      };
  }
  return {
    x: Math.max(left, Math.min(right, p.x)),
    y: north ? t.top - 18 : t.bottom + 18,
  };
}
export function trafficBlocks(p, vy, t, dt) {
  if (!t) return false;
  const enough =
    t.green &&
    t.remaining > (t.bottom - t.top + 26) / Math.max(12, p.pace) + 0.7;
  if (enough) return false;
  return (
    (vy < 0 && p.y >= t.bottom + 15 && p.y + vy * dt < t.bottom + 15) ||
    (vy > 0 && p.y <= t.top - 15 && p.y + vy * dt > t.top - 15)
  );
}
