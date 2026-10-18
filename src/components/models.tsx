"use client";

import { forwardRef } from "react";
import type { Group } from "three";
import { TRAIN_CAR_LENGTH } from "@/game/config";

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
