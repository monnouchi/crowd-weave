import { visiblePerson } from "./crowd.js";

// A small orthographic 3D renderer. Geometry has world X/Y ground coordinates
// and height Z; the unchanged game model owns every hitbox and movement rule.
const AZIMUTH = 0.32;
const DEPTH = 0.72;
const HEIGHT = 1.12;
const CROWD_SHIRTS = ["#bd7255", "#6e8064", "#b49365", "#71818e", "#995f54"];

export const GOAL_HOUSES = Object.freeze([
  Object.freeze({ x: 24, y: -130, w: 136, d: 190, face: "east", style: 0, goal: true }),
  Object.freeze({ x: 320, y: -130, w: 136, d: 190, face: "west", style: 1, goal: true }),
]);

export function streetHouses() {
  const rows = [145, 362, 580];
  return rows.flatMap((y, i) => [
    { x: -115 + (i % 2) * 8, y, w: 135, d: 158 + (i % 2) * 10, face: "east", style: (i + 2) % 4 },
    { x: 460 - (i % 2) * 7, y: y + (i % 2) * 13, w: 135, d: 150 + (i % 2) * 13, face: "west", style: (i + 1) % 4 },
  ]);
}

export function houseDoor(house) {
  return {
    x: house.face === "east" ? house.x + house.w : house.x,
    y: house.y + house.d * 0.62,
    top: 27,
    facing: house.face,
  };
}

export function makeProjector(width, height, focusY) {
  const portrait = width < 620 && height > width;
  const top = portrait ? 148 : 42;
  const bottom = portrait ? 106 : 34;
  const usable = Math.max(240, height - top - bottom);
  const scale = Math.min(width / 640, usable / 540, 1.35);
  const centerY = top + usable * 0.66;
  function point(x, y, z = 0) {
    const dx = x - 240;
    const dy = y - focusY;
    return {
      x: width / 2 + (dx * (1 - AZIMUTH * AZIMUTH / 2) - dy * AZIMUTH) * scale,
      y: centerY + ((dx * AZIMUTH + dy * (1 - AZIMUTH * AZIMUTH / 2)) * DEPTH - z * HEIGHT) * scale,
    };
  }
  return { point, scale, width, height, top, bottom };
}

function path(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function face(ctx, projector, vertices, fill, stroke = null, width = 1) {
  path(ctx, vertices.map(([x, y, z]) => projector.point(x, y, z)), fill, stroke, width);
}

function segment(ctx, projector, a, b, color, width = 1) {
  const start = projector.point(...a);
  const end = projector.point(...b);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

function groundRect(ctx, projector, x0, y0, x1, y1, color) {
  face(ctx, projector, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], color);
}

function groundCircle(ctx, projector, x, y, r, fill, stroke = null, width = 1) {
  const points = Array.from({ length: 28 }, (_, i) => {
    const angle = i * Math.PI * 2 / 28;
    return projector.point(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 0);
  });
  path(ctx, points, fill, stroke, width);
}

function disk(ctx, x, y, rx, ry, color, outline = null) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawGround(ctx, projector) {
  ctx.fillStyle = "#b9cba8";
  ctx.fillRect(0, 0, projector.width, projector.height);
  groundRect(ctx, projector, -310, -900, 790, 1600, "#b9cba8");
  groundRect(ctx, projector, 30, -900, 450, 1600, "#d9d8cb");
  groundRect(ctx, projector, 90, -900, 390, 1600, "#9daeb0");
  groundRect(ctx, projector, 99, -900, 381, 1600, "#aebcbd");
  for (const x of [90, 390])
    segment(ctx, projector, [x, -900, 0.4], [x, 1600, 0.4], "#f4eee0", 2.2 * projector.scale);
  for (let y = -860; y < 1600; y += 82) {
    for (const [a, b] of [[30, 90], [390, 450]])
      segment(ctx, projector, [a, y, 0.3], [b, y, 0.3], "#c2c5b8", projector.scale);
    groundRect(ctx, projector, 237, y + 15, 243, y + 43, "#e7e6d7a8");
  }
  for (const [x, y] of [[121, 270], [355, 480], [133, 685]]) {
    groundRect(ctx, projector, x, y, x + 22, y + 32, "#8d9fa0");
    segment(ctx, projector, [x + 4, y + 7, 1], [x + 18, y + 7, 1], "#c5cfca", projector.scale);
  }
  // The last block ends at an actual open lane between two front gardens.
  groundRect(ctx, projector, 0, -225, 174, 107, "#a8c296");
  groundRect(ctx, projector, 306, -225, 480, 107, "#a8c296");
  groundRect(ctx, projector, 174, -225, 306, 108, "#dacfb7");
  for (let y = -220; y < 108; y += 45)
    segment(ctx, projector, [177, y, 0.5], [303, y, 0.5], "#c5b99e", projector.scale);
  groundCircle(ctx, projector, 240, 54, 34, "#e9dcb5a0", "#72947e", 2.4 * projector.scale);
}

function drawBox(ctx, projector, x0, y0, x1, y1, z0, z1, top, south, east) {
  face(ctx, projector, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], "#2b3e3923");
  face(ctx, projector, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], east);
  face(ctx, projector, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], south);
  face(ctx, projector, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top);
}

