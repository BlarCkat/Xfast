"use client";

import { createContext, forwardRef, useContext, useLayoutEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  type Group,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TRAIN_CAR_LENGTH } from "@/game/config";
import type { PickupKind } from "@/game/lanes";
import type { CharacterId } from "@/game/wallet";

// Small voxel models built from boxes. Everything uses flat Lambert shading for the toy look.

type Size = [number, number, number];

type BoxProps = {
  size: Size;
  position?: [number, number, number];
  color: string;
  cast?: boolean;
  receive?: boolean;
  /** Emissive strength; above 1 it is bright enough to bloom. */
  glow?: number;
};

// Bevelled boxes soften the voxel edges so light rolls over them. Geometry is shared per size.
// Very thin parts (windows, stripes, markings) stay square, since a bevel there would not show.
const geometries = new Map<string, BufferGeometry>();
function roundedBox([w, h, d]: Size) {
  const key = `${w},${h},${d}`;
  let g = geometries.get(key);
  if (!g) {
    const thinnest = Math.min(w, h, d);
    g =
      thinnest < 0.09
        ? new BoxGeometry(w, h, d)
        : new RoundedBoxGeometry(w, h, d, 1, Math.min(0.07, thinnest * 0.3));
    // Keep every box non-indexed so any mix of them can be merged.
    if (g.index) g = g.toNonIndexed();
    geometries.set(key, g);
  }
  return g;
}

// Inside <Baked>, boxes are only markers; Baked merges them into a single mesh.
const BakeContext = createContext(false);

export function Box({ size, position = [0, 0, 0], color, cast = true, receive = false, glow }: BoxProps) {
  const baking = useContext(BakeContext);
  if (baking) return <object3D position={position} userData={{ box: size, color, glow }} />;
  return (
    <mesh position={position} castShadow={cast} receiveShadow={receive} geometry={roundedBox(size)}>
      {glow ? (
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} />
      ) : (
        <meshLambertMaterial color={color} />
      )}
    </mesh>
  );
}

// Baked meshes carry their lighting in vertex colours, so they render unlit and cost almost
// nothing to shade. The light matches Scene: a white/green hemisphere sky plus the sun.
const litMaterial = new MeshBasicMaterial({ vertexColors: true });
// Glowing parts skip lighting and tone mapping so their over-bright colours feed the bloom.
const glowMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });

export const SKY_COLOR = "#ffffff";
export const GROUND_COLOR = "#9bbf7a";
export const HEMI_INTENSITY = 1.4;
export const SUN_INTENSITY = 2.2;
/** Direction towards the sun, matching the directional light's offset from its target. */
export const SUN_OFFSET: [number, number, number] = [-4, 12, 6];

const sun = new Vector3(...SUN_OFFSET).normalize();
const sky = new Color(SKY_COLOR);
const ground = new Color(GROUND_COLOR);
const scratch = new Matrix4();
const tint = new Color();
const light = new Color();
const n = new Vector3();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Small stable per-box brightness wobble so neighbouring blocks don't look stamped out. */
const jitter = (x: number, y: number, z: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return 0.96 + (h - Math.floor(h)) * 0.08;
};

/** Mirrored boxes (scale -1 on x) come out inside out; swap two corners of every triangle. */
function flipWinding(g: BufferGeometry) {
  for (const name of ["position", "normal", "uv"]) {
    const attr = g.getAttribute(name);
    if (!attr) continue;
    const a = attr.array as Float32Array;
    const size = attr.itemSize;
    for (let v = 0; v < attr.count; v += 3) {
      for (let k = 0; k < size; k++) {
        const i1 = (v + 1) * size + k;
        const i2 = (v + 2) * size + k;
        const t = a[i1];
        a[i1] = a[i2];
        a[i2] = t;
      }
    }
  }
}

type Part = { geometry: BufferGeometry; color: string; glow?: number; center: Vector3 };

