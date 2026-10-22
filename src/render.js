import { appearanceFor } from "./appearance.js";
import { drawRadar } from "./radar-view.js";
import { previewTurn } from "../crowd.js";

// A small perspective stage. World x/y and hitboxes still belong to the game;
// z exists only here so every visible object obeys the same camera and depth.
const NEAR = 7;
const FAR = 1550;
const EYE = 57;
const TAU = Math.PI * 2;

const THEMES = [
  { sky: ["#f4c8a5", "#c8e5dc"], haze: "#b9d5c9", ground: "#d5cbb4", path: "#e8dfca", edge: "#b0a88f", line: "#fff6dc", wall: ["#f1d8b9", "#d4a98b", "#b97862"], roof: "#885b58", ink: "#314a4b", accent: "#f0bd6d", glass: "#90b4ae" },
  { sky: ["#bcd8df", "#e5e1d4"], haze: "#b4c7cb", ground: "#c5cbc3", path: "#dbe3dd", edge: "#8da6a8", line: "#f2efdc", wall: ["#c9d8d6", "#a4bcbf", "#647f8b"], roof: "#54747d", ink: "#274c59", accent: "#f3bd69", glass: "#86bccb" },
  { sky: ["#f7d2aa", "#ebdec0"], haze: "#d8bda5", ground: "#c7aa8f", path: "#ead9bd", edge: "#bb896f", line: "#fff2d1", wall: ["#e8bc96", "#c8846b", "#915f60"], roof: "#9b5f54", ink: "#533f4b", accent: "#ffd079", glass: "#90b9b1" },
  { sky: ["#536981", "#9bb7bb"], haze: "#78939d", ground: "#71838d", path: "#869ca4", edge: "#546d7a", line: "#dceaf0", wall: ["#9faeb3", "#708690", "#536b7c"], roof: "#354e63", ink: "#173e4f", accent: "#f6c97f", glass: "#8bd3d3" },
  { sky: ["#181d37", "#554363"], haze: "#51435f", ground: "#292c40", path: "#36364b", edge: "#252739", line: "#9a8399", wall: ["#554b64", "#373852", "#272d46"], roof: "#25253e", ink: "#1d2536", accent: "#f6b96a", glass: "#a8d7e6" },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fract = (n) => n - Math.floor(n);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

function camera(game, view) {
  const width = Math.max(1, view.width || 390);
  const height = Math.max(1, view.height || 700);
  const yaw = clamp(view.yaw || 0, -0.3, 0.3);
  const focal = Math.min(width * 1.12, height * 0.91);
  const tall = clamp((height - 560) / 240, 0, 1);
  const frontRowView = game.stage === 4 && game.phase === "finished";
  return {
    width, height, focal, cx: width / 2,
    horizon: height * (.415 + .015 * tall),
    eye: EYE - 4 * (1 - tall), px: game.player.x,
    // The result camera steps to the rail after movement is complete. Friends
    // remain at their real world positions, now beside/behind the viewpoint.
    py: game.player.y - (frontRowView ? 44 : 0),
    sin: Math.sin(yaw), cos: Math.cos(yaw),
    stage: clamp(game.stage || 0, 0, 4),
  };
}

function cameraPoint(c, x, y, z = 0) {
  const dx = x - c.px;
  const forward = c.py - y;
  return {
    side: dx * c.cos - forward * c.sin,
    depth: forward * c.cos + dx * c.sin,
    high: c.eye - z,
  };
}

function screenPoint(c, x, y, z = 0) {
  const p = cameraPoint(c, x, y, z);
  if (p.depth <= NEAR) return null;
  const scale = c.focal / p.depth;
  return { x: c.cx + p.side * scale, y: c.horizon + p.high * scale,
    scale, depth: p.depth };
}

function screenActor(c, x, y) {
  const p = cameraPoint(c, x, y, 0);
  if (p.depth <= NEAR) return null;
  // Perspective grows without bound beside the eye. A soft near distance is
  // used for silhouettes so two people forming a gap stay readable on 320px
  // screens even as the player passes between them. World geometry and sort
  // order still use their actual coordinates and depths.
  const drawnDepth = Math.hypot(p.depth, 76);
  const scale = c.focal / drawnDepth;
  return { x: c.cx + p.side * scale, y: c.horizon + p.high * scale,
    scale, depth: p.depth };
}

function polygon(ctx, points, fill, stroke = null, lineWidth = 1) {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function worldFace(ctx, c, vertices, fill, stroke = null, lineWidth = 1) {
  let points = vertices.map(([x, y, z]) => cameraPoint(c, x, y, z));
  const clipped = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const inA = a.depth >= NEAR, inB = b.depth >= NEAR;
    if (inA) clipped.push(a);
    if (inA !== inB) {
      const t = (NEAR - a.depth) / (b.depth - a.depth);
      clipped.push({ side: a.side + (b.side - a.side) * t,
        depth: NEAR, high: a.high + (b.high - a.high) * t });
    }
  }
  if (clipped.length < 3) return;
  polygon(ctx, clipped.map((p) => ({
    x: c.cx + p.side * c.focal / p.depth,
    y: c.horizon + p.high * c.focal / p.depth,
  })), fill, stroke, lineWidth);
}

function floorQuad(ctx, c, x0, y0, x1, y1, fill, z = 0.1) {
  worldFace(ctx, c, [[x0, y0, z], [x1, y0, z],
    [x1, y1, z], [x0, y1, z]], fill);
}

function worldLine(ctx, c, a, b, color, width = 1) {
  const pa = cameraPoint(c, ...a), pb = cameraPoint(c, ...b);
  if (pa.depth < NEAR && pb.depth < NEAR) return;
  const p = { ...pa }, q = { ...pb };
  if (p.depth < NEAR) {
    const t = (NEAR - p.depth) / (q.depth - p.depth);
    p.side += (q.side - p.side) * t; p.high += (q.high - p.high) * t; p.depth = NEAR;
  }
  if (q.depth < NEAR) {
    const t = (NEAR - q.depth) / (p.depth - q.depth);
    q.side += (p.side - q.side) * t; q.high += (p.high - q.high) * t; q.depth = NEAR;
  }
  ctx.beginPath();
  ctx.moveTo(c.cx + p.side * c.focal / p.depth,
    c.horizon + p.high * c.focal / p.depth);
  ctx.lineTo(c.cx + q.side * c.focal / q.depth,
    c.horizon + q.high * c.focal / q.depth);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = null, lw = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function rect(ctx, x, y, w, h, fill, r = 0) {
  ctx.fillStyle = fill;
  if (r > 0 && ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  } else ctx.fillRect(x, y, w, h);
}

function sky(ctx, c, theme, game, view) {
  const g = ctx.createLinearGradient(0, 0, 0, c.horizon + 110);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  if (c.stage === 4) {
    // Lighting points into the hall, not into the player's eyes.
    polygon(ctx, [{ x: c.width * .04, y: 0 }, { x: c.width * .51, y: c.horizon + 230 },
      { x: c.width * .25, y: 0 }], "#e5a6c70b");
    polygon(ctx, [{ x: c.width * .96, y: 0 }, { x: c.width * .49, y: c.horizon + 230 },
      { x: c.width * .75, y: 0 }], "#82d9e419");
    return;
  }
  const sunX = c.width * (c.stage === 3 ? .79 : .69);
  const sunY = c.horizon * .48;
  ellipse(ctx, sunX, sunY, c.stage === 3 ? 19 : 26, c.stage === 3 ? 19 : 26,
    c.stage === 3 ? "#dae5dd35" : "#fff1d4b8");
  // Distant roofline gives scale without filling the playable gaps.
  ctx.fillStyle = theme.haze;
  for (let i = 0; i < 12; i++) {
    const x = (i - 1) * c.width / 10;
    const w = c.width / 9.1;
    const h = 14 + hash(i + c.stage * 19) * (c.stage === 3 ? 62 : 35);
    ctx.fillRect(x, c.horizon - h, w, h + 3);
  }
  const haze = ctx.createLinearGradient(0, c.horizon - 26, 0, c.horizon + 80);
  haze.addColorStop(0, "#ffffff00"); haze.addColorStop(1, theme.haze + "99");
  ctx.fillStyle = haze; ctx.fillRect(0, c.horizon - 26, c.width, 106);
}

function ground(ctx, c, theme, game) {
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, c.horizon, c.width, c.height - c.horizon);
  const farY = Math.max(-180, c.py - FAR);
  const nearY = c.py + 40;
  floorQuad(ctx, c, -240, farY, 720, nearY, theme.ground);
  floorQuad(ctx, c, 35, farY, 445, nearY, theme.edge);
  floorQuad(ctx, c, 55, farY, 425, nearY, theme.path);
  if (c.stage === 4) {
    floorQuad(ctx, c, 87, farY, 393, nearY, "#3d3d53");
    for (const x of [87, 393]) worldLine(ctx, c, [x, farY, .3], [x, nearY, .3], "#bfb2b759", 1.6);
  } else {
    for (const x of [55, 425]) worldLine(ctx, c, [x, farY, .3], [x, nearY, .3], theme.line, 2);
  }
  const grid = c.stage === 4 ? 82 : c.stage === 2 ? 64 : 94;
  for (let y = Math.floor(c.py / grid) * grid; y >= farY; y -= grid) {
    if (y > c.py - 8) continue;
    const depth = c.py - y;
    const alpha = clamp(1 - depth / 1350, .08, .43);
    worldLine(ctx, c, [55, y, .2], [425, y, .2],
      c.stage === 4 ? `rgba(223,193,222,${alpha})` : `rgba(95,102,100,${alpha * .55})`, 1);
    if (c.stage < 4) for (const x of [130, 240, 350]) {
      worldLine(ctx, c, [x, y, .2], [x, y - grid, .2],
        `rgba(91,111,111,${alpha * .3})`, .7);
    }
  }
  if (c.stage === 3) {
    // Wet pavement picks up the vanishing light in narrow streaks.
    for (let i = 0; i < 20; i++) {
      const y = c.py - 25 - i * 65;
      const x = 85 + hash(i * 23) * 310;
      floorQuad(ctx, c, x, y - 22, x + 2 + hash(i * 5) * 5, y,
        i % 3 ? "#b9d9dd30" : "#f2c98a3d", .28);
    }
  }
}

function hallCeiling(ctx, c) {
  if (c.stage !== 4) return;
  const farY = Math.max(-120, c.py - FAR);
  const nearY = c.py + 30;
  worldFace(ctx, c, [[35, farY, 117], [445, farY, 117],
    [445, nearY, 117], [35, nearY, 117]], "#24283f");
  for (const x of [35, 122, 240, 358, 445])
    worldLine(ctx, c, [x, farY, 115], [x, nearY, 115],
      x === 240 ? "#d29c9169" : "#8ea4b64c", 1.4);
  for (let y = Math.floor(c.py / 125) * 125; y > farY; y -= 125) {
    if (y > c.py - 8) continue;
    worldLine(ctx, c, [35, y, 115], [445, y, 115], "#8290a281", 1.4);
    for (const x of [115, 240, 365]) {
      const p = screenPoint(c, x, y, 112);
      if (p && p.x > -20 && p.x < c.width + 20 && p.y > -20) {
        ellipse(ctx, p.x, p.y, Math.max(1.2, p.scale * 3.6),
          Math.max(1, p.scale * 2.1), x === 240 ? "#f7dcb2" : "#9adbd5");
      }
    }
  }
}

function routeMarks(ctx, c, game) {
  const branch = game.routeBranch;
  if (!branch || c.stage !== 1) return;
  function ribbon(points, color) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (a.y < c.py - FAR && b.y < c.py - FAR) continue;
      worldLine(ctx, c, [a.x, a.y, .55], [b.x, b.y, .55], color, 3.5);
    }
  }
  ribbon(branch.short || [], "#e5a95eaa");
  ribbon(branch.wide || [], "#86d9d0cc");
}

