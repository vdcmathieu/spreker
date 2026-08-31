'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bounds, Environment, Lightformer, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { levels } from '@/lib/audio';
import type { Rig } from '@/lib/rigs';

/**
 * One cabinet, close.
 *
 * An earlier pass drew the whole rig — two tops, two subs, stands — and at the
 * size it renders on a page that reads as four floating boxes and you cannot
 * see the one thing worth seeing. The signature is the cone moving with the
 * bass, so the cone is what the camera is pointed at. Which rig you are looking
 * at comes through in the cabinet's proportions and in the spec list beside it.
 *
 * Everything is procedural: no model files, no image textures, no HDR. The
 * grille is a dot pattern drawn to a canvas at run time and the light comes
 * from lightformers, so nothing is fetched.
 */

function useGrilleTexture() {
  return useMemo(() => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#fff';
    const pitch = 16;
    for (let y = 0; y < size; y += pitch) {
      for (let x = 0; x < size; x += pitch) {
        const off = (y / pitch) % 2 === 0 ? 0 : pitch / 2;
        g.beginPath();
        g.arc(x + off, y, 4.1, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3.4, 4.4);
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, []);
}

/** A woofer, facing the viewer: rubber roll, paper cone, metal dust cap. */
function Woofer({ radius, driven = true }: { radius: number; driven?: boolean }) {
  const cone = useRef<THREE.Group>(null);

  useFrame(() => {
    if (cone.current) cone.current.position.z = levels.bass * (driven ? 0.016 : 0.01);
  });

  return (
    <group>
      {/* Chassis ring, bolted to the baffle. */}
      <mesh>
        <ringGeometry args={[radius * 0.96, radius * 1.1, 44]} />
        <meshStandardMaterial color="#2e2c38" roughness={0.5} metalness={0.55} />
      </mesh>
      {/* Rubber surround. A torus already lies in the baffle plane — do not
          rotate it, or it renders as a bar across the driver. */}
      <mesh position={[0, 0, 0.004]}>
        <torusGeometry args={[radius * 0.87, radius * 0.11, 14, 52]} />
        <meshStandardMaterial color="#33313d" roughness={0.62} />
      </mesh>
      <group ref={cone}>
        {/* Cone: axis rotated onto −Z so the apex sits inside the cabinet. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -radius * 0.24]}>
          <coneGeometry args={[radius * 0.85, radius * 0.62, 48, 1, true]} />
          <meshStandardMaterial color="#1d1c25" roughness={0.88} side={THREE.DoubleSide} />
        </mesh>
        {/* Dust cap: a dome facing the viewer, not the ceiling. */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.002]}>
          <sphereGeometry args={[radius * 0.23, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#454152" roughness={0.5} metalness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

export function Cabinet({ rig, grille }: { rig: Rig; grille: THREE.Texture }) {
  const ledMat = useRef<THREE.MeshStandardMaterial>(null);
  const { w, h, d } = rig.cabinet;
  const r = rig.woofers[0][1];

  useFrame(() => {
    if (!ledMat.current) return;
    const hot = levels.rms > 0.5 ? 1 : 0.08;
    ledMat.current.emissiveIntensity += (hot * 5 - ledMat.current.emissiveIntensity) * 0.22;
  });

  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.016} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#26252e" roughness={0.78} metalness={0.16} />
      </RoundedBox>

      {/* Recessed baffle. */}
      <mesh position={[0, 0, d / 2 + 0.001]}>
        <planeGeometry args={[w * 0.9, h * 0.94]} />
        <meshStandardMaterial color="#141319" roughness={0.92} />
      </mesh>

      <group position={[0, -h * 0.15, d / 2 + 0.003]}>
        <Woofer radius={r} />
      </group>

      {/* Horn-loaded tweeter in a round waveguide. */}
      <group position={[0, h * 0.29, d / 2 + 0.003]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[w * 0.21, w * 0.075, 0.04, 44, 1, true]} />
          <meshStandardMaterial color="#4d4a5c" roughness={0.26} metalness={0.88} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, -0.019]}>
          <circleGeometry args={[w * 0.075, 28]} />
          <meshStandardMaterial color="#0b0a0f" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* Grille. Perforated steel, standing proud of the drivers. */}
      <mesh position={[0, 0, d / 2 + 0.022]}>
        <planeGeometry args={[w * 0.88, h * 0.92]} />
        <meshStandardMaterial
          color="#3d3b49"
          alphaMap={grille}
          transparent
          roughness={0.46}
          metalness={0.6}
        />
      </mesh>

      {/* Steel corner protectors — the detail that says "this lives in a van". */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sy}${sz}`}
              position={[(sx * (w - 0.03)) / 2, (sy * (h - 0.03)) / 2, (sz * (d - 0.03)) / 2]}
            >
              <boxGeometry args={[0.036, 0.036, 0.036]} />
              <meshStandardMaterial color="#2f2d39" roughness={0.56} metalness={0.55} />
            </mesh>
          )),
        ),
      )}

      {/* Recessed side handles. */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[(s * w) / 2 + s * 0.0015, h * 0.16, 0]}
          rotation={[0, (s * Math.PI) / 2, 0]}
        >
          <planeGeometry args={[d * 0.42, h * 0.11]} />
          <meshStandardMaterial color="#0a090d" roughness={0.95} />
        </mesh>
      ))}

      {/* Peak LED. Amber, and it means something. */}
      <mesh position={[w * 0.35, -h * 0.44, d / 2 + 0.024]}>
        <circleGeometry args={[0.008, 18]} />
        <meshStandardMaterial
          ref={ledMat}
          color="#ff9e2c"
          emissive="#ff9e2c"
          emissiveIntensity={0.2}
          toneMapped={false}
        />
      </mesh>

      {/* Rubber feet, so it sits on the floor rather than hovering above it. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[(sx * w) / 2.9, -h / 2 - 0.008, (sz * d) / 3]}
          >
            <cylinderGeometry args={[0.018, 0.018, 0.016, 12]} />
            <meshStandardMaterial color="#131218" roughness={0.9} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Staged({ rig, interactive }: { rig: Rig; interactive: boolean }) {
  const grille = useGrilleTexture();
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
      <Cabinet rig={rig} grille={grille} />
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
      {/* Key: cool and high, so the box reads as charcoal rather than as brown. */}
      <directionalLight
        position={[2.6, 3.6, 3.2]}
        intensity={2.3}
        color="#eceaff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      {/* Rim: the violet, hard from behind left. */}
      <directionalLight position={[-3.2, 0.5, -2.6]} intensity={1.4} color="#8b4dff" />
      {/* A single warm accent low and to the right — the streetlight. */}
      <pointLight position={[2.1, -0.3, 1.7]} intensity={1.7} color="#ff9e2c" distance={5} decay={2} />

      <Bounds fit clip observe margin={1.28}>
        <Staged rig={rig} interactive={interactive} />
      </Bounds>
    </>
  );
}