function bake(source: Object3D) {
  source.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(source.matrixWorld).invert();
  const parts: Part[] = [];
  const visit = (o: Object3D) => {
    o.children.forEach((c) => c.visible && visit(c));
    const { box, color, glow } = o.userData as { box?: Size; color?: string; glow?: number };
    if (!box || !color) return;
    const geometry = roundedBox(box).clone();
    scratch.multiplyMatrices(toLocal, o.matrixWorld);
    geometry.applyMatrix4(scratch);
    if (scratch.determinant() < 0) flipWinding(geometry);
    parts.push({ geometry, color, glow, center: new Vector3().setFromMatrixPosition(scratch) });
  };
  visit(source);
  if (parts.length === 0) return { geometry: null, materials: [] };

  // Darken towards the lowest point of the model: cheap baked ambient occlusion at the base.
  let floor = Infinity;
  for (const p of parts) {
    const pos = p.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) floor = Math.min(floor, pos.getY(i));
  }

  const lit: BufferGeometry[] = [];
  const glowing: BufferGeometry[] = [];
  for (const { geometry, color, glow, center } of parts) {
    const pos = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const colors = new Float32Array(pos.count * 3);
    tint.set(color);
    if (glow) {
      tint.multiplyScalar(0.8 + glow);
      for (let i = 0; i < pos.count; i++) tint.toArray(colors, i * 3);
    } else {
      const wobble = jitter(center.x, center.y, center.z);
      for (let i = 0; i < pos.count; i++) {
        n.fromBufferAttribute(normal, i);
        // Same terms as three's Lambert: (hemisphere + sun * N.L) / PI.
        light.copy(ground).lerp(sky, n.y * 0.5 + 0.5).multiplyScalar(HEMI_INTENSITY);
        light.addScalar(Math.max(0, n.dot(sun)) * SUN_INTENSITY);
        light.multiplyScalar(1 / Math.PI);
        const ao = 0.62 + 0.38 * smoothstep(0, 0.5, pos.getY(i) - floor);
        // Bevel faces catch a little extra light, like a worn edge.
        const edge = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)) < 0.98 ? 1.07 : 1;
        light.multiplyScalar(ao * edge * wobble);
        colors[i * 3] = tint.r * light.r;
        colors[i * 3 + 1] = tint.g * light.g;
        colors[i * 3 + 2] = tint.b * light.b;
      }
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    (glow ? glowing : lit).push(geometry);
  }

  const groups = [lit, glowing].filter((list) => list.length > 0);
  const geometry = mergeGeometries(groups.map((list) => mergeGeometries(list)), true);
  const materials = groups.map((list) => (list === lit ? litMaterial : glowMaterial));
  [...lit, ...glowing].forEach((g) => g.dispose());
  return { geometry, materials };
}

/**
 * Collapses every <Box> inside it into one mesh (two when some boxes glow), so a whole car or a
 * lane of trees costs one draw call instead of dozens. Bump `version` when the contents change.
 */
export function Baked({
  children,
  version = 0,
  shadows = true,
}: {
  children: React.ReactNode;
  version?: number;
  shadows?: boolean;
}) {
  const source = useRef<Group>(null);
  const [mesh] = useState(() => {
    const m = new Mesh();
    m.castShadow = shadows;
    return m;
  });
  useLayoutEffect(() => {
    const src = source.current;
    if (!src) return;
    const { geometry, materials } = bake(src);
    // The markers are only needed while baking; keep them out of rendering and matrix updates.
    src.visible = false;
    src.matrixWorldAutoUpdate = false;
    mesh.visible = geometry !== null;
    if (geometry) {
      mesh.geometry = geometry;
      mesh.material = materials.length === 1 ? materials[0] : materials;
    }
    return () => geometry?.dispose();
  }, [mesh, version]);
  return (
    <>
      <primitive object={mesh} />
      <group ref={source}>
        <BakeContext.Provider value={true}>{children}</BakeContext.Provider>
      </group>
    </>
  );
}

/**
 * The chicken faces -z when rotation is 0. Dressed like the key art: a cream cap with a blue brim,
 * a boombox on its shoulder, sleepy eyes and chunky sneakers.
 */
