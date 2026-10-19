"use client";

import { forwardRef } from "react";
import type { Group } from "three";
import type { BiomeId } from "@/game/biomes";
import type { MoverKind } from "@/game/lanes";
import { Box, Car, Log, Tree, Truck } from "./models";

// Per-biome voxel props, traffic and river floaters. Vehicles face +x and are mirrored by `dir`,
// keeping the same footprint as the car (1.5) and truck (2.6) they stand in for.

// ---- Obstacles ----------------------------------------------------------------

function HayBale() {
  return (
    <group>
      <Box size={[0.8, 0.55, 0.7]} position={[0, 0.28, 0]} color="#e3c26b" />
      <Box size={[0.82, 0.08, 0.72]} position={[0, 0.3, 0]} color="#b8913d" />
      <Box size={[0.7, 0.06, 0.6]} position={[0, 0.58, 0]} color="#f0d488" cast={false} />
    </group>
  );
}

function Corn() {
  return (
    <group>
      {[
        [-0.22, -0.2],
        [0.2, -0.15],
        [0, 0.18],
        [-0.2, 0.22],
        [0.22, 0.22],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box size={[0.08, 1.1, 0.08]} position={[0, 0.55, 0]} color="#5c9e2e" />
          <Box size={[0.26, 0.06, 0.08]} position={[0.08, 0.7, 0]} color="#72b83a" />
          <Box size={[0.1, 0.22, 0.1]} position={[-0.05, 0.85, 0]} color="#f2c94c" />
        </group>
      ))}
    </group>
  );
}

function AppleTree() {
  return (
    <group>
      <Tree height={2} />
      {[
        [0.4, 0.95, 0.2],
        [-0.4, 1.15, -0.1],
        [0.1, 1.3, 0.4],
        [-0.2, 0.85, 0.4],
      ].map(([x, y, z], i) => (
        <Box key={i} size={[0.12, 0.12, 0.12]} position={[x, y, z]} color="#e0352b" />
      ))}
    </group>
  );
}

function Bush() {
  return (
    <group>
      <Box size={[0.8, 0.45, 0.7]} position={[0, 0.22, 0]} color="#6f8f2e" />
      <Box size={[0.55, 0.25, 0.5]} position={[0.05, 0.55, 0]} color="#809f36" />
    </group>
  );
}

function Boulder() {
  return (
    <group>
      <Box size={[0.8, 0.5, 0.75]} position={[0, 0.25, 0]} color="#9c8f80" />
      <Box size={[0.55, 0.3, 0.5]} position={[-0.05, 0.6, 0.05]} color="#b0a393" />
    </group>
  );
}

function Baobab() {
  return (
    <group>
      <Box size={[0.55, 1.1, 0.55]} position={[0, 0.55, 0]} color="#9a7b5c" />
      <Box size={[0.12, 0.4, 0.12]} position={[0.2, 1.25, 0]} color="#9a7b5c" />
      <Box size={[0.12, 0.4, 0.12]} position={[-0.2, 1.25, 0.1]} color="#9a7b5c" />
      <Box size={[0.95, 0.22, 0.85]} position={[0, 1.5, 0]} color="#7d9a35" />
    </group>
  );
}

function GrassTuft() {
  return (
    <group>
      {[-0.2, 0, 0.2].map((x, i) => (
        <Box key={i} size={[0.1, 0.45 + i * 0.1, 0.1]} position={[x, 0.25, (i - 1) * 0.12]} color="#b8913d" />
      ))}
      <Box size={[0.5, 0.3, 0.45]} position={[0.1, 0.15, 0.2]} color="#a39280" />
    </group>
  );
}

function TermiteMound() {
  return (
    <group>
      <Box size={[0.7, 0.5, 0.7]} position={[0, 0.25, 0]} color="#b5733f" />
      <Box size={[0.48, 0.45, 0.48]} position={[0, 0.72, 0]} color="#c4824b" />
      <Box size={[0.24, 0.35, 0.24]} position={[0.04, 1.1, 0]} color="#b5733f" />
    </group>
  );
}

function Acacia() {
  return (
    <group>
      <Box size={[0.18, 1.2, 0.18]} position={[0, 0.6, 0]} color="#6b4a2f" />
      <Box size={[0.12, 0.35, 0.12]} position={[0.22, 1.25, 0]} color="#6b4a2f" />
      <Box size={[1.3, 0.2, 1.0]} position={[0, 1.48, 0]} color="#6f9a2c" />
      <Box size={[0.9, 0.12, 0.7]} position={[0.1, 1.64, 0]} color="#7fae34" />
    </group>
  );
}

function Hydrant() {
  return (
    <group>
      <Box size={[0.3, 0.5, 0.3]} position={[0, 0.25, 0]} color="#e0352b" />
      <Box size={[0.42, 0.1, 0.12]} position={[0, 0.32, 0]} color="#c22c22" />
      <Box size={[0.22, 0.12, 0.22]} position={[0, 0.56, 0]} color="#c22c22" />
      <Box size={[0.5, 0.6, 0.45]} position={[0.1, 0.3, 0.6]} color="#4a6b4a" />
    </group>
  );
}

function Planter() {
  return (
    <group>
      <Box size={[0.75, 0.35, 0.75]} position={[0, 0.17, 0]} color="#8d9096" />
      <Box size={[0.5, 0.55, 0.5]} position={[0, 0.65, 0]} color="#4f9d2f" />
      <Box size={[0.36, 0.14, 0.36]} position={[0, 0.98, 0]} color="#62b83c" />
    </group>
  );
}

const BUILDING_COLORS = ["#e07a5f", "#81b29a", "#f2cc8f", "#6d8ec7", "#c9a0dc"];

function Building({ variant }: { variant: number }) {
  const color = BUILDING_COLORS[variant % BUILDING_COLORS.length];
  return (
    <group>
      <Box size={[0.9, 1.6, 0.9]} position={[0, 0.8, 0]} color={color} />
      <Box size={[0.94, 0.08, 0.94]} position={[0, 1.62, 0]} color="#5b5f66" />
      {[0.5, 0.95, 1.4].map((y) =>
        [-0.22, 0.22].map((x) => (
          <Box key={`${x}${y}`} size={[0.2, 0.22, 0.02]} position={[x, y, 0.46]} color="#ffe7a8" cast={false} glow={0.9} />
        )),
      )}
    </group>
  );
}

