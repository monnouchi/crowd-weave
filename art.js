// Original scene illustration; residential proof uses a unified overhead projection. All geometry is decoration; the simulation
// remains the only source of walking space, signals, contact and score.
import { drawCharacter } from "./character.js";
const INK = "#293c40",
  PAPER = "#f5f0df",
  TEAL = "#28736b",
  RED = "#a74939";
const PALETTES = {
  home: {
    ground: "#e6decb",
    outer: "#c9c6ad",
    edge: "#b5b5a1",
    tint: "#758d6b",
  },
  station: {
    ground: "#dedfd5",
    outer: "#b9c6c3",
    edge: "#a0afac",
    tint: "#486c76",
  },
  cafe: {
    ground: "#e8e1cd",
    outer: "#c5cabb",
    edge: "#a9b2a6",
    tint: "#a2643f",
  },
  venue: {
    ground: "#cbd4cf",
    outer: "#b1c2b6",
    edge: "#94aba0",
    tint: "#4c7062",
  },
  party: {
    ground: "#a7b8b6",
    outer: "#25383d",
    edge: "#40575b",
    tint: "#ddab5b",
  },
};
export function scenePalette(scene) {
  return SPATIAL[scene.landmark] || PALETTES.home;
}
function rect(c, x, y, w, h, color, outline = false) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
  if (outline) {
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    c.strokeRect(x + 0.65, y + 0.65, w - 1.3, h - 1.3);
  }
}
function line(c, points, color = INK, width = 1.3) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "butt";
  c.lineJoin = "miter";
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}
function polygon(c, points, color, outline = false) {
  c.fillStyle = color;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
  if (outline) {
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    c.stroke();
  }
}
function text(
  c,
  words,
  x,
  y,
  size = 11,
  color = INK,
  align = "center",
  weight = 600,
) {
  c.fillStyle = color;
  c.font = `${weight} ${size}px system-ui, sans-serif`;
  c.textAlign = align;
  c.fillText(words, x, y);
}
function overheadHouse(c, x, y, w, h, index = 0, shadowX = 4, shadowY = 5) {
  const roofs = [
    ["#829491", "#647a7c"],
    ["#a39980", "#827a67"],
    ["#8a929a", "#6b7786"],
    ["#899577", "#6d7d63"],
  ];
  const [light, dark] = roofs[index % roofs.length];
  const entry = y + h * (index % 2 ? 0.63 : 0.38);
  rect(c, x + shadowX, y + shadowY, w, h, "#243c3e18");
  rect(c, x, y, w, h, "#eee7d5", true);
  rect(c, x + 3, y + 3, w - 6, h - 6, dark);
  const horizontal = index % 4 === 1;
  if (index % 4 === 2) {
    polygon(
      c,
      [
        [x + 3, y + 3],
        [x + w * 0.46, y + 20],
        [x + w * 0.46, y + h - 20],
        [x + 3, y + h - 3],
      ],
      light,
    );
  } else
    rect(
      c,
      x + 3,
      y + 3,
      horizontal ? w - 6 : w / 2 - 3,
      horizontal ? h / 2 - 3 : h - 6,
      light,
    );
  line(
    c,
    horizontal
      ? [
          [x + 3, y + h / 2],
          [x + w - 3, y + h / 2],
        ]
      : [
          [x + w / 2, y + 3],
          [x + w / 2, y + h - 3],
        ],
    "#46595e",
    1.8,
  );
  // No vertical window is drawn on a roof. One skylight and a chimney sit on it.
  rect(c, x + w * 0.66, y + h * 0.2, 22, 28, "#b7ccd0", true);
  line(
    c,
    [
      [x + w * 0.66 + 2, y + h * 0.2 + 2],
      [x + w * 0.66 + 20, y + h * 0.2 + 26],
    ],
    "#e4eded",
    1,
  );
  rect(c, x + w * 0.3, y + h * 0.77, 12, 14, "#d0c5ac", true);
  // Cutaway vestibule: wall opening, inward door leaf, threshold and paving.
  rect(c, x, entry - 20, 34, 40, "#eee7d5");
  line(
    c,
    [
      [x + 34, entry - 20],
      [x + 34, entry + 20],
    ],
    "#576a68",
    2,
  );
  line(
    c,
    [
      [x, entry - 20],
      [x + 34, entry - 20],
    ],
    "#576a68",
    2,
  );
  line(
    c,
    [
      [x, entry + 20],
      [x + 34, entry + 20],
    ],
    "#576a68",
    2,
  );
  rect(c, x - 8, entry - 15, 10, 30, "#b3a188");
  line(
    c,
    [
      [x + 1, entry + 14],
      [x + 22, entry + 14],
    ],
    "#856b50",
    3,
  );
  return entry;
}
function residentialLot(c, side, y, index) {
  c.save();
  c.translate(side < 0 ? 0 : 480, y);
  c.scale(side < 0 ? -1 : 1, 1);
  const front = [50, 73, 101, 63][index % 4],
    h = [170, 148, 184, 155][index % 4],
    houseWidth = [216, 186, 157, 225][index % 4];
  rect(c, 0, 0, 304, 234, index % 2 ? "#c4cead" : "#b8c5a3");
  const entry = 25 + h * (index % 2 ? 0.63 : 0.38);
  rect(c, 0, entry - 17, front + 3, 34, "#e3d9c3");
  line(
    c,
    [
      [0, entry - 17],
      [front, entry - 17],
    ],
    "#bfb69f",
    1,
  );
  line(
    c,
    [
      [0, entry + 17],
      [front, entry + 17],
    ],
    "#bfb69f",
    1,
  );
  overheadHouse(c, front, 25, houseWidth, h, index, side < 0 ? -4 : 4);
  // Both fence sections terminate before the same path, leaving an open gate.
  line(
    c,
    [
      [8, 0],
      [8, entry - 20],
    ],
    "#71856b",
    4,
  );
  line(
    c,
    [
      [8, entry + 20],
      [8, 234],
    ],
    "#71856b",
    4,
  );
  line(
    c,
    [
      [8, 234],
      [304, 234],
    ],
    "#8b9b79",
    2,
  );
  for (const yy of [entry - 22, entry + 22])
    rect(c, 4, yy - 3, 8, 6, "#60735b");
  // Small garden features stay wholly outside the simulated walking corridor.
  rect(c, 21, entry > 100 ? 34 : 174, 24, 28, "#8aa174");
  for (const dx of [27, 36]) {
    c.fillStyle = index % 2 ? "#e3ba87" : "#d7d8b3";
    c.beginPath();
    c.arc(dx, entry > 100 ? 47 : 187, 3, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function residentialSurroundings(c, bounds) {
  const { left, right, top, bottom } = bounds;
  rect(c, left, top, right - left, bottom - top, "#b8c5a3");
  for (const side of [-1, 1]) {
    for (let y = Math.floor(top / 234) * 234; y < bottom; y += 234) {
      const row = Math.floor(y / 234);
      residentialLot(c, side, y, (((row + (side > 0 ? 2 : 0)) % 4) + 4) % 4);
    }
  }
}
function residentialFloor(c, height) {
  rect(c, 0, -800, 480, height + 1000, "#e7e3d8");
  rect(c, 94, -800, 292, height + 1000, "#d2d6d1");
  // Material seams, not barriers: every part of this ground remains walkable.
  for (const x of [94, 386])
    line(
      c,
      [
        [x, -800],
        [x, height + 200],
      ],
      "#b4beb5",
      2,
    );
  for (let y = -720; y < height + 200; y += 88) {
    line(
      c,
      [
        [0, y],
        [94, y],
      ],
      "#cfcfc1",
      0.8,
    );
    line(
      c,
      [
        [386, y + 44],
        [480, y + 44],
      ],
      "#cfcfc1",
      0.8,
    );
  }
  // Each side branch reaches the gate opening of its own lot.
  for (let y = Math.floor(-800 / 234) * 234; y < height + 200; y += 234) {
    const row = Math.floor(y / 234);
    for (const side of [-1, 1]) {
      const index = (((row + (side > 0 ? 2 : 0)) % 4) + 4) % 4;
      const h = [170, 148, 184, 155][index];
      const entry = y + 25 + h * (index % 2 ? 0.63 : 0.38);
      rect(c, side < 0 ? 0 : 386, entry - 17, 94, 34, "#e3d9c3");
      line(
        c,
        [
          [side < 0 ? 0 : 386, entry - 17],
          [side < 0 ? 94 : 480, entry - 17],
        ],
        "#c3b9a5",
        1,
      );
      line(
        c,
        [
          [side < 0 ? 0 : 386, entry + 17],
          [side < 0 ? 94 : 480, entry + 17],
        ],
        "#c3b9a5",
        1,
      );
    }
  }
}
function residentialCorner(c) {
  // Two inward-facing homes terminate at the same continuous corner court.
  rect(c, 18, -210, 444, 305, "#dce2ce");
  rect(c, 154, -210, 172, 305, "#e7e3d8");
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side < 0 ? 154 : 326, -182);
    c.scale(side < 0 ? -1 : 1, 1);
    const entry = 170 * (side < 0 ? 0.38 : 0.63);
    rect(c, -22, entry - 17, 31, 34, "#e3d9c3");
    overheadHouse(c, 0, 0, 128, 170, side < 0 ? 0 : 1, side < 0 ? -4 : 4);
    c.restore();
  }
  // A cross street explains the corner instead of a freestanding direction sign.
  rect(c, -300, -260, 1080, 50, "#d2d6d1");
  line(
    c,
    [
      [-300, -210],
      [154, -210],
    ],
    "#b4beb5",
    2,
  );
  line(
    c,
    [
      [326, -210],
      [780, -210],
    ],
    "#b4beb5",
    2,
  );
  // The third entrance faces that cross street, rather than the screen by default.
  c.save();
  c.translate(170, -276);
  c.rotate(-Math.PI / 2);
  overheadHouse(c, 0, 0, 117, 140, 2, -5, 4);
  c.restore();
  rect(c, 206, -276, 34, 16, "#e3d9c3");
  for (const x of [142, 338]) {
    rect(c, x - 9, -27, 18, 13, "#78906f", true);
    rect(c, x - 5, -24, 10, 3, "#e9dfc5");
    sCircle(c, x - 23, -18, 10, "#7c9a71", "#63815f");
    sCircle(c, x + 23, -20, 8, "#8aa478", "#63815f");
  }
}

// Physical boundaries follow the unchanged simulation coordinates.
export function surroundings(
  c,
  scene,
  bounds = { left: -600, right: 1080, top: -800, bottom: 1400 },
) {
  if (scene.landmark === "home") residentialSurroundings(c, bounds);
  else spatialSurroundings(c, scene, bounds);
}
export function paintFloor(c, scene, height = 680) {
  if (scene.landmark === "home") residentialFloor(c, height);
  else spatialFloor(c, scene, height);
}
export function floorDetails(c, scene) {
  if (scene.landmark !== "home") spatialDetails(c, scene);
}
export function goalBoundary(c, scene) {
  if (scene.landmark !== "home") return spatialBoundary(c, scene);
  c.save();
  for (const [x, w] of [
    [0, 162],
    [318, 162],
  ]) {
    rect(c, x, 87, w, 7, "#759065");
    rect(c, x, 91, w, 3, "#617b56");
  }
  c.restore();
}
export function architecture(c, scene, opts = {}) {
  if (scene.landmark === "home") residentialCorner(c);
  else spatialArchitecture(c, scene, opts);
}
export function concert(c, opts = {}) {
  sPartyGoal(c, opts);
}
export function rainShelters(c, opts = {}) {
  spatialRain(c, opts);
}
export function venueJourney(c) {
  spatialJourney(c);
}
export function hallInterior(c) {
  spatialHall(c);
}
export function streetFurniture(c, scene, { startY = 625 } = {}) {
  if (scene.landmark === "home") {
    for (const y of [startY + 24, startY + 49])
      line(c, [[228, y + 10], [240, y], [252, y + 10]], "#abc0b4", 2);
  } else spatialFurniture(c, scene, startY);
}
export function goalMark(c, scene) {
  if (scene.landmark !== "home") return spatialGoal(c, scene);
  c.save();
  rect(c, 175, 25, 130, 58, "#ded9bc66");
  for (const [x, direction] of [[175, 1], [305, -1]]) {
    line(c, [[x, 27], [x, 80]], "#56877a", 2);
    line(c, [[x, 27], [x + direction * 12, 27]], "#56877a", 2);
    line(c, [[x, 80], [x + direction * 12, 80]], "#56877a", 2);
  }
  c.restore();
}

const SPATIAL = {
  station: {
    ground: "#e5e9e7",
    outer: "#abbfbe",
    edge: "#b8cac7",
    tint: "#315d68",
  },
  cafe: {
    ground: "#eee7d9",
    outer: "#c7c9b9",
    edge: "#d6c9b1",
    tint: "#866247",
  },
  venue: {
    ground: "#d6dfdb",
    outer: "#93ada4",
    edge: "#b7c9c0",
    tint: "#32635e",
  },
  party: {
    ground: "#708580",
    outer: "#23363b",
    edge: "#516863",
    tint: "#d9ae69",
  },
};
function sCircle(c, x, y, r, color, stroke = null) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.stroke();
  }
}
function sPath(c, x, y, w, h, color = "#dedacb") {
  rect(c, x, y, w, h, color);
  line(
    c,
    [
      [x, y],
      [x + w, y],
    ],
    "#b9bdaf",
    1,
  );
  line(
    c,
    [
      [x, y + h],
      [x + w, y + h],
    ],
    "#b9bdaf",
    1,
  );
}
function sPaving(c, x, top, w, bottom, size, color) {
  for (let y = Math.floor(top / size) * size; y < bottom; y += size)
    line(
      c,
      [
        [x, y],
        [x + w, y],
      ],
      color,
      0.75,
    );
  for (let xx = x; xx < x + w; xx += size)
    line(
      c,
      [
        [xx, top],
        [xx, bottom],
      ],
      color,
      0.75,
    );
}
function sTree(c, x, y, r = 26) {
  sCircle(c, x + 3, y + 4, r, "#253e3e25");
  sCircle(c, x, y, r, "#5c806e", "#365f56");
  sCircle(c, x - r * 0.25, y - r * 0.27, r * 0.56, "#81a083");
  sCircle(c, x + r * 0.32, y + r * 0.2, r * 0.36, "#739575");
}
function sBench(c, x, y, w = 48) {
  rect(c, x + 2, y + 3, w, 16, "#2c41401c");
  rect(c, x, y, w, 16, "#997b59", true);
  for (const yy of [4, 8, 12])
    line(
      c,
      [
        [x + 4, y + yy],
        [x + w - 4, y + yy],
      ],
      "#d5b88b",
      1,
    );
}
function sCup(c, x, y) {
  sCircle(c, x, y, 7, "#f8f2e5", "#715745");
  sCircle(c, x, y, 4, "#74513d");
  sCircle(c, x + 7, y, 3, "#f8f2e5", "#715745");
  sCircle(c, x + 7, y, 1.4, "#c9a77f");
}
function sCafeTable(c, x, y) {
  sCircle(c, x + 3, y + 4, 30, "#3f34312b");
  for (const [dx, dy] of [[-38, 0], [38, 0], [0, -38], [0, 38]]) {
    rect(c, x + dx - 9, y + dy - 9, 18, 18, "#6e8a77", true);
    rect(c, x + dx - 5, y + dy - 5, 10, 10, "#a9c1a8");
  }
  sCircle(c, x, y, 28, "#a97856", "#644d3f");
  sCircle(c, x, y, 23, "#dfbd8f", "#8b6348");
  sCup(c, x - 10, y - 5);
  sCircle(c, x + 12, y + 8, 6, "#f5e7cd", "#8b6348");
  sCircle(c, x + 12, y + 8, 3, "#c18453");
}
function sSideBuilding(c, side, y, kind, index = 0) {
  c.save();
  c.translate(side < 0 ? 0 : 480, y);
  c.scale(side < 0 ? -1 : 1, 1);
  const h = kind === "station" ? 142 : kind === "cafe" ? 180 : 156;
  const front = kind === "station" ? 32 + index * 8 : 23;
  const roof =
    kind === "station"
      ? ["#708f93", "#7a9996", "#66818a"][index % 3]
      : kind === "cafe"
        ? "#ada998"
        : "#73928b";
  rect(c, 0, 0, 250, h + 23, kind === "cafe" ? "#d4ccba" : "#b5c9c3");
  const door = 24 + h * (index % 2 ? 0.6 : 0.35);
  sPath(c, 0, door - 17, front + 3, 34, "#e7dfcf");
  rect(c, front + 4, 14, 203, h, "#29424425");
  rect(c, front, 10, 203, h, roof, true);
  rect(c, front + 13, 22, 176, h - 24, kind === "cafe" ? "#bcb7a5" : "#88a6a7");
  if (kind === "station") {
    rect(c, front + 28, 34, 115, 20, "#abc5c0", true);
    for (const xx of [front + 40, front + 67, front + 94])
      line(
        c,
        [
          [xx, 35],
          [xx, 53],
        ],
        "#e2eeee",
        1,
      );
  } else {
    rect(c, front + 65, 48, 48, 43, "#d7cabb", true);
    rect(c, front + 71, 54, 36, 31, "#b6c5b7");
  }
  // Vestibule faces the public walkway. Its roof is cut away only here.
  rect(c, front - 1, door - 20, 38, 40, "#eee7d9");
  line(
    c,
    [
      [front + 37, door - 20],
      [front + 37, door + 20],
    ],
    "#496363",
    2,
  );
  line(
    c,
    [
      [front, door - 20],
      [front + 37, door - 20],
    ],
    "#496363",
    2,
  );
  line(
    c,
    [
      [front, door + 20],
      [front + 37, door + 20],
    ],
    "#496363",
    2,
  );
  rect(c, front - 7, door - 15, 8, 30, "#b6aa92");
  c.restore();
}
function sStationExterior(c, { left, right, top, bottom }) {
  rect(c, left, top, right - left, bottom - top, "#b7c9c6");
  for (const side of [-1, 1]) {
    sSideBuilding(c, side, 505, "station", side < 0 ? 0 : 1);
    sSideBuilding(c, side, 118, "station", side < 0 ? 2 : 0);
    if (side < 0) {
      sTree(c, -93, 426, 26);
      sBench(c, -110, 469, 48);
    } else {
      sTree(c, 550, 460, 28);
      rect(c, 510, 561, 62, 31, "#567883", true);
    }
  }
  rect(c, -192, -250, 864, 346, "#647f82");
}
function sCafeExterior(c, { left, right, top, bottom }) {
  rect(c, left, top, right - left, bottom - top, "#c4c2b3");
  // West connects to platforms, east to a waiting room. All fixtures are
  // behind the vertical edge of the playable concourse.
  rect(c, -244, top, 244, bottom - top, "#b9c3ba");
  for (const y of [235, 440, 620]) {
    rect(c, -220, y, 212, 80, "#718c8a", true);
    for (let xx = -207; xx < -25; xx += 30)
      line(
        c,
        [
          [xx, y + 17],
          [xx, y + 63],
        ],
        "#c8d6ce",
        2,
      );
    sPath(c, -10, y + 19, 10, 42);
  }
  for (const y of [165, 475]) {
    rect(c, 490, y, 181, 136, "#e0d1ba", true);
    sBench(c, 513, y + 22, 56);
    sBench(c, 594, y + 77, 56);
    rect(c, 492, y + 50, 18, 40, "#d8bd8d");
  }
}
function sVenueExterior(c, { left, right, top, bottom }) {
  rect(c, left, top, right - left, bottom - top, "#9db4aa");
  for (const side of [-1, 1]) {
    const sx = side < 0 ? -125 : 515;
    for (const y of [450, 586, 705])
      sTree(c, sx + ((y / 10) % 2 ? 11 : -8), y, 29);
    sBench(c, side < 0 ? -75 : 503, 505, 54);
    if (side < 0) sSideBuilding(c, side, 1015, "venue", 1);
    else sSideBuilding(c, side, 1015, "venue", 2);
    sSideBuilding(c, side, 125, "venue", side < 0 ? 1 : 2);
  }
}
function sHallExterior(c, { left, right, top, bottom }) {
  rect(c, left, top, right - left, bottom - top, "#26383c");
  for (const side of [-1, 1]) {
    const x = side < 0 ? -180 : 480;
    rect(c, x, -200, 180, 900, "#34494a");
    // Audience aisles are outlined, while seats remain outside the playfield.
    for (let y = -40; y < 635; y += 92) {
      rect(c, x + 13, y, 154, 61, "#4b6260");
      for (let xx = x + 27; xx < x + 160; xx += 23)
        sCircle(c, xx, y + 30, 7, "#607874");
    }
    rect(c, x, 715, 180, bottom - 715, "#888d7b");
    sBench(c, x + 37, 895, 81);
  }
}
function spatialSurroundings(c, scene, bounds) {
  c.save();
  if (scene.landmark === "station") sStationExterior(c, bounds);
  else if (scene.landmark === "cafe") sCafeExterior(c, bounds);
  else if (scene.landmark === "venue") sVenueExterior(c, bounds);
  else sHallExterior(c, bounds);
  c.restore();
}
function spatialFloor(c, scene, height) {
  const kind = scene.landmark,
    p = SPATIAL[kind];
  c.save();
  rect(c, 0, -800, 480, height + 1000, p.ground);
  if (kind === "station") {
    sPaving(c, 0, -800, 480, height + 200, 72, "#c6d5d0");
    rect(c, 0, -800, 23, height + 1000, "#c0d0cb");
    rect(c, 457, -800, 23, height + 1000, "#c0d0cb");
    // A broad plaza and a readable narrower station approach.
    rect(c, 126, 106, 228, 194, "#d4e0dc");
    for (const x of [126, 354])
      line(
        c,
        [
          [x, 106],
          [x, 300],
        ],
        "#abbdb8",
        1,
      );
  } else if (kind === "cafe") {
    sPaving(c, 0, -800, 480, height + 200, 80, "#ddd4c4");
    // Three separated crossing halls make each wave readable before entry.
    for (const y of [245, 445, 640]) rect(c, 0, y - 42, 480, 84, "#e1dbc9");
    for (const y of [203, 287, 403, 487, 598, 682])
      line(
        c,
        [
          [0, y],
          [480, y],
        ],
        "#cabb9f",
        1.2,
      );
    for (const [top, bottom] of [[95, 194], [296, 394], [496, 590], [690, 830]])
      rect(c, 202, top, 76, bottom - top, "#f0ebde");
  } else if (kind === "venue") {
    rect(c, 0, -800, 480, 1100, "#d5dfda");
    rect(c, 0, 365, 480, 415, "#b6c7b8");
    rect(c, 62, 365, 356, 415, "#d9ded0");
    rect(c, 0, 925, 480, height - 925 + 200, "#bfd0cb");
    rect(c, 143, 365, 194, 415, "#e4e5da");
    // Three seams follow an actual public path, with no painted fence in it.
    for (const x of [62, 143, 337, 418])
      line(
        c,
        [
          [x, 365],
          [x, 780],
        ],
        "#9fb4a9",
        1,
      );
    sPaving(c, 0, 930, 480, height + 200, 90, "#abc0b9");
  } else {
    rect(c, 0, -800, 480, 1480, "#627b77");
    rect(c, 0, 685, 480, height - 685 + 200, "#c5c1aa");
    rect(c, 196, 38, 88, 640, "#75928b");
    for (let y = 125; y < 680; y += 94)
      line(
        c,
        [
          [0, y],
          [480, y],
        ],
        "#8aa09a",
        0.8,
      );
    sPaving(c, 0, 730, 480, height + 200, 84, "#aeaf9a");
  }
  c.restore();
}
function spatialDetails(c, scene) {
  c.save();
  if (scene.landmark === "station") {
    // Horizontal access from the side shops into the public plaza.
    for (const [y, side] of [
      [172, -1],
      [535, -1],
      [212, 1],
      [570, 1],
    ])
      sPath(c, side < 0 ? 0 : 436, y, 44, 34, "#e2ddd0");
    for (const x of [29, 451]) {
      rect(c, x - 3, 122, 6, 145, "#ccbb76");
      for (let y = 132; y < 260; y += 18)
        line(
          c,
          [
            [x - 3, y],
            [x + 3, y],
          ],
          "#988a56",
          1,
        );
    }
  } else if (scene.landmark === "cafe") {
    // Each side door feeds one crossing hall; the central path stops at them.
    for (const y of [225, 425, 620]) {
      sPath(c, 0, y, 50, 38, "#d2ddd4");
      sPath(c, 430, y, 50, 38, "#e5d5bc");
    }
    // Canopy ribs on the platform edge and benches in the waiting room
    // carry the station setting without labels in the walking lane.
    for (const y of [225, 620])
      for (const x of [12, 32])
        rect(c, x, y - 8, 4, 49, "#607c79");
  }
  c.restore();
}
function spatialBoundary(c, scene) {
  c.save();
  if (scene.landmark === "party") {
    // Physical front-row barrier remains exactly at y=20.
    rect(c, 0, 7, 480, 13, "#3a5352");
    line(
      c,
      [
        [0, 20],
        [480, 20],
      ],
      "#d0d8c9",
      4,
    );
    for (let x = 19; x < 480; x += 50) sCircle(c, x, 20, 4, "#23383a");
  } else {
    for (const [x, w] of [
      [0, 162],
      [318, 162],
    ]) {
      rect(c, x, 87, w, 7, scene.landmark === "cafe" ? "#92795e" : "#6d8181");
      line(
        c,
        [
          [x, 94],
          [x + w, 94],
        ],
        "#394e50",
        2,
      );
    }
  }
  c.restore();
}
function sStationGoal(c) {
  // Outdoor plaza -> broad open threshold -> ticket gates. The entrance gap
  // leaves 12px for the player around the x=174..306 center corridor.
  rect(c, 0, -205, 162, 292, "#718d8d", true);
  rect(c, 318, -205, 162, 292, "#718d8d", true);
  rect(c, 162, -205, 156, 225, "#d5e0da");
  for (const y of [-190, -177])
    line(c, [[166, y], [314, y]], "#55777b", 4);
  rect(c, 163, -156, 154, 10, "#d4bf74");
  for (let x = 169; x < 315; x += 13)
    rect(c, x, -153, 5, 4, "#f3e5a8");
  for (const x of [185, 228, 271]) {
    rect(c, x, -122, 16, 55, "#456d70", true);
    rect(c, x + 2, -114, 12, 25, "#98bbb2");
    rect(c, x - 3, -67, 22, 7, "#567e74");
    rect(c, x + 2, -82, 12, 8, "#253f43");
    line(c, [[x + 5, -78], [x + 8, -75], [x + 12, -80]], "#c4e0b4", 2);
  }
  for (const [x, y] of [
    [46, -95],
    [374, -110],
  ]) {
    rect(c, x, y, 68, 33, "#b6cdca", true);
    rect(c, x + 9, y + 7, 50, 19, "#4e6f73");
  }
  sPath(c, 162, 15, 156, 80, "#c3d8d1");
  rect(c, 162, 13, 156, 5, "#446d70");
  line(c, [[229, 39], [240, 26], [251, 39]], "#5b8980", 3);
}
function sCafeGoal(c) {
  // Low railings make the two furnished terraces match the side boundaries;
  // the open middle remains the only playable entrance.
  for (const x of [0, 318]) {
    rect(c, x, -210, 162, 297, "#d8c3a4", true);
    for (let y = -194; y < 84; y += 23)
      line(c, [[x + 6, y], [x + 155, y]], "#c7ad8b", 1);
    rect(c, x === 0 ? 154 : 318, -206, 8, 293, "#806e58");
    for (const y of [-195, -95, 5, 80])
      sCircle(c, x === 0 ? 158 : 322, y, 4, "#eee1c8", "#6f5e4c");
    sCafeTable(c, x + 80, -145);
    sCafeTable(c, x + 80, -37);
  }
  // A cutaway view into the cafe: counter, espresso machine and pastry case.
  rect(c, 162, -205, 156, 230, "#f0e4cd", true);
  for (let y = -194; y < 15; y += 42)
    line(c, [[165, y], [315, y]], "#ddcbb0", 1);
  rect(c, 177, -192, 126, 73, "#775848", true);
  rect(c, 183, -186, 114, 29, "#b78b5e");
  for (const x of [195, 235, 275]) sCup(c, x, -171);
  rect(c, 184, -151, 112, 26, "#e3cda8", true);
  for (const x of [198, 223, 248, 273]) {
    sCircle(c, x, -138, 7, "#c4844d", "#86573c");
    sCircle(c, x - 2, -141, 2, "#f6dcaa");
  }
  rect(c, 190, -106, 100, 29, "#9b7051", true);
  rect(c, 197, -100, 35, 17, "#40504b", true);
  for (const x of [250, 269]) sCup(c, x, -91);
  // Two glass door leaves stand open below a striped fabric awning.
  sPath(c, 166, 20, 148, 75, "#f3e8d6");
  rect(c, 168, 27, 7, 59, "#77594b");
  rect(c, 305, 27, 7, 59, "#77594b");
  line(c, [[175, 28], [193, 45]], "#a3beb0", 3);
  line(c, [[305, 28], [287, 45]], "#a3beb0", 3);
  rect(c, 160, -8, 160, 31, "#f8e8c9", true);
  for (let x = 161; x < 320; x += 20)
    rect(c, x, -7, 10, 29, "#ad654c");
  line(c, [[160, 23], [320, 23]], "#785845", 3);
}
function sVenueGoal(c) {
  // Roof planes, service fans, and a flat music emblem establish an overhead
  // venue. The covered opening and threshold lead into its central atrium.
  for (const [x, fan] of [[0, 82], [318, 398]]) {
    rect(c, x, -205, 162, 292, "#63877d", true);
    rect(c, x + 10, -193, 142, 268, "#72968b");
    for (const seamY of [-165, -36, 65])
      line(c, [[x + 10, seamY], [x + 152, seamY]], "#98b3a7", 1);
    sCircle(c, fan, -106, 25, "#42675e", "#b6cbc0");
    sCircle(c, fan, -106, 18, "#8aa99b", "#32564e");
    for (const angle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2])
      line(c, [
        [fan + Math.cos(angle) * 5, -106 + Math.sin(angle) * 5],
        [fan + Math.cos(angle) * 16, -106 + Math.sin(angle) * 16],
      ], "#42675e", 3);
  }
  rect(c, 162, -205, 156, 228, "#c7d9ce");
  sPath(c, 169, -200, 142, 216, "#dbe6dc");
  sCircle(c, 240, -122, 38, "#6b9181", "#e4d9ac");
  sCircle(c, 240, -122, 29, "#496f63");
  text(c, "♪", 240, -109, 35, "#f0dfaa");
  rect(c, 180, -47, 120, 25, "#476d60");
  for (const [x, height] of [[197, 9], [212, 16], [227, 11], [242, 19], [257, 12], [272, 16]])
    rect(c, x, -27 - height, 7, height, "#f1e4b8");
  rect(c, 162, -17, 156, 44, "#71988b");
  for (const x of [172, 202, 232, 262, 292])
    line(c, [[x, -13], [x + 19, 23]], "#9cb9a7", 1);
  for (const x of [172, 191, 210, 229, 248, 267, 286, 305])
    sCircle(c, x, 19, 4, "#f7df9f", "#7a785f");
  sPath(c, 162, 27, 156, 67, "#d9e3da");
  rect(c, 162, 27, 156, 5, "#416a60");
  for (const [x, direction] of [[153, -1], [327, 1]]) {
    sCircle(c, x, 52, 5, "#d7d5b9", "#405e55");
    line(c, [[x, 52], [x + direction * 23, 52]], "#d9d0ac", 2);
  }
}
function sPartyGoal(c, opts) {
  rect(c, 78, -205, 324, 214, "#31494b", true);
  rect(c, 91, -190, 298, 172, "#3e5b59");
  rect(c, 108, -180, 264, 15, "#557775");
  // Fixtures viewed from above: instrument bodies, keys and mic stand have
  // ground footprints. Performers use the same figure projection as crowd.
  for (const [x, color] of [
    [155, "#a88b61"],
    [240, "#719c90"],
    [325, "#a88b61"],
  ]) {
    sCircle(c, x, -130, 28, color + "2a");
    sCircle(c, x, -130, 10, color + "20");
  }
  sCircle(c, 170, -84, 17, "#bd925b", "#694f3d");
  line(
    c,
    [
      [170, -84],
      [200, -96],
    ],
    "#b18a55",
    6,
  );
  rect(c, 294, -96, 54, 25, "#262e31", true);
  for (let x = 299; x < 346; x += 7) rect(c, x, -91, 4, 10, "#ecede3");
  sCircle(c, 240, -96, 11, "#778e8b", "#435a56");
  line(
    c,
    [
      [240, -96],
      [240, -61],
    ],
    "#c4d0c4",
    2,
  );
  for (const [x, y, id, shirt] of [
    [148, -124, 5, "#c1a078"],
    [240, -126, 1, "#8ca798"],
    [331, -120, 4, "#b67a56"],
  ])
    drawCharacter(
      c,
      {
        x,
        y,
        r: 11,
        appearanceId: id,
        id,
        shirt,
        friend: true,
        state: "waiting",
      },
      {
        pose: { ux: 0, uy: 1, distance: 0, moving: false, speed: 0 },
        reducedMotion: true,
        overhead: true,
      },
    );
  if (opts.complete) text(c, "また一緒に来よう", 240, -46, 11, "#e4d7ac");
}
function spatialArchitecture(c, scene, opts) {
  c.save();
  if (scene.landmark === "station") sStationGoal(c);
  else if (scene.landmark === "cafe") sCafeGoal(c);
  else if (scene.landmark === "venue") sVenueGoal(c);
  else sPartyGoal(c, opts);
  c.restore();
}
function spatialRain(c, opts) {
  c.save();
  // Rain canopies are roof footprints, attached to the route's side edges.
  for (const [x, y] of [
    [-104, 995],
    [478, 120],
  ]) {
    rect(c, x + 3, y + 4, 92, 33, "#253f411f");
    rect(c, x, y, 92, 33, "#577e79", true);
    for (let i = 0; i < 4; i++)
      line(
        c,
        [
          [x + i * 25, y + 2],
          [x + i * 25 + 20, y + 30],
        ],
        "#91b0a5",
        1,
      );
  }
  for (const [x, y] of [
    [33, 1030],
    [435, 472],
    [45, 691],
    [421, 102],
  ]) {
    c.fillStyle = "#9fbdb8a0";
    c.beginPath();
    c.ellipse(x, y, 19, 5, -0.12, 0, Math.PI * 2);
    c.fill();
    line(
      c,
      [
        [x - 5, y],
        [x + 9, y],
      ],
      "#d8eeea",
      1,
    );
  }
  c.restore();
}
function spatialJourney(c) {
  c.save();
  // The station exit supplies the route before the first road; the park lies
  // between two actual crossings, with its paths aligned to those crossings.
  rect(c, -152, 1055, 152, 96, "#718f8c", true);
  rect(c, 480, 1055, 152, 96, "#718f8c", true);
  rect(c, 154, 1073, 172, 61, "#c9d7d0");
  rect(c, 154, 1072, 172, 5, "#50756e");
  for (const x of [184, 236, 288]) {
    rect(c, x, 1085, 8, 27, "#47776e", true);
    rect(c, x - 2, 1085, 12, 5, "#a4c3b7");
  }
  for (const [x, y] of [
    [-17, 431],
    [497, 464],
    [-17, 625],
    [497, 694],
  ]) {
    sCircle(c, x, y, 14, "#6c967b");
  }
  sPath(c, 80, 424, 63, 42, "#e2e3cf");
  sPath(c, 337, 663, 68, 42, "#e2e3cf");
  line(
    c,
    [
      [143, 445],
      [143, 664],
    ],
    "#b3c4b4",
    1,
  );
  line(
    c,
    [
      [337, 445],
      [337, 684],
    ],
    "#b3c4b4",
    1,
  );
  for (const y of [520, 610])
    line(c, [[230, y + 12], [240, y], [250, y + 12]], "#a7bbae", 2);
  c.restore();
}
function spatialHall(c) {
  c.save();
  // Lobby -> ticket desk -> two physical gates -> audience. The model clamps
  // the player's center to x=142..338; visible solids leave its 12px radius.
  rect(c, 0, 790, 130, 30, "#947955", true);
  rect(c, 350, 790, 130, 30, "#947955", true);
  for (const x of [24, 370]) {
    rect(c, x, 798, 84, 15, "#e9e0ca");
    for (let i = 0; i < 3; i++) rect(c, x + 10 + 25 * i, 802, 14, 7, "#799590");
  }
  for (const [top, bottom] of [
    [790, 825],
    [685, 720],
  ]) {
    rect(c, 0, top, 130, bottom - top, "#496660", true);
    rect(c, 350, top, 130, bottom - top, "#496660", true);
    rect(c, 130, top, 220, bottom - top, "#cfd0b7");
    line(
      c,
      [
        [130, top],
        [130, bottom],
      ],
      "#385952",
      2,
    );
    line(
      c,
      [
        [350, top],
        [350, bottom],
      ],
      "#385952",
      2,
    );
  }
  sPath(c, 166, 838, 148, 45, "#d9d4b9");
  for (const x of [195, 226, 257]) {
    rect(c, x, 854, 21, 12, "#f4e8cc", true);
    line(c, [[x + 6, 858], [x + 15, 858]], "#9b8d70", 1);
  }
  line(c, [[226, 751], [240, 737], [254, 751]], "#72978a", 3);
  c.restore();
}
function spatialFurniture(c, scene, startY) {
  c.save();
  const color = scene.landmark === "party" ? "#c8c2a7" : "#a6b6aa";
  for (const y of [startY + 24, startY + 49])
    line(c, [[228, y + 10], [240, y], [252, y + 10]], color, 2);
  c.restore();
}
function spatialGoal(c, scene) {
  c.save();
  if (scene.landmark === "party") {
    for (const x of [153, 240, 327])
      sCircle(c, x, 61, 26, "#ecd69a24");
  } else {
    const color =
      scene.landmark === "cafe"
        ? "#e8dcc7"
        : scene.landmark === "venue"
          ? "#d9e3da"
          : "#c3d8d1";
    rect(c, 175, 25, 130, 58, color + "66");
    for (const [x, direction] of [[175, 1], [305, -1]]) {
      line(c, [[x, 27], [x, 80]], "#56877a", 2);
      line(c, [[x, 27], [x + direction * 12, 27]], "#56877a", 2);
      line(c, [[x, 80], [x + direction * 12, 80]], "#56877a", 2);
    }
  }
  c.restore();
}
