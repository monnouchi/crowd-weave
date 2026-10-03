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
