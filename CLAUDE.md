# CLAUDE.md

Guidance for Claude Code working in this repository.

Spreker is a **design experiment**, published at `lab.vandecatsije.com/spreker`.
`DESIGN.md` is the brief and the reasoning behind every colour, typeface and structural device - **read it before changing anything visual**, and update it when the direction genuinely changes rather than letting the code drift away from it.
`README.md` is the human-facing overview.

## Commands

```bash
pnpm dev          # http://localhost:3000
pnpm build        # production build; also the typecheck
pnpm lint
```

There are no unit tests. The checks that matter are visual and behavioural, and they are scripted (dev server must be running):

```bash
pnpm shots        # every section at 1440 / 390 / 834 into .review/, plus a horizontal-overflow report
pnpm interact     # clicks through the room controls, rig tabs and booking form; asserts responses; reports console errors
pnpm breathe      # samples the headline's --wdth per frame with sound off and on
pnpm og           # re-captures public/og.png from the live hero
```

**Look at the screenshots.** Three of the worst bugs in this codebase's history were invisible to the type checker and obvious in a PNG: a 3D rig that read as four floating boxes, a pressure field that came out as one brown smear, and an analyser clock that was never started so nothing on the page moved.

## Architecture

**One mutable `levels` object, read in rAF, never in React state** (`src/lib/audio.ts`). Sixty state updates a second would re-render the page; instead `levels` is a plain object that components read inside their own `requestAnimationFrame` or `useFrame`. Only the on/off flag is React state.

**`Rail` owns the clock.** `useLevels()` starts the single rAF that keeps `levels` current, and the rail is the one component mounted for the whole page. If the rail ever stops being always-mounted, something else has to call `useLevels()` or the entire page goes still - silently, with no error.

**Nothing is fetched at run time.** No audio files, no model files, no image textures, no HDR environment, no web-font CDN. The music is oscillators, the grille is a canvas dot pattern, the environment is drei `Lightformer`s, and `next/font` self-hosts Archivo and IBM Plex Mono. Keep it that way - it is a large part of why the page feels immediate.

**The physics is real and is the point** (`src/lib/spl.ts`). Verdicts are judged on the **direct** field only; the reverberant term is displayed but never counted, because reverberant energy adds loudness without intelligibility. Levels shown are the *trimmed operating level* - the rig turned down until the far corner is exactly loud enough - not the peak on the box. If you change the model, re-run the sweep over every space × headcount combination and check the answers are still defensible; an earlier version had a pair of 8" tops filling a warehouse.

## Conventions

- **British English** throughout, and the plain dash `-` rather than an em dash.
- **Colour carries sound pressure.** Amber is the accent and every primary action, violet is atmosphere and low pressure, and red appears only when a rig would exceed what a space takes. Do not use any of them decoratively.
- **The `wdth` axis is the signature.** `BreathingType` snaps open on the kick and eases shut; easing the attack as well turns the breath into a wobble that never reaches the top of the axis.
- Every canvas is `aria-hidden` and **every control has a text equivalent** - the room instrument's readout says in words exactly what the plan draws. Keep that true.
- `prefers-reduced-motion` kills the ripples, the breathing and the 3D drift, and flattens the simulated envelope to nothing. Audio is opt-in and starts silent.
- Sections are stages of a signal chain (`source → room → rig → delivery → book`); those ids are also the rail's anchors. Explicit numbering appears only in the delivery steps, which are a real sequence.

## Gotchas

- **`basePath`.** Production serves from `/spreker`, local from the root. Next rewrites its own routes and assets; anything hand-written would not be covered. `metadataBase` resolves absolute paths against the origin only, so the base path is written into the OG image URL by hand in `layout.tsx`.
- **Canvas cannot resolve CSS custom properties.** `ctx.font` needs a literal font stack, not `var(--font-plex-mono)`.
- **A `torusGeometry` already lies in the baffle plane.** Rotating it renders the woofer surround as a bar across the driver.
- **Analyser smoothing flattens transients.** `smoothingTimeConstant` is 0.3, and the band levels run through an auto-gain that tracks a decaying maximum and a rising minimum - a four-on-the-floor loop keeps the bottom octaves lit almost continuously, so the raw average barely moves.
