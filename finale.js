// The finish is seen from the front row. It has its own camera and never
// changes the overhead view used while walking through the crowd.
function poly(c, points, fill) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}
function line(c, points, color, width = 2) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}
function ellipse(c, x, y, rx, ry, color) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function head(c, x, y, color = "#d9a383") {
  ellipse(c, x, y, 15, 17, color);
  c.beginPath();
  c.arc(x, y - 4, 15, Math.PI, Math.PI * 2);
  c.lineTo(x + 15, y - 2);
  c.lineTo(x + 8, y - 11);
  c.lineTo(x - 9, y - 8);
  c.closePath();
  c.fillStyle = "#27323c";
  c.fill();
  for (const dx of [-5, 5]) ellipse(c, x + dx, y + 3, 1.2, 1.3, "#354143");
}
function guitarist(c, x, footY, size = 1) {
  c.save();
  c.translate(x, footY);
  c.scale(size, size);
  line(c, [[-11, -49], [-15, -2]], "#172a35", 15);
  line(c, [[12, -49], [20, -2]], "#172a35", 15);
  ellipse(c, -17, 1, 16, 5, "#141c26");
  ellipse(c, 21, 1, 16, 5, "#141c26");
  poly(c, [[-26, -105], [20, -105], [30, -44], [-28, -44]], "#c78557");
  rect(c, -25, -59, 54, 9, "#243943");
  head(c, -3, -126, "#c78e6d");
  // A solid-neck electric guitar, waist cutouts, bridge and visible strings.
  c.save();
  c.translate(1, -67);
  c.rotate(-0.38);
  poly(c, [[-14, -13], [-31, -24], [-34, -9], [-25, -1], [-31, 10],
    [-17, 22], [9, 20], [21, 5], [13, -6], [18, -18], [5, -23]], "#e5b259");
  ellipse(c, -5, -1, 8, 7, "#8a4d42");
  rect(c, 13, -5, 64, 10, "#c29157");
  rect(c, 76, -8, 16, 15, "#d5a268");
  for (let i = 0; i < 7; i++) line(c, [[19 + i * 8, -5], [19 + i * 8, 5]], "#f4d69a", 1);
  for (const sy of [-3, 0, 3]) line(c, [[-10, sy], [88, sy]], "#f5e5bc", 0.7);
  rect(c, -15, 9, 16, 4, "#374449");
  c.restore();
  line(c, [[-20, -92], [-12, -72], [2, -64]], "#c78e6d", 8);
  line(c, [[20, -92], [29, -68], [15, -63]], "#c78e6d", 8);
  c.restore();
}
function singer(c, x, footY, size = 1) {
  c.save();
  c.translate(x, footY);
  c.scale(size, size);
  line(c, [[-11, -50], [-16, -2]], "#233848", 16);
  line(c, [[12, -50], [17, -2]], "#233848", 16);
  ellipse(c, -18, 1, 16, 5, "#131d28");
  ellipse(c, 19, 1, 16, 5, "#131d28");
  poly(c, [[-27, -108], [26, -108], [30, -48], [-29, -48]], "#559c9b");
  poly(c, [[-4, -108], [8, -108], [2, -52]], "#e6d4aa");
  head(c, 0, -130, "#d49a77");
  line(c, [[-24, -98], [-41, -123], [-52, -147]], "#d49a77", 9);
  ellipse(c, -54, -148, 7, 7, "#d49a77");
  line(c, [[26, -98], [44, -84], [30, -67]], "#d49a77", 9);
  // The microphone and stand are in front of the vocalist.
  line(c, [[12, -111], [12, -16]], "#dae2d8", 3);
  line(c, [[-7, -9], [31, -9]], "#dae2d8", 3);
  line(c, [[12, -111], [-3, -121]], "#dae2d8", 3);
  ellipse(c, -6, -122, 11, 5, "#24333b");
  rect(c, -15, -127, 3, 10, "#adbcb9");
  c.restore();
}
function drummer(c, x, footY, size = 1) {
  c.save();
  c.translate(x, footY);
  c.scale(size, size);
  head(c, 0, -123, "#b98262");
  poly(c, [[-26, -105], [27, -105], [29, -48], [-26, -48]], "#ae7966");
  line(c, [[-23, -87], [-48, -102]], "#b98262", 8);
  line(c, [[24, -87], [46, -104]], "#b98262", 8);
  line(c, [[-48, -102], [-29, -136]], "#e9d7a3", 3);
  line(c, [[46, -104], [63, -135]], "#e9d7a3", 3);
  for (const side of [-1, 1]) {
    line(c, [[side * 61, -73], [side * 61, -10]], "#bfc9c2", 2);
    ellipse(c, side * 61, -77, 28, 5, "#d7b76c");
    line(c, [[side * 39, -78], [side * 81, -78]], "#f2dfaa", 1);
  }
  for (const dx of [-23, 23]) {
    ellipse(c, dx, -55, 20, 15, "#283944");
    ellipse(c, dx, -59, 17, 11, "#e9ddd0");
    ellipse(c, dx, -59, 12, 8, "#a77f6d");
  }
  ellipse(c, 0, -24, 33, 32, "#172b37");
  ellipse(c, 0, -24, 28, 27, "#e5e0cc");
  ellipse(c, 0, -24, 21, 20, "#628b87");
  ellipse(c, 0, -24, 7, 7, "#294b54");
  line(c, [[-22, -2], [-29, 8]], "#aebcb6", 2);
  line(c, [[22, -2], [29, 8]], "#aebcb6", 2);
  c.restore();
}
function crew(c, x, headY, size, shirt, player, motion) {
  c.save();
  c.translate(x, headY);
  c.scale(size, size);
  ellipse(c, 0, 50, 32, 9, "#101e28");
  poly(c, [[-24, 21], [24, 21], [31, 64], [-30, 64]], shirt);
  line(c, [[-22, 31], [-38, -5], [-48, -22]], shirt, 12);
  line(c, [[23, 31], [37, -12], [48, -31 + motion]], shirt, 12);
  ellipse(c, -48, -23, 6, 7, "#d6a081");
  ellipse(c, 48, -31 + motion, 6, 7, "#d6a081");
  line(c, [[49, -35 + motion], [54, -70 + motion]], "#a8ded0", 5);
  ellipse(c, 0, 0, 20, 21, "#cd997b");
  ellipse(c, 0, -10, 21, 15, player ? "#24343c" : "#41323b");
  if (player) {
    rect(c, -16, 47, 32, 12, "#ecdbac");
    c.fillStyle = "#25434d";
    c.textAlign = "center";
    c.font = "bold 10px system-ui";
    c.fillText("YOU", 0, 57);
  }
  c.restore();
}
function scene(c, wide, time, reducedMotion, shirts) {
  const width = wide ? 720 : 480, height = wide ? 215 : 620;
  const stageTop = wide ? 32 : 98, stageBack = wide ? 141 : 301;
  const floorFront = wide ? 170 : 416;
  const back = c.createLinearGradient(0, 0, 0, height);
  back.addColorStop(0, "#101d29");
  back.addColorStop(0.53, "#29404a");
  back.addColorStop(1, "#182936");
  rect(c, 0, 0, width, height, back);
  rect(c, 24, stageTop - 12, width - 48, stageBack - stageTop + 30, "#a78865");
  rect(c, 35, stageTop - 4, width - 70, stageBack - stageTop + 12, "#283d47");
  for (let i = 0; i < 5; i++)
    rect(c, 42 + i * ((width - 84) / 5), stageTop, (width - 84) / 5 - 6,
      stageBack - stageTop, i % 2 ? "#2d4851" : "#365158");
  for (const x of [53, width - 77]) {
    poly(c, [[x, stageTop - 5], [x + 24, stageTop - 5], [x + 31, stageBack],
      [x + 8, stageBack]], "#815956");
    for (let y = stageTop + 18; y < stageBack - 9; y += 22)
      line(c, [[x + 8, y], [x + 25, y + 10]], "#aa7465", 1);
  }
  const rigY = wide ? 23 : 82;
  line(c, [[36, rigY], [width - 36, rigY]], "#b4bdad", 6);
  for (let x = 55; x < width - 40; x += 38)
    line(c, [[x, rigY - 6], [x + 19, rigY + 5]], "#748b87", 2);
  const lights = wide ? [170, 360, 550] : [125, 240, 365];
  lights.forEach((x, i) => {
    rect(c, x - 11, rigY, 22, 11, "#1b2c35");
    ellipse(c, x, rigY + 10, 10, 3, "#f3d69d");
    c.save();
    c.globalAlpha = reducedMotion ? 0.15 : 0.13 + 0.02 * Math.sin(time * 1.6 + i);
    poly(c, [[x - 7, rigY + 11], [x + 7, rigY + 11],
      [x + (wide ? 83 : 58), stageBack + 30],
      [x - (wide ? 83 : 58), stageBack + 30]], "#ffe4ae");
    c.restore();
  });
  c.fillStyle = "#ead8aa";
  c.textAlign = "center";
  c.font = `800 ${wide ? 16 : 24}px system-ui`;
  c.fillText("LIVE", width / 2, wide ? 50 : 143);
  c.font = `700 ${wide ? 8 : 10}px system-ui`;
  c.fillText("TONIGHT · TOGETHER", width / 2, wide ? 62 : 157);
  poly(c, [[35, stageBack], [width - 35, stageBack],
    [width - 10, floorFront], [10, floorFront]], "#685451");
  for (let i = 1; i <= 4; i++)
    line(c, [[35 + i * (width - 70) / 5, stageBack],
      [10 + i * (width - 20) / 5, floorFront]], "#8f7061", 1);
  const footY = wide ? 155 : 325, size = wide ? 0.7 : 1;
  guitarist(c, lights[0], footY, size);
  singer(c, lights[1], footY + (wide ? 0 : 3), size);
  drummer(c, lights[2], footY + (wide ? 0 : 3), size);
  rect(c, 0, floorFront - 4, width, wide ? 16 : 25, "#172a33");
  line(c, [[0, floorFront - 4], [width, floorFront - 4]], "#e3b879", 4);
  for (let x = 28; x < width; x += wide ? 72 : 52)
    ellipse(c, x, floorFront + (wide ? 3 : 5), wide ? 4 : 5, 3, "#f6d89a");
  const crowd = c.createLinearGradient(0, floorFront + 6, 0, height);
  crowd.addColorStop(0, "#344f54");
  crowd.addColorStop(1, "#142832");
  rect(c, 0, floorFront + (wide ? 12 : 21), width,
    height - floorFront, crowd);
  const positions = wide
    ? [[76, 188, 0.45], [210, 190, 0.45], [360, 188, 0.48],
      [510, 190, 0.45], [644, 188, 0.45]]
    : [[58, 482, 0.9], [151, 470, 0.95], [240, 486, 1.04],
      [332, 470, 0.95], [423, 482, 0.9]];
  positions.forEach(([x, y, s], i) =>
    crew(c, x, y, s, shirts[i], i === 2,
      reducedMotion ? 0 : Math.sin(time * 2 + i) * 3));
  if (!wide) {
    rect(c, 0, 587, width, 33, "#132732");
    c.fillStyle = "#e7d7aa";
    c.font = "700 14px system-ui";
    c.fillText("全員で見た、最前列の景色", width / 2, 609);
  }
}

