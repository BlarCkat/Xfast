"use client";

import { forwardRef } from "react";
import type { Group } from "three";
import { TRAIN_CAR_LENGTH } from "@/game/config";
import type { PickupKind } from "@/game/lanes";
import type { CharacterId } from "@/game/wallet";

// Small voxel models built from boxes. Everything uses flat Lambert shading for the toy look.

type BoxProps = {
  size: [number, number, number];
  position?: [number, number, number];
  color: string;
  cast?: boolean;
  receive?: boolean;
};

export function Box({ size, position = [0, 0, 0], color, cast = true, receive = false }: BoxProps) {
  return (
    <mesh position={position} castShadow={cast} receiveShadow={receive}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** The chicken faces -z when rotation is 0. */
export function Chicken() {
  return (
    <group>
      <Box size={[0.56, 0.5, 0.56]} position={[0, 0.4, 0.04]} color="#ffffff" />
      <Box size={[0.42, 0.34, 0.4]} position={[0, 0.78, -0.08]} color="#ffffff" />
      <Box size={[0.12, 0.14, 0.24]} position={[0, 1.02, -0.06]} color="#e94f37" />
      <Box size={[0.14, 0.1, 0.16]} position={[0, 0.74, -0.34]} color="#f49d37" />
      <Box size={[0.1, 0.12, 0.06]} position={[0, 0.6, -0.31]} color="#e94f37" />
      <Box size={[0.06, 0.08, 0.06]} position={[0.16, 0.84, -0.28]} color="#222222" />
      <Box size={[0.06, 0.08, 0.06]} position={[-0.16, 0.84, -0.28]} color="#222222" />
      <Box size={[0.08, 0.2, 0.3]} position={[0.31, 0.42, 0.06]} color="#f2f2f2" />
      <Box size={[0.08, 0.2, 0.3]} position={[-0.31, 0.42, 0.06]} color="#f2f2f2" />
      <Box size={[0.3, 0.16, 0.12]} position={[0, 0.5, 0.35]} color="#f2f2f2" />
      <Box size={[0.08, 0.16, 0.08]} position={[0.12, 0.08, 0]} color="#f49d37" />
      <Box size={[0.08, 0.16, 0.08]} position={[-0.12, 0.08, 0]} color="#f49d37" />
    </group>
  );
}

export function Tree({ height }: { height: number }) {
  const leaves = 0.35 + height * 0.3;
  return (
    <group>
      <Box size={[0.3, 0.35, 0.3]} position={[0, 0.17, 0]} color="#7a4b2a" />
      <Box size={[0.78, leaves, 0.78]} position={[0, 0.35 + leaves / 2, 0]} color="#4f9d2f" />
      <Box size={[0.6, 0.12, 0.6]} position={[0, 0.41 + leaves, 0]} color="#62b83c" />
    </group>
  );
}

export const Car = forwardRef<Group, { color: string; length: number; dir: number }>(function Car(
  { color, length, dir },
  ref,
) {
  return (
    <group ref={ref}>
      <group scale={[dir, 1, 1]}>
        <Box size={[length, 0.42, 0.82]} position={[0, 0.33, 0]} color={color} />
        <Box size={[length * 0.55, 0.32, 0.72]} position={[-length * 0.08, 0.7, 0]} color="#f4f4f4" />
        <Box size={[length * 0.5, 0.22, 0.74]} position={[-length * 0.08, 0.7, 0]} color="#2c3e50" />
        <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.38, 0.25]} color="#fff6b0" />
        <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.38, -0.25]} color="#fff6b0" />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <Box
              key={`${sx}${sz}`}
              size={[0.3, 0.26, 0.1]}
              position={[sx * length * 0.3, 0.13, sz * 0.42]}
              color="#222"
            />
          )),
        )}
      </group>
    </group>
  );
});

