"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type Group,
  LatheGeometry,
  type Mesh,
  Shape,
  Vector2,
} from "three";
import type { PowerUp } from "@/game/powerups";
import { CurrencyHeap } from "./CurrencyArt";
import { Drum, Ink, OUTLINE } from "./toon";

// Illustrated power-ups, drawn as smooth cartoon shapes rather than voxels (see toon.tsx).

type Paint = { color: string; opacity?: number };

/**
 * Inked see-through glass. A plain hull can't be used here, because its back faces would show
 * through and darken the whole glass. So an invisible copy first writes the glass's depth, the hull
 * (a slightly larger copy) then only lands around the edge, and the glass is drawn last on top.
 * Anything meant to sit inside the glass must draw before it (renderOrder below 3).
 */
function SeeThrough({ geometry, hull, color, opacity }: { geometry: BufferGeometry; hull: BufferGeometry; color: string; opacity: number }) {
  return (
    <>
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial colorWrite={false} transparent />
      </mesh>
      <mesh geometry={hull} renderOrder={4}>
        <meshBasicMaterial color={OUTLINE} side={BackSide} transparent />
      </mesh>
      <mesh geometry={geometry} renderOrder={5}>
        <meshToonMaterial color={color} transparent opacity={opacity} depthWrite={false} side={DoubleSide} />
      </mesh>
    </>
  );
}

/** The glass section of the canister, with a softly glowing core and whatever floats inside. */
function Glass({ r, h, glass, core, children }: { r: number; h: number; glass: Paint; core: Paint; children?: React.ReactNode }) {
  const o = 0.035;
  const tube = useMemo(() => new CylinderGeometry(r, r, h, 40, 1, true), [r, h]);
  const hull = useMemo(() => new CylinderGeometry(r + o, r + o, h, 40, 1, true), [r, h]);
  return (
    <group>
      <mesh renderOrder={1}>
        <cylinderGeometry args={[r * 0.7, r * 0.7, h - 0.04, 24]} />
        <meshBasicMaterial color={core.color} transparent opacity={core.opacity ?? 1} depthWrite={false} toneMapped={false} />
      </mesh>
      {children}
      {glass.opacity !== undefined ? (
        <SeeThrough geometry={tube} hull={hull} color={glass.color} opacity={glass.opacity} />
      ) : (
        <>
          <mesh geometry={hull}>
            <meshBasicMaterial color={OUTLINE} side={BackSide} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[r, r, h, 40]} />
            <meshToonMaterial color={glass.color} />
          </mesh>
        </>
      )}
    </group>
  );
}

function boltGeometry() {
  const s = new Shape();
  s.moveTo(0.06, 0.16);
  s.lineTo(-0.1, -0.01);
  s.lineTo(0, -0.01);
  s.lineTo(-0.06, -0.16);
  s.lineTo(0.1, 0.03);
  s.lineTo(0, 0.03);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  g.translate(0, 0, -0.015);
  return g;
}