function sceneBlock(ctx, c, theme, side, y, length, index) {
  if (y > c.py + 18 || y + length < c.py - FAR) return;
  const left = side < 0;
  const x0 = left ? -130 : 445;
  const x1 = left ? 35 : 610;
  const inner = left ? x1 : x0;
  const h = c.stage === 0 ? 92 + (index % 3) * 9
    : c.stage === 4 ? 90 : 117 + (index % 3) * 13;
  const y0 = y, y1 = y + length;
  const [bright, mid, dark] = theme.wall;
  const frontage = c.stage === 4 ? mid : bright;
  worldFace(ctx, c, [[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], frontage);
  worldFace(ctx, c, [[inner, y0, 0], [inner, y1, 0], [inner, y1, h], [inner, y0, h]], mid);
  worldFace(ctx, c, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], theme.roof);
  worldFace(ctx, c, [[inner - (left ? 8 : -8), y0 - 6, h - 4],
    [inner + (left ? 8 : -8), y0 - 6, h - 4],
    [inner + (left ? 8 : -8), y1 + 5, h - 4],
    [inner - (left ? 8 : -8), y1 + 5, h - 4]], dark);
  const midY = y + length * .56;
  const detail = c.stage === 4 ? "#ffcb9c" : theme.glass;
  if (c.stage === 0) {
    // Door and two windows live on the road-facing wall, each with a sill.
    for (const yy of [y + 32, y + length - 37]) {
      worldFace(ctx, c, [[inner, yy - 16, 34], [inner, yy + 12, 34],
        [inner, yy + 12, 67], [inner, yy - 16, 67]], theme.ink, "#f9ebd2", 1.3);
      worldFace(ctx, c, [[inner + (left ? 1 : -1), yy - 13, 37],
        [inner + (left ? 1 : -1), yy + 9, 37],
        [inner + (left ? 1 : -1), yy + 9, 64],
        [inner + (left ? 1 : -1), yy - 13, 64]], detail);
      worldLine(ctx, c, [inner, yy - 2, 35], [inner, yy - 2, 65], "#faf0dc", 1);
    }
    worldFace(ctx, c, [[inner, midY - 11, 0], [inner, midY + 10, 0],
      [inner, midY + 10, 37], [inner, midY - 11, 37]], "#467c80", "#e8d1ae", 1.2);
  } else if (c.stage === 4) {
    for (const yy of [y + 26, y + length - 27]) {
      worldFace(ctx, c, [[inner, yy - 3, 6], [inner, yy + 3, 6],
        [inner, yy + 3, h - 9], [inner, yy - 3, h - 9]],
      index % 2 ? "#80d2ce" : "#eeb38a");
    }
    worldLine(ctx, c, [inner, y + 7, 72], [inner, y1 - 8, 72], "#ffdaab63", 2);
  } else {
    for (const yy of [y + 25, y + length - 28]) {
      worldFace(ctx, c, [[inner, yy - 17, 34], [inner, yy + 17, 34],
        [inner, yy + 17, 88], [inner, yy - 17, 88]],
      c.stage === 3 ? "#496879" : "#477e8b", "#e8e9d3", 1.3);
      worldFace(ctx, c, [[inner + (left ? .5 : -.5), yy - 14, 37],
        [inner + (left ? .5 : -.5), yy + 14, 37],
        [inner + (left ? .5 : -.5), yy + 14, 85],
        [inner + (left ? .5 : -.5), yy - 14, 85]], detail + "91");
      worldLine(ctx, c, [inner, yy, 35], [inner, yy, 87], "#f7ebd7", 1);
    }
    if (c.stage === 2 || c.stage === 1) {
      worldFace(ctx, c, [[inner, y + 9, 74], [inner + (left ? 26 : -26), y + 9, 73],
        [inner + (left ? 26 : -26), y1 - 8, 73], [inner, y1 - 8, 74]],
      c.stage === 2 ? "#af5e5d" : "#4a7b89");
      for (let i = 0; i < 4; i++) {
        const yy = y + 15 + (length - 30) * i / 4;
        worldLine(ctx, c, [inner, yy, 75], [inner + (left ? 26 : -26), yy, 74],
          c.stage === 2 ? "#f2d2aa" : "#c7e6e3", 1.5);
      }
    }
  }
  if (c.stage === 3) {
    for (const yy of [y + 20, y + length - 20]) {
      worldLine(ctx, c, [inner, yy, 75], [inner + (left ? 13 : -13), yy, 75], "#dbeced", 2);
      worldLine(ctx, c, [inner + (left ? 13 : -13), yy, 75],
        [inner + (left ? 13 : -13), yy, 53], "#dae7e9", 1);
    }
  }
}