function Snowman() {
  return (
    <group>
      <Box size={[0.62, 0.5, 0.62]} position={[0, 0.25, 0]} color="#ffffff" />
      <Box size={[0.44, 0.38, 0.44]} position={[0, 0.69, 0]} color="#ffffff" />
      <Box size={[0.06, 0.06, 0.22]} position={[0, 0.7, 0.3]} color="#f49d37" />
      <Box size={[0.06, 0.06, 0.04]} position={[0.1, 0.78, 0.22]} color="#222" />
      <Box size={[0.06, 0.06, 0.04]} position={[-0.1, 0.78, 0.22]} color="#222" />
      <Box size={[0.48, 0.08, 0.48]} position={[0, 0.48, 0]} color="#e94f37" />
      <Box size={[0.3, 0.26, 0.3]} position={[0, 1.0, 0]} color="#2b2f36" />
    </group>
  );
}

function Present() {
  return (
    <group>
      <Box size={[0.66, 0.6, 0.66]} position={[0, 0.3, 0]} color="#2f9e5a" />
      <Box size={[0.68, 0.62, 0.14]} position={[0, 0.3, 0]} color="#e94f37" />
      <Box size={[0.14, 0.62, 0.68]} position={[0, 0.3, 0]} color="#e94f37" />
      <Box size={[0.3, 0.14, 0.14]} position={[0, 0.66, 0]} color="#e94f37" />
    </group>
  );
}

function SnowPine() {
  return (
    <group>
      <Box size={[0.24, 0.35, 0.24]} position={[0, 0.17, 0]} color="#6b4a2f" />
      {[
        [0.85, 0.5],
        [0.65, 0.88],
        [0.42, 1.22],
      ].map(([w, y], i) => (
        <group key={i}>
          <Box size={[w, 0.34, w]} position={[0, y, 0]} color="#2e6b47" />
          <Box size={[w * 0.9, 0.08, w * 0.9]} position={[0, y + 0.18, 0]} color="#ffffff" cast={false} />
        </group>
      ))}
    </group>
  );
}

/** A blocking prop on a grass lane. `height` (1-3) picks among each biome's variants. */
export function Obstacle({ biome, height, variant }: { biome: BiomeId; height: number; variant: number }) {
  switch (biome) {
    case "farm":
      return height === 1 ? <HayBale /> : height === 2 ? <Corn /> : <AppleTree />;
    case "safari":
      return height === 1 ? <Bush /> : height === 2 ? <Boulder /> : <Baobab />;
    case "savannah":
      return height === 1 ? <GrassTuft /> : height === 2 ? <TermiteMound /> : <Acacia />;
    case "city":
      return height === 1 ? <Hydrant /> : height === 2 ? <Planter /> : <Building variant={variant} />;
    case "northpole":
      return height === 1 ? <Snowman /> : height === 2 ? <Present /> : <SnowPine />;
    default:
      return extraObstacle(biome, height, variant) ?? <Tree height={height} />;
  }
}

// ---- Traffic -------------------------------------------------------------------

type VehicleProps = { color: string; length: number };

function Tractor({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length * 0.55, 0.45, 0.6]} position={[length * 0.15, 0.5, 0]} color={color} />
      <Box size={[0.5, 0.55, 0.62]} position={[-length * 0.18, 0.95, 0]} color="#2c3e50" />
      <Box size={[0.56, 0.06, 0.68]} position={[-length * 0.18, 1.25, 0]} color={color} />
      <Box size={[0.08, 0.35, 0.08]} position={[length * 0.32, 0.9, 0.15]} color="#444" />
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <Box size={[0.62, 0.62, 0.16]} position={[-length * 0.2, 0.31, sz * 0.4]} color="#222" />
          <Box size={[0.3, 0.3, 0.17]} position={[-length * 0.2, 0.31, sz * 0.4]} color="#f2b134" />
          <Box size={[0.34, 0.34, 0.12]} position={[length * 0.3, 0.17, sz * 0.36]} color="#222" />
        </group>
      ))}
    </group>
  );
}

function HayWagon({ color, length }: VehicleProps) {
  const cab = 0.85;
  return (
    <group>
      <group position={[length / 2 - cab / 2, 0, 0]} scale={[0.6, 0.85, 0.9]}>
        <Tractor color="#3f9d3a" length={1.4} />
      </group>
      <Box size={[length - cab - 0.1, 0.12, 0.85]} position={[-cab / 2, 0.36, 0]} color="#8b5a2b" />
      <Box size={[0.7, 0.45, 0.7]} position={[-cab / 2 - 0.42, 0.65, 0]} color={color} />
      <Box size={[0.7, 0.45, 0.7]} position={[-cab / 2 + 0.38, 0.65, 0]} color={color} />
      <Box size={[0.7, 0.4, 0.7]} position={[-cab / 2, 1.08, 0]} color="#f0d488" />
      {[-0.7, 0.1].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.3, 0.3, 0.1]} position={[x - cab / 2 + 0.2, 0.15, sz * 0.42]} color="#222" />
        )),
      )}
    </group>
  );
}

function SafariJeep({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length, 0.45, 0.84]} position={[0, 0.38, 0]} color={color} />
      <Box size={[0.06, 0.3, 0.74]} position={[length * 0.12, 0.75, 0]} color="#9fc6d8" />
      {[-1, 1].map((sz) => (
        <Box key={sz} size={[0.06, 0.4, 0.06]} position={[-length * 0.25, 0.8, sz * 0.38]} color="#3a3a3a" />
      ))}
      <Box size={[0.06, 0.06, 0.82]} position={[-length * 0.25, 1.0, 0]} color="#3a3a3a" />
      <Box size={[0.12, 0.34, 0.34]} position={[-length / 2 - 0.05, 0.45, 0]} color="#222" />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, 0.25]} color="#fff6b0" glow={2.5} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, -0.25]} color="#fff6b0" glow={2.5} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[0.34, 0.32, 0.12]} position={[sx * length * 0.3, 0.16, sz * 0.42]} color="#222" />
        )),
      )}
    </group>
  );
}

