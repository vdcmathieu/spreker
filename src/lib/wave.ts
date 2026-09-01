/**
 * The opening wave: a drop in still water, drawn on a dot lattice.
 *
 * This module knows nothing about the DOM, because it runs in a worker. The
 * page's first second is one long task — hydration, then three.js — so an
 * animation driven from the main thread freezes for a third of a second right
 * in the middle of the wave. Off the main thread it cannot.
 */

export type Drop = {
  /** Seconds after the wave starts. */
  born: number;
  /** Peak radial displacement, in CSS pixels. */
  amp: number;
  /** Crest-to-crest distance, in CSS pixels. */
  length: number;
  /** Length of the trailing wake behind the front, in CSS pixels. */
  packet: number;
};

export type Surface = {
  w: number;
  h: number;
  /** The drop point. */
  cx: number;
  cy: number;
  /** Front speed in pixels per second. */
  speed: number;
};

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * The rock, the small rebound droplet it throws back up, and two more stones
 * after it — four fronts crossing each other, so the surface never goes quiet
 * for as long as the splash is held.
 */
export const DROPS: Drop[] = [
  { born: 0, amp: 21, length: 108, packet: 150 },
  { born: 0.36, amp: 8, length: 74, packet: 100 },
  { born: 0.95, amp: 16, length: 96, packet: 132 },
  { born: 1.7, amp: 11, length: 84, packet: 116 },
];

/** The ring that goes out with the overlay when the page is ready. */
export const RELEASE: Omit<Drop, 'born'> = { amp: 13, length: 94, packet: 130 };

/** Below this displacement a dot is drawn as undisturbed water. */
const AT_REST = 0.2;
/** Water ahead of the front is still, so the leading edge is much steeper. */
const LEAD = 0.34;

const CREST: [number, number, number] = [255, 158, 44]; // sodium — compression
const TROUGH: [number, number, number] = [124, 74, 233]; // uv — rarefaction

/**
 * How loudly the water is drawn. The splash owns the screen and is drawn at
 * full strength; the same surface behind the hero is the page's ground rather
 * than its subject, so everything about it is turned down.
 */
export type Look = {
  /** Lattice spacing, in CSS pixels. */
  spacing: number;
  /** The undisturbed lattice. */
  rest: string;
  /** Multiplies the alpha of every moving dot. */
  gain: number;
  /** Multiplies the crest rings; 0 draws none. */
  rings: number;
  /** The point of impact, for the moment a drop lands. */
  impact: boolean;
};

export const FULL: Look = {
  spacing: 20,
  rest: 'rgba(237,233,242,0.055)',
  gain: 1,
  rings: 1,
  impact: true,
};

export const GROUND: Look = {
  spacing: 24,
  rest: 'rgba(237,233,242,0.05)',
  gain: 0.78,
  rings: 0.9,
  impact: false,
};

/** Surface displacement at radius r, summed over every drop in the water. */
function height(drops: Drop[], r: number, now: number, speed: number) {
  let sum = 0;
  for (const d of drops) {
    const age = now - d.born;
    if (age <= 0) continue;
    const x = r - age * speed; // distance ahead of the front
    if (x > d.packet * 1.4 || x < -d.packet * 2.6) continue;
    const sigma = d.packet * (x > 0 ? LEAD : 1);
    // A packet with a steep face and a wake, spreading loss with distance, and
    // a life, so the water settles rather than ringing for ever.
    const env = Math.exp(-((x / sigma) ** 2)) / Math.sqrt(1 + r / 240) / (1 + age * 0.42);
    sum += d.amp * env * Math.sin((2 * Math.PI * x) / d.length);
  }
  return sum;
}

/** Brightness steps the moving dots are sorted into, per direction. */
const STEPS = 7;
const bins: number[][] = Array.from({ length: STEPS * 2 }, () => []);

export function drawWave(ctx: Ctx, s: Surface, drops: Drop[], now: number, look: Look = FULL) {
  const { w, h, cx, cy, speed } = s;
  const { spacing } = look;
  ctx.clearRect(0, 0, w, h);

  // Everything still, in one path and one colour — most of the surface.
  ctx.beginPath();
  const moved: { x: number; y: number; d: number }[] = [];
  for (let y = spacing / 2; y < h; y += spacing) {
    for (let x = spacing / 2; x < w; x += spacing) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      const disp = r < 1 ? 0 : height(drops, r, now, speed);
      if (Math.abs(disp) < AT_REST) {
        ctx.rect(x - 0.75, y - 0.75, 1.5, 1.5);
      } else {
        // The dot rides the wave: pushed out on the crest, drawn back into the
        // trough, along the line from the drop.
        moved.push({ x: x + (dx / r) * disp, y: y + (dy / r) * disp, d: disp });
      }
    }
  }
  ctx.fillStyle = look.rest;
  ctx.fill();

  // The disturbed water. Hue carries pressure here as everywhere else, so the
  // crest is sodium and the trough is violet.
  //
  // Sorted into a handful of brightness steps first: setting `fillStyle` costs
  // a colour parse every time, and a few hundred of those a frame is the
  // difference between this being free and it costing the page eight frames a
  // second.
  for (const bin of bins) bin.length = 0;
  for (const p of moved) {
    const a = Math.min(1, Math.abs(p.d) / 14);
    const step = Math.min(STEPS - 1, Math.floor(a * STEPS));
    const size = 1.5 + a * 2.3;
    const bin = bins[(p.d > 0 ? 0 : STEPS) + step];
    bin.push(p.x - size / 2, p.y - size / 2, size);
  }
  for (let i = 0; i < bins.length; i++) {
    const bin = bins[i];
    if (!bin.length) continue;
    const c = i < STEPS ? CREST : TROUGH;
    const a = ((i % STEPS) + 0.5) / STEPS;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${((0.1 + a * 0.72) * look.gain).toFixed(3)})`;
    for (let j = 0; j < bin.length; j += 3) ctx.fillRect(bin[j], bin[j + 1], bin[j + 2], bin[j + 2]);
  }

  // The crests as rings, so the wave is unmistakably circular.
  ctx.lineWidth = 1;
  for (const d of look.rings ? drops : []) {
    const age = now - d.born;
    if (age <= 0) continue;
    const front = age * speed;
    for (let k = 0; k < 3; k++) {
      const rad = front - k * d.length;
      if (rad < 4) continue;
      const alpha =
        ((d.amp / 21) * (1 - k * 0.3) * 0.3 * look.rings) /
        Math.sqrt(1 + rad / 240) /
        (1 + age * 0.42);
      if (alpha < 0.004) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,158,44,${alpha})`;
      ctx.stroke();
    }
  }

  // The impact itself: one amber point per drop, gone almost at once.
  if (look.impact) {
    for (const d of drops) {
      const age = now - d.born;
      if (age < 0 || age > 0.3) continue;
      const f = 1 - age / 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + (1 - f) * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,158,44,${f * 0.9})`;
      ctx.fill();
    }
  }
}
