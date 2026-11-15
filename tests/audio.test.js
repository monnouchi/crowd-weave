import test from "node:test";
import assert from "node:assert/strict";
import { KIT, STAGES, Soundscape, ambienceFor, drumHits, flowLayerActive } from "../src/audio.js";

test("stages have distinct eight-note motifs and unchanged roots and beats", () => {
  assert.equal(STAGES.length, 5);
  for (const stage of STAGES) {
    assert.ok(Array.isArray(stage.motif));
    assert.equal(stage.motif.length, 8);
  }
  assert.deepEqual(STAGES[0].motif, [0, 3, 7, 10, 7, 3, 5, 2]);
  for (let i = 0; i < STAGES.length; i++) {
    for (let j = i + 1; j < STAGES.length; j++) {
      assert.notDeepEqual(STAGES[i].motif, STAGES[j].motif);
    }
  }
  assert.deepEqual(STAGES.map((stage) => stage.root), [196, 220, 174.61, 220, 261.63]);
  assert.deepEqual(STAGES.map((stage) => stage.beat), [0.62, 0.49, 0.58, 0.46, 0.4]);
});

test("rain belongs only to the rainy stage and the hall crowd is dark", () => {
  for (let stage = 0; stage < STAGES.length; stage++) {
    assert.equal(ambienceFor(stage).rainGain > 0, stage === 3);
    if (stage !== 3) assert.equal(ambienceFor(stage).rainGain, 0);
  }
  assert.ok(ambienceFor(4, 1).crowdFrequency < 680);
  assert.ok(ambienceFor(4, 1).crowdFrequency < ambienceFor(3).rainFrequency);
});

test("venue drums play an eight-beat pattern", () => {
  for (let stage = 0; stage < 4; stage++)
    for (let beat = 0; beat < 8; beat++)
      for (const subBeat of [0, 1]) assert.deepEqual(drumHits(stage, beat, subBeat), []);
  for (let beat = 0; beat < 8; beat++) {
    for (const subBeat of [0, 1]) assert.ok(drumHits(4, beat, subBeat).includes("hat"));
    assert.equal(drumHits(4, beat, 0).includes("kick"), beat === 0 || beat === 4);
    assert.equal(drumHits(4, beat, 0).includes("snare"), beat === 2 || beat === 6);
    assert.deepEqual(drumHits(4, beat, 1), ["hat"]);
  }
});

test("kit voices use quiet, short filtered noise and a tonal snare body", () => {
  assert.deepEqual(KIT.kick, { frequency: 120, endFrequency: 42, duration: 0.12, gain: 0.010 });
  assert.deepEqual(KIT.snare, {
    filter: "bandpass", frequency: 1800, q: 0.85, attack: 0.003, decay: 0.075, gain: 0.006,
    body: { frequency: 185, duration: 0.09, gain: 0.005, type: "triangle" },
  });
  assert.deepEqual(KIT.hat, {
    filter: "highpass", frequency: 7000, q: 0.7, attack: 0.002, decay: 0.025, gain: 0.0025,
  });
});

test("drum noise schedules zero-ended envelopes and stops at silence", () => {
  for (const config of [KIT.hat, KIT.snare]) {
    const events = [];
    const node = () => ({ connect() {}, disconnect() {} });
    const source = { ...node(), start: (time) => events.push(["start", time]),
      stop: (time) => events.push(["stop", time]) };
    const filter = { ...node(), frequency: {}, Q: {} };
    const gain = { ...node(), gain: {
      setValueAtTime: (value, time) => events.push(["set", value, time]),
      linearRampToValueAtTime: (value, time) => events.push(["linear", value, time]),
      exponentialRampToValueAtTime: (value, time) => events.push(["exponential", value, time]),
    } };
    const sound = new Soundscape();
    sound.muted = false;
    sound.context = { state: "running", currentTime: 1, createBufferSource: () => source,
      createBiquadFilter: () => filter, createGain: () => gain };
    sound.noiseBuffer = {};
    sound.musicBus = {};
    sound.drumNoise(2, config);
    const end = 2 + config.attack + config.decay;
    assert.equal(filter.type, config.filter);
    assert.equal(filter.frequency.value, config.frequency);
    assert.equal(filter.Q.value, config.q);
    assert.deepEqual(events, [["set", 0, 2], ["linear", config.gain, 2 + config.attack],
      ["exponential", 0.00001, end - 0.003], ["linear", 0, end], ["start", 2], ["stop", end]]);
    source.onended();
    assert.equal(sound.voices.size, 0);
  }
});

test("FLOW harmony begins at tier three", () => {
  for (let tier = 0; tier <= 5; tier++)
    assert.equal(flowLayerActive(tier), tier >= 3);
});

test("stage transitions immediately target the new ambience", () => {
  const sound = new Soundscape();
  const targets = {};
  const param = (name) => ({ setTargetAtTime: (value) => { targets[name] = value; } });
  sound.context = { currentTime: 1, state: "running" };
  sound.airBus = { gain: param("crowdGain") };
  sound.airFilter = { frequency: param("crowdFrequency") };
  sound.rainBus = { gain: param("rainGain") };
  sound.rainFilter = { frequency: param("rainFrequency") };
  sound.setStage(3);
  assert.deepEqual(targets, ambienceFor(3));
  sound.setStage(4);
  assert.deepEqual(targets, ambienceFor(4));
});
