'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from 'react';
import { levels } from '@/lib/audio';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The signature. Archivo carries a `wdth` axis, and the bass drives it: the
 * headline physically widens on every kick. Cone excursion, rendered as type.
 *
 * The range is deliberately narrow — a few percent of width — because the point
 * is that the words feel like they are moving air, not that they flail.
 *
 * `fit` sets the type to the measure. A line that only just fits at rest will
 * re-wrap on the first kick, and the whole page below it jumps by a line every
 * time the bass hits, so the size is chosen from the widest the axis will ever
 * go: never larger than the CSS clamp, and small enough that the widest line
 * still fits when the type is fully open. The breath then costs no layout at
 * all.
 */

/** The clamp is the ceiling; the fit only ever comes down from it. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function BreathingType({
  as: Tag = 'h1',
  className = '',
  base = 105,
  travel = 18,
  fit = false,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
  className?: string;
  base?: number;
  travel?: number;
  fit?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !fit) return;
    const avail = el.clientWidth;
    if (!avail) return;

    // The clamp in the class is the design's size; the fit is a ceiling on it.
    el.style.fontSize = '';
    const clamp = parseFloat(getComputedStyle(el).fontSize);

    // Measured at the widest the axis will ever open to, and at a round size so
    // the ratio is the only thing that matters.
    el.style.setProperty('--wdth', String(reduced ? base : base + travel));
    el.style.fontSize = '100px';
    const range = document.createRange();
    const lines = el.children.length ? [...el.children] : [el];
    let widest = 0;
    for (const line of lines) {
      range.selectNodeContents(line);
      widest = Math.max(widest, range.getBoundingClientRect().width);
    }
    el.style.fontSize = `${Math.min(clamp, (avail / widest) * 100).toFixed(2)}px`;
    el.style.setProperty('--wdth', String(base));
  }, [base, travel, fit, reduced]);

  useIsomorphicLayoutEffect(() => {
    if (!fit) return;
    measure();
    // Metrics before the webfont lands are the fallback's, not Archivo's.
    void document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, [fit, measure]);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let current = base;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      // The kick is the breath; the bass fills the space between kicks.
      const drive = Math.max(levels.beat, levels.bass * 0.75);
      const target = base + drive * travel;
      // Snap open, ease shut. Easing the attack as well turned a 0.5-second
      // transient into a gentle wobble that never reached the top of the axis.
      current = target > current ? target : current + (target - current) * 0.14;
      el.style.setProperty('--wdth', current.toFixed(1));
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [base, travel, reduced]);

  const Component = Tag as unknown as ComponentType<{
    ref: typeof ref;
    className: string;
    style: React.CSSProperties;
    children: ReactNode;
  }>;

  return (
    <Component
      ref={ref}
      className={`display ${fit ? 'to-measure ' : ''}${className}`}
      style={{ ['--wdth' as string]: base }}
    >
      {children}
    </Component>
  );
}
