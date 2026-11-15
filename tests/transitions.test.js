import test from "node:test";
import assert from "node:assert/strict";
import { boundaryDip, courseMusicMix, DIP_HALF_WIDTH, DIP_PEAK, AUDIO_HALF_WIDTH, AUDIO_REDUCED_HALF_WIDTH } from "../src/transitions.js";
import { Soundscape } from "../src/audio.js";

const run = { stage: 0, phase: "playing", player: { y: 0 }, course: { offsets: [0, -1000] } };
const at = distance => ({ ...run, player: { y: 84 - distance } });

test("dip is symmetric, smooth, bounded, and course-only", () => {
  assert.equal(boundaryDip(at(-DIP_HALF_WIDTH - 1)), 0);
  assert.equal(boundaryDip(at(0)), DIP_PEAK);
  assert.ok(DIP_PEAK <= .4);
  let previous = 0;
  for (let d = -DIP_HALF_WIDTH; d <= 0; d++) {
    const value = boundaryDip(at(d));
    assert.ok(value >= previous);
    assert.ok(Math.abs(value - boundaryDip(at(-d))) < 1e-12);
    previous = value;
  }
  assert.equal(boundaryDip(at(0), true), 0);
  assert.equal(boundaryDip({ player: { y: 84 } }), 0);
});

test("course mixes move monotonically between full stage gains", () => {
  for (const [reduced, width] of [[false, AUDIO_HALF_WIDTH], [true, AUDIO_REDUCED_HALF_WIDTH]]) {
    assert.equal(courseMusicMix(at(-width - 1), reduced), null);
    assert.equal(courseMusicMix(at(width + 1), reduced), null);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const mix = courseMusicMix(at(-width + 2 * width * i / 100), reduced);
      assert.ok(mix.incoming >= previous);
      assert.ok(Math.abs(mix.outgoing + mix.incoming - 1) < 1e-12);
      previous = mix.incoming;
    }
    assert.equal(courseMusicMix(at(-width), reduced).outgoing, 1);
    assert.equal(courseMusicMix(at(width), reduced).incoming, 1);
  }
});

test("scheduler overlaps independent stage patterns through their own gain buses", () => {
  const sound = new Soundscape();
  sound.muted = false;
  sound.context = { state: "running", currentTime: 1 };
  const gains = [];
  sound.stageBuses = Array.from({ length: 5 }, (_, i) => ({ gain: {
    setTargetAtTime: value => { gains[i] = value; },
  } }));
  const scheduled = [];
  sound.scoreBeat = (...args) => scheduled.push(args);
  sound.tick(at(-10));
  assert.ok(gains[0] > 0 && gains[1] > 0);
  assert.deepEqual(scheduled.map(args => args[5]), [0, 1]);
  assert.equal(scheduled[0][7], sound.stageBuses[0]);
  assert.equal(scheduled[1][7], sound.stageBuses[1]);
  sound.tick({ ...at(10), stage: 1, course: { ...run.course, index: 1 } });
  assert.ok(gains[0] < gains[1]);
  assert.equal(sound.stageClocks.size, 2);
  sound.tick({ ...at(50), stage: 1 });
  assert.deepEqual(gains, [0, 1, 0, 0, 0]);
});
