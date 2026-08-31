'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { levels } from '@/lib/audio';
import { RIGS, rigById, type Rig } from '@/lib/rigs';
import {
  SPACES,
  assess,
  capacity,
  furthestCorner,
  operatingSpl,
  recommend,
  reverbLift,
  spaceById,
  type Space,
} from '@/lib/spl';
import { useReducedMotion, useReveal } from '@/lib/hooks';

/**
 * The room instrument.
 *
 * A plan view of the space with the rig standing at the middle of the near
 * wall. The field behind it is real: every pixel is coloured by the sound
 * pressure the model says arrives there — violet where it is quiet, sodium
 * where it is loud enough to dance in, red where it is more than the space can
 * take. The rings are the same field, emitted on the beat.
 *
 * Rings are slowed by about three orders of magnitude. Sound crosses a garden
 * in forty milliseconds; nobody can see that.
 */

const RING_SPEED = 9; // metres per second, on screen
const RING_LIFE = 2.6;

type Ring = { born: number };

/**
 * The pressure ramp.
 *
 * Sound pressure is sequential data, so it wants a perceptually uniform
 * sequential scale rather than a straight interpolation between two brand
 * colours — mixing violet into amber in RGB goes through pink, which reads as
 * decoration rather than as a quantity. Inferno happens to run from deep violet
 * to sodium amber, which is the palette anyway, so the page's colours and the
 * right scale for the data are the same thing.
 *
 * Trimmed at both ends: no black at the bottom, no white-yellow at the top.
 */
const INFERNO: [number, number, number][] = [
  [22, 11, 57],
  [51, 10, 89],
  [87, 16, 110],
  [122, 27, 109],
  [158, 41, 99],
  [191, 57, 82],
  [221, 81, 58],
  [243, 120, 25],
  [252, 165, 10],
  [246, 200, 60],
];

function splColour(spl: number, target: number, ceiling: number): [number, number, number] {
  // Over what the space takes is not a louder shade of the same thing; it is a
  // different state, so it gets the one colour reserved for that.
  if (spl >= ceiling) return [255, 59, 48];

  const foot = target - 12;
  const t = Math.max(0, Math.min(1, (spl - foot) / (ceiling - foot)));
  const x = t * (INFERNO.length - 1);
  const i = Math.min(INFERNO.length - 2, Math.floor(x));
  const f = x - i;
  const a = INFERNO[i];
  const b = INFERNO[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/**
 * The crowd, laid out from a seed so the same room always draws the same party.
 * Denser towards the rig, because that is where people stand.
 */
function scatterCrowd(heads: number, w: number, d: number) {
  let seed = heads * 7919 + w * 131 + d * 17;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: Math.min(heads, 120) }, () => {
    const bias = rnd() ** 0.68;
    return { x: (rnd() - 0.5) * w * 0.9, y: 0.6 + bias * (d - 1.2) };
  });
}

