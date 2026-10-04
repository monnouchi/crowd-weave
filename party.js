// Followers replay the player's measured polyline; progress is monotonic.
export const FRIENDS = [
  { id: 1, name: "友だち1", shirt: "#d5ab53" },
  { id: 2, name: "友だち2", shirt: "#83a9bb" },
  { id: 3, name: "友だち3", shirt: "#cc8b74" },
  { id: 4, name: "友だち4", shirt: "#9788a9" },
];
export const PARTY_SPACING = 30;
export function createParty(count, player) {
  const tail = (count + 2) * PARTY_SPACING;
  return {
    distance: 0,
    regroup: 0,
    chimed: false,
    trail: [
      { x: player.x, y: player.y + tail, s: -tail },
      { x: player.x, y: player.y, s: 0 },
    ],
    members: FRIENDS.slice(0, count).map((friend, i) => ({
      ...friend,
      friend: true,
      r: 9,
      x: player.x,
      y: player.y + (i + 1) * PARTY_SPACING,
      s: -(i + 1) * PARTY_SPACING,
      ux: 0,
      uy: -1,
      walk: 0,
      state: "following",
      docked: false,
      docking: false,
      flash: 0,
    })),
  };
}
export function sampleTrail(trail, s) {
  if (s <= trail[0].s) return { x: trail[0].x, y: trail[0].y };
  for (let i = 1; i < trail.length; i++) {
    const b = trail[i],
      a = trail[i - 1];
    if (s <= b.s) {
      const t = (s - a.s) / (b.s - a.s || 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { ...trail.at(-1) };
}
export function appendTrail(party, player) {
  const end = party.trail.at(-1),
    d = Math.hypot(player.x - end.x, player.y - end.y);
  if (d < 0.000001) return;
  party.distance += d;
  party.trail.push({ x: player.x, y: player.y, s: party.distance });
  const n = party.trail.length;
  if (n > 2) {
    const [a, b, c] = party.trail.slice(-3),
      abx = b.x - a.x,
      aby = b.y - a.y,
      bcx = c.x - b.x,
      bcy = c.y - b.y;
    if (
      Math.abs(abx * bcy - aby * bcx) < 0.000001 &&
      abx * bcx + aby * bcy >= 0
    )
      party.trail.splice(n - 2, 1);
  }
}
function advance(member, target, limit) {
  const dx = target.x - member.x,
    dy = target.y - member.y,
    d = Math.hypot(dx, dy);
  if (d === 0) return;
  const ratio = Math.min(1, limit / d);
  member.x += dx * ratio;
  member.y += dy * ratio;
  member.ux = dx / d;
  member.uy = dy / d;
  member.walk += d * ratio;
}
const SLOTS = [
  { x: 210, y: 84 },
  { x: 270, y: 84 },
  { x: 210, y: 54 },
  { x: 270, y: 54 },
];
export function moveParty(
  party,
  player,
  dt,
  { braking = false, stunned = false, arriving = false } = {},
) {
  appendTrail(party, player);
  party.regroup = Math.max(
    0,
    Math.min(1, party.regroup + dt * (braking ? 1.25 : -0.8)),
  );
  const spacing = PARTY_SPACING - 6 * party.regroup;
  for (let i = 0; i < party.members.length; i++) {
    const m = party.members[i];
    m.flash = Math.max(0, m.flash - dt);
    if (stunned || m.docked) continue;
    if (
      arriving &&
      Math.hypot(m.x - player.x, m.y - player.y) < 45 &&
      m.y <= 120
    )
      m.docking = true;
    if (m.docking) {
      const slot = (party.dockSlots || SLOTS)[i];
      advance(m, slot, 85 * dt);
      m.state = "docking";
      if (Math.hypot(m.x - slot.x, m.y - slot.y) < 0.01) {
        m.docked = true;
        m.state = "docked";
      }
      continue;
    }
    const target = arriving
      ? party.distance
      : party.distance - (i + 1) * spacing;
    const previous = { x: m.x, y: m.y };
    m.s = Math.max(m.s, Math.min(target, m.s + 140 * dt));
    const next = sampleTrail(party.trail, m.s);
    m.x = next.x;
    m.y = next.y;
    const dx = m.x - previous.x,
      dy = m.y - previous.y,
      d = Math.hypot(dx, dy);
    if (d > 0) {
      m.ux = dx / d;
      m.uy = dy / d;
      m.walk += d;
    }
    m.state = d > 0.01 ? "following" : "waiting";
  }
  const earliest =
    Math.min(
      party.distance,
      ...party.members.filter((m) => !m.docking).map((m) => m.s),
    ) - 10;
  while (party.trail.length > 2 && party.trail[1].s < earliest)
    party.trail.shift();
}
export function partyArrived(party) {
  return party.members.every((m) => m.docked);
}
