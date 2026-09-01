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
pnpm room         # the landscape in every space, rig and headcount that says something different
pnpm splash       # records the opening wave frame by frame and reports the longest stall
pnpm interact     # clicks through the room controls, rig tabs and booking form; asserts responses; reports console errors
pnpm breathe      # samples the headline's --wdth per frame with sound off and on
pnpm og           # re-captures public/og.png from the live hero
```

**Look at the screenshots.** Four of the worst bugs in this codebase's history were invisible to the type checker and obvious in a PNG: a 3D rig that read as four floating boxes, a pressure field that came out as one brown smear, an analyser clock that was never started so nothing on the page moved, and a floor wound the wrong way round so the room had no ground in it at all.

**And be suspicious of a picture that needs explaining.** The room section has been rebuilt twice, both times because it was accurate and unreadable - a gradient nobody can measure by eye, then a landscape that asked people to read height as decibels. If a new device needs a key before it means anything, it is the device that is wrong, not the reader.

## Architecture

**One mutable `levels` object, read in rAF, never in React state** (`src/lib/audio.ts`). Sixty state updates a second would re-render the page; instead `levels` is a plain object that components read inside their own `requestAnimationFrame` or `useFrame`. Only the on/off flag is React state.

**`Rail` owns the clock.** `useLevels()` starts the single rAF that keeps `levels` current, and the rail is the one component mounted for the whole page. If the rail ever stops being always-mounted, something else has to call `useLevels()` or the entire page goes still - silently, with no error.

**The opening wave runs off the main thread** (`src/components/splash.worker.ts`, `src/lib/wave.ts`). The first second of this page is one long task - hydration, then three.js - so a wave drawn in a `requestAnimationFrame` freezes in the middle of itself. The draw lives in a module with no DOM in it, the worker owns a transferred `OffscreenCanvas`, and the main thread keeps a copy of the same loop for browsers without one. For the same reason the 3D is gated on `useSplashDone()` in both `Hero` and `Rigs`: three.js is only asked for once the wave is leaving. `pnpm splash` reports the longest gap between frames - it should be tens of milliseconds, not hundreds.

**One wave, two places.** `src/lib/wave.ts` draws the surface and takes a `Look`: `FULL` for the splash, which owns the screen, and `GROUND` for the hero's water, which is the page's ground and is drawn at a fifth of the brightness. The hero's rings leave the cabinet - `WaterField` reads the rig's box every time a wave goes out.

**The room is lit, and the light is the physics** (`src/components/RoomScene.tsx`, `roomScene.glsl.ts`, `src/lib/room.ts`). Light from a point source and sound from a point source spread over the same expanding sphere, so both drop 6 dB per doubling: the brightness on the floor is not an illustration of the level, it *is* the level, and the same falloff is mirrored in `lightAt()` on both sides of the wall so the people and the ground they stand on agree. The one place the curve is bent is a sharp knee across `ROOM.KNEE` decibels either side of the target - a pure falloff is a smooth gradient, and a smooth gradient cannot be read as a threshold, which is what sank the two versions before this. Everything in the plan is divided by the room's depth, so every space arrives at the camera the same size and only the grain of it - the metre grid, the spread of the crowd, the height of the fence - says which is which.

**The model drives the audio, not only the picture** (`setSeat` / `clearSeat` in `src/lib/audio.ts`). Dragging yourself around the room really does change what you hear: the music is attenuated by the difference between the level where you stand and the level at the front of house, the top end is rolled off because by the back you are off the horn's axis, and a bed of crowd babble plays at the level the crowd itself makes - which does not change with distance. That last part is the point. Walking to the back does not turn the music down; it lets the room swallow it. The analyser is tapped **before** the seat, or the whole page would stop moving when you walked away, and the babble is not routed through it at all - the type breathes to the music, and a crowd is not the music. The seat is only engaged while the section is in view, so the hero never has a party murmuring under it.

**Nothing is fetched at run time.** No audio files, no model files, no image textures, no HDR environment, no web-font CDN. The music is oscillators, the grille is a canvas dot pattern, the environment is drei `Lightformer`s, and `next/font` self-hosts Archivo and IBM Plex Mono. Keep it that way - it is a large part of why the page feels immediate.

**The physics is real and is the point** (`src/lib/spl.ts`). Verdicts are judged on the **direct** field only; the reverberant term is displayed but never counted, because reverberant energy adds loudness without intelligibility. Levels shown are the *trimmed operating level* - the rig turned down until the far corner is exactly loud enough - not the peak on the box. If you change the model, re-run the sweep over every space × headcount combination and check the answers are still defensible; an earlier version had a pair of 8" tops filling a warehouse.

## Conventions

- **British English** throughout, and the plain dash `-` rather than an em dash.
- **Colour carries sound pressure.** Amber is the accent and every primary action, violet is atmosphere and low pressure, and red appears only when a rig would exceed what a space takes. Do not use any of them decoratively.
- **The `wdth` axis is the signature.** `BreathingType` snaps open on the kick and eases shut; easing the attack as well turns the breath into a wobble that never reaches the top of the axis.
- **A breathing headline is set to the measure.** `BreathingType fit` sizes the type from the widest the axis will ever reach, never above the CSS clamp, and forbids wrapping. Without it the hero re-wrapped on every kick and the whole page jumped by a line each time.
- Every canvas is `aria-hidden` and **every control has a text equivalent** - the room's readout says in words exactly what the light shows, and where you are standing has three named spots in the panel as well as the drag. Keep both true.
- `prefers-reduced-motion` kills the ripples, the breathing and the 3D drift, and flattens the simulated envelope to nothing. Audio is opt-in and starts silent.
- Sections are stages of a signal chain (`source → room → rig → delivery → book`); those ids are also the rail's anchors. Explicit numbering appears only in the delivery steps, which are a real sequence.

## Gotchas

- **`basePath`.** Production serves from `/spreker`, local from the root. Next rewrites its own routes and assets; anything hand-written would not be covered. `metadataBase` resolves absolute paths against the origin only, so the base path is written into the OG image URL by hand in `layout.tsx`.
- **Canvas cannot resolve CSS custom properties.** `ctx.font` needs a literal font stack, not `var(--font-plex-mono)`.
- **A `torusGeometry` already lies in the baffle plane.** Rotating it renders the woofer surround as a bar across the driver.
- **A canvas can be handed to a worker once, ever.** The splash makes its canvas in the effect rather than rendering one, because in development the effect runs twice and the second `transferControlToOffscreen` throws.
- **The review scripts wait for `load`, not `networkidle`.** The worker's chunk request never settles on the dev server, so idle never arrives and every pass times out.
- **Headless Chromium needs to be told to render WebGL.** `pnpm room` passes `--use-angle=swiftshader`; without it the room's shaders come back black.
- **Geometry built in world coordinates has to be wound by hand.** The floor, the walls and the fence are raw quads so that `position.xz` is already the plan position and the shader needs no transform; get the winding backwards and the face is culled and the lawn is simply missing. The walls exploit this on purpose - their normals point inwards and they are `FrontSide`, so whichever wall stands between you and the room is culled and you always see a cutaway.
- **A held touch on the canvas is somebody scrolling.** Only a mouse or a pen drags the listener; on a phone a tap puts you there, and the named spots do the rest.
- **The room's canvas is built in an idle slot, not on mount.** The section starts immediately under the fold, so an IntersectionObserver alone fires at the top of the page - putting a second WebGL context and four shader compiles in the same frame the splash leaves on.
- **The uniforms that move every frame live at module scope** (`clock` in `RoomField.tsx`), for the same reason `levels` does: the React compiler's lint refuses a mutation of anything a hook returned, and a ref cannot be read during render either.
- **`fwidth` must be called outside every branch.** It reads neighbouring pixels, which may not have taken the branch; the terrain shader takes all its derivatives in the first few lines for that reason.
- **Rings are emitted on `beatEdge()`, not on a level test.** The kick sends `beat` to 1, but the simulated envelope with the sound off only reaches about 0.4, so the old `beat > 0.72` meant nothing rippled at all until the sound was turned on.
- **`role="status"` appears twice in `#room` now.** Where you are standing, and the verdict on the rig. Scripts that address it have to say which.
- **`--rail` is `0` below 768px.** The rail is a transport bar along the bottom there, so reserving its width on the left only took measure away from the type.
- **Analyser smoothing flattens transients.** `smoothingTimeConstant` is 0.3, and the band levels run through an auto-gain that tracks a decaying maximum and a rising minimum - a four-on-the-floor loop keeps the bottom octaves lit almost continuously, so the raw average barely moves.
