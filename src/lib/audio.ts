/**
 * The one analyser the whole page reads from.
 *
 * There is no audio file. The loop is synthesised live from oscillators and
 * filtered noise, so nothing is fetched, nothing is licensed, and the FFT the
 * page animates against is genuinely the FFT of what you are hearing.
 *
 * Sound is opt-in and starts silent: the context is only created on a real user
 * gesture. With sound off, `levels` still moves — a slow simulated envelope, so
 * the page breathes rather than sitting dead — unless the visitor has asked for
 * reduced motion, in which case it stays flat.
 */

export type Levels = {
  /** 0–1, roughly 30–120 Hz. Drives cone excursion and the type's width axis. */
  bass: number;
  /** 0–1, roughly 200–2k. */
  mid: number;
  /** 0–1, above 4k. */
  high: number;
  /** 0–1 broadband. */
  rms: number;
  /** Rises to 1 on each kick and decays. Used for the ripple emitter. */
  beat: number;
  playing: boolean;
};

export const levels: Levels = { bass: 0, mid: 0, high: 0, rms: 0, beat: 0, playing: false };

const BPM = 124;
const SPB = 60 / BPM;

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let master: GainNode | null = null;
let bins: Uint8Array<ArrayBuffer> | null = null;
let schedulerId: number | null = null;
let rafId: number | null = null;
let step = 0;
let nextNoteTime = 0;
let lastKickAt = 0;
const listeners = new Set<(playing: boolean) => void>();

function reducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// --- voices ---------------------------------------------------------------

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

let noise2s: AudioBuffer | null = null;

function kick(c: AudioContext, out: AudioNode, t: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.45);
}

function sub(c: AudioContext, out: AudioNode, t: number, hz: number, len: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(hz, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.34, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function hat(c: AudioContext, out: AudioNode, t: number, open: boolean) {
  const src = c.createBufferSource();
  src.buffer = noise2s!;
  src.playbackRate.value = 1.6;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7200;
  const g = c.createGain();
  const len = open ? 0.16 : 0.045;
  g.gain.setValueAtTime(open ? 0.16 : 0.24, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(hp).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + len + 0.02);
}

function clap(c: AudioContext, out: AudioNode, t: number) {
  const src = c.createBufferSource();
  src.buffer = noise2s!;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1700;
  bp.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + 0.24);
}

function stab(c: AudioContext, out: AudioNode, t: number, root: number) {
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2600, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
  lp.Q.value = 6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  // minor seventh, voiced tight
  for (const semis of [0, 3, 7, 10]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = root * 2 ** (semis / 12);
    osc.detune.value = (Math.random() - 0.5) * 12;
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + 0.36);
  }
  lp.connect(g).connect(out);
}

// --- the loop -------------------------------------------------------------

/** Sixteen steps of a bar. The bassline follows an A minor walk. */
const BASS: (number | null)[] = [
  55, null, null, 55, null, 73.42, null, null,
  49, null, null, 49, null, 65.41, null, null,
];

function scheduleStep(c: AudioContext, out: AudioNode, s: number, t: number) {
  if (s % 4 === 0) {
    kick(c, out, t);
    lastKickAt = t;
  }
  if (s % 4 === 2) hat(c, out, t, s % 8 === 6);
  if (s % 8 === 4) clap(c, out, t);
  const b = BASS[s];
  if (b) sub(c, out, t, b, s % 4 === 0 ? 0.22 : 0.16);
  if (s === 6 || s === 14) stab(c, out, t, 220);
  if (s === 11) stab(c, out, t, 174.61);
}

function scheduler() {
  if (!ctx || !master) return;
  while (nextNoteTime < ctx.currentTime + 0.12) {
    scheduleStep(ctx, master, step % 16, nextNoteTime);
    nextNoteTime += SPB / 4;
    step++;
  }
}

// --- level extraction -----------------------------------------------------

function bandAverage(from: number, to: number): number {
  if (!bins || !analyser || !ctx) return 0;
  const nyquist = ctx.sampleRate / 2;
  const lo = Math.max(0, Math.floor((from / nyquist) * bins.length));
  const hi = Math.min(bins.length - 1, Math.ceil((to / nyquist) * bins.length));
  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += bins[i];
  return sum / (hi - lo + 1) / 255;
}

/** Asymmetric smoothing: fast attack, slow release, so hits feel like hits. */
function follow(current: number, target: number, attack: number, release: number) {
  const k = target > current ? attack : release;
  return current + (target - current) * k;
}

