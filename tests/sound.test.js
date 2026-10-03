import test from "node:test";
import assert from "node:assert/strict";
import { GameAudio, MUSIC } from "../sound.js";
function fakeContext() {
  const voices = [];
  const context = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator() {
      const o = {
        frequency: {},
        connect() {},
        disconnect() {},
        start(t) {
          this.startAt = t;
        },
        stop(t) {
          this.stopAt = t;
          this.stops = (this.stops || 0) + 1;
        },
      };
      voices.push(o);
      return o;
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime(v) {
            assert.ok(v <= 0.04);
          },
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    },
    suspend: async () => {
      context.state = "suspended";
    },
  };
  return { context, voices };
}
test("five stage music patterns have distinct rhythm or tone and quiet headroom", () => {
  assert.equal(new Set(MUSIC.map((m) => JSON.stringify(m))).size, 5);
  const a = new GameAudio(),
    f = fakeContext();
  a.context = f.context;
  a.muted = false;
  for (let stage = 0; stage < 5; stage++) {
    a.update(true, false, stage);
    assert.equal(a.stage, stage);
    assert.equal(f.voices.at(-1).frequency.value, MUSIC[stage].notes[0]);
    assert.equal(a.nextNote, MUSIC[stage].beat);
  }
  assert.ok(
    f.voices.filter((v) => !a.voices.has(v)).every((v) => v.stops >= 2),
  );
});
test("one cue per result; final fanfare is longer and richer; retry cancels queued voices", () => {
  const a = new GameAudio(),
    f = fakeContext();
  a.context = f.context;
  a.muted = false;
  const run = {};
  a.goal(0, run);
  const ordinary = f.voices.length,
    end = Math.max(...f.voices.map((v) => v.stopAt));
  a.goal(0, run);
  assert.equal(f.voices.length, ordinary);
  a.goal(4, {});
  assert.ok(f.voices.length - ordinary > ordinary);
  assert.ok(Math.max(...f.voices.map((v) => v.stopAt)) > end + 1);
  a.update(true, false, 0);
  assert.ok(f.voices.slice(0, -1).every((v) => v.stops >= 2));
});
test("mute and pause suppress new music/cues and discard scheduled voices", () => {
  const a = new GameAudio(),
    f = fakeContext();
  a.context = f.context;
  a.muted = false;
  a.update(true, false, 2);
  a.toggle();
  const count = f.voices.length;
  a.goal(4, {});
  a.update(true, true, 4);
  assert.equal(f.voices.length, count);
  assert.equal(f.context.state, "suspended");
  assert.equal(a.voices.size, 0);
});

test("fresh game audio is silent before a start choice", () => {
  const a = new GameAudio(),
    f = fakeContext();
  a.context = f.context;
  a.update(true, false, 0);
  a.goal(0, {});
  assert.equal(a.muted, true);
  assert.equal(f.voices.length, 0);
});

test("each joined companion adds a bounded quiet musical part and mute cancels all", () => {
  const counts = [];
  for (let stage = 0; stage < 5; stage++) {
    const a = new GameAudio(),
      f = fakeContext();
    a.context = f.context;
    a.muted = false;
    for (let n = 0; n < 8; n++) {
      f.context.currentTime = a.nextNote + 0.001;
      a.update(true, false, stage);
    }
    counts.push(f.voices.length);
    a.toggle();
    assert.ok(f.voices.every((v) => v.stops >= 2));
    const before = f.voices.length;
    a.update(true, false, stage);
    assert.equal(f.voices.length, before);
  }
  assert.deepEqual(counts, [8, 10, 14, 18, 26]);
});