/** A six-armed snowflake in the xy plane, made of thin bars. */
function Snowflake({
  size,
  color,
  position,
  rotation,
}: {
  size: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <mesh>
            <boxGeometry args={[size, size * 0.14, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          {[-1, 1].map((side) =>
            [-1, 1].map((tip) => (
              <mesh
                key={`${side}${tip}`}
                position={[side * size * 0.3, tip * size * 0.08, 0]}
                rotation={[0, 0, side * tip * 0.9]}
              >
                <boxGeometry args={[size * 0.24, size * 0.1, 0.02]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/** A crust of frost lumps around a cap's rim, optionally with icicles hanging from it. */
function Frost({ r, y, icicles = false }: { r: number; y: number; icicles?: boolean }) {
  const drips = icicles ? [0.2, 1.1, 1.9, 2.8, 3.6, 4.5, 5.4] : [];
  return (
    <group position={[0, y, 0]}>
      {drips.map((a, i) => {
        const len = 0.08 + ((i * 37) % 5) * 0.025;
        return (
          <mesh key={a} position={[Math.sin(a) * r, -len / 2, Math.cos(a) * r]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, len, 8]} />
            <meshToonMaterial color="#f4fbff" />
          </mesh>
        );
      })}
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r - 0.02), 0.02, Math.cos(a) * (r - 0.02)]} scale={[1, 0.6, 1]}>
            <sphereGeometry args={[0.045 + (i % 3) * 0.015, 12, 8]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
        );
      })}
    </group>
  );
}

export type CanisterKind = "energy" | "frost";

const CANISTER = {
  energy: {
    cap: "#f39012",
    capDeep: "#d9620a",
    knob: "#ffb92e",
    rim: "#d58cff",
    glass: { color: "#8f6af5", opacity: 0.5 },
    core: { color: "#b48cff", opacity: 0.5 },
  },
  frost: {
    cap: "#f39012",
    capDeep: "#d9620a",
    knob: "#ffb92e",
    rim: "#e9f7ff",
    glass: { color: "#a9dcfa", opacity: 0.85 },
    core: { color: "#e6f5ff" },
  },
};

/**
 * The power-up canister from the concept art. The energy cell has orange caps and violet glass with
 * a glowing bolt floating inside; the frost cell is iced over, with frosted pale blue glass and a snowflake.
 */
export function Canister({ kind = "energy" }: { kind?: CanisterKind }) {
  const bolt = useMemo(boltGeometry, []);
  const c = CANISTER[kind];
  return (
    <group rotation={[0.25, 0, -0.65]}>
      <Drum r={0.4} h={0.08} y={-0.5} color={c.capDeep} />
      <Drum r={0.42} h={0.2} y={-0.36} color={c.cap} />
      <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.36, 0.035, 12, 40]} />
        <meshBasicMaterial color={c.rim} toneMapped={false} />
      </mesh>
      <Glass r={0.35} h={0.5} glass={c.glass} core={c.core}>
        {kind === "energy" && (
          // Floats in the middle of the tube, small enough to stay inside the glass from every side.
          <mesh geometry={bolt} rotation={[-0.25, 0, 0.65]} scale={1.15} renderOrder={2}>
            <meshBasicMaterial color="#ffffff" transparent toneMapped={false} />
          </mesh>
        )}
      </Glass>
      {kind === "frost" && (
        <>
          <Snowflake size={0.26} color="#ffffff" position={[0, 0, 0.355]} rotation={[0, 0, 0.65]} />
          <Snowflake size={0.26} color="#ffffff" position={[0, 0, -0.355]} rotation={[0, Math.PI, -0.65]} />
          <Frost r={0.42} y={0.27} icicles />
          <Frost r={0.42} y={0.49} />
          <Frost r={0.42} y={-0.26} />
        </>
      )}
      <Drum r={0.4} h={0.05} y={0.27} color={c.capDeep} outline={0} />
      <Drum r={0.42} h={0.22} y={0.38} color={c.cap} />
      <Drum r={0.17} h={0.1} y={0.54} color={c.knob} />
    </group>
  );
}

const MAGNET_RED = "#e2373f";
const MAGNET_RED_DEEP = "#b51f2b";
const STEEL = "#e6ecf2";

/** One straight arm of the magnet: a red rod ending in a steel pole piece. */
function MagnetArm({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Drum r={0.15} h={0.34} y={0.17} color={MAGNET_RED} />
      <Drum r={0.155} h={0.04} y={0.35} color={MAGNET_RED_DEEP} outline={0} />
      <Drum r={0.15} h={0.16} y={0.45} color={STEEL} />
    </group>
  );
}

