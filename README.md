# Spreker

**[lab.vandecatsije.com/spreker](https://lab.vandecatsije.com/spreker)**

A design experiment: a party-speaker rental site where one live audio analyser drives everything on the page - the waves, the cones, and the width of the type.

Spreker is not a real rental company.
The sound-pressure model behind the room view is real, the prices and the van are not, and the booking form sends nothing anywhere.

---

## The idea

Speaker rental sites sell boxes.
The person hiring one is not shopping for a driver configuration; they are asking **"will it be loud enough for my garden, and how does it get there without me breaking it"**.

So the site is organised around the room rather than the products, and its centrepiece is an instrument that answers that question with real physics.
Set the space and the headcount and it shows you what actually reaches the back of it.

Three coupled ideas carry the design - see [DESIGN.md](DESIGN.md) for the full direction:

1. **One real audio analyser drives the page.** Silent on load; one button and a four-on-the-floor loop, synthesised live in WebAudio from oscillators and filtered noise, starts feeding an FFT that everything else reads.
2. **The headline breathes on the `wdth` axis.** Archivo is a variable font, and the kick drives its width. Cone excursion, rendered as type.
3. **The room instrument.** A plan view with pressure rings attenuating by the inverse-square law, coloured by a perceptual sequential scale that happens to run violet to sodium amber - the palette and the right scale for the data being the same thing.

---

## Running it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
```

Node 20+. There is no test suite; `pnpm build` typechecks, and the screenshot scripts below are the real check.

### Looking at it

Design work needs looking at, so the review passes are scripted.
Start the dev server first, then:

```bash
pnpm shots        # every section at 1440 / 390 / 834, into .review/, plus an overflow report
pnpm interact     # drives the controls and asserts the page responds
pnpm breathe      # samples the headline's width axis per frame, sound off vs on
pnpm og           # re-captures public/og.png from the live hero
```

---

## How it is built

| Piece | Where | Note |
|---|---|---|
| Sound | `src/lib/audio.ts` | The synthesised loop, the analyser, and the single `levels` object everything reads. No audio files. |
| Physics | `src/lib/spl.ts` | Inverse-square direct field, a reverberant term, crowd noise, and the verdict. |
| Rigs | `src/lib/rigs.ts` | Three rigs, named for the room they fill. |
| The instrument | `src/components/RoomInstrument.tsx` | Canvas 2D plan view plus the controls, which carry the same information in words. |
| The cabinet | `src/components/RigModel.tsx` | Procedural three.js - no model files, no image textures, no HDR. |
| The rail | `src/components/Rail.tsx` | The patch panel, and the owner of the one rAF that keeps `levels` current. |

**Nothing is fetched at run time.** The grille is a dot pattern drawn to a canvas, the environment is built from lightformers, the fonts are self-hosted by `next/font`, and the music is oscillators.

### The physics, briefly

Everything the page judges, it judges on the **direct** field: sound drops 6 dB per doubling of distance, a crowd of *n* makes about `60 + 10·log10(n)` dB of its own noise, and music needs roughly 8 dB over that.
A rig is turned down until the far corner is exactly loud enough, and every level shown is that trimmed operating level rather than the peak printed on the box.

Indoors the room adds a reverberant field, shown separately and never counted towards the verdict - reverberant energy is smeared in time, so it adds loudness without adding intelligibility.
Skipping that distinction lets a pair of 8" tops "fill" a warehouse, which is how the first version of the model got it wrong.

---

## Deployment

Not deployed yet.
It goes out as its own Vercel project, proxied under the lab host by the routing middleware in the `vandecatsije.com` repo, exactly like `yomu` and `mouvementdargent`.

**1. Deploy this repo.**

```bash
vercel link            # new project, name it "spreker"
vercel env add NEXT_PUBLIC_BASE_PATH production   # /spreker
vercel --prod
```

`NEXT_PUBLIC_SITE_URL` can be left unset; it defaults to `https://lab.vandecatsije.com`.
Note the production origin Vercel gives back - the middleware needs it.

**2. Add the proxy branch** in `~/Code/vandecatsije.com/middleware.ts`, beside the existing `yomu` and `mouvementdargent` branches:

```ts
const SPREKER_ORIGIN = 'https://<the origin from step 1>';

if (url.pathname === '/spreker' || url.pathname.startsWith('/spreker/')) {
  return rewrite(new URL(url.pathname + url.search, SPREKER_ORIGIN));
}
```

**3. Add the lab entry** at `~/Code/vandecatsije.com/src/content/lab/spreker.md`:

```yaml
title: 'Spreker'
summary: '...'
tagline: 'As loud as the room can take'
status: 'experiment'
started: 2026-08-31
url: 'https://lab.vandecatsije.com/spreker'
urlLabel: 'Turn it on'
repo: 'https://github.com/vdcmathieu/spreker'
stack: ['Next.js', 'three.js', 'Web Audio', 'Vercel']
featured: true
```

A cover image sits next to the .md file; `public/og.png` here is a reasonable starting point.

---

## Licence

MIT.