export const Truck = forwardRef<Group, { color: string; length: number; dir: number }>(function Truck(
  { color, length, dir },
  ref,
) {
  const cab = 0.7;
  return (
    <group ref={ref}>
      <group scale={[dir, 1, 1]}>
        <Box size={[cab, 0.8, 0.84]} position={[length / 2 - cab / 2, 0.5, 0]} color="#e94f37" />
        <Box size={[0.06, 0.28, 0.7]} position={[length / 2, 0.68, 0]} color="#2c3e50" />
        <Box size={[length - cab - 0.06, 1.0, 0.9]} position={[-cab / 2, 0.62, 0]} color={color} />
        {[-0.35, 0.15, length / 2 - 0.35].map((x) =>
          [-1, 1].map((sz) => (
            <Box key={`${x}${sz}`} size={[0.3, 0.28, 0.1]} position={[x, 0.14, sz * 0.44]} color="#222" />
          )),
        )}
      </group>
    </group>
  );
});

export const Log = forwardRef<Group, { length: number }>(function Log({ length }, ref) {
  return (
    <group ref={ref}>
      <Box size={[length - 0.08, 0.3, 0.76]} position={[0, -0.15, 0]} color="#8b5a2b" receive />
      <Box size={[length - 0.3, 0.04, 0.6]} position={[0, 0.01, 0]} color="#9c6a38" cast={false} receive />
      <Box size={[0.06, 0.26, 0.66]} position={[length / 2 - 0.04, -0.15, 0]} color="#c49a6c" />
      <Box size={[0.06, 0.26, 0.66]} position={[-length / 2 + 0.04, -0.15, 0]} color="#c49a6c" />
    </group>
  );
});

const TRAIN_COLORS = ["#d64545", "#3a7bd5", "#f2b134", "#4caf50"];

export const Train = forwardRef<Group, { cars: number; dir: number }>(function Train({ cars, dir }, ref) {
  const total = cars * TRAIN_CAR_LENGTH;
  return (
    <group ref={ref}>
      <group scale={[dir, 1, 1]}>
        {Array.from({ length: cars }, (_, i) => {
          const x = total / 2 - TRAIN_CAR_LENGTH * (i + 0.5);
          const color = i === 0 ? "#d64545" : TRAIN_COLORS[(i % (TRAIN_COLORS.length - 1)) + 1];
          return (
            <group key={i} position={[x, 0, 0]}>
              <Box size={[TRAIN_CAR_LENGTH - 0.2, 1.1, 0.9]} position={[0, 0.7, 0]} color={color} />
              <Box size={[TRAIN_CAR_LENGTH - 0.4, 0.12, 0.92]} position={[0, 1.0, 0]} color="#f4f4f4" />
              <Box size={[TRAIN_CAR_LENGTH - 0.4, 0.2, 0.7]} position={[0, 0.1, 0]} color="#333" />
              {i === 0 && (
                <>
                  <Box size={[0.08, 0.3, 0.6]} position={[TRAIN_CAR_LENGTH / 2 - 0.12, 0.9, 0]} color="#2c3e50" />
                  <Box size={[0.08, 0.14, 0.2]} position={[TRAIN_CAR_LENGTH / 2 - 0.1, 0.45, 0]} color="#fff6b0" />
                </>
              )}
            </group>
          );
        })}
      </group>
    </group>
  );
});

export function Eagle() {
  return (
    <group>
      <Box size={[0.5, 0.4, 1.0]} position={[0, 0, 0]} color="#5b3a1e" />
      <Box size={[0.4, 0.36, 0.36]} position={[0, 0.1, 0.62]} color="#ffffff" />
      <Box size={[0.14, 0.12, 0.2]} position={[0, 0.06, 0.88]} color="#f6c90e" />
      <Box size={[2.6, 0.08, 0.6]} position={[0, 0.12, 0]} color="#6d4626" />
      <Box size={[0.4, 0.06, 0.4]} position={[0, 0.02, -0.66]} color="#6d4626" />
    </group>
  );
}

