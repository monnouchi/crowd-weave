// Original synthesized notes; no recordings or third-party music.
export class GameAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.nextNote = 0;
    this.note = 0;
    this.active = false;
    this.braking = false;
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
  tone(frequency, duration = 0.12, volume = 0.025, delay = 0, type = "sine") {
    const c = this.context;
    if (!c || this.muted || c.state !== "running") return;
    const o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime + delay;
    o.type = type;
    o.frequency.value = frequency;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  effect(kind) {
    if (kind === "contact") {
      this.tone(165, 0.14, 0.04, 0, "triangle");
      this.tone(125, 0.16, 0.025, 0.08, "triangle");
    }
    if (kind === "brake") this.tone(220, 0.08, 0.012);
    if (kind === "goal")
      [392, 494, 587, 784].forEach((n, i) =>
        this.tone(n, 0.22, 0.035, i * 0.1),
      );
  }
  update(playing, braking) {
    const c = this.context;
    if (!playing) {
      this.active = false;
      this.nextNote = 0;
      this.braking = false;
      return;
    }
    if (braking && !this.braking) this.effect("brake");
    this.braking = braking;
    if (!c || this.muted || c.state !== "running") return;
    this.active = true;
    if (c.currentTime >= this.nextNote) {
      const melody = [220, 330, 247, 294, 220, 349, 294, 247];
      this.tone(
        melody[this.note++ % melody.length],
        0.18,
        0.009,
        0,
        "triangle",
      );
      this.nextNote = c.currentTime + 0.38;
    }
  }
  suspend() {
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
