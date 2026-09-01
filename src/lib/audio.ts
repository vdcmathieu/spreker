/**
 * The one analyser the whole page reads from.
 *
 * There is no audio file. The loop is synthesised live from oscillators and
 * filtered noise, so nothing is fetched, nothing is licensed, and the FFT the
 * page animates against is genuinely the FFT of what you are hearing.
 *
 * The page asks for sound as soon as it loads. Browsers do not always grant it
 * — autoplay is only allowed once a visitor has engaged with the site — so
 * `autoStart` tries, checks whether the context is genuinely running, and if it
 * is not, waits for the first real gesture anywhere on the page and tries once
 * more. Either way the button is the truth: it never says *Sound on* over
 * silence, and one press turns it off for good.
 *
 * With sound off, `levels` still moves — a slow simulated envelope, so the page
 * breathes rather than sitting dead — unless the visitor has asked for reduced
 * motion, in which case it stays flat.
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
let seatGain: GainNode | null = null;
let seatTone: BiquadFilterNode | null = null;
let babbleGain: GainNode | null = null;
let schedulerId: number | null = null;
let rafId: number | null = null;
let step = 0;
let nextNoteTime = 0;
let lastKickAt = 0;
let starting = false;
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

/**
 * The party's own noise.
 *
 * Filtered noise with a slow wobble on it — the murmur of a few hundred people,
 * which is the thing the music has to be heard over. It is deliberately *not*
 * routed through the analyser: the page's type breathes to the music, and a
 * crowd is not the music.
 *
 * This is the whole point of the room section made audible. The crowd is the
 * same loudness wherever you stand, and the music is not, so walking to the
 * back does not simply turn the music down — it lets the room swallow it.
 */
function startBabble(c: AudioContext) {
  const src = c.createBufferSource();
  src.buffer = noise2s!;
  src.loop = true;
  src.playbackRate.value = 0.6;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 620;
  bp.Q.value = 0.7;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;

  babbleGain = c.createGain();
  babbleGain.gain.value = 0;

  // A slow swell, so it reads as people rather than as hiss.
  const wobble = c.createOscillator();
  const wobbleDepth = c.createGain();
  wobble.frequency.value = 0.21;
  wobbleDepth.gain.value = 0.34;
  wobble.connect(wobbleDepth).connect(bp.frequency);
  wobble.start();

  src.connect(bp).connect(lp).connect(babbleGain).connect(c.destination);
  src.start();
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

// --- starting without being asked ----------------------------------------

/**
 * The gestures a browser accepts as engagement, in the order they arrive. A
 * scroll is not one of them: it does not grant user activation, so listening
 * for it would only mean calling `resume()` into the same refusal again.
 */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

let waiting: (() => void) | null = null;

function disarm() {
  waiting?.();
  waiting = null;
}

function arm() {
  if (waiting) return;
  const go = (e: Event) => {
    // The sound button drives itself. Starting on its pointerdown would turn
    // the sound on a moment before its own click turned it back off.
    if (e.target instanceof Element && e.target.closest('[data-sound]')) return;
    disarm();
    void turnOn();
  };
  for (const type of GESTURES) window.addEventListener(type, go, { passive: true });
  waiting = () => {
    for (const type of GESTURES) window.removeEventListener(type, go);
  };
}

/**
 * Ask for sound on arrival.
 *
 * The rig is the page, so the page arrives with it running. Autoplay policy
 * decides whether that is allowed on this visit; where it is not, the first
 * touch, click or keypress anywhere gets it, which is close enough to the same
 * thing without ever leaving the button lying about what is audible.
 */
export function autoStart() {
  if (levels.playing || waiting) return;
  // Except for anyone who asked for reduced motion. Playing turns the analyser
  // on, and the analyser is what makes the type breathe and the rings go out —
  // starting it unasked would hand back exactly the motion they turned off. The
  // button is still there, and still theirs to press.
  if (reducedMotion()) return;
  void turnOn().then((started) => {
    if (!started) arm();
  });
}

/**
 * Start the loop. Returns whether there is actually sound: a context created
 * outside a gesture stays suspended, and a page that claims to be playing when
 * it is not is worse than a page that is quiet.
 */
export async function turnOn(): Promise<boolean> {
  if (levels.playing) return true;
  // Two calls can overlap — the page asking on arrival, and a gesture arriving
  // while that ask is still waiting on the browser. Two schedulers would play
  // the loop at double tempo.
  if (starting) return false;
  starting = true;
  try {
    return await start();
  } finally {
    starting = false;
  }
}

/**
 * Wait for the context, but not for ever.
 *
 * Chrome leaves the promise from `resume()` pending indefinitely on a context
 * it has decided not to start, and Safari rejects outright; neither can simply
 * be awaited. Race it against a short wait and then ask the context what it
 * actually did.
 */
async function resume(c: AudioContext): Promise<boolean> {
  try {
    await Promise.race([c.resume(), new Promise((r) => {
        setTimeout(r, 150);
      })]);
  } catch {
    // Refused, which is one of the answers.
  }
  return c.state === 'running';
}

async function start(): Promise<boolean> {
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
    // The analyser sits *before* the listener's position, so walking to the
    // back of the garden makes the music quieter without stopping the page.
    seatGain = ctx.createGain();
    seatTone = ctx.createBiquadFilter();
    seatTone.type = 'lowpass';
    seatTone.frequency.value = 20000;
    seatTone.Q.value = 0.4;
    master.connect(hp);
    hp.connect(analyser);
    analyser.connect(seatGain);
    seatGain.connect(seatTone);
    seatTone.connect(ctx.destination);
    startBabble(ctx);
    step = 0;
  }
  if (!(await resume(ctx))) return false;
  disarm();
  nextNoteTime = ctx.currentTime + 0.06;
  master!.gain.cancelScheduledValues(ctx.currentTime);
  master!.gain.setValueAtTime(0.0001, ctx.currentTime);
  master!.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.9);
  schedulerId = window.setInterval(scheduler, 25);
  levels.playing = true;
  announce();
  return true;
}

