'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { levels, onPlayingChange, startClock, type Levels } from './audio';
import { splashDone, splashDoneServer, subscribeSplash } from './splash';

/**
 * The shared analyser, handed out as a stable mutable object rather than as
 * state — nothing that reads it should re-render sixty times a second. Read it
 * inside your own rAF or useFrame.
 *
 * Calling this also starts the single rAF that keeps `levels` current, so
 * something permanently mounted has to call it — the rail does.
 */
export function useLevels(): Levels {
  useEffect(() => {
    startClock();
  }, []);
  return levels;
}

/** Only the on/off flag, which genuinely does belong in React state. */
export function usePlaying(): boolean {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const off = onPlayingChange(setPlaying);
    return () => {
      off();
    };
  }, []);
  return playing;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Read straight from the media query rather than mirroring it into state in an
 * effect, which would render once with the wrong answer and then again with the
 * right one. On the server it is false, which is the safe default: motion is
 * only ever added after hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Adds `.in` once the element has been on screen. One reveal, never repeated. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Which section is currently in view, for the rail's marker. */
export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/**
 * True once the opening wave has left the screen. The 3D hero waits on it, so
 * that evaluating three.js cannot stall the wave — see `lib/splash.ts`.
 */
export function useSplashDone(): boolean {
  return useSyncExternalStore(subscribeSplash, splashDone, splashDoneServer);
}
