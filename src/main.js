import { TwoButtons, bindPointerControls } from "../input.js";
import { createRun, beginRun, updateRun, advanceRun, retryRun, restartRun, pauseRun, resumeRun, STORY_STAGES } from "./run.js";
import { renderWorld } from "./render.js";
import { Soundscape } from "./audio.js";
import { recordLocalBest, seedShareUrl } from "./replay.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const ctx = canvas.getContext("2d", { alpha: false });
const controls = new TwoButtons();
// Distinct quick taps may arrive inside one animation frame. Keep a short
// bounded queue, while a held finger or key still counts as one call.
class CallTapQueue {
  held = false;
  pending = 0;
  press() {
    if (this.held) return;
    this.held = true;
    this.pending = Math.min(8, this.pending + 1);
  }
  release() { this.held = false; }
  take() {
    if (!this.pending) return false;
    this.pending--;
    return true;
  }
  clear() { this.held = false; this.pending = 0; }
}
const callControl = new CallTapQueue();
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
let callButtonUntil = 0;
const story = (stage = run.stage) => STORY_STAGES?.[stage] || {};
const storyName = (stage = run.stage) => story(stage).title || run.scene?.place || `区間 ${stage + 1}`;
const clock = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  return `${Math.floor(value / 60)}:${(value % 60).toFixed(1).padStart(4, "0")}`;
};
const limit = (value, min, max) => Math.max(min, Math.min(max, value));
function browserStorage() {
  try { return globalThis.localStorage; }
  catch { return null; }
}

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
function resetVoiceEffect() {
  $("voice-effect").replaceChildren();
  $("call").classList.remove("fired");
  callButtonUntil = 0;
}
function playVoiceEffect(success) {
  const layer = $("voice-effect");
  const burst = $("voice-template").content.firstElementChild.cloneNode(true);
  burst.classList.add(success ? "success" : "empty");
  if (!success) burst.querySelector(".voice-phrase").textContent = "声は届かなかった";
  burst.dataset.expires = String(performance.now() + (success ? 850 : 650));
  // Preserve layered sound waves for rapid taps, but keep only one readable
  // phrase in the sight line.
  for (const older of layer.children) older.querySelector(".voice-phrase")?.remove();
  layer.append(burst);
  while (layer.childElementCount > 3) layer.firstElementChild.remove();
  const visible = [...layer.children];
  visible.forEach((item, index) => {
    item.style.opacity = String(1 - .25 * (visible.length - index - 1));
  });
  $("call").classList.add("fired");
  callButtonUntil = performance.now() + 280;
}
function setRun(next) {
  if (next) run = next;
  sound.setStage(run.stage);
  previousPhase = run.phase;
  cameraYaw = 0;
  clearInput();
  resetVoiceEffect();
  wasBraking = false;
  updateHud();
}

