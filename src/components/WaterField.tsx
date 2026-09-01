'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { beatEdge, levels } from '@/lib/audio';
import { GROUND, drawWave, type Drop, type Surface } from '@/lib/wave';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The hero's ground: the same still water the page opens on, kept quiet.
 *
 * The drops are not decorative. They leave the cabinet, one on every kick, at
 * the moment the cone moves — the loading wave turning out to have been the
 * first of many, and the same claim the room instrument makes further down the
 * page, made here in the hero. With the sound off they still come, on the
 * simulated envelope, so the water is alive before anything is turned on.
 */

/** Rings older than this are dropped; the water settles rather than ringing. */
const LIFE = 5.5;
/** Never carry more than a handful of fronts at once. */
const MAX_DROPS = 5;

export function WaterField({
  source,
  className = '',
}: {
  /** What the waves leave from - the rig. Falls back to the middle. */
  source?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const cvs = host.current;
    if (!cvs || reduced) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const drops: Drop[] = [];
    const t0 = performance.now();
    let surface: Surface = { w: 0, h: 0, cx: 0, cy: 0, speed: 400 };
    let onScreen = true;
    let raf = 0;
    const kicked = beatEdge();
    let settled = false;

    const resize = () => {
      // Ground, not subject: a lattice of small squares gains nothing from the
      // last half of a device pixel ratio, and the fill cost is per pixel.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = cvs.getBoundingClientRect();
      cvs.width = Math.round(r.width * dpr);
      cvs.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Slower than the splash: this is a room being filled, not a stone.
      surface = { ...surface, w: r.width, h: r.height, speed: Math.hypot(r.width, r.height) / 3.4 };
      settled = false;
    };

    /** The source point, in canvas coordinates: the middle of the cabinet. */
    const aim = () => {
      const src = source?.current;
      const r = cvs.getBoundingClientRect();
      if (!src) return { cx: surface.w / 2, cy: surface.h / 2 };
      const s = src.getBoundingClientRect();
      return { cx: s.left + s.width / 2 - r.left, cy: s.top + s.height / 2 - r.top };
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      surface = { ...surface, ...aim() };
    });
    ro.observe(cvs);
    surface = { ...surface, ...aim() };

    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), {
      rootMargin: '120px',
    });
    io.observe(cvs);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!onScreen || !surface.w) return;
      const now = (performance.now() - t0) / 1000;

      if (kicked(now)) {
        drops.push({
          born: now,
          amp: 11 + levels.beat * 8,
          length: 92,
          packet: 128,
        });
        if (drops.length > MAX_DROPS) drops.shift();
        // The cabinet can be moved by a resize or a scroll-driven layout, so
        // the source is read when a wave leaves rather than once.
        surface = { ...surface, ...aim() };
        settled = false;
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        if (now - drops[i].born > LIFE) drops.splice(i, 1);
      }

      // Still water is still: with nothing travelling, the lattice is drawn
      // once and the loop costs a comparison a frame.
      if (!drops.length) {
        if (settled) return;
        settled = true;
      }
      drawWave(ctx, surface, drops, now, GROUND);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [reduced, source]);

  if (reduced) return null;

  return (
    <canvas
      ref={host}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
