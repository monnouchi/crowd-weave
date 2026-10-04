import {
  floorDetails,
  concert,
  rainShelters,
  venueJourney,
  hallInterior,
  goalBoundary,
} from "./art.js";
import { TiltState, tiltPermission } from "./tilt.js";
import { shareResult, resultText, resultTotals } from "./share.js";
import { GameAudio } from "./sound.js";
import {
  updatePlayerPose,
  createWalkingPose,
  updateWalkingPose,
} from "./pose.js";
import { drawCharacter, placeSpeech } from "./character.js";
import { GAME_NAME, PAGE_TITLE } from "./branding.js";
import {
  createGame,
  step,
  W,
  H,
  GOAL,
  advanceAudienceAmbience,
  nextRunSeed,
  seedForRun,
  joiningFriend,
  advanceJoining,
  STAGES,
  SCENES,
} from "./logic.js";
import { trafficViolations } from "./traffic.js";
import { visiblePerson } from "./crowd.js";
import {
  TwoButtons,
  EnterLatch,
  primaryCommand,
  bindPointerControls,
} from "./input.js";
const CAMERA_Y = 500;
const canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d"),
  overlay = document.querySelector("#overlay"),
  action = document.querySelector("#action"),
  pause = document.querySelector("#pause");
let renderRatio = 1;
let projection = { scale: 1, ox: 0, oy: 0, width: W, height: H };
function resizeDrawingSurface() {
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
    rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width * ratio),
    height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  renderRatio = ratio;
  const compactFinal =
    overlay.classList.contains("finale") &&
    (rect.width < 600 || (rect.height <= 500 && rect.width <= 950));
  if (compactFinal) {
    // Fit the entire stage-to-front-row composition above the collapsed result.
    const card = document.querySelector(".card");
    const summary = card.querySelector(".start-actions");
    const summaryBottom = summary.getBoundingClientRect().bottom;
    const cardTop = card.getBoundingClientRect().top;
    const collapsedHeight = summaryBottom - cardTop + 12;
    const availableBottom =
      rect.height -
      Math.max(12, rect.height - card.getBoundingClientRect().bottom) -
      collapsedHeight -
      12;
    const top = Math.max(
      12,
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--result-safe-top",
        ),
      ) || 0,
    );
    const sceneHeight = 430;
    const scale = Math.min(
      (rect.width - 24) / W,
      Math.max(1, availableBottom - top) / sceneHeight,
    );
    projection = {
      scale,
      ox: rect.width / 2 - 240 * scale,
      oy: top,
      width: rect.width,
      height: rect.height,
      finalCameraY: game.player.y + 220,
    };
    return;
  }
  const portrait = rect.width < 600 && rect.height > rect.width;
  const top = portrait
    ? document.querySelector(".hud").getBoundingClientRect().bottom + 8
    : 0;
  const bottomControls = [
    ...document.querySelectorAll(
      ".toolbar,.steering,.settings summary,#tilt-controls:not([hidden])",
    ),
  ];
  const bottom = portrait
    ? rect.height -
      Math.min(
        ...bottomControls.map((element) => element.getBoundingClientRect().top),
      ) +
      8
    : 0;
  const usableWidth = portrait
    ? rect.width
    : Math.max(160, rect.width - (rect.height <= 500 ? 360 : 470));
  const scale = Math.min(
    usableWidth / W,
    Math.max(1, rect.height - top - bottom) / H,
  );
  projection = {
    scale,
    ox: rect.width / 2 - 240 * scale,
    oy: top + Math.max(0, (rect.height - top - bottom - H * scale) / 2),
    width: rect.width,
    height: rect.height,
  };
}
resizeDrawingSurface();
window.addEventListener("resize", resizeDrawingSurface);
window.visualViewport?.addEventListener("resize", resizeDrawingSurface);
let game = createGame(),
  last = performance.now(),
  buttons = new TwoButtons(),
  noticeUntil = 0,
  records = [],
  playerPose = { lean: 0 };
