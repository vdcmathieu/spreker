'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { RigModel } from './RigModel';
import type { Rig } from '@/lib/rigs';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The canvas. Renders on demand only while it is on screen, caps the pixel
 * ratio, and falls back to a single static frame when reduced motion is asked
 * for. Nothing on the page depends on it: every control has a text equivalent.
 */
export function RigStage({
  rig,
  className,
  cameraZ = 3.1,
  interactive = true,
}: {
  rig: Rig;
  className?: string;
  cameraZ?: number;
  interactive?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: '160px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        shadows
        frameloop={reduced ? 'demand' : onScreen ? 'always' : 'never'}
        camera={{ position: [0, 0.25, cameraZ], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <RigModel rig={rig} interactive={interactive && !reduced} />
        </Suspense>
      </Canvas>
    </div>
  );
}
