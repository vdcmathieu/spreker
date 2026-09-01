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
in the room the rig is a sodium lamp and **brightness is sound pressure** at the real rate, with clip red where it would be more than the space takes.
The one saturated sodium object in that room is you, because you are also the control.
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
   A four-on-the-floor loop, synthesised live in WebAudio from oscillators and filtered noise (no audio files, nothing licensed, nothing fetched), feeds an FFT.
   It starts on its own: a rig you have to switch on is a shop, and a rig that is already running is a party.
   Where the browser will not allow that unasked, the first touch anywhere gets it, and one button in the rail - *Sound on* - stops it at any moment.
   Waves, cone excursion, glow intensity and type all read from that one analyser.
   With sound off, everything falls back to a gentle simulated envelope, so the page is never dead.

2. **The headline breathes on the `wdth` axis.**
   Bass amplitude drives the variable font's width. Cone excursion becomes letter excursion.
   The type is not a delivery vehicle for the copy; it is the thing moving.
   It is set to the measure: the size comes from the widest the axis will ever open to, so the lines are the lines and the breath never costs a millimetre of layout.
   A headline that re-wraps on the kick throws the whole page down and up again, sixty times a minute.

3. **The room instrument.**
   Your space drawn as a space, and lit by the rig.
   The fence is where your fence is, the people are people, and the light falls off at **exactly** the rate the sound does - a point source of light and a point source of sound spread their energy over the same expanding sphere, so both lose six decibels every time the distance doubles.
   The brightness on the lawn is not standing in for the loudness. It is the loudness.
   Whoever is standing in enough of that light is dancing; whoever is not is standing still, and you can count them.

   Two versions came before this one and both failed the same way.
   A plan view coloured by a continuous gradient hid the answer inside a hue the eye cannot measure.
   A landscape with the pressure as its height read the answer clearly and asked the viewer to accept that *up* meant decibels rather than ceiling height - a leap a chart-reader makes and a person hiring a speaker for a birthday should not have to.
   Both needed their key read before any of them meant anything, which is the tell: a picture that needs a legend is not doing the work.
   This one has no key.

   The curve is honest everywhere except across a few decibels either side of the level the party needs, where the light comes up sharply.
   That is deliberate and it is the one thing here that is drawn rather than measured: a pure falloff is a smooth gradient, and a smooth gradient cannot be read as a threshold.
   The edge of the light is the edge of the party, and in a room the rig cannot fill you can see exactly where it stops and how many people are standing beyond it in the dark.

   **And you can pick yourself up and put yourself anywhere in it.**
   Drag yourself to the far fence and, with the sound on, the music really does get quieter and duller - the level from the same model, the top end going first because by then you are well off the horn's axis.
   Meanwhile the party's own noise does not get quieter, because a crowd is the same loudness wherever you stand.
   So walking to the back does not turn the music down; it lets the room swallow it.
   That is the section's answer, and it is the one form of it nobody has to interpret: you hear it.

   It is a real physical model answering the customer's actual question, and it is the page's functional centre.

### The opening

The page opens on still water.
A dot lattice fills the screen, one drop lands in the middle of it, and a circular wave goes out - sodium on the crest, violet in the trough, fading as it spreads.
These are the room instrument's pressure rings arriving before the room, and they are the same physics: a wave leaving a source, losing amplitude with distance.

It holds only until the page is ready and never longer than 2.8 seconds, it cannot be clicked through because it never takes a click, and anyone who has asked for reduced motion never sees it at all.
The rig is not asked for until the wave is on its way out: evaluating three.js is a single task long enough to hold the wave still, and a loading animation that freezes is worse than no loading animation.

The water does not stop at the splash.
The hero stands on the same surface, turned right down, and every kick throws a ring out **from the cabinet** - so the first thing the page does after the loading wave is show you the same wave, leaving the speaker, crossing the room.
It is the room instrument's claim made twice: pressure is a thing that leaves a box and arrives somewhere else - and in the room, the thing that arrives is light.
With the sound off the rings still come, on the simulated envelope, about one a second.

## Restraint

The boldness is spent on the room instrument, the breathing headline and the water they both sit on.
Everything around them is quiet: flat panels, hairline rules, generous space, no gradients used as decoration, no scattered scroll effects.
Nothing in the room is there to look like something.
The light is the level, the people are the people, the fence is the fence - and the panel beside it says the same thing in words, so the room is readable rather than merely atmospheric.
The hero's water is ground rather than subject - one lattice, a fifth of the splash's brightness, and it is the only place on the page besides the instrument where anything ripples.

Floor, not negotiable: responsive to 360px, visible keyboard focus, `prefers-reduced-motion` honoured (no ripple, no breathing, nobody dancing, a single static frame that is still fully readable - and no sound unasked, since the analyser is the motion), sound that starts by itself always stoppable from a control that is on screen from the first pixel, all controls reachable without the canvas - including where you are standing, which has three named spots in the panel as well as the drag.

## Copy

Plain, dry, confident. British English. Prices in euros.
Rigs are named for the room they fill, in Dutch, since *spreker* is Dutch for speaker: **Keuken**, **Tuin**, **Schuur** - kitchen, garden, barn.
That naming reinforces the room-first thesis every time a rig is mentioned.

## The three cabinets

The rig section stands one box up close and turns it slowly, and for a while that box was the same box three times at three sizes.
It read as one box three times, because it was: the stage fits whatever it is given to the frame, so the only thing that told the three apart was normalised away before anyone saw it.

Each rig is now built differently, and the differences are the ones you would notice in a van.
The **Keuken** is a single moulded shell - the top raked back, the bottom cut to the monitor angle so it can be laid on its side, every edge soft, a carry handle moulded over the top and no steel on it anywhere, because nothing that size is expected to take a hit.
The **Tuin** is painted plywood, raked ten degrees a side so a pair nest face to face, steel on all eight corners, handles set into the slant, and a rectangular horn showing through a cut in a full-face perforated grille - rectangular because its coverage is, ninety degrees across the garden and none of it in the neighbour's window.
The **Schuur** is the one box on the page that is not a top: a wide sub on castors, one enormous cone under a round grille with a reflex slot open either side of it, and a pole standing out of the top waiting for the tops to go on.
That pole is doing the work of a sentence. The Schuur is not a box, it is a stack, and it is the only one of the three that has to say so.

Two rules came out of getting this wrong.
**The drivers have to be visible** - a grille dense enough to read as steel at this distance is a solid panel with a speaker somewhere behind it, and a horn sunk behind one is a dark hole.
So the perforation is open, its pitch is set in millimetres rather than in texels, and where a horn would disappear the grille has a hole cut in it instead.
**And the light has to reach them.** Metalness reflects the environment and this environment is a dark violet room; the flares were black until they were made mostly diffuse.
