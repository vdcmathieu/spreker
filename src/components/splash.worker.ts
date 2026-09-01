/**
 * The splash wave, drawn off the main thread onto a transferred canvas.
 *
 * Workers have no requestAnimationFrame, so the loop is a timer; every frame is
 * computed from the clock rather than from a frame count, so the jitter of a
 * timer never shows.
 */
import { DROPS, RELEASE, drawWave, type Drop, type Surface } from '../lib/wave';

type Init = { type: 'init'; canvas: OffscreenCanvas; surface: Surface; dpr: number };
type Resize = { type: 'resize'; surface: Surface; dpr: number };
type Release = { type: 'release' };
type Stop = { type: 'stop' };

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvas: OffscreenCanvas | null = null;
let surface: Surface | null = null;
let drops: Drop[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let t0 = 0;

function size(dpr: number) {
  if (!canvas || !ctx || !surface) return;
  canvas.width = Math.round(surface.w * dpr);
  canvas.height = Math.round(surface.h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tick() {
  if (!ctx || !surface) return;
  drawWave(ctx, surface, drops, (performance.now() - t0) / 1000);
  timer = setTimeout(tick, 16);
}

self.onmessage = ({ data }: MessageEvent<Init | Resize | Release | Stop>) => {
  if (data.type === 'init') {
    canvas = data.canvas;
    ctx = canvas.getContext('2d');
    surface = data.surface;
    drops = DROPS.map((d) => ({ ...d }));
    t0 = performance.now();
    size(data.dpr);
    tick();
  } else if (data.type === 'resize') {
    surface = data.surface;
    size(data.dpr);
  } else if (data.type === 'release') {
    drops.push({ ...RELEASE, born: (performance.now() - t0) / 1000 });
  } else if (data.type === 'stop') {
    clearTimeout(timer);
    self.close();
  }
};