function drawTree(ctx, projector, x, y, radius = 13) {
  const scale = projector.scale;
  const base = projector.point(x, y, 0);
  const crown = projector.point(x, y, 29);
  disk(ctx, base.x + 3 * scale, base.y + 2 * scale, radius * scale, radius * scale * 0.45, "#314a3b39");
  segment(ctx, projector, [x, y, 0], [x, y, 27], "#736249", 4 * scale);
  disk(ctx, crown.x, crown.y, radius * scale, radius * scale * 0.85, "#64866a", "#3c694f");
  disk(ctx, crown.x - 4 * scale, crown.y - 4 * scale, radius * scale * 0.38, radius * scale * 0.35, "#91ab7a");
}

function drawFence(ctx, projector, a, b, gap = null, color = "#6f806a") {
  const horizontal = a.y === b.y;
  const from = horizontal ? a.x : a.y;
  const to = horizontal ? b.x : b.y;
  for (let start = from; start < to; start += 16) {
    const end = Math.min(to, start + 16);
    const middle = (start + end) / 2;
    if (gap && middle > gap[0] && middle < gap[1]) continue;
    const pos = (value, z) => horizontal ? [value, a.y, z] : [a.x, value, z];
    segment(ctx, projector, pos(start, 8), pos(end, 8), color, 2 * projector.scale);
    segment(ctx, projector, pos(start, 0), pos(start, 11), "#506b57", 2.5 * projector.scale);
  }
}

function drawLot(ctx, projector, house) {
  const left = house.face === "east";
  const edge = left ? 30 : 450;
  const door = houseDoor(house);
  const lotX0 = left ? -175 : 450;
  const lotX1 = left ? 30 : 655;
  groundRect(ctx, projector, lotX0, house.y - 15, lotX1, house.y + house.d + 23,
    house.style % 2 ? "#a8bf96" : "#aec69e");
  groundRect(ctx, projector, Math.min(door.x, edge), door.y - 12,
    Math.max(door.x, edge), door.y + 12, "#dfcfac");
  for (const offset of [-11, 0, 11])
    segment(ctx, projector, [door.x, door.y + offset, 0.5], [edge, door.y + offset, 0.5], "#c9b99b", projector.scale);
  drawFence(ctx, projector, { x: edge, y: house.y - 12 }, { x: edge, y: house.y + house.d + 17 },
    [door.y - 17, door.y + 17]);
  drawTree(ctx, projector, left ? 3 : 478, house.y + 27, 13);
  groundCircle(ctx, projector, left ? 4 : 476, house.y + house.d - 17, 15, "#6f956d", "#507456", projector.scale);
  for (const dy of [house.y + 40, house.y + house.d - 34]) {
    const p = projector.point(left ? 18 : 462, dy, 1);
    for (const dx of [-4, 3]) disk(ctx, p.x + dx * projector.scale, p.y, 2.2 * projector.scale, 1.8 * projector.scale, "#dfb170");
  }
}

