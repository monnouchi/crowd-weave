// Original oblique map illustration. All geometry is decoration; the simulation
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
  return PALETTES[scene.landmark] || PALETTES.home;
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
function sign(c, words, x, y, w, color = TEAL, size = 11) {
  rect(c, x, y, w, 23, color, true);
  text(c, words, x + w / 2, y + 16, size, PAPER);
}
function windowPane(c, x, y, w, h, dark = false) {
  rect(c, x, y, w, h, dark ? "#48666c" : "#a9c5c0", true);
  polygon(
    c,
    [
      [x + 2, y + 2],
      [x + w - 2, y + 2],
      [x + 2, y + h - 2],
    ],
    dark ? "#648086" : "#c8d8cd",
  );
  line(
    c,
    [
      [x + w / 2, y],
      [x + w / 2, y + h],
    ],
    INK,
    1,
  );
}
function tree(c, x, y, r = 19, seed = 0) {
  c.save();
  c.translate(x, y);
  polygon(
    c,
    [
      [-r + 4, 7],
      [r + 6, 7],
      [r + 8, 16],
      [-r + 6, 16],
    ],
    "#293c4020",
  );
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5,
      rr = r * (i % 2 ? 0.84 : 1);
    return [Math.cos(a) * rr, Math.sin(a) * rr * 0.75];
  });
  polygon(c, pts, seed % 2 ? "#738965" : "#55785f", true);
  polygon(
    c,
    [
      [-r * 0.65, -3],
      [-r * 0.3, -r * 0.55],
      [r * 0.3, -r * 0.4],
      [r * 0.55, 1],
      [0, 3],
    ],
    "#8b9e72",
  );
  line(
    c,
    [
      [-4, -4],
      [0, 6],
      [6, 0],
    ],
    "#3e6051",
    1,
  );
  c.restore();
}
function bench(c, x, y, w = 42) {
  rect(c, x + 3, y + 9, w, 5, "#293c4020");
  rect(c, x, y, w, 10, "#9e7d52", true);
  line(
    c,
    [
      [x + 1, y + 4],
      [x + w - 1, y + 4],
    ],
    "#d1b78c",
    1,
  );
  rect(c, x + 5, y + 10, 3, 4, INK);
  rect(c, x + w - 8, y + 10, 3, 4, INK);
}
function poster(c, x, y, w = 25, h = 38, kind = "live") {
  rect(c, x, y, w, h, PAPER, true);
  rect(c, x + 3, y + 3, w - 6, 6, kind === "menu" ? "#a2643f" : RED);
  text(
    c,
    kind === "menu" ? "MENU" : "LIVE",
    x + w / 2,
    y + 8,
    Math.max(4, w / 5),
    PAPER,
    "center",
    800,
  );
  if (kind === "menu") {
    rect(c, x + 5, y + 14, w * 0.42, 8, TEAL, true);
    line(
      c,
      [
        [x + w * 0.65, y + 15],
        [x + w * 0.75, y + 15],
        [x + w * 0.75, y + 20],
        [x + w * 0.65, y + 20],
      ],
      TEAL,
      1,
    );
    for (let row = 0; row < 3; row++)
      line(
        c,
        [
          [x + 5, y + h - 13 + row * 3],
          [x + w - 5, y + h - 13 + row * 3],
        ],
        "#93816a",
        0.7,
      );
  } else {
    c.fillStyle = "#c4a36c";
    c.beginPath();
    c.arc(x + w / 2, y + h * 0.51, w * 0.24, 0, Math.PI * 2);
    c.fill();
    line(
      c,
      [
        [x + 5, y + h * 0.72],
        [x + w * 0.36, y + h * 0.46],
        [x + w * 0.62, y + h * 0.73],
        [x + w - 5, y + h * 0.4],
      ],
      TEAL,
      2,
    );
    for (let sx = x + 5; sx < x + w - 5; sx += 5)
      rect(c, sx, y + h - 6, 3, 1, INK);
  }
}
const stamps = new Map();
function stamp(c, key, x, y, w, h, paint) {
  if (typeof OffscreenCanvas === "undefined") return false;
  let tile = stamps.get(key);
  if (!tile) {
    if (stamps.size >= 48) stamps.clear();
    tile = new OffscreenCanvas(Math.ceil(w * 2), Math.ceil(h * 2));
    const t = tile.getContext("2d");
    t.scale(2, 2);
    paint(t);
    stamps.set(key, tile);
  }
  c.drawImage(tile, x, y, w, h);
  return true;
}
function house(c, x, y, w, h, index = 0) {
  if (
    stamp(c, `house:${w}:${h}:${index}`, x, y, w + 10, h + 10, (t) =>
      houseInk(t, 0, 0, w, h, index),
    )
  )
    return;
  houseInk(c, x, y, w, h, index);
}
function houseInk(c, x, y, w, h, index) {
  const roof = [
    ["#7b8a7c", "#65766e"],
    ["#93836d", "#7e715f"],
    ["#819599", "#657e84"],
  ][index % 3];
  rect(c, x + 7, y + 9, w, h, "#293c4020");
  rect(c, x, y + h - 44, w, 44, index % 2 ? "#cec3a5" : "#ddd3b9", true);
  polygon(
    c,
    [
      [x, y + 10],
      [x + w / 2, y],
      [x + w / 2, y + h - 44],
      [x, y + h - 34],
    ],
    roof[0],
    true,
  );
  polygon(
    c,
    [
      [x + w / 2, y],
      [x + w, y + 10],
      [x + w, y + h - 34],
      [x + w / 2, y + h - 44],
    ],
    roof[1],
    true,
  );
  for (let sy = y + 16; sy < y + h - 40; sy += 12)
    line(
      c,
      [
        [x + 3, sy],
        [x + w / 2, sy - 8],
        [x + w - 3, sy],
      ],
      "#f5f0df24",
      0.8,
    );
  windowPane(c, x + w * 0.17, y + 21, 23, 29);
  rect(c, x + w * 0.72, y + 15, 12, 12, "#afb4a0", true);
  windowPane(c, x + 10, y + h - 25, 30, 13);
  windowPane(c, x + w - 44, y + h - 25, 30, 13);
  rect(c, x + w / 2 - 9, y + h - 23, 18, 23, "#62786d", true);
  rect(c, x + w / 2 + 4, y + h - 12, 2, 2, PAPER);
  rect(c, x + 10, y + h - 8, 16, 6, "#884c3d", true);
  text(c, String(12 + index), x + 18, y + h - 3, 5, PAPER);
  line(
    c,
    [
      [x + 5, y + h],
      [x + w + 3, y + h],
    ],
    "#727b68",
    2,
  );
}

