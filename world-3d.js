import { visiblePerson } from "./crowd.js";
import { drawCallRipple } from "./character.js";
import { activeCallRipple, HOP_DISTANCE, insideConcert, joiningFriend } from "./logic.js";
import {
  makeProjector,
  drawStageOne3D,
  face,
  segment,
  groundRect,
  groundCircle,
  disk,
  drawBox,
  drawTree,
  drawPerson,
} from "./stage1-3d-render.js";

// The model keeps its original X/Y hitboxes. Every scene is solid geometry on
// that same ground plane, viewed by the fixed oblique camera from Stage 1.
const FLOOR_TOP = -450;
const FLOOR_BOTTOM = 3000;

function topDisk(ctx, p, x, y, z, radius, fill, edge = null) {
  const vertices = Array.from({ length: 24 }, (_, i) => {
    const angle = i * Math.PI * 2 / 24;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z];
  });
  face(ctx, p, vertices, fill, edge, p.scale);
}

function facadeDoor(ctx, p, x, y, towardRoad, color = "#376d70") {
  const road = towardRoad === "east" ? 1 : -1;
  groundRect(ctx, p, Math.min(x, x + road * 25), y - 17,
    Math.max(x, x + road * 25), y + 17, "#e2d5b7");
  face(ctx, p, [[x + road * 0.5, y - 18, 0], [x + road * 0.5, y + 18, 0],
    [x + road * 0.5, y + 18, 31], [x + road * 0.5, y - 18, 31]],
  color, "#fff0d4", 2.4 * p.scale);
  face(ctx, p, [[x, y - 22, 37], [x + road * 19, y - 22, 37],
    [x + road * 19, y + 22, 37], [x, y + 22, 37]], "#59766f");
  const knob = p.point(x + road, y + 8, 14);
  disk(ctx, knob.x, knob.y, 1.8 * p.scale, 1.8 * p.scale, "#f4da9e");
}

function tileGrid(ctx, p, top, bottom, color, spacing = 72) {
  for (let y = top; y <= bottom; y += spacing)
    segment(ctx, p, [0, y, 0.2], [480, y, 0.2], color, p.scale);
  for (let x = 0; x <= 480; x += spacing)
    segment(ctx, p, [x, top, 0.2], [x, bottom, 0.2], color, p.scale);
}

function sideBlock(ctx, p, side, y, depth, palette, doorY = y + depth * 0.58) {
  const left = side === "west";
  const x0 = left ? -184 : 510;
  const x1 = left ? -18 : 676;
  const wall = palette[0], roof = palette[1];
  groundRect(ctx, p, left ? -205 : 480, y - 10, left ? 0 : 685,
    y + depth + 14, palette[2]);
  drawBox(ctx, p, x0, y, x1, y + depth, 0, 68,
    roof, wall, wall);
  // The entry is set into the vertical face nearest the public concourse.
  facadeDoor(ctx, p, left ? x1 : x0, doorY, left ? "east" : "west");
  const windowX = left ? x1 + 0.7 : x0 - 0.7;
  for (const yy of [y + 34, y + depth - 37]) {
    if (Math.abs(yy - doorY) < 32) continue;
    face(ctx, p, [[windowX, yy - 14, 21], [windowX, yy + 14, 21],
      [windowX, yy + 14, 42], [windowX, yy - 14, 42]],
    "#a4c4c3", "#edf2e7", 2 * p.scale);
  }
}

function goalBlocks(ctx, p, palette) {
  const [roof, wall, pavement] = palette;
  groundRect(ctx, p, 0, -215, 480, 95, pavement);
  for (const [x0, x1] of [[0, 162], [318, 480]]) {
    drawBox(ctx, p, x0, -205, x1, 87, 0, 82,
      roof, wall, wall);
    face(ctx, p, [[x0, 87.5, 24], [x1, 87.5, 24],
      [x1, 87.5, 57], [x0, 87.5, 57]],
    "#a6c4bfa8", "#e3f0e6", p.scale);
  }
  groundRect(ctx, p, 162, -205, 318, 94, pavement);
  for (const x of [162, 318])
    drawBox(ctx, p, x - 3, -23, x + 3, 84, 0, 55,
      "#516e6c", wall, wall);
  topDisk(ctx, p, 240, 54, 0.4, 27, "#f8e8bc55", "#638c7d");
}

