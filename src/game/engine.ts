import {
  COLS,
  HOP_DURATION,
  IDLE_LIMIT,
  MAX_ROWS_BEHIND_CAMERA,
  ROWS_AHEAD,
  ROWS_BEHIND,
  TRAIN_SPEED,
  TRAIN_WARNING,
  WRAP,
} from "./config";
import { Lane, LaneGenerator, Mover, trainLength } from "./lanes";

export type Direction = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "dead";
export type DeathKind = "car" | "train" | "water" | "eagle";

const FACING: Record<Direction, number> = {
  up: 0,
  down: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};

export interface PlayerState {
  /** Logical row (updated the moment a hop starts). */
  row: number;
  /** Current world x (fractional while riding a log). */
  x: number;
  /** Visual z row, interpolated during hops. */
  z: number;
  /** Hop height above the ground. */
  y: number;
  facing: number;
  hop: null | { fromX: number; toX: number; fromZ: number; toZ: number; t: number; drift: number };
  queued: Direction | null;
  ride: Mover | null;
  rideOffset: number;
  death: null | { kind: DeathKind; t: number; pushX: number };
}

export interface UiSnapshot {
  status: Status;
  score: number;
  best: number;
}

const BEST_KEY = "xfast-best";

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * All game rules live here, free of React and three.js. The scene reads this
 * state every frame; the HUD subscribes to the coarse UI snapshot.
 */
let nextId = 1;

export class Engine {
  readonly id = nextId++;
  lanes = new Map<number, Lane>();
  minRow = -ROWS_BEHIND;
  maxRow = -ROWS_BEHIND - 1;
  /** Smoothed row the camera is centred on; creeps forward on its own. */
  focus = 0;
  cameraX = 0;
  time = 0;
  idle = 0;
  /** Bumped whenever lanes are added or removed so React can re-render the list. */
  laneVersion = 0;
  eagle: null | { t: number; startZ: number } = null;

  player: PlayerState = {
    row: 0,
    x: 0,
    z: 0,
    y: 0,
    facing: 0,
    hop: null,
    queued: null,
    ride: null,
    rideOffset: 0,
    death: null,
  };

