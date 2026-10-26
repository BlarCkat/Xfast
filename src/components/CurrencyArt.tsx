"use client";

import { Drum } from "./toon";

// Coins and gems in the illustrated toon style, plus the heaps shown for the store's currency packs.

type Pose = { p: [number, number, number]; r?: [number, number, number] };

/** A plain gold coin, no emblem, facing +z with a matching back so it can spin. */
export function CoinArt() {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Drum r={0.36} h={0.1} colors={["#d97706", "#ffb703", "#ffb703"]} />
      {[1, -1].map((side) => (
        <group key={side} position={[0, side * 0.05, 0]} scale={[1, side, 1]}>
          <Drum r={0.25} h={0.024} y={0.012} color="#f08a00" outline={0} />
          <Drum r={0.19} h={0.03} y={0.015} color="#ffc21a" outline={0} />
        </group>
      ))}
    </group>
  );
}

/** A square-cut lime gem: a flat table, bevelled facets and a deeper green band round the middle. */
export function GemArt() {
  const facet = "#7fd11b";
  const table = "#a8e62a";
  const band = "#2f9e44";
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Drum r={0.36} h={0.1} y={0.11} rTop={0.2} sides={4} flat colors={[facet, table, facet]} />
      <Drum r={0.36} h={0.12} sides={4} flat color={band} />
      <group rotation={[Math.PI, 0, 0]}>
        <Drum r={0.36} h={0.1} y={0.11} rTop={0.2} sides={4} flat colors={[facet, table, facet]} />
      </group>
    </group>
  );
}

// Heaps for 10, 50, 100 and 1000: one piece standing up front, more lying in stacks behind it.
const LYING: [number, number, number] = [-Math.PI / 2 + 0.25, 0, 0];
const LEAN: [number, number, number] = [-0.2, 0.5, 0];

function stack(x: number, z: number, n: number, step: number, base = -0.38): Pose[] {
  return Array.from({ length: n }, (_, i) => ({ p: [x + ((i * 7) % 3) * 0.015, base + i * step, z], r: LYING }));
}

const COIN_HEAPS: Pose[][] = [
  [{ p: [0, 0, 0] }],
  [...stack(0.3, -0.25, 2, 0.11), { p: [-0.12, -0.02, 0.15], r: LEAN }],
  [...stack(0.32, -0.3, 3, 0.11), ...stack(-0.3, -0.35, 2, 0.11), { p: [0, -0.04, 0.2], r: LEAN }],
  [
    ...stack(0.36, -0.35, 4, 0.11),
    ...stack(-0.36, -0.4, 3, 0.11),
    ...stack(0, -0.55, 5, 0.11),
    { p: [-0.26, -0.08, 0.25], r: [-0.15, 0.5, 0.1] },
    { p: [0.26, -0.1, 0.3], r: [-0.15, -0.5, -0.1] },
  ],
];

const GEM_HEAPS: Pose[][] = [
  [{ p: [0, 0, 0] }],
  [{ p: [0.22, 0.12, -0.2], r: [0, -0.4, 0.3] }, { p: [-0.1, -0.05, 0.15], r: LEAN }],
  [
    { p: [0.3, -0.25, -0.2], r: LYING },
    { p: [0.22, 0.15, -0.25], r: [0, -0.4, 0.3] },
    { p: [-0.1, -0.05, 0.15], r: LEAN },
  ],
  [
    { p: [0.34, -0.3, -0.2], r: LYING },
    { p: [-0.34, -0.3, -0.25], r: LYING },
    { p: [0.3, 0.15, -0.35], r: [0, -0.4, 0.3] },
    { p: [-0.28, 0.12, -0.4], r: [0, 0.4, -0.3] },
    { p: [0, -0.05, 0.2], r: LEAN },
  ],
];

/** Which heap a pack of `amount` shows: 10, 50, 100, 1000 and up. */
const heapFor = (amount: number) => (amount >= 1000 ? 3 : amount >= 100 ? 2 : amount >= 50 ? 1 : 0);

export function CurrencyHeap({ kind, amount }: { kind: "coins" | "gems"; amount: number }) {
  const poses = (kind === "coins" ? COIN_HEAPS : GEM_HEAPS)[heapFor(amount)];
  const Piece = kind === "coins" ? CoinArt : GemArt;
  const scale = poses.length > 1 ? 0.8 : 1;
  return (
    <group scale={scale}>
      {poses.map((pose, i) => (
        <group key={i} position={pose.p} rotation={pose.r}>
          <Piece />
        </group>
      ))}
    </group>
  );
}