function station(ctx, p) {
  ctx.fillStyle = "#b7cbc7";
  ctx.fillRect(0, 0, p.width, p.height);
  groundRect(ctx, p, -250, FLOOR_TOP, 730, FLOOR_BOTTOM, "#b7cbc7");
  groundRect(ctx, p, 0, FLOOR_TOP, 480, FLOOR_BOTTOM, "#dce7e2");
  tileGrid(ctx, p, -450, 1500, "#c1d2cb", 78);
  groundRect(ctx, p, 126, 95, 354, 300, "#e8efeb");
  for (const y of [115, 525, 765, 1010]) {
    sideBlock(ctx, p, "west", y, 150,
      ["#d7e3d9", "#648588", "#b8cfca"]);
    sideBlock(ctx, p, "east", y + 20, 140,
      ["#d5e2dc", "#6d8b88", "#b8cfca"]);
  }
  drawTree(ctx, p, -40, 430, 23);
  drawTree(ctx, p, 530, 470, 24);
  goalBlocks(ctx, p, ["#517578", "#688989", "#d2e2dc"]);
  // Ticket gates have visible height and leave three walkable gaps.
  for (const x of [176, 225, 274]) {
    drawBox(ctx, p, x, -104, x + 17, -57, 0, 24,
      "#a3c4b7", "#496d72", "#496d72");
    segment(ctx, p, [x + 8, -57, 24], [x + 8, -48, 24],
      "#d9ebba", 3 * p.scale);
  }
  face(ctx, p, [[160, -42, 75], [320, -42, 75],
    [320, -10, 75], [160, -10, 75]], "#47767a", "#d2e8e0", 2 * p.scale);
  for (const x of [175, 223, 271])
    segment(ctx, p, [x, -40, 75.2], [x + 23, -40, 75.2],
      "#f0d6a0", 5 * p.scale);
  groundRect(ctx, p, 160, 25, 320, 96, "#c2d9d1");
}

function cafeTable(ctx, p, x, y) {
  groundCircle(ctx, p, x + 3, y + 5, 24, "#4c3b3428");
  segment(ctx, p, [x, y, 0], [x, y, 26], "#735b49", 4 * p.scale);
  topDisk(ctx, p, x, y, 27, 25, "#d6b88a", "#795942");
  for (const [dx, dy] of [[-34, 0], [34, 0]]) {
    drawBox(ctx, p, x + dx - 9, y + dy - 7,
      x + dx + 9, y + dy + 7, 0, 11,
    "#9ab9a1", "#627f6c", "#627f6c");
  }
  topDisk(ctx, p, x - 8, y - 5, 28, 5, "#f8f0dd", "#876447");
  topDisk(ctx, p, x - 8, y - 5, 28.5, 2.5, "#7b543f");
}