function Legs({ xs, height, color, width = 0.16 }: { xs: number[]; height: number; color: string; width?: number }) {
  return (
    <>
      {xs.map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[width, height, width]} position={[x, height / 2, sz * 0.2]} color={color} />
        )),
      )}
    </>
  );
}

function Rhino({ length }: VehicleProps) {
  const grey = "#8d9196";
  return (
    <group>
      <Legs xs={[-length * 0.3, length * 0.2]} height={0.35} color="#7a7e83" width={0.24} />
      <Box size={[length * 0.75, 0.75, 0.8]} position={[-length * 0.05, 0.72, 0]} color={grey} />
      <Box size={[0.6, 0.5, 0.56]} position={[length * 0.38, 0.62, 0]} color={grey} />
      <Box size={[0.12, 0.34, 0.12]} position={[length / 2 - 0.04, 0.98, 0]} color="#e8e2d0" />
      <Box size={[0.1, 0.2, 0.1]} position={[length * 0.34, 1.0, 0]} color="#e8e2d0" />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.42, 0.75, 0.29]} color="#222" />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.42, 0.75, -0.29]} color="#222" />
      <Box size={[0.1, 0.16, 0.18]} position={[length * 0.25, 1.0, 0.2]} color={grey} />
      <Box size={[0.1, 0.16, 0.18]} position={[length * 0.25, 1.0, -0.2]} color={grey} />
    </group>
  );
}

function Zebra({ length }: VehicleProps) {
  return (
    <group>
      <Legs xs={[-length * 0.28, length * 0.2]} height={0.45} color="#f4f4f4" width={0.12} />
      <Box size={[length * 0.65, 0.42, 0.42]} position={[-length * 0.04, 0.66, 0]} color="#f4f4f4" />
      {[-0.4, -0.2, 0, 0.2].map((x) => (
        <Box key={x} size={[0.08, 0.44, 0.44]} position={[x * length * 0.6, 0.66, 0]} color="#222" cast={false} />
      ))}
      <Box size={[0.2, 0.5, 0.22]} position={[length * 0.3, 0.98, 0]} color="#f4f4f4" />
      <Box size={[0.08, 0.5, 0.08]} position={[length * 0.27, 1.02, 0]} color="#222" />
      <Box size={[0.42, 0.2, 0.22]} position={[length * 0.42, 1.18, 0]} color="#f4f4f4" />
      <Box size={[0.1, 0.2, 0.23]} position={[length * 0.42, 1.18, 0]} color="#222" cast={false} />
      <Box size={[0.08, 0.3, 0.08]} position={[-length * 0.38, 0.62, 0]} color="#222" />
    </group>
  );
}

function Elephant({ color, length }: VehicleProps) {
  return (
    <group>
      <Legs xs={[-length * 0.25, length * 0.18]} height={0.55} color="#8a8f95" width={0.3} />
      <Box size={[length * 0.68, 0.9, 0.84]} position={[-length * 0.06, 1.0, 0]} color={color} />
      <Box size={[0.62, 0.62, 0.62]} position={[length * 0.36, 1.18, 0]} color={color} />
      <Box size={[0.1, 0.62, 0.5]} position={[length * 0.3, 1.18, 0.5]} color="#8a8f95" />
      <Box size={[0.1, 0.62, 0.5]} position={[length * 0.3, 1.18, -0.5]} color="#8a8f95" />
      <Box size={[0.2, 0.7, 0.2]} position={[length / 2 - 0.02, 0.72, 0]} color={color} />
      <Box size={[0.3, 0.08, 0.08]} position={[length / 2, 0.9, 0.18]} color="#fffaf0" />
      <Box size={[0.3, 0.08, 0.08]} position={[length / 2, 0.9, -0.18]} color="#fffaf0" />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.46, 1.3, 0.28]} color="#222" />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.46, 1.3, -0.28]} color="#222" />
    </group>
  );
}

function Taxi({ color, length }: VehicleProps) {
  return (
    <group>
      <Car color={color} length={length} dir={1} />
      {color === "#f6c90e" && (
        <>
          <Box size={[0.36, 0.14, 0.24]} position={[-length * 0.08, 0.93, 0]} color="#ffffff" />
          <Box size={[length, 0.08, 0.84]} position={[0, 0.4, 0]} color="#2b2f36" cast={false} />
        </>
      )}
    </group>
  );
}

function Bus({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length, 1.05, 0.88]} position={[0, 0.68, 0]} color={color} />
      <Box size={[length - 0.3, 0.3, 0.9]} position={[-0.1, 0.9, 0]} color="#cfe8ff" />
      <Box size={[0.06, 0.4, 0.74]} position={[length / 2, 0.85, 0]} color="#2c3e50" />
      <Box size={[length + 0.02, 0.06, 0.9]} position={[0, 0.62, 0]} color="#ffffff" cast={false} />
      {[-length * 0.32, length * 0.3].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.32, 0.3, 0.1]} position={[x, 0.15, sz * 0.44]} color="#222" />
        )),
      )}
    </group>
  );
}

function Snowmobile({ color, length }: VehicleProps) {
  return (
    <group>
      {[-1, 1].map((sz) => (
        <Box key={sz} size={[length * 0.9, 0.06, 0.1]} position={[0, 0.05, sz * 0.3]} color="#444" />
      ))}
      <Box size={[0.08, 0.16, 0.66]} position={[length * 0.45, 0.1, 0]} color="#444" />
      <Box size={[length * 0.8, 0.32, 0.62]} position={[-0.05, 0.3, 0]} color={color} />
      <Box size={[0.4, 0.22, 0.6]} position={[length * 0.25, 0.52, 0]} color={color} />
      <Box size={[0.06, 0.24, 0.5]} position={[length * 0.15, 0.72, 0]} color="#bfe3f5" />
      <Box size={[0.5, 0.12, 0.4]} position={[-length * 0.15, 0.52, 0]} color="#222" />
      {/* Rider in a puffy coat. */}
      <Box size={[0.32, 0.38, 0.34]} position={[-length * 0.12, 0.76, 0]} color="#2b2f36" />
      <Box size={[0.24, 0.22, 0.24]} position={[-length * 0.1, 1.06, 0]} color="#f2d0a9" />
      <Box size={[0.26, 0.1, 0.26]} position={[-length * 0.1, 1.2, 0]} color="#e94f37" />
    </group>
  );
}