export function drawFinale(c, { width, height, card, ratio, time, reducedMotion, members }) {
  const sideCard = width > 950 && card.left > width * 0.57;
  const wide = !sideCard && width > height && height <= 500;
  const slot = sideCard
    ? { x: 0, y: 0, w: card.left - 14, h: height }
    : { x: 0, y: 0, w: width, h: card.top - 12 };
  const sceneW = wide ? 720 : 480, sceneH = wide ? 215 : 620;
  const scale = Math.max(0.01, Math.min((slot.w - 24) / sceneW, (slot.h - 24) / sceneH));
  const x = slot.x + (slot.w - sceneW * scale) / 2;
  const y = slot.y + (slot.h - sceneH * scale) / 2;
  const colors = [members[0]?.shirt || "#d5ab53", members[1]?.shirt || "#83a9bb",
    "#3296b2", members[2]?.shirt || "#cc8b74", members[3]?.shirt || "#9788a9"];
  c.save();
  const outer = c.createLinearGradient(0, 0, 0, height);
  outer.addColorStop(0, "#132733");
  outer.addColorStop(1, "#314c50");
  rect(c, 0, 0, width, height, outer);
  c.translate(x, y);
  c.scale(scale, scale);
  scene(c, wide, time, reducedMotion, colors);
  c.restore();
  return { x: x * ratio, y: y * ratio,
    width: sceneW * scale * ratio, height: sceneH * scale * ratio };
}