function cafe(ctx, p) {
  ctx.fillStyle = "#c9c8b8";
  ctx.fillRect(0, 0, p.width, p.height);
  groundRect(ctx, p, -240, FLOOR_TOP, 720, FLOOR_BOTTOM, "#c9c8b8");
  groundRect(ctx, p, 0, FLOOR_TOP, 480, FLOOR_BOTTOM, "#eee5d3");
  tileGrid(ctx, p, -400, 1770, "#d8cdb9", 80);
  for (const y of [245, 445, 640, 920, 1150, 1330]) {
    groundRect(ctx, p, 0, y - 42, 480, y + 42, "#e0d7c5");
    segment(ctx, p, [0, y - 42, 0.3], [480, y - 42, 0.3],
      "#bdaa91", p.scale);
    segment(ctx, p, [0, y + 42, 0.3], [480, y + 42, 0.3],
      "#bdaa91", p.scale);
    groundRect(ctx, p, 0, y - 20, 48, y + 20, "#b8cdc3");
    groundRect(ctx, p, 432, y - 20, 480, y + 20, "#e2cfb1");
  }
  for (const [top, bottom] of [[95, 194], [296, 394], [496, 590],
    [690, 830], [970, 1070], [1200, 1260], [1380, 1450]])
    groundRect(ctx, p, 202, top, 278, bottom, "#f4eddc");
  // Platform edge and waiting-room furniture occupy the side margins.
  for (const y of [155, 420, 660, 960, 1210, 1390]) {
    sideBlock(ctx, p, "west", y, 115,
      ["#c0d1c7", "#6d8985", "#b4c5ba"]);
    sideBlock(ctx, p, "east", y + 15, 105,
      ["#e7d9c4", "#aa9b83", "#d8ccb6"]);
  }
  goalBlocks(ctx, p, ["#ba9d78", "#e2cba8", "#efddc2"]);
  for (const x of [82, 398])
    for (const y of [-136, -28]) cafeTable(ctx, p, x, y);
  // A real counter, pastry case and coffee machine sit behind the open doors.
  drawBox(ctx, p, 176, -179, 304, -128, 0, 34,
    "#b98c60", "#795645", "#795645");
  drawBox(ctx, p, 191, -150, 235, -133, 34, 58,
    "#5e736c", "#879f94", "#718b82");
  drawBox(ctx, p, 246, -151, 294, -130, 34, 48,
    "#e8d7b4", "#c79a6c", "#d0ac7a");
  face(ctx, p, [[160, -17, 60], [320, -17, 60],
    [320, 23, 60], [160, 23, 60]], "#f2dfbf", "#765a47", 2 * p.scale);
  for (let x = 160; x < 320; x += 24)
    face(ctx, p, [[x, -17, 60.3], [x + 12, -17, 60.3],
      [x + 12, 23, 60.3], [x, 23, 60.3]], "#a9644e");
  for (const x of [165, 315])
    drawBox(ctx, p, x - 4, 22, x + 4, 88, 0, 52,
      "#83644e", "#83644e", "#83644e");
}

function rainCanopy(ctx, p, x, y, direction) {
  const near = x + direction * 80;
  for (const yy of [y - 20, y + 20])
    segment(ctx, p, [x, yy, 0], [x, yy, 56],
      "#52746c", 3 * p.scale);
  face(ctx, p, [[x, y - 25, 56], [near, y - 25, 56],
    [near, y + 25, 56], [x, y + 25, 56]],
  "#5b8378", "#c1d7ca", 2 * p.scale);
  for (const yy of [y - 17, y, y + 17])
    segment(ctx, p, [x + direction * 6, yy, 56.2],
      [near - direction * 6, yy, 56.2], "#a8c9b7", p.scale);
}

function venue(ctx, p) {
  ctx.fillStyle = "#9ab5ab";
  ctx.fillRect(0, 0, p.width, p.height);
  groundRect(ctx, p, -240, FLOOR_TOP, 720, FLOOR_BOTTOM, "#9ab5ab");
  groundRect(ctx, p, 0, FLOOR_TOP, 480, FLOOR_BOTTOM, "#d6e1da");
  groundRect(ctx, p, 0, 365, 480, 780, "#b8cfb6");
  groundRect(ctx, p, 62, 365, 418, 780, "#d8dfd2");
  groundRect(ctx, p, 142, 365, 338, 780, "#e4e6d9");
  groundRect(ctx, p, 0, 925, 480, FLOOR_BOTTOM, "#bfd1cd");
  tileGrid(ctx, p, 940, FLOOR_BOTTOM, "#a6bbb6", 88);
  for (const y of [1370, 1630, 1880, 2100]) {
    groundRect(ctx, p, 130, y - 34, 350, y + 34, "#d4dfd4");
    segment(ctx, p, [130, y - 34, 0.3], [350, y - 34, 0.3],
      "#94afa6", p.scale);
  }
  for (const x of [62, 142, 338, 418])
    segment(ctx, p, [x, 365, 0.3], [x, 780, 0.3],
      "#9cb6a5", p.scale);
  for (const y of [525, 615])
    face(ctx, p, [[229, y + 10, 0.4], [240, y, 0.4],
      [251, y + 10, 0.4]], "#a9c0ad");
  for (const side of ["west", "east"]) {
    sideBlock(ctx, p, side, 1007, 132,
      ["#d2e0d8", "#597f77", "#adc6b8"]);
    sideBlock(ctx, p, side, 135, 128,
      ["#d6e3d8", "#628a7f", "#adc6b8"]);
    for (const y of [1450, 1840, 2080])
      sideBlock(ctx, p, side, y, 125,
        ["#d0ded5", "#6b8b82", "#b7cbbf"]);
  }
  for (const [x, y] of [[48, 478], [432, 493], [55, 620], [425, 700]])
    drawTree(ctx, p, x, y, 17);
  rainCanopy(ctx, p, -5, 997, 1);
  rainCanopy(ctx, p, 485, 122, -1);
  rainCanopy(ctx, p, -5, 1585, 1);
  rainCanopy(ctx, p, 485, 1915, -1);
  for (const [x, y] of [[52, 1022], [429, 465], [64, 677], [415, 135]]) {
    groundCircle(ctx, p, x, y, 21, "#8fb9b7a0");
    segment(ctx, p, [x - 8, y, 0.4], [x + 6, y, 0.4],
      "#e3f3ec", p.scale);
  }
  // Station exit at the start, park between both real crossings, venue ahead.
  for (const [x0, x1] of [[0, 153], [327, 480]])
    drawBox(ctx, p, x0, 1060, x1, 1180, 0, 69,
      "#60817f", "#7fa19a", "#6b8e88");
  groundRect(ctx, p, 153, 1060, 327, 1180, "#d1e0d5");
  goalBlocks(ctx, p, ["#4e7e6f", "#639588", "#d8e6dc"]);
  topDisk(ctx, p, 240, -115, 1, 35, "#6e9885", "#e4d6a6");
  topDisk(ctx, p, 240, -115, 1.5, 25, "#477363");
  for (const x of [170, 197, 224, 251, 278])
    segment(ctx, p, [x, -18, 2], [x + 17, 19, 2],
      "#c1d3c5", p.scale);
  for (let x = 174; x < 313; x += 19)
    topDisk(ctx, p, x, 27, 6, 3, "#f4d89c");
}