function Reindeer({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Legs xs={[-0.18, 0.16]} height={0.36} color="#6b4a2f" width={0.1} />
      <Box size={[0.6, 0.3, 0.32]} position={[0, 0.5, 0]} color="#8b5a2b" />
      <Box size={[0.24, 0.24, 0.22]} position={[0.36, 0.75, 0]} color="#8b5a2b" />
      <Box size={[0.08, 0.08, 0.08]} position={[0.5, 0.72, 0]} color="#e0352b" />
      <Box size={[0.04, 0.24, 0.2]} position={[0.3, 1.0, 0]} color="#e8d9b5" />
    </group>
  );
}

function Sleigh({ color, length }: VehicleProps) {
  const sled = 1.1;
  const back = -length / 2 + sled / 2;
  return (
    <group>
      <Reindeer x={length / 2 - 0.35} />
      <Reindeer x={length / 2 - 1.0} />
      {[-1, 1].map((sz) => (
        <Box key={sz} size={[sled, 0.06, 0.08]} position={[back, 0.05, sz * 0.32]} color="#d4af37" />
      ))}
      <Box size={[sled, 0.42, 0.74]} position={[back, 0.35, 0]} color={color} />
      <Box size={[0.24, 0.42, 0.74]} position={[back - sled / 2 + 0.12, 0.75, 0]} color={color} />
      <Box size={[sled + 0.02, 0.06, 0.76]} position={[back, 0.56, 0]} color="#d4af37" cast={false} />
      {/* Santa and his sack. */}
      <Box size={[0.36, 0.42, 0.4]} position={[back + 0.1, 0.78, 0]} color="#c0392b" />
      <Box size={[0.26, 0.22, 0.26]} position={[back + 0.12, 1.08, 0]} color="#f2d0a9" />
      <Box size={[0.3, 0.14, 0.3]} position={[back + 0.12, 1.08, 0]} color="#ffffff" cast={false} />
      <Box size={[0.24, 0.14, 0.24]} position={[back + 0.12, 1.24, 0]} color="#c0392b" />
      <Box size={[0.36, 0.36, 0.36]} position={[back - 0.24, 0.92, 0]} color="#8b5a2b" />
    </group>
  );
}

/** A road mover drawn for its biome. Cars and trucks keep their collision lengths. */
export const Vehicle = forwardRef<
  Group,
  { biome: BiomeId; kind: MoverKind; color: string; length: number; dir: number }
>(function Vehicle({ biome, kind, color, length, dir }, ref) {
  const big = kind === "truck";
  let body: React.ReactNode;
  switch (biome) {
    case "farm":
      body = big ? <HayWagon color={color} length={length} /> : <Tractor color={color} length={length} />;
      break;
    case "safari":
      body = big ? <Rhino color={color} length={length} /> : <SafariJeep color={color} length={length} />;
      break;
    case "savannah":
      body = big ? <Elephant color={color} length={length} /> : <Zebra color={color} length={length} />;
      break;
    case "city":
      body = big ? <Bus color={color} length={length} /> : <Taxi color={color} length={length} />;
      break;
    case "northpole":
      body = big ? <Sleigh color={color} length={length} /> : <Snowmobile color={color} length={length} />;
      break;
    default:
      body = extraVehicle(biome, big, { color, length });
      if (body) break;
      return big ? (
        <Truck ref={ref} color={color} length={length} dir={dir} />
      ) : (
        <Car ref={ref} color={color} length={length} dir={dir} />
      );
  }
  return (
    <group ref={ref}>
      <group scale={[dir, 1, 1]}>{body}</group>
    </group>
  );
});

// ---- River floaters ------------------------------------------------------------

const IceFloe = forwardRef<Group, { length: number }>(function IceFloe({ length }, ref) {
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.26, 0.8]} position={[0, -0.13, 0]} color="#e3f2fb" receive />
      <Box size={[length - 0.3, 0.04, 0.62]} position={[0, 0.01, 0]} color="#ffffff" cast={false} receive />
      <Box size={[0.4, 0.12, 0.3]} position={[length / 2 - 0.5, 0.06, 0.16]} color="#ffffff" cast={false} />
    </group>
  );
});

/** Whatever the player rides across water in this biome. */
export const Floater = forwardRef<Group, { biome: BiomeId; length: number }>(function Floater(
  { biome, length },
  ref,
) {
  if (biome === "northpole") return <IceFloe ref={ref} length={length} />;
  if (biome in ExtraFloater) {
    const Extra = ExtraFloater[biome as keyof typeof ExtraFloater];
    return <Extra ref={ref} length={length} />;
  }
  return <Log ref={ref} length={length} />;
});

// ---- Desert ----------------------------------------------------------------------

function SandstoneRocks() {
  return (
    <group>
      <Box size={[0.7, 0.4, 0.6]} position={[0, 0.2, 0]} color="#c98b55" />
      <Box size={[0.4, 0.3, 0.36]} position={[0.12, 0.55, 0.05]} color="#d9a06a" />
      <Box size={[0.3, 0.22, 0.3]} position={[-0.3, 0.11, 0.3]} color="#b97a48" />
    </group>
  );
}

function BarrelCactus() {
  return (
    <group>
      <Box size={[0.6, 0.55, 0.6]} position={[0, 0.28, 0]} color="#5f9a4a" />
      <Box size={[0.5, 0.08, 0.5]} position={[0, 0.58, 0]} color="#6fae56" />
      <Box size={[0.14, 0.1, 0.14]} position={[0.08, 0.66, 0]} color="#ff5f8f" />
      <Box size={[0.12, 0.1, 0.12]} position={[-0.12, 0.66, 0.08]} color="#ffd34d" />
    </group>
  );
}