/** Collectibles: a heart for lives, and one icon per power-up. */
export function PickupModel({ kind }: { kind: PickupKind }) {
  if (kind === "life") {
    return (
      <group scale={0.9}>
        <Box size={[0.22, 0.22, 0.16]} position={[-0.12, 0.1, 0]} color="#ff4d6d" />
        <Box size={[0.22, 0.22, 0.16]} position={[0.12, 0.1, 0]} color="#ff4d6d" />
        <Box size={[0.36, 0.18, 0.16]} position={[0, -0.04, 0]} color="#ff4d6d" />
        <Box size={[0.16, 0.12, 0.16]} position={[0, -0.16, 0]} color="#ff4d6d" />
        <Box size={[0.08, 0.08, 0.17]} position={[-0.15, 0.15, 0]} color="#ffb3c1" cast={false} />
      </group>
    );
  }
  if (kind === "foresight") {
    return (
      <group>
        <Box size={[0.46, 0.3, 0.16]} position={[0, 0, 0]} color="#8e5cf7" />
        <Box size={[0.3, 0.2, 0.18]} position={[0, 0, 0]} color="#ffffff" cast={false} />
        <Box size={[0.12, 0.12, 0.2]} position={[0, 0, 0]} color="#2b1b4f" cast={false} />
      </group>
    );
  }
  if (kind === "magnet") {
    return (
      <group>
        <Box size={[0.12, 0.34, 0.14]} position={[-0.16, 0.02, 0]} color="#d63c3c" />
        <Box size={[0.12, 0.34, 0.14]} position={[0.16, 0.02, 0]} color="#d63c3c" />
        <Box size={[0.44, 0.12, 0.14]} position={[0, -0.18, 0]} color="#d63c3c" />
        <Box size={[0.12, 0.1, 0.15]} position={[-0.16, 0.22, 0]} color="#e0e0e0" />
        <Box size={[0.12, 0.1, 0.15]} position={[0.16, 0.22, 0]} color="#e0e0e0" />
      </group>
    );
  }
  if (kind === "double") {
    return (
      <group>
        <group position={[-0.1, 0.06, -0.06]}>
          <Coin />
        </group>
        <group position={[0.1, -0.06, 0.06]}>
          <Coin />
        </group>
      </group>
    );
  }
  if (kind === "superhop") {
    return (
      <group>
        <Box size={[0.14, 0.3, 0.14]} position={[0, -0.08, 0]} color="#2e9e4f" />
        <Box size={[0.4, 0.1, 0.14]} position={[0, 0.1, 0]} color="#2e9e4f" />
        <Box size={[0.24, 0.1, 0.14]} position={[0, 0.2, 0]} color="#2e9e4f" />
        <Box size={[0.1, 0.1, 0.14]} position={[0, 0.3, 0]} color="#2e9e4f" />
      </group>
    );
  }
  if (kind === "shield") {
    return (
      <group>
        <Box size={[0.4, 0.42, 0.12]} position={[0, 0.02, 0]} color="#1fa3b8" />
        <Box size={[0.24, 0.12, 0.13]} position={[0, -0.24, 0]} color="#1fa3b8" />
        <Box size={[0.08, 0.3, 0.14]} position={[0, 0.02, 0]} color="#e0f7fa" cast={false} />
      </group>
    );
  }
  if (kind === "freeze") {
    return (
      <group>
        <Box size={[0.12, 0.5, 0.12]} position={[0, 0, 0]} color="#bfe9ff" />
        <Box size={[0.5, 0.12, 0.12]} position={[0, 0, 0]} color="#bfe9ff" />
        <group rotation={[0, 0, Math.PI / 4]}>
          <Box size={[0.1, 0.42, 0.1]} position={[0, 0, 0]} color="#5bc0eb" />
          <Box size={[0.42, 0.1, 0.1]} position={[0, 0, 0]} color="#5bc0eb" />
        </group>
      </group>
    );
  }
  if (kind === "wings") {
    return <Wings />;
  }
  if (kind === "scarecrow") {
    return (
      <group>
        <Box size={[0.06, 0.5, 0.06]} position={[0, -0.04, 0]} color="#7a4b2a" />
        <Box size={[0.44, 0.06, 0.06]} position={[0, 0.06, 0]} color="#7a4b2a" />
        <Box size={[0.2, 0.18, 0.18]} position={[0, 0.24, 0]} color="#f2d18b" />
        <Box size={[0.34, 0.04, 0.3]} position={[0, 0.34, 0]} color="#c8a04a" />
        <Box size={[0.18, 0.1, 0.16]} position={[0, 0.4, 0]} color="#c8a04a" />
      </group>
    );
  }
  if (kind === "ghost") {
    return (
      <group>
        <Box size={[0.4, 0.42, 0.3]} position={[0, 0.02, 0]} color="#f3efff" />
        <Box size={[0.3, 0.12, 0.3]} position={[0, 0.28, 0]} color="#f3efff" />
        <Box size={[0.1, 0.1, 0.12]} position={[-0.2, -0.24, 0]} color="#f3efff" />
        <Box size={[0.1, 0.1, 0.12]} position={[0.02, -0.24, 0]} color="#f3efff" />
        <Box size={[0.06, 0.1, 0.04]} position={[-0.08, 0.08, -0.16]} color="#2b1b4f" cast={false} />
        <Box size={[0.06, 0.1, 0.04]} position={[0.08, 0.08, -0.16]} color="#2b1b4f" cast={false} />
      </group>
    );
  }
  if (kind === "tiny") {
    return (
      <group>
        <Box size={[0.16, 0.16, 0.16]} position={[0, 0, 0]} color="#f28fb1" />
        {[-1, 1].map((sx) =>
          [-1, 1].map((sy) => (
            <Box key={`${sx}${sy}`} size={[0.1, 0.1, 0.1]} position={[sx * 0.2, sy * 0.2, 0]} color="#ffffff" />
          )),
        )}
      </group>
    );
  }
  if (kind === "lumberjack") {
    return (
      <group rotation={[0, 0, -0.5]}>
        <Box size={[0.08, 0.56, 0.08]} position={[0, -0.04, 0]} color="#8b5a2b" />
        <Box size={[0.26, 0.18, 0.06]} position={[0.1, 0.18, 0]} color="#c9ccd1" />
        <Box size={[0.06, 0.18, 0.07]} position={[0.22, 0.18, 0]} color="#eef2f6" />
      </group>
    );
  }
  if (kind === "warp") {
    return (
      <group>
        <Box size={[0.44, 0.08, 0.1]} position={[0, 0.2, 0]} color="#3f51b5" />
        <Box size={[0.44, 0.08, 0.1]} position={[0, -0.2, 0]} color="#3f51b5" />
        <Box size={[0.08, 0.44, 0.1]} position={[0.2, 0, 0]} color="#3f51b5" />
        <Box size={[0.08, 0.44, 0.1]} position={[-0.2, 0, 0]} color="#3f51b5" />
        <Box size={[0.24, 0.24, 0.06]} position={[0, 0, 0]} color="#9fa8ff" cast={false} />
      </group>
    );
  }
  if (kind === "coinrain") {
    return (
      <group scale={0.75}>
        <group position={[-0.22, 0.12, 0]}>
          <Coin />
        </group>
        <group position={[0.22, 0.18, 0]}>
          <Coin />
        </group>
        <group position={[0, -0.18, 0]}>
          <Coin />
        </group>
      </group>
    );
  }
  if (kind === "slowmo") {
    return (
      <group>
        <Box size={[0.36, 0.06, 0.36]} position={[0, 0.22, 0]} color="#2f6fb5" />
        <Box size={[0.36, 0.06, 0.36]} position={[0, -0.22, 0]} color="#2f6fb5" />
        <Box size={[0.24, 0.14, 0.24]} position={[0, 0.12, 0]} color="#8fd3ff" />
        <Box size={[0.08, 0.1, 0.08]} position={[0, 0, 0]} color="#8fd3ff" />
        <Box size={[0.24, 0.14, 0.24]} position={[0, -0.12, 0]} color="#ffe08a" />
      </group>
    );
  }
  return (
    <group>
      <Box size={[0.42, 0.34, 0.38]} position={[0, -0.02, 0]} color="#8d8f94" />
      <Box size={[0.26, 0.16, 0.26]} position={[0.04, 0.2, -0.02]} color="#a7a9ad" />
      <Box size={[0.12, 0.1, 0.12]} position={[-0.14, 0.12, 0.12]} color="#6f7177" />
    </group>
  );
}

