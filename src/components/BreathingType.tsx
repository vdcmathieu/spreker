'use client';

import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { levels } from '@/lib/audio';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The signature. Archivo carries a `wdth` axis, and the bass drives it: the
 * headline physically widens on every kick. Cone excursion, rendered as type.
 *
 * The range is deliberately narrow — a few percent of width — because the point
 * is that the words feel like they are moving air, not that they flail.
 */
export function BreathingType({
  as: Tag = 'h1',
  className = '',
  base = 105,
  travel = 18,
  children,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
  className?: string;
  base?: number;
  travel?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

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
      className={`display ${className}`}
      style={{ ['--wdth' as string]: base }}
    >
      {children}
    </Component>
  );
}
