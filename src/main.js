import { TwoButtons, OneShotControl, bindPointerControls } from "../input.js";
import { createRun, beginRun, updateRun, advanceRun, retryRun, restartRun, pauseRun, resumeRun, STORY_STAGES } from "./run.js";
import { renderWorld } from "./render.js";
import { Soundscape } from "./audio.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const ctx = canvas.getContext("2d", { alpha: false });
const controls = new TwoButtons();
const callControl = new OneShotControl();
const sound = new Soundscape();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const querySeed = new URLSearchParams(location.search).get("seed");
const fixedSeed = /^\d{1,10}$/.test(querySeed || "") && Number(querySeed) <= 0xffffffff ? Number(querySeed) : null;
function newSeed() {
  if (fixedSeed !== null) return fixedSeed;
  try { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  catch { return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0; }
}
let run = createRun(0, newSeed());
let previousPhase = run.phase;
let cueUntil = 0;
let contactUntil = 0;
let dangerUntil = 0;
let lastFrame = performance.now();
let viewport = { width: 1, height: 1, reducedMotion: reducedMotion.matches };
let cameraYaw = 0;
let pausedBySystem = false;
let wasBraking = false;
let finaleRevealRemaining = 0;
const story = (stage = run.stage) => STORY_STAGES?.[stage] || {};
const storyName = (stage = run.stage) => story(stage).title || run.scene?.place || `区間 ${stage + 1}`;
const clock = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, "0")}`;
};
const limit = (value, min, max) => Math.max(min, Math.min(max, value));

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = limit(devicePixelRatio || 1, 1, 1.75);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / Math.max(1, rect.width), 0, 0, height / Math.max(1, rect.height), 0, 0);
  viewport = { width: rect.width, height: rect.height, reducedMotion: reducedMotion.matches };
}
resize();
addEventListener("resize", resize);
window.visualViewport?.addEventListener("resize", resize);
reducedMotion.addEventListener("change", resize);

const pointer = bindPointerControls({
  controls: [[$("left"), "left"], [$("right"), "right"], [$("call"), "call"]],
  enabled: () => run.phase === "playing",
  press: (id, side) => side === "call" ? callControl.press() : controls.press(id, side),
  release: (id, side) => side === "call" ? callControl.release() : controls.release(id),
  interrupted: () => clearInput(),
  canceled: () => clearInput(),
});
function clearInput() {
  pointer.clear();
  controls.clear();
  callControl.clear();
  $("left").classList.remove("active");
  $("right").classList.remove("active");
  $("call").classList.remove("active");
}
function setRun(next) {
  if (next) run = next;
  finaleRevealRemaining = 0;
  $("app").classList.remove("finale-view");
  sound.setStage(run.stage);
  previousPhase = run.phase;
  cameraYaw = 0;
  clearInput();
  wasBraking = false;
  updateHud();
}

function cue(text, duration = 2) {
  if (!text) return;
  $("cue").textContent = text;
  $("cue").classList.add("show");
  cueUntil = performance.now() + duration * 1000;
}
function setOverlay({ kicker, title, body, extra = "", action, stats = false, guide = false, secondary = false, secondaryLabel = "この区間をやり直す", foot = "" }) {
  $("overlay-kicker").textContent = kicker;
  $("overlay-title").textContent = title;
  $("logo-wrap").hidden = title !== "雑踏突破";
  $("overlay").classList.toggle("with-logo", title === "雑踏突破");
  $("overlay-body").textContent = body;
  $("overlay-extra").textContent = extra;
  $("overlay-extra").hidden = !extra;
  $("overlay-guide").hidden = !guide;
  $("overlay-stats").hidden = !stats;
  $("secondary").hidden = !secondary;
  $("secondary").textContent = secondaryLabel;
  $("overlay-foot").textContent = foot;
  $("overlay-foot").hidden = !foot;
  $("action").firstChild.textContent = `${action} `;
  $("overlay").hidden = false;
  $("controls").inert = true;
  $("screen-reader-update").textContent = `${title}。${body}`;
  $("action").focus({ preventScroll: true });
}
function closeOverlay() {
  $("overlay").hidden = true;
  $("controls").inert = false;
  canvas.focus({ preventScroll: true });
}
function showReady() {
  const meta = story();
  setOverlay({
    kicker: `雑踏突破 / ${String(run.stage + 1).padStart(2,"0")} OF 05`,
    title: run.stage === 0 ? "雑踏突破" : storyName(),
    body: run.stage === 0 ? "開演まで、あと少し。友だちとライブの最前列へ。" : meta.message || run.scene?.intro || "人波を読んで、次の待ち合わせへ。",
    extra: run.stage === 0 ? "人波のすきまを読み、一声かけて道をひらこう。" : meta.cue || "道を譲ってくれた人の間を抜けよう。",
    action: "歩き出す", guide: run.stage === 0,
    foot: run.stage === 0 ? "PC は ← → / A D、C で声をかける。Esc で一時停止。" : "左右でよける · 両押しで待つ · 声で道をひらく",
  });
}
function resultTotals() {
  const records = Array.isArray(run.records) ? run.records : [];
  return {
    elapsed: Number.isFinite(run.totalElapsed) ? run.totalElapsed : records.reduce((n, record) => n + (record.elapsed || 0), 0),
    hits: Number.isFinite(run.totalHits) ? run.totalHits : records.reduce((n, record) => n + (record.hits || 0), 0),
  };
}
function showFinished() {
  $("app").classList.remove("finale-view");
  const final = run.stage === 4;
  const totals = final ? resultTotals() : { elapsed: run.elapsed, hits: run.hits };
  $("result-time").textContent = clock(totals.elapsed);
  $("result-hits").textContent = String(totals.hits);
  const next = STORY_STAGES?.[run.stage + 1];
  setOverlay({
    kicker: final ? "雑踏突破 / THE FRONT ROW" : `雑踏突破 / ${String(run.stage + 1).padStart(2,"0")} CLEAR`,
    title: final ? "最前列、到着。" : "合流した。",
    body: final ? "声を重ねて、人波の向こうへ。みんなで演奏を聴けた。" : story().clear || run.scene?.arrival || "友だちと次の道へ。",
    extra: final ? "最初からもう一度、違うすきまを探せます。" : next ? `次の友だちから：${next.message || next.title}` : "",
    action: final ? "もう一度歩く" : "次の区間へ", stats: true,
    secondary: !final, secondaryLabel: "この区間を再挑戦",
  });
}
function showGameOver() {
  setOverlay({
    kicker: "雑踏突破 / RETRY",
    title: "いったん、止まろう。",
    body: "車や自転車が通る道では、青信号と人の流れを確かめよう。",
    extra: "この区間から、同じ配置でやり直せます。",
    action: "この区間をやり直す",
  });
}
function showPaused() {
  setOverlay({
    kicker: "雑踏突破 / PAUSE",
    title: "ひと息つこう。",
    body: "戻るまで、時計も人波も止まっています。",
    action: "歩きつづける", secondary: true,
    foot: "Esc / Enter でも再開できます。",
  });
}
function begin() {
  sound.unlock();
  sound.setPaused(false);
  beginRun(run);
  sound.event("start");
  previousPhase = run.phase;
  closeOverlay();
  if (run.stage === 0 && run.worldTime === 0) cue("人波の拍を、見つけよう", 2.7);
  else cue(story().cue || storyName(), 2.7);
}
function resume() {
  resumeRun(run);
  pausedBySystem = false;
  sound.unlock();
  sound.setPaused(false);
  previousPhase = run.phase;
  lastFrame = performance.now();
  closeOverlay();
}
function action() {
  if (run.phase === "paused") return resume();
  if (run.phase === "ready") return begin();
  if (run.phase === "gameover") {
    setRun(retryRun(run));
    return begin();
  }
  if (run.phase === "finished") {
    if (run.stage < 4) setRun(advanceRun(run));
    else setRun(restartRun(newSeed()));
    return begin();
  }
}
$("action").addEventListener("click", action);
$("secondary").addEventListener("click", () => {
  if (run.phase !== "paused" && run.phase !== "finished") return;
  setRun(retryRun(run));
  begin();
});
function pauseGame(system = false) {
  if (run.phase !== "playing") return;
  pauseRun(run);
  pausedBySystem = system;
  sound.setPaused(true);
  clearInput();
  showPaused();
}
$("pause").addEventListener("click", () => run.phase === "paused" ? resume() : pauseGame());
function updateSoundButton() {
  const muted = sound.muted;
  $("sound").textContent = muted ? "♩" : "♪";
  $("sound").setAttribute("aria-label", muted ? "音を出す" : "音を消す");
  $("sound").setAttribute("aria-pressed", String(!muted));
}
$("sound").addEventListener("click", () => { sound.unlock(); sound.toggleMuted(); updateSoundButton(); });
updateSoundButton();

addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", " ", "enter", "escape"].includes(key)) event.preventDefault();
  if (key === "enter" && !event.repeat && run.phase !== "playing") return action();
  if (key === "escape" && !event.repeat) return run.phase === "paused" ? resume() : pauseGame();
  if (key === "m" && !event.repeat) { sound.unlock(); sound.toggleMuted(); return updateSoundButton(); }
  if (run.phase !== "playing") return;
  if (key === "arrowleft" || key === "a") controls.press(`key:${key}`, "left");
  else if (key === "arrowright" || key === "d") controls.press(`key:${key}`, "right");
  else if (key === " ") { controls.press("key:space-left", "left"); controls.press("key:space-right", "right"); }
  else if (key === "c") callControl.press();
});
addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  controls.release(`key:${key}`);
  if (key === " ") { controls.release("key:space-left"); controls.release("key:space-right"); }
  if (key === "c") callControl.release();
});
addEventListener("blur", () => pauseGame(true));
document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(true); });

function updateHud() {
  $("stage-number").textContent = `${String(run.stage + 1).padStart(2,"0")} / 05`;
  $("stage-name").textContent = storyName();
  $("time").textContent = clock(run.elapsed);
  $("hits").textContent = `接触 ${run.hits}`;
  const completion = limit(Math.round((1 - (run.player.y - 80) / Math.max(1, run.startY - 80)) * 100), 0, 100);
  $("progress-fill").style.width = `${completion}%`;
  $("progress").setAttribute("aria-valuenow", String(completion));
  const crossing = (run.crossings || []).find((road) => run.player.y >= road.top - 10 && run.player.y <= road.bottom + 185);
  const warning = $("road-warning");
  if (crossing && run.player.y >= crossing.bottom - 16 && run.player.y <= crossing.bottom + 155) {
    warning.hidden = false;
    warning.classList.toggle("green", !!crossing.canEnter || !!crossing.reserved);
    const roadText = crossing.canEnter || crossing.reserved ? "青信号 · 渡ろう" : "赤信号 · 両押しで待とう";
    if (warning.textContent !== roadText) warning.textContent = roadText;
  } else warning.hidden = true;
  $("cue").classList.toggle("suppressed", !warning.hidden);
  const flow = run.flow;
  $("flow").textContent = crossing && !warning.hidden ? "道路では信号を見よう" :
    run.braking ? "止まって流れを見よう" :
    flow?.open > .6 ? "人波がひらいた · 今がすきま" :
    flow?.anticipation > .35 ? "まもなく、人波がひらく" :
    run.arriving ? "友だちを待とう" : "人波の間を読もう";
  const cooldown = Math.max(0, (run.callReadyAt || 0) - (run.worldTime || 0));
  $("call-label").textContent = cooldown > .05 ? `あと ${Math.ceil(cooldown)} 秒` :
    run.callReady ? "声が届く" : "近づくと届く";
  $("call").classList.toggle("cooldown", cooldown > .05);
  $("call").classList.toggle("ready", !!run.callReady && cooldown <= .05);
  $("hint").hidden = run.stage > 0 && run.worldTime > 7;
  const held = controls.read();
  $("left").classList.toggle("active", held.left);
  $("right").classList.toggle("active", held.right);
}
function consumeEvents() {
  for (const event of run.events || []) {
    const kind = typeof event === "string" ? event : (event?.kind || event?.type);
    if (!kind) continue;
    sound.event(kind, event);
    if (kind === "call") cue("すみませーん！", 1.25);
    else if (kind === "callEmpty") cue(run.callReadyAt > run.worldTime ? "もう一拍、待とう" : "近くで声をかけよう", 1.1);
    else if (kind === "contact") { cue("おっと、ゆっくり", .85); contactUntil = performance.now() + 250; }
    else if (kind === "closePass") cue("すきまを抜けた", .85);
    else if (kind === "reunion") cue("追いついた！", 1.1);
    else if (kind === "danger") dangerUntil = performance.now() + 550;
  }
}
function frame(now) {
  const dt = limit((now - lastFrame) / 1000, 0, .05);
  lastFrame = now;
  if (run.phase === "playing") {
    const held = controls.read();
    const braking = held.left && held.right;
    if (braking && !wasBraking) sound.event("brake");
    wasBraking = braking;
    const steer = held.left === held.right ? 0 : held.left ? -1 : 1;
    cameraYaw += ((reducedMotion.matches ? 0 : steer * .045) - cameraYaw) * Math.min(1, dt * 6);
    updateRun(run, dt, { ...held, call: callControl.take(), hopEnabled: false });
    consumeEvents();
    sound.tick(run, dt);
    if (run.phase !== previousPhase) {
      if (run.phase === "finished") {
        if (run.stage === 4) {
          // Hold on the actual first-row view long enough for the arrival to
          // read as a reward before the result card covers the performance.
          finaleRevealRemaining = 2.2;
          $("app").classList.add("finale-view");
          cue("みんなで、最前列へ。", 2.1);
        } else showFinished();
      }
      if (run.phase === "gameover") showGameOver();
      previousPhase = run.phase;
      clearInput();
    }
  } else cameraYaw *= 1 - Math.min(1, dt * 6);
  if (run.phase === "finished" && finaleRevealRemaining > 0 && !document.hidden) {
    finaleRevealRemaining -= dt;
    if (finaleRevealRemaining <= 0) {
      finaleRevealRemaining = 0;
      showFinished();
    }
  }
  if (cueUntil && now > cueUntil) { $("cue").classList.remove("show"); cueUntil = 0; }
  $("flash").classList.toggle("contact", now < contactUntil);
  $("flash").classList.toggle("danger", now < dangerUntil);
  updateHud();
  renderWorld(ctx, run, { ...viewport, yaw: cameraYaw, danger: now < dangerUntil, contactPulse: now < contactUntil ? 1 : 0 });
  requestAnimationFrame(frame);
}
showReady();
requestAnimationFrame(frame);
