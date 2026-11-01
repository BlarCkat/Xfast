"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  type Group,
  type PointLight,
  RepeatWrapping,
  type Sprite,
  SRGBColorSpace,
} from "three";
import type { ChestKind } from "@/game/chests";
import { BonnetArt } from "./EventArt";
import { Ink } from "./toon";

// The reward chests: a box with a rounded lid, metal bands with rivets, a lock plate and an inked
// outline, like the rest of the illustrated art. Painted textures give each one its material (wood
// planks with grain, quilted violet, brushed gold, festive red) with light baked in from above and
// shadow gathering towards the base, and the metal catches highlights. The lid hinges at the back;
// opening it bounces the chest up and lets out a soft glow with no hard edges.

const W = 1;
const H = 0.5;
const D = 0.7;
const R = D / 2;
const O = 0.025;

type Finish = "wood" | "quilt" | "gold" | "festive";

interface Look {
  body: string;
  dark: string;
  light: string;
  finish: Finish;
  band: string;
  lock: string;
  gem?: string;
  /** A Santa bonnet perched on the lid. */
  hat?: boolean;
}

const LOOKS: Record<ChestKind, Look> = {
  basic: { body: "#b46c2e", dark: "#6e3c15", light: "#e09a52", finish: "wood", band: "#8d97a8", lock: "#dfe5ee" },
  epic: { body: "#8448f0", dark: "#4a1fa6", light: "#b48cff", finish: "quilt", band: "#ffb703", lock: "#ffd23f" },
  mega: { body: "#ffbf1f", dark: "#c27a00", light: "#fff0a6", finish: "gold", band: "#e63946", lock: "#ffffff", gem: "#2ee6c9" },
  christmas: { body: "#d62839", dark: "#7d0f1c", light: "#ff7383", finish: "festive", band: "#2f9e44", lock: "#ffd23f", hat: true },
};

// ---- Painted textures ---------------------------------------------------------

const textures = new Map<string, CanvasTexture>();

/**
 * The body's paint, as a canvas. `across` lays the pattern along the canvas's height instead of
 * its width, for the lid, whose texture wraps round the curve.
 */