function hall(ctx, p, game) {
  const live = insideConcert(game);
  ctx.fillStyle = "#2c4141";
  ctx.fillRect(0, 0, p.width, p.height);
  groundRect(ctx, p, -260, FLOOR_TOP, 740, FLOOR_BOTTOM, "#2c4141");
  groundRect(ctx, p, 0, FLOOR_TOP, 480, 685, "#58736f");
  groundRect(ctx, p, 0, 685, 480, FLOOR_BOTTOM, "#c1c0a9");
  groundRect(ctx, p, 194, 32, 286, 685, "#728d86");
  for (let y = 125; y < 685; y += 94)
    segment(ctx, p, [0, y, 0.2], [480, y, 0.2],
      "#8ba69c", p.scale);
  tileGrid(ctx, p, 730, FLOOR_BOTTOM, "#a3ad9b", 80);
  for (const y of [1040, 1310, 1600]) {
    groundRect(ctx, p, 155, y - 32, 325, y + 32, "#d5d0b5");
    for (const x of [115, 365])
      topDisk(ctx, p, x, y, 1, 17, "#778c79", "#d0d7ba");
  }
  // Audience seats remain outside player bounds, beside the central aisle.
  for (const side of ["west", "east"])
    for (let y = 75; y < 660; y += 100) {
      const x0 = side === "west" ? -170 : 500;
      drawBox(ctx, p, x0, y, x0 + 148, y + 67, 0, 15,
        "#58736d", "#395a58", "#395a58");
      for (let x = x0 + 20; x < x0 + 145; x += 30)
        topDisk(ctx, p, x, y + 33, 16, 7, "#88a59a");
    }
  // Two gate lines correspond to the model's physical opening x=142..338.
  for (const [top, bottom] of [[790, 825], [685, 720]]) {
    for (const [x0, x1] of [[0, 130], [350, 480]])
      drawBox(ctx, p, x0, top, x1, bottom, 0, 54,
        "#53766b", "#405f58", "#405f58");
    groundRect(ctx, p, 130, top, 350, bottom, "#d4d2b9");
    for (const x of [131, 349])
      segment(ctx, p, [x, top, 0], [x, top, 52],
        "#3c5e57", 3 * p.scale);
  }
  for (const [x0, x1] of [[0, 130], [350, 480]])
    drawBox(ctx, p, x0, 842, x1, 888, 0, 32,
      "#e6d9b6", "#917b59", "#917b59");
  for (const x of [195, 227, 259])
    drawBox(ctx, p, x, 852, x + 19, 864, 0, 7,
      "#f7eed7", "#b2a587", "#b2a587");
  // Raised stage, proscenium lights and a continuous front-row rail.
  drawBox(ctx, p, 78, -205, 402, 8, 0, 31,
    "#355552", "#253f41", "#253f41");
  drawBox(ctx, p, 91, -184, 389, -160, 31, 83,
    "#52756c", "#375a58", "#375a58");
  for (const x of [120, 184, 248, 312, 376]) {
    topDisk(ctx, p, x, -166, 84, 8,
      live ? "#f2d68e" : "#d5b477");
    face(ctx, p, [[x - 5, -166, 83], [x + 5, -166, 83],
      [x + 15, -80, 32], [x - 15, -80, 32]],
    live ? "#ecd38920" : "#ceddc512");
  }
  // Drums, keyboard and mic stand are at head height on the stage deck.
  topDisk(ctx, p, 190, -93, 43, 17, "#bf9669", "#75543c");
  drawBox(ctx, p, 296, -106, 351, -82, 31, 47,
    "#293c40", "#202e34", "#202e34");
  for (let x = 301; x < 347; x += 8)
    segment(ctx, p, [x, -87, 47.5], [x + 4, -87, 47.5],
      "#eee9d8", 3 * p.scale);
  segment(ctx, p, [240, -89, 31], [240, -89, 76],
    "#d9e2d4", 2 * p.scale);
  segment(ctx, p, [0, 20, 36], [480, 20, 36],
    "#d4dbc5", 4 * p.scale);
  for (let x = 12; x < 480; x += 48)
    segment(ctx, p, [x, 20, 0], [x, 20, 38],
      "#385753", 3 * p.scale);
}