function streetObject(ctx, c, theme, side, y, index) {
  const x = side < 0 ? 42 : 438;
  const base = screenPoint(c, x, y, 0);
  if (!base || base.depth > FAR || base.x < -180 || base.x > c.width + 180) return;
  if (c.stage === 0 || c.stage === 3) {
    const crown = screenPoint(c, x, y, c.stage === 3 ? 92 : 79);
    if (!crown) return;
    worldLine(ctx, c, [x, y, 0], [x, y, 67], c.stage === 3 ? "#3a4b57" : "#685b49", Math.max(1.5, base.scale * 3));
    const r = base.scale * (c.stage === 3 ? 25 : 21);
    ellipse(ctx, crown.x, crown.y, r, r * .79,
      c.stage === 3 ? "#426f76" : "#669875", "#335f62", Math.max(1, base.scale));
    ellipse(ctx, crown.x - r * .23, crown.y - r * .23, r * .44, r * .27,
      c.stage === 3 ? "#75a39f" : "#9ac795");
  } else if (c.stage === 2) {
    // Café terraces stay outside the clear walking lane. The cup is a simple
    // depth cue that lets the space read as a place, not another street skin.
    const tableX = side < 0 ? 19 : 461;
    worldLine(ctx, c, [tableX, y, 0], [tableX, y, 27], "#684f51", Math.max(1, base.scale * 2));
    worldFace(ctx, c, [[tableX - 19, y - 14, 27], [tableX + 19, y - 14, 27],
      [tableX + 19, y + 14, 27], [tableX - 19, y + 14, 27]],
    index % 2 ? "#f2ca9d" : "#ae746a", "#604b4c", Math.max(.7, base.scale));
    const cup = screenPoint(c, tableX + 4, y - 1, 32);
    if (cup) {
      rect(ctx, cup.x - 2.3 * cup.scale, cup.y - 5 * cup.scale,
        4.6 * cup.scale, 5 * cup.scale, "#f9e5c7", Math.max(.5, cup.scale));
      ellipse(ctx, cup.x, cup.y - 5 * cup.scale, 2.3 * cup.scale,
        Math.max(.5, cup.scale), "#65443f");
    }
  } else if (c.stage === 4) {
    worldLine(ctx, c, [x, y, 0], [x, y, 105], "#9cc9d2", Math.max(2, base.scale * 2));
    const lamp = screenPoint(c, x, y, 105);
    if (lamp) ellipse(ctx, lamp.x, lamp.y, Math.max(2, 8 * base.scale), Math.max(2, 8 * base.scale),
      index % 2 ? "#ffd99e" : "#84e5d9");
  } else {
    const pole = c.stage === 2 ? "#734e4e" : "#57777c";
    worldLine(ctx, c, [x, y, 0], [x, y, 57], pole, Math.max(1.5, 2 * base.scale));
    const light = screenPoint(c, x, y, 57);
    if (light) ellipse(ctx, light.x, light.y,
      Math.max(1, base.scale * 7), Math.max(1, base.scale * 5),
      c.stage === 2 ? "#ffdfaa" : "#f2f1db");
  }
}

function crossing(ctx, c, t, theme) {
  if (!t || t.bottom < c.py - FAR || t.top > c.py + 35) return;
  floorQuad(ctx, c, -220, t.top, 700, t.bottom, c.stage === 3 ? "#465f70" : "#657c83", .18);
  for (let y = t.top + 4; y < t.bottom - 3; y += 15) {
    floorQuad(ctx, c, t.left + 4, y, t.right - 4, Math.min(y + 7, t.bottom - 3),
      t.canEnter ? "#e5f5e8" : "#e2e5de", .25);
  }
  floorQuad(ctx, c, t.left - 10, t.bottom + 14, t.right + 10, t.bottom + 17,
    t.canEnter ? "#98e6b7" : "#efcb83", .28);
  // A gantry puts the actual pedestrian lamps above the path. The old single
  // curb lamp projected entirely off the right edge of portrait screens.
  // Mount the heads over the near half of the zebra stripes. At the stopping
  // line this keeps the lit icon below the fixed warning text on short phones.
  const signalY = t.bottom - 35;
  for (const x of [t.left - 18, t.right + 18])
    worldLine(ctx, c, [x, signalY, 0], [x, signalY, 108], "#344d55", 3.4);
  worldLine(ctx, c, [t.left - 18, signalY, 108],
    [t.right + 18, signalY, 108], "#344d55", 3.6);
  for (const x of [t.left + 22, (t.left + t.right) / 2, t.right - 22])
    worldLine(ctx, c, [x, signalY, 108], [x, signalY, 83], "#344d55", 2.5);
  if (t.vehicle?.active && t.vehicle.x > -120 && t.vehicle.x < 600) {
    const v = t.vehicle;
    const p = screenPoint(c, v.x, v.y, 0);
    if (p && p.depth > NEAR && p.depth < FAR) {
      const s = p.scale, w = (v.width || 45) * s, h = (v.kind === "bicycle" ? 22 : 25) * s;
      ellipse(ctx, p.x, p.y, w * .58, Math.max(2, 5 * s), "#253f4d55");
      if (v.kind === "bicycle") {
        for (const dx of [-w * .32, w * .32]) ellipse(ctx, p.x + dx, p.y - 6 * s,
          7 * s, 7 * s, "#263b4b", "#d0e3df", Math.max(1, s));
        worldLine(ctx, c, [v.x - 9, v.y, 12], [v.x + 10, v.y, 12], "#d5e8e4", 2);
      } else {
        rect(ctx, p.x - w / 2, p.y - h, w, h * .68, "#cd7565", Math.max(2, 5 * s));
        rect(ctx, p.x - w * .32, p.y - h * 1.2, w * .64, h * .36, "#7eb9c2", 2 * s);
        ellipse(ctx, p.x - w * .33, p.y - 5 * s, 5 * s, 5 * s, "#253746");
        ellipse(ctx, p.x + w * .33, p.y - 5 * s, 5 * s, 5 * s, "#253746");
      }
    }
  }
}