function Saguaro() {
  return (
    <group>
      <Box size={[0.3, 1.5, 0.3]} position={[0, 0.75, 0]} color="#4f8f3f" />
      <Box size={[0.3, 0.16, 0.2]} position={[0.26, 0.7, 0]} color="#4f8f3f" />
      <Box size={[0.18, 0.5, 0.2]} position={[0.36, 0.98, 0]} color="#4f8f3f" />
      <Box size={[0.3, 0.16, 0.2]} position={[-0.26, 0.95, 0]} color="#4f8f3f" />
      <Box size={[0.18, 0.4, 0.2]} position={[-0.36, 1.18, 0]} color="#4f8f3f" />
      <Box size={[0.32, 0.06, 0.32]} position={[0, 1.52, 0]} color="#ffe07a" />
    </group>
  );
}

function DuneBuggy({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length * 0.9, 0.22, 0.7]} position={[0, 0.42, 0]} color={color} />
      <Box size={[0.3, 0.2, 0.62]} position={[length * 0.36, 0.56, 0]} color={color} />
      {/* Roll cage. */}
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <Box size={[0.06, 0.5, 0.06]} position={[-length * 0.2, 0.78, sz * 0.3]} color="#2b2f36" />
          <Box size={[0.06, 0.5, 0.06]} position={[length * 0.1, 0.78, sz * 0.3]} color="#2b2f36" />
          <Box size={[length * 0.36, 0.06, 0.06]} position={[-length * 0.05, 1.02, sz * 0.3]} color="#2b2f36" />
        </group>
      ))}
      <Box size={[0.26, 0.34, 0.3]} position={[-length * 0.05, 0.68, 0]} color="#ff9f43" />
      <Box size={[0.2, 0.2, 0.22]} position={[-length * 0.05, 0.95, 0]} color="#f2f2f2" />
      <Box size={[0.06, 0.1, 0.16]} position={[length / 2 - 0.02, 0.5, 0.22]} color="#fff6b0" glow={2.5} />
      <Box size={[0.06, 0.1, 0.16]} position={[length / 2 - 0.02, 0.5, -0.22]} color="#fff6b0" glow={2.5} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Box key={`${sx}${sz}`} size={[0.42, 0.42, 0.16]} position={[sx * length * 0.32, 0.21, sz * 0.42]} color="#222" />
        )),
      )}
    </group>
  );
}

function Camel({ x }: { x: number }) {
  const tan = "#c9955a";
  return (
    <group position={[x, 0, 0]}>
      <Legs xs={[-0.32, 0.22]} height={0.55} color="#b5814a" width={0.12} />
      <Box size={[0.9, 0.36, 0.42]} position={[-0.05, 0.72, 0]} color={tan} />
      <Box size={[0.32, 0.26, 0.36]} position={[-0.12, 1.0, 0]} color={tan} />
      <Box size={[0.14, 0.42, 0.16]} position={[0.42, 0.98, 0]} color={tan} />
      <Box size={[0.32, 0.16, 0.18]} position={[0.52, 1.2, 0]} color={tan} />
      <Box size={[0.36, 0.08, 0.46]} position={[-0.12, 1.15, 0]} color="#c0392b" cast={false} />
    </group>
  );
}

function CamelCaravan({ length }: VehicleProps) {
  return (
    <group>
      <Camel x={length / 2 - 0.62} />
      <Camel x={-length / 2 + 0.62} />
      <Box size={[0.6, 0.03, 0.03]} position={[0, 1.0, 0]} color="#6b4a2f" cast={false} />
    </group>
  );
}

// ---- Beach ------------------------------------------------------------------------

function Sandcastle() {
  return (
    <group>
      <Box size={[0.7, 0.3, 0.7]} position={[0, 0.15, 0]} color="#e9c98a" />
      <Box size={[0.24, 0.3, 0.24]} position={[0.2, 0.45, 0.2]} color="#e2bf7d" />
      <Box size={[0.24, 0.3, 0.24]} position={[-0.2, 0.45, -0.2]} color="#e2bf7d" />
      <Box size={[0.3, 0.42, 0.3]} position={[0, 0.5, 0]} color="#e9c98a" />
      <Box size={[0.04, 0.24, 0.04]} position={[0, 0.82, 0]} color="#6b4a2f" />
      <Box size={[0.16, 0.1, 0.02]} position={[0.08, 0.89, 0]} color="#e94f37" />
    </group>
  );
}

function Umbrella({ variant }: { variant: number }) {
  const colors = ["#e94f37", "#3f88c5", "#f6c90e", "#44bba4"];
  const c = colors[variant % colors.length];
  return (
    <group>
      <Box size={[0.06, 1.2, 0.06]} position={[0, 0.6, 0]} color="#f4f4f4" />
      <Box size={[1.0, 0.12, 1.0]} position={[0, 1.2, 0]} color={c} />
      <Box size={[0.7, 0.12, 0.7]} position={[0, 1.3, 0]} color="#ffffff" />
      <Box size={[0.36, 0.12, 0.36]} position={[0, 1.4, 0]} color={c} />
      <Box size={[0.7, 0.06, 0.36]} position={[0.1, 0.03, 0.25]} color="#f6a6c1" cast={false} />
    </group>
  );
}

function Palm() {
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} size={[0.22, 0.4, 0.22]} position={[i * 0.05, 0.2 + i * 0.36, 0]} color={i % 2 ? "#a77b4f" : "#8f6a42"} />
      ))}
      {[
        [0.45, 0, 0.9, 0.1],
        [-0.3, 0, 0.9, 0.1],
        [0.08, 0.4, 0.1, 0.9],
        [0.08, -0.4, 0.1, 0.9],
      ].map(([x, z, w, d], i) => (
        <Box key={i} size={[w, 0.08, d]} position={[0.15 + x, 1.5, z]} color="#3f9d3a" />
      ))}
      <Box size={[0.36, 0.16, 0.36]} position={[0.15, 1.52, 0]} color="#4fae44" />
      <Box size={[0.12, 0.12, 0.12]} position={[0.15, 1.38, 0.14]} color="#6b4a2f" />
    </group>
  );
}

