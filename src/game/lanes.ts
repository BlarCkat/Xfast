import { COLS, TRAIN_CAR_LENGTH, UNDERWATER_ROWS, WRAP } from "./config";
import { BIOMES, biomeAt, type BiomeId } from "./biomes";
import { foundChest, type ChestKind } from "./chests";
import { collectingEvent, type EventId } from "./events";
import { POWERUP_KEYS, type PowerUp } from "./powerups";

export type LaneType = "grass" | "road" | "river" | "rail";
export type MoverKind = "car" | "truck" | "log";
export type PickupKind = "life" | PowerUp;

export interface Pickup {
  x: number;
  kind: PickupKind;
}

export interface Mover {
  x: number;
  length: number;
  kind: MoverKind;
  color: string;
  /** Seconds since a rock-powered chicken wrecked this vehicle; null while intact. */
  wrecked: number | null;
}

export interface Tree {
  x: number;
  height: number;
}

export interface Lane {
  row: number;
  type: LaneType;
  /** Which themed biome this lane belongs to (visual only). */
  biome: BiomeId;
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
  /** A collectible sitting on this lane, removed once picked up. */
  pickup: Pickup | null;
  /** A reward chest sitting on this lane, removed once picked up. */
  chest: { x: number; kind: ChestKind } | null;
  /** Column of a coin on this lane, or null. */
  coin: number | null;
  /** A holiday event's special item sitting on this lane, removed once picked up. */
  special: { x: number; event: EventId } | null;
  /** The river where a diving duck comes back up; its open water is safe to paddle in. */
  exit?: boolean;
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

const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const pick = <T,>(rng: Rng, items: T[]) => items[Math.floor(rng() * items.length)];
const randInt = (rng: Rng, min: number, max: number) => Math.floor(range(rng, min, max + 1));

function emptyLane(row: number, type: LaneType, biome: BiomeId): Lane {
  return {
    row,
    type,
    biome,
    blocked: new Set(),
    trees: [],
    movers: [],
    speed: 0,
    train: { x: 0, active: false, timer: 0, cars: 0, warning: false },
    continued: false,
    pickup: null,
    chest: null,
    coin: null,
    special: null,
  };
}

// Roughly one in seven grass or road lanes carries a collectible.
const PICKUP_CHANCE = 1 / 7;
// Of those collectibles, this share are extra lives; the rest are power-ups.
export const LIFE_CHANCE = 0.2;
const POWERUPS: PickupKind[] = POWERUP_KEYS;
/** Of those collectibles, this share are reward chests instead. */
export const CHEST_CHANCE = 0.05;
const COIN_CHANCE = 0.35;
/** Score where lanes start getting busier, and how many rows the ramp takes to max out. */
export const DIFFICULTY_START = 500;
const DIFFICULTY_RAMP = 500;
export const difficultyAt = (row: number) =>
  Math.max(0, Math.min(1, (row - DIFFICULTY_START) / DIFFICULTY_RAMP));

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
  private biome: BiomeId = biomeAt(0);
  /** Rows of the duck's current dive: seabed from `from`, surfacing in the river at `exit`. */
  private underwater: { from: number; exit: number } | null = null;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  /**
   * Swap the world ahead for the seabed, starting at `row` with column `col` clear.
   * The caller drops every lane from `row` on and requests them again.
   */
  dive(row: number, col: number) {
    this.underwater = { from: row, exit: row + UNDERWATER_ROWS };
    this.biome = "underwater";
    this.pathCol = col;
    this.groupType = "grass";
    this.groupLeft = 0;
    this.lastType = "grass";
  }

  /** Rows must be requested in increasing order starting from the first row behind the start. */
  next(row: number): Lane {
    if (this.underwater) return this.nextUnderwater(row, this.underwater);
    if (row <= 0) {
      const lane = this.grass(row, row <= -3 ? 1 : row < 0 ? 0.35 : 0);
      this.lastType = "grass";
      return lane;
    }
    if (row <= 2) {
      this.lastType = "grass";
      return this.grass(row, 0.12);
    }

    if (this.groupLeft <= 0) {
      const biome = biomeAt(row);
      if (biome !== this.biome) {
        // Enter a new biome on a short strip of grass so roads and rivers never change mid-group.
        this.biome = biome;
        this.groupType = "grass";
        this.groupLeft = 2;
      } else {
        this.pickGroup(row);
      }
    }
    this.groupLeft--;

    const difficulty = difficultyAt(row);
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
    this.placePickup(lane);
    return lane;
  }