// Three fixed heads on one gantry keep at least one lamp in view across the
// crossing's real left, middle and right walking lanes. Their positions still
// obey the same world projection as people and road markings.
export function pedestrianSignalProjections(game, t, view) {
  if (!t) return [];
  const c = camera(game, view);
  const y = t.bottom - 35;
  const redLit = !t.nominalGreen;
  const walkLit = !!t.nominalGreen && (!t.blinking || !!t.blinkOn);
  return [t.left + 22, (t.left + t.right) / 2, t.right - 22]
    .map((x) => screenPoint(c, x, y, 70))
    .filter((p) => p && p.depth >= 32 && p.depth < 650)
    .map((p) => ({
      x: p.x, y: p.y,
      width: clamp(19 * p.scale, 27, 58),
      height: clamp(31 * p.scale, 42, 86),
      redLit, walkLit,
    }))
    .filter((p) => p.x + p.width / 2 >= 6 &&
      p.x - p.width / 2 <= c.width - 6 &&
      p.y + p.height / 2 >= 82 && p.y - p.height / 2 <= c.height - 115);
}

function signalIcon(ctx, x, y, radius, color, walking, lit) {
  const fill = lit ? color : "#3c5360";
  if (lit) ellipse(ctx, x, y, radius * 1.32, radius * 1.32,
    walking ? "#6df5d653" : "#ff8d6c55");
  ellipse(ctx, x, y, radius, radius, fill,
    lit ? "#fff4d9" : "#597078", lit ? 1.3 : .8);
  const figure = lit ? "#18343b" : "#253b45";
  ellipse(ctx, x, y - radius * .38, radius * .21, radius * .21, figure);
  ctx.beginPath();
  ctx.moveTo(x, y - radius * .14);
  ctx.lineTo(x, y + radius * .28);
  if (walking) {
    ctx.moveTo(x, y + radius * .22);
    ctx.lineTo(x - radius * .4, y + radius * .7);
    ctx.moveTo(x, y + radius * .22);
    ctx.lineTo(x + radius * .45, y + radius * .45);
    ctx.moveTo(x, y);
    ctx.lineTo(x + radius * .46, y + radius * .14);
  } else {
    ctx.moveTo(x, y + radius * .22);
    ctx.lineTo(x - radius * .28, y + radius * .68);
    ctx.moveTo(x, y + radius * .22);
    ctx.lineTo(x + radius * .28, y + radius * .68);
    ctx.moveTo(x - radius * .43, y);
    ctx.lineTo(x + radius * .43, y);
  }
  ctx.strokeStyle = figure;
  ctx.lineWidth = Math.max(1.5, radius * .18);
  ctx.lineCap = "round";
  ctx.stroke();
}

function crossingSignals(ctx, c, game, view) {
  for (const t of game.crossings || []) {
    for (const head of pedestrianSignalProjections(game, t, view)) {
      const { x, y, width, height, redLit, walkLit } = head;
      const left = x - width / 2, top = y - height / 2;
      rect(ctx, left - 2, top - 2, width + 4, height + 4, "#c4bfae",
        Math.max(5, width * .15));
      rect(ctx, left, top, width, height, "#172d39",
        Math.max(4, width * .12));
      const radius = Math.min(width * .29, height * .18);
      signalIcon(ctx, x, top + height * .29, radius,
        "#ff816a", false, redLit);
      signalIcon(ctx, x, top + height * .72, radius,
        "#75efd3", true, walkLit);
    }
  }
}

export function worldLabelCenterX(projectedX, labelWidth, viewportWidth,
  pinEdge = false) {
  // Keep the message near its world anchor; an actor already beyond the edge
  // should not leave a detached speech bubble on screen.
  if (!pinEdge && (projectedX < -24 || projectedX > viewportWidth + 24))
    return null;
  const half = Math.min(labelWidth / 2, Math.max(0, viewportWidth / 2 - 8));
  return clamp(projectedX, 8 + half, viewportWidth - 8 - half);
}

function worldLabel(ctx, c, x, y, z, text, fill, ink,
  size = 15, minDepth = 30, maxDepth = FAR, pinEdge = false) {
  const p = screenPoint(c, x, y, z);
  if (!p || p.depth < minDepth || p.depth > maxDepth) return;
  const fontSize = clamp(size * p.scale, 9, 29);
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  const w = ctx.measureText(text).width + fontSize * .9;
  const h = fontSize * 1.55;
  const labelX = worldLabelCenterX(p.x, w, c.width, pinEdge);
  if (labelX == null) return;
  rect(ctx, labelX - w / 2, p.y - h / 2, w, h, fill, Math.min(7, h * .2));
  ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, labelX, p.y + fontSize * .01);
}

function destination(ctx, c, theme, game) {
  if (c.py < 70) return;
  const stage = c.stage;
  const x0 = stage === 4 ? 95 : 177;
  const x1 = stage === 4 ? 385 : 303;
  const y = 83;
  const arch = stage === 4 ? 91 : 82;
  const dark = stage === 4 ? "#5b4967" : theme.ink;
  const bright = stage === 4 ? "#f1b77f" : theme.accent;
  for (const x of [x0, x1]) {
    worldFace(ctx, c, [[x - 9, y - 12, 0], [x + 9, y - 12, 0],
      [x + 9, y + 14, 0], [x - 9, y + 14, 0]], "#40576b66");
    worldFace(ctx, c, [[x - 5, y, 0], [x + 5, y, 0],
      [x + 5, y, arch], [x - 5, y, arch]], dark);
    worldLine(ctx, c, [x, y, 7], [x, y, arch - 7], bright, 1.5);
  }
  worldFace(ctx, c, [[x0 - 7, y, arch - 15], [x1 + 7, y, arch - 15],
    [x1 + 7, y, arch + 9], [x0 - 7, y, arch + 9]], dark);
  worldLine(ctx, c, [x0 - 7, y, arch + 8], [x1 + 7, y, arch + 8], bright, 2);
  const names = ["合 流", "駅入口", "カフェ", "会 場", "LIVE"];
  worldLabel(ctx, c, 240, y - 1, arch - 4, names[stage],
    dark, stage === 4 ? "#ffe1ab" : "#fff3d9", 20, 21,
    stage === 4 ? 2300 : FAR);
  if (stage === 4) {
    for (let i = 0; i < 6; i++) {
      const x = 134 + i * 42;
      const color = i % 2 ? "#e88dbc" : "#87e1db";
      worldLine(ctx, c, [x, 16, 48], [240 + (x - 240) * .24, 60, 3], color + "55", 1.1);
      const p = screenPoint(c, x, 16, 49);
      if (p) ellipse(ctx, p.x, p.y, Math.max(1, p.scale * 4), Math.max(1, p.scale * 4), color);
    }
  }
}

