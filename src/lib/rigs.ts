/**
 * The three rigs. Named for the room they fill, in Dutch — "spreker" is Dutch
 * for speaker, and naming by room rather than by model number is the whole
 * thesis of the site: you don't shop for a driver, you shop for a space.
 */

export type Rig = {
  id: 'keuken' | 'tuin' | 'schuur';
  name: string;
  gloss: string; // the English room, for anyone who doesn't read Dutch
  blurb: string;
  /** Peak SPL at one metre, on axis. The number every other calculation uses. */
  peakSpl: number;
  pricePerNight: number;
  heads: string; // the honest headcount, in words
  boxes: string[];
  /** Cabinet proportions for the 3D rig, in metres. */
  cabinet: { w: number; h: number; d: number };
  /** Woofers on the baffle: [y offset in cabinet heights, radius in metres]. */
  woofers: [number, number][];
  subs: number;
};

export const RIGS: Rig[] = [
  {
    id: 'keuken',
    name: 'Keuken',
    gloss: 'Kitchen',
    blurb:
      'A pair of eights on sticks. Fills a flat, a terrace or a long kitchen without making the walls complain. Fits in the boot of a hatchback.',
    peakSpl: 118,
    pricePerNight: 45,
    heads: 'Up to 60 people',
    boxes: ['2 × 8" powered tops', '2 × tripod stands', 'Mixer, cables, one spare'],
    cabinet: { w: 0.28, h: 0.46, d: 0.28 },
    woofers: [[-0.12, 0.09]],
    subs: 0,
  },
  {
    id: 'tuin',
    name: 'Tuin',
    gloss: 'Garden',
    blurb:
      'Twelves over a single eighteen. The one most people want: enough low end to hold a garden together once the sun goes, still quiet enough at the fence line.',
    peakSpl: 128,
    pricePerNight: 95,
    heads: 'Up to 150 people',
    boxes: ['2 × 12" powered tops', '1 × 18" subwoofer', '2 × stands, mixer, full loom'],
    cabinet: { w: 0.36, h: 0.6, d: 0.35 },
    woofers: [[-0.1, 0.13]],
    subs: 1,
  },
  {
    id: 'schuur',
    name: 'Schuur',
    gloss: 'Barn',
    blurb:
      'Fifteens over a pair of eighteens. A real system for a real room — a barn, a warehouse, a field. Comes with someone who knows how to fly it.',
    peakSpl: 136,
    pricePerNight: 190,
    heads: 'Up to 400 people',
    boxes: ['2 × 15" powered tops', '2 × 18" subwoofers', 'Desk, engineer, distro, spares'],
    cabinet: { w: 0.44, h: 0.72, d: 0.42 },
    woofers: [[-0.09, 0.16]],
    subs: 2,
  },
];

export const rigById = (id: Rig['id']) => RIGS.find((r) => r.id === id)!;
