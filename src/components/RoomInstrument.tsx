'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { clearSeat, setSeat } from '@/lib/audio';
import { crowdSpl, distance, frontSpl, heardAs, spots } from '@/lib/room';
import { RIGS, rigById, type Rig } from '@/lib/rigs';
import {
  SPACES,
  assess,
  capacity,
  operatingSpl,
  recommend,
  reverbLift,
  spaceById,
  type Space,
} from '@/lib/spl';
import { usePlaying, useInView, useReveal, useSplashDone } from '@/lib/hooks';

/**
 * The room instrument — the page's functional centre.
 *
 * Your space drawn as a space, lit by the rig. Light from a point source and
 * sound from a point source fall off at the same rate, so the brightness on the
 * lawn is not an illustration of the loudness; it is the loudness. Whoever is
 * standing in enough of it is dancing, and whoever is not is standing still.
 *
 * And you can put yourself anywhere in it. With the sound on, the music really
 * does get quieter and duller as you walk to the back, while the party's own
 * noise stays exactly where it was — so the far corner is not a number to
 * interpret, it is a thing you hear.
 */

// three.js is a long enough task to hold the opening wave still, so the room's
// canvas is not asked for until the wave has gone — the same gate the hero uses.
const RoomStage = dynamic(() => import('./RoomStage').then((m) => m.RoomStage), {
  ssr: false,
});