export function turnOff() {
  // Off means off: whatever the page was still waiting for, stop waiting.
  disarm();
  if (!ctx || !master || !levels.playing) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  if (babbleGain) babbleGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  if (schedulerId !== null) window.clearInterval(schedulerId);
  schedulerId = null;
  levels.playing = false;
  announce();
}

export function toggle() {
  return levels.playing ? (turnOff(), Promise.resolve()) : turnOn();
}


// --- where you are standing -----------------------------------------------

/**
 * Put the listener somewhere in the room.
 *
 * `music` is the level arriving where they stand and `front` is the level at
 * the front of house, both in dB; the music is played back at the difference
 * between them, so standing by the box is the level the page has always played
 * at and walking away is honestly quieter. `crowd` is what the party makes by
 * itself, which does not change with distance — so the ratio between the two
 * is the thing that moves, and that ratio is the section's whole answer.
 *
 * The top end is rolled off with distance as well. Not for atmosphere: by the
 * time you are at the far fence you are well off the horn's axis, and the top
 * is the first thing to go.
 */
export function setSeat(music: number, crowd: number, front: number) {
  if (!ctx || !seatGain || !seatTone || !babbleGain) return;
  const t = ctx.currentTime;
  const db = (x: number) => 10 ** (x / 20);
  seatGain.gain.setTargetAtTime(db(music - front), t, 0.08);
  babbleGain.gain.setTargetAtTime(db(crowd - front) * 0.9, t, 0.08);
  // 18 kHz on axis at the box, down to about 4 kHz at the back of a big room.
  const off = Math.max(0, front - music);
  seatTone.frequency.setTargetAtTime(Math.max(2500, 18000 * 0.942 ** off), t, 0.08);
}

/** Step out of the room: the page sounds like the page again. */
export function clearSeat() {
  if (!ctx || !seatGain || !seatTone || !babbleGain) return;
  const t = ctx.currentTime;
  seatGain.gain.setTargetAtTime(1, t, 0.12);
  babbleGain.gain.setTargetAtTime(0, t, 0.12);
  seatTone.frequency.setTargetAtTime(20000, t, 0.12);
}