function paint(look: Look, across: boolean) {
  const key = `${look.finish}:${look.body}:${across}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  if (across) {
    g.translate(S, 0);
    g.rotate(Math.PI / 2);
  }
  // Base coat, lit from above.
  const base = g.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0, look.light);
  base.addColorStop(0.35, look.body);
  base.addColorStop(1, look.dark);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  if (look.finish === "wood") {
    // Four planks, each rounded by its own light-to-dark band, with grain and a dark seam.
    const planks = 4;
    for (let i = 0; i < planks; i++) {
      const y = (i * S) / planks;
      const h = S / planks;
      const band = g.createLinearGradient(0, y, 0, y + h);
      band.addColorStop(0, "rgba(255,220,170,0.35)");
      band.addColorStop(0.5, "rgba(255,255,255,0)");
      band.addColorStop(1, "rgba(40,15,0,0.35)");
      g.fillStyle = band;
      g.fillRect(0, y, S, h);
      g.strokeStyle = "rgba(70,30,5,0.35)";
      g.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        const gy = y + 6 + rand() * (h - 12);
        const amp = 1 + rand() * 3;
        const freq = 0.02 + rand() * 0.03;
        g.beginPath();
        for (let x = 0; x <= S; x += 4) g.lineTo(x, gy + Math.sin(x * freq + k) * amp);
        g.stroke();
      }
      // A knot here and there.
      if (rand() < 0.6) {
        g.fillStyle = "rgba(60,25,5,0.45)";
        g.beginPath();
        g.ellipse(30 + rand() * (S - 60), y + h / 2, 7, 3.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(35,12,0,0.85)";
      g.fillRect(0, y + h - 3, S, 3);
    }
  } else if (look.finish === "quilt") {
    // Diamond quilting: light upper-left edges, dark lower-right, and a shine in each cell.
    const n = 6;
    const step = S / n;
    for (let i = -1; i <= n; i++)
      for (let j = -1; j <= n; j++) {
        const cx = i * step + (j % 2 ? step / 2 : 0);
        const cy = j * step * 0.6;
        const cell = g.createRadialGradient(cx - step * 0.15, cy - step * 0.15, 1, cx, cy, step * 0.6);
        cell.addColorStop(0, "rgba(255,255,255,0.28)");
        cell.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = cell;
        g.fillRect(cx - step, cy - step, step * 2, step * 2);
      }
    g.lineWidth = 2;
    for (let k = -S; k < S * 2; k += step) {
      g.strokeStyle = "rgba(30,0,80,0.45)";
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + S, S);
      g.stroke();
      g.strokeStyle = "rgba(220,200,255,0.25)";
      g.beginPath();
      g.moveTo(k + 2, 0);
      g.lineTo(k - S + 2, S);
      g.stroke();
    }
  } else if (look.finish === "gold") {
    // Brushed gold with a raised scroll of dots and a bright sheen.
    for (let y = 0; y < S; y += 2) {
      g.fillStyle = `rgba(${rand() < 0.5 ? "255,255,220" : "120,70,0"},${0.04 + rand() * 0.06})`;
      g.fillRect(0, y, S, 1);
    }
    const sheen = g.createLinearGradient(0, 0, S, S);
    sheen.addColorStop(0.3, "rgba(255,255,255,0)");
    sheen.addColorStop(0.45, "rgba(255,255,230,0.45)");
    sheen.addColorStop(0.6, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, S, S);
    for (let x = 16; x < S; x += 32)
      for (let y = 20; y < S; y += 40) {
        g.fillStyle = "rgba(140,80,0,0.45)";
        g.beginPath();
        g.arc(x + 1.5, y + 1.5, 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,250,200,0.8)";
        g.beginPath();
        g.arc(x, y, 3.5, 0, Math.PI * 2);
        g.fill();
      }
  } else {
    // Festive: soft candy stripes and little snowflake dots.
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (let k = -S; k < S * 2; k += 40) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + 18, 0);
      g.lineTo(k + 18 - S, S);
      g.lineTo(k - S, S);
      g.fill();
    }
    g.fillStyle = "rgba(255,255,255,0.55)";
    for (let k = 0; k < 22; k++) {
      g.beginPath();
      g.arc(rand() * S, rand() * S, 2 + rand() * 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Shadow gathering towards the base, and a soft vignette so edges read as rounded.
  const ao = g.createLinearGradient(0, S * 0.55, 0, S);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(20,5,30,0.35)");
  g.fillStyle = ao;
  g.fillRect(0, 0, S, S);
  const edge = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(10,0,20,0.28)");
  g.fillStyle = edge;
  g.fillRect(0, 0, S, S);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  textures.set(key, t);
  return t;
}

/** A round blob of light fading to nothing at its rim, so glows never show an edge. */
let glowTexture: CanvasTexture | null = null;
function glow() {
  if (glowTexture) return glowTexture;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  r.addColorStop(0, "rgba(255,246,200,1)");
  r.addColorStop(0.25, "rgba(255,220,120,0.6)");
  r.addColorStop(0.6, "rgba(255,190,80,0.15)");
  r.addColorStop(1, "rgba(255,180,60,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, S, S);
  glowTexture = new CanvasTexture(c);
  glowTexture.colorSpace = SRGBColorSpace;
  return glowTexture;
}

// ---- Parts ----------------------------------------------------------------------

/** A metal part: bright, slightly shiny, picking up highlights. */
const Metal = ({ color }: { color: string }) => <meshStandardMaterial color={color} metalness={0.35} roughness={0.32} />;

/** A box with its inked outline. */
function InkBox({
  size,
  position,
  children,
  outline = O,
}: {
  size: [number, number, number];
  position?: [number, number, number];
  children: React.ReactNode;
  outline?: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        {children}
      </mesh>
      {outline > 0 && (
        <mesh>
          <boxGeometry args={[size[0] + 2 * outline, size[1] + 2 * outline, size[2] + 2 * outline]} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}

/** Round rivet heads along a band. */
function Rivets({ points, color }: { points: [number, number, number][]; color: string }) {
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <Metal color={color} />
        </mesh>
      ))}
    </>
  );
}

/** Half a cylinder lying along x, flat side down: the rounded lid and the bands round it. */
function halfDrum(r: number, length: number, openEnded = false) {
  return new CylinderGeometry(r, r, length, 32, 1, openEnded, 0, Math.PI).rotateZ(Math.PI / 2);
}

function Lid({ look }: { look: Look }) {
  const [shell, hull, band, bandHull] = useMemo(
    () => [halfDrum(R, W), halfDrum(R + O, W + 2 * O), halfDrum(R + 0.022, 0.1, true), halfDrum(R + 0.022 + O, 0.1 + 2 * O, true)],
    [],
  );
  const map = useMemo(() => paint(look, true), [look]);
  return (
    <group>
      <mesh geometry={shell}>
        <meshStandardMaterial map={map} roughness={look.finish === "gold" ? 0.35 : 0.7} metalness={look.finish === "gold" ? 0.3 : 0} side={DoubleSide} />
      </mesh>
      <mesh geometry={hull}>
        <Ink />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (W / 2 - 0.12), 0, 0]}>
          <mesh geometry={band}>
            <Metal color={look.band} />
          </mesh>
          <mesh geometry={bandHull}>
            <Ink />
          </mesh>
          <Rivets
            color={look.lock}
            points={[0.35, 0.8, 1.25].map((a) => [0, Math.sin(a) * (R + 0.03), Math.cos(a) * (R + 0.03)])}
          />
        </group>
      ))}
      {/* The lid's front edge, where the lock hangs down from. */}
      <InkBox size={[W + 0.02, 0.06, 0.04]} position={[0, 0.03, R - 0.01]} outline={0}>
        <Metal color={look.band} />
      </InkBox>
      {look.hat && (
        <group position={[0.12, R - 0.02, -0.04]} rotation={[0, -0.4, -0.15]} scale={0.6}>
          <BonnetArt />
        </group>
      )}
      {look.gem && (
        <>
          <Gem color={look.gem} position={[0, R + 0.01, 0]} size={0.12} />
          <Gem color="#ff5d8f" position={[0, R * 0.72, R * 0.72]} size={0.08} tilt={-Math.PI / 4} />
        </>
      )}
    </group>
  );
}

/** A small faceted stone set into the Mega chest's lid. */
function Gem({ color, position, size, tilt = 0 }: { color: string; position: [number, number, number]; size: number; tilt?: number }) {
  return (
    <group position={position} rotation={[tilt, Math.PI / 4, 0]}>
      <mesh>
        <octahedronGeometry args={[size]} />
        <meshStandardMaterial color={color} flatShading roughness={0.15} metalness={0.1} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh scale={1.3}>
        <octahedronGeometry args={[size]} />
        <Ink />
      </mesh>
    </group>
  );
}

/** Wall thickness of the hollow box, and the height of its floor inside. */
const T = 0.05;
const FLOOR = 0.1;

/**
 * The chest's box: four walls and a floor, open at the top so the inside shows when the lid lifts.
 * The outside wears the painted finish; the inside is lined in a darker shade of it.
 */
function Shell({ look, map, wood }: { look: Look; map: CanvasTexture; wood: boolean }) {
  const outer = (
    <meshStandardMaterial map={map} roughness={wood ? 0.8 : look.finish === "gold" ? 0.35 : 0.6} metalness={look.finish === "gold" ? 0.3 : 0} />
  );
  const lining = <meshStandardMaterial color={look.dark} roughness={0.9} side={DoubleSide} />;
  const inH = H - FLOOR;
  return (
    <group>
      {/* Walls: front, back, then the ends between them. */}
      {[1, -1].map((z) => (
        <mesh key={`z${z}`} position={[0, H / 2, z * (D / 2 - T / 2)]}>
          <boxGeometry args={[W, H, T]} />
          {outer}
        </mesh>
      ))}
      {[1, -1].map((x) => (
        <mesh key={`x${x}`} position={[x * (W / 2 - T / 2), H / 2, 0]}>
          <boxGeometry args={[T, H, D - 2 * T]} />
          {outer}
        </mesh>
      ))}
      <mesh position={[0, FLOOR / 2, 0]}>
        <boxGeometry args={[W - 2 * T, FLOOR, D - 2 * T]} />
        {outer}
      </mesh>
      {/* The lining: a darker inner face on each wall and the floor. */}
      {[1, -1].map((z) => (
        <mesh key={`lz${z}`} position={[0, FLOOR + inH / 2, z * (D / 2 - T - 0.002)]}>
          <planeGeometry args={[W - 2 * T, inH]} />
          {lining}
        </mesh>
      ))}
      {[1, -1].map((x) => (
        <mesh key={`lx${x}`} position={[x * (W / 2 - T - 0.002), FLOOR + inH / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[D - 2 * T, inH]} />
          {lining}
        </mesh>
      ))}
      <mesh position={[0, FLOOR + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 2 * T, D - 2 * T]} />
        <meshStandardMaterial color={look.dark} roughness={0.95} />
      </mesh>
      {/* A thin rim along the top edge of the walls. */}
      {[1, -1].map((z) => (
        <mesh key={`rz${z}`} position={[0, H - 0.005, z * (D / 2 - T / 2)]}>
          <boxGeometry args={[W + 0.004, 0.012, T + 0.004]} />
          <meshStandardMaterial color={look.light} roughness={0.6} />
        </mesh>
      ))}
      {[1, -1].map((x) => (
        <mesh key={`rx${x}`} position={[x * (W / 2 - T / 2), H - 0.005, 0]}>
          <boxGeometry args={[T + 0.004, 0.012, D]} />
          <meshStandardMaterial color={look.light} roughness={0.6} />
        </mesh>
      ))}
      {/* The inked outline round the whole box. From above, its back faces sit under the floor. */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[W + 2 * O, H + 2 * O, D + 2 * O]} />
        <Ink />
      </mesh>
    </group>
  );
}

/** How long the jump takes when the lid flies open, in seconds. */
const BOUNCE = 0.55;

/**
 * A reward chest standing on its base. `shaking` rattles it like something wants out; `open` makes
 * it hop up, throw back its lid and glow.
 */
export function ChestArt({ kind, open = false, shaking = false }: { kind: ChestKind; open?: boolean; shaking?: boolean }) {
  const look = LOOKS[kind];
  const map = useMemo(() => paint(look, false), [look]);
  const lid = useRef<Group>(null);
  const body = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const halo = useRef<Sprite>(null);
  const lamp = useRef<PointLight>(null);
  /** Clock time the chest was opened, for the hop. */
  const openedAt = useRef<number | null>(null);
  const shine = useRef(0);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (open && openedAt.current === null) openedAt.current = t;
    if (!open) openedAt.current = null;
    const since = openedAt.current === null ? Infinity : t - openedAt.current;
    if (body.current) {
      const b = body.current;
      if (shaking) {
        // Rattles harder as it goes on.
        b.rotation.z = Math.sin(t * 40) * 0.09;
        b.position.y = Math.abs(Math.sin(t * 20)) * 0.05;
        b.scale.set(1, 1, 1);
      } else if (since < BOUNCE) {
        // Squash, then leap up and land with a little stretch.
        const p = since / BOUNCE;
        b.rotation.z = 0;
        b.position.y = Math.sin(p * Math.PI) * 0.45;
        const squash = p < 0.15 ? 1 - Math.sin((p / 0.15) * Math.PI) * 0.18 : 1 + Math.sin(p * Math.PI) * 0.08;
        b.scale.set(2 - squash, squash, 2 - squash);
      } else {
        b.rotation.z = 0;
        b.position.y += (0 - b.position.y) * Math.min(1, dt * 12);
        b.scale.set(1, 1, 1);
      }
    }
    if (lid.current) {
      // The lid bursts open at the top of the hop and settles shut gently.
      const want = open && since > BOUNCE * 0.3 ? -1.95 : 0;
      const r = lid.current.rotation;
      r.x += (want - r.x) * Math.min(1, dt * (open ? 10 : 5));
    }
    shine.current += ((open && since > BOUNCE * 0.3 ? 1 : 0) - shine.current) * Math.min(1, dt * 4);
    const s = shine.current;
    if (inner.current) inner.current.visible = s > 0.02;
    if (halo.current) {
      halo.current.visible = s > 0.02;
      const pulse = 1 + Math.sin(t * 2.2) * 0.05;
      halo.current.scale.setScalar(1.5 * s * pulse);
      halo.current.material.opacity = 0.55 * s;
    }
    if (lamp.current) lamp.current.intensity = 2.2 * s;
  });
  const wood = look.finish === "wood";
  return (
    <group ref={body}>
      <group position={[0, -H / 2, 0]}>
        <Shell look={look} map={map} wood={wood} />
        {/* Metal straps down the front and back near each end, with rivets, and a rim along the bottom.
            They sit on the outside of the walls so the hollow inside stays clear. */}
        {[-1, 1].map((s) => (
          <group key={`b${s}`}>
            {[1, -1].map((z) => (
              <InkBox key={z} size={[0.1, H + 0.02, 0.03]} position={[s * (W / 2 - 0.12), H / 2, z * (D / 2 + 0.005)]} outline={0.02}>
                <Metal color={look.band} />
              </InkBox>
            ))}
            <Rivets color={look.lock} points={[0.12, 0.26, 0.4].map((y) => [s * (W / 2 - 0.12), y, D / 2 + 0.025])} />
          </group>
        ))}
        <InkBox size={[W + 0.04, 0.08, D + 0.04]} position={[0, 0.04, 0]} outline={0.02}>
          <Metal color={look.band} />
        </InkBox>
        {/* The lock plate and its keyhole. */}
        <group position={[0, H - 0.08, D / 2 + 0.03]}>
          <InkBox size={[0.2, 0.22, 0.05]} outline={0.022}>
            <Metal color={look.lock} />
          </InkBox>
          <mesh position={[0, 0.02, 0.03]}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
            <meshBasicMaterial color="#14101f" />
          </mesh>
          <mesh position={[0, -0.04, 0.03]}>
            <boxGeometry args={[0.025, 0.07, 0.02]} />
            <meshBasicMaterial color="#14101f" />
          </mesh>
        </group>
        {/* Inside: a soft pool of light on the floor and a lamp lighting the walls and the lid. */}
        <group ref={inner} visible={false}>
          <mesh position={[0, FLOOR + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[W - 2 * T, D - 2 * T]} />
            <meshBasicMaterial map={glow()} color="#ffd98a" transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <pointLight ref={lamp} position={[0, H * 0.7, 0]} color="#ffd36b" intensity={0} distance={2.5} decay={1.5} />
        </group>
        <sprite ref={halo} position={[0, H + 0.5, -0.1]} visible={false}>
          <spriteMaterial map={glow()} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} opacity={0} />
        </sprite>
        {/* The lid hinges along the back edge. */}
        <group ref={lid} position={[0, H, -R]}>
          <group position={[0, 0, R]}>
            <Lid look={look} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Lights for a chest shown on its own: a warm key, a cool rim from behind and a soft fill. */
export function ChestLights() {
  return (
    <>
      <hemisphereLight args={["#fff6e8", "#5a3fb0", 1.1]} />
      <directionalLight position={[-2, 4, 3]} intensity={2.2} color="#fff1d6" />
      <directionalLight position={[2.5, 2, -3]} intensity={1.6} color="#9fd8ff" />
      <ambientLight intensity={0.25} />
    </>
  );
}
