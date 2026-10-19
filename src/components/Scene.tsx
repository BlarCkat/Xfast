"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { DirectionalLight, Group, Material, Mesh, OrthographicCamera } from "three";
import { COLS, HOP_HEIGHT, ROWS_AHEAD, ROWS_BEHIND } from "@/game/config";
import type { Engine } from "@/game/engine";
import { Effects } from "./Effects";
import { LaneView } from "./Lanes";
import { CharacterModel, Eagle, RockShell, ShieldBubble, Wings } from "./models";

// Camera sits behind, above and slightly to the right of the action, like the original.
const CAMERA_OFFSET: [number, number, number] = [3.2, 11, 7.5];
const EAGLE_REACH = 0.7;

function Player({ engine }: { engine: Engine }) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const chicken = useRef<Group>(null);
  const rock = useRef<Group>(null);
  const bubble = useRef<Group>(null);
  const wasGhost = useRef(false);
  const wings = useRef<Group>(null);
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

    const isRock = engine.effects.rock > 0 && !death;
    if (bubble.current) bubble.current.visible = engine.effects.shield > 0 && !death;
    const flying = engine.effects.wings > 0 && !death;
    if (wings.current) {
      wings.current.visible = flying;
      wings.current.rotation.z = Math.sin(engine.time * 18) * 0.25;
    }
    // Hover a little above the water while flying.
    if (flying && !p.hop && !p.ride) y = 0.35 + Math.sin(engine.time * 6) * 0.05;
    if (chicken.current) chicken.current.visible = !isRock;
    if (rock.current) rock.current.visible = isRock;
    // Blink while the respawn shield is up; also flicker the last second of rock.
    const fading = isRock && engine.effects.rock < 1;
    g.visible = !((p.shield > 0 || fading) && Math.floor(engine.time * 12) % 2 === 0);
    if (fading && rock.current && chicken.current) {
      const showRock = Math.floor(engine.time * 8) % 2 === 0;
      rock.current.visible = showRock;
      chicken.current.visible = !showRock;
      g.visible = true;
    }

    g.position.set(x, y, z);
    // Tiny shrinks the model; ghost fades it.
    const small = engine.effects.tiny > 0 && !death ? 0.55 : 1;
    sx *= small;
    sy *= small;
    sz *= small;
    const ghost = engine.effects.ghost > 0 && !death;
    if (ghost !== wasGhost.current) {
      wasGhost.current = ghost;
      b.traverse((o) => {
        const m = (o as Mesh).material as Material | undefined;
        if (!m) return;
        m.transparent = ghost;
        m.opacity = ghost ? 0.4 : 1;
      });
    }
    b.scale.set(sx, sy, sz);
    // Turn towards the facing direction along the shortest arc.
    let diff = p.facing - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 25);
  });
  return (
    <group ref={root}>
      <group ref={body}>
        <group ref={chicken}>
          <CharacterModel id={engine.character} />
        </group>
        <group ref={rock} visible={false}>
          <RockShell />
        </group>
        <group ref={wings} position={[0, 0.55, 0.1]} visible={false}>
          <Wings />
        </group>
      </group>
      <group ref={bubble} visible={false}>
        <ShieldBubble />
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

function CameraRig({ engine, tier }: { engine: Engine; tier: Tier }) {
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
      castShadow={tier > 0}
      shadow-mapSize={tier === 2 ? [2048, 2048] : [1024, 1024]}
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

/**
 * Rendering quality: 2 = full effects at up to 2x pixel density, 1 = bloom only at 1.5x (phones
 * start here), 0 = no post-processing or shadows at 1x. Drops a tier while the frame rate is low.
 */
type Tier = 0 | 1 | 2;
const DPR: Record<Tier, number> = { 0: 1, 1: 1.5, 2: 2 };
const MIN_FPS = 45;

function startTier(): Tier {
  if (typeof window === "undefined") return 2;
  const phone = window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600;
  return phone ? 1 : 2;
}

function useQuality() {
  const [tier, setTier] = useState<Tier>(startTier);
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, DPR[tier]));
  }, [tier, setDpr]);
  const sample = useRef({ warmup: 0, time: 0, frames: 0 });
  useFrame((_, dt) => {
    const s = sample.current;
    // Skip shader compilation after a change and long pauses such as a backgrounded tab.
    if (dt > 0.25 || s.warmup < 2) {
      s.warmup += Math.min(dt, 0.25);
      return;
    }
    s.time += dt;
    s.frames++;
    if (s.time < 2) return;
    const fps = s.frames / s.time;
    s.time = s.frames = 0;
    if (fps < MIN_FPS && tier > 0) {
      s.warmup = 0;
      setTier((tier - 1) as Tier);
    }
  });
  return tier;
}

export function Scene({ engine, fx }: { engine: Engine; fx: boolean }) {
  const tier = useQuality();
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
      <CameraRig engine={engine} tier={tier} />
      {lanes.map((lane) => (
        <LaneView key={lane.row} lane={lane} engine={engine} />
      ))}
      <EdgeShade engine={engine} />
      <Player engine={engine} />
      <EagleView engine={engine} />
      {fx && tier > 0 && <Effects full={tier === 2} />}
    </>
  );
}