export function Chicken() {
  const white = "#ffffff";
  const shade = "#e4ecf2";
  const red = "#d8352a";
  return (
    <group>
      {/* Sneakers: cream soles, purple-blue uppers with a red flash, yellow laces */}
      {[0.17, -0.17].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[0.23, 0.07, 0.4]} position={[0, 0.035, -0.08]} color="#f1ead6" />
          <Box size={[0.21, 0.12, 0.32]} position={[0, 0.13, -0.06]} color="#5b4fd0" />
          <Box size={[0.22, 0.07, 0.07]} position={[0, 0.1, -0.25]} color="#f1ead6" />
          <Box size={[0.22, 0.07, 0.12]} position={[0, 0.12, 0.05]} color="#d9364a" />
          <Box size={[0.13, 0.03, 0.16]} position={[0, 0.2, -0.12]} color="#f5c542" cast={false} />
          <Box size={[0.1, 0.08, 0.1]} position={[x > 0 ? -0.04 : 0.04, 0.22, 0.01]} color="#f08f2e" />
        </group>
      ))}
      {/* Round body with a pale belly and folded wings */}
      <Box size={[0.56, 0.5, 0.56]} position={[0, 0.46, 0.04]} color={white} />
      <Box size={[0.44, 0.3, 0.06]} position={[0, 0.42, -0.25]} color={shade} cast={false} />
      <Box size={[0.08, 0.22, 0.32]} position={[0.31, 0.46, 0.08]} color={shade} />
      <Box size={[0.08, 0.22, 0.32]} position={[-0.31, 0.46, 0.08]} color={shade} />
      {/* Tail plume sweeping up and back */}
      <Box size={[0.3, 0.18, 0.12]} position={[0, 0.58, 0.36]} color={white} />
      <Box size={[0.24, 0.2, 0.12]} position={[0, 0.72, 0.44]} color={white} />
      <Box size={[0.16, 0.18, 0.1]} position={[0, 0.88, 0.48]} color={shade} />
      {/* Head, beak, wattle */}
      <Box size={[0.42, 0.34, 0.4]} position={[0, 0.84, -0.08]} color={white} />
      <Box size={[0.16, 0.1, 0.16]} position={[0, 0.8, -0.35]} color="#f2a01f" />
      <Box size={[0.1, 0.13, 0.06]} position={[0, 0.66, -0.31]} color={red} />
      {/* Sleepy eyes: red rims, heavy lids, pupils peeking from below */}
      {[0.12, -0.12].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[0.13, 0.12, 0.04]} position={[0, 0.88, -0.285]} color="#c8322a" cast={false} />
          <Box size={[0.09, 0.08, 0.03]} position={[0, 0.875, -0.3]} color="#ece6d4" cast={false} />
          <Box size={[0.05, 0.04, 0.03]} position={[x > 0 ? -0.01 : 0.01, 0.86, -0.31]} color="#141414" cast={false} />
          <Box size={[0.1, 0.03, 0.03]} position={[0, 0.915, -0.31]} color="#141414" cast={false} />
        </group>
      ))}
      {/* Cap: cream crown, purple back panel, red lettering stripe, blue brim; the comb pokes out on top */}
      <Box size={[0.46, 0.14, 0.42]} position={[0, 1.07, -0.06]} color="#ebe3c8" />
      <Box size={[0.47, 0.14, 0.14]} position={[0, 1.07, 0.11]} color="#6a4bb0" />
      <Box size={[0.26, 0.05, 0.03]} position={[0, 1.08, -0.275]} color={red} cast={false} />
      <Box size={[0.44, 0.04, 0.2]} position={[0, 0.99, -0.34]} color="#2f5bd1" />
      <Box size={[0.12, 0.12, 0.2]} position={[0, 1.2, -0.04]} color={red} />
      <Box size={[0.1, 0.08, 0.1]} position={[0, 1.28, 0.06]} color={red} />
      {/* Boombox resting on the shoulder, with speakers, a sticker, handle and antenna */}
      <group position={[-0.37, 0.86, 0]}>
        <Box size={[0.14, 0.24, 0.4]} color="#3d4d52" />
        <Box size={[0.03, 0.12, 0.12]} position={[-0.075, 0, -0.1]} color="#9aa7aa" cast={false} />
        <Box size={[0.03, 0.12, 0.12]} position={[-0.075, 0, 0.1]} color="#9aa7aa" cast={false} />
        <Box size={[0.03, 0.05, 0.05]} position={[-0.075, -0.08, 0]} color="#f2c230" cast={false} />
        <Box size={[0.04, 0.04, 0.32]} position={[0, 0.17, 0]} color="#2b3639" />
        <Box size={[0.04, 0.06, 0.04]} position={[0, 0.14, -0.14]} color="#2b3639" />
        <Box size={[0.04, 0.06, 0.04]} position={[0, 0.14, 0.14]} color="#2b3639" />
        <Box size={[0.02, 0.36, 0.02]} position={[0, 0.3, 0.16]} color="#b8c0c2" cast={false} />
      </group>
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
        <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.38, 0.25]} color="#fff6b0" glow={2.5} />
        <Box size={[0.06, 0.12, 0.18]} position={[length / 2, 0.38, -0.25]} color="#fff6b0" glow={2.5} />
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

