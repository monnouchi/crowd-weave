// Keep the rendered circular feet apart. The same radius is used for contact
// scoring; no invisible rectangular barrier stands between the player and gap.
export const BODY_GAP = 0.35;

function firstHit(from, delta, person, radius) {
  const fx = from.x - person.x,
    fy = from.y - person.y,
    a = delta.x * delta.x + delta.y * delta.y,
    c = fx * fx + fy * fy - radius * radius,
    approach = fx * delta.x + fy * delta.y;
  if (a < 1e-10 || approach >= -1e-8) return null;
  if (c <= 0) return 0;
  const discriminant = approach * approach - a * c;
  if (discriminant < 0) return null;
  const time = (-approach - Math.sqrt(discriminant)) / a;
  return time >= 0 && time <= 1 ? time : null;
}

export function resolvePlayerMove(from, desired, radius, people) {
  if (!people.length)
    return { point: { x: desired.x, y: desired.y }, contacts: new Set() };
  const contacts = new Set(),
    point = { x: from.x, y: from.y };
  // A pedestrian may walk into a stopped player. Give ground along the path
  // while preserving the chosen lane; a side bump cannot steer the game for us.
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const person of people) {
      const safe = radius + person.r + BODY_GAP,
        dx = point.x - person.x,
        dy = point.y - person.y,
        distance = Math.hypot(dx, dy);
      if (distance >= safe) continue;
      contacts.add(person.id);
      // Someone arriving from behind must not launch us through the person
      // ahead. Let the player keep walking away while the other body yields.
      if (dy < 0) continue;
      point.y = person.y + Math.sqrt(Math.max(0, safe * safe - dx * dx));
      changed = true;
    }
    if (!changed) break;
  }
  // Steering along the front of a person may give a little ground. This lets
  // someone recover after bumping into a group without passing through it.
  const lateral = desired.x - from.x,
    slices = Math.ceil(Math.abs(lateral) / 2);
  for (let slice = 0; slice < slices; slice++) {
    const x = point.x + lateral / slices;
    let y = point.y,
      blocked = false;
    for (const person of people) {
      const safe = radius + person.r + BODY_GAP,
        dx = x - person.x;
      if (Math.abs(dx) >= safe) continue;
      const edge = Math.sqrt(safe * safe - dx * dx);
      if (Math.abs(y - person.y) >= edge) continue;
      contacts.add(person.id);
      if (y < person.y) blocked = true;
      else y = Math.max(y, person.y + edge);
    }
    if (blocked) break;
    point.x = x;
    point.y = y;
  }
  const forward = { x: 0, y: desired.y - from.y };
  let earliest = 1,
    blocked = null;
  for (const person of people) {
    const time = firstHit(
      point,
      forward,
      person,
      radius + person.r + BODY_GAP,
    );
    if (time !== null && time < earliest) {
      earliest = time;
      blocked = person;
    }
  }
  point.y += forward.y * (blocked ? Math.max(0, earliest - 0.0001) : 1);
  if (blocked) contacts.add(blocked.id);
  return { point, contacts };
}

export function followerProgress(from, desired, radius, people) {
  const contacts = new Set(),
    delta = { x: desired.x - from.x, y: desired.y - from.y };
  let fraction = 1;
  for (const person of people) {
    const safe = radius + person.r + BODY_GAP,
      start = Math.hypot(from.x - person.x, from.y - person.y),
      end = Math.hypot(desired.x - person.x, desired.y - person.y);
    if (start < safe && end <= start + 0.0001) {
      contacts.add(person.id);
      fraction = 0;
      continue;
    }
    if (start < safe) continue; // A walker entered the follower's space; let it leave.
    const hit = firstHit(from, delta, person, safe);
    if (hit !== null && hit < fraction) {
      contacts.add(person.id);
      fraction = hit;
    }
  }
  return {
    fraction: fraction < 1 ? Math.max(0, fraction - 0.0001) : 1,
    contacts,
  };
}
