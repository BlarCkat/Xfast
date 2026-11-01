"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry, DoubleSide, type Group } from "three";
import type { ChestKind } from "@/game/chests";
import { Ink } from "./toon";

// The reward chests, in the same toon style as the power-up and coin art: a box with a rounded lid,
// metal bands, a lock plate and an inked outline. The Basic chest is wood and iron, the Epic chest
// violet and gold, and the Mega chest gold with red bands and gems set in the lid. The lid hinges at
// the back and swings open to let out a glow.

const W = 1;
const H = 0.5;
const D = 0.7;
const R = D / 2;
const O = 0.03;

interface Look {
  body: string;
  side: string;
  band: string;
  lock: string;
  gem?: string;
}

const LOOKS: Record<ChestKind, Look> = {
  basic: { body: "#b06a2c", side: "#8a4f1e", band: "#7d8796", lock: "#d4dae3" },
  epic: { body: "#8a4fff", side: "#6a32d8", band: "#ffb703", lock: "#ffd23f" },
  mega: { body: "#ffc21a", side: "#e59a00", band: "#e63946", lock: "#ffffff", gem: "#2ee6c9" },
};

/** A box with its inked outline. */
function InkBox({ size, position, color, outline = O }: { size: [number, number, number]; position?: [number, number, number]; color: string; outline?: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshToonMaterial color={color} />
      </mesh>
      {outline > 0 && (
        <mesh>
          <boxGeometry args={[size[0] + 2 * outline, size[1] + 2 * outline, size[2] + 2 * outline]} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}

/** Half a cylinder lying along x, flat side down: the rounded lid and the bands round it. */
function halfDrum(r: number, length: number) {
  return new CylinderGeometry(r, r, length, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
}

function Lid({ look }: { look: Look }) {
  const [shell, hull, band, bandHull] = useMemo(
    () => [halfDrum(R, W), halfDrum(R + O, W + 2 * O), halfDrum(R + 0.02, 0.1), halfDrum(R + 0.02 + O, 0.1 + 2 * O)],
    [],
  );
  return (
    <group>
      <mesh geometry={shell}>
        <meshToonMaterial color={look.body} side={DoubleSide} />
      </mesh>
      <mesh geometry={hull}>
        <Ink />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 2 - 0.12), 0, 0]}>
          <mesh geometry={band}>
            <meshToonMaterial color={look.band} />
          </mesh>
          <mesh geometry={bandHull}>
            <Ink />
          </mesh>
        </group>
      ))}
      {/* The lid's front edge, where the lock hangs down from. */}
      <InkBox size={[W + 0.02, 0.06, 0.04]} position={[0, 0.03, R - 0.01]} color={look.band} outline={0} />
      {look.gem && (
        <>
          <Gem color={look.gem} position={[0, R + 0.01, 0]} size={0.12} />
          <Gem color="#ff5d8f" position={[0, R * 0.72, R * 0.72]} size={0.08} tilt={-Math.PI / 4} />
        </>
      )}
    </group>
  );
}

/** A small faceted stone set into the Mega chest's lid. */
function Gem({ color, position, size, tilt = 0 }: { color: string; position: [number, number, number]; size: number; tilt?: number }) {
  return (
    <group position={position} rotation={[tilt, Math.PI / 4, 0]}>
      <mesh>
        <octahedronGeometry args={[size]} />
        <meshLambertMaterial color={color} flatShading />
      </mesh>
      <mesh scale={1.3}>
        <octahedronGeometry args={[size]} />
        <Ink />
      </mesh>
    </group>
  );
}

/**
 * A reward chest standing on its base. `open` swings the lid back and lights the inside; `shaking`
 * rattles it like something wants out.
 */
export function ChestArt({ kind, open = false, shaking = false }: { kind: ChestKind; open?: boolean; shaking?: boolean }) {
  const look = LOOKS[kind];
  const lid = useRef<Group>(null);
  const body = useRef<Group>(null);
  const glow = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    if (lid.current) {
      const want = open ? -1.9 : 0;
      const r = lid.current.rotation;
      // Spring the lid open fast, settle it shut gently.
      r.x += (want - r.x) * Math.min(1, dt * (open ? 9 : 5));
    }
    if (body.current) {
      const t = clock.elapsedTime;
      body.current.rotation.z = shaking ? Math.sin(t * 38) * 0.08 : 0;
      body.current.position.y = shaking ? Math.abs(Math.sin(t * 19)) * 0.05 : 0;
    }
    if (glow.current) {
      const s = glow.current.scale.x + ((open ? 1 : 0) - glow.current.scale.x) * Math.min(1, dt * 6);
      glow.current.scale.set(s, s, s);
      glow.current.visible = s > 0.02;
    }
  });
  return (
    <group ref={body}>
      <group position={[0, -H / 2, 0]}>
        <InkBox size={[W, H, D]} position={[0, H / 2, 0]} color={look.body} />
        {/* Planks or panels across the front and back. */}
        {[-1, 1].map((s) => (
          <InkBox key={`p${s}`} size={[W - 0.3, 0.035, D + 0.01]} position={[0, H * (s > 0 ? 0.68 : 0.32), 0]} color={look.side} outline={0} />
        ))}
        {/* Metal bands round the ends, and a rim along the bottom. */}
        {[-1, 1].map((s) => (
          <InkBox key={`b${s}`} size={[0.1, H + 0.02, D + 0.04]} position={[s * (W / 2 - 0.12), H / 2, 0]} color={look.band} outline={0.02} />
        ))}
        <InkBox size={[W + 0.04, 0.08, D + 0.04]} position={[0, 0.04, 0]} color={look.band} outline={0.02} />
        {/* The lock plate and its keyhole. */}
        <group position={[0, H - 0.08, D / 2 + 0.03]}>
          <InkBox size={[0.2, 0.22, 0.05]} color={look.lock} outline={0.025} />
          <mesh position={[0, 0.02, 0.03]}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
            <meshBasicMaterial color="#14101f" />
          </mesh>
          <mesh position={[0, -0.04, 0.03]}>
            <boxGeometry args={[0.025, 0.07, 0.02]} />
            <meshBasicMaterial color="#14101f" />
          </mesh>
        </group>
        {/* The light inside, seen once the lid lifts. */}
        <group ref={glow} position={[0, H, 0]} scale={0} visible={false}>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W - 0.08, D - 0.08]} />
            <meshBasicMaterial color="#fff3b0" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.4, 0.32, 0.44, 24, 1, true]} />
            <meshBasicMaterial color="#ffe27a" transparent opacity={0.22} depthWrite={false} side={DoubleSide} toneMapped={false} />
          </mesh>
        </group>
        {/* The lid hinges along the back edge. */}
        <group ref={lid} position={[0, H, -R]}>
          <group position={[0, 0, R]}>
            <Lid look={look} />
          </group>
        </group>
      </group>
    </group>
  );
}
