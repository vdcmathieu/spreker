/**
 * The sound-pressure model behind the room instrument.
 *
 * It is deliberately a real model rather than a plausible-looking curve: the
 * whole point of the section is to answer "will it actually reach the back",
 * so the numbers have to come from somewhere honest.
 *
 *   direct field      SPL(d) = peak − 20·log10(d)          (inverse square, −6 dB per doubling)
 *   reverberant field indoors only, roughly constant across the room, from the
 *                     room's own surface area
 *   total             the two summed in the power domain, not added as decibels
 *
 * Everything is peak SPL, on axis, at one metre — the number written on the
 * back of a powered speaker.
 */

import type { Rig } from './rigs';

export type Space = {
  id: 'flat' | 'garden' | 'barn' | 'warehouse';
  name: string;
  /** Plan dimensions in metres. The rig stands at the middle of one short wall. */
  w: number;
  d: number;
  indoor: boolean;
  /** Ceiling height, only used indoors, for the reverberant field. */
  h: number;
  /**
   * The most this space will take at the front, in dB peak. It is a property of
   * the room and the people in it — neighbours through a wall, a fence line,
   * a field with nobody near it — not of the speaker, which is why it lives
   * here rather than on the rig.
   */
  takes: number;
  note: string;
};

export const SPACES: Space[] = [
  { id: 'flat', name: 'Flat', w: 6, d: 9, indoor: true, h: 2.6, takes: 102, note: 'Neighbours through the wall' },
  { id: 'garden', name: 'Garden', w: 10, d: 16, indoor: false, h: 0, takes: 112, note: 'Nothing overhead to help you' },
  { id: 'barn', name: 'Barn', w: 14, d: 22, indoor: true, h: 7, takes: 116, note: 'Long reverb, hard surfaces' },
  { id: 'warehouse', name: 'Warehouse', w: 22, d: 34, indoor: true, h: 9, takes: 120, note: 'A room that eats systems' },
];

export const spaceById = (id: Space['id']) => SPACES.find((s) => s.id === id)!;

/**
 * How many people the space physically holds, standing. Two per square metre is
 * a packed crowd; past that it is not a sound problem any more. Capping the
 * slider here keeps the instrument from answering questions like "a hundred and
 * fifty people in a one-bedroom flat".
 */
export function capacity(space: Space): number {
  return Math.round((space.w * space.d * 2) / 5) * 5;
}

/** Direct field only: what one box does at distance d, outdoors, over flat ground. */
export function directSpl(peak: number, d: number): number {
  return peak - 20 * Math.log10(Math.max(d, 1));
}

/**
 * Reverberant field, from the room constant R = Sα/(1−α).
 * α is fixed at 0.18 — a plausible mid-band average for a hard-surfaced room
 * with people in it. Outdoors there is no reverberant field at all.
 */
function reverberantSpl(peak: number, space: Space): number {
  if (!space.indoor) return -Infinity;
  const surface = 2 * (space.w * space.d + space.w * space.h + space.d * space.h);
  const alpha = 0.18;
  const R = (surface * alpha) / (1 - alpha);
  return peak + 10 * Math.log10(4 / R);
}

/** Power-domain sum of two levels in dB. */
function sumDb(a: number, b: number): number {
  return 10 * Math.log10(10 ** (a / 10) + 10 ** (b / 10));
}

/**
 * Total SPL at distance d — direct plus reverberant, which is what a meter in
 * the room would read.
 */
export function splAt(rig: Rig, space: Space, d: number): number {
  return sumDb(directSpl(rig.peakSpl, d), reverberantSpl(rig.peakSpl, space));
}

/**
 * How much the room's own reverberation adds at the far corner, over the direct
 * sound. Indoors this can be considerable, and it is why a small rig can measure
 * loud in a big hard room while still sounding like a radio in the next street:
 * reverberant energy is smeared in time, so it adds level without adding
 * intelligibility. Everything the page judges, it judges on the direct field.
 */
