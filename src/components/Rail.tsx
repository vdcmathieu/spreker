'use client';

import { useEffect, useRef } from 'react';
import { autoStart, levels, toggle } from '@/lib/audio';
import { useActiveSection, useLevels, usePlaying, useSplashDone } from '@/lib/hooks';

/**
 * The patch panel. A mixing desk has a strip down one side carrying the things
 * that are true at every moment — where you are in the chain, what the meters
 * say, whether anything is running — so the page has one too.
 *
 * It is a left rail from 768px up and a transport bar below that.
 */

const STAGES = [
  { id: 'source', label: 'Source' },
  { id: 'room', label: 'Room' },
  { id: 'rig', label: 'Rig' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'book', label: 'Book' },
];

const IDS = STAGES.map((s) => s.id);

/** A real meter: broadband level, ticked with an amber peak segment. */
function Meter({ vertical = true }: { vertical?: boolean }) {
  const fill = useRef<HTMLDivElement>(null);
  const peak = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = Math.min(1, levels.rms * 1.35);
      peak.current = Math.max(v, peak.current - 0.012);
      if (fill.current) {
        fill.current.style.transform = vertical ? `scaleY(${v})` : `scaleX(${v})`;
        fill.current.style.backgroundColor = peak.current > 0.82 ? '#ff3b30' : '#ff9e2c';
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [vertical]);

  return (
    <div
      className={
        vertical
          ? 'relative h-24 w-[3px] overflow-hidden bg-hair'
          : 'relative h-[3px] w-16 overflow-hidden bg-hair'
      }
    >
      <div
        ref={fill}
        className="absolute inset-0 bg-sodium"
        style={{
          transformOrigin: vertical ? 'bottom' : 'left',
          transform: vertical ? 'scaleY(0)' : 'scaleX(0)',
        }}
      />
    </div>
  );
}

function SoundButton({ compact = false }: { compact?: boolean }) {
  const playing = usePlaying();
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={playing}
      data-sound=""
      className={`label transition-colors hover:text-sodium ${
        playing ? 'text-sodium' : 'text-mute'
      } ${compact ? '' : '[writing-mode:vertical-rl] rotate-180'}`}
    >
      {playing ? 'Sound on' : 'Turn it on'}
    </button>
  );
}

export function Rail() {
  const active = useActiveSection(IDS);
  // The rail is the one component mounted for the whole page, so it owns the
  // single rAF that feeds `levels`. Without this nothing on the page breathes.
  useLevels();

  // And, for the same reason, it is the one that asks for sound. The ask waits
  // for the wave to leave: building an audio graph during hydration would put
  // the work in exactly the second the splash exists to keep clear.
  const splashDone = useSplashDone();
  useEffect(() => {
    if (splashDone) autoStart();
  }, [splashDone]);

  return (
    <>
      {/* Desktop: the rail. */}
      <nav
        aria-label="Signal chain"
        className="fixed left-0 top-0 z-40 hidden h-full flex-col items-center justify-between border-r border-hair bg-ink/80 py-6 backdrop-blur-sm md:flex"
        style={{ width: 'var(--rail)' }}
      >
        <a href="#source" className="label !tracking-[0.3em] text-bone hover:text-sodium">
          SPK
        </a>

        <ul className="flex flex-col items-center gap-7">
          {STAGES.map((s) => {
            const on = active === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={on ? 'true' : undefined}
                  className={`label flex items-center gap-2 [writing-mode:vertical-rl] transition-colors ${
                    on ? 'text-bone' : 'hover:text-bone'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-[5px] w-[5px] shrink-0 transition-colors ${
                      on ? 'bg-sodium' : 'bg-hair'
                    }`}
                  />
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center gap-4">
          <Meter />
          <SoundButton />
        </div>
      </nav>

      {/* Mobile: the transport bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-hair bg-ink/92 px-5 py-3 backdrop-blur-sm md:hidden">
        <span className="label text-bone">
          {STAGES.find((s) => s.id === active)?.label}
        </span>
        <div className="flex items-center gap-3">
          <Meter vertical={false} />
          <SoundButton compact />
        </div>
      </div>
    </>
  );
}
