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
        remaining: spec.greenStart,
        canEnter: false,
        reserved: false,
        redId: 0,
        vehicle: vehicle(0),
        violations: 0,
        violationEvent: null,
        enteredOnGreen: false,
        vehicleClear: true,
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
  t.vehicleClear = cleared;
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
    if (aligned && t.vehicleClear) {
      t.reserved = true;
      t.enteredOnGreen = t.nominalGreen;
      if (!t.nominalGreen) {
        t.violations++;
        g.elapsed += 2;
        const member = g.party.members[0];
        t.violationEvent = {
          id: t.violations,
          memberId: member?.id || 0,
          message: member
            ? t.violations % 2
              ? "おい、赤だぞ！"
              : "止まれよ！"
            : "",
        };
      }
      t.message = "仲間全員で横断中";
      return;
    }
    g.player.y = stop;
    // Color never forces the player's brake. An actual car still occupying the
    // crossing or leaving the marked crossing requires physical clearance.
    t.message = aligned ? "車の通過を待とう" : "横断歩道へ寄ろう";
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
