// Development-only telemetry. The Pages build removes every caller and this file.
const INTERVAL_MS = 15000;
const BATCH_SIZE = 40;
const STORAGE_KEY = "playlog-failures-v1";
const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let buffer = [];
let sending = false;
let flushRequested = false;
const browser = typeof window !== "undefined" && typeof document !== "undefined";

function save(lines) {
  if (!browser || !lines.length) return;
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...old, ...lines]));
  } catch { /* Logging must never affect the game. */ }
}
function restore() {
  try {
    const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(old)) buffer.unshift(...old);
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* Storage can be unavailable. */ }
}
export function flush() {
  if (!browser || !buffer.length) return;
  if (sending) { flushRequested = true; return; }
  const lines = buffer.splice(0);
  sending = true;
  try {
    Promise.resolve(fetch("/__playlog", { method: "POST", headers: { "Content-Type": "application/x-ndjson" }, body: lines.join("\n") + "\n" }))
      .then(response => { if (!response.ok) save(lines); }, () => save(lines))
      .finally(() => { sending = false; if (flushRequested || buffer.length >= BATCH_SIZE) { flushRequested = false; flush(); } });
  } catch { sending = false; save(lines); }
}
export function emit(run, type, fields = {}) {
  try {
    buffer.push(JSON.stringify({ session, elapsed: run?.elapsed ?? 0, type, ...fields }));
    if (buffer.length >= BATCH_SIZE) flush();
  } catch { /* Logging must never affect the game. */ }
}
export function observe(fn) { try { fn(); } catch { /* Observer failures are isolated. */ } }
if (browser) {
  observe(restore);
  observe(flush);
  observe(() => setInterval(flush, INTERVAL_MS));
  observe(() => addEventListener("pagehide", () => observe(() => {
    if (!buffer.length) return;
    const lines = buffer.splice(0);
    try {
      if (!navigator.sendBeacon("/__playlog", new Blob([lines.join("\n") + "\n"], { type: "text/plain" }))) save(lines);
    } catch { save(lines); }
  })));
  observe(() => {
    const badge = document.createElement("div");
    badge.textContent = "デバッグモード";
    Object.assign(badge.style, { position: "fixed", top: "4px", left: "4px", zIndex: "9999", background: "#9a3100", color: "white", padding: "3px 7px", borderRadius: "4px", font: "bold 12px sans-serif", pointerEvents: "none" });
    document.body.append(badge);
  });
}