export function RoomInstrument() {
  const [spaceId, setSpaceId] = useState<Space['id']>('garden');
  const [heads, setHeads] = useState(70);
  const [manual, setManual] = useState<Rig['id'] | null>(null);
  const [listener, setListener] = useState({ x: 0, y: 8 });
  const reveal = useReveal<HTMLDivElement>();
  const [stage, inView] = useInView<HTMLDivElement>('-15% 0px -15% 0px');
  const ready = useSplashDone();
  const playing = usePlaying();

  const space = spaceById(spaceId);
  const cap = Math.min(400, capacity(space));
  const people = Math.min(heads, cap);
  const suggested = recommend(RIGS, space, people);
  const rig = manual ? rigById(manual) : suggested;
  const verdict = assess(rig, space, people);
  const lift = reverbLift(rig, space);
  const here = spots(space);

  // Stand in the middle of whichever room you have just chosen.
  const chooseSpace = (id: Space['id']) => {
    setSpaceId(id);
    setManual(null);
    setListener({ x: 0, y: spaceById(id).d / 2 });
  };

  const away = distance(listener.x, listener.y);
  const music = operatingSpl(rig, space, people, away);
  const crowd = crowdSpl(people);
  const front = frontSpl(rig, space, people);
  const heard = heardAs(music, crowd);

  /**
   * Standing in the room is something you do while you are looking at it. Step
   * away and the page sounds like the page again, rather than leaving a crowd
   * murmuring under the hero.
   */
  useEffect(() => {
    if (playing && inView) setSeat(music, crowd, front);
    else clearSeat();
  }, [playing, inView, music, crowd, front]);

  // Clearing in the effect above would glide back to the front of house and
  // away again on every change, so leaving is handled once, here.
  useEffect(() => () => clearSeat(), []);

  const statusColour =
    verdict.status === 'good' ? 'text-sodium' : verdict.status === 'over' ? 'text-clip' : 'text-uv';

  return (
    <section id="room" className="border-b border-hair">
      <div
        ref={reveal}
        className="reveal mx-auto max-w-[100rem] px-6 py-20 lg:px-14 lg:py-28"
        style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
      >
        <header className="mb-10 max-w-[54ch]">
          <p className="label mb-6 flex items-center gap-3">
            <span aria-hidden="true" className="inline-block h-px w-8 bg-sodium-dim" />
            Room
          </p>
          <h2 className="display text-[clamp(1.85rem,4.1vw,3.15rem)]" style={{ ['--wdth' as string]: 108 }}>
            Stand at the back of your own party
          </h2>
          <p className="mt-5 max-w-[52ch] leading-relaxed text-mute">
            Loudness is geometry. Sound drops six decibels every time the distance
            doubles, and a crowd makes about sixty decibels of its own noise before
            anyone plays a note. So the rig lights the room below at exactly the rate
            it fills it, and you can go and stand in it.
          </p>
        </header>

        <div className="grid gap-px overflow-hidden border border-hair bg-hair lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div ref={stage} className="flex min-h-[26rem] flex-col bg-stage md:min-h-[36rem] lg:min-h-[38rem]">
            <div className="relative min-h-0 flex-1">
              {ready && (
                <RoomStage
                  rig={rig}
                  space={space}
                  heads={people}
                  listener={listener}
                  onMove={setListener}
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                />
              )}
            </div>
            <p className="border-t border-hair px-4 py-3 font-mono text-[0.6875rem] leading-relaxed text-mute/80">
              The rig lights the room, and light falls off at exactly the rate sound
              does · whoever is in the light can hear it, whoever is not is standing
              still · drag yourself anywhere to stand there · {space.note}
            </p>
          </div>

          {/* The controls, which are the same information in words. */}
          <div className="flex flex-col gap-8 bg-stage p-6 lg:p-7">
            <fieldset>
              <legend className="label mb-3">Space</legend>
              <div className="grid grid-cols-2 gap-px bg-hair">
                {SPACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => chooseSpace(s.id)}
                    aria-pressed={s.id === spaceId}
                    className={`px-3 py-3 text-left font-mono text-xs transition-colors ${
                      s.id === spaceId
                        ? 'bg-sodium text-ink'
                        : 'bg-stage text-mute hover:text-bone'
                    }`}
                  >
                    {s.name}
                    <span className="mt-1 block opacity-70">
                      {s.w} × {s.d} m
                    </span>
                    <span className="block opacity-70">
                      holds {Math.min(400, capacity(s))}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="heads" className="label mb-1 flex items-baseline justify-between">
                <span>People coming</span>
                <span className="font-mono text-base tracking-normal text-bone">{people}</span>
              </label>
              <input
                id="heads"
                type="range"
                min={10}
                max={cap}
                step={5}
                value={people}
                onChange={(e) => {
                  setHeads(Number(e.target.value));
                  setManual(null);
                }}
              />
              <p className="font-mono text-[0.6875rem] text-mute">
                They make {crowd.toFixed(0)} dB of noise by themselves. You need{' '}
                {verdict.target.toFixed(0)} dB to be heard over it. This space holds
                about {cap}.
              </p>
            </div>

            <fieldset>
              <legend className="label mb-3 flex items-baseline justify-between">
                <span>Rig</span>
                {manual && (
                  <button
                    type="button"
                    onClick={() => setManual(null)}
                    className="font-mono text-[0.6875rem] normal-case tracking-normal text-sodium"
                  >
                    Use the suggestion
                  </button>
                )}
              </legend>
              <div className="flex flex-col gap-px bg-hair">
                {RIGS.map((r) => {
                  const on = r.id === rig.id;
                  const v = assess(r, space, people);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setManual(r.id)}
                      aria-pressed={on}
                      className={`flex items-baseline justify-between gap-3 px-3 py-3 font-mono text-xs transition-colors ${
                        on ? 'bg-panel text-bone' : 'bg-stage text-mute hover:text-bone'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-[5px] w-[5px] shrink-0"
                          style={{
                            background:
                              v.status === 'good'
                                ? '#ff9e2c'
                                : v.status === 'over'
                                  ? '#ff3b30'
                                  : '#3b1a86',
                          }}
                        />
                        {r.name}
                        {r.id === suggested.id && !manual && (
                          <span className="text-sodium">· suggested</span>
                        )}
                      </span>
                      <span className="tabular-nums">€{r.pricePerNight}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Standing somewhere, which the canvas also lets you do by dragging.
                These are that control's text equivalent and its shortcuts. */}
            <fieldset>
              <legend className="label mb-3">Where you&apos;re standing</legend>
              <div className="grid grid-cols-3 gap-px bg-hair">
                {here.map((s) => {
                  const on = Math.hypot(s.x - listener.x, s.y - listener.y) < 0.5;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setListener({ x: s.x, y: s.y })}
                      aria-pressed={on}
                      className={`px-2 py-3 text-left font-mono text-[0.6875rem] leading-tight transition-colors ${
                        on ? 'bg-panel text-bone' : 'bg-stage text-mute hover:text-bone'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p
                role="status"
                className={`mt-3 text-sm leading-relaxed ${heard.can ? 'text-bone' : 'text-uv'}`}
              >
                {away.toFixed(0)} m out, {music.toFixed(0)} dB. {heard.line}
              </p>
              <p className="mt-2 font-mono text-[0.6875rem] leading-relaxed text-mute">
                {playing
                  ? 'That is what you are hearing: the music falls away as you walk back, and the party does not.'
                  : 'Turn the sound on and walk to the back — the music falls away, and the party does not.'}
              </p>
            </fieldset>

            {/* The verdict on the rig itself. */}
            <div role="status" className="mt-auto border-t border-hair pt-5">
              <dl className="mb-4 grid grid-cols-3 gap-3 font-mono text-xs">
                {[
                  ['At 2 m', `${verdict.atFront.toFixed(0)} dB`],
                  ['Far corner', `${verdict.atBack.toFixed(0)} dB`],
                  ['Needed', `${verdict.target.toFixed(0)} dB`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="label !tracking-[0.1em]">{k}</dt>
                    <dd className="mt-1 text-lg tabular-nums text-bone">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className={`text-sm leading-relaxed ${statusColour}`}>{verdict.line}</p>
              {lift > 0.5 && (
                <p className="mt-3 font-mono text-[0.6875rem] leading-relaxed text-mute">
                  The room adds about {lift.toFixed(0)} dB of reverberant wash on top.
                  That is loudness, not clarity, so none of the figures above count it.
                </p>
              )}
              <a href="#book" className="btn-sodium mt-5 inline-block">
                Book the {rig.name}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
