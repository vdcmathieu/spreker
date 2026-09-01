'use client';

import { useEffect, useRef, useState } from 'react';
import { DROPS, RELEASE, drawWave, type Surface } from '@/lib/wave';
import { markSplashDone } from '@/lib/splash';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The first pressure wave.
 *
 * The page opens on a still surface — the same dot lattice the room instrument
 * draws its site grid on — and one drop lands in the middle of it. The rings
 * that go out are the room instrument's rings, arriving before the room: a
 * circular wave spreading from a source, losing amplitude as it spreads,
 * carrying pressure in its colour. Sodium on the crest, violet in the trough,
 * exactly as everywhere else on the page.
 *
 * It is purely visual — `pointer-events: none` throughout, `aria-hidden`, and
 * held for under two seconds whatever happens. The markup is server-rendered so
 * it covers the first paint, and the fallback animation in globals.css takes it
 * away again even if this script never runs.
 */

/** Long enough to watch the wave leave, and for the second drop to land. */
const MIN_HOLD = 1600;
/** Never keep the page behind it longer than this, ready or not. */
const MAX_HOLD = 2800;
const FADE = 900;

/**
 * One speed, set so the front is still crossing the screen when the page is
 * revealed — a wave that has already run off the edges leaves the splash
 * waiting on an empty screen. It is set from the diagonal because a fixed pixel
 * speed crosses a phone in a blink and never clears a desktop.
 */
function surfaceOf(): Surface {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { w, h, cx: w / 2, cy: h * 0.46, speed: Math.hypot(w, h) / 2.8 };
}

const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);

export function Splash() {
  const [gone, setGone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const host = root.current;
    // Not mounted at all, which means reduced motion: the page is simply there,
    // and everything waiting on the wave should stop waiting.
    if (!host) {
      markSplashDone();
      return;
    }

    // Hydration has happened, so the no-JS fallback fade is no longer needed.
    host.style.animation = 'none';

    // The canvas is made here rather than rendered: control of a canvas can be
    // handed to a worker exactly once, and in development this effect runs
    // twice. A canvas that belongs to the effect is a fresh one every time.
    const cvs = document.createElement('canvas');
    cvs.className = 'absolute inset-0 h-full w-full';
    // Promoted to its own layer: the worker's frames only reach the screen
    // while the main thread is busy if the compositor owns the canvas.
    cvs.style.transform = 'translateZ(0)';
    host.prepend(cvs);

    let resize = () => {};
    let release = () => {};
    let stop = () => {};

    // The wave belongs in a worker: the first second of this page is one long
    // task — hydration, then three.js — and an animation on the main thread
    // stalls right in the middle of it. Where that is not available, the same
    // draw runs here and takes the stall.
    let worker: Worker | null = null;
    if (typeof Worker !== 'undefined' && 'transferControlToOffscreen' in cvs) {
      try {
        worker = new Worker(new URL('./splash.worker.ts', import.meta.url));
        const offscreen = cvs.transferControlToOffscreen();
        const w = worker;
        w.postMessage({ type: 'init', canvas: offscreen, surface: surfaceOf(), dpr: dprOf() }, [
          offscreen,
        ]);
        resize = () => w.postMessage({ type: 'resize', surface: surfaceOf(), dpr: dprOf() });
        release = () => w.postMessage({ type: 'release' });
        stop = () => {
          w.postMessage({ type: 'stop' });
          w.terminate();
        };
      } catch {
        worker = null;
      }
    }

    // Only ever reached when the worker was not taken up; a canvas whose
    // control went to a worker has no context of its own.
    let ctx: CanvasRenderingContext2D | null = null;
    if (!worker) {
      try {
        ctx = cvs.getContext('2d');
      } catch {
        ctx = null;
      }
    }
    if (ctx) {
      const drops = DROPS.map((d) => ({ ...d }));
      const t0 = performance.now();
      let surface = surfaceOf();
      let raf = 0;
      resize = () => {
        surface = surfaceOf();
        const dpr = dprOf();
        cvs.width = Math.round(surface.w * dpr);
        cvs.height = Math.round(surface.h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        drawWave(ctx, surface, drops, (performance.now() - t0) / 1000);
      };
      loop();
      release = () => drops.push({ ...RELEASE, born: (performance.now() - t0) / 1000 });
      stop = () => cancelAnimationFrame(raf);
    }

    window.addEventListener('resize', resize);

    // ---- Lifecycle -------------------------------------------------------
    const started = performance.now();
    let dismissed = false;
    let unmount = 0;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      // One last ring goes out with the overlay, rather than the wave simply
      // being switched off mid-travel.
      release();
      host.classList.add('splash-out');
      // The rig is asked for as the overlay starts leaving, not after: three.js
      // then evaluates behind a wash-out that runs on the compositor, and the
      // hero is complete a moment after it is uncovered rather than half a
      // second later.
      markSplashDone();
      unmount = window.setTimeout(() => setGone(true), FADE);
    };

    const cap = window.setTimeout(dismiss, MAX_HOLD);
    const loaded =
      document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise<void>((res) => {
            window.addEventListener('load', () => res(), { once: true });
          });
    let hold = 0;
    void Promise.all([loaded, document.fonts?.ready]).then(() => {
      hold = window.setTimeout(dismiss, Math.max(0, MIN_HOLD - (performance.now() - started)));
    });

    return () => {
      stop();
      cvs.remove();
      window.removeEventListener('resize', resize);
      clearTimeout(cap);
      clearTimeout(hold);
      clearTimeout(unmount);
    };
  }, []);

  // Reduced motion gets no wave and no wait: the page is simply there. The
  // media query is read during render, so the overlay is never mounted at all
  // rather than mounted and then torn out.
  if (gone || reduced) return null;

  return (
    <div ref={root} className="splash" aria-hidden="true">
      <span
        className="label absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
        style={{
          letterSpacing: '0.42em',
          textIndent: '0.42em',
          color: 'rgba(237,233,242,0.82)',
          animation: 'splash-mark 700ms var(--ease-out-cabinet) 260ms both',
        }}
      >
        Spreker
      </span>
    </div>
  );
}