function stageMusician(ctx, c, x, y, kind, game, view) {
  const p = screenPoint(c, x, y, 18);
  if (!p || p.depth > 2300 || p.x < -100 || p.x > c.width + 100) return;
  const s = Math.min(7, p.scale);
  const px = p.x, foot = p.y;
  const sway = view.reducedMotion ? 0 : Math.sin((game.ambientTime || game.worldTime || 0) * 2.3 + kind) * .8 * s;
  const outline = "#18293b";
  const jacket = ["#74c3bd", "#dc927f", "#817da8"][kind];
  const skin = ["#dba581", "#f3c6a0", "#a87558"][kind];
  function stroke(a, b, d, e, width, color) {
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(d, e);
    ctx.lineCap = "round"; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width * s); ctx.stroke();
  }
  ellipse(ctx, px, foot + 1.4 * s, 12 * s, Math.max(1, 3 * s), "#161e325e");
  if (kind === 2) {
    // The kit's large bass drum and split cymbals read even from the hall door.
    for (const side of [-1, 1]) {
      stroke(px + side * 15 * s, foot - 2 * s,
        px + side * 15 * s, foot - 34 * s, 1.2, "#b0c0ca");
      ellipse(ctx, px + side * 15 * s, foot - 35 * s,
        10 * s, Math.max(1, 2.1 * s), side < 0 ? "#e9bd76" : "#99d9cf");
    }
    ellipse(ctx, px, foot - 12 * s, 12 * s, 12 * s, "#365a6d", "#eac78a", Math.max(1, 2 * s));
    ellipse(ctx, px, foot - 12 * s, 6 * s, 6 * s, "#a6d7d1");
  }
  stroke(px - 4 * s, foot - 20 * s, px - 6 * s, foot - 2 * s, 4, outline);
  stroke(px + 4 * s, foot - 20 * s, px + 6 * s, foot - 2 * s, 4, outline);
  polygon(ctx, [{ x: px - 9 * s, y: foot - 43 * s },
    { x: px + 9 * s, y: foot - 43 * s },
    { x: px + 8 * s, y: foot - 20 * s },
    { x: px - 8 * s, y: foot - 20 * s }], jacket, outline, Math.max(.7, s));
  stroke(px - 8 * s, foot - 40 * s,
    px - (kind === 1 ? 16 : 12) * s, foot - (kind === 1 ? 31 : 23) * s,
    3.2, jacket);
  stroke(px + 8 * s, foot - 40 * s,
    px + (kind === 1 ? 15 : 12) * s, foot - (kind === 1 ? 24 : 32) * s,
    3.2, jacket);
  ellipse(ctx, px + sway * .25, foot - 51 * s,
    7.2 * s, 8.3 * s, skin, outline, Math.max(.6, .8 * s));
  ellipse(ctx, px + sway * .25, foot - 55.5 * s,
    7.5 * s, 4.1 * s, kind === 1 ? "#462f3c" : "#293543");
  if (s > .9) {
    ellipse(ctx, px - 2.4 * s + sway * .25, foot - 50 * s,
      Math.max(.7, .6 * s), Math.max(.7, .6 * s), "#243343");
    ellipse(ctx, px + 2.4 * s + sway * .25, foot - 50 * s,
      Math.max(.7, .6 * s), Math.max(.7, .6 * s), "#243343");
    ctx.beginPath();
    ctx.arc(px + sway * .25, foot - 47.4 * s, 1.9 * s, .08, Math.PI - .08);
    ctx.strokeStyle = "#664c4d"; ctx.lineWidth = Math.max(.8, .65 * s); ctx.stroke();
  }
  if (kind === 0) {
    // Guitar body, neck, strap and tuning head form one readable gesture.
    stroke(px - 7 * s, foot - 40 * s, px + 6 * s, foot - 26 * s, 1.4, "#f3d89c");
    ctx.save(); ctx.translate(px - 2 * s, foot - 29 * s); ctx.rotate(-.32);
    ellipse(ctx, 0, 0, 11 * s, 7.2 * s, "#e5aa6e", "#5a4050", Math.max(.8, s));
    ellipse(ctx, 1 * s, 0, 2.2 * s, 2.2 * s, "#664c4c");
    ctx.restore();
    stroke(px + 7 * s, foot - 30 * s, px + 23 * s, foot - 43 * s, 3, "#e6b77d");
    ellipse(ctx, px + 23 * s, foot - 43 * s, 2.5 * s, 2 * s, "#f6d9a0");
  } else if (kind === 1) {
    stroke(px + 14 * s, foot - 3 * s,
      px + 14 * s, foot - 55 * s, 1.7, "#bfc9d0");
    ellipse(ctx, px + 13 * s, foot - 55 * s,
      4.5 * s, Math.max(1, 2 * s), "#f5d6a2", outline, Math.max(.5, .6 * s));
    stroke(px + 12 * s, foot - 32 * s,
      px + 12 * s, foot - 51 * s, 2.1, skin);
  } else {
    stroke(px - 8 * s, foot - 30 * s,
      px - 22 * s, foot - 41 * s, 1, "#f7d49e");
    stroke(px + 8 * s, foot - 30 * s,
      px + 22 * s, foot - 41 * s, 1, "#f7d49e");
  }
}

