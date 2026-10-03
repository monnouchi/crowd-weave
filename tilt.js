// Sensor values stay in memory; this module makes no network requests.
export async function tiltPermission(environment = globalThis) {
  const Event = environment.DeviceOrientationEvent;
  if (!environment.isSecureContext || !Event) return "unsupported";
  try {
    return typeof Event.requestPermission === "function"
      ? await Event.requestPermission()
      : "granted";
  } catch {
    return "denied";
  }
}
export class TiltState {
  constructor() {
    this.reset();
  }
  reset() {
    this.neutral = null;
    this.value = 0;
    this.last = null;
    this.angle = null;
    this.axis = 0;
    this.brakes = new Set();
  }
  recenter() {
    this.neutral = this.last === null ? null : this.value;
    this.axis = 0;
    this.brakes.clear();
  }
  sample(beta, gamma, angle, now) {
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return false;
    const radians = (angle * Math.PI) / 180,
      value = gamma * Math.cos(radians) + beta * Math.sin(radians);
    if (this.angle !== angle) {
      this.neutral = null;
      this.axis = 0;
      this.brakes.clear();
    }
    this.angle = angle;
    this.value = value;
    if (this.neutral === null) this.neutral = value;
    const offset = Math.max(-30, Math.min(30, value - this.neutral));
    const target =
      Math.abs(offset) < 3
        ? 0
        : Math.sign(offset) * Math.min(1, (Math.abs(offset) - 3) / 17);
    const dt =
      this.last === null
        ? 0.025
        : Math.max(0, Math.min(0.1, (now - this.last) / 1000));
    this.axis += (target - this.axis) * (1 - Math.exp(-dt * 10));
    this.last = now;
    return true;
  }
  read(now) {
    if (this.last === null || now - this.last > 900)
      return { left: false, right: false, axis: 0, stale: true };
    if (this.brakes.size)
      return { left: true, right: true, axis: 0, stale: false };
    return {
      left: this.axis < -0.025,
      right: this.axis > 0.025,
      axis: Math.abs(this.axis) < 0.025 ? 0 : this.axis,
      stale: false,
    };
  }
}
