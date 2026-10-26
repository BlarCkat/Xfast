"use client";

import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";
import { Drum, Ink } from "./toon";

// Stars and badge medals for the achievements, in the same toon style as the power-up and coin art.
// Snapshots of these become the PNG icons in public/achievements.

function starShape(outer: number, inner: number) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) s.moveTo(r * Math.cos(a), r * Math.sin(a));
    else s.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  return s;
}

/** A chunky five-point star, `depth` thick, with a bevelled face and its inked outline. */
function StarSolid({ r, depth, face, side, outline = 0.035 }: { r: number; depth: number; face: string; side: string; outline?: number }) {
  const [body, hull] = useMemo(() => {
    const bevel = { bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: r * 0.08, bevelSegments: 2 };
    const g = new ExtrudeGeometry(starShape(r, r * 0.5), { depth, ...bevel });
    const h = new ExtrudeGeometry(starShape(r + outline * 1.6, r * 0.5 + outline), {
      depth: depth + outline * 2,
      ...bevel,
    });
    g.center();
    h.center();
    return [g, h];
  }, [r, depth, outline]);
  return (
    <group>
      <mesh geometry={body}>
        <meshToonMaterial attach="material-0" color={face} />
        <meshToonMaterial attach="material-1" color={side} />
      </mesh>
      {outline > 0 && (
        <mesh geometry={hull}>
          <Ink />
        </mesh>
      )}
    </group>
  );
}

/** The daily star: gold, facing the viewer. */
export function StarArt() {
  return <StarSolid r={0.5} depth={0.14} face="#ffc21a" side="#e08a00" />;
}

/** A badge: a gold medal with a coloured centre and a raised star, hanging from two ribbon tails. */
export function MedalArt({ color, ribbon }: { color: string; ribbon: string }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.16, -0.38, -0.08]} rotation={[0, 0, side * 0.35]}>
          <mesh>
            <boxGeometry args={[0.2, 0.46, 0.04]} />
            <meshToonMaterial color={ribbon} />
          </mesh>
          <mesh scale={[1.25, 1.1, 1.8]}>
            <boxGeometry args={[0.2, 0.46, 0.04]} />
            <Ink />
          </mesh>
        </group>
      ))}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Drum r={0.42} h={0.12} colors={["#d97706", "#ffb703", "#ffb703"]} />
        <Drum r={0.31} h={0.03} y={0.07} color={color} outline={0} />
      </group>
      <group position={[0, 0, 0.1]}>
        <StarSolid r={0.2} depth={0.06} face="#ffffff" side="#d9d9e6" outline={0} />
      </group>
    </group>
  );
}