export function reverbLift(rig: Rig, space: Space): number {
  if (!space.indoor) return 0;
  const direct = directSpl(rig.peakSpl, furthestCorner(space));
  return splAt(rig, space, furthestCorner(space)) - direct;
}

/**
 * How loud you have to be to be heard. A crowd generates roughly
 * 60 + 10·log10(n) dB of its own noise; music needs to sit about 8 dB over
 * that to feel like a party rather than a background. 88 dB is the floor —
 * below it nobody dances, however few of them there are.
 */
export function targetSpl(heads: number): number {
  const crowd = 60 + 10 * Math.log10(Math.max(heads, 2));
  return Math.max(88, crowd + 8);
}

/** Distance from the rig to the furthest corner of the space. */
export function furthestCorner(space: Space): number {
  return Math.hypot(space.w / 2, space.d);
}

/**
 * A system is not run flat out; it is turned down until the back of the room is
 * exactly loud enough. `trim` is how far down that is, and every level the page
 * shows is the operated level, not the peak on the box.
 *
 * Music needs somewhere to peak, so a rig only counts as clearing the room if it
 * still has this much spare when the back is where it needs to be. A system run
 * at its absolute limit all night is a system that dies at midnight.
 */
export const HEADROOM_MIN = 6;

/** dB the rig is turned down by, once the far corner is at the target. */
export function trim(rig: Rig, space: Space, heads: number): number {
  return Math.max(0, directSpl(rig.peakSpl, furthestCorner(space)) - targetSpl(heads));
}

/** The direct level arriving at distance d, with the system trimmed. */
export function operatingSpl(rig: Rig, space: Space, heads: number, d: number): number {
  return directSpl(rig.peakSpl, d) - trim(rig, space, heads);
}

export type Verdict = {
  /** 'short' — cannot reach the back with anything left over.
   *  'over'  — reaching the back means punishing the front. */
  status: 'short' | 'good' | 'over';
  atBack: number;
  atFront: number;
  target: number;
  headroom: number;
  line: string;
};

export function assess(rig: Rig, space: Space, heads: number): Verdict {
  const target = targetSpl(heads);
  const far = furthestCorner(space);
  const headroom = directSpl(rig.peakSpl, far) - target;
  const t = Math.max(0, headroom);
  const atBack = directSpl(rig.peakSpl, far) - t;
  const atFront = directSpl(rig.peakSpl, 2) - t;

  if (headroom < HEADROOM_MIN) {
    const missing = HEADROOM_MIN - headroom;
    return {
      status: 'short',
      atBack,
      atFront,
      target,
      headroom,
      line:
        headroom < 0
          ? `${Math.abs(headroom).toFixed(0)} dB short at the back. The people by the far wall will be talking, not dancing.`
          : `Only ${headroom.toFixed(0)} dB spare, and music needs ${HEADROOM_MIN}. It would be flat out all night — ${missing.toFixed(0)} dB short of comfortable.`,
    };
  }
  if (atFront > space.takes) {
    return {
      status: 'over',
      atBack,
      atFront,
      target,
      headroom,
      line: `Reaching the back means ${atFront.toFixed(0)} dB at the front, and this space takes ${space.takes}. Anyone near the rig is going home early.`,
    };
  }
  return {
    status: 'good',
    atBack,
    atFront,
    target,
    headroom,
    line:
      space.takes - atFront < 2
        ? `${headroom.toFixed(0)} dB spare at the far corner, and the front sits right on what this space takes. Loud everywhere it needs to be, and not a decibel further.`
        : `${headroom.toFixed(0)} dB spare at the far corner, and ${atFront.toFixed(0)} dB at the front against a ceiling of ${space.takes}. Loud everywhere it needs to be, bearable everywhere else.`,
  };
}

/** The smallest rig that clears the room. Falls back to the largest. */
export function recommend(rigs: Rig[], space: Space, heads: number): Rig {
  return rigs.find((r) => assess(r, space, heads).status === 'good') ?? rigs[rigs.length - 1];
}