function drawHouse(ctx, projector, house) {
  const { x, y, w, d, style } = house;
  const x1 = x + w, y1 = y + d;
  const eave = 42, ridge = style % 2 ? 61 : 66, overhang = 5;
  const walls = [
    ["#f1e3cb", "#ddc6a6", "#e8d6bd"],
    ["#e8e0d0", "#cbbdb0", "#d9cfbd"],
    ["#e6ddc9", "#c9bca0", "#d6c7ab"],
    ["#efe6d4", "#d0c4af", "#e1d6c2"],
  ][style % 4];
  const roofs = [
    ["#c07355", "#985943", "#754b3c"],
    ["#758a82", "#506a68", "#3c5654"],
    ["#9a8b6e", "#756d59", "#5c5749"],
    ["#8687a0", "#666b84", "#4d5368"],
  ][style % 4];
  groundRect(ctx, projector, x + 7, y + 8, x1 + 8, y1 + 9, "#2e4b3c38");
  // Four walls, then two pitched roof planes and their visible gable. Roof
  // skylights are deliberately absent: all windows and the door are on walls.
  face(ctx, projector, [[x, y, 0], [x1, y, 0], [x1, y, eave], [x, y, eave]], walls[2]);
  face(ctx, projector, [[x, y, 0], [x, y1, 0], [x, y1, eave], [x, y, eave]], walls[1]);
  face(ctx, projector, [[x1, y, 0], [x1, y1, 0], [x1, y1, eave], [x1, y, eave]], walls[1]);
  face(ctx, projector, [[x, y1, 0], [x1, y1, 0], [x1, y1, eave], [x, y1, eave]], walls[0]);
  const xa = x - overhang, xb = x1 + overhang, ya = y - overhang, yb = y1 + overhang;
  const mid = (xa + xb) / 2;
  face(ctx, projector, [[xa, ya, eave], [mid, ya, ridge], [mid, yb, ridge], [xa, yb, eave]], roofs[0], roofs[2], projector.scale);
  face(ctx, projector, [[mid, ya, ridge], [xb, ya, eave], [xb, yb, eave], [mid, yb, ridge]], roofs[1], roofs[2], projector.scale);
  face(ctx, projector, [[xa, yb, eave], [mid, yb, ridge], [xb, yb, eave]], walls[0], roofs[2], projector.scale);
  segment(ctx, projector, [mid, ya, ridge], [mid, yb, ridge], roofs[2], 2 * projector.scale);
  for (const t of [0.26, 0.53, 0.8]) {
    const yy = ya + (yb - ya) * t;
    segment(ctx, projector, [xa + 8, yy, eave + 3], [mid - 4, yy, ridge - 3], "#f6dfbd55", projector.scale);
    segment(ctx, projector, [mid + 4, yy, ridge - 3], [xb - 8, yy, eave + 3], "#192f3738", projector.scale);
  }
  // A small chimney has volume above the roof. It cannot read as a roof door.
  if (style !== 1)
    drawBox(ctx, projector, x + w * 0.64, y + d * 0.25, x + w * 0.74, y + d * 0.34,
      ridge - 9, ridge + 16, "#947862", "#cfb79d", "#b69478");
  // South-facing windows sit below the eave on the vertical facade.
  for (const xx of [x + w * 0.22, x + w * 0.69]) {
    face(ctx, projector, [[xx, y1 + 0.2, 17], [xx + 17, y1 + 0.2, 17], [xx + 17, y1 + 0.2, 31], [xx, y1 + 0.2, 31]],
      "#9bbbc0", "#f8f1df", 2 * projector.scale);
    segment(ctx, projector, [xx + 8.5, y1 + 0.3, 17], [xx + 8.5, y1 + 0.3, 31], "#e7f2e9", projector.scale);
  }
  const door = houseDoor(house);
  const outer = door.facing === "east" ? 1 : -1;
  face(ctx, projector, [[door.x + outer * 0.4, door.y - 18, 0], [door.x + outer * 0.4, door.y + 18, 0],
    [door.x + outer * 0.4, door.y + 18, door.top], [door.x + outer * 0.4, door.y - 18, door.top]],
  "#24596c", "#fff3d9", 2.5 * projector.scale);
  const knob = projector.point(door.x + outer * 0.5, door.y + 5, 12);
  disk(ctx, knob.x, knob.y, 1.7 * projector.scale, 1.7 * projector.scale, "#e9cf8b");
  face(ctx, projector, [[door.x, door.y - 21, 32], [door.x + outer * 18, door.y - 21, 32],
    [door.x + outer * 18, door.y + 21, 32], [door.x, door.y + 21, 32]], "#715444");
  groundRect(ctx, projector, Math.min(door.x, door.x + outer * 16), door.y - 12,
    Math.max(door.x, door.x + outer * 16), door.y + 12, "#e7d7b5");
}