/** Stone shell the chicken wears while the rock power-up is active. */
export function RockShell() {
  return (
    <group>
      <Box size={[0.74, 0.62, 0.74]} position={[0, 0.36, 0.02]} color="#8d8f94" />
      <Box size={[0.5, 0.36, 0.5]} position={[0.04, 0.82, -0.04]} color="#a7a9ad" />
      <Box size={[0.24, 0.2, 0.24]} position={[-0.22, 0.6, 0.26]} color="#6f7177" />
      <Box size={[0.06, 0.08, 0.06]} position={[0.14, 0.84, -0.3]} color="#222222" />
      <Box size={[0.06, 0.08, 0.06]} position={[-0.06, 0.84, -0.3]} color="#222222" />
    </group>
  );
}

export function Duck() {
  return (
    <group>
      <Box size={[0.56, 0.46, 0.6]} position={[0, 0.36, 0.04]} color="#ffd93b" />
      <Box size={[0.4, 0.34, 0.38]} position={[0, 0.74, -0.1]} color="#ffd93b" />
      <Box size={[0.3, 0.08, 0.2]} position={[0, 0.66, -0.36]} color="#f49d37" />
      <Box size={[0.06, 0.08, 0.06]} position={[0.15, 0.82, -0.29]} color="#222222" />
      <Box size={[0.06, 0.08, 0.06]} position={[-0.15, 0.82, -0.29]} color="#222222" />
      <Box size={[0.08, 0.18, 0.3]} position={[0.31, 0.38, 0.06]} color="#f2c522" />
      <Box size={[0.08, 0.18, 0.3]} position={[-0.31, 0.38, 0.06]} color="#f2c522" />
      <Box size={[0.24, 0.12, 0.12]} position={[0, 0.5, 0.38]} color="#f2c522" />
      <Box size={[0.16, 0.06, 0.2]} position={[0.12, 0.03, -0.04]} color="#f49d37" />
      <Box size={[0.16, 0.06, 0.2]} position={[-0.12, 0.03, -0.04]} color="#f49d37" />
      <Box size={[0.08, 0.1, 0.08]} position={[0.12, 0.1, 0]} color="#f49d37" />
      <Box size={[0.08, 0.1, 0.08]} position={[-0.12, 0.1, 0]} color="#f49d37" />
    </group>
  );
}

