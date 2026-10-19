import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { LANE_WIDTH } from "@/game/config";
import { mulberry32 } from "@/game/lanes";

// Small procedural greyscale textures, painted once and multiplied over each lane's ground colour.
// One texture tile covers one world unit, repeated along the lane.

export type GroundTexture = "grass" | "tiles" | "snow" | "road" | "water" | "gravel" | "sand" | "ash";

const SIZE = 32;
const cache = new Map<GroundTexture, CanvasTexture>();

function paint(kind: GroundTexture, ctx: CanvasRenderingContext2D) {
  const rng = mulberry32(kind.length * 7919 + kind.charCodeAt(0));
  const grey = (v: number) => `rgb(${v},${v},${v})`;
  ctx.fillStyle = grey(kind === "tiles" ? 250 : 246);
  ctx.fillRect(0, 0, SIZE, SIZE);
  const dots = (count: number, min: number, max: number, w: number, h: number) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = grey(Math.round(min + rng() * (max - min)));
      ctx.fillRect(Math.floor(rng() * SIZE), Math.floor(rng() * SIZE), w, h);
    }
  };
  switch (kind) {
    case "grass":
      // Darker blade tufts and a few sunlit tips.
      dots(40, 212, 232, 1, 2);
      dots(12, 255, 255, 1, 1);
      break;
    case "snow":
      dots(30, 226, 240, 2, 1);
      dots(10, 255, 255, 1, 1);
      break;
    case "tiles":
      // Paving slabs: a joint every half unit.
      ctx.fillStyle = grey(214);
      ctx.fillRect(0, 0, SIZE, 1);
      ctx.fillRect(0, SIZE / 2, SIZE, 1);
      ctx.fillRect(0, 0, 1, SIZE);
      ctx.fillRect(SIZE / 2, 0, 1, SIZE);
      dots(12, 232, 244, 1, 1);
      break;
    case "road":
      dots(90, 218, 240, 1, 1);
      dots(6, 200, 214, 2, 1);
      break;
    case "water":
      // Lighter ripple streaks running along the river.
      dots(10, 255, 255, 4, 1);
      dots(14, 226, 236, 3, 1);
      break;
    case "sand":
      // Wind ripples and a few grains catching the light.
      dots(16, 230, 238, 3, 1);
      dots(30, 255, 255, 1, 1);
      break;
    case "ash":
      // Cooled cinders with a dusting of pale ash.
      dots(60, 196, 226, 1, 1);
      dots(8, 180, 200, 2, 2);
      break;
    case "gravel":
      dots(70, 205, 240, 1, 1);
      dots(20, 255, 255, 1, 1);
      break;
  }
}

export function groundTexture(kind: GroundTexture) {
  let t = cache.get(kind);
  if (!t) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    paint(kind, canvas.getContext("2d")!);
    t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(LANE_WIDTH, 1);
    // Crisp texels keep the voxel look.
    t.magFilter = NearestFilter;
    cache.set(kind, t);
  }
  return t;
}
