"use client";

import { memo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { Color, MeshBasicMaterial as BasicMaterial, Object3D, PlaneGeometry, SphereGeometry } from "three";
import { COLS, FORESIGHT_STEPS, LANE_WIDTH, TRAIN_SPEED, WRAP } from "@/game/config";
import type { Engine } from "@/game/engine";
import type { Lane } from "@/game/lanes";
import { trainLength } from "@/game/lanes";
import { BIOMES, type BiomeId } from "@/game/biomes";
import { Floater, Obstacle, Vehicle } from "./biomeModels";
import { Baked, Box, PickupModel, Train } from "./models";
import { CoinArt } from "./CurrencyArt";
import { ART_POWERUPS, PickupArt } from "./PowerupArt";
import { ChestArt } from "./ChestArt";
import { groundTexture, type GroundTexture } from "./textures";

function Ground({
  color,
  texture,
  top = 0,
  depth = 0.6,
  glow = false,
}: {
  color: string;
  texture: GroundTexture;
  top?: number;
  depth?: number;
  /** Self-lit and bright enough to bloom, for lava. */
  glow?: boolean;
}) {
  return (
    <mesh position={[0, top - depth / 2, 0]} receiveShadow>
      <boxGeometry args={[LANE_WIDTH, depth, 1]} />
      {glow ? (
        <meshBasicMaterial color={new Color(color).multiplyScalar(2.2)} map={groundTexture(texture)} toneMapped={false} />
      ) : (
        <meshLambertMaterial color={color} map={groundTexture(texture)} />
      )}
    </mesh>
  );
}

const GRASS_TEXTURE: Record<BiomeId, GroundTexture> = {
  meadow: "grass",
  farm: "grass",
  safari: "grass",
  savannah: "grass",
  desert: "sand",
  beach: "sand",
  jungle: "grass",
  city: "tiles",
  spooky: "grass",
  volcano: "ash",
  northpole: "snow",
  underwater: "sand",
};

function GrassLane({ lane }: { lane: Lane }) {
  // Re-bake when a lumberjack chops a tree down.
  const [count, setCount] = useState(lane.trees.length);
  useFrame(() => {
    if (lane.trees.length !== count) setCount(lane.trees.length);
  });
  return (
    <>
      <Ground color={BIOMES[lane.biome].grass[((lane.row % 2) + 2) % 2]} texture={GRASS_TEXTURE[lane.biome]} />
      <Baked version={count}>
        {lane.trees.map((t) => (
          <group key={t.x} position={[t.x, 0, 0]}>
            <Obstacle biome={lane.biome} height={t.height} variant={Math.abs(t.x + lane.row)} />
          </group>
        ))}
      </Baked>
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
      <Ground color={BIOMES[lane.biome].road} texture="road" top={-0.02} />
      {lane.continued && (
        <Baked shadows={false}>
          {Array.from({ length: Math.floor(LANE_WIDTH / 2) }, (_, i) => (
            <Box
              key={i}
              size={[0.7, 0.02, 0.08]}
              position={[-LANE_WIDTH / 2 + i * 2 + 1, -0.01, 0.5]}
              color={BIOMES[lane.biome].marking}
              cast={false}
            />
          ))}
        </Baked>
      )}
      {lane.movers.map((m, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Baked>
            <Vehicle biome={lane.biome} kind={m.kind} color={m.color} length={m.length} dir={dir} />
          </Baked>
        </group>
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
      <Ground color={BIOMES[lane.biome].water} texture="water" top={-0.28} depth={0.4} glow={lane.biome === "volcano"} />
      <group ref={bob}>
        {lane.movers.map((m, i) => (
          <group key={i} ref={(g) => void (refs.current[i] = g)}>
            <Baked>
              <Floater biome={lane.biome} length={m.length} />
            </Baked>
          </group>
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
      // Over-bright red while flashing so the warning light blooms.
      const m = light.current.material as MeshBasicMaterial;
      if (on) m.color.setRGB(4, 0.35, 0.25);
      else m.color.set("#5a1d1d");
    }
  });
  return (
    <>
      <Ground color={BIOMES[lane.biome].railBed} texture="gravel" top={-0.02} />
      <Baked shadows={false}>
        {Array.from({ length: Math.floor(LANE_WIDTH / 0.8) }, (_, i) => (
          <Box
            key={i}
            size={[0.22, 0.05, 0.86]}
            position={[-LANE_WIDTH / 2 + i * 0.8 + 0.4, 0.0, 0]}
            color="#6b4a2f"
            cast={false}
          />
        ))}
        <Box size={[LANE_WIDTH, 0.08, 0.08]} position={[0, 0.06, 0.26]} color="#c9ccd1" cast={false} />
        <Box size={[LANE_WIDTH, 0.08, 0.08]} position={[0, 0.06, -0.26]} color="#c9ccd1" cast={false} />
      </Baked>
      <group position={[-(COLS + 1.4) * dir, 0, -0.42]}>
        <Baked>
          <Box size={[0.12, 1.4, 0.12]} position={[0, 0.7, 0]} color="#d0d0d0" />
          <Box size={[0.36, 0.3, 0.2]} position={[0, 1.45, 0]} color="#222" />
        </Baked>
        <mesh ref={light} position={[0, 1.45, 0.11]}>
          <boxGeometry args={[0.18, 0.18, 0.04]} />
          <meshBasicMaterial color="#5a1d1d" toneMapped={false} />
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
    const on = engine.foresight;
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
      {ART_POWERUPS[pickup.kind] ? (
        <PickupArt kind={pickup.kind} />
      ) : (
        <Baked>
          <PickupModel kind={pickup.kind} />
        </Baked>
      )}
    </group>
  );
}

/** A reward chest on the road: it bobs and turns slowly so it stands out from the power-ups. */
function ChestView({ lane }: { lane: Lane }) {
  const ref = useRef<Group>(null);
  const [chest] = useState(lane.chest);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = lane.chest !== null;
    g.rotation.y = Math.sin(clock.elapsedTime * 1.5 + lane.row) * 0.6;
    g.position.y = 0.32 + Math.sin(clock.elapsedTime * 3 + lane.row) * 0.06;
  });
  if (!chest) return null;
  return (
    <group ref={ref} position={[chest.x, 0.32, 0]}>
      <group scale={0.6}>
        <ChestArt kind={chest.kind} />
      </group>
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
      <group scale={0.5}>
        <CoinArt />
      </group>
    </group>
  );
}

// A sheet of sea water over every underwater lane tints the seabed and everything on it.
const seaGeometry = new PlaneGeometry(LANE_WIDTH, 1).rotateX(-Math.PI / 2);
const seaMaterial = new BasicMaterial({ color: "#1d6fa5", transparent: true, opacity: 0.32, depthWrite: false });

// Bubbles rise from the seabed of every underwater lane to the surface sheet, wobbling as they go.
const BUBBLES = 6;
const BUBBLE_TOP = 1.85;
const bubbleGeometry = new SphereGeometry(1, 10, 8);
const bubbleMaterial = new BasicMaterial({ color: "#dff6ff", transparent: true, opacity: 0.55, depthWrite: false });
const bubbleDummy = new Object3D();

function Bubbles({ row }: { row: number }) {
  const ref = useRef<InstancedMesh>(null);
  // Seeded by the row, so each lane keeps its own bubbles as it scrolls back into view.
  const [seeds] = useState(() =>
    Array.from({ length: BUBBLES }, (_, i) => {
      const r = (n: number) => {
        const v = Math.sin((row + 1) * 12.9898 + i * 78.233 + n * 37.719) * 43758.5453;
        return v - Math.floor(v);
      };
      return { x: (r(0) - 0.5) * LANE_WIDTH * 0.8, z: (r(1) - 0.5) * 0.8, speed: 0.35 + r(2) * 0.35, phase: r(3), size: 0.04 + r(4) * 0.05 };
    }),
  );
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    seeds.forEach((b, i) => {
      const life = (t * b.speed + b.phase) % 1;
      const y = 0.1 + life * (BUBBLE_TOP - 0.1);
      bubbleDummy.position.set(b.x + Math.sin(t * 3 + i) * 0.08, y, b.z + Math.cos(t * 2.5 + i) * 0.05);
      // Grow a little on the way up and pop out just under the surface.
      bubbleDummy.scale.setScalar(b.size * (0.7 + life * 0.6) * Math.min(1, (1 - life) * 12));
      bubbleDummy.updateMatrix();
      mesh.setMatrixAt(i, bubbleDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[bubbleGeometry, bubbleMaterial, BUBBLES]} frustumCulled={false} renderOrder={1} />;
}

export const LaneView = memo(function LaneView({ lane, engine }: { lane: Lane; engine: Engine }) {
  return (
    <group position={[0, 0, -lane.row]}>
      {lane.type !== "grass" && <ForesightGhosts lane={lane} engine={engine} />}
      {lane.pickup && <PickupView lane={lane} />}
      {lane.chest && <ChestView lane={lane} />}
      {(lane.type === "grass" || lane.type === "road") && <CoinView lane={lane} />}
      {lane.type === "grass" && <GrassLane lane={lane} />}
      {lane.type === "road" && <RoadLane lane={lane} />}
      {lane.type === "river" && <RiverLane lane={lane} />}
      {lane.type === "rail" && <RailLane lane={lane} />}
      {lane.biome === "underwater" && <Bubbles row={lane.row} />}
      {lane.biome === "underwater" && <mesh geometry={seaGeometry} material={seaMaterial} position={[0, 1.9, 0]} renderOrder={2} />}
    </group>
  );
});