function concertStage(ctx, c, game, view) {
  if (c.stage !== 4) return;
  const back = -215, front = -25;
  // A real raised stage sits beyond the front barrier. Its backdrop, platform
  // and performers all share the same perspective as the playable hall.
  worldFace(ctx, c, [[72, back, 18], [408, back, 18],
    [408, back, 146], [72, back, 146]], "#1c2c45");
  for (let i = 0; i < 7; i++) {
    const x0 = 76 + i * 47;
    worldFace(ctx, c, [[x0, back + .3, 22], [x0 + 39, back + .3, 22],
      [x0 + 39, back + .3, 139], [x0, back + .3, 139]],
    i % 2 ? "#273a54" : "#24314c");
  }
  for (const x of [75, 389]) {
    worldFace(ctx, c, [[x, back + 1, 18], [x + 16, back + 1, 18],
      [x + 16, back + 1, 147], [x, back + 1, 147]], "#8b476c");
    worldLine(ctx, c, [x + 8, back + 1, 23], [x + 8, back + 1, 142], "#ee9b9880", 2);
  }
  const lamps = [
    { x: 168, target: 187, hue: "#91eadb" },
    { x: 240, target: 240, hue: "#ffe3a9" },
    { x: 314, target: 294, hue: "#e8afda" },
  ];
  for (const lamp of lamps) {
    worldFace(ctx, c, [[lamp.x - 3, -191, 132], [lamp.x + 3, -191, 132],
      [lamp.target + 35, -100, 19], [lamp.target - 35, -100, 19]],
    lamp.hue + (game.arriving || game.phase === "finished" ? "3a" : "24"));
    const light = screenPoint(c, lamp.x, -191, 132);
    if (light) ellipse(ctx, light.x, light.y,
      Math.max(1.5, 4 * light.scale), Math.max(1.5, 4 * light.scale), lamp.hue);
  }
  worldLine(ctx, c, [87, -190, 132], [393, -190, 132], "#b4c8cb", 2);
  for (const z of [54, 69, 84]) {
    for (let x = 109; x < 371; x += 13) {
      const z2 = z + Math.sin(x / 23 + z / 9) * 4;
      worldLine(ctx, c, [x, back + 1, z2],
        [x + 13, back + 1, z + Math.sin((x + 13) / 23 + z / 9) * 4],
      z === 69 ? "#8adfc899" : "#d99ab36b", 1.4);
    }
  }
  worldFace(ctx, c, [[68, back, 18], [412, back, 18],
    [412, front, 18], [68, front, 18]], "#55405b");
  for (const x of [105, 175, 240, 305, 375])
    worldLine(ctx, c, [x, back + 1, 18.4], [x, front - 1, 18.4], "#dca98b32", 1);
  for (const [x, y, fill] of [[190, -136, "#91e5d770"],
    [240, -117, "#ffe2ae72"], [291, -149, "#d9acdc71"]]) {
    const p = screenPoint(c, x, y, 18.5);
    if (p) ellipse(ctx, p.x, p.y,
      Math.max(2, 18 * p.scale), Math.max(1, 5 * p.scale), fill);
  }
  stageMusician(ctx, c, 290, -150, 2, game, view);
  stageMusician(ctx, c, 190, -136, 0, game, view);
  stageMusician(ctx, c, 240, -117, 1, game, view);
  worldFace(ctx, c, [[68, front, 0], [412, front, 0],
    [412, front, 18], [68, front, 18]], "#402c49");
  worldLine(ctx, c, [68, front, 18], [412, front, 18], "#ffd49a", 3);
  worldLine(ctx, c, [68, front, 5], [412, front, 5], "#8bd8d0", 2);
  if (game.phase === "finished") {
    // A quiet final tableau: no strobe, only warm house lights and an in-world
    // title above the band. It remains legible through the result overlay.
    worldLabel(ctx, c, 240, back + 2, 119,
      "LIVE", "#233d50", "#ffe8b8", 25, 20);
  }
}

export function pedestrianFacing(actor) {
  const ux = Number(actor.ux) || 0;
  const uy = Number(actor.uy) || 0;
  const direction = (x, y) => ({
    profile: Math.abs(x) < .45 || Math.abs(x) <= Math.abs(y) * .78
      ? 0 : Math.sign(x),
    front: y > .18,
  });
  // Courtesy is still a real walk. The body must follow that velocity while
  // the head can briefly glance toward the person who called.
  const body = (actor.acknowledge && !actor.courtesy) || actor.state === "waiting"
    ? { profile: 0, front: true } : direction(ux, uy);
  if (actor.acknowledge && actor.courtesy) {
    const preparing = actor.courtesy.phase === "prepare";
    const weight = preparing
      ? .42 + .38 * clamp(1 - (actor.courtesy.prepareRemaining || 0) / .12, 0, 1)
      : .55 * clamp(actor.acknowledge.remaining / .72, 0, 1);
    const headX = ux * (1 - weight) + (actor.acknowledge.faceX || 0) * weight;
    const headY = uy * (1 - weight) + (actor.acknowledge.faceY || 0) * weight;
    const head = direction(headX, headY);
    return { ...body, headProfile: head.profile, headFront: head.front,
      headLean: clamp((headX - ux) * 1.8, -1.6, 1.6), headGaze: headX };
  }
  const next = actor.acknowledge ? null : previewTurn(actor);
  if (!next) return { ...body, headProfile: body.profile,
    headFront: body.front, headLean: 0, headGaze: ux };
  const corner = actor.route[actor.leg];
  const distance = Math.hypot(corner.x - actor.x, corner.y - actor.y);
  // The gaze eases into the next leg while the torso keeps following the
  // present one. The route changes as the walker reaches the corner.
  const look = clamp((48 - distance) / 32, 0, 1) * .85;
  const headX = ux * (1 - look) + next.x * look;
  const headY = uy * (1 - look) + next.y * look;
  const head = direction(headX, headY);
  return { ...body, headProfile: head.profile, headFront: head.front,
    headLean: clamp((headX - ux) * 1.8, -1.6, 1.6), headGaze: headX };
}

