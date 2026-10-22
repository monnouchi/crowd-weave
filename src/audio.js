// The soundtrack is synthesized at runtime. No recordings or external assets are used.
// A small motif gathers harmony as the journey moves toward the venue.
const STAGES = [
  { root: 196, beat: 0.62, voice: "triangle", shade: 0.012 },
  { root: 220, beat: 0.49, voice: "triangle", shade: 0.015 },
  { root: 174.61, beat: 0.58, voice: "sine", shade: 0.011 },
  { root: 220, beat: 0.46, voice: "triangle", shade: 0.021 },
  { root: 261.63, beat: 0.4, voice: "triangle", shade: 0.018 },
];

const MOTIF = [0, 3, 7, 10, 7, 3, 5, 2];
// Calibrated in Chrome with a time-domain analyser after the mix bus.
const MASTER_LEVEL = 3.2;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const semitone = (root, step) => root * 2 ** (step / 12);

function storedMute() {
  try {
    return globalThis.localStorage?.getItem("zatto-sound-muted") === "1";
  } catch {
    return false;
  }
}

function saveMute(muted) {
  try {
    globalThis.localStorage?.setItem("zatto-sound-muted", muted ? "1" : "0");
  } catch {
    // Private browsing can deny storage while audio itself remains available.
  }
}

