import { shareResult, resultText } from "./share.js";
import { GameAudio } from "./sound.js";
import { updatePlayerPose } from "./pose.js";
import { GAME_NAME, PAGE_TITLE } from "./branding.js";
import { createGame, step, W, H, GOAL, STAGES } from "./logic.js";
import { visiblePerson } from "./crowd.js";
import { TwoButtons, EnterLatch, primaryCommand } from "./input.js";
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d"),
  overlay = document.querySelector("#overlay"),
  action = document.querySelector("#action"),
  pause = document.querySelector("#pause");
let game = createGame(),
  last = performance.now(),
  buttons = new TwoButtons(),
  noticeUntil = 0,
  records = [],
  playerPose = { lean: 0 };
const enterLatch = new EnterLatch();
const audio = new GameAudio();
window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", () => audio.unlock());
document.querySelector("#sound").addEventListener("click", () => {
  const muted = audio.toggle();
  document.querySelector("#sound").textContent = muted ? "音：OFF" : "音：ON";
  document.querySelector("#sound").setAttribute("aria-pressed", String(muted));
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (s) => document.querySelector(s);
document.title = PAGE_TITLE;
document.querySelector("#game-name").textContent = GAME_NAME;
function clearInput() {
  buttons.clear();
}
function panel(title, message, button, label = "STATION") {
  overlay.hidden = false;
  $("#title").textContent = title;
  $("#message").textContent = message;
  action.textContent = button;
  $("#label").textContent = label;
  $("#enter-hint").textContent =
    game.phase === "paused"
      ? "Enter で再開"
      : game.phase === "finished" && game.stage < 4
        ? "Enter で次のステージへ"
        : game.phase === "finished"
          ? "Enter で最初から再挑戦"
          : "Enter で開始";
  action.focus({ preventScroll: true });
}
function start(stage = 0) {
  $("#share-actions").hidden = true;
  clearInput();
  if (stage === 0) records = [];
  game = createGame(stage);
  playerPose = { lean: 0 };
  $("#goal-callout").textContent = game.scene.bubble;
  $("#scene-purpose").textContent = game.scene.purpose;
  $("#stage").textContent = `STAGE ${stage + 1} / 5 · ${STAGES[stage].name}`;
  game.phase = "playing";
  overlay.hidden = true;
  pause.disabled = false;
  last = performance.now();
  $("#notice").classList.remove("active");
  canvas.focus({ preventScroll: true });
}
function setPaused() {
  if (game.phase !== "playing") return;
  game.phase = "paused";
  audio.suspend();
  clearInput();
  pause.disabled = true;
  panel(
    "ひと休み。",
    "時計は止まっています。準備ができたら続きを進もう。",
    "再開する →",
  );
}
function activatePrimary() {
  const command = primaryCommand(game.phase, game.stage);
  if (command === "resume") {
    clearInput();
    game.phase = "playing";
    overlay.hidden = true;
    pause.disabled = false;
    last = performance.now();
    canvas.focus({ preventScroll: true });
  } else if (command === "next") start(game.stage + 1);
  else if (command === "start" || command === "retry") start();
}
action.addEventListener("click", activatePrimary);
action.focus({ preventScroll: true });
$("#restart").addEventListener("click", () => start(game.stage));
pause.addEventListener("click", setPaused);
const controls = ["ArrowLeft", "ArrowRight", "a", "d"];
window.addEventListener("keydown", (e) => {
  const editable =
    e.target instanceof Element &&
    !!e.target.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
    );
  if (e.key === "Enter") {
    if (editable || e.isComposing) return;
    e.preventDefault();
    if (
      enterLatch.press({
        repeat: e.repeat,
        modified: e.altKey || e.ctrlKey || e.metaKey || e.shiftKey,
      })
    )
      activatePrimary();
    return;
  }
  if (editable || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (controls.includes(k)) {
    e.preventDefault();
    if (game.phase === "playing")
      buttons.press(
        "key:" + k,
        k === "ArrowLeft" || k === "a" ? "left" : "right",
      );
  }
  if (e.key === "Escape") setPaused();
});
window.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    enterLatch.release();
    return;
  }
  buttons.release("key:" + (e.key.length === 1 ? e.key.toLowerCase() : e.key));
});
window.addEventListener("blur", () => {
  enterLatch.release();
  setPaused();
});
window.addEventListener("touchcancel", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    enterLatch.release();
    setPaused();
  }
});
for (const side of ["left", "right"]) {
  const button = $("#" + side);
  button.addEventListener("pointerdown", (e) => {
    if (game.phase !== "playing") return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    buttons.press(e.pointerId, side);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(event, (e) => {
      buttons.release(e.pointerId);
    });
}
function input() {
  return buttons.read();
}
function rounded(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function person(p, player = false) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.archetype === "curious-child") ctx.scale(0.8, 0.8);
  if (p.partner) ctx.scale(p.visualScale, p.visualScale);
  if (!player) {
    ctx.globalAlpha =
      p.partner || p.background
        ? 1
        : Math.min(
            1,
            (p.x - 18) / 18,
            (462 - p.x) / 18,
            (p.y - 110) / 20,
            (670 - p.y) / 20,
          );
    ctx.rotate(
      Math.atan2(p.reaction?.faceX ?? p.ux, -(p.reaction?.faceY ?? p.uy)),
    );
  }
  const steering = input();
  const moving =
    game.phase === "playing" &&
    !game.stun &&
    !(steering.left && steering.right);
  const stride = reducedMotion.matches
    ? 0
    : player
      ? moving
        ? Math.sin(game.elapsed * 12) * 2
        : 0
      : p.reaction || p.state !== "walking"
        ? 0
        : Math.sin(p.walk / 7 + p.color * 1.7) * 1.6;
  rounded(-8, 9 + stride, 5, 8, 2, "#3b4b49");
  rounded(3, 9 - stride, 5, 8, 2, "#3b4b49");
  ctx.fillStyle = "#173d3c20";
  ctx.beginPath();
  ctx.ellipse(2, 9, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (player && game.cooldown > 0 && Math.floor(game.cooldown * 9) % 2) {
    ctx.globalAlpha = 0.45;
  }
  ctx.save();
  if (player) ctx.rotate(playerPose.lean);
  rounded(
    -p.r,
    -9,
    p.r * 2,
    24,
    10,
    player
      ? "#2185ae"
      : p.partner
        ? p.shirt
        : ["#ce866b", "#758e79", "#b1a075", "#8c87a2"][p.color],
  );
  ctx.fillStyle = player ? "#ffdf9e" : "#f4cfab";
  ctx.beginPath();
  ctx.arc(0, -7, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b4b49";
  ctx.beginPath();
  ctx.arc(0, -10, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  if (p.reaction) {
    ctx.strokeStyle = "#85432c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(-1, -3);
    ctx.moveTo(1, -3);
    ctx.lineTo(5, -5);
    ctx.stroke();
  }
  if (!player && p.state === "reading") {
    rounded(7, 0, 10, 8, 2, "#fff4d6");
    ctx.strokeStyle = "#8a7657";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 1);
    ctx.lineTo(12, 7);
    ctx.stroke();
  }
  if (p.suitcase) {
    rounded(14, 8, 12, 20, 3, "#775f4b");
    ctx.strokeStyle = "#775f4b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(13, 5);
    ctx.lineTo(20, 10);
    ctx.stroke();
  }
  if (p.partner) {
    ctx.fillStyle = "#f4cfab";
    ctx.beginPath();
    ctx.arc(
      -15,
      -3 + (reducedMotion.matches ? 0 : Math.sin(game.elapsed * 3) * 2),
      4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
  if (player) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#245c56";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("YOU", 0, 34);
  }
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#d4dfcf";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(240 - game.player.x, 560 - game.player.y);
  ctx.fillStyle = "#e9ecdf";
  ctx.fillRect(0, -800, W, H + 1000);
  ctx.fillStyle = "#d4dfcf";
  ctx.fillRect(0, 0, 18, H);
  ctx.fillRect(W - 18, 0, 18, H);
  for (let y = -655; y < H; y += 40) {
    ctx.strokeStyle = "#dce1d5";
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(W - 20, y);
    ctx.stroke();
  }
  rounded(18, -500, 444, 55, 8, "#cbd7ca");
  ctx.fillStyle = "#285d55";
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("北口コンコース →", 240, -470);
  rounded(28, -230, 90, 35, 5, "#839781");
  rounded(350, -230, 90, 35, 5, "#839781");
  for (let i = 0; i < 6; i++) {
    const y =
      -100 - ((i * 63 + game.elapsed * (i % 2 ? 20 : -18) + 1200) % 350);
    person({
      x: 75 + i * 64,
      y,
      r: 13,
      ux: 0,
      uy: i % 2 ? 1 : -1,
      color: i % 4,
      state: "walking",
      walk: game.elapsed * (24 + i),
      background: true,
    });
  }
  rounded(130, -150, 220, 150, 10, "#d7c6a3");
  rounded(150, -137, 160, 18, 5, "#8b6e4e");
  ctx.fillStyle = "#fff4dc";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("COFFEE / 北口カフェ", 230, -124);
  for (const x of [170, 290]) {
    rounded(x - 18, -90, 36, 26, 5, "#b69b72");
    person({
      x: x + 28,
      y: -65,
      r: 11,
      ux: 0,
      uy: -1,
      color: 2,
      state: "meeting",
      walk: 0,
      background: true,
    });
  }
  rounded(GOAL.x, GOAL.y, GOAL.w, GOAL.h, 12, "#dbe7d4");
  rounded(GOAL.x, 5, GOAL.w, 22, 8, "#285d55");
  ctx.fillStyle = "#fff5d8";
  ctx.textAlign = "center";
  ctx.font = "bold 13px system-ui";
  ctx.fillText("☕ CAFÉ", 240, 21);
  ctx.font = "10px system-ui";
  ctx.fillStyle = "#55796c";
  ctx.fillText("GOAL / 待ち合わせ", 240, 82);
  ctx.fillStyle = "#55796c";
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("北口 / カフェ ↑", 240, 108);
  rounded(18, 180, 24, 100, 5, "#cbd7ca");
  rounded(438, 380, 24, 100, 5, "#cbd7ca");
  ctx.fillStyle = "#55796c";
  ctx.save();
  ctx.translate(33, 230);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("1・2番ホーム", 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(449, 430);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("3・4番ホーム", 0, 0);
  ctx.restore();
  rounded(397, 340, 40, 16, 4, "#67836f");
  ctx.fillStyle = "#fff";
  ctx.font = "9px system-ui";
  ctx.fillText("トイレ", 417, 351);
  ctx.fillStyle = "#55796c";
  rounded(43, 298, 40, 8, 3, "#67836f");
  rounded(397, 298, 40, 8, 3, "#67836f");
  ctx.font = "9px system-ui";
  ctx.fillText("案内板", 63, 294);
  ctx.fillText("案内板", 417, 294);
  rounded(96, 474, 28, 12, 3, "#d6b579");
  ctx.font = "8px system-ui";
  ctx.fillText("駅の絵", 110, 482);
  rounded(44, 532, 38, 5, 2, "#839781");
  ctx.fillText("待合", 63, 548);
  rounded(398, 532, 38, 5, 2, "#839781");
  ctx.fillText("待合", 417, 548);
  ctx.fillText("改札", 240, 650);
  ctx.fillStyle = "#759081";
  ctx.font = "11px system-ui";
  ctx.fillText("START", 240, 662);
  for (const p of [
    ...game.crowd.filter(visiblePerson),
    game.meetingPartner,
    { ...game.player, player: true },
  ].sort((a, b) => a.y - b.y))
    person(p, p.player);
  for (const p of game.crowd)
    if (p.reaction && visiblePerson(p)) {
      rounded(p.x - 11, p.y - 38, 22, 22, 9, "#fff3e7");
      ctx.fillStyle = "#a64e32";
      ctx.font = "bold 17px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("!", p.x, p.y - 21);
    }
  ctx.restore();
  if (game.player.y > 580) {
    rounded(170, 12, 140, 28, 14, "#285d55");
    ctx.fillStyle = "#fff5d8";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("↑ 待つ人のもとへ", 240, 31);
  }
}

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  const hits = game.hits;
  audio.update(game.phase === "playing", input().left && input().right);
  const previousX = game.player.x;
  const steering = input();
  step(game, dt, steering);
  const movementDt = Math.max(0, Math.min(0.05, dt));
  playerPose = updatePlayerPose(
    playerPose,
    movementDt ? (game.player.x - previousX) / movementDt : 0,
    dt,
    reducedMotion.matches,
  );
  $("#left").classList.toggle("held", steering.left);
  $("#right").classList.toggle("held", steering.right);
  $("#motion").textContent =
    steering.left && steering.right
      ? "ブレーキ · 停止中"
      : steering.left
        ? "← 左へよける"
        : steering.right
          ? "右へよける →"
          : "自動で前進 · 両押しで停止";
  if (game.hits > hits) {
    audio.effect("contact");
    noticeUntil = now + 950;
    $("#notice").textContent = "おっと！ +2秒";
  }
  $("#notice").classList.toggle(
    "active",
    game.phase === "playing" && now < noticeUntil,
  );
  $("#time").innerHTML = `${game.elapsed.toFixed(1)}<span>秒</span>`;
  $("#hits").innerHTML = `${game.hits}<span>回</span>`;
  $("#distance").innerHTML =
    `${Math.round(Math.max(0, Math.min(100, ((game.player.y - 85) / 540) * 100)))}<span>%</span>`;
  if (game.phase === "finished" && overlay.hidden) {
    audio.effect("goal");
    clearInput();
    pause.disabled = true;
    records[game.stage] = { time: game.elapsed, hits: game.hits };
    $("#share-actions").hidden = game.stage !== 4;
    panel(
      game.stage === 4 ? "全5ステージを踏破！" : game.scene.arrival,
      `${game.stage === 4 ? `合計 ${records.reduce((s, r) => s + r.time, 0).toFixed(1)}秒 / 接触 ${records.reduce((s, r) => s + r.hits, 0)}回。最終ステージ：` : ""}待ち合わせ場所に到着。タイム ${game.elapsed.toFixed(1)}秒（接触の加算を含む） / 接触 ${game.hits}回。${game.hits === 0 ? "見事な雑踏突破でした。" : "すきまを読むほど、早く到着できます。"}`,
      game.stage < 4 ? "次のステージへ →" : "最初からもう一度 →",
      `STAGE ${game.stage + 1} COMPLETE`,
    );
  }
  draw();
  const callout = $("#goal-callout"),
    rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / W, rect.height / H),
    ox = (rect.width - W * scale) / 2,
    oy = (rect.height - H * scale) / 2;
  const px = ox + (game.meetingPartner.x + 240 - game.player.x) * scale,
    py = oy + (game.meetingPartner.y + 560 - game.player.y) * scale;
  callout.hidden = game.phase !== "playing" || game.player.y > 500 || py < 55;
  if (!callout.hidden) {
    const width = callout.offsetWidth,
      height = callout.offsetHeight,
      left = Math.max(10, Math.min(rect.width - width - 10, px - width / 2));
    callout.style.left = `${left}px`;
    callout.style.top = `${Math.max(8, py - height - 24 * scale)}px`;
    callout.style.setProperty(
      "--tail",
      `${Math.max(10, Math.min(width - 10, px - left))}px`,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$("#share").addEventListener("click", async () => {
  if (game.phase !== "finished" || game.stage !== 4) return;
  try {
    $("#share-status").textContent = await shareResult(records, canvas);
  } catch (e) {
    $("#share-status").textContent = e.message;
  }
});
$("#copy-result").addEventListener("click", async () => {
  if (game.phase !== "finished" || game.stage !== 4) return;
  try {
    await navigator.clipboard.writeText(resultText(records));
    $("#share-status").textContent = "結果の文章をコピーしました";
  } catch {
    $("#share-status").textContent = resultText(records);
  }
});