/** A classic red horseshoe magnet with steel tips, in the same toon style and size as the canister. */
export function Magnet() {
  const R = 0.27;
  const r = 0.15;
  const o = 0.035;
  return (
    <group rotation={[0.25, 0, -0.45]} position={[0, -0.05, 0]}>
      <group rotation={[0, 0, Math.PI]}>
        <mesh>
          <torusGeometry args={[R, r, 20, 40, Math.PI]} />
          <meshToonMaterial color={MAGNET_RED} />
        </mesh>
        <mesh>
          <torusGeometry args={[R, r + o, 20, 40, Math.PI]} />
          <meshBasicMaterial color={OUTLINE} side={BackSide} />
        </mesh>
      </group>
      <MagnetArm x={-R} />
      <MagnetArm x={R} />
    </group>
  );
}

// ---- Hourglass (slow-mo) --------------------------------------------------------

const SAND = "#f2a93b";
const FLOW_S = 4.4;
const FLIP_S = 0.6;

/** One bulb's outline from the neck up, as (radius, height) pairs; the other bulb mirrors it. */
const BULB: [number, number][] = [
  [0.05, 0],
  [0.12, 0.04],
  [0.22, 0.12],
  [0.26, 0.22],
  [0.24, 0.3],
  [0.18, 0.36],
];

function bulbs(grow: number) {
  const half = BULB.map(([r, y]) => new Vector2(r + grow, y));
  const points = [...half.slice(1).reverse().map((v) => new Vector2(v.x, -v.y)), ...half];
  return new LatheGeometry(points, 40);
}

/**
 * Slow-mo's hourglass. Sand runs from the top bulb to the bottom for a few seconds, then the glass
 * flips over and starts again, turning upside down every five seconds. `still` freezes it mid-flow.
 */
export function Hourglass({ still = false }: { still?: boolean }) {
  const glass = useMemo(() => bulbs(0), []);
  const hull = useMemo(() => bulbs(0.035), []);
  const turn = useRef<Group>(null);
  const top = useRef<Group>(null);
  const bottom = useRef<Group>(null);
  const stream = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = still ? 0.45 * FLOW_S : clock.elapsedTime % (FLOW_S + FLIP_S);
    const flow = Math.min(1, t / FLOW_S);
    const flip = Math.max(0, (t - FLOW_S) / FLIP_S);
    // Ease the flip; once over, the full bulb is on top again, so the next cycle starts seamlessly.
    if (turn.current) turn.current.rotation.z = Math.PI * (flip * flip * (3 - 2 * flip));
    top.current?.scale.setScalar(Math.max(0.001, Math.cbrt(1 - flow)));
    bottom.current?.scale.setScalar(Math.max(0.001, Math.cbrt(flow)));
    if (stream.current) stream.current.visible = flow > 0 && flow < 1;
  });
  return (
    <group rotation={[0, 0, -0.15]}>
      <group ref={turn}>
        {/* The sand sits inside the glass, so it draws first (opaque) and the glass tints it. */}
        <group ref={top} position={[0, 0.04, 0]}>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.21, 0.24, 24]} />
            <meshToonMaterial color={SAND} />
          </mesh>
        </group>
        <group ref={bottom} position={[0, -0.33, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <coneGeometry args={[0.23, 0.2, 24]} />
            <meshToonMaterial color={SAND} />
          </mesh>
        </group>
        <mesh ref={stream} position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshToonMaterial color={SAND} />
        </mesh>
        <SeeThrough geometry={glass} hull={hull} color="#bfe6ff" opacity={0.25} />
        {[0.42, -0.42].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <Drum r={0.37} h={0.09} color="#3d7fe0" />
            <Drum r={0.27} h={0.04} y={y > 0 ? -0.06 : 0.06} color="#285ea8" outline={0.025} />
          </group>
        ))}
        {/* Posts at the back and front corners, so none hides the sand. */}
        {[-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((a) => (
          <group key={a} position={[Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]}>
            <Drum r={0.03} h={0.76} color="#f4c542" outline={0.025} />
          </group>
        ))}
      </group>
    </group>
  );
}

// ---- Shield ---------------------------------------------------------------------