function Crab({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length * 0.6, 0.34, 0.7]} position={[0, 0.36, 0]} color={color} />
      <Box size={[length * 0.5, 0.1, 0.6]} position={[0, 0.56, 0]} color="#ff8a65" />
      {[-1, 1].map((sz) => (
        <group key={sz}>
          {[-0.3, 0, 0.3].map((x) => (
            <Box key={x} size={[0.08, 0.3, 0.08]} position={[x * length * 0.6, 0.12, sz * 0.42]} color={color} />
          ))}
          <Box size={[0.08, 0.2, 0.08]} position={[length * 0.2, 0.68, sz * 0.14]} color={color} />
          <Box size={[0.1, 0.1, 0.1]} position={[length * 0.2, 0.8, sz * 0.14]} color="#111" />
          <Box size={[0.3, 0.22, 0.2]} position={[length * 0.42, 0.42, sz * 0.32]} color={color} />
        </group>
      ))}
    </group>
  );
}

function IceCreamTruck({ length }: VehicleProps) {
  return (
    <group>
      <Box size={[length, 0.95, 0.88]} position={[0, 0.65, 0]} color="#fdf6ec" />
      <Box size={[length + 0.02, 0.18, 0.9]} position={[0, 0.3, 0]} color="#f48fb1" />
      <Box size={[0.9, 0.36, 0.9]} position={[-0.2, 0.75, 0]} color="#8fd3f4" />
      <Box size={[0.06, 0.34, 0.74]} position={[length / 2, 0.82, 0]} color="#2c3e50" />
      {/* Giant cone on the roof. */}
      <Box size={[0.18, 0.3, 0.18]} position={[-0.3, 1.27, 0]} color="#d9a05b" />
      <Box size={[0.34, 0.26, 0.34]} position={[-0.3, 1.52, 0]} color="#f8bbd0" />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, 0.28]} color="#fff6b0" glow={2.5} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, -0.28]} color="#fff6b0" glow={2.5} />
      {[-length * 0.3, length * 0.3].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.32, 0.3, 0.1]} position={[x, 0.15, sz * 0.44]} color="#222" />
        )),
      )}
    </group>
  );
}

const PoolFloat = forwardRef<Group, { length: number }>(function PoolFloat({ length }, ref) {
  const stripes = Math.max(2, Math.round(length * 2));
  return (
    <group ref={ref}>
      {Array.from({ length: stripes }, (_, i) => (
        <Box
          key={i}
          size={[length / stripes - 0.02, 0.26, 0.78]}
          position={[-length / 2 + (i + 0.5) * (length / stripes), -0.12, 0]}
          color={i % 2 ? "#ffffff" : "#ff6f91"}
          receive
        />
      ))}
    </group>
  );
});

// ---- Jungle -----------------------------------------------------------------------

function Fern() {
  return (
    <group>
      {[
        [0.3, 0.1, 0.5, 0.08],
        [-0.3, -0.1, 0.5, 0.08],
        [0.05, 0.3, 0.08, 0.5],
        [-0.05, -0.3, 0.08, 0.5],
      ].map(([x, z, w, d], i) => (
        <Box key={i} size={[w, 0.06, d]} position={[x, 0.32 + i * 0.03, z]} color="#2f8f3a" />
      ))}
      <Box size={[0.2, 0.36, 0.2]} position={[0, 0.18, 0]} color="#3e7a2c" />
    </group>
  );
}

function FlowerBush() {
  return (
    <group>
      <Box size={[0.8, 0.6, 0.75]} position={[0, 0.3, 0]} color="#2e7d32" />
      <Box size={[0.18, 0.12, 0.18]} position={[0.2, 0.64, 0.15]} color="#ff4f81" />
      <Box size={[0.18, 0.12, 0.18]} position={[-0.22, 0.58, -0.1]} color="#ffb300" />
      <Box size={[0.16, 0.12, 0.16]} position={[0.05, 0.66, -0.25]} color="#ab47bc" />
    </group>
  );
}

function JungleTree() {
  return (
    <group>
      <Box size={[0.32, 1.3, 0.32]} position={[0, 0.65, 0]} color="#6d4c33" />
      <Box size={[1.0, 0.4, 1.0]} position={[0, 1.4, 0]} color="#1f7a35" />
      <Box size={[0.7, 0.3, 0.7]} position={[0.05, 1.72, 0]} color="#2a9142" />
      <Box size={[0.05, 0.6, 0.05]} position={[0.4, 0.95, 0.3]} color="#3e8e2f" />
      <Box size={[0.05, 0.45, 0.05]} position={[-0.38, 1.0, -0.2]} color="#3e8e2f" />
    </group>
  );
}

function Tiger({ length }: VehicleProps) {
  const orange = "#f28b2a";
  return (
    <group>
      <Legs xs={[-length * 0.28, length * 0.2]} height={0.32} color={orange} width={0.14} />
      <Box size={[length * 0.66, 0.36, 0.42]} position={[-length * 0.04, 0.5, 0]} color={orange} />
      {[-0.4, -0.2, 0, 0.2].map((x) => (
        <Box key={x} size={[0.06, 0.38, 0.44]} position={[x * length * 0.6, 0.5, 0]} color="#222" cast={false} />
      ))}
      <Box size={[0.36, 0.32, 0.36]} position={[length * 0.36, 0.66, 0]} color={orange} />
      <Box size={[0.14, 0.12, 0.26]} position={[length * 0.52, 0.58, 0]} color="#fff3e6" />
      <Box size={[0.08, 0.1, 0.08]} position={[length * 0.36, 0.86, 0.12]} color={orange} />
      <Box size={[0.08, 0.1, 0.08]} position={[length * 0.36, 0.86, -0.12]} color={orange} />
      <Box size={[0.4, 0.08, 0.08]} position={[-length * 0.45, 0.62, 0]} color={orange} />
    </group>
  );
}