export function Frog() {
  return (
    <group>
      <Box size={[0.66, 0.36, 0.66]} position={[0, 0.26, 0]} color="#4caf50" />
      <Box size={[0.56, 0.08, 0.5]} position={[0, 0.1, -0.02]} color="#c5e1a5" />
      <Box size={[0.2, 0.2, 0.2]} position={[0.2, 0.52, -0.2]} color="#4caf50" />
      <Box size={[0.2, 0.2, 0.2]} position={[-0.2, 0.52, -0.2]} color="#4caf50" />
      <Box size={[0.14, 0.12, 0.06]} position={[0.2, 0.54, -0.3]} color="#ffffff" />
      <Box size={[0.14, 0.12, 0.06]} position={[-0.2, 0.54, -0.3]} color="#ffffff" />
      <Box size={[0.06, 0.08, 0.04]} position={[0.2, 0.54, -0.33]} color="#222222" />
      <Box size={[0.06, 0.08, 0.04]} position={[-0.2, 0.54, -0.33]} color="#222222" />
      <Box size={[0.36, 0.04, 0.04]} position={[0, 0.24, -0.34]} color="#2e7d32" />
      <Box size={[0.2, 0.14, 0.34]} position={[0.36, 0.08, 0.14]} color="#388e3c" />
      <Box size={[0.2, 0.14, 0.34]} position={[-0.36, 0.08, 0.14]} color="#388e3c" />
    </group>
  );
}

