"use client";

import { forwardRef } from "react";
import type { Group } from "three";
import type { BiomeId } from "@/game/biomes";
import { Box } from "./models";

// Props, traffic and river floaters for the Autumn, Bamboo and Candy biomes. Same conventions as
// biomeModels: vehicles face +x and keep the car (1.5) or truck (2.6) footprint they stand in for.

type VehicleProps = { color: string; length: number };

function Legs({ xs, height, color, width = 0.14 }: { xs: number[]; height: number; color: string; width?: number }) {
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

// ---- Autumn ------------------------------------------------------------------------

function LeafPile({ variant }: { variant: number }) {
  const tops = ["#e8742a", "#d94f2b", "#f2a93b"];
  return (
    <group>
      <Box size={[0.8, 0.26, 0.7]} position={[0, 0.13, 0]} color="#c4552a" />
      <Box size={[0.56, 0.2, 0.5]} position={[0.04, 0.34, -0.02]} color={tops[variant % 3]} />
      <Box size={[0.26, 0.12, 0.24]} position={[-0.06, 0.48, 0.04]} color="#f2c14e" />
      <Box size={[0.14, 0.04, 0.1]} position={[0.36, 0.02, 0.32]} color="#e0352b" cast={false} />
      <Box size={[0.1, 0.04, 0.14]} position={[-0.4, 0.02, -0.3]} color="#f2a93b" cast={false} />
    </group>
  );
}

function StumpMushrooms() {
  return (
    <group>
      <Box size={[0.56, 0.5, 0.56]} position={[0, 0.25, 0]} color="#7a5233" />
      <Box size={[0.48, 0.04, 0.48]} position={[0, 0.51, 0]} color="#d9b383" cast={false} />
      <Box size={[0.3, 0.04, 0.3]} position={[0, 0.53, 0]} color="#b98d5a" cast={false} />
      {[
        [0.34, 0.2, 0.2],
        [-0.32, -0.18, 0.15],
      ].map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box size={[0.08, s, 0.08]} position={[0, s / 2, 0]} color="#f4ead5" />
          <Box size={[0.24, 0.1, 0.24]} position={[0, s + 0.04, 0]} color="#d93a2b" />
          <Box size={[0.05, 0.03, 0.05]} position={[0.05, s + 0.1, 0.05]} color="#ffffff" cast={false} />
        </group>
      ))}
    </group>
  );
}

function MapleTree({ variant }: { variant: number }) {
  const leaves = [
    ["#e8742a", "#f2a93b"],
    ["#d94f2b", "#e8742a"],
    ["#f2c14e", "#f2a93b"],
  ][variant % 3];
  return (
    <group>
      <Box size={[0.26, 0.9, 0.26]} position={[0, 0.45, 0]} color="#5e4030" />
      <Box size={[0.9, 0.5, 0.9]} position={[0, 1.1, 0]} color={leaves[0]} />
      <Box size={[0.64, 0.4, 0.64]} position={[0, 1.5, 0]} color={leaves[1]} />
      <Box size={[0.3, 0.2, 0.3]} position={[0, 1.78, 0]} color={leaves[0]} />
      <Box size={[0.12, 0.04, 0.1]} position={[0.32, 0.02, 0.3]} color={leaves[0]} cast={false} />
      <Box size={[0.1, 0.04, 0.12]} position={[-0.3, 0.02, -0.22]} color={leaves[1]} cast={false} />
    </group>
  );
}

function Fox({ color, length }: VehicleProps) {
  return (
    <group>
      <Legs xs={[-length * 0.22, length * 0.16]} height={0.26} color="#3b2a22" width={0.1} />
      <Box size={[length * 0.48, 0.3, 0.34]} position={[-length * 0.03, 0.4, 0]} color={color} />
      <Box size={[length * 0.36, 0.1, 0.3]} position={[0, 0.26, 0]} color="#fff3e6" cast={false} />
      <Box size={[0.3, 0.28, 0.3]} position={[length * 0.28, 0.58, 0]} color={color} />
      <Box size={[0.16, 0.12, 0.16]} position={[length * 0.4, 0.52, 0]} color="#fff3e6" />
      <Box size={[0.05, 0.05, 0.05]} position={[length * 0.47, 0.55, 0]} color="#111" cast={false} />
      <Box size={[0.08, 0.14, 0.06]} position={[length * 0.26, 0.78, 0.1]} color={color} />
      <Box size={[0.08, 0.14, 0.06]} position={[length * 0.26, 0.78, -0.1]} color={color} />
      {/* Big bushy tail with a white tip. */}
      <Box size={[0.42, 0.2, 0.2]} position={[-length * 0.36, 0.56, 0]} color={color} />
      <Box size={[0.14, 0.18, 0.18]} position={[-length * 0.36 - 0.26, 0.6, 0]} color="#fff3e6" />
    </group>
  );
}

