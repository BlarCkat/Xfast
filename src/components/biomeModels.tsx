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
          <Box key={`${x}${y}`} size={[0.2, 0.22, 0.02]} position={[x, y, 0.46]} color="#cfe8ff" cast={false} />
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
      return <Tree height={height} />;
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
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, 0.25]} color="#fff6b0" />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, -0.25]} color="#fff6b0" />
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
  return biome === "northpole" ? <IceFloe ref={ref} length={length} /> : <Log ref={ref} length={length} />;
});
