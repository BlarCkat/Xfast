"use client";

import { useMemo } from "react";
import { BackSide, ExtrudeGeometry, Shape } from "three";
import type { PowerUp } from "@/game/powerups";

// Illustrated power-ups, drawn as smooth cartoon shapes rather than voxels: toon shading with a thick
// dark outline like the concept art. The outline is an inverted hull, a slightly larger copy of each
// shape that only shows its back faces.

const OUTLINE = "#14101f";

type Paint = { color: string; opacity?: number };

/** A cylinder with a dark shell behind it for the inked outline. */
function Drum({ r, h, y, color, outline = 0.035 }: { r: number; h: number; y: number; color: string; outline?: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, h, 40]} />
        <meshToonMaterial color={color} />
      </mesh>
      {outline > 0 && (
        <mesh scale={[(r + outline) / r, (h + 2 * outline) / h, (r + outline) / r]}>
          <cylinderGeometry args={[r, r, h, 40]} />
          <meshBasicMaterial color={OUTLINE} side={BackSide} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The glass section of the canister. See-through glass can't use a plain hull, because its back
 * faces would show through and darken the whole tube. So an invisible copy first writes the glass's
 * depth, the hull then only lands around the edge, and the glass is drawn last on top.
 */
function Glass({ r, h, glass, core, children }: { r: number; h: number; glass: Paint; core: Paint; children?: React.ReactNode }) {
  const o = 0.035;
  const clear = glass.opacity !== undefined;
  return (
    <group>
      <mesh renderOrder={1}>
        <cylinderGeometry args={[r * 0.7, r * 0.7, h - 0.04, 24]} />
        <meshBasicMaterial color={core.color} transparent opacity={core.opacity ?? 1} depthWrite={false} toneMapped={false} />
      </mesh>
      {children}
      {clear && (
        <mesh renderOrder={3}>
          <cylinderGeometry args={[r, r, h, 40, 1, true]} />
          <meshBasicMaterial colorWrite={false} transparent />
        </mesh>
      )}
      <mesh renderOrder={4} scale={[(r + o) / r, 1, (r + o) / r]}>
        <cylinderGeometry args={[r, r, h, 40, 1, true]} />
        <meshBasicMaterial color={OUTLINE} side={BackSide} transparent />
      </mesh>
      <mesh renderOrder={5}>
        <cylinderGeometry args={[r, r, h, 40, 1, !clear]} />
        <meshToonMaterial color={glass.color} transparent={clear} opacity={glass.opacity ?? 1} depthWrite={!clear} />
      </mesh>
    </group>
  );
}

function boltGeometry() {
  const s = new Shape();
  s.moveTo(0.06, 0.16);
  s.lineTo(-0.1, -0.01);
  s.lineTo(0, -0.01);
  s.lineTo(-0.06, -0.16);
  s.lineTo(0.1, 0.03);
  s.lineTo(0, 0.03);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  g.translate(0, 0, -0.015);
  return g;
}

/** A six-armed snowflake in the xy plane, made of thin bars. */
function Snowflake({
  size,
  color,
  position,
  rotation,
}: {
  size: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <mesh>
            <boxGeometry args={[size, size * 0.14, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          {[-1, 1].map((side) =>
            [-1, 1].map((tip) => (
              <mesh
                key={`${side}${tip}`}
                position={[side * size * 0.3, tip * size * 0.08, 0]}
                rotation={[0, 0, side * tip * 0.9]}
              >
                <boxGeometry args={[size * 0.24, size * 0.1, 0.02]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/** A crust of frost lumps around a cap's rim, optionally with icicles hanging from it. */
function Frost({ r, y, icicles = false }: { r: number; y: number; icicles?: boolean }) {
  const drips = icicles ? [0.2, 1.1, 1.9, 2.8, 3.6, 4.5, 5.4] : [];
  return (
    <group position={[0, y, 0]}>
      {drips.map((a, i) => {
        const len = 0.08 + ((i * 37) % 5) * 0.025;
        return (
          <mesh key={a} position={[Math.sin(a) * r, -len / 2, Math.cos(a) * r]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, len, 8]} />
            <meshToonMaterial color="#f4fbff" />
          </mesh>
        );
      })}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r - 0.02), 0.02, Math.cos(a) * (r - 0.02)]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.045 + (i % 3) * 0.015, 12, 8]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
        );
      })}
    </group>
  );
}

export type CanisterKind = "energy" | "frost";

const CANISTER = {
  energy: {
    cap: "#f39012",
    capDeep: "#d9620a",
    knob: "#ffb92e",
    rim: "#d58cff",
    glass: { color: "#8f6af5", opacity: 0.65 },
    core: { color: "#b48cff", opacity: 0.5 },
  },
  frost: {
    cap: "#f39012",
    capDeep: "#d9620a",
    knob: "#ffb92e",
    rim: "#e9f7ff",
    glass: { color: "#a9dcfa", opacity: 0.85 },
    core: { color: "#e6f5ff" },
  },
};

/**
 * The power-up canister from the concept art. The energy cell has orange caps and violet glass with
 * a glowing bolt floating inside; the frost cell is iced over, with frosted pale blue glass and a snowflake.
 */
export function Canister({ kind = "energy" }: { kind?: CanisterKind }) {
  const bolt = useMemo(boltGeometry, []);
  const c = CANISTER[kind];
  return (
    <group rotation={[0.25, 0, -0.65]}>
      <Drum r={0.4} h={0.08} y={-0.5} color={c.capDeep} />
      <Drum r={0.42} h={0.2} y={-0.36} color={c.cap} />
      <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.035, 12, 40]} />
        <meshBasicMaterial color={c.rim} toneMapped={false} />
      </mesh>
      <Glass r={0.35} h={0.5} glass={c.glass} core={c.core}>
        {kind === "energy" && (
          // Drawn over the glass so the bolt glows through it instead of being tinted by it.
          <mesh geometry={bolt} position={[0, 0, 0.12]} rotation={[-0.25, 0, 0.65]} scale={1.45} renderOrder={6}>
            <meshBasicMaterial color="#fbefff" transparent depthTest={false} toneMapped={false} />
          </mesh>
        )}
      </Glass>
      {kind === "frost" && (
        <>
          <Snowflake size={0.26} color="#ffffff" position={[0, 0, 0.355]} rotation={[0, 0, 0.65]} />
          <Snowflake size={0.26} color="#ffffff" position={[0, 0, -0.355]} rotation={[0, Math.PI, -0.65]} />
          <Frost r={0.42} y={0.27} icicles />
          <Frost r={0.42} y={0.49} />
          <Frost r={0.42} y={-0.26} />
        </>
      )}
      <Drum r={0.4} h={0.05} y={0.27} color={c.capDeep} outline={0} />
      <Drum r={0.42} h={0.22} y={0.38} color={c.cap} />
      <Drum r={0.17} h={0.1} y={0.54} color={c.knob} />
    </group>
  );
}

const MAGNET_RED = "#e2373f";
const MAGNET_RED_DEEP = "#b51f2b";
const STEEL = "#e6ecf2";

/** One straight arm of the magnet: a red rod ending in a steel pole piece. */
function MagnetArm({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Drum r={0.15} h={0.34} y={0.17} color={MAGNET_RED} />
      <Drum r={0.155} h={0.04} y={0.35} color={MAGNET_RED_DEEP} outline={0} />
      <Drum r={0.15} h={0.16} y={0.45} color={STEEL} />
    </group>
  );
}

/** A classic red horseshoe magnet with steel tips, in the same toon style and size as the canister. */
export function Magnet() {
  const R = 0.27;
  const r = 0.15;
  const o = 0.035;
  return (
    <group rotation={[0.25, 0, -0.45]} position={[0, -0.05, 0]}>
      <group rotation={[0, 0, Math.PI]}>
        <mesh>
          <torusGeometry args={[R, r, 20, 40, Math.PI]} />
          <meshToonMaterial color={MAGNET_RED} />
        </mesh>
        <mesh>
          <torusGeometry args={[R, r + o, 20, 40, Math.PI]} />
          <meshBasicMaterial color={OUTLINE} side={BackSide} />
        </mesh>
      </group>
      <MagnetArm x={-R} />
      <MagnetArm x={R} />
    </group>
  );
}

/** The power-ups drawn as illustrations; the rest keep their voxel pickups. */
export const ART_POWERUPS: Partial<Record<PowerUp, () => React.ReactNode>> = {
  superhop: () => <Canister />,
  freeze: () => <Canister kind="frost" />,
  magnet: () => <Magnet />,
};

/** An illustrated power-up sized to sit on a lane like the voxel pickups. */
export function PickupArt({ kind }: { kind: PowerUp }) {
  const art = ART_POWERUPS[kind];
  return art ? <group scale={0.48}>{art()}</group> : null;
}