const walkingPoses = new Map();
let visualDt = 0;
let companionSpeech = null;
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
const compactResult = window.matchMedia(
  "(max-width: 599px), (max-height: 500px) and (max-width: 950px)",
);
const fixedSeedText = new URLSearchParams(location.search).get("seed");
const fixedRunSeed =
  fixedSeedText !== null &&
  /^\d{1,10}$/.test(fixedSeedText) &&
  Number(fixedSeedText) <= 0xffffffff
    ? Number(fixedSeedText)
    : null;
let runSeed;
function chooseRunSeed() {
  if (fixedRunSeed !== null) return fixedRunSeed;
  const entropy = new Uint32Array(1);
  crypto.getRandomValues(entropy);
  return nextRunSeed(runSeed, entropy[0]);
}
function showResultDetails(open) {
  $("#result-details").hidden = !open;
  $("#result-toggle").setAttribute("aria-expanded", String(open));
  $("#result-toggle").textContent = open ? "詳細を閉じる" : "詳細・共有";
  overlay.classList.toggle("result-expanded", open && compactResult.matches);
}
$("#result-toggle").addEventListener("click", () =>
  showResultDetails($("#result-details").hidden),
);
$("#close-result-details").addEventListener("click", () => {
  showResultDetails(false);
  $("#result-toggle").focus({ preventScroll: true });
});
compactResult.addEventListener("change", () => {
  if (game.stage === 4 && game.phase === "finished")
    showResultDetails(!compactResult.matches);
});
function clearInput() {
  pointerControls.clear();
  buttons.clear();
  tilt.reset();
  if (steeringMode === "tilt") tiltWaitingUntil = performance.now() + 3000;
}
function panel(title, message, button, label = "CROWD WEAVE") {
  overlay.hidden = false;
  $("#result-score").hidden = game.phase !== "finished";
  overlay.classList.toggle("paused", game.phase === "paused");
  overlay.classList.remove("initial");
  overlay.classList.toggle(
    "finale",
    game.phase === "finished" && game.stage === 4,
  );
  $("#title").textContent = title;
  $("#message").textContent = message;
  $("#result-detail-message").textContent = message;
  const final = game.phase === "finished" && game.stage === 4;
  $("#result-toggle").hidden = !final;
  showResultDetails(final && !compactResult.matches);
  $("#result-party").hidden = game.phase !== "finished";
  if (final) $("#result-details").prepend($("#result-party"));
  else $(".card").insertBefore($("#result-party"), $("#next-purpose"));
  if (game.phase === "finished") {
    const count = game.party.members.length + (game.stage < 4 ? 1 : 0);
    $("#result-party-label").textContent =
      game.stage < 4
        ? `仲間が1人増えた！ 自分＋仲間${count}人`
        : `自分＋仲間${count}人・全員到着`;
    $("#result-roster").setAttribute(
      "aria-label",
      `自分と友だち${Array.from({ length: count }, (_, i) => i + 1).join("、友だち")}${game.stage < 4 ? `。友だち${count}が新しく合流` : "。全員到着"}`,
    );
  }
  action.textContent = button;
  $("#label").textContent = label;
  $("#enter-hint").textContent =
    game.phase === "gameover"
      ? "Enter でこの区間を再挑戦"
      : game.phase === "paused"
        ? "Enter で再開"
        : game.phase === "finished" && game.stage < 4
          ? "Enter で次のステージへ"
          : game.phase === "finished"
            ? "Enter で最初から再挑戦"
            : "Enter で開始";
  action.focus({ preventScroll: true });
}
function start(stage = 0) {
  $("#result-score").hidden = true;
  $("#share-actions").hidden = true;
  $("#result-toggle").hidden = true;
  $("#result-party").hidden = true;
  showResultDetails(false);
  $("#start-sound").hidden = true;
  $("#sound").disabled = false;
  $("#restart").disabled = false;
  $("#next-purpose").hidden = true;
  clearInput();
  audio.reset();
  if (stage === 0) records = [];
  if (stage === 0 || runSeed === undefined) runSeed = chooseRunSeed();
  game = createGame(stage, seedForRun(runSeed, stage));
  game.runSeed = runSeed;
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
  noticeUntil = 0;
  companionSpeech = null;
  canvas.focus({ preventScroll: true });
}
function setPaused() {
  clearInput();
  audio.suspend();
  if (game.phase !== "playing") return;
  game.phase = "paused";
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
  else if (command === "retry-stage") start(game.stage);
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
    if (
      game.phase === "finished" &&
      e.target instanceof Element &&
      e.target.closest(
        "#result-toggle,#close-result-details,#share,#copy-result",
      )
    )
      return;
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
const pointerControls = bindPointerControls({
  controls: [
    [$("#left"), "left"],
    [$("#right"), "right"],
    [$("#brake"), "brake"],
  ],
  enabled: (side) =>
    game.phase === "playing" && (side !== "brake" || steeringMode === "tilt"),
  press: (id, side) =>
    side === "brake" ? tilt.brakes.add(id) : buttons.press(id, side),
  release: (id, side) =>
    side === "brake" ? tilt.brakes.delete(id) : buttons.release(id),
  interrupted: setPaused,
});
window.addEventListener("pagehide", setPaused);
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
        ? p.visualKey || "meeting"
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
    (game.phase === "playing" ||
      (game.phase === "finished" && !document.hidden)) &&
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
          (p.y - (p.environment === "party" ? 32 : 110)) / 20,
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
    contact: player && game.cooldown > 0 && game.lastContactMember === 0,
    lean: player ? playerPose.lean : 0,
    reducedMotion: reducedMotion.matches,
    opacity,
    waving: p.partner,
    wave: Math.sin((game.worldTime + (game.ambientTime || 0)) * 3) * 2,
    live: game.stage === 4,
    time: game.worldTime + (game.ambientTime || 0),
  });
}
function destination(scene) {
  ctx.textAlign = "center";
  ctx.font = "11px system-ui";
  if (scene.landmark === "cafe") {
    rounded(18, -155, 444, 170, 5, "#b7c2bc");
    rounded(130, -150, 220, 165, 10, "#d7c6a3");

    ctx.fillStyle = "#6b8579";
    ctx.font = "bold 11px system-ui";
    ctx.fillText("← 改札・出口 / 駅構内通路 / ホーム →", 240, 220);
    rounded(176, -30, 128, 50, 4, "#dfe9d8");
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
      time: game.worldTime + (game.ambientTime || 0),
      reducedMotion: reducedMotion.matches,
      complete: game.phase === "finished",
    });
  }
}
function drawTraffic(t) {
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
    if (x < t.left - 25 || x > t.right + 5)
      ctx.fillRect(x, (t.top + t.bottom) / 2, 24, 2);
  for (let lane = 1; lane < t.lanes; lane++) {
    ctx.strokeStyle = "#e5d394";
    ctx.lineWidth = lane === 2 ? 2 : 1;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    const laneY = t.top + (lane * (t.bottom - t.top)) / t.lanes;
    ctx.moveTo(0, laneY);
    ctx.lineTo(W, laneY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
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
    rounded(x - 3, y - 2, 6, 32, 2, "#58666c");
    rounded(x - 14, y - 52, 28, 51, 5, "#15222b");
    ctx.strokeStyle = "#a6b7bf";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 12, y - 50, 24, 47);
    for (const [dy, lit, color, walking] of [
      [-38, !green, "#ff526b", false],
      [-16, green, "#43f0b3", true],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y + dy, 9, 0, Math.PI * 2);
      ctx.fillStyle = lit ? color : "#303e49";
      ctx.fill();
      if (!lit) continue;
      ctx.fillStyle = ctx.strokeStyle = "#10202c";
      ctx.beginPath();
      ctx.arc(x, y + dy - 4, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y + dy - 1);
      ctx.lineTo(x, y + dy + 3);
      ctx.moveTo(x - 3, y + dy + 1);
      ctx.lineTo(x, y + dy);
      ctx.lineTo(x + 3, y + dy + (walking ? -1 : 1));
      ctx.moveTo(x - 2, y + dy + 6);
      ctx.lineTo(x, y + dy + 3);
      ctx.lineTo(x + 3, y + dy + (walking ? 5 : 6));
      ctx.stroke();
    }
    rounded(x - 26, y + 24, 52, 20, 4, proceed ? "#d4fff0" : "#ffe7ec");
    ctx.fillStyle = proceed ? "#075343" : "#802033";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(t.reserved ? "横断中" : proceed ? "進む" : "待つ", x, y + 38);
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
  resizeDrawingSurface();
  const { scale, ox, oy, width, height } = projection;
  ctx.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = game.stage === 4 ? "#37374d" : game.scene.floor;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const finale = game.stage === 4 && game.phase === "finished";
  ctx.translate(
    finale ? 0 : 240 - game.player.x,
    (finale ? (projection.finalCameraY ?? 320) : CAMERA_Y) - game.player.y,
  );
  // Outside the playable corridor: buildings, greenery or hall walls.
  const cameraY = finale ? (projection.finalCameraY ?? 320) : CAMERA_Y;
  const leftEdge =
    Math.floor((game.player.x - width / (2 * scale)) / 120) * 120;
  const rightEdge =
    Math.ceil((game.player.x + width / (2 * scale)) / 120) * 120;
  const topEdge =
    Math.floor((game.player.y - cameraY - oy / scale) / 150) * 150;
  const bottomEdge = topEdge + height / scale + 150;
  for (let x = leftEdge; x < rightEdge; x += 120) {
    if (x >= 0 && x < W) continue;
    for (let y = topEdge; y < bottomEdge; y += 150) {
      rounded(
        x + 10,
        y + 10,
        100,
        130,
        6,
        game.stage === 4 ? "#46455e" : game.stage === 3 ? "#889b9b" : "#c3ceb7",
      );
      rounded(
        x + 22,
        y + 25,
        30,
        34,
        3,
        game.stage === 4 ? "#6b607c" : "#e4e1cc",
      );
      rounded(
        x + 64,
        y + 25,
        30,
        34,
        3,
        game.stage === 4 ? "#6b607c" : "#d4e7e0",
      );
      rounded(
        x + 20,
        y + 90,
        76,
        12,
        3,
        game.stage === 4 ? "#57546f" : "#a7b693",
      );
    }
  }
  const shareX =
    (ox + (finale ? 0 : 60 + 240 - game.player.x) * scale) * renderRatio;
  const shareY =
    (oy +
      (-195 +
        (finale ? (projection.finalCameraY ?? 320) : CAMERA_Y) -
        game.player.y) *
        scale) *
    renderRatio;
  canvas.weaveResultRegion = {
    x: shareX,
    y: shareY,
    width: (finale ? 480 : 360) * scale * renderRatio,
    height: (finale ? 390 : 258) * scale * renderRatio,
  };
  ctx.fillStyle = game.scene.floor;
  ctx.fillRect(0, -800, W, H + 1000);
  ctx.fillStyle = "#d4dfcf";
  ctx.fillRect(0, 0, 18, game.worldHeight);
  ctx.fillRect(W - 18, 0, 18, game.worldHeight);
  for (let y = -655; y < game.worldHeight; y += 40) {
    ctx.strokeStyle = "#dce1d5";
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(W - 20, y);
    ctx.stroke();
  }
  floorDetails(ctx, game.scene);
  if (game.stage === 3) venueJourney(ctx);
  if (game.stage === 4)
    hallInterior(ctx, {
      time: game.worldTime + (game.ambientTime || 0),
      reducedMotion: reducedMotion.matches,
    });
  if (game.scene.weather === "rain")
    rainShelters(ctx, {
      time: game.worldTime + (game.ambientTime || 0),
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
  for (
    let i = 0;
    i < (game.stage === 4 ? 0 : game.scene.backgroundCount);
    i++
  ) {
    const y =
      -100 -
      ((i * 63 +
        (game.worldTime + (game.ambientTime || 0)) * (i % 2 ? 20 : -18) +
        1200) %
        350);
    person({
      x: 75 + i * 64,
      y,
      r: 13,
      ux: 0,
      uy: i % 2 ? -1 : 1,
      visualKey: `background:${i}`,
      color: i % 4,
      state: "walking",
      walk: (game.worldTime + (game.ambientTime || 0)) * (i % 2 ? 20 : 18),
      background: true,
    });
  }
  destination(game.scene);
  goalBoundary(ctx, game.scene);
  if (game.stage === 4)
    person({
      x: 145,
      y: 810,
      r: 11,
      partner: true,
      shirt: "#826c89",
      targetKind: "clerk",
      appearanceId: 8,
      state: "waiting",
      ux: 1,
      uy: 0,
      visualKey: "ticket-staff",
    });
  if (game.stage === 4 && !finale) {
    ctx.fillStyle = "#d7d1e9";
    ctx.textAlign = "center";
    ctx.font = "bold 11px system-ui";
    ctx.fillText("GOAL · 柵の手前の最前列へ", 240, 43);
  }
  if (!finale && game.stage !== 4) {
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
  const facilityY = game.stage === 3 ? 1010 : game.traffic ? 145 : 340,
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
    game.startY + 25,
  );
  ctx.fillStyle = "#759081";
  ctx.font = "11px system-ui";
  ctx.fillText("START", 240, game.startY + 37);
  for (const t of game.crossings) drawTraffic(t);
  const displayMembers = finale
    ? game.party.members.map((m) => ({
        ...m,
        state: "celebrating",
        ux: 0,
        uy: -1,
        flash: 0,
        docking: false,
      }))
    : game.party.members;
  const displayPartner =
    game.stage === 4
      ? {
          ...game.meetingPartner,
          partner: false,
          background: true,
          visualKey: "concert-neighbor",
          state: "watching",
          ux: 0,
          uy: -1,
          glowStick: true,
        }
      : joiningFriend(game, reducedMotion.matches) || game.meetingPartner;
  const displayPlayer = finale
    ? {
        ...game.player,
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
  if (finale && !reducedMotion.matches) {
    // Sparse warm confetti, no flashes and no change to the recorded clock.
    const t = game.worldTime + (game.ambientTime || 0);
    for (let i = 0; i < 24; i++) {
      const x = 70 + ((i * 73) % 340),
        y = -210 + ((i * 29 + t * 12) % 230);
      ctx.fillStyle = ["#e6c46f", "#e9acc7", "#a8dccd"][i % 3];
      ctx.fillRect(x, y, 3, 5);
    }
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

function drawResultRoster() {
  if (
    $("#result-party").hidden ||
    $("#result-party").getBoundingClientRect().width === 0
  )
    return;
  const roster = $("#result-roster"),
    rect = roster.getBoundingClientRect(),
    ratio = Math.min(2, window.devicePixelRatio || 1);
  roster.width = Math.round(rect.width * ratio);
  roster.height = Math.round(rect.height * ratio);
  const c = roster.getContext("2d"),
    scale = Math.min(rect.width / 300, 1);
  c.setTransform(
    ratio * scale,
    0,
    0,
    ratio * scale,
    ((rect.width - 300 * scale) / 2) * ratio,
    2 * ratio,
  );
  const newcomer = joiningFriend(game, reducedMotion.matches);
  const actors = [
    { ...game.player, player: true },
    ...game.party.members,
    ...(newcomer ? [newcomer] : []),
  ];
  const first = 150 - (actors.length - 1) * 25;
  actors.forEach((actor, i) => {
    const target = first + i * 50,
      progress = actor.newFriend ? actor.joinProgress : 1;
    const x = target + (1 - progress) * 28;
    c.save();
    c.translate(x, 40);
    const pose = {
      ...createWalkingPose({ x: 0, y: 0 }, { x: 0, y: 1 }),
      moving: progress < 1,
      speed: 60,
      distance: (game.joinTime || 0) * 60,
    };
    drawCharacter(
      c,
      { ...actor, x: 0, y: 0, state: progress < 1 ? "joining" : "waiting" },
      {
        pose,
        player: !!actor.player,
        reducedMotion: reducedMotion.matches,
        live: game.stage === 4,
      },
    );
    c.restore();
    if (actor.newFriend) {
      c.fillStyle = "#f0cf81";
      c.font = "bold 9px system-ui";
      c.textAlign = "center";
      c.fillText("NEW", x, 9);
    }
    if (!actor.player) {
      c.fillStyle = game.stage === 4 ? "#fff3cf" : "#245c56";
      c.font = "bold 10px system-ui";
      c.textAlign = "center";
      c.fillText(String(actor.id), x, 76);
    }
  });
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
  const violations = trafficViolations(game);
  audio.update(
    game.phase === "playing",
    input().left && input().right,
    game.stage,
    game.stage !== 4 || game.player.y < 700,
  );
  const previousX = game.player.x;
  const previousRegroup = game.party.regroup;
  const steering = input();
  step(game, dt, steering);
  advanceJoining(game, dt, {
    active: !document.hidden && document.hasFocus(),
    reducedMotion: reducedMotion.matches,
  });
  advanceAudienceAmbience(game, dt, {
    active: !document.hidden && document.hasFocus(),
    reducedMotion: reducedMotion.matches,
  });
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
    game.stage === 4 &&
    game.phase === "playing" &&
    game.player.y > 740 &&
    game.player.y < 810
      ? "チケット確認 ✓ · ホールへ進もう"
      : game.phase === "gameover"
        ? "ゲームオーバー · この区間から再挑戦"
        : game.phase === "finished"
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
    if (game.crossings.length > 1)
      signal.textContent =
        `${game.crossings.indexOf(t) + 1}/2 · ${t.lanes}車線 · ` +
        signal.textContent;
    if (trafficViolations(game) > violations) {
      noticeUntil = now + 1800;
      const event = game.violationEvent;
      $("#notice").textContent = "信号無視 +2秒 · 赤では両押しで待とう";
      if (game.party.members.some((m) => m.id === event.memberId)) {
        companionSpeech = {
          ...event,
          until: game.worldTime + (game.ambientTime || 0) + 1.8,
        };
        $("#companion-bubble").textContent =
          `友だち${event.memberId}「${event.message}」`;
      }
      audio.effect("contact");
    }
  }
  if (game.hits > hits) {
    audio.effect("contact");
    noticeUntil = now + 950;
    if (!game.traffic || trafficViolations(game) === violations) {
      $("#notice").textContent =
        `${game.lastContactMember ? "友だち" + game.lastContactMember : "自分"}が接触！ +2秒`;
    }
  }
  $("#notice").classList.toggle(
    "active",
    game.phase === "playing" && now < noticeUntil,
  );
  $("#party-count").textContent =
    `自分 + 仲間${game.party.members.length + (game.phase === "finished" && game.stage < 4 ? 1 : 0)}人`;
  $("#party-roster").textContent =
    game.phase === "finished"
      ? [
          ...game.party.members.map((m) => `${m.id}✓`),
          ...(game.stage < 4 ? [`${game.stage + 1}（新）✓`] : []),
        ].join(" · ")
      : game.party.members.length
        ? game.party.members
            .map((m) => `${m.id}${m.docked ? "✓" : ""}`)
            .join(" · ")
        : "ひとりで出発";
  $("#time").innerHTML = `${game.elapsed.toFixed(1)}<span>秒</span>`;
  $("#hits").innerHTML = `${game.hits}<span>回</span>`;
  $("#distance").innerHTML =
    `${Math.round(Math.max(0, Math.min(100, ((Math.max(game.player.y, ...game.party.members.map((m) => m.y)) - 84) / (game.startY - 84 + game.party.members.length * 30)) * 100)))}<span>%</span>`;
  if (game.phase === "gameover" && overlay.hidden) {
    clearInput();
    audio.suspend();
    pause.disabled = true;
    panel(
      "横断中に接触しました",
      `${game.crash.memberId ? "友だち" + game.crash.memberId : "自分"}が${game.crash.vehicleKind === "car" ? "車" : "自転車"}に接触。信号と車の位置を見て、もう一度この区間に挑戦しよう。`,
      "この区間をもう一度 →",
      "GAME OVER",
    );
  }
  if (game.phase === "finished" && overlay.hidden) {
    audio.goal(game.stage, game);
    clearInput();
    pause.disabled = true;
    records[game.stage] = {
      time: game.elapsed,
      hits: game.hits,
      violations: trafficViolations(game),
    };
    const totals = resultTotals(records);
    $("#result-score dt").textContent =
      game.stage === 4 ? "全5区間の合計タイム" : "到着タイム（加算込み）";
    const score =
      game.stage === 4
        ? totals
        : {
            time: game.elapsed,
            hits: game.hits,
            violations: trafficViolations(game),
          };
    $("#result-time").innerHTML = `${score.time.toFixed(1)}<small>秒</small>`;
    $("#result-hits").innerHTML = `${score.hits}<small>回</small>`;
    $("#result-violations").innerHTML = `${score.violations}<small>回</small>`;
    const cleanStage = game.hits === 0 && !trafficViolations(game);
    $("#share-actions").hidden = game.stage !== 4;
    if (game.stage < 4)
      $("#next-purpose").textContent =
        `次の目的：${SCENES[game.stage + 1].intro}` +
        ([0, 2].includes(game.stage)
          ? " 赤は両押しで待とう。赤で横断開始は信号無視 +2秒。"
          : "");
    $("#next-purpose").hidden = game.stage === 4;
    panel(
      game.stage === 4 ? "全員、最前列へ！" : game.scene.arrival,
      game.stage === 4
        ? `全5区間を完走。${totals.clean ? "すきまの名案内！ 全員が一度も接触せず到着しました。" : "みんなで最前列！ 次は全員で接触ゼロに挑戦しよう。"}`
        : `友だち${game.stage + 1}と合流し、仲間が${game.stage + 1}人になりました。${cleanStage ? "この区間は全員、無接触！" : "全員到着！ 次は接触ゼロを目指そう。"}`,
      game.stage < 4 ? "次のステージへ →" : "もう一度遊ぶ →",
      `STAGE ${game.stage + 1} COMPLETE`,
    );
  }
  draw();
  drawResultRoster();
  $("#goal-callout").textContent =
    game.arriving && game.phase !== "finished"
      ? "仲間全員を待とう！"
      : game.scene.bubble;
  const callout = $("#goal-callout"),
    rect = canvas.getBoundingClientRect();
  const { scale, ox, oy } = projection;
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
  const speech = $("#companion-bubble"),
    link = $("#companion-link");
  const speaker =
    companionSpeech &&
    game.party.members.find((m) => m.id === companionSpeech.memberId);
  speech.hidden = link.hidden =
    !speaker ||
    game.phase !== "playing" ||
    game.worldTime + (game.ambientTime || 0) >= companionSpeech.until;
  if (!speech.hidden) {
    const x = ox + (speaker.x + 240 - game.player.x) * scale;
    const y = oy + (speaker.y - 29 + CAMERA_Y - game.player.y) * scale;
    const width = speech.offsetWidth,
      height = speech.offsetHeight;
    const obstacles = game.crossings.flatMap((t) =>
      [
        [100, t.bottom + 50],
        [380, t.top - 50],
      ].map(([sx, sy]) => ({
        left: ox + (sx - 25 + 240 - game.player.x) * scale,
        right: ox + (sx + 25 + 240 - game.player.x) * scale,
        top: oy + (sy - 48 + CAMERA_Y - game.player.y) * scale,
        bottom: oy + (sy + 48 + CAMERA_Y - game.player.y) * scale,
      })),
    );
    for (const element of document.querySelectorAll(
      ".hud,.toolbar,.steering,.settings",
    )) {
      const box = element.getBoundingClientRect();
      obstacles.push({
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
      });
    }
    obstacles.push({
      left: ox + (240 - 21) * scale,
      right: ox + (240 + 21) * scale,
      top: oy + (CAMERA_Y - 20) * scale,
      bottom: oy + (CAMERA_Y + 20) * scale,
    });
    const layout = placeSpeech({
      x,
      y,
      width,
      height,
      viewport: rect,
      obstacles,
    });
    speech.style.left = `${layout.left}px`;
    speech.style.top = `${layout.top}px`;
    link.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    link
      .querySelector("path")
      .setAttribute(
        "d",
        `M ${layout.tailX} ${layout.tailY} L ${layout.anchorX} ${layout.anchorY}`,
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
