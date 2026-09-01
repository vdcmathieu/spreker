'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { levels } from '@/lib/audio';
import { ROOM, distance, lightAt, scatterCrowd } from '@/lib/room';
import type { Rig } from '@/lib/rigs';
import { operatingSpl, targetSpl, trim, type Space } from '@/lib/spl';
import {
  GROUND_FRAG,
  GROUND_VERT,
  WALL_FRAG,
  WALL_VERT,
} from './roomScene.glsl';

/**
 * Your space, as a space.
 *
 * The version before this drew the sound pressure as a landscape — height for
 * decibels — and it was a scientific plot handed to somebody hiring a speaker
 * for a birthday. It needed its key read before any of it meant anything, which
 * is the tell: a picture that needs a legend is not doing the work.
 *
 * So: the room is a room. The fence is where your fence is, the people are
 * people, and the rig lights the place — at the real rate, because light and
 * sound fall off identically. Whoever stands in enough of that light is
 * dancing; whoever does not is standing still, and you can count them.
 *
 * The one thing here that is not a picture at all: you can pick yourself up and
 * put yourself anywhere in the room, and with the sound on the music actually
 * changes — quieter, duller, and increasingly buried under the party's own
 * noise, which does not get quieter wherever you stand.
 */

/** Everything is divided by the room's depth, so every space arrives the same size. */
function scaleOf(space: Space) {
  return { ax: space.w / space.d / 2, depth: space.d, m: (x: number) => x / space.d };
}

/** A quad in world coordinates, so `position.xz` is already the plan position. */
function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()],
      3,
    ),
  );
  return g;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * The floor, from the near wall the rig stands on to the far one. Wound so the
 * face points up — the other way round it is culled and the lawn is simply
 * missing, which is not an obvious thing to be looking at.
 */
function groundGeometry(ax: number) {
  return quad(V(-ax, 0, 1), V(ax, 0, 1), V(ax, 0, 0), V(-ax, 0, 0));
}

/**
 * Three walls: the far one and the two sides. Their winding puts the front face
 * inwards, so the renderer culls whichever one you are outside of.
 */
function wallGeometry(ax: number, h: number) {
  const geos = [
    quad(V(ax, 0, 1), V(-ax, 0, 1), V(-ax, h, 1), V(ax, h, 1)),
    quad(V(-ax, 0, 1), V(-ax, 0, 0), V(-ax, h, 0), V(-ax, h, 1)),
    quad(V(ax, 0, 0), V(ax, 0, 1), V(ax, h, 1), V(ax, h, 0)),
    quad(V(-ax, 0, 0), V(ax, 0, 0), V(ax, h, 0), V(-ax, h, 0)),
  ];
  const merged = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (const g of geos) {
    pts.push(...Array.from(g.getAttribute('position').array as Float32Array));
    g.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return merged;
}

/** A fence: posts every couple of metres, two rails between them. */
function fenceGeometry(ax: number, space: Space) {
  const m = (x: number) => x / space.d;
  const h = m(1.25);
  const pts: number[] = [];
  const rails = [h * 0.42, h * 0.86];
  const edges: [number, number, number, number][] = [
    [-ax, 1, ax, 1],
    [-ax, 0, -ax, 1],
    [ax, 0, ax, 1],
    [-ax, 0, ax, 0],
  ];
  for (const [x0, z0, x1, z1] of edges) {
    const len = Math.hypot(x1 - x0, z1 - z0) * space.d;
    const n = Math.max(2, Math.round(len / 2.2));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const x = x0 + (x1 - x0) * f;
      const z = z0 + (z1 - z0) * f;
      pts.push(x, 0, z, x, h, z);
    }
    for (const y of rails) pts.push(x0, y, z0, x1, y, z1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** A soft round falloff for the rig's glow, drawn rather than fetched. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,160,0.95)');
  grad.addColorStop(0.3, 'rgba(255,158,44,0.34)');
  grad.addColorStop(1, 'rgba(255,158,44,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/** One person: a body and a head, built at the room's scale. */
function personGeometry(depth: number) {
  const s = 1 / depth;
  const body = new THREE.CapsuleGeometry(0.135 * s, 1.12 * s, 4, 10);
  body.translate(0, 0.7 * s, 0);
  const head = new THREE.SphereGeometry(0.115 * s, 12, 10);
  head.translate(0, 1.57 * s, 0);
  return { body, head };
}

/**
 * Frames the room whatever shape the panel is, by solving the camera distance
 * against the eight corners of the space rather than a bounding sphere — a room
 * is a flat wide thing and a sphere around one wastes a third of the frame.
 */
function Frame({ ax, top }: { ax: number; top: number }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * (size.width / size.height);

    // From the side and a little behind the rig, so the room's long axis runs
    // across the frame and the light can be seen reaching down it — and so the
    // rig is seen from the front quarter rather than from behind, which is the
    // difference between a lamp and two dark boxes.
    const dir = new THREE.Vector3(1.0, 0.68, -0.44).normalize();
    const centre = new THREE.Vector3(0, top / 2, 0.5);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right);

    let dist = 0;
    const v = new THREE.Vector3();
    for (const sx of [-1, 1]) {
      for (const sy of [0, 1]) {
        for (const sz of [0, 1]) {
          v.set(sx * ax, sy * top, sz).sub(centre);
          const forward = v.dot(dir);
          dist = Math.max(
            dist,
            forward + Math.abs(v.dot(right)) / tanH,
            forward + Math.abs(v.dot(up)) / tanV,
          );
        }
      }
    }
    cam.position.copy(dir).multiplyScalar(dist * 1.06).add(centre);
    cam.lookAt(centre);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, ax, top, invalidate]);
  return null;
}