function Plan({ rig, space, heads }: { rig: Rig; space: Space; heads: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rings = useRef<Ring[]>([]);
  const state = useRef({ rig, space, heads });
  const reduced = useReducedMotion();

  // The draw loop reads the latest props without being torn down and rebuilt on
  // every slider tick, so they are pushed into a ref after each render rather
  // than during it.
  useEffect(() => {
    state.current = { rig, space, heads };
  });

  // The crowd, scattered once per (space, headcount) so it does not jitter
  // every frame.
  const crowd = useMemo(() => scatterCrowd(heads, space.w, space.d), [heads, space.w, space.d]);

  useEffect(() => {
    const cvs = canvas.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;
    let raf = 0;
    let lastBeat = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cvs.getBoundingClientRect();
      cvs.width = Math.round(r.width * dpr);
      cvs.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { rig: r, space: sp, heads: n } = state.current;
      const now = (performance.now() - t0) / 1000;
      const verdict = assess(r, sp, n);
      const W = cvs.clientWidth;
      const H = cvs.clientHeight;
      if (!W || !H) return;

      // Fit the room, keeping its real proportions.
      const padX = 26;
      const padTop = 34;
      const padBottom = 26;
      const scale = Math.min((W - padX * 2) / sp.w, (H - padTop - padBottom) / sp.d);
      const rw = sp.w * scale;
      const rh = sp.d * scale;
      const ox = (W - rw) / 2;
      const oy = padTop + (H - padTop - padBottom - rh) / 2;
      const sx = ox + rw / 2; // the rig, middle of the near wall
      const sy = oy + rh;
      const toPx = (m: number) => m * scale;

      ctx.clearRect(0, 0, W, H);

      // Site grid. The room is drawn to its real proportions, which leaves the
      // panel lopsided; this is what the ground outside it looks like.
      ctx.fillStyle = 'rgba(237,233,242,0.075)';
      for (let gy = 8; gy < H; gy += 16) {
        for (let gx = 8; gx < W; gx += 16) ctx.fillRect(gx, gy, 1, 1);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, rw, rh);
      ctx.clip();

      // The static field.
      const maxR = Math.hypot(rw, rh);
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, maxR);
      for (let i = 0; i <= 12; i++) {
        const d = Math.max(1, (i / 12) * (maxR / scale));
        const c = splColour(operatingSpl(r, sp, n, d), verdict.target, sp.takes);
        // Alpha stays roughly level so hue alone carries the pressure; a decay
        // here turned the whole field into one brown smear.
        grad.addColorStop(i / 12, rgba(c, 0.62));
      }
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(ox, oy, rw, rh);
      ctx.globalCompositeOperation = 'source-over';

      // Rings, emitted on the beat. With sound off they still come, on the
      // simulated envelope, so the instrument reads as live.
      if (!reduced) {
        if (levels.beat > 0.72 && now - lastBeat > 0.28) {
          rings.current.push({ born: now });
          lastBeat = now;
        }
        rings.current = rings.current.filter((ring) => now - ring.born < RING_LIFE);
        for (const ring of rings.current) {
          const age = now - ring.born;
          const metres = age * RING_SPEED;
          const rad = toPx(metres);
          if (rad < 1) continue;
          const c = splColour(operatingSpl(r, sp, n, Math.max(1, metres)), verdict.target, sp.takes);
          ctx.beginPath();
          ctx.arc(sx, sy, rad, Math.PI, Math.PI * 2);
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba(c, 0.5 * (1 - age / RING_LIFE));
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Distance arcs with their real levels. This is the honest part.
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      for (const m of [2, 4, 8, 16, 24]) {
        if (m > furthestCorner(sp)) break;
        const rad = toPx(m);
        ctx.beginPath();
        ctx.arc(sx, sy, rad, Math.PI, Math.PI * 2);
        ctx.strokeStyle = 'rgba(237,233,242,0.13)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(237,233,242,0.42)';
        ctx.fillText(`${operatingSpl(r, sp, n, m).toFixed(0)} dB`, sx + 5, sy - rad - 5);
      }

      // The crowd.
      for (const p of crowd) {
        const px = sx + toPx(p.x);
        const py = sy - toPx(p.y);
        const d = Math.hypot(p.x, p.y);
        const spl = operatingSpl(r, sp, n, Math.max(1, d));
        const c = splColour(spl, verdict.target, sp.takes);
        const dancing = spl >= verdict.target;
        ctx.beginPath();
        ctx.arc(px, py, dancing ? 2.4 : 1.7, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c, dancing ? 0.9 : 0.34);
        ctx.fill();
      }

      ctx.restore();

      // Walls. Solid indoors, dashed where there is nothing to reflect off.
      ctx.strokeStyle = 'rgba(237,233,242,0.28)';
      ctx.lineWidth = 1;
      if (!sp.indoor) ctx.setLineDash([5, 5]);
      ctx.strokeRect(ox + 0.5, oy + 0.5, rw - 1, rh - 1);
      ctx.setLineDash([]);

      // The rig itself, sitting on the near wall.
      const bump = 1 + levels.bass * 0.5;
      ctx.fillStyle = '#ff9e2c';
      ctx.fillRect(sx - 11, sy - 4, 22, 5);
      ctx.beginPath();
      ctx.arc(sx, sy - 1.5, 4 * bump + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,158,44,${0.18 + levels.bass * 0.3})`;
      ctx.fill();

      // Scale bar, so the plan is readable as a real size.
      ctx.strokeStyle = 'rgba(237,233,242,0.34)';
      ctx.beginPath();
      ctx.moveTo(ox, oy - 10);
      ctx.lineTo(ox + toPx(5), oy - 10);
      ctx.stroke();
      ctx.fillStyle = 'rgba(237,233,242,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText('5 m', ox + toPx(5) + 6, oy - 6);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [crowd, reduced]);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden="true" />;
}

export function RoomInstrument() {
  const [spaceId, setSpaceId] = useState<Space['id']>('garden');
  const [heads, setHeads] = useState(70);
  const [manual, setManual] = useState<Rig['id'] | null>(null);
  const reveal = useReveal<HTMLDivElement>();

  const space = spaceById(spaceId);
  const cap = Math.min(400, capacity(space));
  const people = Math.min(heads, cap);
  const suggested = recommend(RIGS, space, people);
  const rig = manual ? rigById(manual) : suggested;
  const verdict = assess(rig, space, people);
  const lift = reverbLift(rig, space);

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
            Start with the space, not the speaker
          </h2>
          <p className="mt-5 max-w-[52ch] leading-relaxed text-mute">
            Loudness is geometry. Sound drops six decibels every time the distance
            doubles, and a crowd makes about sixty decibels of its own noise before
            anyone plays a note. Set your room below and watch what actually reaches
            the back of it.
          </p>
        </header>

        <div className="grid gap-px overflow-hidden border border-hair bg-hair lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* The plan. */}
          <div className="flex min-h-[24rem] flex-col bg-stage lg:min-h-[34rem]">
            <div className="min-h-0 flex-1">
              <Plan rig={rig} space={space} heads={people} />
            </div>
            <p className="border-t border-hair px-4 py-3 font-mono text-[0.6875rem] leading-relaxed text-mute/80">
              Operating level, not the peak on the box · rings slowed about a
              thousandfold · {space.note}
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
                    onClick={() => {
                      setSpaceId(s.id);
                      setManual(null);
                    }}
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
                They make {(60 + 10 * Math.log10(people)).toFixed(0)} dB of noise by
                themselves. You need {verdict.target.toFixed(0)} dB to be heard over
                it. This space holds about {cap}.
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

            {/* The readout. Everything the canvas shows, in words. */}
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
