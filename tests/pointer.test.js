import test from "node:test";
import assert from "node:assert/strict";
import { bindPointerControls, TwoButtons } from "../input.js";
function fixture({ windowEvents = false } = {}) {
  class Target {
    constructor() {
      this.listeners = new Map();
      this.captured = new Set();
    }
    addEventListener(name, fn) {
      this.listeners.set(name, [...(this.listeners.get(name) || []), fn]);
    }
    emit(name, props = {}) {
      const e = {
        button: 0,
        buttons: 1,
        pointerType: "touch",
        clientX: 10,
        clientY: 20,
        target: this,
        preventDefault() {
          this.prevented = true;
        },
        ...props,
      };
      for (const f of this.listeners.get(name) || []) f(e);
      return e;
    }
    contains(t) {
      return t === this;
    }
    setPointerCapture(id) {
      this.captured.add(id);
    }
    hasPointerCapture(id) {
      return this.captured.has(id);
    }
    releasePointerCapture(id) {
      this.captured.delete(id);
      this.emit("lostpointercapture", { pointerId: id });
    }
  }
  const root = new Target(),
    left = new Target(),
    right = new Target(),
    buttons = new TwoButtons();
  let selection = false,
    interrupts = 0;
  const win = windowEvents ? new Target() : null;
  if (win) root.defaultView = win;
  root.documentElement = {
    classList: {
      toggle(n, value) {
        root.gesture = value;
      },
    },
  };
  root.getSelection = () => ({
    isCollapsed: !selection,
    removeAllRanges() {
      selection = false;
    },
  });
  const controller = bindPointerControls({
    root,
    controls: [
      [left, "left"],
      [right, "right"],
    ],
    enabled: () => true,
    press: (id, side) => buttons.press(id, side),
    release: (id) => buttons.release(id),
    interrupted: () => interrupts++,
  });
  return {
    root,
    win,
    left,
    right,
    buttons,
    controller,
    select() {
      selection = true;
      root.emit("selectionchange");
    },
    get interrupts() {
      return interrupts;
    },
  };
}
test("document release outside a control works even if capture is unavailable", () => {
  const f = fixture();
  f.left.setPointerCapture = () => {
    throw Error("unavailable");
  };
  f.left.emit("pointerdown", { pointerId: 1 });
  assert.equal(f.buttons.read().left, true);
  f.root.emit("pointerup", { pointerId: 1 });
  assert.deepEqual(f.buttons.read(), { left: false, right: false });
  assert.equal(f.root.gesture, false);
});
test("one ended finger preserves the other pointer and keyboard source", () => {
  const f = fixture();
  f.buttons.press("key:a", "left");
  f.left.emit("pointerdown", { pointerId: 1 });
  f.right.emit("pointerdown", { pointerId: 2 });
  f.root.emit("pointercancel", { pointerId: 1 });
  assert.deepEqual(f.buttons.read(), { left: true, right: true });
  f.buttons.release("key:a");
  assert.deepEqual(f.buttons.read(), { left: false, right: true });
  f.root.emit("pointerup", { pointerId: 2 });
  assert.equal(f.controller.active, 0);
});
test("touch identities reconcile a missed pointer ending without clearing the remaining finger", () => {
  const f = fixture(),
    a = { identifier: 81, clientX: 10, clientY: 20, target: f.left },
    b = { identifier: 82, clientX: 10, clientY: 20, target: f.right };
  f.left.emit("pointerdown", { pointerId: 7 });
  f.root.emit("touchstart", { touches: [a], changedTouches: [a] });
  f.right.emit("pointerdown", { pointerId: 8 });
  f.root.emit("touchstart", { touches: [a, b], changedTouches: [b] });
  f.root.emit("touchend", { touches: [b], changedTouches: [a] });
  assert.deepEqual(f.buttons.read(), { left: false, right: true });
  f.root.emit("touchcancel", { touches: [], changedTouches: [b] });
  assert.equal(f.controller.active, 0);
});
test("clear releases capture before a pointer ID can be reused; lost capture and released mouse clean up", () => {
  const f = fixture();
  f.left.emit("pointerdown", { pointerId: 1 });
  f.controller.clear();
  assert.equal(f.left.captured.size, 0);
  f.right.emit("pointerdown", { pointerId: 1 });
  f.left.emit("lostpointercapture", { pointerId: 1 });
  assert.equal(f.buttons.read().right, true);
  f.root.emit("pointermove", { pointerId: 1, buttons: 0 });
  assert.equal(f.buttons.read().right, false);
  f.left.emit("pointerdown", { pointerId: 3 });
  f.left.emit("lostpointercapture", { pointerId: 3 });
  assert.equal(f.controller.active, 0);
});
test("a real selection interruption clears input and pauses; copying is allowed outside a gesture", () => {
  const f = fixture();
  assert.equal(f.root.emit("selectstart").prevented, undefined);
  f.left.emit("pointerdown", { pointerId: 1 });
  assert.equal(f.root.emit("selectstart").prevented, true);
  f.select();
  assert.equal(f.interrupts, 1);
  assert.equal(f.controller.active, 0);
  assert.equal(f.root.emit("contextmenu").prevented, undefined);
});
test("legitimate stationary holds have no deadline and right-click cannot create an input", () => {
  const f = fixture();
  f.left.emit("pointerdown", { pointerId: 1, button: 2 });
  assert.equal(f.controller.active, 0);
  f.left.emit("pointerdown", { pointerId: 2 });
  for (let n = 0; n < 1000; n++) f.root.emit("pointermove", { pointerId: 2 });
  assert.equal(f.buttons.read().left, true);
  f.root.emit("pointerup", { pointerId: 2 });
  assert.equal(f.buttons.read().left, false);
});

test("window-targeted cancellation and ending are observed as well as document descendants", () => {
  const f = fixture({ windowEvents: true });
  f.left.emit("pointerdown", { pointerId: 1 });
  f.win.emit("pointercancel", { pointerId: 1 });
  assert.equal(f.controller.active, 0);
  f.right.emit("pointerdown", { pointerId: 2 });
  f.win.emit("pointerup", { pointerId: 2 });
  assert.equal(f.buttons.read().right, false);
});