export function RoomScene({
  rig,
  space,
  heads,
  listener,
  onMove,
  reduced,
}: {
  rig: Rig;
  space: Space;
  heads: number;
  listener: { x: number; y: number };
  onMove: (p: { x: number; y: number }) => void;
  reduced: boolean;
}) {
  const { invalidate } = useThree();
  const { ax, depth, m } = scaleOf(space);
  const target = targetSpl(heads);
  const cut = trim(rig, space, heads);

  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads3d = useRef<THREE.InstancedMesh>(null);
  const pool = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);

  const uniforms = useMemo(
    () => ({
      uPeak: { value: rig.peakSpl },
      uTrim: { value: cut },
      uDepth: { value: depth },
      uTarget: { value: target },
      uCeiling: { value: space.takes },
      uWall: { value: m(space.h || 1) },
    }),
    [rig.peakSpl, cut, depth, target, space.takes, space.h, m],
  );

  useEffect(() => invalidate(), [uniforms, listener, invalidate]);

  const groundGeo = useMemo(() => groundGeometry(ax), [ax]);
  const wallGeo = useMemo(
    () => (space.indoor ? wallGeometry(ax, m(space.h)) : null),
    [space.indoor, space.h, ax, m],
  );
  const fenceGeo = useMemo(() => (space.indoor ? null : fenceGeometry(ax, space)), [ax, space]);
  const person = useMemo(() => personGeometry(depth), [depth]);
  const glow = useMemo(() => glowTexture(), []);

  useEffect(
    () => () => {
      groundGeo.dispose();
      wallGeo?.dispose();
      fenceGeo?.dispose();
      person.body.dispose();
      person.head.dispose();
    },
    [groundGeo, wallGeo, fenceGeo, person],
  );

  /** Where everyone is, and whether the light reaches them. */
  const crowd = useMemo(() => {
    const people = scatterCrowd(heads, space.w, space.d);
    return people.map((p) => {
      const spl = operatingSpl(rig, space, heads, distance(p.x, p.y));
      return { ...p, spl, light: lightAt(spl, target), dancing: spl >= target };
    });
  }, [heads, space, rig, target]);

  // The colours are set once per change rather than per frame: whether someone
  // can hear does not depend on the time.
  useEffect(() => {
    // People are lit by the same light the ground is, so the party has depth —
    // but the difference between hearing it and not is categorical, not a
    // shade, so it is carried by hue rather than by brightness alone.
    // Kept a step under the ground they stand on: the light is the reading, and
    // a crowd bright enough to be the subject is a crowd standing in front of it.
    const warm = new THREE.Color('#e8d2b0');
    const dim = new THREE.Color('#3f2513');
    const cold = new THREE.Color('#3a2c63');
    const c = new THREE.Color();
    for (const mesh of [bodies.current, heads3d.current]) {
      if (!mesh) continue;
      crowd.forEach((p, i) => {
        if (p.dancing) c.copy(dim).lerp(warm, p.light ** 1.5);
        else c.copy(cold).multiplyScalar(0.55 + 1.4 * p.light);
        mesh.setColorAt(i, c);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    invalidate();
  }, [crowd, invalidate]);

  // Standing everyone up. Dancers bob on the beat; the ones who cannot hear it
  // do not, which is the whole readout.
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const place = (t: number) => {
    if (!bodies.current || !heads3d.current) return;
    crowd.forEach((p, i) => {
      const on = p.dancing && !reduced;
      const bob = on ? Math.abs(Math.sin(t * 2.1 * p.sway + p.phase)) * levels.beat * m(0.16) : 0;
      dummy.position.set(m(p.x), bob, m(p.y));
      dummy.rotation.z = on ? Math.sin(t * 1.6 * p.sway + p.phase) * 0.07 * levels.rms : 0;
      dummy.updateMatrix();
      bodies.current!.setMatrixAt(i, dummy.matrix);
      heads3d.current!.setMatrixAt(i, dummy.matrix);
    });
    bodies.current.instanceMatrix.needsUpdate = true;
    heads3d.current.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    place(0);
    invalidate();
    // `place` closes over the crowd, which is what this is reacting to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowd, reduced, invalidate]);

  useFrame((state) => {
    if (reduced) return;
    place(state.clock.elapsedTime);
    if (pool.current) {
      const s = 1 + levels.bass * 0.55;
      pool.current.scale.set(s, s, 1);
    }
  });

  /** Pick yourself up and put yourself down somewhere else. */
  const moveTo = (e: ThreeEvent<PointerEvent>) => {
    const x = THREE.MathUtils.clamp(e.point.x * depth, -space.w / 2 + 0.4, space.w / 2 - 0.4);
    const y = THREE.MathUtils.clamp(e.point.z * depth, 0.6, space.d - 0.4);
    onMove({ x, y });
  };

  const wallTop = space.indoor ? m(space.h) : m(1.25);
  const top = Math.max(wallTop, m(ROOM.STAND + rig.cabinet.h), m(ROOM.PERSON));

  const seat = { x: m(listener.x), z: m(listener.y) };
  const cab = rig.cabinet;

  return (
    <>
      <Frame ax={ax} top={top} />

      <mesh
        geometry={groundGeo}
        onPointerDown={(e) => {
          e.stopPropagation();
          moveTo(e);
          // A touch that is held and moved is somebody scrolling the page, so
          // only a mouse or a pen gets to drag; on a phone a tap puts you there
          // and the three named spots do the rest.
          if (e.pointerType === 'touch') return;
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => dragging.current && moveTo(e)}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <shaderMaterial vertexShader={GROUND_VERT} fragmentShader={GROUND_FRAG} uniforms={uniforms} />
      </mesh>

      {wallGeo && (
        <mesh geometry={wallGeo}>
          <shaderMaterial
            vertexShader={WALL_VERT}
            fragmentShader={WALL_FRAG}
            uniforms={uniforms}
            side={THREE.FrontSide}
          />
        </mesh>
      )}

      {fenceGeo && (
        <lineSegments geometry={fenceGeo}>
          <lineBasicMaterial color="#6b5f8c" transparent opacity={0.5} />
        </lineSegments>
      )}

      {/* The party. */}
      <instancedMesh ref={bodies} args={[person.body, undefined, crowd.length]} key={`b${crowd.length}${depth}`}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={heads3d} args={[person.head, undefined, crowd.length]} key={`h${crowd.length}${depth}`}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* The rig: tops on stands, and whatever it has under them. */}
      <group>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * m(1.7), 0, m(0.4)]}>
            <mesh position={[0, m(ROOM.STAND / 2), 0]}>
              <cylinderGeometry args={[m(0.025), m(0.07), m(ROOM.STAND), 8]} />
              <meshBasicMaterial color="#5a5170" />
            </mesh>
            <mesh position={[0, m(ROOM.STAND + cab.h / 2), 0]}>
              <boxGeometry args={[m(cab.w), m(cab.h), m(cab.d)]} />
              <meshBasicMaterial color="#6a6083" />
            </mesh>
            {/* The baffle: the lamp itself, and the only thing on the page that
                is allowed to be brighter than the light it is throwing. */}
            <mesh position={[0, m(ROOM.STAND + cab.h / 2), m(cab.d / 2 + 0.004)]}>
              <planeGeometry args={[m(cab.w * 0.84), m(cab.h * 0.88)]} />
              <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
            </mesh>
            {/* Seen from behind the rig, as you are here, the boxes are two dark
                shapes; the halo is what says they are the thing making the light. */}
            <sprite position={[0, m(ROOM.STAND + cab.h / 2), 0]} scale={[m(4.2), m(4.2), 1]}>
              <spriteMaterial
                map={glow}
                transparent
                opacity={0.8}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          </group>
        ))}
        {Array.from({ length: rig.subs }, (_, i) => (
          <mesh
            key={i}
            position={[(rig.subs === 1 ? 0 : i === 0 ? -1 : 1) * m(0.38), m(0.3), m(0.55)]}
          >
            <boxGeometry args={[m(0.6), m(0.6), m(0.7)]} />
            <meshBasicMaterial color="#554d6e" />
          </mesh>
        ))}
      </group>

      {/* You. The only saturated sodium in the room, because you are the one
          thing here that is also a control. */}
      <group position={[seat.x, 0, seat.z]}>
        <mesh geometry={person.body}>
          <meshBasicMaterial color="#ff9e2c" toneMapped={false} />
        </mesh>
        <mesh geometry={person.head}>
          <meshBasicMaterial color="#ffe0b0" toneMapped={false} />
        </mesh>
        <sprite position={[0, m(1.1), 0]} scale={[m(2.6), m(2.6), 1]}>
          <spriteMaterial
            map={glow}
            transparent
            opacity={0.4}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, m(0.02), 0]}>
          <ringGeometry args={[m(0.6), m(0.8), 40]} />
          <meshBasicMaterial color="#ff9e2c" transparent opacity={0.95} toneMapped={false} />
        </mesh>
        {/* A second ring, breathing on the bass — a filled pool read as you
            giving off light, which you are not. */}
        <mesh ref={pool} rotation={[-Math.PI / 2, 0, 0]} position={[0, m(0.015), 0]}>
          <ringGeometry args={[m(1.2), m(1.32), 44]} />
          <meshBasicMaterial
            color="#ff9e2c"
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}