  private nextUnderwater(row: number, dive: { from: number; exit: number }): Lane {
    const difficulty = difficultyAt(row);
    let lane: Lane;
    if (row === dive.from) {
      // Land on open seabed.
      lane = this.grass(row, 0);
    } else if (row === dive.exit) {
      // Come back up in a river of whichever biome the run has reached, then carry on over land.
      this.underwater = null;
      this.biome = biomeAt(row);
      lane = this.river(row, difficulty);
      lane.exit = true;
      this.groupType = "grass";
      this.groupLeft = 2;
    } else {
      if (this.groupLeft <= 0) {
        // Seabed strips between shoals of sea creatures; no rivers or rails down here.
        const rng = this.rng;
        if (this.groupType === "road" || rng() < 0.3) {
          this.groupType = "grass";
          this.groupLeft = randInt(rng, 1, 2);
        } else {
          this.groupType = "road";
          this.groupLeft = randInt(rng, 1, 3 + Math.round(difficulty * 2));
        }
      }
      this.groupLeft--;
      lane = this.groupType === "road" ? this.road(row, difficulty) : this.grass(row, 0.2 + difficulty * 0.15);
      // Always finish on seabed so the surfacing hop starts from solid ground.
      if (row === dive.exit - 1 && lane.type !== "grass") lane = this.grass(row, 0.2);
    }
    lane.continued = lane.type === this.lastType;
    this.lastType = lane.type;
    if (!lane.exit) this.placePickup(lane);
    return lane;
  }

  private placePickup(lane: Lane) {
    const rng = this.rng;
    if (lane.type !== "grass" && lane.type !== "road") return;
    const free: number[] = [];
    for (let x = -COLS; x <= COLS; x++) if (!lane.blocked.has(x)) free.push(x);
    if (free.length === 0) return;
    if (rng() < PICKUP_CHANCE) {
      if (rng() < CHEST_CHANCE) {
        lane.chest = { x: pick(rng, free), kind: foundChest(rng) };
      } else {
        lane.pickup = {
          x: pick(rng, free),
          kind: rng() < LIFE_CHANCE ? "life" : pick(rng, POWERUPS),
        };
      }
    }
    const coinSpots = free.filter((x) => x !== lane.pickup?.x && x !== lane.chest?.x);
    if (rng() < COIN_CHANCE && coinSpots.length > 0) lane.coin = pick(rng, coinSpots);
    // During a holiday event its special item turns up too, on a square of its own.
    const event = collectingEvent();
    const itemSpots = coinSpots.filter((x) => x !== lane.coin);
    if (event && rng() < event.spawnChance && itemSpots.length > 0) lane.special = { x: pick(rng, itemSpots), event: event.id };
  }

  private pickGroup(row: number) {
    const rng = this.rng;
    const difficulty = difficultyAt(row);
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
    const lane = emptyLane(row, "grass", this.biome);
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
    const lane = emptyLane(row, "road", this.biome);
    const truck = rng() < 0.3;
    const dir = rng() < 0.5 ? -1 : 1;
    const base = truck ? range(rng, 1.4, 2.4) : range(rng, 1.8, 3.6);
    lane.speed = dir * base * (1 + difficulty * 0.9);
    const length = truck ? 2.6 : 1.5;
    const count = randInt(rng, 3, 4) + Math.round(difficulty * 2);
    const spacing = (WRAP * 2) / count;
    const color = truck ? pick(rng, BIOMES[this.biome].truckColors) : null;
    const jitterMax = Math.max(0, (spacing - length - 2.2) / 2);
    for (let i = 0; i < count; i++) {
      lane.movers.push({
        x: -WRAP + spacing * i + range(rng, -jitterMax, jitterMax),
        length,
        kind: truck ? "truck" : "car",
        color: color ?? pick(rng, BIOMES[this.biome].carColors),
        wrecked: null,
      });
    }
    return lane;
  }

  private river(row: number, difficulty: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "river", this.biome);
    const dir = this.lastType === "river" ? -this.lastRiverDir : rng() < 0.5 ? -1 : 1;
    this.lastRiverDir = dir;
    lane.speed = dir * range(rng, 1.1, 2.2) * (1 + difficulty * 0.5);
    let x = -WRAP + range(rng, 0, 1.5);
    while (true) {
      const length = randInt(rng, 2, 4 - Math.round(difficulty));
      if (x + length > WRAP - 1.2) break;
      lane.movers.push({ x: x + length / 2, length, kind: "log", color: "#8b5a2b", wrecked: null });
      x += length + range(rng, 1.2, 2.6 + difficulty * 1.5);
    }
    return lane;
  }

  private rail(row: number): Lane {
    const rng = this.rng;
    const lane = emptyLane(row, "rail", this.biome);
    lane.speed = (rng() < 0.5 ? -1 : 1) * 1;
    lane.train.timer = range(rng, 1.5, 6);
    lane.train.cars = randInt(rng, 3, 5);
    return lane;
  }
}

export const trainLength = (lane: Lane) => lane.train.cars * TRAIN_CAR_LENGTH;
