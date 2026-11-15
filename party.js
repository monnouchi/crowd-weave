import { FRIEND_LOOKS } from "./src/appearance.js";

// Followers replay the player's measured polyline; progress is monotonic.
export const FRIENDS = [
  { id: 1, name: "友だち1", shirt: "#d5ab53" },
  { id: 2, name: "友だち2", shirt: "#83a9bb" },
  { id: 3, name: "友だち3", shirt: "#cc8b74" },
  { id: 4, name: "友だち4", shirt: "#9788a9" },
];
export const PARTY_SPACING = 30;
// World y decreases along both a stage and the seamless course.
export const FOLLOWER_PROGRESS_MARGIN = 1;
const YIELD_CLEARANCE = 24;

function constrainFollowTarget(target, member, player) {
  const floor = player.y + FOLLOWER_PROGRESS_MARGIN;
  if (target.y >= floor) return target;
  // An already-ahead follower must not be pushed back or advanced further.
  if (member.y < floor && target.y <= member.y) return { x: member.x, y: member.y };
  target = { ...target, y: Math.min(floor, Math.max(member.y, target.y)) };
  // A reversal can put the old trail in front of the player. Give the player
  // a lane as well as moving the follower behind the current course position.
  if (Math.abs(target.x - player.x) < YIELD_CLEARANCE) {
    let side = target.x === player.x
      ? (player.x <= 240 ? 1 : -1)
      : Math.sign(target.x - player.x);
    if (player.x + side * YIELD_CLEARANCE < 30 ||
        player.x + side * YIELD_CLEARANCE > 450) side *= -1;
    target.x = Math.max(30, Math.min(450, player.x + side * YIELD_CLEARANCE));
  }
  return target;
}
export function createParty(count, player) {
  const tail = (count + 2) * PARTY_SPACING;
  return {
    distance: 0,
    regroup: 0,
    chimed: false,
    reunionArmed: false,
    trail: [
      { x: player.x, y: player.y + tail, s: -tail },
      { x: player.x, y: player.y, s: 0 },
    ],
    members: FRIENDS.slice(0, count).map((friend, i) => ({
      ...friend,
      appearanceId: FRIEND_LOOKS[i],
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
  { braking = false, stunned = false, arriving = false, resolveFollower } = {},
) {
  appendTrail(party, player);
  if (!braking) party.reunionArmed = false;
  else if (party.members.some((member, i) =>
    party.distance - member.s > (i + 1) * PARTY_SPACING + 12))
    party.reunionArmed = true;
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
    const aheadS = i ? party.members[i - 1].s : party.distance,
      proposedS = Math.max(
        m.s,
        Math.min(
          target,
          arriving ? target : aheadS - Math.max(22, spacing - 2),
          m.s + 140 * dt,
        ),
      ),
      sampledProposal = sampleTrail(party.trail, proposedS),
      proposed = !arriving && proposedS > m.s
        ? constrainFollowTarget(sampledProposal, m, player)
        : sampledProposal,
      fraction = resolveFollower
        ? Math.max(0, Math.min(1, resolveFollower(m, proposed)))
        : 1;
    const previousS = m.s;
    m.s += (proposedS - m.s) * fraction;
    const sampled = sampleTrail(party.trail, m.s);
    const next = arriving ? sampled : m.s > previousS
      ? constrainFollowTarget(sampled, m, player)
      : previous;
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
export function regroupReady(party) {
  return party.members.length > 0 && party.regroup >= 0.95 &&
    party.members.every((member, i) =>
      !member.docked &&
      party.distance - member.s <=
        (i + 1) * (PARTY_SPACING - 6 * party.regroup) + 7);
}
export function partyArrived(party) {
  return party.members.every((m) => m.docked);
}
