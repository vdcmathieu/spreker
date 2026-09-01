/**
 * The numbers behind the room scene.
 *
 * The section draws your space as a room and lights it from the rig, because
 * light from a point source and sound from a point source obey the *same*
 * inverse-square law. Brightness is not standing in for loudness; it falls off
 * at exactly the rate loudness does. Nobody has to be taught that far from the
 * lamp is dark.
 */

import { operatingSpl, targetSpl, type Space } from './spl';
import type { Rig } from './rigs';

export const ROOM = {
  /** Metres. Everything in the scene is divided by the room's depth. */
  PERSON: 1.7,
  STAND: 1.35,
  /** The model is read from two metres out — see FRONT below. */
  NEAR: 2,
  /**
   * The dB either side of the level the party needs where the light's edge
   * falls. Small, because this is the one boundary the section exists to draw
   * and a soft gradient is exactly what made the old version unreadable.
   */
  KNEE: 2.5,
  /** dB under the target where the floor is as dark as it gets. */
  FLOOR: 15,
  /**
   * dB over the target where it is as bright as it gets. Deliberately further
   * than any rig actually reaches at the front, so the near end of the room is
   * never a flat white plate — a blown highlight is a lost reading.
   */
  CEILING: 22,
} as const;

/**
 * How much light lands where a level of `spl` arrives — the TypeScript half of
 * `lightAt` in the shader, so the people and the ground they stand on agree.
 *
 * The curve is the honest falloff everywhere except across a few decibels
 * either side of the level the party needs, where it comes up sharply. A pure
 * falloff is a smooth gradient, and a smooth gradient cannot be read as a
 * threshold — which is exactly what was wrong with the version before this.
 */
export function lightAt(spl: number, target: number): number {
  const over = spl - target;
  const t = Math.max(0, Math.min(1, (over + ROOM.KNEE) / (ROOM.KNEE * 2)));
  const lit = t * t * (3 - 2 * t);
  const glow = Math.max(0, Math.min(1, (over + ROOM.FLOOR) / (ROOM.FLOOR + ROOM.CEILING)));
  return glow * (0.13 + 0.87 * lit);
}

/** The level at the front of house, which is what the page plays at. */
export function frontSpl(rig: Rig, space: Space, heads: number): number {
  return operatingSpl(rig, space, heads, ROOM.NEAR);
}

/** What the crowd makes by itself, everywhere in the room, all night. */
export function crowdSpl(heads: number): number {
  return 60 + 10 * Math.log10(Math.max(heads, 2));
}

/**
 * The crowd, laid out from a seed so the same room always draws the same party.
 * Denser towards the rig, because that is where people stand. Positions are in
 * metres, with the rig at (0, 0) on the near wall.
 */
export function scatterCrowd(heads: number, w: number, d: number) {
  let seed = heads * 7919 + Math.round(w) * 131 + Math.round(d) * 17;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: Math.min(heads, 110) }, () => {
    const bias = rnd() ** 0.68;
    return {
      x: (rnd() - 0.5) * w * 0.88,
      y: 1.4 + bias * (d - 2.2),
      /** Their own phase, so a crowd does not bounce in unison. */
      phase: rnd() * Math.PI * 2,
      sway: 0.6 + rnd() * 0.8,
    };
  });
}

export type Spot = { id: string; name: string; x: number; y: number };

/** Three places worth standing, and the text equivalent of dragging yourself. */
export function spots(space: Space): Spot[] {
  return [
    { id: 'front', name: 'By the box', x: 0, y: ROOM.NEAR },
    { id: 'middle', name: 'In the middle', x: 0, y: space.d / 2 },
    { id: 'back', name: 'At the far corner', x: (space.w / 2) * 0.86, y: space.d * 0.94 },
  ];
}

/** Metres from the rig, never closer than the front of house. */
export function distance(x: number, y: number): number {
  return Math.max(ROOM.NEAR, Math.hypot(x, y));
}

/**
 * What it is like to stand there, in words.
 *
 * Decibels are a unit almost nobody owns, and an absolute comparison ("as loud
 * as a lawnmower") would be dishonest here because these are peak levels rather
 * than the continuous ones those figures are quoted at. What the model actually
 * knows is how far the music sits over the party's own noise, which is the
 * thing you feel — so that is what this says.
 */
export function heardAs(music: number, crowd: number): { line: string; can: boolean } {
  const over = music - crowd;
  if (over >= 14)
    return { line: 'The music owns it. You would lean in to say anything.', can: true };
  if (over >= 8)
    return { line: 'Loud and clear. You would raise your voice to talk over it.', can: true };
  if (over >= 3)
    return { line: 'There, but you are competing with the room to be heard.', can: true };
  if (over >= -2)
    return { line: 'Level with the party. You would catch the beat, not the tune.', can: false };
  return { line: 'Lost in the noise. You would know music was on somewhere.', can: false };
}

/** Whether someone standing here can hear it — the one boundary that matters. */
export function canHear(rig: Rig, space: Space, heads: number, x: number, y: number): boolean {
  return operatingSpl(rig, space, heads, distance(x, y)) >= targetSpl(heads);
}