/** Gesture-unlocked, low-volume score and cues for the entire journey. */
export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.airBus = null;
    this.airFilter = null;
    this.airSource = null;
    this.noiseBuffer = null;
    this.voices = new Set();
    this.muted = storedMute();
    this.paused = false;
    this.stage = 0;
    this.beatIndex = 0;
    this.nextBeat = 0;
    this.lastAtmosphere = -Infinity;
    this.lastEvent = new Map();
  }

  // Call this synchronously from the Start button or another real user gesture.
  unlock() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio || this.paused) return false;
    try {
      if (!this.context) {
        this.context = new Audio();
        this.buildGraph();
        this.nextBeat = this.context.currentTime + 0.07;
      }
      if (this.context.state === "suspended") {
        this.context.resume().catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  }

  buildGraph() {
    const c = this.context;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
    const limiter = c.createDynamicsCompressor?.();
    if (limiter) {
      limiter.threshold.value = -9;
      limiter.knee.value = 8;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.004;
      limiter.release.value = 0.2;
      this.master.connect(limiter);
      limiter.connect(c.destination);
    } else this.master.connect(c.destination);

    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.8;
    this.musicBus.connect(this.master);

    this.airBus = c.createGain();
    this.airBus.gain.value = STAGES[this.stage].shade;
    this.airFilter = c.createBiquadFilter();
    this.airFilter.type = "bandpass";
    this.airFilter.frequency.value = 360;
    this.airFilter.Q.value = 0.55;
    this.airFilter.connect(this.airBus);
    this.airBus.connect(this.master);

    // One deterministic, looping noise source suggests a living crowd and rain.
    this.noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const samples = this.noiseBuffer.getChannelData(0);
    let seed = 0x5a1701;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = ((seed / 0xffffffff) * 2 - 1) * 0.55;
    }
    this.airSource = c.createBufferSource();
    this.airSource.buffer = this.noiseBuffer;
    this.airSource.loop = true;
    this.airSource.connect(this.airFilter);
    this.airSource.start();
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    saveMute(this.muted);
    if (this.master && this.context?.state !== "closed") {
      const now = this.context.currentTime;
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_LEVEL, now, 0.035);
      if (!this.muted) this.nextBeat = now + 0.08;
    }
    return this.muted;
  }

  toggleMuted() {
    return this.setMuted(!this.muted);
  }

  setPaused(paused) {
    const next = Boolean(paused);
    if (next === this.paused) return;
    this.paused = next;
    if (!this.context || this.context.state === "closed") return;
    if (next) {
      this.stopVoices();
      this.context.suspend().catch(() => {});
    } else {
      this.context.resume().then(() => {
        this.nextBeat = this.context.currentTime + 0.08;
      }).catch(() => {});
    }
  }

  setStage(stage) {
    const index = clamp(Math.floor(Number(stage) || 0), 0, STAGES.length - 1);
    if (index === this.stage) return;
    this.stage = index;
    this.beatIndex = 0;
    if (this.context) this.nextBeat = this.context.currentTime + 0.12;
  }

  // Called once per animation frame. Scheduling only looks a fraction of a second ahead.
  tick(run, _dt = 0) {
    const c = this.context;
    if (!c || c.state !== "running" || this.paused || this.muted) return;
    if (run?.phase && run.phase !== "playing") return;
    if (Number.isFinite(run?.stage) && run.stage !== this.stage)
      this.setStage(run.stage);
    const pressure = clamp(Number(run?.pressure) || 0, 0, 1);
    const open = clamp(Number(run?.flow?.open) || 0, 0, 1);
    const moving = !run?.braking && (run?.speed == null || run.speed > 8);
    if (c.currentTime - this.lastAtmosphere > 0.15) {
      const config = STAGES[this.stage];
      this.airBus.gain.setTargetAtTime(
        config.shade * (0.75 + pressure * 0.75) * (1 - open * 0.48),
        c.currentTime,
        0.19,
      );
      this.airFilter.frequency.setTargetAtTime(
        this.stage === 3 ? 1650 : this.stage === 4 ? 680 : 390 + pressure * 480,
        c.currentTime,
        0.24,
      );
      this.lastAtmosphere = c.currentTime;
    }
    const beat = STAGES[this.stage].beat;
    if (this.nextBeat < c.currentTime - beat)
      this.nextBeat = c.currentTime + 0.035;
    let scheduled = 0;
    while (this.nextBeat < c.currentTime + 0.13 && scheduled++ < 2) {
      this.scoreBeat(this.nextBeat, pressure, open, moving);
      this.nextBeat += beat;
      this.beatIndex++;
    }
  }

  scoreBeat(at, pressure, open, moving) {
    const stage = this.stage;
    const index = this.beatIndex % 8;
    const config = STAGES[stage];
    const root = config.root;
    const melody = MOTIF[index] + (stage === 4 ? 7 : 0);
    const high = stage >= 3 ? 1 : 0;
    const clear = 1 + open * 0.16;

    // The foot pulse stops when the player brakes; the city still keeps time.
    if (moving)
      this.tone(58 + stage * 3, at, 0.11, 0.006 + pressure * 0.002,
        "sine", this.musicBus, { endFrequency: 42 });
    if (index % 2 === 0) {
      this.tone(semitone(root, index < 4 ? 0 : 5) / 2, at, config.beat * 1.35,
        0.010 + high * 0.004, "triangle", this.musicBus);
      this.tone(semitone(root, melody + 12), at + 0.06, config.beat * 0.73,
        (0.016 + high * 0.003) * clear, config.voice, this.musicBus,
        { pan: index === 0 ? -0.17 : 0.17 });
    } else if (stage >= 1) {
      this.tone(semitone(root, melody + 12), at + config.beat * 0.17,
        config.beat * 0.53, 0.009 * clear, config.voice, this.musicBus);
    }
    // A companion's answer enters one stage at a time, widening the melody.
    if (stage >= 2 && (index === 2 || index === 6)) {
      this.tone(semitone(root, melody + (stage === 4 ? 7 : 4) + 12),
        at + config.beat * 0.31, config.beat * 0.79, 0.008 + stage * 0.001,
        "sine", this.musicBus, { pan: 0.3 });
    }
    if (stage === 4 && index % 4 === 0) {
      for (const interval of [0, 4, 7])
        this.tone(semitone(root, interval + 12), at, config.beat * 1.9,
          0.006, "sine", this.musicBus);
    }
  }

  tone(frequency, at, duration, volume, type = "sine", destination = null,
    { pan = 0, endFrequency = null } = {}) {
    const c = this.context;
    if (!c || c.state === "closed" || this.muted || this.paused) return;
    const oscillator = c.createOscillator();
    const envelope = c.createGain();
    const start = Math.max(c.currentTime, at);
    const end = start + Math.max(0.025, duration);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency), end - 0.01);
    envelope.gain.setValueAtTime(0.00001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.018, duration * 0.16));
    envelope.gain.exponentialRampToValueAtTime(0.00001, end);
    oscillator.connect(envelope);
    let panner = null;
    if (pan && c.createStereoPanner) {
      panner = c.createStereoPanner();
      panner.pan.value = pan;
      envelope.connect(panner);
      panner.connect(destination || this.master);
    } else envelope.connect(destination || this.master);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
      panner?.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  breath(at, duration, volume, center = 680) {
    const c = this.context;
    if (!c || !this.noiseBuffer || this.muted || this.paused) return;
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.value = center;
    filter.Q.value = 0.85;
    const start = Math.max(c.currentTime, at);
    gain.gain.setValueAtTime(0.00001, start);
    gain.gain.linearRampToValueAtTime(volume, start + duration * 0.32);
    gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  event(kind, detail = {}) {
    const c = this.context;
    if (!c || c.state === "closed" || this.muted || this.paused) return;
    const now = c.currentTime;
    const minGap = {
      contact: 0.42, closePass: 0.45, danger: 1.3,
      reunion: 1, brake: 0.45,
    }[kind] || 0;
    if (now - (this.lastEvent.get(kind) ?? -Infinity) < minGap) return;
    this.lastEvent.set(kind, now);
    const voiceTap = kind === "call" || kind === "callEmpty";
    const sinceVoice = now - (this.lastEvent.get("voiceTap") ?? -Infinity);
    // Every tap receives a cue. Closely stacked shouts use shorter, quieter
    // voices so a fast five-tap burst stays below the limiter.
    const voiceGain = sinceVoice < .08 ? .4 : sinceVoice < .24 ? .68 : 1;
    if (voiceTap) this.lastEvent.set("voiceTap", now);
    const root = STAGES[this.stage].root;
    if (kind === "start") {
      this.tone(semitone(root, 12), now, 0.24, 0.018, "sine");
      this.tone(semitone(root, 19), now + 0.13, 0.34, 0.02, "triangle");
    } else if (kind === "call") {
      // The rising voice is answered by a higher note when someone yields.
      this.tone(392, now, 0.13, 0.026 * voiceGain, "sine", null,
        { endFrequency: 440 });
      this.tone(523.25, now + 0.08, 0.2, 0.026 * voiceGain, "triangle", null,
        { endFrequency: 659.25 });
      this.breath(now + 0.04, 0.34, 0.058 * voiceGain, 950);
      this.tone(783.99, now + 0.2, 0.2, 0.015 * voiceGain, "sine");
      const responders = Math.max(1, Number(detail.count || detail.responders || 1));
      if (responders > 1)
        this.tone(987.77, now + 0.24, 0.14, 0.007 * voiceGain, "sine");
    } else if (kind === "callEmpty") {
      this.tone(392, now, 0.085, 0.013 * voiceGain, "sine");
      this.breath(now, 0.12, 0.012 * voiceGain, 760);
    } else if (kind === "contact") {
      this.tone(174.61, now, 0.22, 0.029, "triangle", null,
        { endFrequency: 123.47 });
      this.breath(now, 0.14, 0.025, 280);
    } else if (kind === "closePass") {
      this.tone(659.25, now, 0.095, 0.009, "sine");
      this.tone(880, now + 0.07, 0.14, 0.009, "sine");
      const streak = Math.min(3, Math.max(1, Number(detail.streak) || 1));
      if (streak > 1)
        this.tone(streak >= 3 ? 1318.51 : 1174.66,
          now + 0.16, 0.13, streak >= 3 ? 0.007 : 0.005, "sine");
    } else if (kind === "reunion") {
      this.tone(440, now, 0.24, 0.016, "sine");
      this.tone(587.33, now + 0.13, 0.27, 0.016, "sine");
      this.tone(783.99, now + 0.26, 0.35, 0.015, "triangle");
    } else if (kind === "danger") {
      this.tone(110, now, 0.24, 0.019, "sine", null,
        { endFrequency: 92.5 });
    } else if (kind === "brake") {
      this.breath(now, 0.16, 0.015, 440);
    } else if (kind === "stageClear" || kind === "finale") {
      const final = kind === "finale";
      const notes = final ? [0, 4, 7, 12, 11, 12, 16, 19, 24]
        : [0, 4, 7, 12];
      const beat = final ? 0.18 : 0.19;
      notes.forEach((interval, i) => {
        this.tone(semitone(root, interval + 12), now + i * beat,
          i === notes.length - 1 ? (final ? 1.65 : 0.95) : 0.36,
          0.022, i === notes.length - 1 ? "triangle" : "sine");
      });
      if (final) {
        [0, 4, 7, 12].forEach((interval) =>
          this.tone(semitone(root, interval), now + notes.length * beat - beat,
            1.7, 0.011, "sine"));
        this.breath(now + 1.15, 1.2, 0.035, 1400);
      }
    }
  }

  stopVoices() {
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* May already have ended. */ }
    }
    this.voices.clear();
  }

  destroy() {
    this.stopVoices();
    try { this.airSource?.stop(); } catch { /* May already have ended. */ }
    this.context?.close().catch(() => {});
    this.context = null;
  }
}