function drawGoalHomes(ctx, projector) {
  for (const house of GOAL_HOUSES) {
    const door = houseDoor(house);
    const limit = house.face === "east" ? 174 : 306;
    groundRect(ctx, projector, Math.min(door.x, limit), door.y - 12,
      Math.max(door.x, limit), door.y + 12, "#e4d2ab");
    drawHouse(ctx, projector, house);
  }
  drawFence(ctx, projector, { x: 30, y: 107 }, { x: 174, y: 107 }, null, "#617b61");
  drawFence(ctx, projector, { x: 306, y: 107 }, { x: 450, y: 107 }, null, "#617b61");
  for (const [x, y] of [[53, 76], [131, 73], [348, 76], [427, 73]])
    drawTree(ctx, projector, x, y, 10);
}

function drawPerson(ctx, projector, p, { player = false, friend = false, time = 0, hit = false } = {}) {
  const { x, y } = p;
  const scale = projector.scale;
  const ground = projector.point(x, y, 0);
  disk(ctx, ground.x + 2 * scale, ground.y + 2 * scale, 11 * scale, 5 * scale, "#243a3d4d");
  if (player || friend) groundCircle(ctx, projector, x, y, p.r + 5,
    player ? "#2f9fc032" : "#f5c85d40", player ? "#117ea7" : "#bc8a35", 2.4 * scale);
  if (hit) groundCircle(ctx, projector, x, y, p.r + 6, null, "#c6543c", 3 * scale);
  const shirt = player ? "#268eaf" : friend ? "#d9af55" : p.shirt || CROWD_SHIRTS[(p.color ?? p.id ?? 0) % CROWD_SHIRTS.length];
  const step = p.state === "walking" && !player ? Math.sin(time * 7 + (p.id || 0)) * 1.3 : 0;
  for (const side of [-1, 1]) {
    segment(ctx, projector, [x + side * 4, y - step * side, 2], [x + side * 4, y, 15], "#334b55", 4.8 * scale);
    const shoe = projector.point(x + side * 4, y - step * side + 2, 1);
    disk(ctx, shoe.x, shoe.y, 4.2 * scale, 2.7 * scale, "#263b40");
  }
  face(ctx, projector, [[x - 8, y + 4, 15], [x + 8, y + 4, 15], [x + 9, y + 4, 30], [x - 9, y + 4, 30]],
    shirt, "#28464a", 1.5 * scale);
  face(ctx, projector, [[x + 8, y - 5, 15], [x + 8, y + 4, 15], [x + 9, y + 4, 30], [x + 9, y - 5, 30]],
    "#294a55aa");
  for (const side of [-1, 1]) {
    segment(ctx, projector, [x + side * 8, y, 27], [x + side * 12, y + 1, 17], shirt, 4 * scale);
    const hand = projector.point(x + side * 12, y + 1, 17);
    disk(ctx, hand.x, hand.y, 2.2 * scale, 2.2 * scale, "#d1a17f");
  }
  const head = projector.point(x, y, 39);
  disk(ctx, head.x, head.y, 7.2 * scale, 7.2 * scale, "#d3a180", "#5b554a");
  disk(ctx, head.x - 0.8 * scale, head.y - 3.3 * scale, 7 * scale, 4.5 * scale,
    player ? "#253d50" : friend ? "#916f47" : "#403a38");
  if (player) {
    ctx.fillStyle = "#f6f0dd";
    ctx.strokeStyle = "#244f5c";
    ctx.lineWidth = 2;
    const labelX = ground.x - 14 * scale, labelY = ground.y + 8 * scale;
    ctx.fillRect(labelX, labelY, 28 * scale, 15 * scale);
    ctx.strokeRect(labelX, labelY, 28 * scale, 15 * scale);
    ctx.fillStyle = "#234a5b";
    ctx.font = `800 ${Math.max(8, 10 * scale)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("YOU", ground.x, labelY + 10 * scale);
  }
}

export function drawStageOne3D(ctx, game, { width, height }) {
  const projector = makeProjector(width, height, game.player.y);
  drawGround(ctx, projector);
  const houses = streetHouses().sort((a, b) => a.y - b.y);
  for (const house of houses) {
    drawLot(ctx, projector, house);
    drawHouse(ctx, projector, house);
  }
  drawGoalHomes(ctx, projector);
  const people = [
    ...game.crowd.filter(visiblePerson).map(p => ({ p })),
    { p: game.meetingPartner, friend: true },
    { p: game.player, player: true },
  ].sort((a, b) => a.p.y - b.p.y);
  for (const item of people)
    drawPerson(ctx, projector, item.p, {
      player: item.player,
      friend: item.friend,
      time: game.worldTime,
      hit: item.player && game.cooldown > 0 && game.lastContactMember === 0,
    });
  return projector;
}