function Crocodile({ length }: VehicleProps) {
  const green = "#4a7d36";
  return (
    <group>
      <Legs xs={[-length * 0.22, length * 0.12]} height={0.16} color={green} width={0.16} />
      <Box size={[length * 0.5, 0.3, 0.56]} position={[-length * 0.04, 0.28, 0]} color={green} />
      {[-0.25, -0.1, 0.05].map((x) => (
        <Box key={x} size={[0.12, 0.08, 0.2]} position={[x * length, 0.46, 0]} color="#3b6a2a" />
      ))}
      <Box size={[length * 0.3, 0.2, 0.4]} position={[length * 0.34, 0.24, 0]} color={green} />
      <Box size={[length * 0.26, 0.04, 0.38]} position={[length * 0.36, 0.25, 0]} color="#f4f4f4" cast={false} />
      <Box size={[0.1, 0.1, 0.1]} position={[length * 0.24, 0.4, 0.14]} color="#ffd34d" />
      <Box size={[0.1, 0.1, 0.1]} position={[length * 0.24, 0.4, -0.14]} color="#ffd34d" />
      <Box size={[length * 0.3, 0.16, 0.24]} position={[-length * 0.42, 0.2, 0]} color={green} />
    </group>
  );
}

// ---- Volcano ----------------------------------------------------------------------

function LavaRock() {
  return (
    <group>
      <Box size={[0.7, 0.45, 0.65]} position={[0, 0.22, 0]} color="#3b3433" />
      <Box size={[0.5, 0.06, 0.06]} position={[0, 0.3, 0.33]} color="#ff6a1a" cast={false} glow={2} />
      <Box size={[0.06, 0.06, 0.4]} position={[0.36, 0.2, 0]} color="#ff6a1a" cast={false} glow={2} />
      <Box size={[0.4, 0.25, 0.36]} position={[0.08, 0.55, 0]} color="#4a4140" />
    </group>
  );
}

function ObsidianSpikes() {
  return (
    <group>
      <Box size={[0.24, 0.9, 0.24]} position={[0, 0.45, 0]} color="#241f2b" />
      <Box size={[0.2, 0.6, 0.2]} position={[0.24, 0.3, 0.12]} color="#2f2838" />
      <Box size={[0.18, 0.5, 0.18]} position={[-0.22, 0.25, -0.12]} color="#2f2838" />
      <Box size={[0.14, 0.2, 0.14]} position={[0, 0.98, 0]} color="#5b4e6e" />
    </group>
  );
}

function MiniVolcano() {
  return (
    <group>
      <Box size={[0.9, 0.4, 0.9]} position={[0, 0.2, 0]} color="#4a3f3c" />
      <Box size={[0.66, 0.4, 0.66]} position={[0, 0.6, 0]} color="#554946" />
      <Box size={[0.44, 0.36, 0.44]} position={[0, 0.98, 0]} color="#605350" />
      <Box size={[0.26, 0.06, 0.26]} position={[0, 1.18, 0]} color="#ff7a1a" cast={false} glow={3} />
      <Box size={[0.08, 0.5, 0.08]} position={[0.2, 0.75, 0.3]} color="#ff6a1a" cast={false} glow={2} />
    </group>
  );
}

function LavaRover({ color, length }: VehicleProps) {
  return (
    <group>
      <Box size={[length, 0.4, 0.8]} position={[0, 0.42, 0]} color={color} />
      <Box size={[length * 0.5, 0.28, 0.66]} position={[-length * 0.1, 0.76, 0]} color="#2b2f36" />
      <Box size={[length * 0.46, 0.14, 0.68]} position={[-length * 0.1, 0.76, 0]} color="#ffb04d" glow={1.2} cast={false} />
      <Box size={[0.06, 0.1, 0.5]} position={[length / 2, 0.48, 0]} color="#ff6a1a" glow={3} />
      {[-1, 1].map((sz) => (
        <Box key={sz} size={[length * 0.9, 0.3, 0.14]} position={[0, 0.16, sz * 0.4]} color="#1d1b1c" />
      ))}
    </group>
  );
}

function DumpTruck({ color, length }: VehicleProps) {
  const cab = 0.75;
  return (
    <group>
      <Box size={[cab, 0.8, 0.84]} position={[length / 2 - cab / 2, 0.55, 0]} color={color} />
      <Box size={[0.06, 0.28, 0.7]} position={[length / 2, 0.72, 0]} color="#2c3e50" />
      <Box size={[length - cab - 0.06, 0.6, 0.9]} position={[-cab / 2, 0.55, 0]} color="#5b5f66" />
      <Box size={[length - cab - 0.3, 0.2, 0.7]} position={[-cab / 2, 0.92, 0]} color="#ff6a1a" glow={2.2} cast={false} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, 0.28]} color="#fff6b0" glow={2.5} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, -0.28]} color="#fff6b0" glow={2.5} />
      {[-0.55, 0.05, length / 2 - 0.35].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.34, 0.34, 0.12]} position={[x, 0.17, sz * 0.44]} color="#222" />
        )),
      )}
    </group>
  );
}

const BasaltSlab = forwardRef<Group, { length: number }>(function BasaltSlab({ length }, ref) {
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.3, 0.78]} position={[0, -0.15, 0]} color="#3a3434" receive />
      <Box size={[length - 0.3, 0.04, 0.6]} position={[0, 0.01, 0]} color="#4a4342" cast={false} receive />
      <Box size={[length - 0.04, 0.06, 0.82]} position={[0, -0.27, 0]} color="#ff7a1a" cast={false} glow={2} />
    </group>
  );
});

// ---- Spooky -----------------------------------------------------------------------

function Pumpkin() {
  return (
    <group>
      <Box size={[0.66, 0.5, 0.6]} position={[0, 0.25, 0]} color="#f07c1a" />
      <Box size={[0.08, 0.5, 0.62]} position={[0, 0.25, 0]} color="#d96a10" cast={false} />
      <Box size={[0.1, 0.16, 0.1]} position={[0, 0.58, 0]} color="#4a7d36" />
      {/* Carved face lit from inside. */}
      <Box size={[0.1, 0.1, 0.04]} position={[0.14, 0.33, 0.3]} color="#ffd34d" glow={2.5} cast={false} />
      <Box size={[0.1, 0.1, 0.04]} position={[-0.14, 0.33, 0.3]} color="#ffd34d" glow={2.5} cast={false} />
      <Box size={[0.3, 0.06, 0.04]} position={[0, 0.17, 0.3]} color="#ffd34d" glow={2.5} cast={false} />
    </group>
  );
}

