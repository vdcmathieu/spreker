'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { RoomScene } from './RoomScene';
import type { Rig } from '@/lib/rigs';
import type { Space } from '@/lib/spl';
import { useReducedMotion } from '@/lib/hooks';

/**
 * The room instrument's canvas.
 *
 * It is not built until the section is coming up *and* the main thread has a
 * moment to spare. Standing a WebGL context up and compiling the field shaders
 * is a task long enough to be felt, and the room starts immediately under the
 * fold, so an observer alone fires at the top of the page — in the same frame
 * the opening wave leaves on and the hero's rig arrives. Two contexts in one
 * frame is a stall you can watch. The idle slot separates them. Once
 * built it renders only while it is on screen, caps the pixel ratio, and falls
 * back to a single static frame when reduced motion is asked for: the landscape
 * is still there and still readable, it simply does not drift and no wavefronts
 * leave the box.
 *
 * Nothing on the page depends on it: the panel beside it says the same thing in
 * words, and every control is reachable without it.
 */
export function RoomStage({
  rig,
  space,
  heads,
  listener,
  onMove,
  className,
}: {
  rig: Rig;
  space: Space;
  heads: number;
  listener: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  // `built` latches: a context is expensive to make and cheap to keep.
  const [built, setBuilt] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let idle = 0;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        const build = () => setBuilt(true);
        const rIC = window.requestIdleCallback;
        idle = rIC ? rIC(build, { timeout: 2000 }) : window.setTimeout(build, 700);
      },
      { rootMargin: '700px' },
    );
    const here = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: '160px',
    });
    near.observe(el);
    here.observe(el);
    return () => {
      near.disconnect();
      here.disconnect();
      const cIC = window.cancelIdleCallback;
      if (cIC) cIC(idle);
      else clearTimeout(idle);
    };
  }, []);

  return (
    <div ref={host} className={className} aria-hidden="true">
      {built && (
        <Canvas
          dpr={[1, 1.75]}
          frameloop={reduced ? 'demand' : onScreen ? 'always' : 'never'}
          camera={{ position: [0.7, 0.7, -0.7], fov: 36 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Suspense fallback={null}>
            <RoomScene
              rig={rig}
              space={space}
              heads={heads}
              listener={listener}
              onMove={onMove}
              reduced={reduced}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
