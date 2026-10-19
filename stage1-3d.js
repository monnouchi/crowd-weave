import { activeSpeech, createGame, seedForRun, step } from "./logic.js";
import { TwoButtons, bindPointerControls, EnterLatch } from "./input.js";
import { drawStageOne3D } from "./stage1-3d-render.js";
import { placeSpeech } from "./character.js";

const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", { alpha: false });
const panel = document.querySelector("#panel");
const panelTitle = document.querySelector("#panel-title");
const panelMessage = document.querySelector("#panel-message");
const action = document.querySelector("#action");
const time = document.querySelector("#time");
const hits = document.querySelector("#hits");
const left = document.querySelector("#left");
const right = document.querySelector("#right");
const buttons = new TwoButtons();
const enter = new EnterLatch();
const rawSeed = new URLSearchParams(location.search).get("seed");
const parsedSeed = rawSeed === null ? 17 : Number(rawSeed);
const runSeed = Number.isSafeInteger(parsedSeed) ? parsedSeed : 17;
let game = createGame(0, seedForRun(runSeed, 0));
let lastFrame = performance.now();
let width = 0;
let height = 0;

function clearInput() {
  controls.clear();
  buttons.clear();
  left.classList.remove("pressed");
  right.classList.remove("pressed");
}

function setPanel() {
  const phase = game.phase;
  panel.hidden = phase === "playing";
  if (phase === "ready") {
    panelTitle.textContent = "友だちのところへ";
    panelMessage.textContent = "左右のボタン、または ← → / A D でよけます。両押しで止まれます。人にぶつかると2秒加算されます。";
    action.textContent = "はじめる";
  } else if (phase === "paused") {
    panelTitle.textContent = "一時停止";
    panelMessage.textContent = "続きから再開できます。画面を離れた間は時計も人の動きも止まります。";
    action.textContent = "再開する";
  } else if (phase === "finished") {
    panelTitle.textContent = "友だちと合流！";
    panelMessage.textContent = `到着タイム ${game.elapsed.toFixed(1)}秒 · 接触 ${game.hits}回。もう一度この住宅街を歩けます。`;
    action.textContent = "もう一度遊ぶ";
  }
  document.querySelector("#pause").disabled = phase !== "playing";
}

function restart() {
  clearInput();
  game = createGame(0, seedForRun(runSeed, 0));
  game.phase = "playing";
  document.querySelector("#speech-bubble").dataset.key = "";
  lastFrame = performance.now();
  setPanel();
}

function primaryAction() {
  if (game.phase === "finished") return restart();
  if (game.phase === "ready" || game.phase === "paused") {
    game.phase = "playing";
    lastFrame = performance.now();
    setPanel();
  }
}

function pause() {
  clearInput();
  if (game.phase === "playing") {
    game.phase = "paused";
    setPanel();
  }
  lastFrame = performance.now();
}

const controls = bindPointerControls({
  controls: [[left, "left"], [right, "right"]],
  enabled: () => game.phase === "playing",
  press(id, side) { buttons.press(id, side); document.querySelector(`#${side}`).classList.add("pressed"); },
  release(id, side) { buttons.release(id); if (!buttons.read()[side]) document.querySelector(`#${side}`).classList.remove("pressed"); },
  interrupted: pause,
});

function resize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
}

function frame(now) {
  if (canvas.clientWidth !== width || canvas.clientHeight !== height) resize();
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (game.phase === "playing") {
    step(game, dt, buttons.read());
    if (game.phase === "finished") { clearInput(); setPanel(); }
  }
  const projector = drawStageOne3D(ctx, game, { width, height });
  const speech = document.querySelector("#speech-bubble");
  const link = document.querySelector("#speech-link");
  const line = activeSpeech(game);
  speech.hidden = link.hidden = game.phase !== "playing" ||
    !line || line.speakerId !== 0;
  if (!speech.hidden) {
    const key = `${game.stage}:${line.serial}`;
    if (speech.dataset.key !== key) {
      speech.dataset.key = key;
      speech.textContent = line.text;
      speech.setAttribute("aria-label", `YOU：${line.text}`);
    }
    const anchor = projector.point(game.player.x, game.player.y, 52);
    const obstacles = [".hud", ".toolbar", ".touch-controls"].map((selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    const layout = placeSpeech({
      x: anchor.x, y: anchor.y,
      width: speech.offsetWidth, height: speech.offsetHeight,
      viewport: { width, height }, obstacles,
    });
    speech.style.left = `${layout.left}px`;
    speech.style.top = `${layout.top}px`;
    link.setAttribute("viewBox", `0 0 ${width} ${height}`);
    link.querySelector("path").setAttribute("d",
      `M ${layout.tailX} ${layout.tailY} L ${layout.anchorX} ${layout.anchorY}`);
  }
  time.textContent = `${game.elapsed.toFixed(1)}秒`;
  hits.textContent = `${game.hits}回`;
  requestAnimationFrame(frame);
}

action.addEventListener("click", primaryAction);
document.querySelector("#pause").addEventListener("click", pause);
document.querySelector("#restart").addEventListener("click", restart);
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const editable = event.target.closest?.("input, textarea, select, [contenteditable]");
  if (editable || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (["arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  if (key === "arrowleft" || key === "a") buttons.press(`key:${key}`, "left");
  if (key === "arrowright" || key === "d") buttons.press(`key:${key}`, "right");
  if (key === "escape") pause();
  if (key === "enter" && enter.press({ repeat: event.repeat })) primaryAction();
});
document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  buttons.release(`key:${key}`);
  if (key === "enter") enter.release();
});
window.addEventListener("blur", pause);
document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

// A read-only observation point for local browser verification.
Object.defineProperty(window, "__stage1Preview", {
  value: Object.freeze({ snapshot: () => Object.freeze({
    phase: game.phase, x: game.player.x, y: game.player.y,
    elapsed: game.elapsed, hits: game.hits, worldTime: game.worldTime,
  }) }),
});
setPanel();
resize();
requestAnimationFrame(frame);