function traffic(ctx, p, crossing) {
  const t = crossing;
  const mid = (t.top + t.bottom) / 2;
  groundRect(ctx, p, -220, t.top, 700, t.bottom, "#586d6c");
  groundRect(ctx, p, -220, t.top - 5, 700, t.top, "#c4d0c5");
  groundRect(ctx, p, -220, t.bottom, 700, t.bottom + 5, "#c4d0c5");
  for (let y = t.top + 7; y < t.bottom - 3; y += 13)
    groundRect(ctx, p, t.left, y, t.right, y + 7, "#ecede1");
  for (let lane = 1; lane < t.lanes; lane++) {
    const yy = t.top + lane * (t.bottom - t.top) / t.lanes;
    for (let x = -210; x < 700; x += 37)
      if (x < t.left - 22 || x > t.right + 5)
        segment(ctx, p, [x, yy, 0.4], [x + 20, yy, 0.4],
          "#ddc98e", 2 * p.scale);
  }
  segment(ctx, p, [t.left, t.bottom + 12, 0.7],
    [t.right, t.bottom + 12, 0.7], "#f4f6e9", 4 * p.scale);
  for (const [x, y] of [[10, t.bottom + 49], [470, t.top - 49]]) {
    segment(ctx, p, [x, y, 0], [x, y, 59],
      "#385457", 4 * p.scale);
    drawBox(ctx, p, x - 7, y - 6, x + 7, y + 6, 49, 65,
      "#203c40", "#263f43", "#263f43");
    const bulb = p.point(x, y + 7, 57);
    disk(ctx, bulb.x, bulb.y, 4.5 * p.scale, 4.5 * p.scale,
      t.nominalGreen
        ? (t.blinkOn ? "#47d6a5" : "#314d50")
        : "#ee6970", "#f2ead1");
    groundCircle(ctx, p, x, y, 11, "#435d58b0");
  }
  const vehicle = t.vehicle;
  if (!vehicle?.active || vehicle.x < -75 || vehicle.x > 555) return;
  if (vehicle.kind === "car") {
    const x = vehicle.x, y = vehicle.y, half = vehicle.width / 2;
    groundRect(ctx, p, x - half - 4, y - 15, x + half + 4, y + 18,
      "#243c3d47");
    drawBox(ctx, p, x - half, y - 14, x + half, y + 14,
      2, 20, "#c47f5c", "#a66c54", "#b97755");
    drawBox(ctx, p, x - 14, y - 11, x + 15, y + 11,
      20, 32, "#b9d5cc", "#638783", "#5a7c7d");
    for (const xx of [x - half + 7, x + half - 7])
      for (const yy of [y - 14, y + 14])
        topDisk(ctx, p, xx, yy, 3, 5, "#344b4d");
  } else {
    const x = vehicle.x, y = vehicle.y;
    for (const xx of [x - 14, x + 14])
      groundCircle(ctx, p, xx, y, 6, null,
        "#2c5356", 2.5 * p.scale);
    segment(ctx, p, [x - 14, y, 3], [x + 1, y - 3, 13],
      "#7e9f80", 2.4 * p.scale);
    segment(ctx, p, [x + 1, y - 3, 13], [x + 14, y, 3],
      "#7e9f80", 2.4 * p.scale);
    segment(ctx, p, [x, y, 12], [x, y, 30],
      "#3d6e71", 5 * p.scale);
    const head = p.point(x, y, 39);
    disk(ctx, head.x, head.y, 6 * p.scale, 6 * p.scale,
      "#d7ac88", "#496264");
  }
  // Road depth is world geometry; the HUD independently reports exact timing.
  segment(ctx, p, [0, mid, 0.5], [t.left - 25, mid, 0.5],
    "#dcca91", p.scale);
}

