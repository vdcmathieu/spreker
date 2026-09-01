'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bounds, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { levels } from '@/lib/audio';
import type { Rig } from '@/lib/rigs';

/**
 * One cabinet, close - and a different cabinet for each rig.
 *
 * An earlier pass drew the whole rig - two tops, two subs, stands - and at the
 * size it renders on a page that reads as four floating boxes and you cannot
 * see the one thing worth seeing. The signature is the cone moving with the
 * bass, so the camera stays on a single box.
 *
 * The pass after that drew the *same* box three times at three sizes, which is
 * worse than it sounds: the stage fits whatever it is given to the frame, so
 * the size is normalised away and all three arrived identical. Hire gear does
 * not work like that, and the differences are the interesting part:
 *
 *   Keuken  a moulded plastic wedge, cut to the monitor angle at the back, a
 *           carry handle over the top, the waveguide moulded into the baffle in
 *           the open and a small grille over the eight alone.
 *   Tuin    painted plywood, raked ten degrees a side so a pair nest in a van,
 *           steel corners, and a rectangular horn showing through a cut in a
 *           full-face perforated grille.
 *   Schuur  a wide sub on castors: one enormous cone under a round grille, a
 *           reflex slot open either side of it, and a pole standing out of the
 *           top waiting for a top. That pole is the honest part - the Schuur is
 *           not a box, it is a stack, and it is the only one that has to say so.
 *
 * The rule the last two passes broke, and the reason this one is built the way
 * it is: **the drivers have to be visible**. A grille dense enough to read as
 * steel at this distance is a solid panel with a speaker somewhere behind it.
 * So the perforation is open, its pitch is set in millimetres rather than in
 * texels, and where a horn would disappear behind the grille the grille has a
 * hole cut in it instead.
 *
 * Everything is procedural: no model files, no image textures, no HDR. The
 * grilles and the paint are canvas patterns drawn at run time and the light
 * comes from lightformers, so nothing is fetched.
 */

const STEEL = { color: '#4a4757', roughness: 0.32, metalness: 0.85 } as const;
/**
 * Horn flare. Deliberately not very metallic: metalness reflects the
 * environment, this environment is a dark violet room, and the first version of
 * these horns came out as two black letterboxes because of it.
 */
const FLARE = { color: '#6f6c80', roughness: 0.34, metalness: 0.3 } as const;
/**
 * Moulded polypropylene: a shade smoother than plywood, and with the faintest
 * sheen on it. Only the faintest. Anything glossier - and 0.62 roughness with a
 * light clearcoat was enough - throws a broad specular of the scene's warm
 * lightformer across the entire baffle, and the box arrives as an orange slab
 * while the two rougher boxes beside it stay charcoal.
 */
const MOULDING = { color: '#212028', roughness: 0.8, metalness: 0.04 } as const;
const HOLE = { color: '#08080c', roughness: 0.98 } as const;

/* -------------------------------------------------------------------------- */
/* Procedural surfaces                                                        */
/* -------------------------------------------------------------------------- */

/** Holes per tile on the perforation texture. One tile is PITCH_PX square. */
const PERF_PX = 15;
const PERF_TILE = 512 / PERF_PX;

/**
 * Perforated steel, as an alpha map: a staggered lattice about forty per cent
 * open, which is roughly what real grille stock is and - the part that matters
 * - open enough that a cone reads through it.
 */
