"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { DirectionalLight, Group, OrthographicCamera } from "three";
import { COLS, HOP_HEIGHT, ROWS_AHEAD, ROWS_BEHIND } from "@/game/config";
import type { Engine } from "@/game/engine";
import { LaneView } from "./Lanes";
import { Chicken, Eagle } from "./models";

// Camera sits behind, above and slightly to the right of the action, like the original.
const CAMERA_OFFSET: [number, number, number] = [3.2, 11, 7.5];
const EAGLE_REACH = 0.7;

function Player({ engine }: { engine: Engine }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  useFrame((_, dt) => {
    const p = engine.player;
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;

    const x = p.x;
    let y = p.y * HOP_HEIGHT;
    let z = -p.z;
    let sx = 1;
    let sy = 1;
    let sz = 1;

    // Little squash and stretch while hopping.
    if (p.hop) {
      const t = Math.min(1, p.hop.t);
      sy = 1 + Math.sin(Math.PI * t) * 0.15;
      sx = sz = 1 - Math.sin(Math.PI * t) * 0.08;
    }

    const death = p.death;
    if (death) {
      if (death.kind === "car") {
        sy = 0.12;
        sx = sz = 1.35;
        y = 0;
      } else if (death.kind === "train") {
        sx = 0.15;
        sz = 1.3;
        y = 0;
      } else if (death.kind === "water") {
        y = -Math.min(1.2, death.t * 1.6);
      } else if (death.kind === "eagle" && engine.eagle && engine.eagle.t > EAGLE_REACH) {
        const e = eaglePosition(engine);
        z = e.z;
        y = e.y - 0.9;
      }
    }

    g.position.set(x, y, z);
    b.scale.set(sx, sy, sz);
    // Turn towards the facing direction along the shortest arc.
    let diff = p.facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 25);
  });
  return (
    <group ref={root}>
      <group ref={body}>
        <Chicken />
      </group>
    </group>
  );
}

function eaglePosition(engine: Engine) {
  const e = engine.eagle!;
  const p = engine.player;
  // Swoop in from ahead, grab the chicken, keep flying off the bottom of the screen.
  const travel = (e.startZ - p.z) / EAGLE_REACH;
  const row = e.startZ - e.t * travel;
  return { x: p.x, y: 1.8, z: -row };
}

function EagleView({ engine }: { engine: Engine }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.visible = !!engine.eagle;
    if (!engine.eagle) return;
    const e = eaglePosition(engine);
    ref.current.position.set(e.x, e.y, e.z);
  });
  return (
    <group ref={ref} visible={false}>
      <Eagle />
    </group>
  );
}

/** Darkens the ground outside the playable columns, like the original's side shading. */
function EdgeShade({ engine }: { engine: Engine }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.z = -engine.focus;
  });
  const depth = (ROWS_AHEAD + ROWS_BEHIND) * 2;
  return (
    <group ref={ref}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (COLS + 0.5 + 10), 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, depth]} />
          <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig({ engine }: { engine: Engine }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const light = useRef<DirectionalLight>(null);

  useEffect(() => {
    // Show roughly 9 columns across on phones and a wider slice of the world on big screens.
    camera.zoom = Math.min(size.width / 9, size.height / 12.5);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  useFrame((_, dt) => {
    engine.update(dt);
    const fx = engine.cameraX;
    const fz = -engine.focus - 1.5;
    camera.position.set(fx + CAMERA_OFFSET[0], CAMERA_OFFSET[1], fz + CAMERA_OFFSET[2]);
    camera.lookAt(fx, 0, fz);
    const l = light.current;
    if (l) {
      l.position.set(fx - 4, 12, fz + 6);
      l.target.position.set(fx, 0, fz);
      l.target.updateMatrixWorld();
    }
  });

  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-16}
      shadow-camera-right={16}
      shadow-camera-top={16}
      shadow-camera-bottom={-16}
      shadow-camera-near={0.5}
      shadow-camera-far={40}
      shadow-bias={-0.0005}
    />
  );
}

export function Scene({ engine }: { engine: Engine }) {
  const [, setVersion] = useState(0);
  const seen = useRef(engine.laneVersion);
  // Re-render the lane list only when lanes are added or dropped.
  useFrame(() => {
    if (engine.laneVersion !== seen.current) {
      seen.current = engine.laneVersion;
      setVersion(engine.laneVersion);
    }
  });

  const lanes = Array.from(engine.lanes.values());
  return (
    <>
      <color attach="background" args={["#7fd0f5"]} />
      <hemisphereLight args={["#ffffff", "#9bbf7a", 1.4]} />
      <CameraRig engine={engine} />
      {lanes.map((lane) => (
        <LaneView key={lane.row} lane={lane} />
      ))}
      <EdgeShade engine={engine} />
      <Player engine={engine} />
      <EagleView engine={engine} />
    </>
  );
}
