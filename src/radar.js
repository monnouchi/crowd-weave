import { visiblePerson } from "../crowd.js";
import { FRONT_BARRIER_Y } from "../logic.js";

// The forward axis points toward the goal. Geometry is expressed relative to
// the player's centre, so the display never reveals another part of a stage.
const DEFAULT_VIEW = Object.freeze({ side: 104, ahead: 150, behind: 45 });
const STREET_LEFT = 30;
const STREET_RIGHT = 450;

export function radarSnapshot(run, view = DEFAULT_VIEW) {
  const { side, ahead, behind } = view;
  const { x: playerX, y: playerY, r: playerRadius } = run.player;
  const inView = (x, y, radius) => x + radius >= -side &&
    x - radius <= side && y + radius >= -behind && y - radius <= ahead;
  const walls = [];

  // All physical line barriers in the game are axis aligned. Clip them to
  // this small local window before handing them to the renderer.
  const wall = (x1, y1, x2, y2) => {
    const ax = x1 - playerX, ay = playerY - y1;
    const bx = x2 - playerX, by = playerY - y2;
    if (x1 === x2) {
      if (ax < -side || ax > side) return;
      const low = Math.max(-behind, Math.min(ay, by));
      const high = Math.min(ahead, Math.max(ay, by));
      if (high >= low) walls.push({ x1: ax, y1: low, x2: ax, y2: high });
    } else {
      if (ay < -behind || ay > ahead) return;
      const low = Math.max(-side, Math.min(ax, bx));
      const high = Math.min(side, Math.max(ax, bx));
      if (high >= low) walls.push({ x1: low, y1: ay, x2: high, y2: ay });
    }
  };

  // Player-centre limits. Decorative buildings and trees do not enter this
  // list because they have no collider in the movement rules.
  const top = run.stage === 4 ? FRONT_BARRIER_Y + playerRadius : 32;
  const bottom = run.worldHeight - 25;
  wall(STREET_LEFT, top, STREET_LEFT, bottom);
  wall(STREET_RIGHT, top, STREET_RIGHT, bottom);
  wall(STREET_LEFT, bottom, STREET_RIGHT, bottom);
  wall(STREET_LEFT, top, STREET_RIGHT, top);

  // Only the central entrance admits the player beyond y=107 outdoors.
  if (run.stage !== 4) {
    wall(STREET_LEFT, 107, 174, 107);
    wall(306, 107, STREET_RIGHT, 107);
  } else {
    // The hall narrows at two real doorways before the audience section.
    wall(48, top, 48, 650);
    wall(432, top, 432, 650);
    for (const [narrowTop, narrowBottom] of [[790, 825], [685, 720]]) {
      const approach = narrowBottom + 12;
      wall(STREET_LEFT, approach, 142, approach);
      wall(338, approach, STREET_RIGHT, approach);
      wall(142, narrowTop - 12, 142, approach);
      wall(338, narrowTop - 12, 338, approach);
    }
  }

  const roads = [];
  for (const crossing of run.crossings || []) {
    const front = playerY - crossing.top;
    const back = playerY - crossing.bottom;
    if (front < -behind || back > ahead) continue;
    roads.push({
      id: crossing.id || "road",
      front: Math.min(ahead, front),
      back: Math.max(-behind, back),
      left: crossing.left - playerX,
      right: crossing.right - playerX,
      canEnter: !!(crossing.canEnter || crossing.reserved),
      nominalGreen: !!crossing.nominalGreen,
    });
    const laneLeft = crossing.left + playerRadius;
    const laneRight = crossing.right - playerRadius;
    if (crossing.crossing) {
      wall(laneLeft, crossing.top - playerRadius,
        laneLeft, crossing.bottom + playerRadius);
      wall(laneRight, crossing.top - playerRadius,
        laneRight, crossing.bottom + playerRadius);
    } else {
      const stop = crossing.bottom + playerRadius + 2;
      wall(STREET_LEFT, stop, laneLeft, stop);
      wall(laneRight, stop, STREET_RIGHT, stop);
    }
  }

  const actors = [];
  for (const person of run.crowd || []) {
    if (!visiblePerson(person)) continue;
    const x = person.x - playerX, y = playerY - person.y;
    if (inView(x, y, person.r))
      actors.push({ id: person.id, kind: "person", x, y,
        r: person.r, vx: person.vx || 0, vy: person.vy ? -person.vy : 0 });
  }
  for (const animal of run.animals || []) {
    if (!animal.active) continue;
    const x = animal.x - playerX, y = playerY - animal.y;
    if (inView(x, y, animal.r))
      actors.push({ id: animal.id, kind: "animal", x, y,
        r: animal.r, vx: animal.vx || 0, vy: animal.vy ? -animal.vy : 0 });
  }

  const vehicles = [];
  for (const crossing of run.crossings || []) {
    const vehicle = crossing.vehicle;
    if (!vehicle || (!vehicle.active && !vehicle.wasActive)) continue;
    const x = vehicle.x - playerX, y = playerY - vehicle.y;
    const previousX = (vehicle.previousX ?? vehicle.x) - playerX;
    const width = vehicle.width, height = vehicle.kind === "car" ? 30 : 16;
    // A vehicle can cross the edge of this window during the current frame.
    // Keep the same swept interval that can still cause a collision this tick.
    if (Math.max(x, previousX) + width / 2 >= -side &&
        Math.min(x, previousX) - width / 2 <= side &&
        y + height / 2 >= -behind && y - height / 2 <= ahead)
      vehicles.push({ id: `${crossing.id || "road"}:${vehicle.id}`,
        kind: vehicle.kind, x, previousX, y, width, height,
        direction: vehicle.direction });
  }

  return { side, ahead, behind, playerRadius, actors, vehicles, walls, roads };
}