function Gravestone() {
  return (
    <group>
      <Box size={[0.5, 0.7, 0.18]} position={[0, 0.35, 0]} color="#8f939a" />
      <Box size={[0.36, 0.12, 0.18]} position={[0, 0.76, 0]} color="#9ca0a7" />
      <Box size={[0.24, 0.05, 0.02]} position={[0, 0.5, 0.1]} color="#5d6066" cast={false} />
      <Box size={[0.05, 0.22, 0.02]} position={[0, 0.5, 0.1]} color="#5d6066" cast={false} />
      <Box size={[0.6, 0.08, 0.4]} position={[0, 0.04, 0.2]} color="#4b3a2a" cast={false} />
    </group>
  );
}

function DeadTree() {
  return (
    <group>
      <Box size={[0.24, 1.3, 0.24]} position={[0, 0.65, 0]} color="#4a3b33" />
      <Box size={[0.5, 0.1, 0.1]} position={[0.28, 1.0, 0]} color="#4a3b33" />
      <Box size={[0.1, 0.3, 0.1]} position={[0.5, 1.18, 0]} color="#4a3b33" />
      <Box size={[0.4, 0.1, 0.1]} position={[-0.22, 1.25, 0]} color="#4a3b33" />
      <Box size={[0.1, 0.24, 0.1]} position={[-0.38, 1.4, 0]} color="#4a3b33" />
      <Box size={[0.1, 0.1, 0.36]} position={[0, 0.8, 0.2]} color="#4a3b33" />
    </group>
  );
}

function Ghost({ length }: VehicleProps) {
  return (
    <group position={[0, 0.15, 0]}>
      <Box size={[length * 0.55, 0.7, 0.62]} position={[0, 0.6, 0]} color="#eef1ff" glow={0.5} />
      <Box size={[length * 0.45, 0.3, 0.52]} position={[-length * 0.05, 1.05, 0]} color="#eef1ff" glow={0.5} />
      {[-0.3, 0, 0.3].map((x) => (
        <Box key={x} size={[0.16, 0.18, 0.5]} position={[x * length * 0.5, 0.18, 0]} color="#dfe4ff" glow={0.4} />
      ))}
      <Box size={[0.04, 0.16, 0.12]} position={[length * 0.28, 0.8, 0.14]} color="#111" />
      <Box size={[0.04, 0.16, 0.12]} position={[length * 0.28, 0.8, -0.14]} color="#111" />
      <Box size={[0.04, 0.12, 0.16]} position={[length * 0.28, 0.56, 0]} color="#111" />
    </group>
  );
}

function Hearse({ length }: VehicleProps) {
  return (
    <group>
      <Box size={[length, 0.45, 0.84]} position={[0, 0.35, 0]} color="#1d1b22" />
      <Box size={[length * 0.75, 0.42, 0.78]} position={[-length * 0.1, 0.78, 0]} color="#26232c" />
      <Box size={[length * 0.4, 0.22, 0.8]} position={[-length * 0.2, 0.8, 0]} color="#5c4a7a" cast={false} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.4, 0.26]} color="#c9a7ff" glow={2.5} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.4, -0.26]} color="#c9a7ff" glow={2.5} />
      {[-length * 0.32, length * 0.32].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.32, 0.28, 0.1]} position={[x, 0.14, sz * 0.44]} color="#111" />
        )),
      )}
    </group>
  );
}

const Coffin = forwardRef<Group, { length: number }>(function Coffin({ length }, ref) {
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.3, 0.72]} position={[0, -0.15, 0]} color="#5a3b28" receive />
      <Box size={[length - 0.3, 0.04, 0.56]} position={[0, 0.01, 0]} color="#6e4a32" cast={false} receive />
      <Box size={[0.4, 0.05, 0.08]} position={[0, 0.03, 0]} color="#c9b27c" cast={false} />
      <Box size={[0.08, 0.05, 0.3]} position={[-0.06, 0.03, 0]} color="#c9b27c" cast={false} />
    </group>
  );
});

// ---- Biome lookups for the newer biomes ------------------------------------------------

/** Obstacles for the biomes added after the first six. */
export function extraObstacle(biome: BiomeId, height: number, variant: number): React.ReactNode | null {
  switch (biome) {
    case "desert":
      return height === 1 ? <SandstoneRocks /> : height === 2 ? <BarrelCactus /> : <Saguaro />;
    case "beach":
      return height === 1 ? <Sandcastle /> : height === 2 ? <Umbrella variant={variant} /> : <Palm />;
    case "jungle":
      return height === 1 ? <Fern /> : height === 2 ? <FlowerBush /> : <JungleTree />;
    case "volcano":
      return height === 1 ? <LavaRock /> : height === 2 ? <ObsidianSpikes /> : <MiniVolcano />;
    case "spooky":
      return height === 1 ? <Pumpkin /> : height === 2 ? <Gravestone /> : <DeadTree />;
    default:
      return null;
  }
}

export function extraVehicle(biome: BiomeId, big: boolean, props: VehicleProps): React.ReactNode | null {
  switch (biome) {
    case "desert":
      return big ? <CamelCaravan {...props} /> : <DuneBuggy {...props} />;
    case "beach":
      return big ? <IceCreamTruck {...props} /> : <Crab {...props} />;
    case "jungle":
      return big ? <Crocodile {...props} /> : <Tiger {...props} />;
    case "volcano":
      return big ? <DumpTruck {...props} /> : <LavaRover {...props} />;
    case "spooky":
      return big ? <Hearse {...props} /> : <Ghost {...props} />;
    default:
      return null;
  }
}

export const ExtraFloater = { beach: PoolFloat, volcano: BasaltSlab, spooky: Coffin } as const;
