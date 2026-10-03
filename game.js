import { TiltState, tiltPermission } from "./tilt.js";
import { shareResult, resultText } from "./share.js";
import { GameAudio } from "./sound.js";
import { updatePlayerPose } from "./pose.js";
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
let game = createGame(),
  last = performance.now(),
  buttons = new TwoButtons(),
  noticeUntil = 0,
  records = [],
  playerPose = { lean: 0 };
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
  playerPose = { lean: 0 };
  $("#goal-callout").textContent = game.scene.bubble;
  $("#scene-purpose").textContent = game.scene.purpose;
  $("#scene-label").textContent =
    `${["HOME", "STATION", "CAFÉ", "VENUE", "LIVE"][stage]} / 0${stage + 1}`;
  $("#stage").textContent = `STAGE ${stage + 1} / 5 · ${STAGES[stage].name}`;
  game.phase = "playing";
  overlay.hidden = true;
  pause.disabled = false;
  last = performance.now();
  $("#notice").textContent = game.scene.intro;
  noticeUntil = performance.now() + 3500;
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
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.archetype === "curious-child") ctx.scale(0.8, 0.8);
  if (p.partner) ctx.scale(p.visualScale, p.visualScale);
  if (!player) {
    ctx.globalAlpha =
      p.partner || p.background || p.friend
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
      : p.reaction || !["walking", "following", "docking"].includes(p.state)
        ? 0
        : Math.sin(p.walk / 7 + (p.color ?? p.id ?? 0) * 1.7) * 1.6;
  rounded(-8, 9 + stride, 5, 8, 2, "#3b4b49");
  rounded(3, 9 - stride, 5, 8, 2, "#3b4b49");
  ctx.fillStyle = "#173d3c20";
  ctx.beginPath();
  ctx.ellipse(2, 9, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  if (
    player &&
    game.cooldown > 0 &&
    !reducedMotion.matches &&
    Math.floor(game.cooldown * 9) % 2
  ) {
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
      : p.partner || p.friend
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
  if (p.targetKind === "clerk") {
    rounded(-9, -16, 18, 5, 2, "#496c64");
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
    ctx.fillText("ステージ / 前方エリア", 240, -25);
  }
}
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#d4dfcf";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(240 - game.player.x, CAMERA_Y - game.player.y);
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
  destination(game.scene);
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
  rounded(397, 340, 40, 16, 4, "#67836f");
  ctx.fillStyle = "#fff";
  ctx.font = "9px system-ui";
  ctx.fillText(
    game.scene.environment === "residential" ? "花壇" : "トイレ",
    417,
    351,
  );
  ctx.fillStyle = "#55796c";
  rounded(43, 298, 40, 8, 3, "#67836f");
  rounded(397, 298, 40, 8, 3, "#67836f");
  ctx.font = "9px system-ui";
  ctx.fillText("案内板", 63, 294);
  ctx.fillText("案内板", 417, 294);
  rounded(96, 474, 28, 12, 3, "#d6b579");
  ctx.font = "8px system-ui";
  ctx.fillText(
    game.scene.environment === "station" || game.scene.environment === "cafe"
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
  if (game.party.members.length) {
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
    ...game.party.members,
    game.meetingPartner,
    { ...game.player, player: true },
  ].sort((a, b) => a.y - b.y))
    person(p, p.player);
  if (game.cooldown > 0 && game.lastContactMember === 0) {
    ctx.strokeStyle = "#d37a46";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(game.player.x, game.player.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const m of game.party.members) {
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
  playerPose = updatePlayerPose(
    playerPose,
    movementDt ? (game.player.x - previousX) / movementDt : 0,
    dt,
    reducedMotion.matches,
  );
  $("#left").classList.toggle("held", steering.left);
  $("#right").classList.toggle("held", steering.right);
  $("#motion").textContent = game.arriving
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
  if (game.hits > hits) {
    audio.effect("contact");
    noticeUntil = now + 950;
    $("#notice").textContent =
      `${game.lastContactMember ? "友だち" + game.lastContactMember : "自分"}が接触！ +2秒`;
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
    records[game.stage] = { time: game.elapsed, hits: game.hits };
    $("#share-actions").hidden = game.stage !== 4;
    if (game.stage < 4)
      $("#next-purpose").textContent =
        `次の目的：${SCENES[game.stage + 1].intro}`;
    $("#next-purpose").hidden = game.stage === 4;
    panel(
      game.stage === 4 ? "全5ステージを踏破！" : game.scene.arrival,
      `${game.stage === 4 ? "全員がステージ前に到着！ " : `友だち${game.stage + 1}と合流。仲間が${game.stage + 1}人になりました。 `}${game.stage === 4 ? `合計 ${records.reduce((s, r) => s + r.time, 0).toFixed(1)}秒 / 接触 ${records.reduce((s, r) => s + r.hits, 0)}回。最終ステージ：` : ""}${game.scene.arrival} タイム ${game.elapsed.toFixed(1)}秒（接触の加算を含む） / 接触 ${game.hits}回。${game.hits === 0 ? "見事な雑踏突破でした。" : "すきまを読むほど、早く到着できます。"}`,
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
