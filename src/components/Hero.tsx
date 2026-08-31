'use client';

import dynamic from 'next/dynamic';
import { BreathingType } from './BreathingType';
import { Glow } from './Glow';
import { RIGS } from '@/lib/rigs';
import { toggle } from '@/lib/audio';
import { usePlaying } from '@/lib/hooks';

const RigStage = dynamic(() => import('./RigStage').then((m) => m.RigStage), {
  ssr: false,
});

export function Hero() {
  const playing = usePlaying();

  return (
    <section
      id="source"
      className="relative min-h-[100svh] overflow-hidden border-b border-hair"
    >
      <Glow className="-left-[20%] top-[8%] h-[70vh] w-[70vh] md:left-[38%] md:h-[95vh] md:w-[95vh]" />

      <div className="relative mx-auto grid max-w-[100rem] gap-10 px-6 pb-28 pt-24 md:pb-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-6 lg:px-14 lg:pt-28"
        style={{ paddingLeft: 'max(1.5rem, var(--rail))' }}
      >
        <div className="relative z-10">
          <p className="label mb-8 flex items-center gap-3">
            <span aria-hidden="true" className="inline-block h-px w-8 bg-sodium-dim" />
            Spreker — party speakers, Brussels &amp; Antwerp
          </p>

          <BreathingType className="text-[clamp(2.9rem,7.6vw,6.6rem)]">
            <span className="block">As loud</span>
            <span className="block">as the room</span>
            <span className="block text-sodium">can take</span>
          </BreathingType>

          {/* Everything under the headline is grouped so the social-card capture
              in scripts/og.mjs can drop it and keep the frame to type and rig. */}
          <div data-hero-support>
          <p className="mt-7 max-w-[44ch] leading-relaxed text-mute md:text-lg">
            Speakers hired by the night. Tell us the space and how many are coming; we
            work out how loud it has to be, bring the rig that gets there, set it up,
            and take it away in the morning.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#room" className="btn-sodium text-center">
              Size my room
            </a>
            <a href="#rig" className="btn-ghost text-center">
              See the rigs
            </a>
          </div>

          <p className="mt-8 font-mono text-xs leading-relaxed text-mute">
            From €{RIGS[0].pricePerNight} a night · Delivered, set up and collected
          </p>
          </div>
        </div>

        <div className="relative h-[42vh] min-h-[17rem] lg:h-[70vh]">
          <RigStage rig={RIGS[1]} className="absolute inset-0" cameraZ={3.3} />
        </div>
      </div>

      {/* The explanation for the one thing a visitor won't expect. */}
      <div
        data-hero-footnote
        className="absolute inset-x-0 bottom-0 z-10 hidden items-end justify-between border-t border-hair px-6 py-4 md:flex lg:px-14"
        style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
      >
        <button
          type="button"
          onClick={() => void toggle()}
          className="label text-left transition-colors hover:text-sodium"
        >
          {playing
            ? '◼  Sound on — every wave, cone and letter on this page is running off it'
            : '▶  Turn the sound on. Everything that moves here is driven by it'}
        </button>
        <span className="label" aria-hidden="true">
          Scroll ↓
        </span>
      </div>
    </section>
  );
}