function Bear({ color, length }: VehicleProps) {
  return (
    <group>
      <Legs xs={[-length * 0.28, length * 0.18]} height={0.36} color={color} width={0.26} />
      <Box size={[length * 0.66, 0.66, 0.78]} position={[-length * 0.04, 0.72, 0]} color={color} />
      <Box size={[length * 0.2, 0.2, 0.7]} position={[-length * 0.1, 1.1, 0]} color={color} />
      <Box size={[0.56, 0.5, 0.56]} position={[length * 0.36, 0.92, 0]} color={color} />
      <Box size={[0.2, 0.18, 0.26]} position={[length * 0.36 + 0.34, 0.84, 0]} color="#c9a37a" />
      <Box size={[0.06, 0.06, 0.1]} position={[length * 0.36 + 0.45, 0.9, 0]} color="#111" cast={false} />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.36 + 0.29, 1.02, 0.14]} color="#111" cast={false} />
      <Box size={[0.06, 0.08, 0.06]} position={[length * 0.36 + 0.29, 1.02, -0.14]} color="#111" cast={false} />
      <Box size={[0.14, 0.14, 0.12]} position={[length * 0.32, 1.2, 0.2]} color={color} />
      <Box size={[0.14, 0.14, 0.12]} position={[length * 0.32, 1.2, -0.2]} color={color} />
    </group>
  );
}

const LeafyLog = forwardRef<Group, { length: number }>(function LeafyLog({ length }, ref) {
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.3, 0.7]} position={[0, -0.13, 0]} color="#7a5233" receive />
      <Box size={[length - 0.3, 0.04, 0.5]} position={[0, 0.02, 0]} color="#8d6240" cast={false} receive />
      <Box size={[0.08, 0.32, 0.68]} position={[length / 2 - 0.06, -0.13, 0]} color="#d9b383" cast={false} />
      <Box size={[0.08, 0.32, 0.68]} position={[-length / 2 + 0.06, -0.13, 0]} color="#d9b383" cast={false} />
      <Box size={[0.18, 0.04, 0.14]} position={[length * 0.2, 0.05, 0.14]} color="#e8742a" cast={false} />
      <Box size={[0.14, 0.04, 0.18]} position={[-length * 0.25, 0.05, -0.12]} color="#d94f2b" cast={false} />
    </group>
  );
});

// ---- Bamboo ------------------------------------------------------------------------

function StoneLantern() {
  const stone = "#a3a69c";
  return (
    <group>
      <Box size={[0.5, 0.12, 0.5]} position={[0, 0.06, 0]} color="#8e9188" />
      <Box size={[0.16, 0.36, 0.16]} position={[0, 0.3, 0]} color={stone} />
      <Box size={[0.36, 0.26, 0.36]} position={[0, 0.6, 0]} color={stone} />
      <Box size={[0.2, 0.14, 0.38]} position={[0, 0.6, 0]} color="#ffd98a" glow={1.4} cast={false} />
      <Box size={[0.6, 0.1, 0.6]} position={[0, 0.78, 0]} color="#8e9188" />
      <Box size={[0.32, 0.08, 0.32]} position={[0, 0.86, 0]} color={stone} />
      <Box size={[0.1, 0.1, 0.1]} position={[0, 0.94, 0]} color="#8e9188" />
    </group>
  );
}

function BonsaiPine() {
  return (
    <group>
      <Box size={[0.66, 0.2, 0.5]} position={[0, 0.1, 0]} color="#8c4a3a" />
      <Box size={[0.14, 0.5, 0.14]} position={[0.04, 0.45, 0]} color="#6b4a35" />
      <Box size={[0.32, 0.12, 0.12]} position={[-0.1, 0.66, 0]} color="#6b4a35" />
      <Box size={[0.6, 0.2, 0.5]} position={[-0.2, 0.8, 0]} color="#3f7d4a" />
      <Box size={[0.44, 0.2, 0.4]} position={[0.22, 0.98, 0.04]} color="#4a8f55" />
      <Box size={[0.3, 0.16, 0.3]} position={[-0.04, 1.14, -0.04]} color="#3f7d4a" />
    </group>
  );
}

