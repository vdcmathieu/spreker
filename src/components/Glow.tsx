'use client';

import { useEffect, useRef } from 'react';
import { levels } from '@/lib/audio';

/**
 * The UV wash behind the rig. Ambient light in a room with a party in it does
 * not sit still, so this one breathes with the low end — the only decorative
 * use of violet on the page, and it is doing atmospheric work.
 */
export function Glow({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let drive = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = ref.current;
      if (!el) return;
      const target = Math.max(levels.beat, levels.bass * 0.7);
      // Same asymmetry as the type: the wash flares on the hit and fades.
      drive = target > drive ? target : drive + (target - drive) * 0.1;
      el.style.opacity = String(0.3 + drive * 0.42);
      el.style.transform = `scale(${1 + drive * 0.1})`;
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(109,43,245,0.55) 0%, rgba(109,43,245,0.16) 42%, rgba(7,6,11,0) 70%)',
        willChange: 'transform, opacity',
      }}
    />
  );
}
