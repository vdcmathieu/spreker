'use client';

import { BreathingType } from './BreathingType';

export function Footer() {
  return (
    <footer
      className="mx-auto max-w-[100rem] px-6 pb-28 pt-20 md:pb-16 lg:px-14"
      style={{ paddingLeft: 'max(1.5rem, calc(var(--rail) + 1.5rem))' }}
    >
      <BreathingType
        as="p"
        base={116}
        travel={9}
        className="select-none text-[clamp(3.25rem,14.5vw,12rem)] leading-[0.8] text-panel"
      >
        Spreker
      </BreathingType>

      <div className="mt-12 grid gap-8 border-t border-hair pt-8 font-mono text-xs text-mute sm:grid-cols-[1fr_auto] sm:items-start">
        <p className="max-w-[62ch] leading-relaxed">
          <span className="text-bone">Spreker is a design experiment</span>, not a
          rental company. It is a piece from the lab at vandecatsije.com, built to see
          how far a page can go when one live audio analyser drives everything on it —
          the waves, the cones, and the width of the type. The sound-pressure model
          behind the room view is real; the company is not. Nothing you type here is
          sent anywhere.
        </p>
        <ul className="flex gap-6 sm:flex-col sm:gap-2 sm:text-right">
          <li>
            <a href="https://lab.vandecatsije.com" className="hover:text-sodium">
              The lab
            </a>
          </li>
          <li>
            <a href="https://github.com/vdcmathieu/spreker" className="hover:text-sodium">
              Source
            </a>
          </li>
          <li>
            <a href="#source" className="hover:text-sodium">
              Back to the top
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
