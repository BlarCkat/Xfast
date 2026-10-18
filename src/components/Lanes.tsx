"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLS, LANE_WIDTH } from "@/game/config";
import type { Lane } from "@/game/lanes";
import { Box, Car, Log, Train, Tree, Truck } from "./models";

const GRASS = ["#a6e35f", "#9ad653"];
const ROAD = "#575c66";
const WATER = "#5fc6f0";
const RAIL_BED = "#8a7b6c";

function Ground({ color, top = 0, depth = 0.6 }: { color: string; top?: number; depth?: number }) {
  return (
    <mesh position={[0, top - depth / 2, 0]} receiveShadow>
      <boxGeometry args={[LANE_WIDTH, depth, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function GrassLane({ lane }: { lane: Lane }) {
  return (
    <>
      <Ground color={GRASS[((lane.row % 2) + 2) % 2]} />
      {lane.trees.map((t) => (
        <group key={t.x} position={[t.x, 0, 0]}>
          <Tree height={t.height} />
        </group>
      ))}
    </>
  );
}

function useMoverRefs(lane: Lane) {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    lane.movers.forEach((m, i) => {
      const g = refs.current[i];
      if (g) g.position.x = m.x;
    });
  });
  return refs;
}

function RoadLane({ lane }: { lane: Lane }) {
  const refs = useMoverRefs(lane);
  const dir = Math.sign(lane.speed);
  return (
    <>
      <Ground color={ROAD} top={-0.02} />
      {lane.continued &&
        Array.from({ length: Math.floor(LANE_WIDTH / 2) }, (_, i) => (
          <Box
            key={i}
            size={[0.7, 0.02, 0.08]}
            position={[-LANE_WIDTH / 2 + i * 2 + 1, -0.01, 0.5]}
            color="#e8e8e8"
            cast={false}
          />
        ))}
      {lane.movers.map((m, i) =>
        m.kind === "truck" ? (
          <Truck key={i} ref={(g) => void (refs.current[i] = g)} color={m.color} length={m.length} dir={dir} />
        ) : (
          <Car key={i} ref={(g) => void (refs.current[i] = g)} color={m.color} length={m.length} dir={dir} />
        ),
      )}
    </>
  );
}

function RiverLane({ lane }: { lane: Lane }) {
  const refs = useMoverRefs(lane);
  const bob = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (bob.current) bob.current.position.y = Math.sin(clock.elapsedTime * 2 + lane.row) * 0.02;
  });
  return (
    <>
      <Ground color={WATER} top={-0.28} depth={0.4} />
      <group ref={bob}>
        {lane.movers.map((m, i) => (
          <Log key={i} ref={(g) => void (refs.current[i] = g)} length={m.length} />
        ))}
      </group>
    </>
  );
}

function RailLane({ lane }: { lane: Lane }) {
  const train = useRef<Group>(null);
  const light = useRef<Mesh>(null);
  const dir = Math.sign(lane.speed);
  useFrame(({ clock }) => {
    const t = lane.train;
    if (train.current) {
      train.current.visible = t.active;
      train.current.position.x = t.x;
    }
    if (light.current) {
      const on = t.warning && Math.floor(clock.elapsedTime * 6) % 2 === 0;
      (light.current.material as MeshBasicMaterial).color.set(on ? "#ff3b30" : "#5a1d1d");
    }
  });
  return (
    <>
      <Ground color={RAIL_BED} top={-0.02} />
      {Array.from({ length: Math.floor(LANE_WIDTH / 0.8) }, (_, i) => (
        <Box
          key={i}
          size={[0.22, 0.05, 0.86]}
          position={[-LANE_WIDTH / 2 + i * 0.8 + 0.4, 0.0, 0]}
          color="#6b4a2f"
          cast={false}
          receive
        />
      ))}
      <Box size={[LANE_WIDTH, 0.08, 0.08]} position={[0, 0.06, 0.26]} color="#c9ccd1" cast={false} />
      <Box size={[LANE_WIDTH, 0.08, 0.08]} position={[0, 0.06, -0.26]} color="#c9ccd1" cast={false} />
      <group position={[-(COLS + 1.4) * dir, 0, -0.42]}>
        <Box size={[0.12, 1.4, 0.12]} position={[0, 0.7, 0]} color="#d0d0d0" />
        <Box size={[0.36, 0.3, 0.2]} position={[0, 1.45, 0]} color="#222" />
        <mesh ref={light} position={[0, 1.45, 0.11]}>
          <boxGeometry args={[0.18, 0.18, 0.04]} />
          <meshBasicMaterial color="#5a1d1d" />
        </mesh>
      </group>
      <Train ref={train} cars={lane.train.cars} dir={dir} />
    </>
  );
}

export const LaneView = memo(function LaneView({ lane }: { lane: Lane }) {
  return (
    <group position={[0, 0, -lane.row]}>
      {lane.type === "grass" && <GrassLane lane={lane} />}
      {lane.type === "road" && <RoadLane lane={lane} />}
      {lane.type === "river" && <RiverLane lane={lane} />}
      {lane.type === "rail" && <RailLane lane={lane} />}
    </group>
  );
});
