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
  } = {},
) {
  const view = facingView(pose),
    side = view === "left" || view === "right",
    back = view.startsWith("back"),
    diagonal = view.includes("-");
  const direction = pose.ux < 0 ? -1 : 1,
    r = p.r,
    shirt = player
      ? "#2185ae"
      : p.partner || p.friend
        ? p.shirt
        : ["#ce866b", "#758e79", "#b1a075", "#8c87a2"][p.color],
    skin = player ? "#ffdf9e" : "#f4cfab",
    hair = "#3b4b49",
    stride =
      pose.moving && !reducedMotion
        ? Math.sin(pose.distance / 7 + (p.color ?? p.id ?? 0) * 1.7) *
          Math.min(1, pose.speed / 35) *
          2.2
        : 0;
  c.save();
  c.translate(p.x, p.y);
  c.globalAlpha *= opacity;
  if (p.archetype === "curious-child") c.scale(0.8, 0.8);
  if (p.partner) c.scale(p.visualScale ?? 1, p.visualScale ?? 1);
  if (p.umbrella) {
    // Side-carried canopy leaves the head, feet and middle of the path visible.
    c.strokeStyle = "#435e69";
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(17, 6);
    c.lineTo(17, -28);
    c.stroke();
    c.fillStyle = ["#507f9b", "#a96d6b", "#7d8c6b"][p.id % 3];
    c.beginPath();
    c.arc(17, -27, 13, Math.PI, Math.PI * 2);
    c.closePath();
    c.fill();
    c.strokeStyle = "#e4ebe6";
    c.lineWidth = 1;
    c.stroke();
  }
  c.fillStyle = "#173d3c20";
  c.beginPath();
  c.ellipse(2, 11, 14, 7, 0, 0, Math.PI * 2);
  c.fill();
  for (const sign of [-1, 1])
    foot(
      c,
      sign * r * 0.42 + pose.ux * stride * sign,
      14 + pose.uy * stride * sign,
      pose.ux,
      pose.uy,
    );
  c.save();
  if (player) c.rotate(lean);
  const width = r * (side ? 1.45 : diagonal ? 1.8 : 2);
  // Actual travel drives counter-swing; a stationary pose plants both feet.
  for (const sign of [-1, 1])
    circle(
      c,
      sign * (width / 2 + 1) - pose.ux * stride * sign * 0.4,
      4 - pose.uy * stride * sign * 0.55,
      2.5,
      skin,
    );
  rounded(c, -width / 2, -5, width, 20, 8, shirt);
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
  if (p.state === "reading") {
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
  // Head always stays above shoulders. A back view has a nape, not front eyes.
  circle(c, hx, -8, 8, skin);
  if (back) {
    rounded(c, hx - 2, -2, 4, 4, 1, skin);
    circle(c, hx - (diagonal ? direction : 0), -9, 7.8, hair);
    circle(c, hx - 2, -12, 2.3, "#50605a");
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
  if (p.reaction && !back) {
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
  if (p.targetKind === "clerk") rounded(c, hx - 9, -16, 18, 5, 2, "#496c64");
  if (waving)
    circle(c, -width / 2 - 3, -3 + (reducedMotion ? 0 : wave), 3, skin);
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
  return { view, stride };
}
