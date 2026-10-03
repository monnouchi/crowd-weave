import { floorDetails, concert, rainShelters } from "./art.js";
import { TiltState, tiltPermission } from "./tilt.js";
import { shareResult, resultText, resultTotals } from "./share.js";
import { GameAudio } from "./sound.js";
import {
  updatePlayerPose,
  createWalkingPose,
  updateWalkingPose,
} from "./pose.js";
import { drawCharacter } from "./character.js";
import { GAME_NAME, PAGE_TITLE } from "./branding.js";
import { createGame, step, W, H, GOAL, STAGES, SCENES } from "./logic.js";
import { visiblePerson } from "./crowd.js";
import { TwoButtons, EnterLatch, primaryCommand } from "./input.js";
const CAMERA_Y = 500;
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d"),
  overlay = document.querySelector("#overlay"),
  action = document.querySelector("#action"),
  pause = document.querySelector("#pause");
let renderRatio = 1;
function resizeDrawingSurface() {
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  if (
    ratio === renderRatio &&
    canvas.width === Math.round(W * ratio) &&
    canvas.height === Math.round(H * ratio)
  )
    return;
  renderRatio = ratio;
  canvas.width = Math.round(W * ratio);
  canvas.height = Math.round(H * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
resizeDrawingSurface();
window.addEventListener("resize", resizeDrawingSurface);
let game = createGame(),
  last = performance.now(),
  buttons = new TwoButtons(),
  noticeUntil = 0,
  records = [],
  playerPose = { lean: 0 };
const walkingPoses = new Map();
let visualDt = 0;
const tilt = new TiltState();
let steeringMode = "buttons",
  tiltWaitingUntil = 0,
  tiltRequest = 0;
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
  tilt.reset();
  if (steeringMode === "tilt") tiltWaitingUntil = performance.now() + 3000;
}
function panel(title, message, button, label = "CROWD WEAVE") {
  overlay.hidden = false;
  overlay.classList.toggle("paused", game.phase === "paused");
  overlay.classList.remove("initial");
  overlay.classList.toggle(
    "finale",
    game.phase === "finished" && game.stage === 4,
  );
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
  $("#start-sound").hidden = true;
  $("#sound").disabled = false;
  $("#restart").disabled = false;
  $("#next-purpose").hidden = true;
  clearInput();
  if (stage === 0) records = [];
  game = createGame(stage);
  $("main").classList.toggle("with-traffic", !!game.traffic);
  playerPose = { lean: 0 };
  walkingPoses.clear();
  $("#goal-callout").textContent = game.scene.bubble;
  $("#scene-purpose").textContent = game.traffic
    ? `${game.scene.weather ? "雨の" : ""}${game.scene.place}へ · 赤は両押しで停止`
    : game.scene.purpose;
  $("#scene-label").textContent =
    `${["HOME", "STATION", "CAFÉ", "VENUE", "LIVE"][stage]} / 0${stage + 1}`;
  $("#stage").textContent = `STAGE ${stage + 1} / 5 · ${STAGES[stage].name}`;
  game.phase = "playing";
  overlay.hidden = true;
  overlay.classList.remove("finale", "initial", "paused");
  pause.disabled = false;
  last = performance.now();
  $("#notice").textContent = "";
  $("#notice").classList.remove("companion");
  noticeUntil = 0;
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
function initialStart(withSound) {
  audio.muted = !withSound;
  if (withSound) audio.unlock();
  else audio.suspend();
  $("#sound").textContent = withSound ? "音：ON" : "音：OFF";
  $("#sound").setAttribute("aria-pressed", String(!withSound));
  start();
}
$("#start-sound").addEventListener("click", () => {
  if (game.phase === "ready") initialStart(true);
});
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
  else if (command === "start") initialStart(false);
  else if (command === "retry") start();
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
    ) {
      if (game.phase === "ready" && e.target === $("#start-sound"))
        initialStart(true);
      else activatePrimary();
    }
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
for (const surface of document.querySelectorAll(
  "#game, .steering, #brake, #goal-callout, .stats, .party-strip, #notice, #traffic-status",
))
  for (const event of ["contextmenu", "selectstart", "dragstart"])
    surface.addEventListener(event, (e) => e.preventDefault());
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
  const keys = buttons.read();
  if (steeringMode !== "tilt") return keys;
  const sensor = tilt.read(performance.now());
  if (tilt.brakes.size) return { left: true, right: true, axis: 0 };
  if (keys.left || keys.right) return keys;
  return sensor.stale ? { left: true, right: true, axis: 0 } : sensor;
}
function chooseMode(mode, message) {
  steeringMode = mode;
  clearInput();
  $("#mode-buttons").setAttribute("aria-pressed", String(mode === "buttons"));
  $("#mode-tilt").setAttribute("aria-pressed", String(mode === "tilt"));
  $("#tilt-controls").hidden = mode !== "tilt";
  $("#tilt-status").textContent = message;
  if (game.phase === "paused")
    $("#message").textContent =
      message + " 時計は止まっています。準備ができたら再開してください。";
}
$("#mode-buttons").addEventListener("click", () => {
  tiltRequest++;
  chooseMode("buttons", "左右ボタンで操作します");
});
$("#mode-tilt").addEventListener("click", async () => {
  const request = ++tiltRequest;
  setPaused();
  $("#tilt-status").textContent = "傾き操作の利用を確認しています…";
  const permission = await tiltPermission();
  if (request !== tiltRequest) return;
  chooseMode(
    permission === "granted" ? "tilt" : "buttons",
    permission === "granted"
      ? "スマホを楽に持って、その姿勢を正面にします。左右に傾けて移動。"
      : "傾き操作を利用できません。左右ボタンで遊べます。",
  );
});
window.addEventListener("deviceorientation", (e) => {
  if (steeringMode !== "tilt" || document.hidden) return;
  tilt.sample(
    e.beta,
    e.gamma,
    screen.orientation?.angle ?? window.orientation ?? 0,
    performance.now(),
  );
});
window.addEventListener("orientationchange", () => {
  if (steeringMode === "tilt") {
    setPaused();
    clearInput();
    $("#tilt-status").textContent =
      "向きが変わりました。楽な姿勢で正面合わせをして再開してください。";
  }
});
screen.orientation?.addEventListener("change", () => {
  if (steeringMode === "tilt") {
    setPaused();
    clearInput();
  }
});
$("#recenter").addEventListener("click", () => {
  tilt.recenter();
  $("#tilt-status").textContent = "今の姿勢を正面にしました";
});
$("#brake").addEventListener("pointerdown", (e) => {
  if (game.phase !== "playing" || steeringMode !== "tilt") return;
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  tilt.brakes.add(e.pointerId);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("#brake").addEventListener(event, (e) => tilt.brakes.delete(e.pointerId));

function rounded(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function person(p, player = false) {
  const key = player
    ? "self"
    : p.friend
      ? `friend:${p.id}`
      : p.partner
        ? "meeting"
        : p.id !== undefined
          ? `crowd:${p.id}`
          : p.visualKey || `scenery:${p.x}:${p.y}`;
  const heading = {
    x: p.vx || p.ux || 0,
    y: p.vy || p.uy || (player ? -1 : 0),
  };
  const previous = walkingPoses.get(key);
  const reset = !previous || previous.cycle !== p.cycle;
  const old = reset ? createWalkingPose(p, heading) : previous;
  const canMove =
    game.phase === "playing" &&
    !p.partner &&
    !p.reaction &&
    (!(player || p.friend) || !game.stun);
  const look = p.reaction
    ? { x: p.reaction.faceX, y: p.reaction.faceY }
    : p.partner || p.state === "celebrating"
      ? { x: p.ux || 0, y: p.uy || -1 }
      : null;
  const pose = updateWalkingPose(old, p, visualDt, { canMove, look, reset });
  walkingPoses.set(key, { ...pose, cycle: p.cycle });
  let opacity =
    p.partner || p.background || p.friend || player
      ? 1
      : Math.min(
          1,
          (p.x - 18) / 18,
          (462 - p.x) / 18,
          (p.y - 110) / 20,
          (670 - p.y) / 20,
        );
  if (
    player &&
    game.cooldown > 0 &&
    !reducedMotion.matches &&
    Math.floor(game.cooldown * 9) % 2
  )
    opacity = 0.45;
  drawCharacter(ctx, p, {
    pose,
    player,
    lean: player ? playerPose.lean : 0,
    reducedMotion: reducedMotion.matches,
    opacity,
    waving: p.partner,
    wave: Math.sin(game.worldTime * 3) * 2,
  });
}
function destination(scene) {
  ctx.textAlign = "center";
  ctx.font = "11px system-ui";
  if (scene.landmark === "cafe") {
    rounded(130, -150, 220, 150, 10, "#d7c6a3");
    rounded(150, -137, 160, 18, 5, "#8b6e4e");
    ctx.fillStyle = "#fff4dc";
    ctx.fillText("COFFEE / 駅カフェ", 230, -124);
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
  } else if (scene.landmark === "station") {
    rounded(100, -120, 280, 25, 4, "#426c65");
    ctx.fillStyle = "#fff4dc";
    ctx.fillText("最寄り駅 / STATION", 240, -103);
    for (let x = 135; x < 370; x += 60) {
      rounded(x, -80, 25, 80, 5, "#839a8c");
      rounded(x + 6, -70, 13, 12, 3, "#c2e3cc");
    }
  } else if (scene.landmark === "home") {
    for (const x of [110, 285]) {
      rounded(x, -150, 85, 125, 5, "#d8c5a3");
      ctx.fillStyle = "#9e7961";
      ctx.beginPath();
      ctx.moveTo(x - 10, -150);
      ctx.lineTo(x + 43, -194);
      ctx.lineTo(x + 95, -150);
      ctx.fill();
      rounded(x + 12, -130, 22, 24, 2, "#b5d2cf");
      rounded(x + 50, -130, 22, 24, 2, "#b5d2cf");
      rounded(x + 33, -70, 24, 45, 2, "#927858");
    }
    ctx.fillStyle = "#55796c";
    ctx.fillText("住宅街 / 駅へ →", 240, -7);
  } else if (scene.landmark === "venue") {
    rounded(115, -175, 250, 150, 8, "#7d858e");
    rounded(130, -160, 220, 28, 4, "#b17d71");
    ctx.fillStyle = "#fff4dc";
    ctx.font = "bold 13px system-ui";
    ctx.fillText("LIVE / 今夜のパーティー", 240, -140);
    rounded(205, -110, 70, 85, 4, "#c6d4c6");
    rounded(135, -100, 45, 60, 3, "#aab8b3");
    ctx.fillStyle = "#285d55";
    ctx.font = "10px system-ui";
    ctx.fillText("受付", 157, -67);
    ctx.fillText("会場入口", 240, -4);
  } else if (scene.landmark === "party") {
    rounded(85, -195, 310, 150, 8, "#706984");
    rounded(105, -180, 270, 95, 6, "#403b58");
    ctx.fillStyle = "#ddc1e2";
    ctx.font = "bold 22px system-ui";
    ctx.fillText("LIVE PARTY", 240, -142);
    ctx.fillStyle = "#e4c994";
    for (const x of [135, 240, 345]) {
      ctx.beginPath();
      ctx.arc(x, -174, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    rounded(125, -100, 28, 46, 3, "#333449");
    rounded(327, -100, 28, 46, 3, "#333449");
    ctx.fillStyle = "#b5a6c9";
    ctx.fillText("♪", 225, -96);
    ctx.font = "10px system-ui";
    if (game.phase !== "finished")
      ctx.fillText("ステージ / 前方エリア", 240, -25);
    concert(ctx, {
      time: game.worldTime,
      reducedMotion: reducedMotion.matches,
      complete: game.phase === "finished",
    });
  }
}
function drawTraffic() {
  const t = game.traffic;
  if (!t) return;
  ctx.fillStyle = "#66777a";
  ctx.fillRect(0, t.top, W, t.bottom - t.top);
  ctx.fillStyle = "#b7c3bc";
  ctx.fillRect(0, t.top - 5, W, 5);
  ctx.fillRect(0, t.bottom, W, 5);
  ctx.fillStyle = "#e9eddf";
  for (let y = t.top + 6; y < t.bottom - 3; y += 11)
    ctx.fillRect(t.left, y, t.right - t.left, 7);
  ctx.fillStyle = "#d7c483";
  for (let x = 10; x < W; x += 40)
    if (x < t.left - 25 || x > t.right + 5) ctx.fillRect(x, 331, 24, 2);
  ctx.fillStyle = "#173f48";
  ctx.fillRect(t.left, t.bottom + 11, t.right - t.left, 6);
  ctx.fillStyle = "#fff";
  ctx.fillRect(t.left, t.bottom + 12, t.right - t.left, 3);
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("停止線 · 赤は両押しで待つ", 240, t.bottom + 42);
  for (const [x, y] of [
    [100, t.bottom + 50],
    [380, t.top - 50],
  ]) {
    const green = t.nominalGreen,
      proceed = t.canEnter || t.reserved;
    rounded(x - 22, y - 45, 44, 90, 7, "#0d1c25");
    ctx.strokeStyle = "#f9fcf5";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 19, y - 42, 38, 84);
    for (const [dy, lit, color] of [
      [-24, !green, "#ff4356"],
      [8, green, "#2df4b7"],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y + dy, 14, 0, Math.PI * 2);
      ctx.fillStyle = lit ? color : "#26333d";
      ctx.fill();
      if (!lit) continue;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle = "#0a1820";
      if (proceed && green) {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + dy + 7);
        ctx.lineTo(x, y + dy - 7);
        ctx.moveTo(x - 5, y + dy - 2);
        ctx.lineTo(x, y + dy - 7);
        ctx.lineTo(x + 5, y + dy - 2);
        ctx.stroke();
      } else ctx.fillRect(x - 5, y + dy - 5, 10, 10);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui";
    ctx.font = `bold ${t.reserved ? 11 : 13}px system-ui`;
    ctx.fillText(t.reserved ? "横断中" : proceed ? "進む" : "待つ", x, y + 37);
  }
  const v = t.vehicle;
  if (!v.active || v.x < -50 || v.x > 530) return;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.scale(v.direction, 1);
  ctx.fillStyle = "#233e3b25";
  ctx.beginPath();
  ctx.ellipse(0, 8, v.width / 2 + 4, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (v.kind === "car") {
    for (const x of [-18, 18]) {
      rounded(x - 5, -18, 10, 8, 2, "#2f4346");
      rounded(x - 5, 10, 10, 8, 2, "#2f4346");
    }
    rounded(-29, -15, 58, 30, 8, "#bf8763");
    rounded(-12, -12, 27, 24, 5, "#e1c3a0");
    rounded(8, -10, 6, 20, 2, "#b8d4ce");
    rounded(-9, -10, 12, 20, 2, "#496e73");
    rounded(25, -10, 4, 6, 2, "#fff3bc");
    rounded(25, 4, 4, 6, 2, "#fff3bc");
  } else {
    ctx.strokeStyle = "#274e58";
    ctx.lineWidth = 3;
    for (const x of [-12, 12]) {
      ctx.beginPath();
      ctx.ellipse(x, 0, 5, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(0, -3);
    ctx.lineTo(12, 0);
    ctx.stroke();
    rounded(-6, -7, 13, 14, 5, "#8aab85");
    ctx.fillStyle = "#e9b89a";
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#486c71";
    ctx.beginPath();
    ctx.arc(7, 0, 5, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = "#274e58";
    ctx.beginPath();
    ctx.moveTo(10, -8);
    ctx.lineTo(10, 8);
    ctx.stroke();
  }
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#d4dfcf";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const finale = game.stage === 4 && game.phase === "finished";
  ctx.translate(240 - game.player.x, (finale ? 320 : CAMERA_Y) - game.player.y);
  ctx.fillStyle = game.scene.floor;
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
  floorDetails(ctx, game.scene);
  if (game.scene.weather === "rain")
    rainShelters(ctx, {
      time: game.worldTime,
      reducedMotion: reducedMotion.matches,
    });
  rounded(18, -500, 444, 55, 8, "#cbd7ca");
  ctx.fillStyle = "#285d55";
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    game.scene.environment === "residential"
      ? "住宅街 / 駅方面 →"
      : game.scene.environment === "party"
        ? "LIVE / パーティー会場"
        : game.scene.environment === "venue"
          ? "会場の最寄り駅 →"
          : "駅コンコース →",
    240,
    -470,
  );
  rounded(28, -230, 90, 35, 5, "#839781");
  rounded(350, -230, 90, 35, 5, "#839781");
  for (let i = 0; i < game.scene.backgroundCount; i++) {
    const y =
      -100 - ((i * 63 + game.worldTime * (i % 2 ? 20 : -18) + 1200) % 350);
    person({
      x: 75 + i * 64,
      y,
      r: 13,
      ux: 0,
      uy: i % 2 ? -1 : 1,
      visualKey: `background:${i}`,
      color: i % 4,
      state: "walking",
      walk: game.worldTime * (i % 2 ? 20 : 18),
      background: true,
    });
  }
  destination(game.scene);
  if (!finale) {
    rounded(GOAL.x, GOAL.y, GOAL.w, GOAL.h, 12, "#dbe7d4");
    rounded(GOAL.x, 5, GOAL.w, 22, 8, "#285d55");
    ctx.fillStyle = "#fff5d8";
    ctx.textAlign = "center";
    ctx.font = "bold 13px system-ui";
    ctx.fillText(game.scene.place, 240, 21);
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#55796c";
    ctx.fillText(
      game.scene.targetKind === "clerk" ? "GOAL / 忘れ物受取" : "GOAL / 合流",
      240,
      82,
    );
    ctx.fillStyle = "#55796c";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${game.scene.place} ↑`, 240, 108);
  }
  if (game.scene.environment === "cafe") {
    rounded(44, 178, 38, 5, 2, "#839781");
    rounded(398, 178, 38, 5, 2, "#839781");
    ctx.font = "9px system-ui";
    ctx.fillText("待合席", 63, 194);
    ctx.fillText("待合席", 417, 194);
  }
  if (game.stage < 2) {
    for (const [x, y] of [
      [0, 150],
      [438, 350],
    ]) {
      rounded(x, y, 42, 75, 4, "#d7c5a7");
      rounded(x + 8, y + 12, 12, 18, 2, "#b8d2ce");
      rounded(x + 25, y + 12, 12, 18, 2, "#b8d2ce");
    }
  }
  rounded(18, 180, 24, 100, 5, "#cbd7ca");
  rounded(438, 380, 24, 100, 5, "#cbd7ca");
  ctx.fillStyle = "#55796c";
  ctx.save();
  ctx.translate(33, 230);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(
    game.stage < 2
      ? "商店街"
      : game.scene.environment === "party"
        ? "ドリンク"
        : game.scene.environment === "venue"
          ? "会場最寄り駅"
          : "1・2番ホーム",
    0,
    0,
  );
  ctx.restore();
  ctx.save();
  ctx.translate(449, 430);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(
    game.stage < 2
      ? "公園・バス停"
      : game.scene.environment === "party"
        ? "ロビー"
        : game.scene.environment === "venue"
          ? "会場入口"
          : "3・4番ホーム",
    0,
    0,
  );
  ctx.restore();
  const facilityY = game.traffic ? 145 : 340,
    boardY = game.traffic ? 153 : 298;
  rounded(397, facilityY, 40, 16, 4, "#67836f");
  ctx.fillStyle = "#fff";
  ctx.font = "9px system-ui";
  ctx.fillText(
    game.scene.environment === "residential" ? "花壇" : "トイレ",
    417,
    facilityY + 11,
  );
  ctx.fillStyle = "#55796c";
  rounded(43, boardY, 40, 8, 3, "#67836f");
  if (!game.traffic) rounded(397, boardY, 40, 8, 3, "#67836f");
  ctx.font = "9px system-ui";
  ctx.fillText("案内板", 63, boardY - 4);
  if (!game.traffic) ctx.fillText("案内板", 417, boardY - 4);
  rounded(96, 474, 28, 12, 3, "#d6b579");
  ctx.font = "8px system-ui";
  ctx.fillText(
    game.scene.environment === "residential"
      ? "街のお知らせ"
      : game.scene.environment === "station" ||
          game.scene.environment === "cafe"
        ? "駅の絵"
        : "公演ポスター",
    110,
    482,
  );
  rounded(44, 532, 38, 5, 2, "#839781");
  ctx.fillText(
    game.scene.environment === "residential" ? "ベンチ" : "待合",
    63,
    548,
  );
  rounded(398, 532, 38, 5, 2, "#839781");
  ctx.fillText("待合", 417, 548);
  ctx.fillText(
    game.stage === 0
      ? "自宅 / 出発"
      : game.scene.environment === "party"
        ? "会場入口"
        : game.stage === 3
          ? "会場最寄り駅の改札"
          : "START",
    240,
    650,
  );
  ctx.fillStyle = "#759081";
  ctx.font = "11px system-ui";
  ctx.fillText("START", 240, 662);
  drawTraffic();
  const displayMembers = finale
    ? game.party.members.map((m, i) => ({
        ...m,
        x: 180 + i * 40,
        y: -43,
        state: "celebrating",
        ux: 0,
        uy: -1,
        flash: 0,
        docking: false,
      }))
    : game.party.members;
  const displayPartner = finale
    ? {
        ...game.meetingPartner,
        x: 340,
        y: -43,
        ux: 0,
        uy: -1,
        state: "celebrating",
      }
    : game.meetingPartner;
  const displayPlayer = finale
    ? {
        ...game.player,
        x: 140,
        y: -43,
        player: true,
        state: "celebrating",
        ux: 0,
        uy: -1,
      }
    : { ...game.player, player: true };
  if (game.party.members.length && !finale) {
    ctx.save();
    ctx.strokeStyle = "#477f775c";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    const trail = game.party.trail.filter(
      (p) => p.s >= Math.min(...game.party.members.map((m) => m.s)) - 1,
    );
    trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }
  for (const p of [
    ...game.crowd.filter(visiblePerson),
    ...displayMembers,
    displayPartner,
    displayPlayer,
  ].sort((a, b) => a.y - b.y))
    person(p, p.player);
  if (!finale && game.cooldown > 0 && game.lastContactMember === 0) {
    ctx.strokeStyle = "#d37a46";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const m of displayMembers) {
    ctx.save();
    ctx.fillStyle = m.flash > 0 ? "#b65b39" : "#245c56";
    ctx.beginPath();
    ctx.arc(
      m.x + (m.docking && m.id % 2 ? -20 : 20),
      m.y - 7,
      7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(
      String(m.id),
      m.x + (m.docking && m.id % 2 ? -20 : 20),
      m.y - 3,
    );
    if (m.flash > 0) {
      ctx.strokeStyle = "#d37a46";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
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
    ctx.fillText(`↑ ${game.scene.place}`, 240, 31);
  }
}

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (
    steeringMode === "tilt" &&
    tilt.read(now).stale &&
    now > tiltWaitingUntil
  ) {
    setPaused();
    chooseMode(
      "buttons",
      "センサーの値を受け取れません。左右ボタンに戻しました。準備ができたら再開してください。",
    );
  }
  const hits = game.hits;
  const violations = game.traffic?.violations || 0;
  audio.update(
    game.phase === "playing",
    input().left && input().right,
    game.stage,
  );
  const previousX = game.player.x;
  const previousRegroup = game.party.regroup;
  const steering = input();
  step(game, dt, steering);
  if (game.party.regroup < 0.1) game.party.chimed = false;
  if (
    game.party.members.length &&
    previousRegroup < 0.95 &&
    game.party.regroup >= 0.95 &&
    !game.party.chimed
  ) {
    game.party.chimed = true;
    if (game.hits === hits) {
      audio.effect("regroup");
      noticeUntil = now + 1000;
      $("#notice").textContent = "隊列が整った！";
    }
  }
  const movementDt = Math.max(0, Math.min(0.05, dt));
  visualDt = movementDt;
  playerPose = updatePlayerPose(
    playerPose,
    movementDt ? (game.player.x - previousX) / movementDt : 0,
    dt,
    reducedMotion.matches,
  );
  $("#left").classList.toggle("held", steering.left);
  $("#right").classList.toggle("held", steering.right);
  $("#motion").textContent =
    game.phase === "finished"
      ? "全員到着 · 次へ進めます"
      : game.phase === "paused"
        ? "一時停止 · 時計も停止中"
        : game.arriving
          ? "合流中 · 仲間の到着を待っています"
          : steering.left && steering.right
            ? game.party.members.length
              ? "ブレーキ · 仲間が隊列を整えます"
              : "ブレーキ · 停止中"
            : steering.left
              ? "← 左へよける"
              : steering.right
                ? "右へよける →"
                : "自動で前進 · 両押しで停止";
  const signal = $("#traffic-status");
  signal.hidden = !game.traffic;
  if (game.traffic) {
    const t = game.traffic;
    signal.className = !t.nominalGreen
      ? "red"
      : t.warning || !t.green
        ? "warning"
        : "green";
    signal.textContent = t.reserved
      ? "↑ 横断中 · 仲間全員が渡るまで車は待ちます"
      : t.canEnter
        ? `↑ 青 · 全員で渡れます（残り${t.remaining.toFixed(1)}秒）`
        : t.warning
          ? "■ もうすぐ赤 · 次の青まで待とう"
          : t.nominalGreen
            ? "■ 車の通過待ち · 両押しで待とう"
            : `■ 赤 · 両押しで停止（青まで${t.remaining.toFixed(1)}秒）`;
    if (t.violations > violations) {
      noticeUntil = now + 1800;
      const event = t.violationEvent;
      $("#notice").classList.toggle("companion", !!event.memberId);
      $("#notice").textContent = event.memberId
        ? `友だち${event.memberId}「${event.message}」 信号無視 +2秒`
        : "信号無視 +2秒 · 赤では両押しで待とう";
      audio.effect("contact");
    }
  }
  if (game.hits > hits) {
    audio.effect("contact");
    noticeUntil = now + 950;
    if (!game.traffic || game.traffic.violations === violations) {
      $("#notice").classList.remove("companion");
      $("#notice").textContent =
        `${game.lastContactMember ? "友だち" + game.lastContactMember : "自分"}が接触！ +2秒`;
    }
  }
  $("#notice").classList.toggle(
    "active",
    game.phase === "playing" && now < noticeUntil,
  );
  $("#party-count").textContent =
    `自分 + 仲間${game.party.members.length + (game.phase === "finished" ? 1 : 0)}人`;
  $("#party-roster").textContent =
    game.phase === "finished"
      ? [
          ...game.party.members.map((m) => `${m.id}✓`),
          `${game.stage + 1}（新）✓`,
        ].join(" · ")
      : game.party.members.length
        ? game.party.members
            .map((m) => `${m.id}${m.docked ? "✓" : ""}`)
            .join(" · ")
        : "ひとりで出発";
  $("#time").innerHTML = `${game.elapsed.toFixed(1)}<span>秒</span>`;
  $("#hits").innerHTML = `${game.hits}<span>回</span>`;
  $("#distance").innerHTML =
    `${Math.round(Math.max(0, Math.min(100, ((Math.max(game.player.y, ...game.party.members.map((m) => m.y)) - 84) / (541 + game.party.members.length * 30)) * 100)))}<span>%</span>`;
  if (game.phase === "finished" && overlay.hidden) {
    audio.goal(game.stage, game);
    clearInput();
    pause.disabled = true;
    records[game.stage] = {
      time: game.elapsed,
      hits: game.hits,
      violations: game.traffic?.violations || 0,
    };
    const totals = resultTotals(records);
    const cleanStage = game.hits === 0 && !game.traffic?.violations;
    $("#share-actions").hidden = game.stage !== 4;
    if (game.stage < 4)
      $("#next-purpose").textContent =
        `次の目的：${SCENES[game.stage + 1].intro}` +
        ([0, 2].includes(game.stage)
          ? " 赤は両押しで待とう。赤で横断開始は信号無視 +2秒。"
          : "");
    $("#next-purpose").hidden = game.stage === 4;
    panel(
      game.stage === 4 ? "仲間全員、ライブ最前列へ！" : game.scene.arrival,
      game.stage === 4
        ? `全5区間を完走。合計 ${totals.time.toFixed(1)}秒 / 接触 ${totals.hits}回 / 信号無視 ${totals.violations}回。${totals.clean ? "すきまの名案内！ 全員が一度も接触せず到着しました。" : "みんなで最前列！ 次は全員で接触ゼロに挑戦しよう。"}`
        : `友だち${game.stage + 1}と合流し、仲間が${game.stage + 1}人になりました。タイム ${game.elapsed.toFixed(1)}秒（加算を含む） / 接触 ${game.hits}回${game.traffic ? ` / 信号無視 ${game.traffic.violations}回` : ""}。${cleanStage ? "この区間は全員、無接触！" : "全員到着！ 次は接触ゼロを目指そう。"}`,
      game.stage < 4 ? "次のステージへ →" : "最初からもう一度 →",
      `STAGE ${game.stage + 1} COMPLETE`,
    );
  }
  draw();
  $("#goal-callout").textContent =
    game.arriving && game.phase !== "finished"
      ? "仲間全員を待とう！"
      : game.scene.bubble;
  const callout = $("#goal-callout"),
    rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / W, rect.height / H),
    ox = (rect.width - W * scale) / 2,
    oy = (rect.height - H * scale) / 2;
  const px = ox + (game.meetingPartner.x + 240 - game.player.x) * scale,
    py = oy + (game.meetingPartner.y + CAMERA_Y - game.player.y) * scale;
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
