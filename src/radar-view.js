import { BODY_GAP } from "../bodies.js";
import { radarSnapshot } from "./radar.js";

const TAU = Math.PI * 2;

// Keep the map in the peripheral sky, below the centred signal warning. The
// short landscape layout stays clear of the touch controls as well.
export function radarLayout(view = {}) {
  const screenWidth = Math.max(1, view.width || 390);
  const screenHeight = Math.max(1, view.height || 700);
  if (screenHeight < 260 ||
      (screenWidth < 450 && screenHeight < 360)) return null;
  const width = screenWidth <= 360 ? 104 : screenWidth < 750 ? 118 : 132;
  const height = width + 31;
  const margin = screenWidth <= 360 ? 8 : 12;
  const x = screenWidth - width - margin;
  const y = screenHeight < 440 && screenWidth >= 450 ? 78 :
    screenHeight <= 620 ? 142 : 168;
  return { x, y, width, height,
    map: { x: x + 9, y: y + 20, width: width - 18,
      height: height - 53 } };
}

function panelPath(ctx, { x, y, width, height }) {
  const r = 11;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function diamond(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
}

export function drawRadar(ctx, run, view = {}) {
  if (!ctx || run?.phase !== "playing") return;
  const panel = radarLayout(view);
  if (!panel) return;
  const data = radarSnapshot(run);
  const map = panel.map;
  const scale = Math.min(map.width / (2 * data.side),
    map.height / (data.ahead + data.behind));
  const cx = map.x + map.width / 2;
  const cy = map.y + (map.height - (data.ahead + data.behind) * scale) / 2 +
    data.ahead * scale;
  const px = (x) => cx + x * scale;
  const py = (y) => cy - y * scale;

  ctx.save();
  panelPath(ctx, panel);
  ctx.fillStyle = "rgba(12, 29, 38, .9)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(228, 245, 229, .82)";
  ctx.stroke();
  ctx.fillStyle = "#eff8e8";
  ctx.font = `800 ${panel.width <= 104 ? 10 : 11}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("周囲", panel.x + 10, panel.y + 14);
  ctx.textAlign = "right";
  ctx.fillStyle = "#a7e5d5";
  ctx.fillText("前 ↑", panel.x + panel.width - 9, panel.y + 14);

  ctx.save();
  ctx.beginPath();
  ctx.rect(map.x, map.y, map.width, map.height);
  ctx.clip();
  ctx.fillStyle = "rgba(228, 241, 227, .045)";
  ctx.fillRect(map.x, map.y, map.width, map.height);

  // Roads are caution bands, never solid walls: red entry is still a player
  // choice in the simulation. The pale ticks mark the usable crossing lane.
  for (const road of data.roads) {
    const top = py(road.front), bottom = py(road.back);
    ctx.fillStyle = "rgba(232, 160, 97, .24)";
    ctx.fillRect(map.x, top, map.width, bottom - top);
    const left = Math.max(map.x, px(road.left));
    const right = Math.min(map.x + map.width, px(road.right));
    ctx.fillStyle = "rgba(245, 238, 213, .65)";
    for (let x = left + 3; x < right - 2; x += 10)
      ctx.fillRect(x, Math.max(map.y, bottom - 5), 5, 2);
  }

  ctx.strokeStyle = "#d8e2d8";
  ctx.lineWidth = 3.3;
  for (const wall of data.walls) {
    ctx.beginPath();
    ctx.moveTo(px(wall.x1), py(wall.y1));
    ctx.lineTo(px(wall.x2), py(wall.y2));
    ctx.stroke();
  }

  for (const actor of data.actors) {
    const x = px(actor.x), y = py(actor.y);
    const footprint = (actor.r + data.playerRadius + BODY_GAP) * scale;
    ctx.beginPath(); ctx.arc(x, y, footprint, 0, TAU);
    ctx.fillStyle = actor.kind === "animal"
      ? "rgba(248, 192, 122, .12)" : "rgba(239, 238, 215, .1)";
    ctx.fill();
    ctx.strokeStyle = actor.kind === "animal"
      ? "rgba(248, 192, 122, .45)" : "rgba(239, 238, 215, .38)";
    ctx.lineWidth = .9; ctx.stroke();
    const r = Math.max(3, actor.r * scale);
    if (actor.kind === "animal") {
      diamond(ctx, x, y, r);
      ctx.fillStyle = "#ffc986";
    } else {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = "#f4ead3";
    }
    ctx.fill();
    ctx.strokeStyle = "#17313b";
    ctx.lineWidth = 1.1; ctx.stroke();
    const speed = Math.hypot(actor.vx, actor.vy);
    if (speed > 8) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + actor.vx / speed * (r + 5),
        y - actor.vy / speed * (r + 5));
      ctx.strokeStyle = actor.kind === "animal" ? "#ffc986" : "#f4ead3";
      ctx.lineWidth = 1.6; ctx.stroke();
    }
  }

  for (const vehicle of data.vehicles) {
    const x = px(vehicle.x), y = py(vehicle.y);
    const width = Math.max(9, vehicle.width * scale);
    const height = Math.max(5, vehicle.height * scale);
    ctx.fillStyle = "#e88b71";
    ctx.fillRect(x - width / 2, y - height / 2, width, height);
    ctx.strokeStyle = "#fff2d7";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    ctx.beginPath();
    for (const shift of [-3, 3]) {
      ctx.moveTo(x + shift - 2, y + height / 2 - 1);
      ctx.lineTo(x + shift + 2, y - height / 2 + 1);
    }
    ctx.stroke();
  }

  // The player stays fixed while the world scrolls. The point of the triangle
  // faces the destination; it remains legible over people and road markings.
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 6.5, cy + 5);
  ctx.lineTo(cx - 6.5, cy + 5);
  ctx.closePath();
  ctx.fillStyle = "#8eecd1";
  ctx.fill();
  ctx.strokeStyle = "#123541";
  ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#ecf2e2";
  ctx.font = `700 ${panel.width <= 104 ? 9 : 10}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("○ 人   ◆ 動物", panel.x + 9,
    panel.y + panel.height - 20);
  ctx.fillText("━ 壁   ▧ 車両", panel.x + 9,
    panel.y + panel.height - 7);
  ctx.restore();
}
