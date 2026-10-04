import { facingView } from "./pose.js";
function rounded(c, x, y, w, h, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
function circle(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}
function foot(c, x, y, ux, uy) {
  c.save();
  c.translate(x, y);
  c.rotate(Math.atan2(ux, -uy));
  rounded(c, -2.5, -4, 5, 8, 2, "#3b4b49");
  rounded(c, -1.7, -3.5, 3.4, 1.5, 0.7, "#718079");
  c.restore();
}
// Stable visual choices are independent of walking habits and collision sizes.
// No nationality or ethnicity is inferred from appearance.
const LOOKS = [
  {
    skin: "#eec4a0",
    hair: "#3c343c",
    style: "crop",
    outfit: "shirt",
    width: 1,
  },
  {
    skin: "#c38d69",
    hair: "#292e3c",
    style: "bob",
    outfit: "coat",
    width: 0.96,
  },
  {
    skin: "#f5dbbc",
    hair: "#876348",
    style: "long",
    outfit: "skirt",
    width: 1,
  },
  {
    skin: "#ad7357",
    hair: "#d0c9c4",
    style: "short",
    outfit: "cardigan",
    width: 1.06,
    older: true,
  },
  {
    skin: "#e3ac86",
    hair: "#58403a",
    style: "bun",
    outfit: "shirt",
    width: 0.96,
  },
  {
    skin: "#906446",
    hair: "#242f39",
    style: "curls",
    outfit: "jacket",
    width: 1.06,
  },
  {
    skin: "#f3d0ab",
    hair: "#b9b4a9",
    style: "bob",
    outfit: "coat",
    width: 1,
    older: true,
  },
  {
    skin: "#c68b65",
    hair: "#3b2f32",
    style: "long",
    outfit: "shirt",
    width: 0.96,
  },
  {
    skin: "#e7bd95",
    hair: "#af9e8b",
    style: "thinning",
    outfit: "cardigan",
    width: 1.06,
    older: true,
  },
  {
    skin: "#bd8261",
    hair: "#42333b",
    style: "short",
    outfit: "skirt",
    width: 1,
  },
  {
    skin: "#f1d2b7",
    hair: "#71543c",
    style: "curls",
    outfit: "jacket",
    width: 0.96,
  },
  {
    skin: "#a87756",
    hair: "#242e3d",
    style: "bun",
    outfit: "coat",
    width: 1.06,
  },
];
export function appearanceFor(p, player = false) {
  const id = player
    ? 0
    : (p.appearanceId ??
      (p.friend ? p.id + 2 : (p.id ?? Math.round(p.x / 64))));
  return LOOKS[((id % LOOKS.length) + LOOKS.length) % LOOKS.length];
}
export function umbrellaRig(pose, width, stride = 0) {
  const view = facingView(pose),
    back = view.startsWith("back");
  const side = pose.uy < -0.3 ? 1 : pose.uy > 0.3 ? -1 : pose.ux < 0 ? -1 : 1;
  const shoulder = { x: side * (width / 2 - 1), y: -7 };
  const grip = {
    x: side * (width / 2 + 4) + stride * 0.15,
    y: -10 + pose.uy * 2,
  };
  const canopy = { x: grip.x - side * 10 + stride * 0.12, y: grip.y - 25 };
  return { shoulder, grip, canopy, side, behind: back || view === "left" };
}
function umbrella(c, rig, color, part) {
  const { canopy: a, grip: h, shoulder: s } = rig;
  if (part === "canopy") {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(a.x - 14, a.y + 2);
    c.quadraticCurveTo(a.x - 10, a.y - 11, a.x, a.y - 12);
    c.quadraticCurveTo(a.x + 10, a.y - 11, a.x + 14, a.y + 2);
    c.quadraticCurveTo(a.x + 8, a.y - 1, a.x + 4, a.y + 2);
    c.quadraticCurveTo(a.x, a.y - 1, a.x - 4, a.y + 2);
    c.quadraticCurveTo(a.x - 8, a.y - 1, a.x - 14, a.y + 2);
    c.fill();
    c.strokeStyle = "#ebf3ed";
    c.lineWidth = 0.8;
    c.stroke();
    c.beginPath();
    for (const dx of [-8, 0, 8]) {
      c.moveTo(a.x, a.y - 11);
      c.quadraticCurveTo(a.x + dx * 0.7, a.y - 5, a.x + dx, a.y + 1);
    }
    c.stroke();
    return;
  }
  c.strokeStyle = "#42545f";
  c.lineWidth = 1.7;
  c.beginPath();
  c.moveTo(a.x, a.y - 10);
  c.lineTo(h.x, h.y + 3);
  c.quadraticCurveTo(h.x + rig.side * 4, h.y + 6, h.x + rig.side * 4, h.y + 2);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(s.x, s.y);
  c.lineTo(h.x - rig.side * 2, h.y + 1);
  c.stroke();
}

// Upright figures use different front/back/profile drawings. Only shoes point
// along the ground vector; rotating a front portrait made northbound walkers
// face the camera and southbound walkers appear upside down.
export function drawCharacter(
  c,
  p,
  {
    pose,
    player = false,
    lean = 0,
    reducedMotion = false,
    opacity = 1,
    waving = false,
    wave = 0,
    live = false,
    time = 0,
  } = {},
) {
  const view = facingView(pose),
    side = view === "left" || view === "right",
    back = view.startsWith("back"),
    diagonal = view.includes("-");
  const appearance = appearanceFor(p, player);
  const direction = pose.ux < 0 ? -1 : 1,
    r = p.r,
    shirt = player
      ? "#2185ae"
      : p.partner || p.friend
        ? p.shirt
        : live
          ? ["#a84678", "#376f9c", "#975fbd", "#32998b", "#d58b36", "#3b425d"][
              p.id % 6
            ]
          : ["#ce866b", "#758e79", "#b1a075", "#8c87a2"][p.color],
    skin = appearance.skin,
    hair = appearance.hair,
    stride =
      pose.moving && !reducedMotion
        ? Math.sin(pose.distance / 7 + (p.color ?? p.id ?? 0) * 1.7) *
          Math.min(1, pose.speed / 35) *
          2.2
        : 0;
  c.save();
  c.translate(p.x, p.y);
  c.globalAlpha *= opacity;
  if (p.archetype === "curious-child") c.scale(0.9, 0.9);
  if (p.partner) c.scale(p.visualScale ?? 1, p.visualScale ?? 1);
  c.fillStyle = "#173d3c20";
  c.beginPath();
  c.ellipse(0, 19, 11, 3, 0, 0, Math.PI * 2);
  c.fill();
  for (const sign of [-1, 1]) {
    const fx = sign * r * 0.36 + pose.ux * stride * sign,
      fy = 17 + pose.uy * stride * sign;
    c.strokeStyle = "#465269";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(sign * r * 0.28, 7);
    c.lineTo(fx, fy);
    c.stroke();
    foot(c, fx, fy, pose.ux, pose.uy);
  }
  c.save();
  if (player) c.rotate(lean);
  const width = r * (side ? 1 : diagonal ? 1.2 : 1.3) * appearance.width;
  const rig = umbrellaRig(pose, width, stride);
  const canopyColor = ["#507f9b", "#a96d6b", "#7d8c6b"][p.id % 3];
  if (p.umbrella && rig.behind) {
    umbrella(c, rig, canopyColor, "canopy");
    umbrella(c, rig, shirt, "arm");
    circle(c, rig.grip.x, rig.grip.y, 2.6, skin);
  }
  if (["long", "bob"].includes(appearance.style))
    rounded(c, -7, -22, 14, appearance.style === "long" ? 18 : 13, 6, hair);
  // Connected shoulder, elbow and hand; planted feet stop the counter-swing.
  for (const sign of [-1, 1]) {
    const hx = sign * (width / 2 + 4) - pose.ux * stride * sign * 0.4,
      hy = 3 - pose.uy * stride * sign * 0.8;
    c.strokeStyle = shirt;
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(sign * (width / 2 - 1), -7);
    c.lineTo(sign * (width / 2 + 3), -2);
    c.lineTo(hx, hy);
    c.stroke();
    circle(c, hx, hy, 2.3, skin);
  }
  rounded(c, -width / 2, -9, width, 19, 3, shirt);
  rounded(c, -2, -14, 4, 6, 1, skin);
  if (appearance.outfit === "skirt" && !player) {
    c.fillStyle = shirt;
    c.beginPath();
    c.moveTo(-width * 0.32, 7);
    c.lineTo(-width * 0.52, 12);
    c.lineTo(width * 0.52, 12);
    c.lineTo(width * 0.32, 7);
    c.fill();
  } else if (appearance.outfit !== "shirt" && !player) {
    rounded(c, -2, -3, 4, 17, 1, "#f3e6c3");
    c.strokeStyle = "#36495d";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-width * 0.25, -3);
    c.lineTo(-3, 4);
    c.moveTo(width * 0.25, -3);
    c.lineTo(3, 4);
    c.stroke();
  }
  if (live && !player && !p.friend && !p.partner) {
    rounded(c, -5, 1, 10, 7, 2, "#f3dbb1");
    c.fillStyle = shirt;
    c.font = "bold 5px system-ui";
    c.textAlign = "center";
    c.fillText("LIVE", 0, 6);
    if (p.id % 3 === 0) {
      c.strokeStyle = "#f4bf56";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-width / 2, 0);
      c.lineTo(-width / 2, 11);
      c.stroke();
    }
  }
  c.strokeStyle = "#fff6dc70";
  c.lineWidth = 1;
  c.beginPath();
  if (back) {
    c.moveTo(-4, 1);
    c.quadraticCurveTo(0, 3, 4, 1);
  } else if (side) {
    c.moveTo(direction * 2, 0);
    c.lineTo(direction * 4, 4);
  } else {
    c.moveTo(-4, 0);
    c.lineTo(0, 4);
    c.lineTo(4, 0);
  }
  c.stroke();
  if (p.state === "reading" || (p.suitcase && !back)) {
    const x = pose.ux * 7 + -pose.uy * 7,
      y = 3 + pose.uy * 6;
    rounded(c, x - 5, y - 3, 10, 7, 2, "#fff4d6");
    c.strokeStyle = "#8a7657";
    c.beginPath();
    c.moveTo(x, y - 2);
    c.lineTo(x, y + 3);
    c.stroke();
  }
  const hx = side || diagonal ? direction * 1.3 : 0;
  c.save();
  c.translate(0, -11);
  c.scale(Math.min(1, r / 13) * 0.9, Math.min(1, r / 13) * 0.9);
  // Head always stays above shoulders. A back view has a nape, not front eyes.
  circle(c, hx, -8, 8, skin);
  if (back) {
    rounded(c, hx - 2, -2, 4, 4, 1, skin);
    circle(c, hx - (diagonal ? direction : 0), -9, 7.8, hair);
    circle(c, hx - 2, -12, 2.3, appearance.older ? "#eeebe1" : hair);
    if (diagonal) {
      circle(c, hx + direction * 6, -8, 1.8, skin);
      circle(c, hx + direction * 7, -11, 1.5, skin);
    }
  } else if (side) {
    c.fillStyle = hair;
    c.beginPath();
    c.arc(
      hx - direction * 1.3,
      -9,
      7.5,
      direction > 0 ? Math.PI / 2 : -Math.PI / 2,
      direction > 0 ? Math.PI * 1.5 : Math.PI / 2,
    );
    c.fill();
    circle(c, hx - direction * 2, -8, 1.7, skin);
    circle(c, hx + direction * 7.5, -6, 1.7, skin);
    circle(c, hx + direction * 4.5, -8, 1, hair);
  } else {
    c.fillStyle = hair;
    c.beginPath();
    c.arc(hx - (diagonal ? direction : 0), -10, 7, Math.PI, Math.PI * 2);
    c.fill();
    const eyeShift = diagonal ? direction * 1.2 : 0;
    c.fillStyle = "#42564c";
    c.fillRect(hx - 4 + eyeShift, -7, 1.7, 1.4);
    c.fillRect(hx + 2 + eyeShift, -7, 1.7, 1.4);
    circle(c, hx + (diagonal ? direction * 5 : 0), -4, 1.1, "#d4aa82");
    c.strokeStyle = "#b4876a";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(hx - 1 + eyeShift, -2);
    c.lineTo(hx + 1 + eyeShift, -2);
    c.stroke();
  }
  if (["long", "bob"].includes(appearance.style)) {
    if (back)
      rounded(
        c,
        hx - 7.5,
        -10,
        15,
        appearance.style === "long" ? 14 : 10,
        5,
        hair,
      );
    else {
      const length = appearance.style === "long" ? 13 : 9;
      rounded(c, hx - 8.5, -11, 3.5, length, 2, hair);
      if (!side) rounded(c, hx + 5, -11, 3.5, length, 2, hair);
    }
  }
  if (appearance.style === "bun")
    circle(c, hx - (side ? direction * 6 : 0), -16, 4, hair);
  if (appearance.style === "curls")
    for (const dx of [-5, -2, 2, 5])
      circle(
        c,
        hx + dx - (side ? direction * 2 : 0),
        -14 + Math.abs(dx) * 0.3,
        2.5,
        hair,
      );
  if (appearance.style === "thinning") {
    circle(c, hx, -13, 4.5, skin);
    if (!back) circle(c, hx, -12, 3.5, skin);
  }
  if (appearance.older && !back) {
    c.strokeStyle = "#735f54";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(hx - 5, -5);
    c.lineTo(hx - 2, -5);
    if (!side) {
      c.moveTo(hx + 2, -5);
      c.lineTo(hx + 5, -5);
    }
    c.stroke();
  }
  c.restore();
  if (p.umbrella && !rig.behind) {
    umbrella(c, rig, canopyColor, "canopy");
    umbrella(c, rig, shirt, "arm");
    circle(c, rig.grip.x, rig.grip.y, 2.6, skin);
  }
  if (live && p.glowStick) {
    const swing = reducedMotion ? 0 : Math.sin(time * 1.8 + p.id) * 0.18;
    const sx = direction * (width / 2 - 1),
      sy = -7;
    const handX = sx + direction * 3,
      handY = -12;
    c.strokeStyle = shirt;
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(handX, handY);
    c.stroke();
    circle(c, handX, handY, 2.5, skin);
    c.save();
    c.translate(handX, handY - 1);
    c.rotate(direction * 0.25 + swing);
    c.strokeStyle = ["#83efd8", "#f6a2dc", "#f9e493"][p.id % 3];
    c.lineWidth = 2.4;
    c.shadowColor = c.strokeStyle;
    c.shadowBlur = 4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -10);
    c.stroke();
    c.restore();
  }
  if (p.reaction && !back) {
    c.save(); c.translate(0,-11); c.scale(Math.min(1,r / 13) * .9, Math.min(1,r / 13) * .9);
    c.strokeStyle = "#85432c";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(hx - 5, -9);
    c.lineTo(hx - 1, -8);
    if (!side) {
      c.moveTo(hx + 1, -8);
      c.lineTo(hx + 5, -9);
    }
    c.stroke();
    c.restore();
  }
  if (p.suitcase) {
    rounded(c, 14, 8, 12, 20, 3, "#775f4b");
    c.strokeStyle = "#775f4b";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(13, 5);
    c.lineTo(20, 10);
    c.stroke();
  }
  if (p.targetKind === "clerk") rounded(c, hx - 9, -27, 18, 5, 2, "#496c64");
  if (waving || p.state === "celebrating") {
    const handY = -25 + (reducedMotion ? 0 : wave);
    c.strokeStyle = shirt;
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-width / 2 + 1, -7);
    c.lineTo(-width / 2 - 5, -15);
    c.lineTo(-width / 2 - 8, handY);
    c.stroke();
    circle(c, -width / 2 - 8, handY, 2.5, skin);
  }
  c.restore();
  if (player) {
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 2, 19, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#245c56";
    c.font = "bold 11px system-ui";
    c.textAlign = "center";
    c.fillText("YOU", 0, 34);
  }
  c.restore();
  return { view, stride, appearance, umbrella: p.umbrella ? rig : null };
}

export function placeSpeech({ x, y, width, height, viewport, obstacles = [] }) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const candidates = [
    [x - width - 12, y - height - 10],
    [x + 12, y - height - 10],
    [x - width / 2, y - height - 20],
    [x - width - 12, y + 10],
    [x + 12, y + 10],
  ].map(([left, top]) => ({
    left: clamp(left, 6, viewport.width - width - 6),
    top: clamp(top, 6, viewport.height - height - 6),
  }));
  const overlap = (a, b) =>
    Math.max(0, Math.min(a.left + width, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.top + height, b.bottom) - Math.max(a.top, b.top));
  const score = (p) =>
    obstacles.reduce((n, o) => n + overlap(p, o) * 20, 0) +
    Math.hypot(p.left + width / 2 - x, p.top + height / 2 - y);
  const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));
  return {
    ...best,
    tailX: clamp(x, best.left + 5, best.left + width - 5),
    tailY: clamp(y, best.top + 3, best.top + height - 3),
    anchorX: clamp(x, 2, viewport.width - 2),
    anchorY: clamp(y, 2, viewport.height - 2),
  };
}
