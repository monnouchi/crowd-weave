// Original Canvas scenery. Decorations never alter a path, collider or signal.
function box(c, x, y, w, h, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
}
export function floorDetails(c, scene) {
  const outdoor =
    scene.landmark === "home" ||
    scene.landmark === "station" ||
    scene.landmark === "venue";
  c.save();
  if (outdoor) {
    c.strokeStyle = "#c8d2c244";
    c.lineWidth = 1;
    for (let y = -280; y < 790; y += 80) {
      c.beginPath();
      for (let x = 32; x < 470; x += 80) {
        c.moveTo(x, y);
        c.lineTo(x, y + 40);
      }
      c.stroke();
    }
    for (const x of [7, 473])
      for (const y of [150, 250, 455, 570]) {
        c.fillStyle = "#254e3930";
        c.beginPath();
        c.ellipse(x + 3, y + 10, 17, 13, 0, 0, Math.PI * 2);
        c.fill();
        for (const [dx, dy, r] of [
          [0, 0, 12],
          [-6, 3, 9],
          [6, 2, 9],
        ]) {
          c.fillStyle = scene.landmark === "home" ? "#8faa79" : "#789a7b";
          c.beginPath();
          c.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = "#d8dabc";
        c.beginPath();
        c.arc(x - 4, y - 4, 2, 0, Math.PI * 2);
        c.fill();
      }
  } else if (scene.landmark === "cafe") {
    c.strokeStyle = "#c6c2a72b";
    for (let x = 18; x < 465; x += 32) {
      c.beginPath();
      c.moveTo(x, 115);
      c.lineTo(x, 680);
      c.stroke();
    }
    for (const x of [57, 423]) {
      box(c, x - 20, 124, 40, 28, 6, "#d0b78e");
      box(c, x - 13, 120, 26, 8, 3, "#9c8268");
      c.fillStyle = "#f6f1dc";
      c.beginPath();
      c.arc(x, 137, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#f6f1dc";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x + 5, 137, 3, -Math.PI / 2, Math.PI / 2);
      c.stroke();
    }
  } else {
    c.fillStyle = "#b49cc011";
    for (let y = 140; y < 680; y += 55) c.fillRect(18, y, 444, 2);
    for (const x of [28, 452])
      for (const y of [160, 250, 450, 560]) {
        box(c, x - 7, y - 12, 14, 24, 4, "#4f4866");
        box(c, x - 4, y - 7, 8, 14, 3, "#80718d");
        c.fillStyle = "#dfbe7b";
        c.beginPath();
        c.arc(x, y + 8, 2, 0, Math.PI * 2);
        c.fill();
      }
  }
  c.restore();
}
function musician(c, x, y, color, instrument) {
  c.save();
  c.translate(x, y);
  c.fillStyle = "#17182b30";
  c.beginPath();
  c.ellipse(2, 14, 17, 8, 0, 0, Math.PI * 2);
  c.fill();
  box(c, -7, 12, 5, 11, 2, "#252d42");
  box(c, 2, 12, 5, 11, 2, "#252d42");
  box(c, -11, -6, 22, 25, 8, color);
  c.fillStyle = "#edc6a4";
  c.beginPath();
  c.arc(0, -9, 8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#403d50";
  c.beginPath();
  c.arc(0, -11, 7, Math.PI, Math.PI * 2);
  c.fill();
  if (instrument === "guitar") {
    c.save();
    c.rotate(-0.35);
    box(c, -14, 3, 18, 16, 7, "#d7b079");
    box(c, 0, 7, 22, 5, 2, "#aa8059");
    c.fillStyle = "#735547";
    c.beginPath();
    c.arc(-5, 11, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  } else if (instrument === "keys") {
    box(c, -24, 3, 48, 15, 3, "#3c4158");
    box(c, -21, 7, 42, 8, 1, "#ebe7d6");
    c.fillStyle = "#343447";
    for (let x = -15; x < 21; x += 7) c.fillRect(x, 7, 3, 5);
  } else {
    c.strokeStyle = "#cfc5cc";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(10, 1);
    c.lineTo(10, 23);
    c.moveTo(4, 23);
    c.lineTo(17, 23);
    c.stroke();
    box(c, 6, -4, 8, 6, 3, "#333448");
  }
  c.restore();
}
export function concert(
  c,
  { time = 0, reducedMotion = false, complete = false } = {},
) {
  c.save();
  // Slow, low-opacity beams stay entirely in the decorative stage area.
  for (const [x, color, offset] of [
    [135, "#e6c77d", 0],
    [240, "#c9a3d8", 1],
    [345, "#87bcb3", 2],
  ]) {
    const drift = reducedMotion ? 0 : Math.sin(time * 0.28 + offset) * 13;
    c.fillStyle = color + "24";
    c.beginPath();
    c.moveTo(x, -173);
    c.lineTo(x - 38 + drift, -54);
    c.lineTo(x + 38 + drift, -54);
    c.closePath();
    c.fill();
  }
  musician(c, 155, -112, "#c79770", "guitar");
  musician(c, 240, -120, "#9ba6b7", "voice");
  musician(c, 325, -112, "#a788ac", "keys");
  c.strokeStyle = "#2c2b45";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(106, -45);
  c.lineTo(374, -45);
  c.stroke();
  if (complete) {
    c.fillStyle = "#f1d3a0";
    c.font = "bold 10px system-ui";
    c.textAlign = "center";
    c.fillText("一緒に、いい夜を。", 240, -66);
  }
  c.restore();
}

// Rain stays on the side strips, behind people and signals. No flashing or haze.
export function rainShelters(c, { time = 0, reducedMotion = false } = {}) {
  c.save();
  for (const [x, y, w] of [
    [30, 935, 70],
    [380, 205, 70],
    [170, 12, 140],
  ]) {
    box(c, x, y, w, 13, 3, "#3d6474");
    c.strokeStyle = "#bfd1d6";
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 8; i < w; i += 14) {
      c.moveTo(x + i, y);
      c.lineTo(x + i - 4, y + 12);
    }
    c.stroke();
    c.fillStyle = "#365760";
    c.font = "bold 10px system-ui";
    c.textAlign = "center";
    c.fillText("軒下 / 雨宿り", x + w / 2, y - 7);
    c.fillStyle = "#7fadb536";
    c.beginPath();
    c.ellipse(x + w / 2, y + 73, w * 0.35, 7, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = "#406f8c60";
  c.lineWidth = 1.2;
  c.beginPath();
  const drift = reducedMotion ? 0 : time * 95;
  for (let i = 0; i < 44; i++) {
    const x = i % 2 ? 386 + ((i * 17) % 63) : 26 + ((i * 19) % 62);
    const y = -220 + ((i * 47 + drift) % 1450);
    c.moveTo(x, y);
    c.lineTo(x - 3, y + 11);
  }
  c.stroke();
  c.restore();
}

// Space continues beyond the destination, behind an explicit local boundary.
export function goalBoundary(c, scene) {
  c.save();
  if (scene.landmark === "party") {
    // The security lane stays between stage and audience. One parallel rail,
    // connected to both walls, has no central entrance onto the stage.
    box(c, 18, -195, 18, 260, 3, "#4d435e");
    box(c, 444, -195, 18, 260, 3, "#4d435e");
    box(c, 36, 22, 408, 8, 3, "#211d3380");
    for (let x = 36; x <= 444; x += 51) {
      box(c, x - 6, 18, 12, 6, 2, "#343340");
      box(c, x - 2, -5, 4, 27, 2, "#aab5bb");
    }
    box(c, 34, -5, 412, 5, 2, "#c3cdd1");
    box(c, 34, 8, 412, 3, 1, "#788d98");
    box(c, 34, -5, 412, 1, 0, "#e5e9e8");
    c.restore();
    return;
  }
  const building = ["station", "cafe", "venue"].includes(scene.landmark);
  for (const [x, w] of [
    [18, 144],
    [318, 144],
  ]) {
    if (building) {
      box(c, x, -180, w, 276, 3, "#9ca99f");
      box(c, x, 89, w, 7, 2, "#65766f");
      for (const windowX of [x + 18, x + w - 46]) {
        box(c, windowX, -72, 28, 58, 3, "#b9d6cf");
        c.strokeStyle = "#687a75";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(windowX + 14, -72);
        c.lineTo(windowX + 14, -14);
        c.stroke();
      }
    } else {
      box(c, x, 82, w, 14, 3, "#7e8c68");
      for (let tree = x + 12; tree < x + w; tree += 24) {
        c.fillStyle = "#72976e";
        c.beginPath();
        c.arc(tree, 75, 17, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#8aab7c";
        c.beginPath();
        c.arc(tree - 4, 69, 11, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.restore();
}
export function venueJourney(c) {
  c.save();
  // Distinct station pavement, broad avenue and park approach.
  c.fillStyle = "#d3dfde";
  c.fillRect(18, 950, 444, 260);
  c.fillStyle = "#d7dfcb";
  c.fillRect(18, 390, 444, 360);
  for (const x of [9, 471])
    for (const y of [435, 535, 635, 715]) {
      c.fillStyle = "#658b70";
      c.beginPath();
      c.arc(x, y, 26, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#91ac7e";
      c.beginPath();
      c.arc(x - 5, y - 7, 17, 0, Math.PI * 2);
      c.fill();
    }
  box(c, 30, 582, 55, 12, 3, "#9b8560");
  box(c, 390, 487, 55, 12, 3, "#9b8560");
  box(c, 105, 1090, 270, 22, 4, "#527779");
  c.fillStyle = "#fff9e8";
  c.font = "bold 12px system-ui";
  c.textAlign = "center";
  c.fillText("会場最寄り駅 / 郊外ライブへ ↑", 240, 1105);
  c.fillStyle = "#45654e";
  c.font = "bold 12px system-ui";
  c.fillText("公園の小道 / 会場へ ↑", 240, 670);
  c.font = "10px system-ui";
  c.fillText("駅前の大通り / 4車線", 240, 758);
  c.restore();
}
export function hallInterior(c, { time = 0, reducedMotion = false } = {}) {
  c.save();
  c.fillStyle = "#ded8c9";
  c.fillRect(18, 715, 444, 340);
  c.fillStyle = "#848199";
  c.fillRect(18, -800, 444, 1485);
  // Lighting lives under the actors, so outlines and gaps retain their contrast.
  for (const [x, y, color] of [
    [120, 300, "#d6b9e4"],
    [340, 430, "#96cccd"],
    [240, 150, "#e6cf9d"],
  ]) {
    const drift = reducedMotion ? 0 : Math.sin(time * 0.25 + x) * 8;
    const light = c.createRadialGradient(x + drift, y, 5, x + drift, y, 95);
    light.addColorStop(0, color + "92");
    light.addColorStop(1, color + "00");
    c.fillStyle = light;
    c.fillRect(x - 105, y - 105, 210, 210);
  }
  box(c, 18, 690, 112, 28, 3, "#453a49");
  box(c, 350, 690, 112, 28, 3, "#453a49");
  box(c, 115, 690, 18, 90, 3, "#624d48");
  box(c, 347, 690, 18, 90, 3, "#624d48");
  box(c, 120, 715, 5, 16, 2, "#c9ad71");
  box(c, 355, 715, 5, 16, 2, "#c9ad71");
  box(c, 30, 800, 95, 22, 4, "#9b8566");
  box(c, 355, 800, 95, 22, 4, "#9b8566");
  for (const x of [125, 355]) {
    box(c, x - 3, 796, 6, 40, 2, "#695c62");
  }
  c.fillStyle = "#4a414b";
  c.font = "bold 12px system-ui";
  c.textAlign = "center";
  c.fillText("受付 / チケット確認", 240, 855);
  c.fillText("ロビー / ホールへ ↑", 240, 923);
  c.fillStyle = "#eee4cd";
  c.fillText("HALL / 扉は開いています", 240, 708);
  // Tickets on the desk and the attendant's side make the check readable.
  box(c, 110, 802, 12, 7, 1, "#f5dd9e");
  box(c, 165, 802, 22, 5, 2, "#9b8566");
  c.restore();
}
