import { COLS, TRAIN_CAR_LENGTH, WRAP } from "./config";

export type LaneType = "grass" | "road" | "river" | "rail";
export type MoverKind = "car" | "truck" | "log";

export interface Mover {
  x: number;
  length: number;
  kind: MoverKind;
  color: string;
}

export interface Tree {
  x: number;
  height: number;
}

export interface Lane {
  row: number;
  type: LaneType;
  /** Blocked integer columns on grass (playable area only). */
  blocked: Set<number>;
  trees: Tree[];
  movers: Mover[];
  /** Signed speed in units/second (positive = moving towards +x). */
  speed: number;
  /** Rail state. */
  train: { x: number; active: boolean; timer: number; cars: number; warning: boolean };
  /** True when the previous lane is the same kind (draws lane markings). */
  continued: boolean;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CAR_COLORS = ["#e94f37", "#f6c90e", "#3f88c5", "#44bba4", "#f49d37", "#a663cc", "#ffffff"];
const TRUCK_COLORS = ["#3f88c5", "#e94f37", "#44bba4", "#f6f6f6"];

const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const pick = <T,>(rng: Rng, items: T[]) => items[Math.floor(rng() * items.length)];
const randInt = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));

function emptyLane(row: number, type: LaneType): Lane {
  return {
    row,
    type,
    blocked: new Set(),
    trees: [],
    movers: [],
    speed: 0,
    train: { x: 0, active: false, timer: 0, cars: 0, warning: false },
    continued: false,
  };
}

/**
 * Endless lane generator. Lanes come in groups of one type, getting faster and
 * denser as the row number climbs. A random-walking "path column" is kept free
 * of trees so consecutive grass lanes are always passable.
 */
export class LaneGenerator {
  private rng: Rng;
  private groupType: LaneType = "grass";
  private groupLeft = 0;
  private pathCol = 0;
  private lastRiverDir = 1;
  private lastType: LaneType = "grass";

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  /** Rows must be requested in increasing order starting from the first row behind the start. */
  next(row: number): Lane {
    if (row <= 0) {
      const lane = this.grass(row, row <= -3 ? 1 : row < 0 ? 0.35 : 0);
      this.lastType = "grass";
      return lane;
    }
    if (row <= 2) {
      this.lastType = "grass";
      return this.grass(row, 0.12);
    }

    if (this.groupLeft <= 0) this.pickGroup(row);
    this.groupLeft--;

    const difficulty = Math.min(1, row / 160);
    let lane: Lane;
    switch (this.groupType) {
      case "road":
        lane = this.road(row, difficulty);
        break;
      case "river":
        lane = this.river(row, difficulty);
        break;
      case "rail":
        lane = this.rail(row);
        break;
      default:
        lane = this.grass(row, 0.18 + difficulty * 0.2);
    }
    lane.continued = lane.type === this.lastType;
    this.lastType = lane.type;
    return lane;
  }

  private pickGroup(row: number) {
    const rng = this.rng;
    const difficulty = Math.min(1, row / 160);
    if (this.groupType !== "grass" && rng() < 0.7) {
      this.groupType = "grass";
      this.groupLeft = randInt(rng, 1, 2);
      return;
    }
    const r = rng();
    if (r < 0.45) {
      this.groupType = "road";
      this.groupLeft = randInt(rng, 1, 3 + Math.round(difficulty * 2));
    } else if (r < 0.72) {
      this.groupType = "river";
      this.groupLeft = randInt(rng, 1, 3);
    } else if (r < 0.88) {
      this.groupType = "rail";
      this.groupLeft = randInt(rng, 1, 2);
    } else {
      this.groupType = "grass";
      this.groupLeft = randInt(rng, 1, 3);
    }
  }

  private grass(row: number, density: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "grass");
    const prevPath = this.pathCol;
    // Keep the opening rows straight ahead clear, then let the guaranteed path wander.
    if (row > 2) this.pathCol = Math.max(-COLS, Math.min(COLS, this.pathCol + randInt(rng, -1, 1)));
    for (let x = -WRAP; x <= WRAP; x++) {
      const inside = Math.abs(x) <= COLS;
      if (inside) {
        if (row === 0 && Math.abs(x) <= 1) continue;
        if (density < 1 && (x === this.pathCol || x === prevPath)) continue;
        if (rng() >= density) continue;
        lane.blocked.add(x);
      } else if (rng() > 0.55) {
        continue;
      }
      lane.trees.push({ x, height: randInt(rng, 1, 3) });
    }
    return lane;
  }

  private road(row: number, difficulty: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "road");
    const truck = rng() < 0.3;
    const dir = rng() < 0.5 ? -1 : 1;
    const base = truck ? range(rng, 1.4, 2.4) : range(rng, 1.8, 3.6);
    lane.speed = dir * base * (1 + difficulty * 0.9);
    const length = truck ? 2.6 : 1.5;
    const count = randInt(rng, 3, 4) + Math.round(difficulty * 2);
    const spacing = (WRAP * 2) / count;
    const color = truck ? pick(rng, TRUCK_COLORS) : null;
    const jitterMax = Math.max(0, (spacing - length - 2.2) / 2);
    for (let i = 0; i < count; i++) {
      lane.movers.push({
        x: -WRAP + spacing * i + range(rng, -jitterMax, jitterMax),
        length,
        kind: truck ? "truck" : "car",
        color: color ?? pick(rng, CAR_COLORS),
      });
    }
    return lane;
  }

  private river(row: number, difficulty: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "river");
    const dir = this.lastType === "river" ? -this.lastRiverDir : rng() < 0.5 ? -1 : 1;
    this.lastRiverDir = dir;
    lane.speed = dir * range(rng, 1.1, 2.2) * (1 + difficulty * 0.5);
    let x = -WRAP + range(rng, 0, 1.5);
    while (true) {
      const length = randInt(rng, 2, 4 - Math.round(difficulty));
      if (x + length > WRAP - 1.2) break;
      lane.movers.push({ x: x + length / 2, length, kind: "log", color: "#8b5a2b" });
      x += length + range(rng, 1.2, 2.6 + difficulty * 1.5);
    }
    return lane;
  }

  private rail(row: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "rail");
    lane.speed = (rng() < 0.5 ? -1 : 1) * 1;
    lane.train.timer = range(rng, 1.5, 6);
    lane.train.cars = randInt(rng, 3, 5);
    return lane;
  }
}

export const trainLength = (lane: Lane) => lane.train.cars * TRAIN_CAR_LENGTH;