function cue(text, duration = 2) {
  if (!text) return;
  $("cue").textContent = text;
  $("cue").classList.add("show");
  cueUntil = performance.now() + duration * 1000;
}
function setOverlay({ kicker, title, body, extra = "", action, stats = false, guide = false, replay = false, secondary = false, secondaryLabel = "この区間をやり直す", foot = "" }) {
  resetVoiceEffect();
  $("overlay-kicker").textContent = kicker;
  $("overlay-title").textContent = title;
  $("logo-wrap").hidden = title !== "雑踏突破";
  $("overlay").classList.toggle("with-logo", title === "雑踏突破");
  $("overlay-body").textContent = body;
  $("overlay-extra").textContent = extra;
  $("overlay-extra").hidden = !extra;
  $("overlay-guide").hidden = !guide;
  $("overlay-stats").hidden = !stats;
  $("replay-meta").hidden = !replay;
  $("share-url").hidden = true;
  $("share-seed").textContent = "同じ配置の URL をコピー";
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
    extra: run.stage === 0 ? "すきまを読み、何度でも声をかけよう。" : meta.cue || "道を譲ってくれた人の間を抜けよう。",
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
  const final = run.stage === 4;
  const totals = final ? resultTotals() : { elapsed: run.elapsed, hits: run.hits };
  if (final) recordLocalBest(browserStorage(), {
    seed: run.runSeed, stage: run.stage,
    elapsed: run.elapsed, hits: run.hits,
  });
  const result = recordLocalBest(browserStorage(), {
    seed: run.runSeed, stage: final ? 5 : run.stage,
    elapsed: totals.elapsed, hits: totals.hits,
  });
  const streak = final
    ? Math.max(0, ...run.records.map((record) => Number(record.bestStreak) || 0))
    : run.bestStreak || 0;
  $("result-time").textContent = clock(totals.elapsed);
  $("result-hits").textContent = String(totals.hits);
  const next = STORY_STAGES?.[run.stage + 1];
  setOverlay({
    kicker: final ? "雑踏突破 / THE FRONT ROW" : `雑踏突破 / ${String(run.stage + 1).padStart(2,"0")} CLEAR`,
    title: final ? "最前列、到着。" : "たどり着いた。",
    body: final ? "人波の向こうに舞台が開けた。後ろから仲間の声も近づいてくる。" : story().clear || run.scene?.arrival || "友だちも、もうすぐ追いつく。",
    extra: final ? fixedSeed === null
      ? "最初からもう一度、違うすきまを探せます。"
      : "同じ配置で、別のすきまを探せます。"
      : next ? `次の友だちから：${next.message || next.title}` : "",
    action: final ? "もう一度歩く" : "次の区間へ", stats: true, replay: true,
    secondary: !final, secondaryLabel: "この区間を再挑戦",
  });
  const bestText = result.stored && result.best
    ? `${result.improved ? "自己ベスト更新" : "自己ベスト"} ${clock(result.best.elapsed)} ／ 接触${result.best.hits}`
    : "";
  const streakText = streak > 1 ? `人波を無接触で ${streak} 区間連続突破`
    : streak === 1 ? "人波を無接触で 1 区間突破" : "";
  $("result-record").textContent = [bestText, streakText].filter(Boolean).join("\n");
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
$("share-seed").addEventListener("click", async () => {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const url = seedShareUrl(canonical, run.runSeed);
  try {
    await navigator.clipboard.writeText(url);
    $("share-seed").textContent = "URL をコピーしました";
  } catch {
    const field = $("share-url");
    field.value = url;
    field.hidden = false;
    field.focus();
    field.select();
    $("share-seed").textContent = "URL を選択しました";
  }
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
    const safeToEnter = !!crossing.canEnter || !!crossing.reserved;
    warning.classList.toggle("green", safeToEnter);
    warning.classList.toggle("caution", !safeToEnter && !!crossing.nominalGreen);
    const roadText = safeToEnter ? "青信号 · 渡ろう" :
      crossing.nominalGreen && !crossing.vehicleClear ? "車が通過中 · 待とう" :
      crossing.nominalGreen && crossing.blinking ? "青点滅 · 次を待とう" :
      crossing.nominalGreen ? "青信号 · 次を待とう" :
      "赤信号 · 両押しで待とう";
    if (warning.textContent !== roadText) warning.textContent = roadText;
  } else {
    warning.hidden = true;
    warning.classList.remove("green", "caution");
  }
  $("cue").classList.toggle("suppressed", !warning.hidden);
  $("flow").textContent = crossing && !warning.hidden ? "道路では信号を見よう" :
    run.braking ? "止まって流れを見よう" :
    run.callReady ? "前の人に声が届く" :
    run.pressure > .5 ? "前の人の歩幅を見よう" : "進む人の向きを見よう";
  $("call-label").textContent = run.callReady ? "今、声が届く" : "いつでも呼べる";
  $("call").classList.toggle("ready", !!run.callReady);
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
    if (kind === "call") { playVoiceEffect(true); cue("道がひらいた！", 1.1); }
    else if (kind === "callEmpty") { playVoiceEffect(false); cue("近くの人に声をかけよう", 1.1); }
    else if (kind === "contact") { cue("おっと、ゆっくり", .85); contactUntil = performance.now() + 250; }
    else if (kind === "closePass") cue(Number(event.streak) >= 2 ? "続けて、すきまを抜けた！" : "すきまを抜けた", .85);
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
    const callPressed = callControl.take();
    updateRun(run, dt, { ...held, call: callPressed, callPulse: callPressed, hopEnabled: false });
    consumeEvents();
    sound.tick(run, dt);
    if (run.phase !== previousPhase) {
      if (run.phase === "finished") showFinished();
      if (run.phase === "gameover") showGameOver();
      previousPhase = run.phase;
      clearInput();
    }
  } else cameraYaw *= 1 - Math.min(1, dt * 6);
  if (cueUntil && now > cueUntil) { $("cue").classList.remove("show"); cueUntil = 0; }
  for (const burst of [...$("voice-effect").children])
    if (now > Number(burst.dataset.expires)) burst.remove();
  if (callButtonUntil && now > callButtonUntil) {
    $("call").classList.remove("fired");
    callButtonUntil = 0;
  }
  $("flash").classList.toggle("contact", now < contactUntil);
  $("flash").classList.toggle("danger", now < dangerUntil);
  updateHud();
  renderWorld(ctx, run, { ...viewport, yaw: cameraYaw, danger: now < dangerUntil, contactPulse: now < contactUntil ? 1 : 0 });
  requestAnimationFrame(frame);
}
showReady();
requestAnimationFrame(frame);