function BambooCluster({ variant }: { variant: number }) {
  return (
    <group>
      {[
        [-0.2, -0.16, 2.1],
        [0.18, -0.1, 1.7],
        [0.02, 0.2, 2.4],
        [-0.24, 0.24, 1.5],
      ].map(([x, z, h], i) => {
        const segs = Math.round(h / 0.42);
        return (
          <group key={i} position={[x, 0, z]}>
            {Array.from({ length: segs }, (_, k) => (
              <Box
                key={k}
                size={[0.12, 0.38, 0.12]}
                position={[0, 0.21 + k * 0.42, 0]}
                color={(k + i + variant) % 2 ? "#7fb34a" : "#8cc152"}
              />
            ))}
            <Box size={[0.32, 0.05, 0.12]} position={[0.14, segs * 0.42 - 0.1, 0]} color="#5f9e3a" cast={false} />
          </group>
        );
      })}
    </group>
  );
}

function Rickshaw({ color, length }: VehicleProps) {
  return (
    <group>
      {/* Seat and hood behind, puller out front. */}
      <Box size={[0.6, 0.3, 0.66]} position={[-length * 0.18, 0.6, 0]} color={color} />
      <Box size={[0.12, 0.6, 0.66]} position={[-length * 0.18 - 0.28, 0.9, 0]} color={color} />
      <Box size={[0.5, 0.08, 0.7]} position={[-length * 0.18 - 0.08, 1.22, 0]} color="#8b5a2b" />
      {[-1, 1].map((sz) => (
        <group key={sz}>
          <Box size={[0.5, 0.5, 0.06]} position={[-length * 0.18, 0.25, sz * 0.38]} color="#3a2a22" />
          <Box size={[0.8, 0.05, 0.05]} position={[length * 0.12, 0.62, sz * 0.24]} color="#8b5a2b" />
        </group>
      ))}
      <Legs xs={[length * 0.32]} height={0.42} color="#2b3a55" width={0.12} />
      <Box size={[0.26, 0.36, 0.34]} position={[length * 0.32, 0.6, 0]} color="#f2f2f2" />
      <Box size={[0.2, 0.2, 0.2]} position={[length * 0.32, 0.88, 0]} color="#f2c9a0" />
      <Box size={[0.44, 0.06, 0.44]} position={[length * 0.32, 1.0, 0]} color="#e3c26b" />
      <Box size={[0.16, 0.1, 0.16]} position={[length * 0.32, 1.06, 0]} color="#d9b350" />
    </group>
  );
}

function Panda({ length }: VehicleProps) {
  const white = "#f4f4f0";
  const black = "#232326";
  return (
    <group>
      <Legs xs={[-length * 0.26, length * 0.18]} height={0.36} color={black} width={0.26} />
      <Box size={[length * 0.62, 0.62, 0.78]} position={[-length * 0.04, 0.7, 0]} color={white} />
      <Box size={[0.36, 0.64, 0.8]} position={[length * 0.12, 0.7, 0]} color={black} cast={false} />
      <Box size={[0.58, 0.54, 0.6]} position={[length * 0.36, 0.92, 0]} color={white} />
      <Box size={[0.08, 0.16, 0.14]} position={[length * 0.36 + 0.27, 0.98, 0.14]} color={black} cast={false} />
      <Box size={[0.08, 0.16, 0.14]} position={[length * 0.36 + 0.27, 0.98, -0.14]} color={black} cast={false} />
      <Box size={[0.06, 0.06, 0.06]} position={[length * 0.36 + 0.3, 0.82, 0]} color={black} cast={false} />
      <Box size={[0.16, 0.16, 0.12]} position={[length * 0.34, 1.24, 0.22]} color={black} />
      <Box size={[0.16, 0.16, 0.12]} position={[length * 0.34, 1.24, -0.22]} color={black} />
      {/* A bamboo snack. */}
      <Box size={[0.06, 0.06, 0.6]} position={[length * 0.36 + 0.32, 0.74, 0]} color="#7fb34a" />
      <Box size={[0.16, 0.16, 0.14]} position={[-length * 0.38, 0.86, 0]} color={black} />
    </group>
  );
}