export function umbrellaCanopy(x, y) {
  const center = [x, y, 67];
  const inner = [], rim = [];
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    inner.push([x + 9 * Math.cos(angle), y + 9 * Math.sin(angle), 63]);
    rim.push([x + 19 * Math.cos(angle), y + 19 * Math.sin(angle),
      i % 2 ? 52 : 54]);
  }
  return { center, inner, rim };
}
function umbrella(ctx, p, actor, hand) {
  const [x, y, gripZ] = hand;
  const { center, inner, rim } = umbrellaCanopy(x, y);
  const warm = actor.id % 2 === 1;
  segment(ctx, p, [x, y, gripZ], center, "#4f6870", 2.4 * p.scale);
  segment(ctx, p, [x, y, gripZ], [x + 3, y, gripZ - 3],
    "#4f6870", 2.2 * p.scale);
  for (let i = 0; i < rim.length; i++) {
    const next = (i + 1) % rim.length;
    face(ctx, p, [center, inner[i], inner[next]],
      warm ? "#f1d6a1" : "#a5d0c5");
    face(ctx, p, [inner[i], rim[i], rim[next], inner[next]],
      warm ? (i % 2 ? "#d5ad73" : "#e5c48d")
        : (i % 2 ? "#76aaa2" : "#8bbdb3"));
    segment(ctx, p, center, rim[i],
      warm ? "#f8e8c49c" : "#d4e9d995", 0.9 * p.scale);
    segment(ctx, p, rim[i], rim[next], "#4f6b69", 1.8 * p.scale);
  }
}

function animal(ctx, p, actor) {
  const dog = actor.kind === "dog";
  const dir = actor.vx < -0.2 ? -1 : 1;
  const x = actor.x, y = actor.y;
  const coat = dog ? "#b88055" : "#7f9694";
  groundCircle(ctx, p, x, y, dog ? 15 : 12, "#233d3a38");
  for (const legX of [-7, 7])
    for (const legY of [-5, 5])
      segment(ctx, p, [x + legX, y + legY, 10],
        [x + legX + dir * 2, y + legY, 2],
        dog ? "#765b48" : "#526d6c", 2.8 * p.scale);
  drawBox(ctx, p, x - (dog ? 12 : 10), y - (dog ? 7 : 6),
    x + (dog ? 12 : 10), y + (dog ? 7 : 6), 8, dog ? 20 : 17,
    coat, dog ? "#956744" : "#647e7c", dog ? "#956744" : "#647e7c");
  const hx = x + dir * (dog ? 13 : 11);
  const head = p.point(hx, y, dog ? 20 : 18);
  disk(ctx, head.x, head.y, (dog ? 6.6 : 5.7) * p.scale,
    (dog ? 6.6 : 5.7) * p.scale, coat, "#4a5753");
  for (const side of [-1, 1]) {
    const earX = hx - dir * (dog ? 3 : 2), earY = y + side * 4;
    face(ctx, p, [
      [earX, earY, dog ? 22 : 21],
      [earX - dir * 3, earY + side * 2, dog ? 18 : 20],
      [earX - dir, earY + side, dog ? 27 : 26],
    ], coat);
  }
  const nose = p.point(hx + dir * 5, y, dog ? 18 : 16);
  disk(ctx, nose.x, nose.y, 1.8 * p.scale, 1.8 * p.scale, "#2d4142");
  const tailX = x - dir * (dog ? 12 : 10);
  segment(ctx, p, [tailX, y, dog ? 17 : 15],
    [tailX - dir * 8, y + 2, dog ? 27 : 24], coat,
    (dog ? 4 : 2.7) * p.scale);
}

