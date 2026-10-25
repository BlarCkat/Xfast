"use client";

import { useMemo } from "react";
import { BackSide, ExtrudeGeometry, Shape } from "three";

// The energy canister from the concept art, drawn as smooth cartoon shapes rather than voxels:
// orange end caps, violet glass with a glowing rim and a lightning bolt floating inside, all with
// a thick dark outline like the illustration.

const OUTLINE = "#14101f";
const ORANGE = "#f39012";
const ORANGE_DEEP = "#d9620a";
const ORANGE_LIGHT = "#ffb92e";
const GLASS = "#8f6af5";
const RIM = "#d58cff";
const BOLT = "#fbefff";

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

export function EnergyCell() {
  const bolt = useMemo(boltGeometry, []);
  return (
    <group rotation={[0.25, 0, -0.65]}>
      <Drum r={0.4} h={0.08} y={-0.5} color={ORANGE_DEEP} />
      <Drum r={0.42} h={0.2} y={-0.36} color={ORANGE} />
      <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.035, 12, 40]} />
        <meshBasicMaterial color={RIM} toneMapped={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.35, 0.35, 0.5, 40, 1, true]} />
        <meshToonMaterial color={GLASS} transparent opacity={0.65} side={2} depthWrite={false} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.24, 0.24, 0.46, 24]} />
        <meshBasicMaterial color="#b48cff" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Drawn after the glass so the bolt glows through it instead of being tinted by it. */}
      <mesh geometry={bolt} position={[0, 0, 0.12]} rotation={[-0.25, 0, 0.65]} scale={1.6} renderOrder={2}>
        <meshBasicMaterial color={BOLT} transparent toneMapped={false} />
      </mesh>
      <Drum r={0.4} h={0.05} y={0.27} color={ORANGE_DEEP} outline={0} />
      <Drum r={0.42} h={0.22} y={0.38} color={ORANGE} />
      <Drum r={0.17} h={0.1} y={0.54} color={ORANGE_LIGHT} />
    </group>
  );
}