function person(ctx, c, actor, game, view) {
  if (actor.active === false || !Number.isFinite(actor.x) || !Number.isFinite(actor.y)) return;
  const p = screenActor(c, actor.x, actor.y);
  if (!p || p.depth > FAR || p.depth < 13) return;
  // People who have passed the shoulder would otherwise smear across the
  // whole edge of a narrow portrait screen. Their actual hitboxes are behind
  // the camera's useful corridor; let them leave the frame gently.
  const edge = Math.min(p.x, c.width - p.x);
  const edgeOpacity = p.depth < 100 ? clamp((edge + 45) / 95, 0, 1) : 1;
  if (edgeOpacity < .015) return;
  const s = Math.min(edge < 50 && p.depth < 100 ? 10 : 18, p.scale);
  const px = p.x, foot = p.y;
  const r = (actor.r || 13) * s;
  if (px + r * 2 < -35 || px - r * 2 > c.width + 35 || foot < -70 || foot - 65 * s > c.height + 70) return;
  ctx.save();
  ctx.globalAlpha *= edgeOpacity;
  const look = appearanceFor(actor);
  const clothes = actor.shirt || (c.stage === 4
    ? ["#9b5974", "#617b9b", "#b2806e", "#788c84", "#ae9b75"][(actor.color ?? actor.id ?? 0) % 5]
    : ["#c57960", "#739081", "#b79668", "#7a8799", "#9c6d7e"][(actor.color ?? actor.id ?? 0) % 5]);
  const friend = actor.friend || actor.partner;
  const facing = pedestrianFacing(actor);
  const face = facing.front;
  const profile = facing.profile;
  const headProfile = facing.headProfile;
  const moving = Math.abs(actor.vx || 0) + Math.abs(actor.vy || 0) > 8;
  const stride = !view.reducedMotion && moving ? Math.sin((actor.walk || game.worldTime * 15) * .28 + (actor.id || 0)) * 3.2 : 0;
  const bow = actor.acknowledge
    ? actor.courtesy?.phase === "prepare" ? 1.8 : 1.2 : 0;
  const outlined = friend ? "#fff0bd" : "#30444baa";
  ellipse(ctx, px, foot + 1.5 * s, 13 * s, Math.max(1, 3.1 * s), "#26363e43");
  if (game.callReady && game.callTargets?.includes(actor.id))
    ellipse(ctx, px, foot + .7 * s, Math.min(42, 18 * s),
      Math.min(12, Math.max(2, 4.6 * s)), "#85f0c32a", "#a5fbe0", 2);
  if (friend) ellipse(ctx, px, foot + .5 * s, 19 * s, Math.max(1, 5 * s), "#f6cd8251", "#ffe2a6", Math.max(1, s));
  const sx = profile ? 2.1 * s : 3 * s;
  function limb(x1, y1, x2, y2, width, color, outline = null) {
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = width + Math.max(1, s * 1.1); ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  limb(px - sx, foot - 18 * s, px - (5 + stride) * s, foot - 2 * s,
    4 * s, "#344954", "#283d48");
  limb(px + sx, foot - 18 * s, px + (5 + stride) * s, foot - 2 * s,
    4 * s, "#344954", "#283d48");
  ellipse(ctx, px - (5 + stride) * s, foot - 1.2 * s, 4.5 * s, 2.4 * s, "#293843");
  ellipse(ctx, px + (5 + stride) * s, foot - 1.2 * s, 4.5 * s, 2.4 * s, "#293843");
  const bodyTop = foot - 43 * s + bow * s;
  const bodyBot = foot - 18 * s;
  const torsoWidth = profile ? 14 : 20;
  rect(ctx, px - torsoWidth * s / 2, bodyTop, torsoWidth * s,
    bodyBot - bodyTop, outlined, 5 * s);
  rect(ctx, px - (torsoWidth / 2 - 1) * s, bodyTop + s,
    (torsoWidth - 2) * s, bodyBot - bodyTop - 2 * s, clothes, 4 * s);
  if (profile) {
    rect(ctx, px - profile * 1.3 * s - .65 * s, bodyTop + 5 * s,
      1.3 * s, 13 * s, "#f9e7c45c", .6 * s);
  } else if (face) {
    rect(ctx, px - 1 * s, bodyTop + 6 * s, 2 * s, 14 * s, "#fff1cd45", s);
  } else {
    rect(ctx, px - 2.5 * s, bodyTop + 3 * s, 5 * s, 10 * s, "#273d4a44", s);
  }
  const wave = (actor.acknowledge?.remaining || 0) > .56 ||
    (friend && game.reunionUntil > game.worldTime);
  const shoulder = profile ? 5.8 : 9;
  const hand = profile ? 8 : 13;
  limb(px - shoulder * s, bodyTop + 5 * s,
    px - hand * s, bodyTop + (wave ? -7 : 19) * s,
    3.4 * s, clothes, outlined);
  limb(px + shoulder * s, bodyTop + 5 * s,
    px + hand * s, bodyTop + 19 * s,
    3.4 * s, clothes, outlined);
  ellipse(ctx, px - hand * s, bodyTop + (wave ? -7 : 19) * s,
    2.4 * s, 3 * s, look.skin);
  ellipse(ctx, px + hand * s, bodyTop + 19 * s, 2.4 * s, 3 * s, look.skin);
  const headY = foot - (50 - bow) * s;
  const headX = px + (profile * 2.4 + facing.headLean) * s;
  ellipse(ctx, headX, headY, (headProfile ? 7.1 : 7.6) * s, 9 * s,
    look.skin, "#3b3f4988", Math.max(.5, .65 * s));
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.ellipse(headX, headY - 4.5 * s, 8 * s, 5.5 * s, 0, Math.PI, TAU);
  ctx.fill();
  if (headProfile && s > .6) {
    ellipse(ctx, headX + headProfile * 4.1 * s, headY + .35 * s,
      Math.max(.6, .75 * s), Math.max(.6, .75 * s), "#33434b");
    ellipse(ctx, headX + headProfile * 7.2 * s, headY + 2.4 * s,
      Math.max(.8, 1.2 * s), Math.max(.7, 1.1 * s), look.skin);
  } else if (facing.headFront && s > .6) {
    const gaze = actor.acknowledge ? 0 : clamp(facing.headGaze * 1.4, -1.2, 1.2);
    ellipse(ctx, headX - 2.5 * s + gaze * s, headY + .4 * s, Math.max(.6, .65 * s), Math.max(.6, .65 * s), "#33434b");
    ellipse(ctx, headX + 2.5 * s + gaze * s, headY + .4 * s, Math.max(.6, .65 * s), Math.max(.6, .65 * s), "#33434b");
    if (actor.acknowledge) {
      ctx.beginPath(); ctx.arc(headX, headY + 2.7 * s, 2.1 * s, .1, Math.PI - .1);
      ctx.strokeStyle = "#83594e"; ctx.lineWidth = Math.max(.8, .6 * s); ctx.stroke();
    }
  }
  if (actor.umbrella && c.stage === 3) {
    const uY = foot - 68 * s;
    limb(px + 14 * s, bodyTop + 19 * s, px + 14 * s, uY + 5 * s,
      1.3 * s, "#eff2e8");
    polygon(ctx, [{ x: px - 19 * s, y: uY + 3 * s }, { x: px - 14 * s, y: uY - 3 * s },
      { x: px, y: uY - 9 * s }, { x: px + 14 * s, y: uY - 3 * s },
      { x: px + 20 * s, y: uY + 3 * s }],
    actor.id % 2 ? "#659aabdd" : "#e6c59bdd", "#e8ede7", Math.max(.8, s));
  }
  if (actor.glowStick && c.stage === 4) {
    const color = ["#8ae9da", "#ffd58c", "#edabdf"][(actor.id || 0) % 3];
    rect(ctx, px + 12 * s, bodyTop - 4 * s, 3.2 * s, 18 * s,
      color, 1.6 * s);
  }
  if (actor.acknowledge) {
    ellipse(ctx, px, foot + .6 * s, 21 * s, Math.max(1.5, 5 * s),
      "#75ebc82a", "#8ff3d2", Math.max(1, 1.2 * s));
    if (p.depth < 150) worldLabel(ctx, c, actor.x, actor.y, 74,
      "どうぞ", "#e1f9e8", "#32645a", 13, 24);
  }
  ctx.restore();
}

function animal(ctx, c, a) {
  if (a.active === false) return;
  const p = screenActor(c, a.x, a.y);
  if (!p || p.depth > FAR || p.depth < 10 || p.x < -100 || p.x > c.width + 100) return;
  const s = Math.min(17, p.scale);
  const dog = a.kind === "dog";
  const coat = dog ? "#a67857" : "#696d73";
  ellipse(ctx, p.x, p.y + s, 12 * s, 3 * s, "#24363f44");
  ellipse(ctx, p.x, p.y - 9 * s, (dog ? 12 : 9) * s, 7 * s, coat, "#463e3d", Math.max(.7, s));
  for (const dx of [-7, 7]) rect(ctx, p.x + dx * s - 2 * s,
    p.y - 6 * s, 4 * s, 6 * s, coat, s);
  ellipse(ctx, p.x + 9 * s, p.y - (dog ? 13 : 16) * s,
    (dog ? 6 : 5) * s, 5 * s, coat);
  for (const dx of [-3, 3]) {
    polygon(ctx, [{ x: p.x + (9 + dx - 2) * s, y: p.y - 18 * s },
      { x: p.x + (9 + dx) * s, y: p.y - 24 * s },
      { x: p.x + (9 + dx + 2) * s, y: p.y - 18 * s }], coat);
  }
  ellipse(ctx, p.x + 13 * s, p.y - 12 * s, 1.6 * s, 1.5 * s, "#283646");
  if (a.bracing) {
    worldLabel(ctx, c, a.x, a.y, 36, "…!", "#fff1cf", "#6e5847", 12, 25);
  }
}

function routeSign(ctx, c, game) {
  const b = game.routeBranch;
  if (!b || c.stage !== 1) return;
  const y = b.fork?.y;
  if (!Number.isFinite(y) || y > c.py - 25 || y < c.py - 650) return;
  // The wider branch leaves the phone's narrow view as it approaches. Keep
  // its label at the edge with an arrow until the fork is actually passed.
  worldLabel(ctx, c, 126, y - 33, 31, "← ひろい道", "#275e65", "#e9fff4",
    14, 25, FAR, true);
  worldLabel(ctx, c, 267, y - 33, 31, "近道", "#a46d4d", "#fff0cf", 14, 25);
}

function rain(ctx, c, game, view) {
  if (c.stage !== 3) return;
  const t = view.reducedMotion ? 0 : game.worldTime || 0;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, c.width, c.height); ctx.clip();
  ctx.strokeStyle = "#d9f4f157"; ctx.lineWidth = .9;
  for (let i = 0; i < Math.max(35, c.width / 5); i++) {
    const x = hash(i * 31 + 12) * c.width;
    const y = fract(hash(i * 71 + 19) + t * (.25 + hash(i * 17) * .13)) * c.height;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); ctx.stroke();
  }
  ctx.restore();
}