  private generator: LaneGenerator;
  private ui: UiSnapshot;
  private listeners = new Set<() => void>();

  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.generator = new LaneGenerator(seed);
    this.ui = { status: "ready", score: 0, best: readBest() };
    this.ensureLanes();
  }

  // ---- UI store -------------------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.ui;

  private setUi(patch: Partial<UiSnapshot>) {
    this.ui = { ...this.ui, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  get status() {
    return this.ui.status;
  }

  // ---- Input ----------------------------------------------------------------

  move(dir: Direction) {
    if (this.ui.status === "dead") return;
    if (this.ui.status === "ready") this.setUi({ status: "playing" });
    const p = this.player;
    if (p.hop) {
      p.queued = dir;
      return;
    }
    this.startHop(dir);
  }

  private startHop(dir: Direction) {
    const p = this.player;
    p.facing = FACING[dir];
    this.idle = 0;

    const lateral = dir === "left" || dir === "right";
    const riding = p.ride !== null && lateral;
    const toRow = p.row + (dir === "up" ? 1 : dir === "down" ? -1 : 0);
    let toX = p.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    // Sideways hops along a log stay relative to it; everything else lands on a whole column.
    if (!riding) toX = Math.round(toX);
    const drift = riding ? this.lanes.get(p.row)!.speed : 0;
    const toLane = this.lanes.get(toRow);

    if (!toLane || Math.abs(toX) > COLS + 0.01) return;
    if (toLane.type === "grass" && toLane.blocked.has(Math.round(toX))) return;

    p.hop = { fromX: p.x, toX, fromZ: p.z, toZ: toRow, t: 0, drift };
    p.row = toRow;
    p.ride = null;

    if (toRow > this.ui.score) {
      this.setUi({ score: toRow });
      this.ensureLanes();
    }
  }

  private land() {
    const p = this.player;
    const hop = p.hop!;
    p.hop = null;
    p.x = hop.toX;
    p.z = hop.toZ;
    p.y = 0;

    const lane = this.lanes.get(p.row);
    if (lane?.type === "river") {
      const log = lane.movers.find((m) => Math.abs(p.x - m.x) <= m.length / 2 + 0.2);
      if (!log) {
        this.die("water");
        return;
      }
      // Snap to the nearest slot on the log.
      const half = (log.length - 1) / 2;
      const slot = Math.max(-half, Math.min(half, Math.round(p.x - log.x + half) - half));
      p.ride = log;
      p.rideOffset = slot;
      p.x = log.x + slot;
    }

    if (p.queued) {
      const next = p.queued;
      p.queued = null;
      this.startHop(next);
    }
  }

  private die(kind: DeathKind, pushX = 0) {
    const p = this.player;
    if (p.death) return;
    p.death = { kind, t: 0, pushX };
    p.queued = null;
    if (kind !== "eagle") p.hop = null;
    const best = Math.max(this.ui.best, this.ui.score);
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage can be unavailable (private mode); the best score just won't persist.
    }
    this.setUi({ status: "dead", best });
  }

  // ---- Simulation -----------------------------------------------------------

  ensureLanes() {
    const target = Math.max(this.focus, this.player.row) + ROWS_AHEAD;
    let changed = false;
    while (this.maxRow < target) {
      this.maxRow++;
      this.lanes.set(this.maxRow, this.generator.next(this.maxRow));
      changed = true;
    }
    const keepFrom = Math.floor(Math.min(this.focus, this.player.row)) - ROWS_BEHIND;
    while (this.minRow < keepFrom) {
      this.lanes.delete(this.minRow);
      this.minRow++;
      changed = true;
    }
    if (changed) this.laneVersion++;
  }

  update(rawDt: number) {
    const dt = Math.min(rawDt, 1 / 20);
    this.time += dt;
    const playing = this.ui.status === "playing";
    const p = this.player;

    for (const lane of this.lanes.values()) this.updateLane(lane, dt);

    // Hop animation.
    if (p.hop) {
      const hop = p.hop;
      hop.t += dt / HOP_DURATION;
      hop.fromX += hop.drift * dt;
      hop.toX += hop.drift * dt;
      const t = Math.min(1, hop.t);
      p.x = hop.fromX + (hop.toX - hop.fromX) * t;
      p.z = hop.fromZ + (hop.toZ - hop.fromZ) * t;
      p.y = Math.sin(Math.PI * t);
      if (hop.t >= 1 && !p.death) this.land();
    }

    if (p.ride && !p.death) {
      p.x = p.ride.x + p.rideOffset;
      if (Math.abs(p.x) > COLS + 0.6) this.die("water");
    }

    if (playing && !p.death) {
      this.checkCollisions();
      this.idle += dt;
      if (this.idle > IDLE_LIMIT || p.row < this.focus - MAX_ROWS_BEHIND_CAMERA) {
        this.die("eagle");
        this.eagle = { t: 0, startZ: p.z + 14 };
      }
    }

    if (p.death) this.updateDeath(dt);

    // Camera focus: chase the player when ahead, otherwise creep forward.
    if (playing) {
      const creep = 0.28 + Math.min(0.5, this.ui.score / 400);
      this.focus += creep * dt;
      if (p.z > this.focus) this.focus += (p.z - this.focus) * Math.min(1, dt * 4);
    }
    this.cameraX += (Math.max(-2, Math.min(2, p.x * 0.6)) - this.cameraX) * Math.min(1, dt * 3);

    this.ensureLanes();
  }

  private updateLane(lane: Lane, dt: number) {
    if (lane.type === "road" || lane.type === "river") {
      for (const m of lane.movers) {
        m.x += lane.speed * dt;
        // A fixed period keeps the spacing between movers constant forever.
        if (m.x > WRAP) m.x -= WRAP * 2;
        if (m.x < -WRAP) m.x += WRAP * 2;
      }
    } else if (lane.type === "rail") {
      const train = lane.train;
      const len = trainLength(lane);
      const dir = Math.sign(lane.speed);
      if (train.active) {
        train.x += dir * TRAIN_SPEED * dt;
        if (Math.abs(train.x) > WRAP + len) {
          train.active = false;
          train.warning = false;
          train.timer = 3 + Math.random() * 6;
        }
      } else {
        train.timer -= dt;
        train.warning = train.timer < TRAIN_WARNING;
        if (train.timer <= 0) {
          train.active = true;
          train.x = -dir * (WRAP + len / 2);
        }
      }
    }
  }

  private checkCollisions() {
    const p = this.player;
    const lane = this.lanes.get(p.row);
    if (!lane) return;
    // Mid-hop between lanes the chicken only counts as being in its target lane once past halfway.
    if (p.hop && p.hop.t < 0.5) return;
    if (lane.type === "road") {
      for (const m of lane.movers) {
        if (Math.abs(p.x - m.x) < m.length / 2 + 0.3) {
          this.die("car");
          return;
        }
      }
    } else if (lane.type === "rail" && lane.train.active) {
      const len = trainLength(lane);
      if (Math.abs(p.x - lane.train.x) < len / 2 + 0.3) {
        this.die("train", Math.sign(lane.speed));
      }
    }
  }

  private updateDeath(dt: number) {
    const p = this.player;
    const death = p.death!;
    death.t += dt;
    if (death.kind === "train") {
      p.x += death.pushX * TRAIN_SPEED * dt * Math.max(0, 1 - death.t * 2);
    }
    if (this.eagle) this.eagle.t += dt;
  }
}
