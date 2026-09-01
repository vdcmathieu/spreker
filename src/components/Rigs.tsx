'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { RIGS, type Rig } from '@/lib/rigs';
import { directSpl } from '@/lib/spl';
import { useReveal, useSplashDone } from '@/lib/hooks';

const RigStage = dynamic(() => import('./RigStage').then((m) => m.RigStage), { ssr: false });

/**
 * Three rigs, one stage. A grid of three canvases would be three times the
 * cost for a third of the presence, so the rig you are reading about is the rig
 * that is standing there.
 */
export function Rigs() {
  const [selected, setSelected] = useState<Rig['id']>('tuin');
  const rig = RIGS.find((r) => r.id === selected)!;
  const reveal = useReveal<HTMLDivElement>();
  // Same chunk as the hero's rig, so it waits on the same thing.
  const rigReady = useSplashDone();

  return (
    <section id="rig" className="border-b border-hair">
      <div
        ref={reveal}
        className="reveal mx-auto max-w-[100rem] px-6 py-20 lg:px-14 lg:py-28"
        style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
      >
        <header className="mb-10 max-w-[54ch]">
          <p className="label mb-6 flex items-center gap-3">
            <span aria-hidden="true" className="inline-block h-px w-8 bg-sodium-dim" />
            Rig
          </p>
          <h2 className="display text-[clamp(1.85rem,4.1vw,3.15rem)]" style={{ ['--wdth' as string]: 108 }}>
            Three rigs, named for the room
          </h2>
          <p className="mt-5 max-w-[52ch] leading-relaxed text-mute">
            Not by model number, because nobody hires a model number. Each one is the
            smallest system that will comfortably hold its room, which is the only
            spec that matters on the night.
          </p>
        </header>

        <div className="grid gap-px border border-hair bg-hair lg:grid-cols-[1fr_1fr]">
          <div data-rig-stage className="relative min-h-[22rem] bg-stage lg:min-h-[36rem]">
            {rigReady && (
              <RigStage rig={rig} className="rig-arrive absolute inset-0" cameraZ={3.3} />
            )}
            <p className="absolute bottom-3 left-4 right-4 font-mono text-[0.6875rem] text-mute/80">
              {rig.name} · {rig.stage.label} · the cone is moving with the signal
            </p>
          </div>

          <div className="bg-stage">
            <div role="tablist" aria-label="Rigs" className="flex gap-px bg-hair">
              {RIGS.map((r) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={r.id === selected}
                  onClick={() => setSelected(r.id)}
                  className={`flex-1 px-4 py-4 text-left font-mono text-xs transition-colors ${
                    r.id === selected ? 'bg-panel text-bone' : 'bg-stage text-mute hover:text-bone'
                  }`}
                >
                  <span className="block text-sm">{r.name}</span>
                  <span className="mt-1 block opacity-60">{r.gloss}</span>
                </button>
              ))}
            </div>

            <div className="p-6 lg:p-8">
              <p className="display text-[clamp(2rem,4vw,3.2rem)]" style={{ ['--wdth' as string]: 104 }}>
                {rig.name}
              </p>
              <p className="mt-5 max-w-[46ch] leading-relaxed text-mute">{rig.blurb}</p>

              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hair pt-6 font-mono text-sm">
                <div>
                  <dt className="label !tracking-[0.1em]">Peak, on axis at 1 m</dt>
                  <dd className="mt-1 text-lg tabular-nums text-bone">{rig.peakSpl} dB</dd>
                </div>
                <div>
                  <dt className="label !tracking-[0.1em]">Outdoors at 20 m</dt>
                  <dd className="mt-1 text-lg tabular-nums text-bone">
                    {directSpl(rig.peakSpl, 20).toFixed(0)} dB
                  </dd>
                </div>
                <div>
                  <dt className="label !tracking-[0.1em]">Crowd</dt>
                  <dd className="mt-1 text-lg text-bone">{rig.heads}</dd>
                </div>
                <div>
                  <dt className="label !tracking-[0.1em]">Per night</dt>
                  <dd className="mt-1 text-lg tabular-nums text-sodium">€{rig.pricePerNight}</dd>
                </div>
              </dl>

              <ul className="mt-8 border-t border-hair pt-6 font-mono text-xs text-mute">
                {rig.boxes.map((b) => (
                  <li key={b} className="flex gap-3 border-b border-hair py-2.5 last:border-0">
                    <span aria-hidden="true" className="mt-[0.45rem] h-px w-4 shrink-0 bg-sodium-dim" />
                    {b}
                  </li>
                ))}
              </ul>

              <a href="#book" className="btn-sodium mt-8 inline-block">
                Book the {rig.name}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