export function Penguin() {
  return (
    <group>
      <Box size={[0.56, 0.72, 0.52]} position={[0, 0.44, 0.02]} color="#263238" />
      <Box size={[0.42, 0.56, 0.06]} position={[0, 0.4, -0.25]} color="#fafafa" />
      <Box size={[0.42, 0.24, 0.44]} position={[0, 0.9, -0.02]} color="#263238" />
      <Box size={[0.32, 0.14, 0.06]} position={[0, 0.88, -0.25]} color="#fafafa" />
      <Box size={[0.12, 0.08, 0.14]} position={[0, 0.84, -0.32]} color="#f49d37" />
      <Box size={[0.06, 0.06, 0.04]} position={[0.1, 0.92, -0.28]} color="#111111" />
      <Box size={[0.06, 0.06, 0.04]} position={[-0.1, 0.92, -0.28]} color="#111111" />
      <Box size={[0.08, 0.4, 0.26]} position={[0.32, 0.46, 0.02]} color="#1c262b" />
      <Box size={[0.08, 0.4, 0.26]} position={[-0.32, 0.46, 0.02]} color="#1c262b" />
      <Box size={[0.16, 0.06, 0.22]} position={[0.13, 0.03, -0.06]} color="#f49d37" />
      <Box size={[0.16, 0.06, 0.22]} position={[-0.13, 0.03, -0.06]} color="#f49d37" />
    </group>
  );
}

export function Robot() {
  return (
    <group>
      <Box size={[0.56, 0.5, 0.46]} position={[0, 0.42, 0.02]} color="#b0bec5" />
      <Box size={[0.26, 0.18, 0.04]} position={[0, 0.44, -0.22]} color="#ff7043" />
      <Box size={[0.44, 0.34, 0.4]} position={[0, 0.88, -0.02]} color="#cfd8dc" />
      <Box size={[0.34, 0.1, 0.04]} position={[0, 0.9, -0.23]} color="#263238" />
      <Box size={[0.08, 0.06, 0.03]} position={[0.09, 0.9, -0.255]} color="#40c4ff" cast={false} />
      <Box size={[0.08, 0.06, 0.03]} position={[-0.09, 0.9, -0.255]} color="#40c4ff" cast={false} />
      <Box size={[0.04, 0.2, 0.04]} position={[0, 1.14, -0.02]} color="#90a4ae" />
      <Box size={[0.1, 0.1, 0.1]} position={[0, 1.26, -0.02]} color="#ff5252" />
      <Box size={[0.1, 0.36, 0.12]} position={[0.34, 0.42, 0]} color="#90a4ae" />
      <Box size={[0.1, 0.36, 0.12]} position={[-0.34, 0.42, 0]} color="#90a4ae" />
      <Box size={[0.14, 0.18, 0.18]} position={[0.13, 0.09, 0]} color="#78909c" />
      <Box size={[0.14, 0.18, 0.18]} position={[-0.13, 0.09, 0]} color="#78909c" />
    </group>
  );
}

export function CharacterModel({ id }: { id: CharacterId }) {
  switch (id) {
    case "duck":
      return <Duck />;
    case "frog":
      return <Frog />;
    case "penguin":
      return <Penguin />;
    case "robot":
      return <Robot />;
    default:
      return <Chicken />;
  }
}

export function Coin() {
  return (
    <group>
      <Box size={[0.38, 0.38, 0.08]} position={[0, 0, 0]} color="#ffc928" />
      <Box size={[0.26, 0.26, 0.1]} position={[0, 0, 0]} color="#ffe27a" cast={false} />
      <Box size={[0.06, 0.16, 0.11]} position={[0, 0, 0]} color="#e0a800" cast={false} />
    </group>
  );
}

export function Wings() {
  return (
    <group>
      <Box size={[0.36, 0.06, 0.26]} position={[-0.2, 0.06, 0]} color="#ffffff" />
      <Box size={[0.24, 0.06, 0.2]} position={[-0.38, 0.12, 0.02]} color="#eef2f6" />
      <Box size={[0.36, 0.06, 0.26]} position={[0.2, 0.06, 0]} color="#ffffff" />
      <Box size={[0.24, 0.06, 0.2]} position={[0.38, 0.12, 0.02]} color="#eef2f6" />
    </group>
  );
}

/** See-through bubble around the player while the shield power-up is up. */
export function ShieldBubble() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.62, 12, 10]} />
      <meshLambertMaterial color="#7ee8f7" transparent opacity={0.35} depthWrite={false} flatShading />
    </mesh>
  );
}