export function reunionWave(game, view = {}) {
  const remaining = (game.reunionUntil || 0) - (game.worldTime || 0);
  if (remaining <= 0 || remaining > .9 || game.phase !== "playing") return null;
  const width = Math.max(1, view.width || 390);
  const height = Math.max(1, view.height || 700);
  const progress = clamp((.9 - remaining) / .9, 0, 1);
  const lift = view.reducedMotion ? .7 : Math.sin(progress * Math.PI);
  return {
    x: Math.min(width * .08, 32) + 8 * lift,
    y: height - 71 - 64 * lift,
    lift,
  };
}

function foreground(ctx, c, game, view) {
  // Sleeves at the bottom are the only visible part of the player. They remain
  // steady while walking, reducing motion sickness and leaving the route clear.
  const base = c.height + 4;
  const w = c.width;
  const sleeve = c.stage === 4 ? "#55677e" : "#337c92";
  polygon(ctx, [{ x: -14, y: base - 82 }, { x: w * .11, y: base - 45 },
    { x: w * .18, y: base }, { x: -14, y: base }], sleeve);
  polygon(ctx, [{ x: w + 14, y: base - 82 }, { x: w * .89, y: base - 45 },
    { x: w * .82, y: base }, { x: w + 14, y: base }], sleeve);
  const wave = reunionWave(game, view);
  if (wave && wave.lift > .02) {
    // A small player hand can be seen when a companion catches up. It stays
    // on the edge of the frame, leaving the road and traffic lamp clear.
    polygon(ctx, [{ x: -9, y: base - 78 }, { x: 11, y: base - 69 },
      { x: wave.x + 7, y: wave.y + 14 },
      { x: wave.x - 8, y: wave.y + 15 }], sleeve, "#245769", 1.8);
    ctx.beginPath();
    ctx.moveTo(wave.x - 8, wave.y + 14);
    ctx.lineTo(wave.x + 7, wave.y + 14);
    ctx.strokeStyle = "#214e60"; ctx.lineWidth = 2; ctx.stroke();
    ellipse(ctx, wave.x, wave.y + 3, 8.8, 11.8, "#e5b796", "#966f62", 1.35);
    for (const offset of [-4, 0, 4])
      ellipse(ctx, wave.x + offset, wave.y - 7, 2.4, 5.5,
        "#e5b796", "#966f62", .8);
  }
  const pressure = clamp(Number(view.danger) || game.pressure || 0, 0, 1);
  if (pressure > .24) {
    const glow = ctx.createRadialGradient(w / 2, c.height * .65,
      w * .20, w / 2, c.height * .65, w * .72);
    glow.addColorStop(0, "#f4bb7100");
    glow.addColorStop(1, `rgba(245,174,96,${pressure * .17})`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, c.height);
  }
  const contact = clamp(view.contactPulse || 0, 0, 1);
  if (contact) {
    const g = ctx.createRadialGradient(w / 2, c.height * .55, w * .15,
      w / 2, c.height * .55, w * .74);
    g.addColorStop(0, "#e9846a00");
    g.addColorStop(1, `rgba(221,92,66,${contact * .28})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, c.height);
  }
  const pulse = view.callPulse ?? (game.callRipple && game.worldTime - game.callRipple.started < .7
    ? (game.worldTime - game.callRipple.started) / .7 : null);
  if (pulse != null && pulse >= 0 && pulse <= 1) {
    const a = 1 - pulse;
    const radius = (30 + pulse * w * .5);
    ctx.beginPath(); ctx.ellipse(w / 2, c.height * .84, radius, radius * .36, 0, 0, TAU);
    ctx.strokeStyle = `rgba(133,243,218,${a * .7})`;
    ctx.lineWidth = 2 + 3 * a; ctx.stroke();
  }
}

/** Render a stable eye-level view of the current run. The caller owns sizing. */
export function renderWorld(ctx, game, view = {}) {
  if (!ctx || !game?.player) return;
  const c = camera(game, view);
  const theme = THEMES[c.stage];
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, c.width, c.height); ctx.clip();
  sky(ctx, c, theme, game, view);
  ground(ctx, c, theme, game);
  hallCeiling(ctx, c);
  routeMarks(ctx, c, game);
  const items = [];
  const stride = c.stage === 0 ? 235 : c.stage === 4 ? 185 : 210;
  for (let i = -1; i < Math.ceil((game.worldHeight || 2200) / stride) + 1; i++) {
    const y = i * stride + (c.stage === 2 ? 15 : 0);
    if (y > c.py + 30 || y + stride < c.py - FAR) continue;
    for (const side of [-1, 1]) {
      items.push({ y: y + stride * .71, draw: () => sceneBlock(ctx, c, theme,
        side, y, stride * .71, i + (side + 1) * 4) });
      items.push({ y: y + stride * .94, draw: () => streetObject(ctx, c, theme,
        side, y + stride * .94, i) });
    }
  }
  for (const t of game.crossings || [])
    items.push({ y: t.bottom + 18, draw: () => crossing(ctx, c, t, theme) });
  if (c.stage === 4)
    items.push({ y: -24, draw: () => concertStage(ctx, c, game, view) });
  items.push({ y: 84, draw: () => destination(ctx, c, theme, game) });
  if (game.meetingPartner && game.meetingPartner.state !== "met")
    items.push({ y: game.meetingPartner.y, draw: () => person(ctx, c,
      game.meetingPartner, game, view) });
  for (const p of game.crowd || []) if (p.active !== false)
    items.push({ y: p.y, draw: () => person(ctx, c, p, game, view) });
  for (const p of game.party?.members || [])
    items.push({ y: p.y, draw: () => person(ctx, c, p, game, view) });
  for (const a of game.animals || [])
    items.push({ y: a.y, draw: () => animal(ctx, c, a) });
  if (game.routeBranch) items.push({ y: game.routeBranch.fork.y - 33,
    draw: () => routeSign(ctx, c, game) });
  items.sort((a, b) => a.y - b.y);
  for (const item of items) item.draw();
  // High signal heads stay legible above foreground walkers. The supports and
  // road still sort with the world, so this does not move the crossing itself.
  crossingSignals(ctx, c, game, view);
  rain(ctx, c, game, view);
  foreground(ctx, c, game, view);
  drawRadar(ctx, game, { width: c.width, height: c.height });
  ctx.restore();
}