function shop(c, x, y, w, index, landmark) {
  if (
    stamp(c, `shop:${w}:${index}:${landmark}`, x, y, w + 10, 138, (t) =>
      shopInk(t, 0, 0, w, index, landmark),
    )
  )
    return;
  shopInk(c, x, y, w, index, landmark);
}
function shopInk(c, x, y, w, index, landmark) {
  rect(c, x + 6, y + 7, w, 128, "#293c4020");
  rect(c, x, y, w, 128, "#cecbb7", true);
  rect(c, x, y, w, 28, landmark === "cafe" ? "#738779" : "#60797d", true);
  for (let sx = x + 7; sx < x + w; sx += 10)
    line(
      c,
      [
        [sx, y + 4],
        [sx, y + 23],
      ],
      "#ffffff20",
      1,
    );
  const names =
    landmark === "cafe"
      ? ["BOOKS", "COFFEE", "KIOSK"]
      : ["駅前商店", "花と緑", "STORE"];
  sign(c, names[index % 3], x + 6, y + 35, w - 12, index % 2 ? TEAL : INK, 9);
  windowPane(c, x + 8, y + 63, w - 16, 42, true);
  rect(c, x + 6, y + 108, w - 12, 7, "#97886e", true);
  if (index % 2) poster(c, x + 10, y + 67, 17, 28);
}
export function surroundings(
  c,
  scene,
  { left = -600, right = 1080, top = -800, bottom = 1400 } = {},
) {
  const p = scenePalette(scene);
  c.save();
  rect(c, left, top, right - left, bottom - top, p.outer);
  if (scene.landmark === "party") {
    for (const x of [-165, 480]) {
      rect(c, x, top, 165, bottom - top, "#263b40");
      for (let y = Math.floor(top / 150) * 150; y < bottom; y += 150) {
        rect(c, x + 20, y + 20, 120, 102, "#30464b", true);
        for (let i = 0; i < 5; i++)
          line(
            c,
            [
              [x + 35, y + 36 + i * 6],
              [x + 125, y + 36 + i * 6],
            ],
            "#506267",
            1,
          );
        rect(c, x + 28, y + 93, 26, 13, "#637777", true);
        rect(c, x + 84, y + 93, 48, 13, "#3e5358", true);
      }
    }
    c.restore();
    return;
  }
  for (const side of [-1, 1]) {
    const edge = side < 0 ? -153 : 493;
    for (let y = Math.floor(top / 178) * 178; y < bottom; y += 178) {
      const index = (((Math.floor(y / 178) + 11) % 7) + 7) % 7;
      if (scene.landmark === "venue" && y > 260 && y < 790) {
        rect(c, edge - 25, y, 190, 173, "#9dac8b");
        tree(c, edge + 30, y + 38, 30, index);
        tree(c, edge + 108, y + 97, 36, index + 1);
        line(
          c,
          [
            [edge + 12, y + 148],
            [edge + 141, y + 148],
          ],
          "#c8c6ab",
          8,
        );
      } else if (scene.landmark === "home")
        house(
          c,
          edge + (index % 2 ? 12 : 0),
          y + 14,
          index % 2 ? 128 : 138,
          135,
          index,
        );
      else shop(c, edge + 8, y + 17, 133, index, scene.landmark);
    }
    // The next block has roof planes, not another stack of floating façades.
    const far = side < 0 ? edge - 198 : edge + 185;
    for (let y = Math.floor(top / 240) * 240; y < bottom; y += 240) {
      rect(c, far, y + 16, 160, 174, "#929e8e", true);
      rect(c, far + 10, y + 26, 140, 153, "#b7b9a0");
      rect(c, far + 23, y + 45, 43, 38, "#839188", true);
      rect(c, far + 90, y + 102, 34, 31, "#8a9589", true);
    }
  }
  c.restore();
}
export function paintFloor(c, scene, height = 680) {
  const p = scenePalette(scene);
  c.save();
  rect(c, 0, -800, 480, height + 1000, p.ground);
  rect(c, 0, -800, 18, height + 1000, p.edge);
  rect(c, 462, -800, 18, height + 1000, p.edge);
  line(
    c,
    [
      [18, -800],
      [18, height + 200],
    ],
    "#78877a",
    1.5,
  );
  line(
    c,
    [
      [462, -800],
      [462, height + 200],
    ],
    "#78877a",
    1.5,
  );
  if (scene.landmark === "cafe" || scene.landmark === "station") {
    c.strokeStyle = scene.landmark === "cafe" ? "#cec6af" : "#c3c9bf";
    c.lineWidth = 0.7;
    c.beginPath();
    for (let y = -750; y < height + 200; y += 60) {
      c.moveTo(18, y);
      c.lineTo(462, y);
    }
    for (let x = 48; x < 462; x += 60) {
      c.moveTo(x, -800);
      c.lineTo(x, height + 200);
    }
    c.stroke();
  } else if (scene.landmark === "home") {
    for (let y = -650; y < height + 100; y += 108) {
      line(
        c,
        [
          [30, y],
          [170, y],
        ],
        "#c9c3b0",
        0.7,
      );
      line(
        c,
        [
          [300, y + 54],
          [452, y + 54],
        ],
        "#c9c3b0",
        0.7,
      );
    }
  }
  c.restore();
}
export function floorDetails(c, scene) {
  c.save();
  if (scene.landmark === "home") {
    for (const [x, y] of [
      [7, 160],
      [473, 265],
      [7, 455],
      [473, 570],
    ])
      tree(c, x, y, 13, y);
    for (const [x, y] of [
      [3, 296],
      [464, 500],
    ]) {
      rect(c, x, y, 12, 30, "#697e6d", true);
      line(
        c,
        [
          [x + 3, y + 5],
          [x + 9, y + 5],
        ],
        PAPER,
        1,
      );
    }
  } else if (scene.landmark === "station") {
    for (const x of [8, 465])
      for (let y = 120; y < 680; y += 160) {
        rect(c, x, y, 7, 55, "#c5af63");
        for (let i = 0; i < 5; i++)
          line(
            c,
            [
              [x + 2, y + 5 + i * 10],
              [x + 5, y + 5 + i * 10],
            ],
            "#897b4c",
            1,
          );
      }
  } else if (scene.landmark === "cafe") {
    sign(c, "← 改札", -110, 220, 103, INK, 11);
    sign(c, "ホーム →", 487, 220, 103, INK, 11);
    bench(c, -75, 180, 56);
    bench(c, 498, 380, 56);
    for (const x of [-33, 493]) {
      rect(c, x, 520, 26, 42, TEAL, true);
      rect(c, x + 4, 525, 18, 22, PAPER);
      for (let i = 0; i < 3; i++)
        rect(c, x + 6 + i * 5, 529, 3, 10, [RED, TEAL, "#c49c56"][i]);
      rect(c, x + 8, 552, 10, 3, INK);
    }
  }
  c.restore();
}
export function goalBoundary(c, scene) {
  c.save();
  if (scene.landmark === "party") {
    rect(c, 18, -195, 18, 260, "#354e53", true);
    rect(c, 444, -195, 18, 260, "#354e53", true);
    rect(c, 36, 23, 408, 6, "#293c4028");
    for (let x = 36; x <= 444; x += 51) {
      rect(c, x - 5, 20, 10, 4, INK);
      line(
        c,
        [
          [x, -3],
          [x, 23],
        ],
        "#6d878a",
        3,
      );
    }
    line(
      c,
      [
        [34, -5],
        [446, -5],
      ],
      "#d2d6ca",
      4,
    );
    line(
      c,
      [
        [34, 8],
        [446, 8],
      ],
      "#698183",
      2,
    );
  } else if (scene.landmark === "home") {
    for (const x of [18, 318]) {
      rect(c, x, 83, 144, 13, "#6d7f5f", true);
      for (let sx = x + 5; sx < x + 144; sx += 17)
        polygon(
          c,
          [
            [sx, 77],
            [sx + 13, 76],
            [sx + 16, 87],
            [sx - 2, 87],
          ],
          "#85916c",
        );
    }
  } else {
    for (const x of [18, 318]) {
      rect(
        c,
        x,
        -180,
        144,
        276,
        scene.landmark === "cafe" ? "#cfbf9b" : "#b3c0b9",
        true,
      );
      rect(
        c,
        x + 6,
        -173,
        132,
        24,
        scene.landmark === "venue" ? "#315e61" : "#49696b",
        true,
      );
      line(
        c,
        [
          [x, 89],
          [x + 144, 89],
        ],
        INK,
        3,
      );
      if (scene.landmark === "cafe") {
        windowPane(c, x + 12, -103, 120, 100, true);
        rect(c, x + 13, 31, 118, 28, "#b38c5e", true);
        for (let sx = x + 20; sx < x + 130; sx += 24) {
          rect(c, sx, 40, 14, 8, PAPER, true);
          rect(c, sx + 4, 43, 6, 3, TEAL);
        }
        poster(c, x + 94, -91, 27, 43, "menu");
      } else {
        windowPane(c, x + 14, -115, 50, 95, true);
        windowPane(c, x + 79, -115, 50, 95, true);
        if (scene.landmark === "venue") poster(c, x + 22, -103, 35, 57);
        else {
          rect(c, x + 17, 24, 32, 40, INK, true);
          rect(c, x + 21, 29, 24, 17, "#8ba891");
          rect(c, x + 25, 52, 16, 3, "#c5ae66");
        }
      }
    }
  }
  c.restore();
}
export function architecture(
  c,
  scene,
  { time = 0, reducedMotion = false, complete = false } = {},
) {
  c.save();
  if (scene.landmark === "home") {
    house(c, 31, -166, 121, 135, 0);
    house(c, 327, -184, 120, 153, 1);
    rect(c, 180, -113, 120, 60, "#d4ceb8");
    line(
      c,
      [
        [181, -50],
        [300, -50],
      ],
      "#b2b4a0",
      1,
    );
    bench(c, 188, -77, 48);
    rect(c, 266, -87, 21, 31, "#859378", true);
    sign(c, "駅方面 →", 187, -28, 106, TEAL, 12);
  } else if (scene.landmark === "station") {
    rect(c, 163, -177, 154, 24, INK, true);
    text(c, "STATION", 240, -160, 14, PAPER, "center", 800);
    rect(c, 174, -145, 132, 134, "#b9cbc3");
    for (const x of [189, 235, 281]) {
      rect(c, x, -74, 10, 68, "#436569", true);
      rect(c, x + 1, -68, 8, 13, "#b6c9b2");
      rect(c, x - 12, -18, 12, 3, "#879d8d");
    }
    line(
      c,
      [
        [173, -137],
        [305, -137],
      ],
      PAPER,
      2,
    );
    text(c, "改札", 240, -108, 11, INK);
    sign(c, "駅入口", 178, -7, 124, TEAL, 12);
  } else if (scene.landmark === "cafe") {
    rect(c, 162, -181, 156, 28, "#5e5946", true);
    text(c, "喫茶 / COFFEE", 240, -162, 13, PAPER, "center", 800);
    rect(c, 172, -152, 136, 137, "#ddd0ad");
    rect(c, 180, -121, 120, 21, "#a8845b", true);
    rect(c, 192, -114, 22, 9, INK, true);
    rect(c, 196, -111, 6, 3, PAPER);
    rect(c, 225, -117, 27, 13, "#687d74", true);
    for (const x of [190, 261]) {
      rect(c, x, -71, 27, 24, "#b9a07c", true);
      rect(c, x + 7, -67, 9, 6, PAPER, true);
      line(
        c,
        [
          [x + 2, -45],
          [x + 25, -45],
        ],
        INK,
        1,
      );
    }
    sign(c, "待ち合わせ", 182, -8, 116, TEAL, 12);
  } else if (scene.landmark === "venue") {
    rect(c, 165, -177, 150, 162, "#b4c0b6", true);
    rect(c, 165, -170, 150, 35, INK, true);
    text(c, "LIVE TONIGHT", 240, -147, 15, "#e1b16b", "center", 800);
    windowPane(c, 181, -121, 118, 105, true);
    line(
      c,
      [
        [240, -121],
        [240, -16],
      ],
      PAPER,
      2,
    );
    for (const x of [231, 247]) rect(c, x, -58, 2, 14, "#d8c7a1");
    rect(c, 170, 12, 140, 13, "#416365", true);
    line(
      c,
      [
        [174, 15],
        [306, 15],
      ],
      "#8ca5a0",
      1,
    );
    text(c, "会場入口", 240, -1, 11, INK);
  } else {
    rect(c, 85, -195, 310, 150, "#344e55", true);
    rect(c, 102, -177, 276, 100, "#20353b", true);
    for (let x = 105; x < 378; x += 13)
      line(
        c,
        [
          [x, -175],
          [x, -80],
        ],
        "#31474c",
        1,
      );
    rect(c, 105, -185, 270, 8, INK, true);
    line(
      c,
      [
        [109, -181],
        [371, -181],
      ],
      "#8c9d97",
      1,
    );
    text(c, "CROWD WEAVE", 240, -154, 15, "#d7b677", "center", 800);
    rect(c, 109, -101, 31, 48, INK, true);
    rect(c, 340, -101, 31, 48, INK, true);
    for (const x of [124, 355])
      for (const y of [-87, -65]) {
        c.strokeStyle = "#70868a";
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.stroke();
      }
    rect(c, 103, -55, 274, 10, "#697b76", true);
    concert(c, { time, reducedMotion, complete });
  }
  c.restore();
}
function performer(c, x, y, id, shirt) {
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
      ux: 0,
      uy: 1,
    },
    {
      pose: { ux: 0, uy: 1, distance: 0, moving: false, speed: 0 },
      reducedMotion: true,
    },
  );
}
export function concert(
  c,
  { time = 0, reducedMotion = false, complete = false } = {},
) {
  c.save();
  for (const [x, color] of [
    [139, "#d5b780"],
    [240, "#7ba49c"],
    [343, "#d5b780"],
  ]) {
    const d = reducedMotion ? 0 : Math.sin(time * 0.22 + x) * 5;
    polygon(
      c,
      [
        [x - 3, -174],
        [x + 3, -174],
        [x + 29 + d, -63],
        [x - 28 + d, -63],
      ],
      color + "24",
    );
    rect(c, x - 5, -178, 10, 7, "#c4b486", true);
  }
  performer(c, 169, -97, 5, "#c1a078");
  performer(c, 240, -106, 1, "#8ca798");
  performer(c, 310, -100, 4, "#b67a56");
  // Instrument scale follows the same figures; cable and stands have endpoints.
  polygon(
    c,
    [
      [155, -96],
      [170, -94],
      [178, -84],
      [164, -76],
      [154, -81],
    ],
    "#bc9150",
    true,
  );
  line(
    c,
    [
      [166, -85],
      [194, -99],
    ],
    "#d1b78d",
    5,
  );
  line(
    c,
    [
      [166, -85],
      [194, -99],
    ],
    INK,
    1,
  );
  line(
    c,
    [
      [248, -123],
      [248, -72],
      [239, -68],
      [257, -68],
    ],
    "#a2aaa0",
    1.5,
  );
  rect(c, 244, -123, 8, 4, INK);
  rect(c, 288, -98, 48, 11, INK, true);
  rect(c, 291, -96, 42, 6, PAPER);
  for (let x = 296; x < 330; x += 6) rect(c, x, -96, 2, 4, INK);
  line(
    c,
    [
      [295, -87],
      [300, -65],
      [327, -65],
      [330, -87],
    ],
    INK,
    2,
  );
  line(
    c,
    [
      [146, -57],
      [190, -54],
      [190, -49],
    ],
    INK,
    1,
  );
  line(
    c,
    [
      [258, -71],
      [273, -64],
      [284, -64],
      [295, -55],
    ],
    INK,
    1,
  );
  if (complete) text(c, "一緒に、いい夜を。", 240, -31, 10, "#596e67");
  c.restore();
}
export function rainShelters(c, { time = 0, reducedMotion = false } = {}) {
  c.save();
  for (const [x, y, w] of [
    [30, 935, 70],
    [380, 205, 70],
  ]) {
    rect(c, x + 3, y + 12, w, 6, "#293c4020");
    rect(c, x, y, w, 13, "#486c70", true);
    for (let sx = x + 8; sx < x + w; sx += 12)
      line(
        c,
        [
          [sx, y + 2],
          [sx - 3, y + 11],
        ],
        "#91aaa5",
        1,
      );
    line(
      c,
      [
        [x, y + 14],
        [x, y + 20],
      ],
      INK,
      1,
    );
    line(
      c,
      [
        [x + w, y + 14],
        [x + w, y + 20],
      ],
      INK,
      1,
    );
  }
  // Sparse wet paving and drainage stay at the edges, outside the walking line.
  for (const [x, y] of [
    [30, 1040],
    [421, 300],
    [28, 568],
    [409, 1075],
  ]) {
    polygon(
      c,
      [
        [x, y],
        [x + 25, y - 2],
        [x + 34, y + 4],
        [x + 12, y + 8],
        [x - 5, y + 5],
      ],
      "#a3bab5",
    );
    line(
      c,
      [
        [x + 2, y + 1],
        [x + 21, y + 1],
      ],
      "#dce4d6",
      1,
    );
  }
  c.strokeStyle = "#446c7780";
  c.lineWidth = 0.8;
  c.beginPath();
  const d = reducedMotion ? 0 : time * 90;
  for (let i = 0; i < 28; i++) {
    const x = i % 2 ? 471 + ((i * 19) % 35) : -25 + ((i * 17) % 36),
      y = -200 + ((i * 53 + d) % 1450);
    c.moveTo(x, y);
    c.lineTo(x - 3, y + 10);
  }
  c.stroke();
  c.restore();
}
export function venueJourney(c) {
  c.save();
  rect(c, 18, 950, 444, 260, "#c8d2cd");
  rect(c, 18, 390, 444, 360, "#d4d7be");
  for (const x of [8, 472])
    for (const y of [435, 550, 660, 710]) tree(c, x, y, 23, y);
  bench(c, -48, 590, 55);
  bench(c, 476, 486, 55);
  sign(c, "公園の小道 / 会場へ ↑", -132, 614, 138, "#466c5b", 10);
  sign(c, "会場最寄り駅", 164, 1090, 152, TEAL, 12);
  line(
    c,
    [
      [18, 398],
      [462, 398],
    ],
    "#b1b79c",
    1,
  );
  line(
    c,
    [
      [18, 742],
      [462, 742],
    ],
    "#b1b79c",
    1,
  );
  c.restore();
}
export function hallInterior(c, { time = 0, reducedMotion = false } = {}) {
  c.save();
  rect(c, 18, 715, 444, 340, "#d6d0b9");
  rect(c, 18, -800, 444, 1485, "#a7b8b6");
  for (let y = -400; y < 685; y += 96) {
    line(
      c,
      [
        [20, y],
        [460, y],
      ],
      "#8ea4a1",
      0.6,
    );
  }
  for (const [x, y, color] of [
    [110, 300, "#c3d2bf"],
    [355, 430, "#b3c9c1"],
    [240, 155, "#cbd0b8"],
  ]) {
    const d = reducedMotion ? 0 : Math.sin(time * 0.22 + x) * 5;
    polygon(
      c,
      [
        [x - 39 + d, y - 62],
        [x + 35 + d, y - 60],
        [x + 60 + d, y + 45],
        [x - 61 + d, y + 46],
      ],
      color + "88",
    );
  }
  rect(c, 18, 690, 112, 28, "#355259", true);
  rect(c, 350, 690, 112, 28, "#355259", true);
  rect(c, 115, 690, 18, 90, "#46645d", true);
  rect(c, 347, 690, 18, 90, "#46645d", true);
  line(
    c,
    [
      [123, 715],
      [123, 735],
    ],
    "#dfbc76",
    2,
  );
  line(
    c,
    [
      [355, 715],
      [355, 735],
    ],
    "#dfbc76",
    2,
  );
  sign(c, "HALL ↑", 180, 690, 120, INK, 12);
  rect(c, 28, 800, 104, 24, "#a08156", true);
  rect(c, 354, 800, 99, 24, "#a08156", true);
  for (const x of [34, 360]) {
    rect(c, x, 803, 38, 16, PAPER, true);
    line(
      c,
      [
        [x + 4, 809],
        [x + 34, 809],
      ],
      TEAL,
      2,
    );
  }
  rect(c, 110, 806, 16, 9, "#d4ac62", true);
  rect(c, 116, 807, 1, 7, INK);
  line(
    c,
    [
      [118, 832],
      [165, 832],
    ],
    "#7b7963",
    1,
  );
  line(
    c,
    [
      [320, 832],
      [362, 832],
    ],
    "#7b7963",
    1,
  );
  text(c, "チケット確認", 240, 854, 12, INK);
  text(c, "LOBBY", 240, 916, 12, "#6d786b", "center", 700);
  c.restore();
}
export function streetFurniture(c, scene, { startY = 625 } = {}) {
  c.save();
  const p = scenePalette(scene);
  if (scene.landmark !== "party") {
    bench(c, -66, 532, 45);
    bench(c, 495, 370, 45);
    poster(c, -39, 470, 26, 43);
    poster(c, 488, scene.landmark === "venue" ? 1010 : 340, 26, 43);
    sign(
      c,
      scene.landmark === "home"
        ? "街のお知らせ"
        : scene.landmark === "venue"
          ? "公演案内"
          : "案内",
      -93,
      292,
      84,
      p.tint,
      10,
    );
    sign(
      c,
      scene.landmark === "home" ? "公園 →" : "WC →",
      488,
      scene.landmark === "venue" ? 1010 : 145,
      73,
      p.tint,
      11,
    );
  } else {
    sign(c, "BAR", -76, 200, 64, INK, 12);
    sign(c, "WC →", 488, 340, 76, INK, 11);
    poster(c, -40, 470, 25, 40);
  }
  line(
    c,
    [
      [202, startY + 30],
      [278, startY + 30],
    ],
    p.tint,
    1.2,
  );
  text(
    c,
    scene.landmark === "home"
      ? "自宅 / 出発"
      : scene.landmark === "party"
        ? "会場入口"
        : scene.landmark === "venue"
          ? "会場最寄り駅"
          : "START",
    240,
    startY + 48,
    11,
    p.tint,
  );
  c.restore();
}
export function goalMark(c, scene) {
  c.save();
  if (scene.landmark === "party") {
    text(c, "FRONT ROW", 240, 43, 10, INK);
    c.restore();
    return;
  }
  rect(c, 175, 20, 130, 65, scene.landmark === "home" ? "#ded9bc" : "#d2d4bd");
  for (const x of [175, 305]) {
    const dir = x === 175 ? 1 : -1;
    line(
      c,
      [
        [x, 43],
        [x, 24],
        [x + dir * 13, 24],
      ],
      TEAL,
      2,
    );
    line(
      c,
      [
        [x, 66],
        [x, 84],
        [x + dir * 13, 84],
      ],
      TEAL,
      2,
    );
  }
  text(c, "MEET UP", 240, 82, 9, "#4f6c60", "center", 700);
  c.restore();
}