const LilyPad = forwardRef<Group, { length: number }>(function LilyPad({ length }, ref) {
  const pads = Math.max(1, Math.round(length / 1.0));
  const w = length / pads;
  return (
    <group ref={ref}>
      {Array.from({ length: pads }, (_, i) => {
        const x = -length / 2 + (i + 0.5) * w;
        return (
          <group key={i} position={[x, 0, 0]}>
            <Box size={[w - 0.12, 0.14, 0.78]} position={[0, -0.07, 0]} color="#4a9a4a" receive />
            <Box size={[w - 0.28, 0.14, 0.9]} position={[0, -0.07, 0]} color="#4a9a4a" receive />
            <Box size={[0.3, 0.02, 0.06]} position={[0.1, 0.01, 0.18]} color="#3a7f3a" cast={false} />
            {i % 2 === 0 && (
              <group position={[-0.22, 0, -0.22]}>
                <Box size={[0.16, 0.1, 0.16]} position={[0, 0.06, 0]} color="#f8bbd0" />
                <Box size={[0.08, 0.06, 0.08]} position={[0, 0.13, 0]} color="#ffe082" cast={false} />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
});

// ---- Candy -------------------------------------------------------------------------

const CANDY = ["#ff6f91", "#7ad3f7", "#ffd166", "#9be564", "#c77dff"];

function Gumdrop({ variant }: { variant: number }) {
  const c = CANDY[variant % CANDY.length];
  return (
    <group>
      <Box size={[0.66, 0.3, 0.66]} position={[0, 0.15, 0]} color={c} />
      <Box size={[0.48, 0.2, 0.48]} position={[0, 0.4, 0]} color={c} />
      <Box size={[0.26, 0.12, 0.26]} position={[0, 0.56, 0]} color={c} />
      {[
        [0.2, 0.32, 0.25],
        [-0.22, 0.2, -0.3],
        [0.06, 0.52, -0.12],
      ].map(([x, y, z], i) => (
        <Box key={i} size={[0.05, 0.05, 0.05]} position={[x, y, z]} color="#ffffff" cast={false} />
      ))}
    </group>
  );
}

function CandyCane() {
  const segs = 6;
  return (
    <group>
      {Array.from({ length: segs }, (_, k) => (
        <Box key={k} size={[0.16, 0.2, 0.16]} position={[0, 0.1 + k * 0.2, 0]} color={k % 2 ? "#ffffff" : "#e53945"} />
      ))}
      <Box size={[0.2, 0.16, 0.16]} position={[0.12, 1.28, 0]} color="#e53945" />
      <Box size={[0.18, 0.16, 0.16]} position={[0.3, 1.24, 0]} color="#ffffff" />
      <Box size={[0.16, 0.2, 0.16]} position={[0.38, 1.08, 0]} color="#e53945" />
      <Box size={[0.5, 0.06, 0.5]} position={[0, 0.03, 0]} color="#ffffff" cast={false} />
    </group>
  );
}

function Lollipop({ variant }: { variant: number }) {
  const a = CANDY[variant % CANDY.length];
  const b = CANDY[(variant + 2) % CANDY.length];
  return (
    <group>
      <Box size={[0.08, 1.3, 0.08]} position={[0, 0.65, 0]} color="#fdf6ec" />
      {/* A chunky round candy disc built from a cross of slabs, with a swirl. */}
      <Box size={[0.9, 0.56, 0.26]} position={[0, 1.6, 0]} color={a} />
      <Box size={[0.56, 0.9, 0.26]} position={[0, 1.6, 0]} color={a} />
      <Box size={[0.76, 0.76, 0.26]} position={[0, 1.6, 0]} color={a} />
      <Box size={[0.5, 0.5, 0.28]} position={[0, 1.6, 0]} color="#ffffff" />
      <Box size={[0.3, 0.3, 0.3]} position={[0, 1.6, 0]} color={b} />
      <Box size={[0.1, 0.1, 0.32]} position={[0, 1.6, 0]} color="#ffffff" />
    </group>
  );
}

function GummyBear({ color, length }: VehicleProps) {
  // Gummies are a little see-through, so they glow faintly.
  return (
    <group>
      <Legs xs={[-length * 0.12, length * 0.12]} height={0.24} color={color} width={0.18} />
      <Box size={[length * 0.4, 0.5, 0.46]} position={[0, 0.5, 0]} color={color} glow={0.35} />
      <Box size={[0.4, 0.38, 0.42]} position={[length * 0.08, 0.92, 0]} color={color} glow={0.35} />
      <Box size={[0.12, 0.12, 0.1]} position={[length * 0.04, 1.14, 0.16]} color={color} glow={0.35} />
      <Box size={[0.12, 0.12, 0.1]} position={[length * 0.04, 1.14, -0.16]} color={color} glow={0.35} />
      <Box size={[0.14, 0.12, 0.2]} position={[length * 0.08 + 0.24, 0.86, 0]} color={color} glow={0.35} />
      <Box size={[0.05, 0.06, 0.05]} position={[length * 0.08 + 0.21, 0.98, 0.1]} color="#2b1b2e" cast={false} />
      <Box size={[0.05, 0.06, 0.05]} position={[length * 0.08 + 0.21, 0.98, -0.1]} color="#2b1b2e" cast={false} />
      <Box size={[0.14, 0.26, 0.12]} position={[length * 0.2, 0.56, 0.28]} color={color} glow={0.35} />
      <Box size={[0.14, 0.26, 0.12]} position={[length * 0.2, 0.56, -0.28]} color={color} glow={0.35} />
    </group>
  );
}

function CakeTruck({ color, length }: VehicleProps) {
  const cab = 0.7;
  const back = -cab / 2;
  return (
    <group>
      <Box size={[length, 0.3, 0.86]} position={[0, 0.32, 0]} color="#fdf6ec" />
      <Box size={[cab, 0.6, 0.84]} position={[length / 2 - cab / 2, 0.75, 0]} color={color} />
      <Box size={[0.06, 0.3, 0.7]} position={[length / 2, 0.86, 0]} color="#2c3e50" />
      {/* A three-layer cake on the flatbed. */}
      <Box size={[1.4, 0.36, 0.78]} position={[back - 0.12, 0.65, 0]} color="#8b5a3c" />
      <Box size={[1.42, 0.06, 0.8]} position={[back - 0.12, 0.85, 0]} color="#fdf6ec" />
      <Box size={[1.0, 0.3, 0.6]} position={[back - 0.12, 1.03, 0]} color="#f8bbd0" />
      <Box size={[0.6, 0.24, 0.42]} position={[back - 0.12, 1.3, 0]} color="#fdf6ec" />
      <Box size={[0.16, 0.16, 0.16]} position={[back - 0.12, 1.5, 0]} color="#e53945" />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, 0.28]} color="#fff6b0" glow={2.5} />
      <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.45, -0.28]} color="#fff6b0" glow={2.5} />
      {[-length * 0.3, length * 0.3].map((x) =>
        [-1, 1].map((sz) => (
          <Box key={`${x}${sz}`} size={[0.32, 0.3, 0.1]} position={[x, 0.15, sz * 0.44]} color="#e53945" />
        )),
      )}
    </group>
  );
}

const Wafer = forwardRef<Group, { length: number }>(function Wafer({ length }, ref) {
  const ridges = Math.max(2, Math.round(length * 3));
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.1, 0.76]} position={[0, -0.21, 0]} color="#d9a05b" receive />
      <Box size={[length - 0.1, 0.08, 0.74]} position={[0, -0.12, 0]} color="#fdf6ec" receive />
      <Box size={[length - 0.08, 0.1, 0.76]} position={[0, -0.04, 0]} color="#e3b06e" receive />
      {Array.from({ length: ridges }, (_, i) => (
        <Box
          key={i}
          size={[0.04, 0.02, 0.72]}
          position={[-length / 2 + (i + 0.5) * (length / ridges), 0.02, 0]}
          color="#c98d4a"
          cast={false}
        />
      ))}
    </group>
  );
});

// ---- Lookups -----------------------------------------------------------------------

export function moreObstacle(biome: BiomeId, height: number, variant: number): React.ReactNode | null {
  switch (biome) {
    case "autumn":
      return height === 1 ? <LeafPile variant={variant} /> : height === 2 ? <StumpMushrooms /> : <MapleTree variant={variant} />;
    case "bamboo":
      return height === 1 ? <StoneLantern /> : height === 2 ? <BonsaiPine /> : <BambooCluster variant={variant} />;
    case "candy":
      return height === 1 ? <Gumdrop variant={variant} /> : height === 2 ? <CandyCane /> : <Lollipop variant={variant} />;
    default:
      return null;
  }
}

export function moreVehicle(biome: BiomeId, big: boolean, props: VehicleProps): React.ReactNode | null {
  switch (biome) {
    case "autumn":
      return big ? <Bear {...props} /> : <Fox {...props} />;
    case "bamboo":
      return big ? <Panda {...props} /> : <Rickshaw {...props} />;
    case "candy":
      return big ? <CakeTruck {...props} /> : <GummyBear {...props} />;
    default:
      return null;
  }
}

export const MoreFloater = { autumn: LeafyLog, bamboo: LilyPad, candy: Wafer } as const;
