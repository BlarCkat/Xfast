"use client";

import { BackSide } from "three";

// Shared pieces for the illustrated models: toon shading with a thick dark outline like the concept
// art. The outline is an inverted hull, a slightly larger copy of a shape that only shows its back
// faces, so it peeks out around the edges.

export const OUTLINE = "#14101f";

/** The dark shell drawn behind a shape for its inked outline. */
export const Ink = () => <meshBasicMaterial color={OUTLINE} side={BackSide} />;

/**
 * An upright cylinder (or, with few sides and a different top radius, a faceted frustum) with its
 * outline. `colors` paints the side, top and bottom separately.
 */
export function Drum({
  r,
  h,
  y = 0,
  color,
  colors,
  rTop = r,
  sides = 40,
  flat = false,
  outline = 0.035,
}: {
  r: number;
  h: number;
  y?: number;
  color?: string;
  colors?: [string, string, string];
  rTop?: number;
  sides?: number;
  flat?: boolean;
  outline?: number;
}) {
  const paint = colors ?? [color!, color!, color!];
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[rTop, r, h, sides]} />
        {paint.map((c, i) =>
          // Toon shading has no flat mode, so faceted gems use flat Lambert to tell their facets apart.
          flat ? (
            <meshLambertMaterial key={i} attach={`material-${i}`} color={c} flatShading />
          ) : (
            <meshToonMaterial key={i} attach={`material-${i}`} color={c} />
          ),
        )}
      </mesh>
      {outline > 0 && (
        <mesh>
          <cylinderGeometry args={[rTop + outline, r + outline, h + 2 * outline, sides]} />
          <Ink />
        </mesh>
      )}
    </group>
  );
}
