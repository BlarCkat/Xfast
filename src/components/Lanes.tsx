"use client";

import { memo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { COLS, FORESIGHT_STEPS, LANE_WIDTH, TRAIN_SPEED, WRAP } from "@/game/config";
import type { Engine } from "@/game/engine";
import type { Lane } from "@/game/lanes";
import { trainLength } from "@/game/lanes";
import { BIOMES } from "@/game/biomes";
import { Floater, Obstacle, Vehicle } from "./biomeModels";
import { Box, Coin, PickupModel, Train } from "./models";

function Ground({ color, top = 0, depth = 0.6 }: { color: string; top?: number; depth?: number }) {
  return (
    <mesh position={[0, top - depth / 2, 0]} receiveShadow>
      <boxGeometry args={[LANE_WIDTH, depth, 1]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function GrassLane({ lane }: { lane: Lane }) {
  const [trees] = useState(lane.trees);
  const refs = useRef<(Group | null)[]>([]);
  // Hide trees a lumberjack has chopped down.
  useFrame(() => {
    trees.forEach((t, i) => {
      const g = refs.current[i];
      if (g) g.visible = lane.trees.includes(t);
    });
  });
  return (
    <>
      <Ground color={BIOMES[lane.biome].grass[((lane.row % 2) + 2) % 2]} />
      {trees.map((t, i) => (
        <group key={t.x} ref={(g) => void (refs.current[i] = g)} position={[t.x, 0, 0]}>
          <Obstacle biome={lane.biome} height={t.height} variant={Math.abs(t.x + lane.row)} />
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
      if (!g) return;
      g.position.x = m.x;
      if (m.wrecked !== null) {
        // Crumple, hop up once, then disappear.
        const t = m.wrecked;
        g.scale.y = Math.max(0.3, 1 - t * 5);
        g.position.y = Math.max(0, Math.sin(Math.min(1, t * 4) * Math.PI) * 0.6);
        g.rotation.z = Math.min(0.35, t * 3);
        g.visible = t < 2.5;
      }
    });
  });
  return refs;
}

function RoadLane({ lane }: { lane: Lane }) {
  const refs = useMoverRefs(lane);
  const dir = Math.sign(lane.speed);
  return (
    <>
      <Ground color={BIOMES[lane.biome].road} top={-0.02} />
      {lane.continued &&
        Array.from({ length: Math.floor(LANE_WIDTH / 2) }, (_, i) => (
          <Box
            key={i}
            size={[0.7, 0.02, 0.08]}
            position={[-LANE_WIDTH / 2 + i * 2 + 1, -0.01, 0.5]}
            color={BIOMES[lane.biome].marking}
            cast={false}
          />
        ))}
      {lane.movers.map((m, i) => (
        <Vehicle
          key={i}
          ref={(g) => void (refs.current[i] = g)}
          biome={lane.biome}
          kind={m.kind}
          color={m.color}
          length={m.length}
          dir={dir}
        />
      ))}
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
      <Ground color={BIOMES[lane.biome].water} top={-0.28} depth={0.4} />
      <group ref={bob}>
        {lane.movers.map((m, i) => (
          <Floater key={i} ref={(g) => void (refs.current[i] = g)} biome={lane.biome} length={m.length} />
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
      <Ground color={BIOMES[lane.biome].railBed} top={-0.02} />
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
      <Train ref={train} cars={lane.train.cars} dir={dir} colors={BIOMES[lane.biome].trainColors} />
    </>
  );
}

const wrap = (x: number) => ((((x + WRAP) % (WRAP * 2)) + WRAP * 2) % (WRAP * 2)) - WRAP;

/** Translucent copies of traffic where it will be shortly, shown while foresight is active. */
function ForesightGhosts({ lane, engine }: { lane: Lane; engine: Engine }) {
  const root = useRef<Group>(null);
  const refs = useRef<(Mesh | null)[]>([]);
  const isRail = lane.type === "rail";
  const count = isRail ? 1 : lane.movers.length;
  const len = isRail ? trainLength(lane) : 0;
  const dir = Math.sign(lane.speed);

  useFrame(() => {
    const on = engine.effects.foresight > 0;
    if (root.current) root.current.visible = on;
    if (!on) return;
    FORESIGHT_STEPS.forEach((step, s) => {
      for (let i = 0; i < count; i++) {
        const mesh = refs.current[s * count + i];
        if (!mesh) continue;
        if (isRail) {
          const t = lane.train;
          let x: number | null = null;
          const speed = TRAIN_SPEED * engine.speedScale;
          if (t.active) x = t.x + dir * speed * step;
          else if (t.timer < step) x = -dir * (WRAP + len / 2) + dir * speed * (step - t.timer);
          mesh.visible = x !== null && Math.abs(x) < WRAP + len;
          if (x !== null) mesh.position.x = x;
        } else {
          const m = lane.movers[i];
          mesh.visible = m.wrecked === null;
          mesh.position.x = wrap(m.x + lane.speed * step * (lane.type === "road" ? engine.speedScale : 1));
        }
      }
    });
  });

  return (
    <group ref={root} visible={false}>
      {FORESIGHT_STEPS.map((_, s) =>
        Array.from({ length: count }, (_, i) => {
          const length = isRail ? len : lane.movers[i].length;
          const river = lane.type === "river";
          return (
            <mesh
              key={`${s}-${i}`}
              ref={(m) => void (refs.current[s * count + i] = m)}
              position={[0, river ? 0.02 : 0.45, 0]}
            >
              <boxGeometry args={[length, river ? 0.06 : 0.9, 0.8]} />
              <meshBasicMaterial
                color={river ? "#ffffff" : "#b388ff"}
                transparent
                opacity={s === 0 ? 0.45 : 0.22}
                depthWrite={false}
              />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function PickupView({ lane }: { lane: Lane }) {
  const ref = useRef<Group>(null);
  // Remember what was placed here; the lane's pickup is cleared once collected.
  const [pickup] = useState(lane.pickup);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = lane.pickup !== null;
    g.rotation.y = clock.elapsedTime * 2;
    g.position.y = 0.45 + Math.sin(clock.elapsedTime * 3 + lane.row) * 0.08;
  });
  if (!pickup) return null;
  return (
    <group ref={ref} position={[pickup.x, 0.45, 0]}>
      <PickupModel kind={pickup.kind} />
    </group>
  );
}

function CoinView({ lane }: { lane: Lane }) {
  const ref = useRef<Group>(null);
  // Coins can appear later (coin rain), so read the lane every frame.
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = lane.coin !== null;
    if (lane.coin !== null) g.position.x = lane.coin;
    g.rotation.y = clock.elapsedTime * 3 + lane.row;
  });
  return (
    <group ref={ref} position={[0, 0.35, 0]} visible={false}>
      <Coin />
    </group>
  );
}

export const LaneView = memo(function LaneView({ lane, engine }: { lane: Lane; engine: Engine }) {
  return (
    <group position={[0, 0, -lane.row]}>
      {lane.type !== "grass" && <ForesightGhosts lane={lane} engine={engine} />}
      {lane.pickup && <PickupView lane={lane} />}
      {(lane.type === "grass" || lane.type === "road") && <CoinView lane={lane} />}
      {lane.type === "grass" && <GrassLane lane={lane} />}
      {lane.type === "road" && <RoadLane lane={lane} />}
      {lane.type === "river" && <RiverLane lane={lane} />}
      {lane.type === "rail" && <RailLane lane={lane} />}
    </group>
  );
});