export const Train = forwardRef<Group, { cars: number; dir: number; colors?: string[] }>(function Train(
  { cars, dir, colors = TRAIN_COLORS },
  ref,
) {
  const total = cars * TRAIN_CAR_LENGTH;
  return (
    <group ref={ref}>
      <Baked>
      <group scale={[dir, 1, 1]}>
        {Array.from({ length: cars }, (_, i) => {
          const x = total / 2 - TRAIN_CAR_LENGTH * (i + 0.5);
          const color = i === 0 ? colors[0] : colors[(i % (colors.length - 1)) + 1];
          return (
            <group key={i} position={[x, 0, 0]}>
              <Box size={[TRAIN_CAR_LENGTH - 0.2, 1.1, 0.9]} position={[0, 0.7, 0]} color={color} />
              <Box size={[TRAIN_CAR_LENGTH - 0.4, 0.12, 0.92]} position={[0, 1.0, 0]} color="#f4f4f4" />
              <Box size={[TRAIN_CAR_LENGTH - 0.4, 0.2, 0.7]} position={[0, 0.1, 0]} color="#333" />
              {i === 0 && (
                <>
                  <Box size={[0.08, 0.3, 0.6]} position={[TRAIN_CAR_LENGTH / 2 - 0.12, 0.9, 0]} color="#2c3e50" />
                  <Box size={[0.08, 0.14, 0.2]} position={[TRAIN_CAR_LENGTH / 2 - 0.1, 0.45, 0]} color="#fff6b0" glow={2.5} />
                </>
              )}
            </group>
          );
        })}
      </group>
      </Baked>
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

export function Cat() {
  const fur = "#f2a25c";
  const stripe = "#d9823a";
  return (
    <group>
      <Box size={[0.5, 0.42, 0.62]} position={[0, 0.34, 0.06]} color={fur} />
      <Box size={[0.52, 0.06, 0.12]} position={[0, 0.46, 0.14]} color={stripe} cast={false} />
      <Box size={[0.52, 0.06, 0.12]} position={[0, 0.46, 0.32]} color={stripe} cast={false} />
      <Box size={[0.36, 0.08, 0.4]} position={[0, 0.14, 0.04]} color="#fff3e6" cast={false} />
      <Box size={[0.46, 0.38, 0.4]} position={[0, 0.72, -0.16]} color={fur} />
      <Box size={[0.12, 0.14, 0.1]} position={[0.15, 0.97, -0.16]} color={fur} />
      <Box size={[0.12, 0.14, 0.1]} position={[-0.15, 0.97, -0.16]} color={fur} />
      <Box size={[0.06, 0.08, 0.11]} position={[0.15, 0.96, -0.16]} color="#f7c6c6" cast={false} />
      <Box size={[0.06, 0.08, 0.11]} position={[-0.15, 0.96, -0.16]} color="#f7c6c6" cast={false} />
      <Box size={[0.22, 0.12, 0.06]} position={[0, 0.64, -0.37]} color="#fff3e6" />
      <Box size={[0.06, 0.05, 0.04]} position={[0, 0.69, -0.4]} color="#e57373" />
      <Box size={[0.07, 0.1, 0.04]} position={[0.12, 0.78, -0.37]} color="#2e7d32" />
      <Box size={[0.07, 0.1, 0.04]} position={[-0.12, 0.78, -0.37]} color="#2e7d32" />
      <Box size={[0.1, 0.1, 0.36]} position={[0, 0.5, 0.52]} color={stripe} />
      <Box size={[0.1, 0.26, 0.1]} position={[0, 0.66, 0.66]} color={fur} />
      {[-0.14, 0.14].map((x) =>
        [-0.12, 0.24].map((z) => (
          <Box key={`${x}${z}`} size={[0.12, 0.14, 0.12]} position={[x, 0.07, z]} color="#fff3e6" />
        )),
      )}
    </group>
  );
}

export function Sparrow() {
  const brown = "#8d6e4f";
  return (
    <group>
      <Box size={[0.46, 0.4, 0.56]} position={[0, 0.36, 0.04]} color={brown} />
      <Box size={[0.36, 0.26, 0.36]} position={[0, 0.3, -0.12]} color="#e8d9c0" />
      <Box size={[0.36, 0.32, 0.34]} position={[0, 0.7, -0.12]} color="#a47552" />
      <Box size={[0.3, 0.1, 0.3]} position={[0, 0.9, -0.12]} color="#6d4c33" />
      <Box size={[0.1, 0.08, 0.14]} position={[0, 0.66, -0.34]} color="#3b3b3b" />
      <Box size={[0.06, 0.07, 0.04]} position={[0.13, 0.74, -0.29]} color="#111111" />
      <Box size={[0.06, 0.07, 0.04]} position={[-0.13, 0.74, -0.29]} color="#111111" />
      <Box size={[0.08, 0.26, 0.38]} position={[0.26, 0.4, 0.08]} color="#6d4c33" />
      <Box size={[0.08, 0.26, 0.38]} position={[-0.26, 0.4, 0.08]} color="#6d4c33" />
      <Box size={[0.24, 0.08, 0.26]} position={[0, 0.46, 0.42]} color="#6d4c33" />
      <Box size={[0.06, 0.16, 0.06]} position={[0.1, 0.08, 0]} color="#d4a373" />
      <Box size={[0.06, 0.16, 0.06]} position={[-0.1, 0.08, 0]} color="#d4a373" />
    </group>
  );
}

export function Snail() {
  return (
    <group>
      <Box size={[0.4, 0.2, 0.84]} position={[0, 0.1, 0]} color="#c9b48a" />
      <Box size={[0.32, 0.36, 0.24]} position={[0, 0.3, -0.34]} color="#c9b48a" />
      <Box size={[0.05, 0.22, 0.05]} position={[0.1, 0.56, -0.4]} color="#b39d72" />
      <Box size={[0.05, 0.22, 0.05]} position={[-0.1, 0.56, -0.4]} color="#b39d72" />
      <Box size={[0.08, 0.08, 0.08]} position={[0.1, 0.69, -0.4]} color="#222222" />
      <Box size={[0.08, 0.08, 0.08]} position={[-0.1, 0.69, -0.4]} color="#222222" />
      <Box size={[0.5, 0.56, 0.56]} position={[0, 0.48, 0.12]} color="#d9773b" />
      <Box size={[0.52, 0.36, 0.36]} position={[0, 0.48, 0.12]} color="#f2b56b" />
      <Box size={[0.54, 0.16, 0.16]} position={[0, 0.48, 0.12]} color="#a8532a" />
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

/** Cap, moustache and overalls; Mario and Luigi share the build and differ in colour and height. */
function Plumber({ shirt, tall }: { shirt: string; tall: boolean }) {
  const skin = "#f6c49a";
  const blue = "#2c4fc4";
  const lift = tall ? 0.1 : 0;
  return (
    <group>
      {/* Boots and legs */}
      <Box size={[0.16, 0.1, 0.24]} position={[0.12, 0.05, -0.03]} color="#6b3a1e" />
      <Box size={[0.16, 0.1, 0.24]} position={[-0.12, 0.05, -0.03]} color="#6b3a1e" />
      <Box size={[0.15, 0.14 + lift, 0.16]} position={[0.12, 0.17 + lift / 2, 0]} color={blue} />
      <Box size={[0.15, 0.14 + lift, 0.16]} position={[-0.12, 0.17 + lift / 2, 0]} color={blue} />
      {/* Overalls over the shirt */}
      <Box size={[0.48, 0.24, 0.4]} position={[0, 0.34 + lift, 0]} color={blue} />
      <Box size={[0.5, 0.2, 0.4]} position={[0, 0.54 + lift, 0]} color={shirt} />
      <Box size={[0.3, 0.14, 0.06]} position={[0, 0.52 + lift, -0.2]} color={blue} cast={false} />
      <Box size={[0.06, 0.06, 0.03]} position={[0.1, 0.56 + lift, -0.235]} color="#f6c90e" cast={false} />
      <Box size={[0.06, 0.06, 0.03]} position={[-0.1, 0.56 + lift, -0.235]} color="#f6c90e" cast={false} />
      {/* Arms and white gloves */}
      <Box size={[0.12, 0.24, 0.14]} position={[0.31, 0.5 + lift, 0]} color={shirt} />
      <Box size={[0.12, 0.24, 0.14]} position={[-0.31, 0.5 + lift, 0]} color={shirt} />
      <Box size={[0.13, 0.11, 0.15]} position={[0.31, 0.34 + lift, 0]} color="#ffffff" />
      <Box size={[0.13, 0.11, 0.15]} position={[-0.31, 0.34 + lift, 0]} color="#ffffff" />
      {/* Head, nose, moustache and eyes */}
      <Box size={[0.42, 0.34, 0.38]} position={[0, 0.81 + lift, 0]} color={skin} />
      <Box size={[0.12, 0.1, 0.1]} position={[0, 0.78 + lift, -0.22]} color="#f0a77c" />
      <Box size={[0.3, 0.06, 0.05]} position={[0, 0.71 + lift, -0.205]} color="#3b2414" cast={false} />
      <Box size={[0.05, 0.08, 0.03]} position={[0.1, 0.87 + lift, -0.195]} color="#1f2a6b" cast={false} />
      <Box size={[0.05, 0.08, 0.03]} position={[-0.1, 0.87 + lift, -0.195]} color="#1f2a6b" cast={false} />
      <Box size={[0.44, 0.1, 0.12]} position={[0, 0.82 + lift, 0.18]} color="#3b2414" cast={false} />
      {/* Cap with its brim and emblem */}
      <Box size={[0.46, 0.14, 0.42]} position={[0, 1.04 + lift, 0.01]} color={shirt} />
      <Box size={[0.44, 0.04, 0.16]} position={[0, 0.97 + lift, -0.26]} color={shirt} />
      <Box size={[0.12, 0.1, 0.03]} position={[0, 1.04 + lift, -0.205]} color="#ffffff" cast={false} />
    </group>
  );
}

export function Mario() {
  return <Plumber shirt="#e0312b" tall={false} />;
}

export function Luigi() {
  return <Plumber shirt="#2ea043" tall />;
}

export function Bowser() {
  const scale = "#7cb342";
  const belly = "#f4d58d";
  const horn = "#f5f0e1";
  return (
    <group>
      {/* Feet and legs */}
      <Box size={[0.2, 0.12, 0.26]} position={[0.16, 0.06, -0.04]} color={belly} />
      <Box size={[0.2, 0.12, 0.26]} position={[-0.16, 0.06, -0.04]} color={belly} />
      <Box size={[0.18, 0.14, 0.2]} position={[0.16, 0.18, 0.02]} color={scale} />
      <Box size={[0.18, 0.14, 0.2]} position={[-0.16, 0.18, 0.02]} color={scale} />
      {/* Body, belly plates and the spiked shell */}
      <Box size={[0.56, 0.44, 0.46]} position={[0, 0.46, 0.02]} color={scale} />
      <Box size={[0.4, 0.36, 0.06]} position={[0, 0.45, -0.22]} color={belly} />
      <Box size={[0.42, 0.04, 0.03]} position={[0, 0.52, -0.255]} color="#d9b46a" cast={false} />
      <Box size={[0.42, 0.04, 0.03]} position={[0, 0.4, -0.255]} color="#d9b46a" cast={false} />
      <Box size={[0.62, 0.5, 0.2]} position={[0, 0.52, 0.3]} color="#2e7d32" />
      <Box size={[0.66, 0.06, 0.24]} position={[0, 0.28, 0.3]} color={horn} />
      {[-0.17, 0.17].map((x) =>
        [0.38, 0.6].map((y) => (
          <Box key={`${x}${y}`} size={[0.1, 0.1, 0.12]} position={[x, y, 0.45]} color={horn} />
        )),
      )}
      <Box size={[0.12, 0.12, 0.2]} position={[0, 0.3, 0.52]} color={scale} />
      {/* Arms with spiked cuffs */}
      <Box size={[0.14, 0.26, 0.16]} position={[0.35, 0.48, -0.04]} color={scale} />
      <Box size={[0.14, 0.26, 0.16]} position={[-0.35, 0.48, -0.04]} color={scale} />
      <Box size={[0.17, 0.07, 0.19]} position={[0.35, 0.58, -0.04]} color="#2b2b2b" />
      <Box size={[0.17, 0.07, 0.19]} position={[-0.35, 0.58, -0.04]} color="#2b2b2b" />
      {/* Head, snout, fangs, eyes, brows, horns and red mane */}
      <Box size={[0.44, 0.34, 0.38]} position={[0, 0.88, -0.06]} color={scale} />
      <Box size={[0.36, 0.16, 0.16]} position={[0, 0.8, -0.3]} color={belly} />
      <Box size={[0.05, 0.06, 0.04]} position={[0.1, 0.71, -0.36]} color={horn} cast={false} />
      <Box size={[0.05, 0.06, 0.04]} position={[-0.1, 0.71, -0.36]} color={horn} cast={false} />
      <Box size={[0.08, 0.04, 0.04]} position={[0.08, 0.86, -0.39]} color="#3b2414" cast={false} />
      <Box size={[0.08, 0.04, 0.04]} position={[-0.08, 0.86, -0.39]} color="#3b2414" cast={false} />
      <Box size={[0.09, 0.1, 0.04]} position={[0.12, 0.95, -0.255]} color="#ffffff" cast={false} />
      <Box size={[0.09, 0.1, 0.04]} position={[-0.12, 0.95, -0.255]} color="#ffffff" cast={false} />
      <Box size={[0.04, 0.07, 0.03]} position={[0.12, 0.94, -0.28]} color="#c62828" cast={false} />
      <Box size={[0.04, 0.07, 0.03]} position={[-0.12, 0.94, -0.28]} color="#c62828" cast={false} />
      <Box size={[0.16, 0.05, 0.05]} position={[0.12, 1.02, -0.26]} color="#e65100" cast={false} />
      <Box size={[0.16, 0.05, 0.05]} position={[-0.12, 1.02, -0.26]} color="#e65100" cast={false} />
      <Box size={[0.08, 0.16, 0.08]} position={[0.2, 1.1, -0.02]} color={horn} />
      <Box size={[0.08, 0.16, 0.08]} position={[-0.2, 1.1, -0.02]} color={horn} />
      <Box size={[0.3, 0.14, 0.26]} position={[0, 1.08, 0.08]} color="#e65100" />
      <Box size={[0.2, 0.12, 0.14]} position={[0, 0.98, 0.2]} color="#e65100" />
    </group>
  );
}

/** Bowser's fire breath: a short glowing jet that rolls out in front of him. */
export function FireBreath() {
  return (
    <group>
      <Box size={[0.22, 0.22, 0.5]} position={[0, 0.8, -0.6]} color="#ffd54f" glow={2.4} cast={false} />
      <Box size={[0.32, 0.32, 0.6]} position={[0, 0.8, -1.1]} color="#ff9800" glow={2.2} cast={false} />
      <Box size={[0.44, 0.44, 0.7]} position={[0, 0.82, -1.7]} color="#ff5722" glow={2} cast={false} />
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
    case "sparrow":
      return <Sparrow />;
    case "snail":
      return <Snail />;
    case "cat":
      return <Cat />;
    case "robot":
      return <Robot />;
    case "mario":
      return <Mario />;
    case "luigi":
      return <Luigi />;
    case "bowser":
      return <Bowser />;
    default:
      return <Chicken />;
  }
}

export function Coin() {
  return (
    <group>
      <Box size={[0.38, 0.38, 0.08]} position={[0, 0, 0]} color="#ffc928" glow={0.6} />
      <Box size={[0.26, 0.26, 0.1]} position={[0, 0, 0]} color="#ffe27a" cast={false} glow={1.2} />
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
