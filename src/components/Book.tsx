'use client';

import { useId, useState } from 'react';
import { RIGS, rigById, type Rig } from '@/lib/rigs';

/** en-GB throughout, so a held night reads as a date rather than as an ISO string. */
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function readableDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : LONG_DATE.format(d);
}
import { useReveal } from '@/lib/hooks';

/**
 * The booking form. It is deliberately short — five fields, all of which the
 * page has already told you the answer to — and it goes nowhere: Spreker is a
 * design experiment, which the form says plainly rather than in the footer only.
 */

const field =
  'w-full border border-hair bg-ink px-3 py-3 font-mono text-sm text-bone placeholder:text-mute/60 focus:border-sodium focus:outline-none';

export function Book() {
  const reveal = useReveal<HTMLDivElement>();
  const uid = useId();
  const [done, setDone] = useState<{ rig: Rig; date: string; heads: string } | null>(null);
  const [rig, setRig] = useState<Rig['id']>('tuin');
  const [date, setDate] = useState('');
  const [heads, setHeads] = useState('70');

  return (
    <section id="book" className="border-b border-hair">
      <div
        ref={reveal}
        className="reveal mx-auto max-w-[100rem] px-6 py-20 lg:px-14 lg:py-28"
        style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
      >
        <div className="grid gap-px border border-hair bg-hair lg:grid-cols-[1fr_28rem]">
          <div className="bg-stage p-6 lg:p-12">
            <p className="label mb-6 flex items-center gap-3">
              <span aria-hidden="true" className="inline-block h-px w-8 bg-sodium-dim" />
              Book
            </p>
            <h2 className="display text-[clamp(2.1rem,5vw,4rem)]" style={{ ['--wdth' as string]: 110 }}>
              Hold a night
            </h2>
            <p className="mt-5 max-w-[42ch] leading-relaxed text-mute">
              We keep one rig of each size free for the weekend until Thursday. Tell us
              the date and we will confirm within the hour, or tell you straight away
              that we cannot.
            </p>
            <ul className="mt-10 border-t border-hair font-mono text-sm text-mute">
              {[
                ['Delivery and collection', 'Included'],
                ['Setup, gain staging, limiter', 'Included'],
                ['A phone number for the night', 'Included'],
                ['Covers, if you are outdoors', 'Included'],
                ['Someone to run it', '€120 — Schuur only'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-6 border-b border-hair py-3 last:border-0">
                  <span className="text-bone">{k}</span>
                  <span className={v === 'Included' ? '' : 'text-sodium'}>{v}</span>
                </li>
              ))}
            </ul>

            <p className="mt-8 font-mono text-xs leading-relaxed text-mute">
              Bookings run Friday to Sunday and over public holidays.
              <br />
              Weekday hire is possible; ask.
            </p>
          </div>

          <div className="bg-stage p-6 lg:p-10">
            {done ? (
              <div role="status">
                <p className="label text-sodium">Held</p>
                <p className="mt-4 text-2xl leading-snug text-bone">
                  The {done.rig.name} is pencilled in
                  {done.date ? ` for ${readableDate(done.date)}` : ''}.
                </p>
                <dl className="mt-8 border-t border-hair pt-6 font-mono text-sm">
                  {[
                    ['Rig', done.rig.name],
                    ['People', done.heads],
                    ['Per night', `€${done.rig.pricePerNight}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-hair py-3 last:border-0">
                      <dt className="label !tracking-[0.1em]">{k}</dt>
                      <dd className="tabular-nums text-bone">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 font-mono text-xs leading-relaxed text-mute">
                  Nothing was sent. Spreker is a design experiment, not a rental
                  company — see the note below.
                </p>
                <button type="button" onClick={() => setDone(null)} className="btn-ghost mt-6">
                  Start again
                </button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setDone({ rig: rigById(rig), date, heads });
                }}
              >
                <div>
                  <label htmlFor={`${uid}-date`} className="label mb-2 block">
                    Night
                  </label>
                  <input
                    id={`${uid}-date`}
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={field}
                  />
                </div>

                <div>
                  <label htmlFor={`${uid}-rig`} className="label mb-2 block">
                    Rig
                  </label>
                  <select
                    id={`${uid}-rig`}
                    value={rig}
                    onChange={(e) => setRig(e.target.value as Rig['id'])}
                    className={field}
                  >
                    {RIGS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — {r.heads.toLowerCase()} — €{r.pricePerNight}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={`${uid}-heads`} className="label mb-2 block">
                      People
                    </label>
                    <input
                      id={`${uid}-heads`}
                      type="number"
                      min={5}
                      max={500}
                      required
                      value={heads}
                      onChange={(e) => setHeads(e.target.value)}
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-where`} className="label mb-2 block">
                      Postcode
                    </label>
                    <input
                      id={`${uid}-where`}
                      type="text"
                      required
                      placeholder="1000"
                      className={field}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={`${uid}-email`} className="label mb-2 block">
                    Email
                  </label>
                  <input
                    id={`${uid}-email`}
                    type="email"
                    required
                    placeholder="you@example.com"
                    className={field}
                  />
                </div>

                <button type="submit" className="btn-sodium mt-2 w-full">
                  Hold this night
                </button>
                <p className="font-mono text-[0.6875rem] leading-relaxed text-mute">
                  Spreker is a design experiment. This form sends nothing anywhere and
                  reserves nothing.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
