"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  type Group,
  LatheGeometry,
  type Mesh,
  Quaternion,
  RepeatWrapping,
  Shape,
  SplineCurve,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import type { PowerUp } from "@/game/powerups";
import type { StoreItemId } from "@/game/wallet";
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

// ---- Shared shapes for the boxy and turned models ---------------------------------

/** A box with rounded, bevelled edges, centred on the origin. */
function roundedBox(w: number, h: number, d: number, r: number) {
  const s = new Shape();
  const x = w / 2 - r;
  const y = h / 2 - r;
  const c = r * 0.6;
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.quadraticCurveTo(x, -y, x, -y + c);
  s.lineTo(x, y - c);
  s.quadraticCurveTo(x, y, x - c, y);
  s.lineTo(-x + c, y);
  s.quadraticCurveTo(-x, y, -x, y - c);
  s.lineTo(-x, -y + c);
  s.quadraticCurveTo(-x, -y, -x + c, -y);
  const g = new ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 6 });
  g.center();
  return g;
}

/** A turned (lathed) solid from a smooth profile of [radius, height] points, bottom to top. */
function turned(points: [number, number][], segments = 40) {
  const curve = new SplineCurve(points.map(([x, y]) => new Vector2(x, y)));
  return new LatheGeometry(curve.getPoints(32), segments);
}

/** The inked outline for a shape centred on the origin: the same geometry, a little larger. */
function Hull({ geometry, scale }: { geometry: BufferGeometry; scale: number | [number, number, number] }) {
  return (
    <mesh geometry={geometry} scale={scale}>
      <Ink />
    </mesh>
  );
}

// ---- Foresight --------------------------------------------------------------------