function shieldShape(w: number, h: number) {
  const s = new Shape();
  s.moveTo(-w, h * 0.8);
  s.quadraticCurveTo(0, h * 1.05, w, h * 0.8);
  s.lineTo(w, h * 0.1);
  s.quadraticCurveTo(w * 0.95, -h * 0.6, 0, -h);
  s.quadraticCurveTo(-w * 0.95, -h * 0.6, -w, h * 0.1);
  s.closePath();
  return s;
}

function starShape(outer: number, inner: number) {
  const s = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? inner : outer;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function slab(shape: Shape, depth: number, bevel = 0.025) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** A steel-rimmed teal heater shield with a white star, faced the same on both sides. */
export function ShieldArt() {
  const { rim, hull, face, star } = useMemo(
    () => ({
      rim: slab(shieldShape(0.36, 0.44), 0.1),
      hull: slab(shieldShape(0.395, 0.48), 0.12, 0.04),
      face: slab(shieldShape(0.27, 0.34), 0.14, 0.02),
      star: slab(starShape(0.13, 0.055), 0.17, 0.01),
    }),
    [],
  );
  return (
    <group rotation={[0.15, 0, -0.2]}>
      <mesh geometry={hull}>
        <Ink />
      </mesh>
      <mesh geometry={rim}>
        <meshToonMaterial color="#dfe6ee" />
      </mesh>
      <mesh geometry={face}>
        <meshToonMaterial color="#1fa3b8" />
      </mesh>
      <mesh geometry={star} position={[0, 0.04, 0]}>
        <meshToonMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// ---- Alarm clock ----------------------------------------------------------------

/** A red alarm clock with twin bells and a ticking minute hand. */
export function Clock() {
  const minute = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (minute.current) minute.current.rotation.z = -clock.elapsedTime * 1.5;
  });
  return (
    <group rotation={[0.15, 0, -0.15]} position={[0, -0.04, 0]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Drum r={0.36} h={0.2} colors={["#c42a33", "#e2373f", "#c42a33"]} />
        <Drum r={0.29} h={0.02} y={0.1} color="#ffffff" outline={0.02} />
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.22, Math.cos((i * Math.PI) / 2) * 0.22, 0.125]}>
          <boxGeometry args={[0.04, 0.04, 0.01]} />
          <meshBasicMaterial color={OUTLINE} />
        </mesh>
      ))}
      <mesh position={[0.04, 0.05, 0.125]} rotation={[0, 0, -0.75]}>
        <boxGeometry args={[0.035, 0.14, 0.01]} />
        <meshBasicMaterial color={OUTLINE} />
      </mesh>
      <group ref={minute} position={[0, 0, 0.13]}>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.025, 0.2, 0.01]} />
          <meshBasicMaterial color={OUTLINE} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.01, 16]} />
        <meshBasicMaterial color="#e2373f" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.25, 0.3, 0]} rotation={[0, 0, -side * 0.6]}>
          <mesh>
            <sphereGeometry args={[0.13, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial color="#f4c542" side={DoubleSide} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.165, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Ink />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.4, 0]}>
        <Drum r={0.035} h={0.1} color="#f4c542" outline={0.02} />
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.22, -0.36, 0]} rotation={[0, 0, side * 0.5]}>
          <Drum r={0.04} h={0.12} color="#c42a33" outline={0.025} />
        </group>
      ))}
    </group>
  );
}

/** The power-ups drawn as illustrations; the rest keep their voxel pickups. Double and coin rain show coins. */
export const ART_POWERUPS: Partial<Record<PowerUp, () => React.ReactNode>> = {
  superhop: () => <Canister />,
  freeze: () => <Canister kind="frost" />,
  magnet: () => <Magnet />,
  slowmo: () => <Hourglass />,
  shield: () => <ShieldArt />,
  double: () => <CurrencyHeap kind="coins" amount={50} />,
  coinrain: () => <CurrencyHeap kind="coins" amount={100} />,
};

/** An illustrated power-up sized to sit on a lane like the voxel pickups. */
export function PickupArt({ kind }: { kind: PowerUp }) {
  const art = ART_POWERUPS[kind];
  return art ? <group scale={0.48}>{art()}</group> : null;
}
