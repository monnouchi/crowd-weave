// One original motif, arranged for each part of the journey.
export const MOTIF = [0, 7, 2, 5, 0, 9, 5, 2];
// Calibrated against rendered browser output, including effects and arrival music.
export const OUTPUT_GAIN = 11;
export const MUSIC = [
  {
    root: 220,
    beat: 0.48,
    type: "triangle",
    volume: 0.007,
    duration: 0.41,
    mood: "軽い出発",
  },
  {
    root: 247,
    beat: 0.33,
    type: "triangle",
    volume: 0.009,
    duration: 0.28,
    mood: "駅へ急ぐリズム",
  },
  {
    root: 196,
    beat: 0.56,
    type: "triangle",
    volume: 0.008,
    duration: 0.47,
    mood: "カフェのひと休み",
  },
  {
    root: 262,
    beat: 0.37,
    type: "triangle",
    volume: 0.009,
    duration: 0.31,
    mood: "会場への期待",
  },
  {
    root: 294,
    beat: 0.25,
    type: "triangle",
    volume: 0.0065,
    duration: 0.16,
    mood: "パーティーの高揚",
  },
].map((m, stage) => ({
  ...m,
  notes: MOTIF.map(
    (semitone) => m.root * (stage < 4 ? 4 : 1) * 2 ** (semitone / 12),
  ),
}));
// Original V6 arrival phrase: G major, I–V–I. Times are musical ticks.
export const ARRIVAL = [
  [0, 0, 0.75, 100],
  [1, 4, 0.45, 78],
  [2, 7, 1.25, 90],
  [4, 11, 1.5, 100],
  [6, 14, 0.6, 90],
  [7, 11, 0.6, 78],
  [8, 12, 0.75, 100],
  [10, 12, 3, 94],
];
export const FINALE = [
  [0, 0, 1.25, 100],
  [2, 4, 0.65, 90],
  [3, 7, 0.65, 78],
  [4, 12, 2.5, 100],
  [7, 7, 0.65, 82],
  [8, 11, 1.5, 100],
  [10, 14, 0.65, 90],
  [11, 7, 0.65, 78],
  [12, 14, 1.8, 100],
  [14, 11, 0.65, 88],
  [15, 11, 0.65, 78],
  [16, 12, 0.65, 100],
  [17, 7, 0.65, 78],
  [18, 4, 1.5, 90],
  [20, 7, 1.5, 100],
  [22, 12, 0.65, 90],
  [23, 4, 0.65, 78],
  [24, 7, 1.5, 100],
  [26, 2, 0.65, 88],
  [27, 7, 0.65, 78],
  [28, 11, 1.25, 94],
  [30, 11, 1.75, 90],
  [32, 12, 5, 100],
];
// Original synthesized notes; no recordings or third-party music.
export class GameAudio {
  constructor() {
    this.context = null;
    this.muted = true;
    this.nextNote = 0;
    this.note = 0;
    this.active = false;
    this.braking = false;
    this.stage = -1;
    this.voices = new Set();
    this.seenGoals = new WeakSet();
    this.hall = true;
    this.musicBus = null;
    this.musicFilter = null;
    this.outputBus = null;
    this.peakGuard = null;
  }
  output() {
    if (this.outputBus) return this.outputBus;
    const c = this.context;
    this.outputBus = c.createGain();
    this.outputBus.gain.setValueAtTime(OUTPUT_GAIN, c.currentTime);
    if (c.createDynamicsCompressor) {
      this.peakGuard = c.createDynamicsCompressor();
      this.peakGuard.threshold.value = -6;
      this.peakGuard.knee.value = 0;
      this.peakGuard.ratio.value = 20;
      this.peakGuard.attack.value = 0.002;
      this.peakGuard.release.value = 0.08;
      this.outputBus.connect(this.peakGuard);
      this.peakGuard.connect(c.destination);
    } else this.outputBus.connect(c.destination);
    return this.outputBus;
  }
  unlock() {
    if (this.muted) return;
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!this.context) this.context = new Audio();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {}
  }
  tone(
    frequency,
    duration = 0.12,
    volume = 0.025,
    delay = 0,
    type = "sine",
    music = false,
    sweep = null,
  ) {
    const c = this.context;
    if (!c || this.muted || c.state !== "running") return;
    const o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.value = frequency;
    if (sweep && o.frequency.exponentialRampToValueAtTime) {
      o.frequency.setValueAtTime(frequency, t);
      o.frequency.exponentialRampToValueAtTime(sweep, t + duration * 0.8);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    if (music && this.musicBus) {
      if (c.createStereoPanner) {
        const pan = c.createStereoPanner();
        pan.pan.value =
          this.stage === 4 && this.hall ? Math.sin(this.note) * 0.18 : 0;
        g.connect(pan);
        pan.connect(this.musicBus);
        o.panner = pan;
      } else g.connect(this.musicBus);
    } else g.connect(this.output());
    this.voices.add(o);
    o.onended = () => {
      this.voices.delete(o);
      o.disconnect();
      g.disconnect();
      o.panner?.disconnect();
    };
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  stopVoices() {
    for (const o of this.voices) {
      try {
        o.stop();
      } catch {}
    }
    this.voices.clear();
  }
  goal(stage, run) {
    if (this.seenGoals.has(run)) return;
    this.seenGoals.add(run);
    this.stopVoices();
    this.active = false;
    this.nextNote = 0;
    this.effect(stage === 4 ? "final" : "goal", stage);
  }
  effect(kind, stage = 0) {
    if (kind === "contact") {
      this.tone(165, 0.14, 0.04, 0, "triangle");
      this.tone(125, 0.16, 0.025, 0.08, "triangle");
    }
    if (kind === "regroup") {
      this.tone(330, 0.16, 0.012, 0, "sine");
      this.tone(440, 0.22, 0.014, 0.11, "sine");
    }
    if (kind === "brake") this.tone(220, 0.08, 0.012);
    if (kind === "goal" || kind === "final") {
      const band = kind === "final",
        tick = band ? 0.25 : 0.3;
      const phrase = band ? FINALE : ARRIVAL;
      for (const [at, semitone, length, accent] of phrase)
        this.tone(
          392 * 2 ** (semitone / 12),
          length * tick + (at === (band ? 32 : 10) ? 0.45 : 0.06),
          (0.023 * accent) / 100,
          at * tick,
          "triangle",
        );
      const end = band ? 32 : 10;
      for (let n = 0; n <= end; n++) {
        const dominant = band
          ? (n >= 8 && n < 16) || (n >= 24 && n < 32)
          : n >= 4 && n < 8;
        const root = 196 * 2 ** ((dominant ? 7 : 0) / 12),
          ending = n === end;
        if (band) {
          this.tone(root / 2, ending ? 1.2 : 0.22, 0.009, n * tick, "triangle");
          if (!ending && n % 4 === 0)
            this.tone(100, 0.12, 0.012, n * tick, "sine", false, 45);
          if (!ending && n % 4 === 2)
            this.tone(180, 0.08, 0.005, n * tick, "triangle");
          if (!ending) this.tone(3300, 0.025, 0.0015, n * tick, "triangle");
        }
        if (n % 4 === 0 || ending)
          for (const interval of [0, 4, 7])
            this.tone(
              root * 2 ** (interval / 12),
              ending ? 1.5 : band ? 0.48 : 0.65,
              0.007,
              n * tick,
              "sine",
            );
      }
    }
  }

  space(stage, inside) {
    const c = this.context;
    const hall = stage !== 4 || inside;
    if (!c) {
      this.hall = hall;
      return;
    }
    if (!this.musicBus) {
      this.musicBus = c.createGain();
      this.musicFilter = c.createBiquadFilter?.();
      if (this.musicFilter) {
        this.musicFilter.type = "lowpass";
        this.musicBus.connect(this.musicFilter);
        this.musicFilter.connect(this.output());
      } else this.musicBus.connect(this.output());
      this.musicBus.gain.setValueAtTime(hall ? 1 : 0.65, c.currentTime);
      this.musicFilter?.frequency.setValueAtTime(
        hall ? 6500 : 2400,
        c.currentTime,
      );
    } else if (hall !== this.hall) {
      const gain = this.musicBus.gain;
      gain.cancelScheduledValues?.(c.currentTime);
      gain.setValueAtTime(gain.value ?? (this.hall ? 1 : 0.65), c.currentTime);
      gain.linearRampToValueAtTime(hall ? 1 : 0.65, c.currentTime + 0.35);
      if (this.musicFilter) {
        const f = this.musicFilter.frequency;
        f.cancelScheduledValues(c.currentTime);
        f.setValueAtTime(f.value, c.currentTime);
        f.linearRampToValueAtTime(hall ? 6500 : 2400, c.currentTime + 0.35);
      }
    }
    this.hall = hall;
  }
  reset() {
    this.stopVoices();
    this.musicBus?.disconnect();
    this.musicFilter?.disconnect();
    this.musicBus = null;
    this.musicFilter = null;
    this.active = false;
    this.nextNote = 0;
    this.note = 0;
  }
  update(playing, braking, stage = 0, inside = true) {
    this.space(stage, inside);
    const c = this.context;
    if (!playing) {
      this.active = false;
      this.nextNote = 0;
      this.braking = false;
      return;
    }
    if (!c || this.muted || c.state !== "running") return;
    if (!this.active || this.stage !== stage) {
      this.stopVoices();
      this.nextNote = 0;
      this.note = 0;
      this.stage = stage;
    }
    if (braking && !this.braking) this.effect("brake");
    this.braking = braking;
    this.active = true;
    if (c.currentTime >= this.nextNote) {
      const music = MUSIC[stage] || MUSIC[0],
        note = this.note++;
      // Each companion brings a quiet original part into the shared motif.
      if (stage >= 1 && note % 4 === 0)
        this.tone(
          music.root * (stage < 4 ? 2 : 0.5),
          0.35,
          0.004,
          0,
          "sine",
          true,
        );
      if (stage >= 2 && note % 2 === 1)
        this.tone(
          music.notes[(note + 2) % 8] / 2,
          0.13,
          0.003,
          0.06,
          "triangle",
          true,
        );
      if (stage >= 3 && note % 4 === 2) {
        this.tone(
          music.root * (stage < 4 ? 4 : 1) * 2 ** (4 / 12),
          0.4,
          0.0015,
          0,
          "sine",
          true,
        );
        this.tone(
          music.root * (stage < 4 ? 4 : 1) * 2 ** (7 / 12),
          0.4,
          0.0015,
          0,
          "sine",
          true,
        );
      }
      if (stage === 4) {
        // An original 120-BPM eighth-note groove: kick, backbeat, hats and bass.
        if (note % 4 === 0) this.tone(140, 0.15, 0.008, 0, "sine", true, 45);
        if (note % 4 === 2) {
          this.tone(180, 0.08, 0.004, 0, "triangle", true);
          this.tone(2400, 0.035, 0.0015, 0, "triangle", true);
        }
        this.tone(note % 2 ? 3600 : 3000, 0.025, 0.001, 0, "triangle", true);
        if ([0, 3, 4, 7].includes(note % 8))
          this.tone(
            (music.root / 4) *
              2 ** ([0, 0, 7, 5][Math.floor(note / 2) % 4] / 12),
            0.18,
            0.005,
            0,
            "triangle",
            true,
          );
      }
      this.tone(
        music.notes[note % music.notes.length],
        music.duration,
        music.volume,
        0,
        music.type,
        true,
      );
      this.nextNote = c.currentTime + music.beat;
    }
  }
  suspend() {
    this.stopVoices();
    this.active = false;
    this.nextNote = 0;
    if (this.context?.state === "running")
      this.context.suspend().catch(() => {});
  }
  toggle() {
    this.muted = !this.muted;
    if (this.muted) this.suspend();
    else this.unlock();
    return this.muted;
  }
}
