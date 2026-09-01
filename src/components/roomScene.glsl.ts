/**
 * The light in the room.
 *
 * The rig lights the space, and the falloff is not an illustration of the sound
 * — it *is* the sound. A point source of light and a point source of sound both
 * spread their energy over the same expanding sphere, so both drop by the same
 * six decibels every time the distance doubles. Drawing one as the other costs
 * nothing in honesty and buys the only thing that matters here: nobody has to
 * be taught that far from the lamp is dark.
 *
 * The one place the curve is bent on purpose is at the level the party needs.
 * A pure falloff is a smooth gradient, and a smooth gradient cannot be read as
 * a threshold — which is exactly what was wrong with the version before this.
 * So the light comes up sharply across a few decibels either side of that
 * level, and the edge of the light is the edge of the party.
 */

import { ROOM } from '@/lib/room';

export const LIGHT_CHUNK = /* glsl */ `
uniform float uPeak;      // peak SPL at one metre, on axis
uniform float uTrim;      // how far the system is turned down
uniform float uDepth;     // metres per scene unit
uniform float uTarget;    // the level this party needs
uniform float uCeiling;   // the most this space takes

const float NEAR = ${ROOM.NEAR.toFixed(1)};
const float KNEE = ${ROOM.KNEE.toFixed(2)};
const float FLOOR_DB = ${ROOM.FLOOR.toFixed(1)};
const float CEIL_DB = ${ROOM.CEILING.toFixed(1)};
const float LN10 = 2.302585093;

const vec3 NIGHT = vec3(0.055, 0.042, 0.101);
const vec3 SODIUM = vec3(1.0, 0.62, 0.17);
const vec3 CLIP = vec3(1.0, 0.231, 0.188);

/** The level arriving at a plan position, in dB. Same arithmetic as lib/spl.ts. */
float splAt(vec2 p) {
  return uPeak - 20.0 * log(max(uDepth * length(p), NEAR)) / LN10 - uTrim;
}

/** How much light lands there: the falloff, with the knee at the answer. */
float lightAt(float spl) {
  float over = spl - uTarget;
  float lit = smoothstep(-KNEE, KNEE, over);
  float glow = clamp((over + FLOOR_DB) / (FLOOR_DB + CEIL_DB), 0.0, 1.0);
  return glow * (0.13 + 0.87 * lit);
}

/**
 * Sodium against a violet night, going warm-white only right at the box.
 * The curve is steepened past the falloff so the far end of a room goes
 * properly dark: the whole point is being able to see where the light stops.
 */
vec3 lamp(float b) {
  return NIGHT + SODIUM * pow(b, 1.6) * 0.85 + vec3(1.0, 0.95, 0.88) * pow(b, 6.0) * 0.22;
}

/** Cheap value noise, for a bit of ground under the light. */
float grain(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  vec4 h = vec4(
    dot(i, vec2(127.1, 311.7)),
    dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7)),
    dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7)),
    dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))
  );
  h = fract(sin(h) * 43758.5453);
  return mix(mix(h.x, h.y, f.x), mix(h.z, h.w, f.x), f.y);
}
`;

export const GROUND_VERT = /* glsl */ `
varying vec2 vPlan;
void main() {
  vPlan = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GROUND_FRAG = /* glsl */ `
precision highp float;
varying vec2 vPlan;

${LIGHT_CHUNK}

void main() {
  float spl = splAt(vPlan);
  float dSpl = max(fwidth(spl), 1e-4);
  vec2 metres = vPlan * uDepth;
  vec2 dGrid = fwidth(metres);

  float b = lightAt(spl);
  // Ground, rather than a plane: a little tooth in the surface, and only where
  // there is light to show it.
  b *= 1.0 - 0.13 * grain(metres * 1.7);
  vec3 col = lamp(b);

  // A metre grid, visible only where the light reaches it — so the ground has
  // a scale without a chart being drawn on the lawn.
  vec2 g = abs(fract(metres) - 0.5) / max(dGrid, vec2(1e-4));
  float grid = 1.0 - min(min(g.x, g.y), 1.0);
  col += vec3(1.0, 0.88, 0.66) * grid * 0.035 * b;

  // The edge of the light: exactly the level it has to be, so it can be
  // pointed at rather than estimated.
  float edge = 1.0 - smoothstep(0.6, 2.4, abs(spl - uTarget) / dSpl);
  col += vec3(1.0, 0.8, 0.46) * edge * 0.28;

  // And where the rig would be more than the space can take.
  col = mix(col, CLIP, smoothstep(uCeiling - 1.0, uCeiling + 1.5, spl) * 0.7);

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The walls, indoors. Their normals point into the room and they are drawn
 * front-face only, so whichever wall stands between you and the space is culled
 * and you are always looking into a cutaway rather than at the back of a box.
 */
export const WALL_VERT = /* glsl */ `
varying vec2 vPlan;
varying float vUp;
uniform float uWall;
void main() {
  vPlan = position.xz;
  vUp = position.y / uWall;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const WALL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vPlan;
varying float vUp;

${LIGHT_CHUNK}

void main() {
  // A wall takes light at a glancing angle and loses it towards the ceiling.
  float b = lightAt(splAt(vPlan)) * 0.42 * (1.0 - 0.7 * clamp(vUp, 0.0, 1.0));
  // Lifted a little off the background: a wall you cannot see at all is a room
  // that reads as a garden.
  gl_FragColor = vec4(lamp(b) * 0.9 + NIGHT * 0.85, 1.0);
}
`;