/** The twelve edges of a box as thin white beams, for the hologram's outline. */
function BoxEdges({ size, width = 0.035, color = "#ffffff" }: { size: number; width?: number; color?: string }) {
  const h = size / 2;
  const beams: { p: [number, number, number]; s: [number, number, number] }[] = [];
  for (const a of [-h, h])
    for (const b of [-h, h]) {
      beams.push({ p: [0, a, b], s: [size + width, width, width] });
      beams.push({ p: [a, 0, b], s: [width, size + width, width] });
      beams.push({ p: [a, b, 0], s: [width, width, size + width] });
    }
  return (
    <>
      {beams.map(({ p, s }, i) => (
        <mesh key={i} position={p} renderOrder={7}>
          <boxGeometry args={s} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

/** A solid yellow box and, ahead of it, its see-through hologram: where things will be a moment from now. */
export function ForesightArt() {
  const { box, hull } = useMemo(() => ({ box: roundedBox(0.5, 0.5, 0.5, 0.07), hull: roundedBox(0.57, 0.57, 0.57, 0.105) }), []);
  return (
    <group rotation={[0.35, -0.6, 0]}>
      <group position={[-0.2, -0.18, 0.2]}>
        <mesh geometry={hull}>
          <Ink />
        </mesh>
        <mesh geometry={box}>
          <meshToonMaterial color="#ffc21a" />
        </mesh>
      </group>
      <group position={[0.2, 0.22, -0.2]}>
        <mesh renderOrder={6}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshBasicMaterial color="#7fe3ff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
        </mesh>
        <BoxEdges size={0.5} />
      </group>
    </group>
  );
}

// ---- Rock -------------------------------------------------------------------------

/** Grey stone: blotches of lighter and darker grey with a few hairline cracks. Made once and shared. */
let stoneTexture: CanvasTexture | null = null;
function stone() {
  if (stoneTexture || typeof document === "undefined") return stoneTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#9a9ca3";
  g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ["#8c8e95", "#a6a8ae", "#909299", "#adafb4"][i % 4];
    g.beginPath();
    g.ellipse(rand() * 128, rand() * 128, 3 + rand() * 8, 2 + rand() * 6, rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = "#5f6168";
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    let x = rand() * 128;
    let y = rand() * 128;
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 4; j++) g.lineTo((x += (rand() - 0.5) * 30), (y += (rand() - 0.5) * 30));
    g.stroke();
  }
  stoneTexture = new CanvasTexture(c);
  stoneTexture.wrapS = stoneTexture.wrapT = RepeatWrapping;
  stoneTexture.repeat.set(1.6, 1.6);
  stoneTexture.colorSpace = SRGBColorSpace;
  return stoneTexture;
}

/** A chunky stone block with bevelled edges and a speckled grey surface. */
export function RockArt() {
  const { box, hull } = useMemo(() => ({ box: roundedBox(0.66, 0.6, 0.62, 0.1), hull: roundedBox(0.73, 0.67, 0.69, 0.135) }), []);
  return (
    <group rotation={[0.35, -0.55, 0.05]}>
      <mesh geometry={hull}>
        <Ink />
      </mesh>
      <mesh geometry={box}>
        <meshToonMaterial color="#ffffff" map={stone()} />
      </mesh>
    </group>
  );
}

// ---- Tiny -------------------------------------------------------------------------

const CAP: [number, number][] = [
  [0.001, -0.03],
  [0.2, -0.04],
  [0.4, -0.01],
  [0.46, 0.06],
  [0.43, 0.17],
  [0.33, 0.27],
  [0.18, 0.33],
  [0.001, 0.35],
];
const STEM: [number, number][] = [
  [0.001, -0.42],
  [0.17, -0.41],
  [0.19, -0.33],
  [0.16, -0.17],
  [0.13, -0.04],
  [0.001, -0.02],
];

/** A small yellow mushroom: a domed cap with a curled rim and white spots, on a stout cream stem. */
export function MushroomArt() {
  const { cap, stem, spots } = useMemo(() => {
    const cap = turned(CAP);
    const stem = turned(STEM);
    // Spots sit on the cap's surface, turned to face out along it.
    const spots: { p: [number, number, number]; q: Quaternion; s: number }[] = [];
    const dome = new SplineCurve(CAP.map(([x, y]) => new Vector2(x, y)));
    const place = (t: number, angle: number, s: number) => {
      const pt = dome.getPoint(t);
      const tan = dome.getTangent(t);
      const n = new Vector3(tan.y * Math.cos(angle), -tan.x, tan.y * Math.sin(angle)).normalize().negate();
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), n);
      spots.push({ p: [pt.x * Math.cos(angle), pt.y, pt.x * Math.sin(angle)], q, s });
    };
    place(0.98, 0, 0.09);
    [0, 1, 2, 3, 4, 5].forEach((i) => place(0.62, (i * Math.PI) / 3 + 0.4, 0.075));
    [0, 1, 2, 3].forEach((i) => place(0.42, (i * Math.PI) / 2, 0.06));
    return { cap, stem, spots };
  }, []);
  return (
    <group rotation={[0.3, 0, -0.18]} position={[0, 0.02, 0]}>
      <mesh geometry={stem}>
        <meshToonMaterial color="#fff1d0" />
      </mesh>
      <mesh geometry={stem} scale={[1.22, 1.06, 1.22]} position={[0, 0.02, 0]}>
        <Ink />
      </mesh>
      <mesh position={[0, -0.025, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.01, 40]} />
        <meshToonMaterial color="#e8b04a" />
      </mesh>
      <mesh geometry={cap}>
        <meshToonMaterial color="#ffc21a" side={DoubleSide} />
      </mesh>
      <mesh geometry={cap} scale={[1.08, 1.12, 1.08]} position={[0, -0.01, 0]}>
        <Ink />
      </mesh>
      {spots.map(({ p, q, s }, i) => (
        <mesh key={i} position={p} quaternion={q} scale={[s, s * 0.3, s]}>
          <sphereGeometry args={[1, 16, 8]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

// ---- Ghost ------------------------------------------------------------------------

const GHOST: [number, number][] = [
  [0.001, -0.3],
  [0.3, -0.3],
  [0.34, -0.1],
  [0.33, 0.12],
  [0.26, 0.3],
  [0.14, 0.39],
  [0.001, 0.41],
];

/** A friendly little ghost: a rounded sheet with a scalloped hem, dark oval eyes and stubby arms. */
export function GhostArt() {
  const body = useMemo(() => turned(GHOST), []);
  const white = "#f3efff";
  const hem = [0, 1, 2, 3, 4, 5, 6].map((i) => (i * Math.PI * 2) / 7);
  return (
    <group rotation={[0.15, 0, 0.12]} position={[0, 0.05, 0]}>
      <mesh geometry={body}>
        <meshToonMaterial color={white} />
      </mesh>
      <mesh geometry={body} scale={[1.11, 1.08, 1.11]}>
        <Ink />
      </mesh>
      {hem.map((a, i) => (
        <group key={i} position={[Math.cos(a) * 0.25, -0.31, Math.sin(a) * 0.25]}>
          <mesh>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshToonMaterial color={white} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.135, 16, 12]} />
            <Ink />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.11, 0.12, 0.29]} scale={[0.05, 0.08, 0.03]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color={OUTLINE} />
          </mesh>
          <mesh position={[side * 0.2, 0.0, 0.27]} scale={[0.05, 0.03, 0.02]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshBasicMaterial color="#ff9ec4" />
          </mesh>
          <group position={[side * 0.36, -0.02, 0.02]} rotation={[0, 0, side * 0.7]}>
            <mesh scale={[0.07, 0.12, 0.07]}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshToonMaterial color={white} />
            </mesh>
            <mesh scale={[0.105, 0.155, 0.105]}>
              <sphereGeometry args={[1, 16, 12]} />
              <Ink />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ---- Scarecrow --------------------------------------------------------------------

/** A scarecrow's head on its post: a stitched burlap face under a battered straw hat, straw poking out. */
export function ScarecrowArt() {
  const straw = "#f2c94c";
  return (
    <group rotation={[-0.45, 0.25, -0.08]} position={[0, 0.05, 0]}>
      <Drum r={0.045} h={0.5} y={-0.42} color="#8a5a2b" />
      <group position={[0, -0.33, 0]} rotation={[0, 0, Math.PI / 2]}>
        <Drum r={0.04} h={0.7} color="#8a5a2b" />
      </group>
      {[-1, 1].map((side) =>
        [-0.35, 0, 0.35].map((tilt) => (
          <group key={`${side}${tilt}`} position={[side * 0.38, -0.33, 0]} rotation={[tilt, 0, side * (Math.PI / 2 + tilt)]}>
            <Drum r={0.035} rTop={0.005} h={0.16} y={0.08} color={straw} outline={0.02} sides={8} />
          </group>
        )),
      )}
      <mesh>
        <sphereGeometry args={[0.26, 32, 20]} />
        <meshToonMaterial color="#e2b877" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.295, 32, 20]} />
        <Ink />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.09, 0.03, 0.235]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.03, 16]} />
          <meshBasicMaterial color={OUTLINE} />
        </mesh>
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.05, -0.1 + Math.abs(i) * 0.018, 0.24 - Math.abs(i) * 0.012]} rotation={[0, 0, i * 0.25 + Math.PI / 2]}>
          <boxGeometry args={[0.012, 0.035, 0.02]} />
          <meshBasicMaterial color={OUTLINE} />
        </mesh>
      ))}
      {[-1, 1].map((side) =>
        [-0.3, 0.1, 0.5].map((a) => (
          <group key={`${side}${a}`} position={[side * 0.24, 0.12, 0]} rotation={[a, 0, side * -1.9]}>
            <Drum r={0.03} rTop={0.004} h={0.15} y={0.07} color={straw} outline={0.02} sides={8} />
          </group>
        )),
      )}
      <group position={[0, 0.22, -0.03]} rotation={[-0.25, 0, 0.12]}>
        <Drum r={0.4} h={0.04} color="#c8963e" />
        <Drum r={0.2} rTop={0.15} h={0.24} y={0.13} color="#c8963e" />
        <Drum r={0.205} h={0.06} y={0.05} color="#e2373f" outline={0} />
      </group>
    </group>
  );
}

// ---- Lumberjack -------------------------------------------------------------------

function bladeShape(scale = 1) {
  const s = new Shape();
  s.moveTo(-0.14 * scale, 0.09 * scale);
  s.lineTo(0.05 * scale, 0.1 * scale);
  s.quadraticCurveTo(0.2 * scale, 0.2 * scale, 0.3 * scale, 0.24 * scale);
  s.quadraticCurveTo(0.36 * scale, 0, 0.3 * scale, -0.24 * scale);
  s.quadraticCurveTo(0.2 * scale, -0.2 * scale, 0.05 * scale, -0.1 * scale);
  s.lineTo(-0.14 * scale, -0.09 * scale);
  s.closePath();
  return s;
}

/** A woodsman's axe: a red head with a bright steel edge on a long wooden handle. */
export function AxeArt() {
  const { head, hull, edge } = useMemo(() => {
    const ex = (shape: Shape, depth: number, bevel: number) => {
      const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    const edgeShape = new Shape();
    edgeShape.moveTo(0.2, 0.2);
    edgeShape.quadraticCurveTo(0.27, 0.22, 0.3, 0.24);
    edgeShape.quadraticCurveTo(0.36, 0, 0.3, -0.24);
    edgeShape.quadraticCurveTo(0.27, -0.22, 0.2, -0.2);
    edgeShape.quadraticCurveTo(0.25, 0, 0.2, 0.2);
    return { head: ex(bladeShape(), 0.1, 0.02), hull: ex(bladeShape(1.13), 0.15, 0.03), edge: ex(edgeShape, 0.11, 0.02) };
  }, []);
  return (
    <group rotation={[0.2, -0.3, -0.55]} position={[-0.05, 0, 0]}>
      <Drum r={0.055} h={1.0} y={-0.12} color="#b0713a" />
      <group position={[0.02, 0.28, 0]}>
        <mesh geometry={hull} position={[0.01, 0, 0]}>
          <Ink />
        </mesh>
        <mesh geometry={head}>
          <meshToonMaterial color="#e2373f" />
        </mesh>
        <mesh geometry={edge}>
          <meshToonMaterial color="#eef2f6" />
        </mesh>
      </group>
    </group>
  );
}

// ---- Warp -------------------------------------------------------------------------

/** A swirl painted once for the portal's centre: indigo at the rim spiralling in to white. */
let swirlTexture: CanvasTexture | null = null;
function swirl() {
  if (swirlTexture || typeof document === "undefined") return swirlTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, "#9fe8ff");
  grad.addColorStop(0.75, "#6a5cff");
  grad.addColorStop(1, "#2c2f9e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 4;
  g.lineCap = "round";
  for (let arm = 0; arm < 3; arm++) {
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = arm * ((Math.PI * 2) / 3) + t * 5;
      const r = 8 + t * 52;
      const x = 64 + Math.cos(a) * r;
      const y = 64 + Math.sin(a) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  swirlTexture = new CanvasTexture(c);
  swirlTexture.colorSpace = SRGBColorSpace;
  return swirlTexture;
}

/** A spinning portal: a thick indigo ring around a glowing swirl, with sparkles. */
export function WarpArt() {
  const spin = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z -= dt * 2;
  });
  return (
    <group rotation={[0.2, -0.35, 0]}>
      <mesh ref={spin}>
        <circleGeometry args={[0.34, 40]} />
        <meshBasicMaterial map={swirl()} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.38, 0.09, 20, 48]} />
        <meshToonMaterial color="#3f51b5" />
      </mesh>
      <mesh>
        <torusGeometry args={[0.38, 0.125, 20, 48]} />
        <Ink />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <torusGeometry args={[0.38, 0.035, 12, 48]} />
        <meshToonMaterial color="#8f9bff" />
      </mesh>
      {[
        [0.5, 0.42, 0.06],
        [-0.52, -0.3, 0.045],
        [0.42, -0.48, 0.04],
      ].map(([x, y, s], i) => (
        <mesh key={i} position={[x, y, 0.1]} scale={[s, s * 1.6, s]}>
          <octahedronGeometry args={[1]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

// ---- Extra life ---------------------------------------------------------------------

function heartShape(k = 1) {
  const s = new Shape();
  s.moveTo(0, -0.38 * k);
  s.bezierCurveTo(-0.08 * k, -0.27 * k, -0.42 * k, -0.05 * k, -0.42 * k, 0.12 * k);
  s.bezierCurveTo(-0.42 * k, 0.3 * k, -0.25 * k, 0.38 * k, -0.17 * k, 0.38 * k);
  s.bezierCurveTo(-0.07 * k, 0.38 * k, -0.02 * k, 0.3 * k, 0, 0.25 * k);
  s.bezierCurveTo(0.02 * k, 0.3 * k, 0.07 * k, 0.38 * k, 0.17 * k, 0.38 * k);
  s.bezierCurveTo(0.25 * k, 0.38 * k, 0.42 * k, 0.3 * k, 0.42 * k, 0.12 * k);
  s.bezierCurveTo(0.42 * k, -0.05 * k, 0.08 * k, -0.27 * k, 0, -0.38 * k);
  return s;
}

/** A plump red heart with a soft bevel and a shine. */
export function HeartArt() {
  const { heart } = useMemo(() => {
    const ex = (k: number, depth: number, bevel: number) => {
      // A small bevel size keeps the dip at the top from folding in on itself.
      const g = new ExtrudeGeometry(heartShape(k), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.025, bevelSegments: 5, curveSegments: 24 });
      g.translate(0, 0, -depth / 2);
      return g;
    };
    return { heart: ex(1, 0.14, 0.08) };
  }, []);
  return (
    <group rotation={[0.2, -0.35, 0.1]}>
      <mesh geometry={heart} scale={[1.09, 1.09, 1]}>
        <Ink />
      </mesh>
      {/* Both sides, so the hairline seam at the dip shows red rather than the outline behind it. */}
      <mesh geometry={heart}>
        <meshToonMaterial color="#ff4d6d" side={DoubleSide} />
      </mesh>
      <mesh position={[-0.2, 0.2, 0.15]} rotation={[0, 0, 0.6]} scale={[0.07, 0.04, 0.02]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshBasicMaterial color="#ffd6de" />
      </mesh>
    </group>
  );
}

/** Every power-up (and the extra life) drawn as an illustration. Double and coin rain show coins. */
export const ART_POWERUPS: Partial<Record<StoreItemId, () => React.ReactNode>> = {
  superhop: () => <Canister />,
  freeze: () => <Canister kind="frost" />,
  magnet: () => <Magnet />,
  slowmo: () => <Hourglass />,
  shield: () => <ShieldArt />,
  double: () => <CurrencyHeap kind="coins" amount={50} />,
  coinrain: () => <CurrencyHeap kind="coins" amount={100} />,
  foresight: () => <ForesightArt />,
  rock: () => <RockArt />,
  tiny: () => <MushroomArt />,
  ghost: () => <GhostArt />,
  scarecrow: () => <ScarecrowArt />,
  lumberjack: () => <AxeArt />,
  warp: () => <WarpArt />,
  life: () => <HeartArt />,
};

/** An illustrated power-up sized to sit on a lane like the voxel pickups. */
export function PickupArt({ kind }: { kind: StoreItemId }) {
  const art = ART_POWERUPS[kind];
  return art ? <group scale={0.48}>{art()}</group> : null;
}