export function drawGlowStick(ctx, p, hand, id, time) {
  const [x, y, gripZ] = hand,
    color = ["#80e9d4", "#f2a2d3", "#f2d789"][id % 3],
    tip = p.point(x + 3, y, gripZ + 37);
  segment(ctx, p, hand, [x + 1, y, gripZ + 11],
    "#394e54", 5 * p.scale);
  segment(ctx, p, [x + 1, y, gripZ + 10],
    [x + 3, y, gripZ + 37], color + "55", 10 * p.scale);
  segment(ctx, p, [x + 1, y, gripZ + 11],
    [x + 3, y, gripZ + 36], color, 5.5 * p.scale);
  segment(ctx, p, [x + 2, y, gripZ + 13],
    [x + 3, y, gripZ + 35], "#fff6da", 1.6 * p.scale);
  disk(ctx, tip.x, tip.y, 4 * p.scale, 4 * p.scale, color);
  disk(ctx, tip.x, tip.y,
    (Math.sin(time * 5 + id) > 0 ? 7 : 5) * p.scale,
    (Math.sin(time * 5 + id) > 0 ? 7 : 5) * p.scale, color + "44");
}

function people(ctx, p, game, reducedMotion, poses) {
  const newFriend = joiningFriend(game, reducedMotion);
  const partner = game.stage === 4
    ? { ...game.meetingPartner, partner: false, background: true,
      visualKey: "concert-neighbor", state: "watching", glowStick: true }
    : newFriend || game.meetingPartner;
  const actors = [
    ...game.crowd.filter(visiblePerson),
    ...game.animals,
    ...game.party.members,
    partner,
    { ...game.player, player: true },
  ];
  if (game.stage === 4) {
    actors.push({ x: 145, y: 810, r: 11, id: 8,
      shirt: "#826c89", state: "waiting", clerk: true });
    for (const [x, y, id, shirt] of [
      [147, -120, 51, "#c2915a"],
      [240, -121, 52, "#78a79b"],
      [332, -115, 53, "#ae795b"],
    ]) actors.push({ x, y, r: 11, id, shirt, state: "performing", band: true });
  }
  if (game.party.members.length) {
    const trail = game.party.trail.filter((point) =>
      point.s >= Math.min(...game.party.members.map((member) => member.s)) - 1);
    for (let i = 1; i < trail.length; i++)
      segment(ctx, p, [trail[i - 1].x, trail[i - 1].y, 0.4],
        [trail[i].x, trail[i].y, 0.4], "#306e7860", p.scale);
  }
  for (const actor of actors.sort((a, b) => a.y - b.y)) {
    if (actor.animal) {
      animal(ctx, p, actor);
      continue;
    }
    const player = !!actor.player;
    const friend = !!actor.friend || !!actor.partner;
    const hit = player && game.cooldown > 0 && game.lastContactMember === 0;
    const key = player ? "player" : actor.friend ? `friend:${actor.id}`
      : actor.partner ? "partner" : actor.background || actor.band || actor.clerk
        ? null : `crowd:${actor.id}`;
    const pose = key ? poses?.get(key) : null;
    const drawn = drawPerson(ctx, p, actor, {
      player, friend, hit,
      pose, reducedMotion,
      baseZ: actor.band ? 31 : player && game.hop && !reducedMotion
        ? 5 * Math.sin(Math.PI * (1 - game.hop.remaining / HOP_DISTANCE)) : 0,
    });
    if (actor.umbrella) umbrella(ctx, p, actor, drawn.rightHand);
    if (actor.glowStick) drawGlowStick(ctx, p, drawn.rightHand, actor.id,
      game.worldTime + (game.ambientTime || 0));
    if (actor.friend && actor.id) {
      const at = p.point(actor.x, actor.y, 48);
      disk(ctx, at.x + 9 * p.scale, at.y - 4 * p.scale,
        7 * p.scale, 7 * p.scale,
        actor.flash > 0 ? "#c97452" : "#f0d390", "#4d6a62");
      ctx.fillStyle = "#214b51";
      ctx.font = `800 ${Math.max(8, 10 * p.scale)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(String(actor.id), at.x + 9 * p.scale,
        at.y - p.scale);
    }
    if (actor.reaction) {
      const at = p.point(actor.x, actor.y, 60);
      disk(ctx, at.x, at.y, 10 * p.scale, 10 * p.scale, "#fff1dc");
      ctx.fillStyle = "#a6553d";
      ctx.font = `800 ${Math.max(10, 14 * p.scale)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText("!", at.x, at.y + 4 * p.scale);
    }
  }
}

export function drawRain(ctx, width, height, time, reducedMotion) {
  ctx.save();
  ctx.strokeStyle = "#e2f1ec69";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 70; i++) {
    const x = ((i * 139.7) % (width + 80)) - 40;
    const fall = reducedMotion ? 0 : time * (118 + (i % 3) * 17);
    const y = ((i * 283.3 + fall) % (height + 90)) - 45;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.5, y + 19);
    ctx.stroke();
  }
  ctx.restore();
}