/**
 * Running auto-gain.
 *
 * A four-on-the-floor loop keeps the bottom two octaves lit almost continuously,
 * so the raw band average sits near its ceiling and barely moves — which made
 * the headline's width axis a constant offset rather than a breath. Tracking a
 * slowly decaying maximum and a slowly rising minimum measures the modulation
 * instead of the absolute level, and gives the full range back whatever is
 * playing.
 */
class AutoGain {
  private hi = 0.2;
  private lo = 0;

  read(raw: number): number {
    this.hi = Math.max(raw, this.hi * 0.9985);
    this.lo = Math.min(raw, this.lo * 0.998 + 0.0008);
    const span = Math.max(0.06, this.hi - this.lo);
    return Math.max(0, Math.min(1, (raw - this.lo) / span));
  }
}

const bassGain = new AutoGain();
const midGain = new AutoGain();
const rmsGain = new AutoGain();

let simPhase = 0;

function tick() {
  rafId = requestAnimationFrame(tick);

  if (ctx && analyser && bins && levels.playing) {
    analyser.getByteFrequencyData(bins);
    levels.bass = follow(levels.bass, bassGain.read(bandAverage(30, 120)) ** 1.25, 0.62, 0.085);
    levels.mid = follow(levels.mid, midGain.read(bandAverage(200, 2000)), 0.45, 0.08);
    levels.high = follow(levels.high, bandAverage(4000, 12000), 0.5, 0.12);
    levels.rms = follow(levels.rms, rmsGain.read(bandAverage(30, 12000)), 0.45, 0.07);
    const since = ctx.currentTime - lastKickAt;
    levels.beat = since >= 0 && since < 0.5 ? Math.max(0, 1 - since / 0.5) ** 2 : 0;
    return;
  }

  // Sound off: a slow envelope so nothing on the page looks broken. Flat for
  // anyone who has asked for reduced motion.
  if (reducedMotion()) {
    levels.bass = levels.mid = levels.high = levels.rms = levels.beat = 0;
    return;
  }
  simPhase += 1 / 60;
  const pulse = (Math.sin(simPhase * Math.PI * 2 * (BPM / 60) * 0.5) + 1) / 2;
  levels.bass = follow(levels.bass, pulse ** 3 * 0.55, 0.08, 0.035);
  levels.mid = follow(levels.mid, pulse * 0.2, 0.05, 0.03);
  levels.high = follow(levels.high, 0.08, 0.05, 0.03);
  levels.rms = follow(levels.rms, pulse * 0.26, 0.05, 0.03);
  levels.beat = levels.bass;
}

/**
 * One pulse per kick, for anything that emits a ring.
 *
 * A level test alone does not work for both states: the kick sends `beat`
 * straight to 1, while the simulated envelope with the sound off only ever
 * reaches about 0.4, so a threshold high enough to catch one kick per bar left
 * the page silent-still and the instrument's rings never came at all. An upward
 * crossing of a low threshold fires exactly once either way.
 */
export function beatEdge(threshold = 0.26, gap = 0.24) {
  let prev = 0;
  let last = -gap;
  return (now: number) => {
    const b = levels.beat;
    const hit = b > threshold && prev <= threshold && now - last > gap;
    prev = b;
    if (hit) last = now;
    return hit;
  };
}

export function startClock() {
  if (rafId === null && typeof window !== 'undefined') tick();
}

// --- public controls ------------------------------------------------------

export function isPlaying() {
  return levels.playing;
}

export function onPlayingChange(fn: (playing: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function announce() {
  for (const fn of listeners) fn(levels.playing);
}

export async function turnOn() {
  if (levels.playing) return;
  if (!ctx) {
    ctx = new AudioContext();
    noise2s = noiseBuffer(ctx, 2);
    master = ctx.createGain();
    master.gain.value = 0;
    // A gentle shelf off the very bottom keeps laptop speakers from farting.
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 32;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    bins = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    master.connect(hp);
    hp.connect(analyser);
    analyser.connect(ctx.destination);
    step = 0;
  }
  await ctx.resume();
  nextNoteTime = ctx.currentTime + 0.06;
  master!.gain.cancelScheduledValues(ctx.currentTime);
  master!.gain.setValueAtTime(0.0001, ctx.currentTime);
  master!.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.9);
  schedulerId = window.setInterval(scheduler, 25);
  levels.playing = true;
  announce();
}

export function turnOff() {
  if (!ctx || !master || !levels.playing) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  if (schedulerId !== null) window.clearInterval(schedulerId);
  schedulerId = null;
  levels.playing = false;
  announce();
}

export function toggle() {
  return levels.playing ? (turnOff(), Promise.resolve()) : turnOn();
}
