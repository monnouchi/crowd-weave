// Platform-neutral two-button state. Multiple pointers on one side are independent.
export class TwoButtons {
  constructor() {
    this.sources = new Map();
  }
  press(id, side) {
    if (side === "left" || side === "right") this.sources.set(id, side);
  }
  release(id) {
    this.sources.delete(id);
  }
  clear() {
    this.sources.clear();
  }
  read() {
    const values = [...this.sources.values()];
    return { left: values.includes("left"), right: values.includes("right") };
  }
}

// Each pointer owns exactly one control until an explicit end/interruption.
// Capture is an optimization; document-wide releases remain the fallback.
// There is deliberately no timeout: a legitimate long hold must keep working.
export function bindPointerControls({
  root = document,
  controls,
  enabled,
  press,
  release,
  interrupted = () => {},
}) {
  const owners = new Map();
  const eventRoot = root.defaultView || root;
  const gesture = () =>
    root.documentElement.classList.toggle("control-gesture", owners.size > 0);
  function end(id) {
    const owner = owners.get(id);
    if (!owner) return;
    owners.delete(id);
    release(`pointer:${id}`, owner.side);
    try {
      if (owner.button.hasPointerCapture(id))
        owner.button.releasePointerCapture(id);
    } catch {}
    gesture();
  }
  function clear() {
    for (const id of [...owners.keys()]) end(id);
  }
  for (const [button, side] of controls) {
    button.addEventListener("pointerdown", (e) => {
      if (!enabled(side) || e.button !== 0) return;
      e.preventDefault();
      end(e.pointerId);
      root.getSelection()?.removeAllRanges();
      owners.set(e.pointerId, {
        button,
        side,
        type: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        touchId: null,
      });
      press(`pointer:${e.pointerId}`, side);
      gesture();
      try {
        button.setPointerCapture(e.pointerId);
      } catch {}
    });
    button.addEventListener("lostpointercapture", (e) => {
      if (owners.get(e.pointerId)?.button === button) end(e.pointerId);
    });
  }
  for (const name of ["pointerup", "pointercancel"])
    eventRoot.addEventListener(name, (e) => end(e.pointerId), true);
  eventRoot.addEventListener(
    "pointermove",
    (e) => {
      const owner = owners.get(e.pointerId);
      if (!owner) return;
      if (e.buttons === 0) return end(e.pointerId);
      owner.x = e.clientX;
      owner.y = e.clientY;
    },
    true,
  );
  // Touch identifiers and pointer IDs are different namespaces. Associate at
  // touchstart, then reconcile against *all remaining fingers* on each event.
  function reconcile(e) {
    const touches = [...e.touches];
    for (const owner of owners.values()) {
      if (owner.type !== "touch" || owner.touchId !== null) continue;
      const touch = [...e.changedTouches].find(
        (t) =>
          owner.button.contains(t.target) &&
          Math.hypot(t.clientX - owner.x, t.clientY - owner.y) < 2 &&
          ![...owners.values()].some((o) => o.touchId === t.identifier),
      );
      if (touch) owner.touchId = touch.identifier;
    }
    for (const [id, owner] of owners) {
      if (owner.type !== "touch") continue;
      if (
        !touches.length ||
        (owner.touchId !== null &&
          !touches.some((t) => t.identifier === owner.touchId))
      )
        end(id);
    }
  }
  for (const name of ["touchstart", "touchend", "touchcancel"])
    eventRoot.addEventListener(name, reconcile, {
      capture: true,
      passive: true,
    });
  for (const name of ["selectstart", "contextmenu", "dragstart"])
    root.addEventListener(
      name,
      (e) => {
        if (owners.size) e.preventDefault();
      },
      true,
    );
  root.addEventListener("selectionchange", () => {
    if (owners.size && root.getSelection()?.isCollapsed === false) {
      clear();
      interrupted();
    }
  });
  return {
    clear,
    get active() {
      return owners.size;
    },
  };
}

// A physical Enter press can trigger only once, even across result transitions.
export class EnterLatch {
  constructor() {
    this.held = false;
  }
  press({
    repeat = false,
    modified = false,
    editable = false,
    composing = false,
  } = {}) {
    if (repeat || modified || editable || composing || this.held) return false;
    this.held = true;
    return true;
  }
  release() {
    this.held = false;
  }
}
export function primaryCommand(phase, stage) {
  if (phase === "ready") return "start";
  if (phase === "paused") return "resume";
  if (phase === "finished") return stage < 4 ? "next" : "retry";
  return null;
}