function concertLights(ctx, p, game, reducedMotion) {
  if (!insideConcert(game)) return;
  const time = reducedMotion ? 0 : game.worldTime + (game.ambientTime || 0);
  for (let i = 0; i < 18; i++) {
    const x = 78 + (i * 91) % 325;
    const y = -160 + (i * 43) % 250;
    const at = p.point(x, y, 75 + (i % 3) * 7);
    const shimmer = 0.72 + 0.28 * Math.sin(time * 1.3 + i * 2.1);
    disk(ctx, at.x, at.y,
      (1.5 + shimmer) * p.scale, (1.5 + shimmer) * p.scale,
      i % 2 ? "#f9daa9" : "#a1d9d0");
  }
}

export function drawWorld3D(ctx, game, { width, height, top, bottom,
  reducedMotion = false, poses = null } = {}) {
  const viewport = { top, bottom };
  const p = game.stage === 0
    ? drawStageOne3D(ctx, game, { width, height, viewport, includePeople: false })
    : makeProjector(width, height, game.player.y, viewport);
  if (game.stage === 1) station(ctx, p);
  else if (game.stage === 2) cafe(ctx, p);
  else if (game.stage === 3) venue(ctx, p);
  else if (game.stage === 4) hall(ctx, p, game);
  for (const crossing of game.crossings) traffic(ctx, p, crossing);
  if (game.stage === 4 && insideConcert(game)) {
    // Dim the venue scenery after the doorway; actors and route marks stay clear.
    ctx.fillStyle = "#07152229";
    ctx.fillRect(0, 0, width, height);
  }
  people(ctx, p, game, reducedMotion, poses);
  const ripple = activeCallRipple(game);
  if (ripple) {
    const at = p.point(ripple.x, ripple.y, 35);
    drawCallRipple(ctx, at.x, at.y, p.scale, ripple.progress, reducedMotion,
      ripple.mode === "unavailable");
  }
  if (game.stage === 3)
    drawRain(ctx, width, height, game.worldTime, reducedMotion);
  if (game.stage === 4) concertLights(ctx, p, game, reducedMotion);
  const cardPoints = [0, 480].flatMap((x) =>
    [-205, 145].flatMap((y) => [0, 85].map((z) => p.point(x, y, z))));
  const left = Math.min(width, Math.max(0, Math.min(...cardPoints.map((point) => point.x))));
  const right = Math.min(width, Math.max(...cardPoints.map((point) => point.x)));
  const upper = Math.min(height, Math.max(0, Math.min(...cardPoints.map((point) => point.y))));
  const lower = Math.min(height, Math.max(...cardPoints.map((point) => point.y)));
  const resultRegion = {
    x: left,
    y: upper,
    width: Math.max(0, right - left),
    height: Math.max(0, lower - upper),
  };
  return { projector: p, resultRegion };
}
