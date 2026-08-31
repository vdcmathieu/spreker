'use client';

import { useReveal } from '@/lib/hooks';

/**
 * The only place on the page that earns explicit numbering: three things that
 * happen in an order, where the order is the information.
 */
const STEPS = [
  {
    n: '01',
    when: 'When you book',
    title: 'We size it against your room',
    body:
      'You send the address, the space and the headcount. We check the geometry, ask about the fence line or the flat below, and confirm which rig actually clears it. If the smaller one does, you get the smaller one.',
  },
  {
    n: '02',
    when: 'Ninety minutes before',
    title: 'We deliver, rig it and tune it',
    body:
      'Two of us, one van. Stands up, subs placed off the wall corners, gain staged and a limiter set so the peaks land where we agreed. You get a phone, a volume knob and a short explanation of both.',
  },
  {
    n: '03',
    when: 'The morning after',
    title: 'We come back and take it away',
    body:
      'Between nine and noon. Nothing to coil, nothing to carry down a staircase, nothing to load into a car you borrowed. Leave it where it stands.',
  },
];

const TERMS = [
  ['Deposit', '€150, returned within three days'],
  ['Delivery', 'Free inside Brussels and Antwerp, €1.10/km beyond'],
  ['Cancellation', 'Free up to 48 hours before'],
  ['If it rains', 'Covers included with every outdoor booking'],
];

export function Delivery() {
  const reveal = useReveal<HTMLDivElement>();

  return (
    <section id="delivery" className="border-b border-hair">
      <div
        ref={reveal}
        className="reveal mx-auto max-w-[100rem] px-6 py-20 lg:px-14 lg:py-28"
        style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
      >
        <header className="mb-10 max-w-[54ch]">
          <p className="label mb-6 flex items-center gap-3">
            <span aria-hidden="true" className="inline-block h-px w-8 bg-sodium-dim" />
            Delivery
          </p>
          <h2 className="display text-[clamp(1.85rem,4.1vw,3.15rem)]" style={{ ['--wdth' as string]: 108 }}>
            You do not touch a flight case
          </h2>
        </header>

        <ol className="grid gap-px border border-hair bg-hair md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-stage p-6 lg:p-8">
              <div className="mb-6 flex items-baseline justify-between font-mono text-xs">
                <span className="text-4xl tabular-nums text-sodium">{s.n}</span>
                <span className="label !tracking-[0.14em]">{s.when}</span>
              </div>
              <h3 className="text-xl leading-tight text-bone">{s.title}</h3>
              <p className="mt-4 leading-relaxed text-mute">{s.body}</p>
            </li>
          ))}
        </ol>

        <dl className="mt-px grid gap-px border border-t-0 border-hair bg-hair sm:grid-cols-2 lg:grid-cols-4">
          {TERMS.map(([k, v]) => (
            <div key={k} className="bg-stage p-6">
              <dt className="label">{k}</dt>
              <dd className="mt-2 font-mono text-sm text-bone">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
