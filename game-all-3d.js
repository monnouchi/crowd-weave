import { TiltState, tiltPermission } from "./tilt.js";
import { shareResult, resultText, resultTotals } from "./share-all-3d.js";
import { drawWorld3D } from "./world-3d.js";
import { GameAudio } from "./sound.js";
import {
  updatePlayerPose,
  createWalkingPose,
  updateWalkingPose,
} from "./pose.js";
import { drawCharacter, placeSpeech } from "./character.js";
import { GAME_NAME } from "./branding.js";
import {
  createGame,
  activeSpeech,
  cancelCallGesture,
  insideConcert,
  step,
  W,
  H,
  advanceAudienceAmbience,
  nextRunSeed,
  seedForRun,
  joiningFriend,
  advanceJoining,
  STAGES,
  SCENES,
} from "./logic.js";
import { trafficViolations } from "./traffic.js";
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
let worldProjector = null;
function resizeDrawingSurface() {
  const ratio = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)),
    rect = canvas.getBoundingClientRect();
  const width = Math.round(rect.width * ratio),
    height = Math.round(rect.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  renderRatio = ratio;
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
    top,
    bottom,
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
function updateVisualPoses(dt) {
  const active = !document.hidden && document.hasFocus() &&
    (game.phase === "playing" ||
      (game.phase === "finished" && game.stage === 4));
  const actors = [
    ["player", game.player],
    ["partner", game.meetingPartner],
    ...game.party.members.map((p) => [`friend:${p.id}`, p]),
    ...game.crowd.map((p) => [`crowd:${p.id}`, p]),
  ];
  for (const [key, actor] of actors) {
    const previous = walkingPoses.get(key) || createWalkingPose(actor, {
      x: actor.ux ?? 0,
      y: actor.uy ?? -1,
    });
    walkingPoses.set(key, updateWalkingPose(previous, actor, dt, {
      canMove: active && (actor.state === undefined ||
        ["walking", "following", "docking"].includes(actor.state)),
    }));
  }
}
const tilt = new TiltState();
let steeringMode = "buttons",
  tiltWaitingUntil = 0,
  tiltRequest = 0;
const enterLatch = new EnterLatch();
const audio = new GameAudio();
let introSoundOn = false;
let goBannerUntil = 0;
let finalSceneCard = null;
window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", () => audio.unlock());
document.querySelector("#sound").addEventListener("click", () => {
  const muted = audio.toggle();
  document.querySelector("#sound").textContent = muted ? "音：OFF" : "音：ON";
  document.querySelector("#sound").setAttribute("aria-pressed", String(!muted));
});
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (s) => document.querySelector(s);
const touchDevice = window.matchMedia("(pointer: coarse)");
function updateCanvasHelp() {
  canvas.setAttribute(
    "aria-describedby",
    touchDevice.matches ? "touch-help" : "keyboard-help",
  );
}
updateCanvasHelp();
touchDevice.addEventListener("change", updateCanvasHelp);
document.title = `${GAME_NAME} · 立体版`;
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
  cancelCallGesture(game);
  tilt.reset();
  if (steeringMode === "tilt") tiltWaitingUntil = performance.now() + 3000;
}
function panel(title, message, button, label = "CROWD WEAVE") {
  overlay.hidden = false;
  $("#countdown").hidden = true;
  $("#result-score").hidden = game.phase !== "finished";
  overlay.classList.toggle("paused", game.phase === "paused");
  overlay.classList.remove("initial");
  overlay.classList.toggle(
    "finale",
    game.phase === "finished" && game.stage === 4,
  );
  $("#title").textContent = title;
  if (game.phase === "finished" && game.stage === 4)
    canvas.setAttribute(
      "aria-label",
      "斜め上から見たライブの舞台。演奏するバンドと、最前列で一緒に楽しむ自分と友だち4人。",
    );
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
        ? `友だちが1人増えた！ 自分＋友だち${count}人`
        : `自分＋友だち${count}人・全員到着`;
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
  game.readyRemaining = 1.4;
  goBannerUntil = 0;
  finalSceneCard = null;
  canvas.weaveResultRegion = null;
  $("#countdown strong").textContent = "GET READY";
  $("#countdown").classList.remove("go");
  $("#countdown").hidden = false;
  canvas.setAttribute(
    "aria-label",
    "人混みを避け、友だちと合流しながらライブ会場まで歩くゲーム",
  );
  $("main").dataset.scene = game.scene.landmark;
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
  game.phase = "countdown";
  overlay.hidden = true;
  overlay.classList.remove("finale", "initial", "paused");
  pause.disabled = false;
  last = performance.now();
  $("#notice").textContent = "";
  noticeUntil = 0;
  $("#speech-bubble").dataset.key = "";
  canvas.focus({ preventScroll: true });
}
function setPaused() {
  clearInput();
  audio.suspend();
  if (game.phase !== "playing" && game.phase !== "countdown") return;
  game.resumePhase = game.phase;
  game.phase = "paused";
  pause.disabled = true;
  panel(
    "ひと休み。",
    "時計は止まっています。準備ができたら続きを進もう。",
    "再開する →",
  );
}
function initialStart() {
  audio.muted = !introSoundOn;
  if (introSoundOn) audio.unlock();
  else audio.suspend();
  $("#sound").textContent = introSoundOn ? "音：ON" : "音：OFF";
  $("#sound").setAttribute("aria-pressed", String(introSoundOn));
  start();
}
$("#start-sound").addEventListener("click", () => {
  if (game.phase !== "ready") return;
  introSoundOn = !introSoundOn;
  $("#start-sound").textContent = introSoundOn ? "音：ON" : "音：OFF";
  $("#start-sound").setAttribute("aria-pressed", String(introSoundOn));
});
function activatePrimary() {
  const command = primaryCommand(game.phase, game.stage);
  if (command === "resume") {
    clearInput();
    game.phase = game.resumePhase || "playing";
    $("#countdown").hidden = game.phase !== "countdown";
    overlay.hidden = true;
    pause.disabled = false;
    last = performance.now();
    canvas.focus({ preventScroll: true });
  } else if (command === "next") start(game.stage + 1);
  else if (command === "start") initialStart();
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
      e.target instanceof Element &&
      e.target.closest("button:not(#action), summary, a, [role='button']")
    )
      return;
    e.preventDefault();
    if (
      enterLatch.press({
        repeat: e.repeat,
        modified: e.altKey || e.ctrlKey || e.metaKey || e.shiftKey,
      })
    ) {
      activatePrimary();
    }
    return;
  }
  if (editable || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (controls.includes(k)) {
    e.preventDefault();
    if (game.phase === "playing" || game.phase === "countdown")
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
    (game.phase === "playing" || game.phase === "countdown") &&
    (side !== "brake" || steeringMode === "tilt"),
  press: (id, side) =>
    side === "brake" ? tilt.brakes.add(id) : buttons.press(id, side),
  release: (id, side) =>
    side === "brake" ? tilt.brakes.delete(id) : buttons.release(id),
  interrupted: setPaused,
  canceled: () => cancelCallGesture(game),
});
window.addEventListener("pagehide", setPaused);
function input() {
  const keys = buttons.read();
  if (steeringMode !== "tilt") return { ...keys, call: true };
  const sensor = tilt.read(performance.now());
  if (tilt.brakes.size)
    return { left: true, right: true, axis: 0, call: false };
  if (keys.left || keys.right) return { ...keys, call: true };
  return sensor.stale
    ? { left: true, right: true, axis: 0, call: false }
    : { ...sensor, call: true };
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

function draw() {
  resizeDrawingSurface();
  const { width, height, top, bottom } = projection;
  ctx.setTransform(renderRatio, 0, 0, renderRatio, 0, 0);
  const result = drawWorld3D(ctx, game, {
    width, height, top, bottom,
    reducedMotion: reducedMotion.matches,
    poses: walkingPoses,
  });
  worldProjector = result.projector;
  canvas.weaveResultRegion = game.stage === 4 && game.phase === "finished"
    ? Object.fromEntries(Object.entries(result.resultRegion).map(([key, value]) =>
        [key, value * renderRatio]))
    : null;
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
      c.fillStyle = "#785528";
      c.font = "bold 9px system-ui";
      c.textAlign = "center";
      c.fillText("NEW", x, 9);
    }
    if (!actor.player) {
      c.fillStyle = "#24474b";
      c.font = "bold 10px system-ui";
      c.textAlign = "center";
      c.fillText(String(actor.id), x, 76);
    }
  });
}
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  let simulationDt = dt;
  if (game.phase === "countdown") {
    game.readyRemaining = Math.max(
      0,
      game.readyRemaining - Math.max(0, Math.min(1, dt)),
    );
    simulationDt = 0;
    if (game.readyRemaining === 0) {
      game.phase = "playing";
      goBannerUntil = now + 650;
      $("#countdown strong").textContent = "GO!";
      $("#countdown").classList.add("go");
    }
  }
  if (game.phase === "playing" && goBannerUntil && now >= goBannerUntil) {
    $("#countdown").hidden = true;
    goBannerUntil = 0;
  }
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
    insideConcert(game),
  );
  const previousX = game.player.x;
  const previousRegroup = game.party.regroup;
  const steering = input();
  if (simulationDt > 0) step(game, simulationDt, steering);
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
  updateVisualPoses(movementDt);
  playerPose = updatePlayerPose(
    playerPose,
    movementDt ? (game.player.x - previousX) / movementDt : 0,
    dt,
    reducedMotion.matches,
  );
  $("#left").classList.toggle("held", steering.left);
  $("#right").classList.toggle("held", steering.right);
  $("#motion").textContent =
    game.phase === "countdown"
      ? "準備中 · GO! で時計が動きます"
      : game.stage === 4 &&
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
              ? "合流中 · 友だちの到着を待っています"
              : steering.left && steering.right
                ? game.party.members.length
                  ? "ブレーキ · 友だちが隊列を整えます"
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
    signal.classList.toggle("blink-off", t.blinking && !t.blinkOn);
    signal.textContent = t.reserved
      ? "↑ 横断中 · 友だち全員が渡るまで車は待ちます"
      : t.canEnter
        ? `↑ 青 · 全員で渡れます（残り${t.remaining.toFixed(1)}秒）`
        : t.blinking
          ? "■ 青点滅 · まもなく赤、次の青まで待とう"
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
      $("#notice").textContent = "信号無視 +2秒 · 赤では両押しで待とう";
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
    `自分 + 友だち${game.party.members.length + (game.phase === "finished" && game.stage < 4 ? 1 : 0)}人`;
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
        : `友だち${game.stage + 1}と合流し、友だちが${game.stage + 1}人になりました。${cleanStage ? "この区間は全員、無接触！" : "全員到着！ 次は接触ゼロを目指そう。"}`,
      game.stage < 4 ? "次のステージへ →" : "もう一度遊ぶ →",
      `STAGE ${game.stage + 1} COMPLETE`,
    );
  }
  draw();
  drawResultRoster();
  $("#goal-callout").textContent =
    game.arriving && game.phase !== "finished"
      ? "友だち全員を待とう！"
      : game.scene.bubble;
  const callout = $("#goal-callout"),
    rect = canvas.getBoundingClientRect();
  const scale = worldProjector.scale;
  const target = worldProjector.point(
    game.meetingPartner.x, game.meetingPartner.y, 48,
  );
  const px = target.x, py = target.y;
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
  const speech = $("#speech-bubble"),
    link = $("#speech-link"),
    line = activeSpeech(game);
  const speaker = line && (line.speakerId === 0
    ? game.player
    : game.party.members.find((m) => m.id === line.speakerId));
  speech.hidden = link.hidden =
    !speaker ||
    game.phase !== "playing";
  if (!speech.hidden) {
    const key = `${game.stage}:${line.serial}`;
    if (speech.dataset.key !== key) {
      speech.dataset.key = key;
      speech.dataset.kind = line.kind;
      speech.textContent = line.text;
      speech.setAttribute("aria-label",
        `${line.speakerId ? `友だち${line.speakerId}` : "YOU"}：${line.text}`);
    }
    const anchor = worldProjector.point(speaker.x, speaker.y, 52);
    const x = anchor.x, y = anchor.y;
    const width = speech.offsetWidth,
      height = speech.offsetHeight;
    const obstacles = game.crossings.flatMap((t) =>
      [
        [100, t.bottom + 50],
        [380, t.top - 50],
      ].map(([sx, sy]) => ({
        left: worldProjector.point(sx - 25, sy, 0).x,
        right: worldProjector.point(sx + 25, sy, 0).x,
        top: worldProjector.point(sx, sy - 48, 60).y,
        bottom: worldProjector.point(sx, sy + 48, 0).y,
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
    const playerPoint = worldProjector.point(game.player.x, game.player.y, 0);
    obstacles.push({
      left: playerPoint.x - 21 * scale,
      right: playerPoint.x + 21 * scale,
      top: playerPoint.y - 48 * scale,
      bottom: playerPoint.y + 20 * scale,
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
