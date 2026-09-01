# Spreker — design direction

## The brief, pinned

Spreker rents party speakers to **individuals**, not to venues or promoters.
The customer is someone throwing a birthday in a flat, a wedding in a barn, a graduation in a garden.
Their real question is never "which driver configuration".
It is **"will it be loud enough for my space, and how does it get there without me breaking it"**.

The page's single job: take someone from *"sixty people in a garden"* to *"a rig is booked"*.

That reframes the whole site.
It is organised around **the room**, not around the products - which is what keeps it from being another dark gear catalogue.

## Direction

Midnight club / neon bass, as chosen.
The reference is not a nightclub interior; it is **a street at 1am** - sodium lamps against a violet sky, sound arriving from somewhere behind you.

### Colour

| token | hex | role |
|---|---|---|
| `ink` | `#07060B` | the ground. Near-black with a violet cast, never neutral grey |
| `stage` | `#100C1B` | raised surfaces, panels, cards |
| `uv` | `#6D2BF5` | the wash light. Atmosphere, low pressure, ambient glow |
| `sodium` | `#FF9E2C` | the accent. Peak LEDs, streetlight, high pressure, every primary action |
| `clip` | `#FF3B30` | **semantic only** - shown when a rig would overdrive the room |
| `bone` | `#EDE9F2` | text |

Amber against violet on near-black instead of the expected acid lime on black.
It is the palette of the night the product is actually for, and colour is load-bearing:
in the room instrument **hue encodes sound pressure** (violet = quiet, sodium = loud, clip red = too loud).
It is never applied as decoration.

### Type

**Archivo Variable** for display, **Archivo** for body - one superfamily, separated by the `wdth` axis rather than by family.
A speaker cabinet is a wide, flat, front-facing object; the display face is set ultra-expanded to match it.

**IBM Plex Mono** for panel data: specs, dB readouts, prices, section labels. The vernacular of silkscreened gear panels and rental invoices.

### Structure

Sections are labelled as stages of a **signal chain** - `SOURCE → ROOM → RIG → DELIVERY → BOOK` -
because a PA signal chain and a rental journey genuinely are the same sequence.
The device encodes something true; it is not 01 / 02 / 03 applied to unordered content.
Explicit numbering appears in exactly one place: the delivery steps, which really are a sequence.

A persistent **patch panel** rail runs down the left edge - section markers, live SPL readout, the sound toggle.
It gives the page a mixing-desk identity from the first pixel and collapses to a transport bar on mobile.

## The signature

Three coupled ideas, all the same idea:

1. **One real audio analyser drives the entire page.**
   Silent and calm on load. One button - *Turn it on* - and a four-on-the-floor loop, synthesised live in WebAudio from oscillators and filtered noise (no audio files, nothing licensed, nothing fetched), starts feeding an FFT.
   Waves, cone excursion, glow intensity and type all read from that one analyser.
   With sound off, everything falls back to a gentle simulated envelope, so the page is never dead.

2. **The headline breathes on the `wdth` axis.**
   Bass amplitude drives the variable font's width. Cone excursion becomes letter excursion.
   The type is not a delivery vehicle for the copy; it is the thing moving.
   It is set to the measure: the size comes from the widest the axis will ever open to, so the lines are the lines and the breath never costs a millimetre of layout.
   A headline that re-wraps on the kick throws the whole page down and up again, sixty times a minute.

3. **The room instrument.**
   A plan view of your space with the rig at one edge and pressure rings rippling outward,
   attenuating by the real inverse-square law (−6 dB per doubling of distance) and stopping at the walls.
   Set the space and the headcount; the rings, the SPL readout and the recommended rig all change.
   It is a real physical model that answers the customer's actual question, and it is the page's functional centre.

### The opening

The page opens on still water.
A dot lattice fills the screen, one drop lands in the middle of it, and a circular wave goes out - sodium on the crest, violet in the trough, fading as it spreads.
These are the room instrument's pressure rings arriving before the room, and they are the same physics: a wave leaving a source, losing amplitude with distance.

It holds only until the page is ready and never longer than 2.8 seconds, it cannot be clicked through because it never takes a click, and anyone who has asked for reduced motion never sees it at all.
The rig is not asked for until the wave is on its way out: evaluating three.js is a single task long enough to hold the wave still, and a loading animation that freezes is worse than no loading animation.

The water does not stop at the splash.
The hero stands on the same surface, turned right down, and every kick throws a ring out **from the cabinet** - so the first thing the page does after the loading wave is show you the same wave, leaving the speaker, crossing the room.
It is the room instrument's claim made twice: pressure is a thing that leaves a box and arrives somewhere else.
With the sound off the rings still come, on the simulated envelope, about one a second.

## Restraint

The boldness is spent on the room instrument, the breathing headline and the water they both sit on.
Everything around them is quiet: flat panels, hairline rules, generous space, no gradients used as decoration, no scattered scroll effects.
The hero's water is ground rather than subject - one lattice, a fifth of the splash's brightness, and it is the only place on the page besides the instrument where anything ripples.

Floor, not negotiable: responsive to 360px, visible keyboard focus, `prefers-reduced-motion` honoured (no ripple, no breathing, a single static 3D frame), audio opt-in only, all controls reachable without the canvas.

## Copy

Plain, dry, confident. British English. Prices in euros.
Rigs are named for the room they fill, in Dutch, since *spreker* is Dutch for speaker: **Keuken**, **Tuin**, **Schuur** - kitchen, garden, barn.
That naming reinforces the room-first thesis every time a rig is mentioned.