function usePerf() {
  return useMemo(() => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#fff';
    for (let y = 0; y < size; y += PERF_PX) {
      for (let x = -PERF_PX; x < size + PERF_PX; x += PERF_PX) {
        const off = (y / PERF_PX) % 2 === 0 ? 0 : PERF_PX / 2;
        g.beginPath();
        g.arc(x + off, y, 5.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, []);
}

/**
 * The same perforation at a stated hole pitch in metres, so the small box wears
 * a fine domestic mesh and the sub wears coarse touring stock. Shape geometry
 * lays its UVs out in local units, so the repeat is metres per tile.
 */
function usePerfAt(pitchM: number) {
  const base = usePerf();
  return useMemo(() => {
    const tex = base.clone();
    tex.needsUpdate = true;
    const r = 1 / (PERF_TILE * pitchM);
    tex.repeat.set(r, r);
    return tex;
  }, [base, pitchM]);
}

/**
 * Warty PA paint, as a bump map. It is the whole difference between a box that
 * reads as plywood and a box that reads as a render of a box.
 */
function usePaint(repeat: number) {
  return useMemo(() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    // Seeded, not random: the React compiler forbids an impure call during
    // render, and a grain that changes on every mount is a grain you cannot
    // judge in a screenshot.
    let seed = 0x9e3779b9;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      // Two octaves of grain: a fine speckle over a coarser mottle.
      const v = 128 + (rnd() - 0.5) * 150 + (rnd() - 0.5) * 60;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 8;
    return tex;
  }, [repeat]);
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers                                                           */
/* -------------------------------------------------------------------------- */

type Rect = { w: number; h: number; y?: number; x?: number; r?: number };

function traceRect(p: THREE.Path, { w, h, y = 0, x = 0, r = 0 }: Rect) {
  const hw = w / 2;
  const hh = h / 2;
  const k = Math.min(r, hw, hh);
  p.moveTo(x - hw + k, y - hh);
  p.lineTo(x + hw - k, y - hh);
  if (k) p.quadraticCurveTo(x + hw, y - hh, x + hw, y - hh + k);
  p.lineTo(x + hw, y + hh - k);
  if (k) p.quadraticCurveTo(x + hw, y + hh, x + hw - k, y + hh);
  p.lineTo(x - hw + k, y + hh);
  if (k) p.quadraticCurveTo(x - hw, y + hh, x - hw, y + hh - k);
  p.lineTo(x - hw, y - hh + k);
  if (k) p.quadraticCurveTo(x - hw, y - hh, x - hw + k, y - hh);
}

/** A rounded rectangle with rectangular or circular holes punched out of it. */
function panelShape(
  outer: Rect,
  holes: (Rect | { cx: number; cy: number; radius: number })[] = [],
) {
  const s = new THREE.Shape();
  traceRect(s, outer);
  for (const hole of holes) {
    const p = new THREE.Path();
    if ('radius' in hole) p.absarc(hole.cx, hole.cy, hole.radius, 0, Math.PI * 2, true);
    else traceRect(p, hole);
    s.holes.push(p);
  }
  return s;
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                      */
/* -------------------------------------------------------------------------- */

/** A driver, facing the viewer: chassis, bolts, rubber roll, cone, dust cap. */
function Woofer({
  radius,
  bolts = 6,
  drive = 0.016,
  deep = false,
}: {
  radius: number;
  bolts?: number;
  /** Peak excursion in metres. A sub moves visibly further than an eight. */
  drive?: number;
  /** A long-throw cone sits deeper in its basket. */
  deep?: boolean;
}) {
  const cone = useRef<THREE.Group>(null);

  useFrame(() => {
    if (cone.current) cone.current.position.z = levels.bass * drive;
  });

  return (
    <group>
      {/* Chassis ring, bolted to the baffle. */}
      <mesh>
        <ringGeometry args={[radius * 0.96, radius * 1.12, 48]} />
        <meshStandardMaterial color="#2e2c38" roughness={0.5} metalness={0.55} />
      </mesh>
      {Array.from({ length: bolts }, (_, i) => {
        const a = (i / bolts) * Math.PI * 2 + Math.PI / bolts;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * radius * 1.04, Math.sin(a) * radius * 1.04, 0.003]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[radius * 0.04, radius * 0.04, 0.005, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        );
      })}
      {/* Rubber surround. A torus already lies in the baffle plane - do not
          rotate it, or it renders as a bar across the driver. */}
      <mesh position={[0, 0, 0.004]}>
        <torusGeometry args={[radius * 0.87, radius * (deep ? 0.13 : 0.11), 14, 56]} />
        <meshStandardMaterial color="#33313d" roughness={0.62} />
      </mesh>
      <group ref={cone}>
        {/* Cone: axis rotated onto -Z so the apex sits inside the cabinet. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -radius * (deep ? 0.3 : 0.24)]}>
          <coneGeometry args={[radius * 0.85, radius * (deep ? 0.78 : 0.62), 56, 1, true]} />
          <meshStandardMaterial color="#26242f" roughness={0.86} side={THREE.DoubleSide} />
        </mesh>
        {/* Dust cap: a dome facing the viewer, not the ceiling. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.002]}>
          <sphereGeometry
            args={[radius * (deep ? 0.3 : 0.23), 30, 20, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial color="#454152" roughness={0.5} metalness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A round waveguide, moulded into the baffle and standing proud of it. It has
 * to stand proud: sunk behind a grille it is a dark hole nobody can see, which
 * is exactly how the first version of this came out.
 */
function RoundHorn({ mouth, len = 0.045 }: { mouth: number; len?: number }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -len / 2]}>
        <cylinderGeometry args={[mouth, mouth * 0.34, len, 44, 1, true]} />
        <meshStandardMaterial {...FLARE} side={THREE.DoubleSide} />
      </mesh>
      {/* The lip around the mouth, so the flare has an edge to catch light on. */}
      <mesh>
        <ringGeometry args={[mouth, mouth * 1.14, 44]} />
        <meshStandardMaterial color="#3a3844" roughness={0.42} metalness={0.45} />
      </mesh>
      {/* The phase plug at the throat. Without something solid at the bottom of
          it, a flare is a dark hole rather than a horn. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -len + 0.006]}>
        <sphereGeometry args={[mouth * 0.46, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8e8ba4" roughness={0.38} metalness={0.28} />
      </mesh>
    </group>
  );
}

/**
 * A constant-directivity horn: wide, short and rectangular, because that is the
 * shape of the coverage it exists to make - ninety degrees across the garden,
 * sixty up and down, none of it in the neighbour's window. Four radial segments
 * started at a quarter turn give a square frustum; the scale makes it a
 * rectangle.
 */
function RectHorn({ halfW, halfH, len = 0.07 }: { halfW: number; halfH: number; len?: number }) {
  const unit = 0.06;
  const throat = 0.34;
  return (
    <group>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -len / 2]}
        scale={[halfW / unit, 1, halfH / unit]}
      >
        <cylinderGeometry args={[unit, unit * throat, len, 4, 1, true, Math.PI / 4]} />
        <meshStandardMaterial {...FLARE} side={THREE.DoubleSide} flatShading />
      </mesh>
      {/* The throat, closed by the driver's exit. */}
      <mesh position={[0, 0, -len + 0.002]} scale={[halfW / unit, halfH / unit, 1]}>
        <circleGeometry args={[unit * throat * 0.98, 24]} />
        <meshStandardMaterial color="#59566a" roughness={0.36} metalness={0.5} />
      </mesh>
      {/* The flange the horn bolts through, and the driver behind it. */}
      <mesh>
        <shapeGeometry
          args={[
            panelShape(
              { w: halfW * 2.22, h: halfH * 2.5, r: 0.012 },
              [{ w: halfW * 2, h: halfH * 2 }],
            ),
          ]}
        />
        <meshStandardMaterial color="#34323e" roughness={0.44} metalness={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -len - 0.03]}>
        <cylinderGeometry args={[0.03, 0.035, 0.055, 20]} />
        <meshStandardMaterial color="#26252e" roughness={0.55} metalness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Steel corner protectors - the detail that says "this lives in a van". A
 * tapered cabinet needs its back pair pulled in, or four of the eight float off
 * the corners they are supposed to be protecting.
 */
function Corners({
  hx,
  hy,
  hz,
  backHx = hx,
  size = 0.036,
}: {
  hx: number;
  hy: number;
  hz: number;
  backHx?: number;
  size?: number;
}) {
  const inset = size / 2.4;
  return (
    <>
      {[-1, 1].map((sy) =>
        [-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sy}${sz}`}
              position={[
                sx * ((sz > 0 ? hx : backHx) - inset),
                sy * (hy - inset),
                sz * (hz - inset),
              ]}
            >
              <boxGeometry args={[size, size, size]} />
              <meshStandardMaterial color="#2f2d39" roughness={0.56} metalness={0.55} />
            </mesh>
          )),
        ),
      )}
    </>
  );
}

/**
 * A handle set into the side: a real recess with a bar across the back of it,
 * rather than a dark rectangle painted on. The recess is what sells it - a flat
 * patch reads as a sticker at any angle but dead on.
 */
function SideHandle({
  position,
  rotation,
  w,
  h,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  w: number;
  h: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* The dish, sunk into the wall. */}
      <mesh position={[0, 0, -0.016]}>
        <boxGeometry args={[w, h, 0.032]} />
        <meshStandardMaterial color="#141319" roughness={0.94} />
      </mesh>
      {/* Its lip, catching the light the recess does not. */}
      <mesh position={[0, 0, 0.0005]}>
        <shapeGeometry
          args={[panelShape({ w: w * 1.16, h: h * 1.4, r: 0.01 }, [{ w, h }])]}
        />
        <meshStandardMaterial color="#2b2933" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* The bar you actually pick it up by. */}
      <mesh position={[0, 0, -0.007]}>
        <boxGeometry args={[w * 0.82, h * 0.2, 0.01]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
    </group>
  );
}

/** The peak LED. Amber, and it means something. */
function PeakLed({ position }: { position: [number, number, number] }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (!mat.current) return;
    const hot = levels.rms > 0.5 ? 1 : 0.08;
    mat.current.emissiveIntensity += (hot * 5 - mat.current.emissiveIntensity) * 0.22;
  });

  return (
    <mesh position={position}>
      <circleGeometry args={[0.008, 18]} />
      <meshStandardMaterial
        ref={mat}
        color="#ff9e2c"
        emissive="#ff9e2c"
        emissiveIntensity={0.2}
        toneMapped={false}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/* Keuken - the moulded wedge                                                 */
/* -------------------------------------------------------------------------- */

function WedgeBox({ rig }: { rig: Rig }) {
  const { w, h, d } = rig.stage.size;
  const r = rig.stage.driver;

  const shell = useMemo(() => {
    const bev = 0.014;
    const hz = d / 2;
    const hy = h / 2;
    // The side profile, in (z, y). Front baffle upright; top raked back; the
    // wedge cut across the bottom rear, so it can be laid down as a monitor.
    const s = new THREE.Shape();
    s.moveTo(hz, -hy);
    s.lineTo(hz, hy * 0.9);
    s.lineTo(-hz * 0.3, hy);
    s.lineTo(-hz, hy * 0.26);
    s.lineTo(-hz, -hy * 0.2);
    s.lineTo(-hz * 0.34, -hy);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: w - bev * 2,
      bevelEnabled: true,
      bevelSize: bev,
      bevelThickness: bev,
      bevelSegments: 4,
      curveSegments: 2,
    });
    // Extrusion runs along +Z; turn it onto the width axis and centre it.
    g.rotateY(-Math.PI / 2);
    g.translate(w / 2 - bev, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [w, h, d]);

  const wooferY = -h * 0.19;
  const hornY = h * 0.245;
  const mouth = w * 0.27;

  return (
    <group>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial {...MOULDING} />
      </mesh>

      {/* The moulded baffle: a shallow recess with the waveguide out in the
          open on it. On a box this size the waveguide is part of the moulding,
          not a part bolted behind a grille. */}
      <mesh position={[0, 0, d / 2 + 0.001]}>
        <shapeGeometry args={[panelShape({ w: w * 0.88, h: h * 0.92, r: 0.02 })]} />
        <meshStandardMaterial color="#1b1a22" roughness={0.9} />
      </mesh>

      <group position={[0, hornY, d / 2 + 0.016]}>
        <RoundHorn mouth={mouth} />
      </group>

      <group position={[0, wooferY, d / 2 + 0.003]}>
        <Woofer radius={r} bolts={6} drive={0.013} />
      </group>

      {/* No grille. The third box gets the third answer to the same question:
          the Tuin hides its drivers behind a full sheet of perforated steel,
          the Schuur puts a round one over the cone and leaves the slots open,
          and this one has nothing over it at all - which is what a moulded top
          this size looks like, and the only version of this face where the
          eight is actually visible. Two drivers fill the baffle instead. */}
      <mesh position={[0, wooferY, d / 2 + 0.004]}>
        <ringGeometry args={[r * 1.13, r * 1.24, 48]} />
        <meshStandardMaterial color="#2a2833" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* The moulded carry handle, arching over the top. */}
      <mesh position={[0, h / 2 - 0.028, -d * 0.03]} castShadow>
        <torusGeometry args={[w * 0.26, 0.014, 12, 32, Math.PI]} />
        <meshStandardMaterial {...MOULDING} />
      </mesh>

      <PeakLed position={[w * 0.35, -h * 0.42, d / 2 + 0.018]} />

      {/* Moulded pips, so it sits on the worktop rather than hovering above it. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * w) / 3.1, -h / 2 - 0.004, (sz * d) / 4.4]}>
            <cylinderGeometry args={[0.014, 0.014, 0.01, 14]} />
            <meshStandardMaterial color="#17161c" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Tuin - the plywood workhorse                                               */
/* -------------------------------------------------------------------------- */

function TrapBox({ rig }: { rig: Rig }) {
  const { w, h, d } = rig.stage.size;
  const r = rig.stage.driver;
  const perf = usePerfAt(0.0045);
  const paint = usePaint(5);

  /** Half-width at the back, and the resulting side rake. */
  const backHalf = w * 0.31;
  const slant = Math.atan2(w / 2 - backHalf, d);

  const shell = useMemo(() => {
    const bev = 0.008;
    const hw = w / 2 - bev;
    const hd = d / 2 - bev;
    const bh = backHalf - bev;
    // The plan, in (x, -z): full width at the front, tapered to the back.
    const s = new THREE.Shape();
    s.moveTo(-hw, -hd);
    s.lineTo(hw, -hd);
    s.lineTo(bh, hd);
    s.lineTo(-bh, hd);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: h - bev * 2,
      bevelEnabled: true,
      bevelSize: bev,
      bevelThickness: bev,
      bevelSegments: 3,
      curveSegments: 1,
    });
    // Extrusion runs along +Z; stand it up on the height axis and centre it.
    g.rotateX(-Math.PI / 2);
    g.translate(0, -h / 2 + bev, 0);
    g.computeVertexNormals();
    return g;
  }, [w, h, d, backHalf]);

  const wooferY = -h * 0.17;
  const hornY = h * 0.27;
  const hornW = w * 0.36;
  const hornH = h * 0.088;

  return (
    <group>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial
          color="#232229"
          roughness={0.88}
          metalness={0.06}
          bumpMap={paint}
          bumpScale={0.4}
        />
      </mesh>

      {/* Recessed baffle. */}
      <mesh position={[0, 0, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.9, h * 0.94]} />
        <meshStandardMaterial color="#15141a" roughness={0.92} bumpMap={paint} bumpScale={0.2} />
      </mesh>

      <group position={[0, wooferY, d / 2 + 0.002]}>
        <Woofer radius={r} bolts={8} drive={0.017} />
      </group>

      {/* The horn comes forward to the grille line and the grille is cut around
          it, so the flare is the face of the box rather than a shadow behind
          perforated steel. */}
      <group position={[0, hornY, d / 2 + 0.02]}>
        <RectHorn halfW={hornW} halfH={hornH} />
      </group>

      {/* Full-face perforated grille, with the horn's cut-out in it. */}
      <mesh position={[0, 0, d / 2 + 0.02]}>
        <shapeGeometry
          args={[
            panelShape({ w: w * 0.92, h: h * 0.95, r: 0.014 }, [
              { w: hornW * 2.28, h: hornH * 2.56, y: hornY, r: 0.014 },
            ]),
          ]}
        />
        <meshStandardMaterial
          color="#25232d"
          alphaMap={perf}
          transparent
          roughness={0.62}
          metalness={0.34}
        />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => (
          <mesh
            key={`${sx}${sy}`}
            position={[sx * w * 0.42, sy * h * 0.44, d / 2 + 0.021]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.005, 0.005, 0.004, 6]} />
            <meshStandardMaterial {...STEEL} />
          </mesh>
        )),
      )}

      {/* Handles, set into the raked sides. */}
      {[-1, 1].map((s) => (
        <SideHandle
          key={s}
          position={[s * (w / 2 + backHalf) * 0.5, h * 0.14, 0]}
          rotation={[0, s * (Math.PI / 2 + slant), 0]}
          w={d * 0.46}
          h={h * 0.11}
        />
      ))}

      <Corners hx={w / 2} hy={h / 2} hz={d / 2} backHx={backHalf} />

      <PeakLed position={[w * 0.37, -h * 0.44, d / 2 + 0.022]} />

      {/* Rubber feet. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * w) / 3.4, -h / 2 - 0.008, (sz * d) / 3.6]}>
            <cylinderGeometry args={[0.018, 0.018, 0.016, 12]} />
            <meshStandardMaterial color="#1b1a22" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Schuur - the eighteen                                                      */
/* -------------------------------------------------------------------------- */

function SubBox({ rig }: { rig: Rig }) {
  const { w, h, d } = rig.stage.size;
  const r = rig.stage.driver;
  const perf = usePerfAt(0.007);
  const paint = usePaint(7);

  const portW = w * 0.115;
  const portH = h * 0.66;
  const portX = w * 0.39;

  /**
   * The shell is the front elevation with the two reflex slots punched out of
   * it, extruded backwards - so the slots are holes through the cabinet rather
   * than black rectangles painted on the front, and the bevel around each mouth
   * gives the light something to break on. A blocker further in closes them.
   */
  const shell = useMemo(() => {
    const bev = 0.01;
    const s = panelShape({ w: w - bev * 2, h: h - bev * 2, r: 0.014 }, [
      { w: portW, h: portH, x: -portX, r: 0.008 },
      { w: portW, h: portH, x: portX, r: 0.008 },
    ]);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: d - bev * 2,
      bevelEnabled: true,
      bevelSize: bev,
      bevelThickness: bev,
      bevelSegments: 3,
      curveSegments: 6,
    });
    g.translate(0, 0, -d / 2 + bev);
    g.computeVertexNormals();
    return g;
  }, [w, h, d, portW, portH, portX]);

  return (
    <group>
      <mesh geometry={shell} castShadow receiveShadow>
        <meshStandardMaterial
          color="#1f1e25"
          roughness={0.92}
          metalness={0.08}
          bumpMap={paint}
          bumpScale={0.5}
        />
      </mesh>

      {/* What you see when you look down a port: a hundred millimetres of duct
          and then the inside of the box. */}
      <mesh position={[0, 0, -d / 2 + 0.14]}>
        <boxGeometry args={[w * 0.98, h * 0.98, d * 0.5]} />
        <meshStandardMaterial {...HOLE} />
      </mesh>

      <group position={[0, 0, d / 2 + 0.002]}>
        <Woofer radius={r} bolts={10} drive={0.028} deep />
      </group>

      {/* A round steel grille over the cone only - the slots stay open. */}
      <mesh position={[0, 0, d / 2 + 0.028]}>
        <shapeGeometry args={[panelShape({ w: r * 2.44, h: r * 2.44, r: r * 1.22 })]} />
        <meshStandardMaterial
          color="#2a2833"
          alphaMap={perf}
          transparent
          roughness={0.56}
          metalness={0.4}
        />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.028]}>
        <ringGeometry args={[r * 1.22, r * 1.3, 60]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>

      {/* Pole cup, and the stub of pole standing in it: the tops go here. */}
      <mesh position={[0, h / 2 + 0.008, 0]}>
        <cylinderGeometry args={[0.038, 0.042, 0.018, 24]} />
        <meshStandardMaterial color="#2b2933" roughness={0.5} metalness={0.55} />
      </mesh>
      <mesh position={[0, h / 2 + 0.105, 0]} castShadow>
        <cylinderGeometry args={[0.019, 0.021, 0.2, 20]} />
        <meshStandardMaterial color="#3a3846" roughness={0.34} metalness={0.82} />
      </mesh>
      <mesh position={[0, h / 2 + 0.207, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.007, 20]} />
        <meshStandardMaterial color="#17161c" roughness={0.9} />
      </mesh>

      {/* Stacking dishes: where the next sub's feet drop in. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[(sx * w) / 2.6, h / 2 + 0.002, (sz * d) / 3.2]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.028, 20]} />
            <meshStandardMaterial color="#0d0c11" roughness={0.94} />
          </mesh>
        )),
      )}

      {/* Big recessed bar handles, one a side. */}
      {[-1, 1].map((s) => (
        <SideHandle
          key={s}
          position={[(s * w) / 2 + s * 0.001, h * 0.06, 0]}
          rotation={[0, (s * Math.PI) / 2, 0]}
          w={d * 0.42}
          h={h * 0.19}
        />
      ))}

      <Corners hx={w / 2} hy={h / 2} hz={d / 2} size={0.046} />

      <PeakLed position={[w * 0.46, -h * 0.42, d / 2 + 0.004]} />

      {/* Castors, so one person can move a barn's worth of low end. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[(sx * w) / 2.7, -h / 2 - 0.014, (sz * d) / 3]}>
            <mesh>
              <boxGeometry args={[0.052, 0.028, 0.052]} />
              <meshStandardMaterial color="#2b2933" roughness={0.5} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.034, -0.012]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.036, 0.036, 0.026, 20]} />
              <meshStandardMaterial color="#121116" roughness={0.86} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

/* -------------------------------------------------------------------------- */

export function Cabinet({ rig }: { rig: Rig }) {
  if (rig.stage.form === 'wedge') return <WedgeBox rig={rig} />;
  if (rig.stage.form === 'trap') return <TrapBox rig={rig} />;
  return <SubBox rig={rig} />;
}

function Staged({ rig, interactive }: { rig: Rig; interactive: boolean }) {
  const group = useRef<THREE.Group>(null);
  const eased = useRef({ x: 0.42, y: 0 });

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // A three-quarter view that drifts, leans towards the pointer, and recoils
    // a couple of millimetres on every kick.
    const targetY = 0.42 + Math.sin(t * 0.17) * 0.16 + (interactive ? state.pointer.x * 0.3 : 0);
    const targetX = -0.05 + (interactive ? -state.pointer.y * 0.08 : 0);
    const k = Math.min(1, delta * 2.4);
    eased.current.x += (targetY - eased.current.x) * k;
    eased.current.y += (targetX - eased.current.y) * k;
    group.current.rotation.y = eased.current.x;
    group.current.rotation.x = eased.current.y;
    group.current.position.z = -levels.beat * 0.014;
  });

  return (
    <group ref={group}>
      <Cabinet rig={rig} />
    </group>
  );
}

export function RigModel({ rig, interactive = true }: { rig: Rig; interactive?: boolean }) {
  return (
    <>
      {/* A violet wash raking from behind and a sodium key in front. Building
          the environment from lightformers means it never fetches an HDR. */}
      <Environment resolution={128} frames={1}>
        <Lightformer form="circle" intensity={2.5} color="#8b4dff" position={[-1.4, 0.9, -1.0]} scale={1.5} />
        <Lightformer form="circle" intensity={1.4} color="#4a25a8" position={[-2.4, -0.6, 0.4]} scale={1.8} />
        <Lightformer form="rect" intensity={0.28} color="#2e1668" position={[-5, 0.5, -3]} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={1.7} color="#ffb066" position={[4, 1.2, 3]} scale={[5, 5, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#c9cfff" position={[0, 5, 1]} rotation={[Math.PI / 2, 0, 0]} scale={[9, 9, 1]} />
        <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[-1.6, 0.8, 3.4]} scale={[0.4, 4, 1]} />
      </Environment>

      <ambientLight intensity={0.34} />
      {/* Key: cool and high, so the box reads as charcoal rather than as brown.
          The shadow camera is wound in to the size of a cabinet. Left at the
          default it covers ten metres, one texel is a centimetre across, and a
          box a third of a metre wide self-shadows its own key light off its own
          baffle - which is exactly how the smallest of the three came out an
          orange slab while the largest came out charcoal. */}
      <directionalLight
        position={[2.6, 3.6, 3.2]}
        intensity={2.3}
        color="#eceaff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-0.8}
        shadow-camera-right={0.8}
        shadow-camera-top={0.8}
        shadow-camera-bottom={-0.8}
        shadow-camera-near={1}
        shadow-camera-far={12}
        shadow-bias={-0.0002}
        shadow-normalBias={0.008}
      />
      {/* Rim: the violet, hard from behind left. */}
      <directionalLight position={[-3.2, 0.5, -2.6]} intensity={1.4} color="#8b4dff" />
      {/* A single warm accent low and to the right - the streetlight. */}
      <pointLight position={[2.1, -0.3, 1.7]} intensity={1.7} color="#ff9e2c" distance={5} decay={2} />

      {/* Each box is a different shape, so the frame is fitted to whatever it
          is given rather than to a number chosen for one of them - and keyed on
          the rig, because Bounds fits on mount and on resize, and swapping a
          0.3 m wedge for a 0.78 m sub is neither. Without the key the sub is
          framed for the box before it and hangs off both edges. */}
      <Bounds key={rig.id} fit clip observe margin={1.28}>
        <Staged rig={rig} interactive={interactive} />
      </Bounds>
    </>
  );
}
