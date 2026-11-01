import { achievements, type Goal } from "./achievements";
import { CHESTS, chests, type ChestKind } from "./chests";
import { events } from "./events";
import { traitsAt, type Traits } from "./characters";
import { BIOMES, biomeAt, type BiomeId } from "./biomes";
import {
  COLS,
  FLIGHT_ALTITUDE,
  FLIGHT_SPEED,
  HOP_DURATION,
  IDLE_LIMIT,
  MAGNET_PULL_TIME,
  MAGNET_RADIUS,
  MAX_SPEED_SCALE,
  SPEEDUP_STEP,
  STEPS_PER_SPEEDUP,
  MAX_ROWS_BEHIND_CAMERA,
  RESPAWN_DELAY,
  RESPAWN_SHIELD,
  SLOWMO_EASE,
  SLOWMO_SCALE,
  START_LIVES,
  CAT_LIVES,
  ROWS_AHEAD,
  ROWS_BEHIND,
  TRAIN_SPEED,
  TRAIN_WARNING,
  WRAP,
} from "./config";
import type { HintId } from "./guide";
import { Lane, LaneGenerator, Mover, PickupKind, trainLength } from "./lanes";
import {
  POWERUPS,
  POWERUP_KEYS,
  coinRainRowsAt,
  durationAt,
  isInstant,
  noEffects,
  warpRowsAt,
  type Effects,
  type PowerUp,
} from "./powerups";
import * as sound from "./sound";
import { type CharacterId, wallet } from "./wallet";

export type { Effects, PowerUp };

export type Direction = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "dead";
export type DeathKind = "car" | "train" | "water" | "eagle";
const PICKUP_LABEL = {
  life: "+1 LIFE",
  ...Object.fromEntries(POWERUPS.map((p) => [p.key, p.label])),
} as Record<PickupKind, string>;

/** How long a water splash lasts, in seconds. */
export const SPLASH_TIME = 1;
const SUPER_HOP_TIME = 1.6;

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
  hop: null | {
    fromX: number;
    toX: number;
    fromZ: number;
    toZ: number;
    t: number;
    drift: number;
    /** Duration multiplier; super hops take longer and fly higher. */
    span: number;
  };
  queued: Direction | null;
  ride: Mover | null;
  rideOffset: number;
  /** A death that will end in a respawn (revive) or the game over screen. */
  death: null | { kind: DeathKind; t: number; pushX: number; revive: boolean };
  /** Seconds of post-respawn invulnerability left. */
  shield: number;
  /**
   * Flight power-up: the player soars forward on its own, high above everything, while the wings
   * last; then it glides down onto the nearest safe grass ahead (`land`).
   */
  flight: null | {
    /** Last row flown over (coins, pickups and score are taken row by row). */
    row: number;
    land: null | { row: number; x: number; fromX: number; fromZ: number; fromY: number; t: number; time: number };
  };
}

export interface UiSnapshot {
  status: Status;
  score: number;
  best: number;
  lives: number;
  /** Hops taken this run; traffic speeds up every STEPS_PER_SPEEDUP. */
  steps: number;
  /** Coins picked up this run (they are banked in the wallet straight away). */
  coins: number;
  /** Chests found on the road or earned from stars this run, shown one by one before the score. */
  foundChests: ChestKind[];
  /** Holiday event items picked up this run. */
  eventItems: number;
  /** Whole seconds left on each power-up (0 = inactive); only changes once a second. */
  effects: Effects;
  /** `icon` is an image shown before the text, such as an achievement star. */
  toast: null | { text: string; id: number; icon?: string };
  /** Goals earned this run that are waiting to be shown, oldest first; the HUD shows them one at a time. */
  earned: { goal: Goal; id: number }[];
  /** Cat only: progress (0-1) towards regrowing the next life, or null for other characters. */
  refill: number | null;
  /** Duck only: power-ups picked up this run and saved for later. */
  stash: Effects;
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
  /** While the chicken is giving a tip the world holds still and hops are ignored. */
  paused = false;
  /**
   * Asked at moments worth a tip (a road ahead, a power-up just picked up...). Returns true when a
   * tip is shown, and pauses the game itself; the game resumes by clearing `paused`.
   */
  onHint: ((id: HintId) => boolean) | null = null;
  private hint(id: HintId) {
    return this.ui.status === "playing" && !this.player.death && !this.paused && !!this.onHint?.(id);
  }
  /** Bumped whenever lanes are added or removed so React can re-render the list. */
  laneVersion = 0;
  eagle: null | { t: number; startZ: number } = null;
  /** Coins the magnet has pulled off their lanes, flying to the player; banked when they arrive. */
  pulled: { id: number; x: number; row: number; t: number }[] = [];
  private pullId = 0;
  /** Splashes where the player fell into water (or lava), from 0 to 1 over SPLASH_TIME seconds. */
  splashes: { id: number; x: number; row: number; t: number; lava: boolean }[] = [];
  private splashId = 0;
  /** Exact seconds left on each power-up. */
  effects: Effects = noEffects();
  /** The seconds each running power-up started from, so the HUD ring can drain from full even when doubled. */
  effectSpan: Effects = noEffects();
  private toastId = 0;
  /** Biome the player is currently in, announced when it changes. */
  biome: BiomeId = biomeAt(0);
  /** Multiplier on car, truck and train speed, raised every STEPS_PER_SPEEDUP hops. */
  speedScale = 1;
  /** How far into slowmo the world is, 0 (full speed) to 1 (fully slowed); eases rather than snapping. */
  slowmoBlend = 0;

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
    shield: 0,
    flight: null,
  };

  private generator: LaneGenerator;
  private ui: UiSnapshot;
  private listeners = new Set<() => void>();

  readonly character: CharacterId;
  /** The character's trait numbers at the upgrade steps it has taken. */
  readonly traits: Traits;
  /** The character's upgrade steps this run plays at (see characterLevelOf). */
  readonly steps: number;

  constructor(character: CharacterId = "chicken", seed = Math.floor(Math.random() * 1e9)) {
    this.character = character;
    this.steps = wallet.stepsOf(character);
    this.traits = traitsAt(character, this.steps);
    this.generator = new LaneGenerator(seed);
    this.ui = {
      status: "ready",
      score: 0,
      best: readBest(),
      lives: character === "cat" ? CAT_LIVES : START_LIVES,
      steps: 0,
      coins: 0,
      eventItems: 0,
      foundChests: [],
      effects: noEffects(),
      toast: null,
      earned: [],
      refill: character === "cat" ? 0 : null,
      stash: noEffects(),
    };
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
    if (this.ui.status === "dead" || this.paused) return;
    if (this.ui.status === "ready") {
      // Extra lives bought in the store are spent when a run starts.
      this.setUi({ status: "playing", lives: this.ui.lives + wallet.takeLives() });
      this.award(achievements.startRun(this.biome, this.character));
      if (this.character === "penguin") {
        this.apply("shield");
        this.effects.shield *= this.traits.penguinShield;
        this.effectSpan.shield = this.effects.shield;
        this.syncEffects(true);
      }
      // An upgraded duck starts the run with a few random power-ups already saved.
      if (this.character === "duck" && this.traits.duckStart > 0) {
        const stash = { ...this.ui.stash };
        for (let i = 0; i < this.traits.duckStart; i++) {
          const kind = POWERUP_KEYS[Math.floor(Math.random() * POWERUP_KEYS.length)];
          stash[kind]++;
        }
        this.setUi({ stash });
      }
    }
    const p = this.player;
    if (p.death || p.flight) return;
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
    let toRow = p.row + (dir === "up" ? 1 : dir === "down" ? -1 : 0);
    let toX = p.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    // Sideways hops along a log stay relative to it; everything else lands on a whole column.
    if (!riding) toX = Math.round(toX);
    const drift = riding ? this.lanes.get(p.row)!.speed : 0;
    const open = (row: number) => {
      const lane = this.lanes.get(row);
      if (!lane) return false;
      // Lumberjack and Bowser walk through trees (they're cleared on landing).
      return !(lane.type === "grass" && lane.blocked.has(Math.round(toX)) && !this.smashes);
    };

    if (Math.abs(toX) > COLS + 0.01) return;
    // Super hop clears a whole extra row when the landing spot is open.
    let span = 1;
    if (dir === "up" && this.effects.superhop > 0 && open(toRow + 1)) {
      toRow++;
      span = SUPER_HOP_TIME;
    }
    if (!open(toRow)) {
      // Bumped into a tree: a good moment to show hopping around it.
      if (dir === "up") this.hint("side");
      return;
    }
    // The frog aims for the nearest log in the river it is jumping into, so it never lands in water.
    if (this.character === "frog" && !riding) {
      const lane = this.lanes.get(toRow);
      if (lane?.type === "river") toX = this.nearestLogSlot(lane, toX, HOP_DURATION * span) ?? toX;
    }

    p.hop = { fromX: p.x, toX, fromZ: p.z, toZ: toRow, t: 0, drift, span };
    p.row = toRow;
    sound.pop(span > 1);
    p.ride = null;

    this.countStep();
    if (toRow > this.ui.score) {
      this.setUi({ score: toRow });
      this.ensureLanes();
      this.award(achievements.scored(toRow));
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
    if (lane?.type === "river" && this.character === "frog" && !this.boardLog(lane)) {
      const slot = this.nearestLogSlot(lane, p.x);
      if (slot !== null) p.x = slot;
    }
    if (lane?.type === "river" && !this.boardLog(lane) && this.splash(lane)) return;
    // An upgraded frog sometimes catches a coin as it lands on a log.
    if (lane?.type === "river" && p.ride && this.character === "frog" && Math.random() < this.traits.frogCoin) this.bankCoin();

    if (lane) this.enterBiome(lane);
    if (lane?.type === "grass" && lane.blocked.has(Math.round(p.x))) this.chop(lane, Math.round(p.x));
    if (lane) this.collectAt(lane);
    // Standing at the edge of something new: explain it before the first crossing.
    const ahead = this.lanes.get(p.row + 1)?.type;
    if (ahead === "road" || ahead === "river" || ahead === "rail") this.hint(ahead);

    // A tip just paused the game: drop the queued hop rather than carry the player into danger.
    if (this.paused) p.queued = null;
    if (p.queued) {
      const next = p.queued;
      p.queued = null;
      this.startHop(next);
    }
  }

  /** Announce a new biome the first time the player reaches one of its lanes. */
  private enterBiome(lane: Lane) {
    if (lane.biome === this.biome) return;
    this.biome = lane.biome;
    this.setUi({ toast: { text: BIOMES[lane.biome].label.toUpperCase(), id: ++this.toastId } });
    this.award(achievements.enteredBiome(lane.biome));
    // Mario finds a fresh Super Mushroom in every new biome.
    if (this.character === "mario") this.big = true;
  }

  /** Pick up whatever lies in the player's column on this lane. */
  private collectAt(lane: Lane) {
    const x = Math.round(this.player.x);
    if (lane.pickup && x === lane.pickup.x) this.collect(lane);
    if (lane.chest && x === lane.chest.x) this.collectChest(lane);
    if (lane.coin !== null && x === lane.coin) this.collectCoin(lane);
    if (lane.special && x === lane.special.x) this.collectSpecial(lane);
  }

  /** Take off, or keep flying if the wings were topped up on the way down. */
  private takeOff() {
    const p = this.player;
    if (p.death) return;
    if (p.flight) {
      p.flight.land = null;
      return;
    }
    // Lift straight off from wherever the player is, mid-hop or riding a log.
    p.hop = null;
    p.queued = null;
    p.ride = null;
    p.x = Math.max(-COLS, Math.min(COLS, p.x));
    p.facing = FACING.up;
    p.row = Math.round(p.z);
    p.flight = { row: p.row, land: null };
    sound.pop(true);
  }

  /** Fly forward, taking each row's coins and pickups on the way, then glide down onto safe grass. */
  private updateFlight(dt: number) {
    const p = this.player;
    const f = p.flight!;
    this.idle = 0;
    if (!f.land) {
      p.z += FLIGHT_SPEED * dt;
      p.y += (FLIGHT_ALTITUDE - p.y) * Math.min(1, dt * 5);
      this.flyOver(Math.floor(p.z));
      if (this.effects.wings > 0) return;
      // Out of wings: pick the first grass a short glide ahead with a free spot near our column.
      const want = Math.round(p.x);
      for (let row = Math.floor(p.z) + 2; ; row++) {
        const lane = this.lanes.get(row);
        if (!lane) {
          this.ensureLanes();
          if (!this.lanes.get(row)) return;
          continue;
        }
        if (lane.type !== "grass") continue;
        const x = this.freeColumn(lane, want);
        if (x === null) continue;
        const time = Math.max(0.5, (row - p.z) / FLIGHT_SPEED);
        f.land = { row, x, fromX: p.x, fromZ: p.z, fromY: p.y, t: 0, time };
        break;
      }
      return;
    }
    const l = f.land;
    l.t = Math.min(1, l.t + dt / l.time);
    const e = l.t * l.t * (3 - 2 * l.t);
    p.x = l.fromX + (l.x - l.fromX) * e;
    p.z = l.fromZ + (l.row - l.fromZ) * l.t;
    p.y = l.fromY * (1 - e);
    this.flyOver(Math.min(l.row - 1, Math.floor(p.z)));
    if (l.t < 1) return;
    p.flight = null;
    Object.assign(p, { row: l.row, x: l.x, z: l.row, y: 0 });
    p.shield = Math.max(p.shield, 0.5);
    this.effects.wings = 0;
    this.syncEffects(true);
    sound.pop(false);
    const lane = this.lanes.get(l.row)!;
    this.enterBiome(lane);
    this.collectAt(lane);
    const ahead = this.lanes.get(l.row + 1)?.type;
    if (ahead === "road" || ahead === "river" || ahead === "rail") this.hint(ahead);
  }

  /** Count the rows flown over up to `to`: score, biomes, and anything in the player's column. */
  private flyOver(to: number) {
    const p = this.player;
    const f = p.flight!;
    while (f.row < to) {
      f.row++;
      p.row = f.row;
      if (f.row > this.ui.score) {
        this.setUi({ score: f.row });
        this.award(achievements.scored(f.row));
      }
      this.ensureLanes();
      const lane = this.lanes.get(f.row);
      if (!lane) continue;
      this.enterBiome(lane);
      this.collectAt(lane);
      // A pickup tip can pause the game mid-flight; carry on from here when it resumes.
      if (this.paused || !p.flight) return;
    }
  }

  /** Foresight ghosts show while the power-up runs, and always for the robot. */
  get foresight() {
    return this.effects.foresight > 0 || (this.character === "robot" && !this.player.death);
  }

  /** The duck paddling in the river where it surfaced. */
  get swimming() {
    const p = this.player;
    return !p.ride && !p.hop && !p.death && this.lanes.get(p.row)?.exit === true;
  }

  /**
   * In open water: the river a dive surfaces in is safe to paddle in, the duck dives
   * to the seabed, and everyone else drowns. False when the player is safe.
   */
  private splash(lane: Lane) {
    const p = this.player;
    if (lane.exit) {
      p.ride = null;
      p.x = Math.max(-COLS, Math.min(COLS, p.x));
      return false;
    }
    // The duck dives under water, but lava is lava.
    if (this.character === "duck" && lane.biome !== "volcano") {
      sound.splash();
      this.addSplash();
      this.dive();
    } else this.die("water");
    return true;
  }

  /** Throw up a splash of water (or lava) where the player is. */
  private addSplash() {
    const p = this.player;
    const lava = this.lanes.get(p.row)?.biome === "volcano";
    this.splashes.push({ id: ++this.splashId, x: p.x, row: p.row, t: 0, lava });
  }

  /** Replace the world ahead with the seabed, from the river the duck fell into. */
  private dive() {
    const p = this.player;
    const x = Math.max(-COLS, Math.min(COLS, Math.round(p.x)));
    for (let row = p.row; row <= this.maxRow; row++) this.lanes.delete(row);
    this.maxRow = p.row - 1;
    this.generator.dive(p.row, x);
    this.ensureLanes();
    Object.assign(p, { x, y: 0, hop: null, queued: null, ride: null });
    p.shield = Math.max(p.shield, 1);
    this.biome = "underwater";
    this.setUi({ toast: { text: "DIVE!", id: ++this.toastId } });
    this.award(achievements.enteredBiome("underwater"));
  }

  /** Lumberjack, and Bowser always, go straight through trees and rocks. */
  private get smashes() {
    return this.effects.lumberjack > 0 || this.character === "bowser";
  }

  /** Mario at full size, with a hit to spare. */
  get marioBig() {
    return this.character === "mario" && this.big;
  }

  /** Luigi can't be hit in the Spooky biome. */
  private untouchable(lane: Lane) {
    return this.effects.ghost > 0 || (this.character === "luigi" && lane.biome === "spooky");
  }

  /** Closest spot on a log in this lane, inside the playable columns, `ahead` seconds from now. */
  private nearestLogSlot(lane: Lane, x: number, ahead = 0) {
    let best: number | null = null;
    for (const m of lane.movers) {
      const center = m.x + lane.speed * ahead;
      const half = (m.length - 1) / 2;
      for (let s = -half; s <= half; s++) {
        const at = center + s;
        if (Math.abs(at) > COLS) continue;
        if (best === null || Math.abs(at - x) < Math.abs(best - x)) best = at;
      }
    }
    return best;
  }

  /** Step onto the log under the chicken, if there is one. */
  private boardLog(lane: Lane) {
    const p = this.player;
    const log = lane.movers.find((m) => Math.abs(p.x - m.x) <= m.length / 2 + 0.2);
    if (!log) return false;
    // Snap to the nearest slot on the log.
    const half = (log.length - 1) / 2;
    const slot = Math.max(-half, Math.min(half, Math.round(p.x - log.x + half) - half));
    p.ride = log;
    p.rideOffset = slot;
    p.x = log.x + slot;
    return true;
  }

  /** The magnet lifts a coin off its lane; it flies to the player and is banked on arrival. */
  private pullCoin(lane: Lane) {
    this.pulled.push({ id: ++this.pullId, x: lane.coin!, row: lane.row, t: 0 });
    lane.coin = null;
  }

  private collectCoin(lane: Lane) {
    lane.coin = null;
    this.bankCoin();
  }

  private bankCoin() {
    // The human always doubles coins, and at higher tiers sometimes triples them.
    const human = this.character === "human";
    const n = human && Math.random() < this.traits.humanTriple ? 3 : this.effects.double > 0 || human ? 2 : 1;
    sound.coin(n > 1);
    wallet.addCoins(n);
    this.setUi({ coins: this.ui.coins + n });
    this.award(achievements.coins(n));
    this.hint("coin");
    if (this.character === "mario") {
      this.marioCoins += n;
      if (this.marioCoins >= this.traits.marioCoinsPerLife) {
        this.marioCoins -= this.traits.marioCoinsPerLife;
        this.setUi({ lives: this.ui.lives + 1, toast: { text: "1-UP", id: ++this.toastId } });
      }
    }
  }

  // Cat life refill: half a life every `catRefillHops` hops, doubling with each life spent.
  private big = true;
  private marioCoins = 0;
  /** Seconds left on Bowser's fire breath animation. */
  fire = 0;
  private catLivesSpent = 0;
  private catHops = 0;
  private catHalves = 0;

  get catRefillHops() {
    // The first life spent refills at the base rate; each one after that doubles it.
    return this.traits.catRefillHops * 2 ** Math.max(0, this.catLivesSpent - 1);
  }

  private catRefill() {
    if (this.ui.lives >= CAT_LIVES) return;
    this.catHops++;
    let toast: string | null = null;
    let lives = this.ui.lives;
    if (this.catHops >= this.catRefillHops) {
      this.catHops = 0;
      this.catHalves++;
      toast = "+½ LIFE";
      if (this.catHalves === 2) {
        this.catHalves = 0;
        lives++;
        toast = "+1 LIFE";
      }
    }
    const refill = lives >= CAT_LIVES ? 0 : (this.catHalves + this.catHops / this.catRefillHops) / 2;
    this.setUi({ lives, refill, ...(toast ? { toast: { text: toast, id: ++this.toastId } } : {}) });
  }

  private countStep() {
    this.award(achievements.hop());
    if (this.character === "cat") this.catRefill();
    const steps = this.ui.steps + 1;
    // Sparrow and snail bend time every so many hops.
    const timeTrait = this.character === "sparrow" ? "freeze" : this.character === "snail" ? "slowmo" : null;
    if (this.character === "bowser" && steps % this.traits.bowserFireHops === 0) this.breatheFire();
    if (this.character === "robot" && this.traits.robotCoinHops && steps % this.traits.robotCoinHops === 0) this.bankCoin();
    if (timeTrait && steps % this.traits.timeTraitHops === 0) {
      this.apply(timeTrait);
      this.syncEffects(true);
      this.setUi({ toast: { text: PICKUP_LABEL[timeTrait], id: ++this.toastId } });
    }
    // The leopard pounces ahead and the owl takes to the air every so many hops.
    const leapTrait = this.character === "leopard" ? "warp" : this.character === "owl" ? "wings" : null;
    if (leapTrait && steps % this.traits.leapHops === 0) {
      this.apply(leapTrait);
      this.syncEffects(true);
      this.setUi({ toast: { text: leapTrait === "warp" ? "POUNCE!" : PICKUP_LABEL[leapTrait], id: ++this.toastId } });
    }
    // The tiger roars every so many hops and puts up a shield.
    if (this.character === "tiger" && steps % this.traits.tigerRoarHops === 0) {
      this.apply("shield");
      this.syncEffects(true);
      this.setUi({ toast: { text: "ROAR!", id: ++this.toastId } });
    }
    const tier = Math.floor(steps / STEPS_PER_SPEEDUP);
    const scale = Math.min(MAX_SPEED_SCALE, 1 + tier * SPEEDUP_STEP);
    if (scale > this.speedScale) {
      this.speedScale = scale;
      this.setUi({ steps, toast: { text: "SPEED UP!", id: ++this.toastId } });
    } else {
      this.setUi({ steps });
    }
  }

  private collect(lane: Lane) {
    const kind = lane.pickup!.kind;
    lane.pickup = null;
    const found = kind === "life" ? [] : achievements.pickedUp(kind);
    if (kind === "life") this.setUi({ lives: this.ui.lives + 1 });
    else if (this.character === "duck") {
      // The duck pockets power-ups for later in the run instead of using them straight away.
      this.setUi({
        stash: { ...this.ui.stash, [kind]: this.ui.stash[kind] + 1 },
        toast: { text: `${PICKUP_LABEL[kind]} SAVED`, id: ++this.toastId },
      });
      this.award(found);
      this.hint("duck-saved");
      return;
    }
    const doubled = kind !== "life" && this.apply(kind, true);
    this.syncEffects(true);
    this.setUi({ toast: { text: doubled ? `${PICKUP_LABEL[kind]} ×2` : PICKUP_LABEL[kind], id: ++this.toastId } });
    this.award([...found, ...(kind === "life" ? [] : achievements.usedPowerup())]);
    this.hint(kind);
  }

  /** A reward chest found on the road goes into the player's collection, to open on the Rewards screen. */
  private collectChest(lane: Lane) {
    const kind = lane.chest!.kind;
    lane.chest = null;
    chests.found(kind);
    sound.coin(true);
    this.announceChests();
  }

  /** A holiday event's special item: counted toward the event's chest. */
  private collectSpecial(lane: Lane) {
    lane.special = null;
    const got = events.collect();
    // The event can close mid-run (past midnight on the holiday); the item then just vanishes.
    if (!got) return;
    sound.coin(false);
    this.setUi({ eventItems: this.ui.eventItems + 1 });
    if (got.total === got.info.target) {
      this.setUi({ toast: { text: `${got.info.target} ${got.info.items.toUpperCase()}! CHEST UNLOCKED`, id: ++this.toastId } });
    }
  }

  /** Say so when stars or the road just added chests to the collection. */
  private announceChests() {
    const got = chests.takeNew();
    if (!got.length) return;
    const best = got.includes("mega") ? "mega" : got.includes("epic") ? "epic" : "basic";
    const text = `${CHESTS[best].name.toUpperCase()}${got.length > 1 ? ` +${got.length - 1}` : ""}!`;
    this.setUi({ toast: { text, id: ++this.toastId }, foundChests: [...this.ui.foundChests, ...got] });
  }

  /** Queue goals just earned for the achievement card. */
  private award(goals: Goal[]) {
    if (!goals.length) return;
    sound.coin(true);
    this.setUi({ earned: [...this.ui.earned, ...goals.map((goal) => ({ goal, id: ++this.toastId }))] });
    this.announceChests();
  }

  /** The HUD has finished showing an achievement card; move on to the next. */
  dismissEarned(id: number) {
    this.setUi({ earned: this.ui.earned.filter((e) => e.id !== id) });
  }

  /** Use a power-up bought in the store. */
  activate(kind: PowerUp) {
    if (this.ui.status !== "playing" || this.player.death) return false;
    // Spend what the duck saved this run before anything bought in the store.
    if (this.ui.stash[kind] > 0) this.setUi({ stash: { ...this.ui.stash, [kind]: this.ui.stash[kind] - 1 } });
    else if (!wallet.use(kind)) return false;
    const doubled = this.apply(kind, true);
    this.syncEffects(true);
    this.setUi({ toast: { text: doubled ? `${PICKUP_LABEL[kind]} ×2` : PICKUP_LABEL[kind], id: ++this.toastId } });
    this.award(achievements.usedPowerup());
    return true;
  }

  /**
   * Start a power-up. With `stack` (a pickup or a use from the store), taking one that is already running
   * doubles it: the timer jumps to twice its full length, or adds a full length if that would be more.
   * Character traits only top the timer up, so they never cut a doubled power-up short.
   * Returns whether the power-up was doubled.
   */
  private apply(kind: PowerUp, stack = false) {
    if (!isInstant(kind)) {
      const upgrades = wallet.get().upgrades[kind];
      const full = durationAt(kind, upgrades) * (this.character === "chicken" ? this.traits.powerupBonus : 1);
      const left = this.effects[kind];
      const doubled = stack && left > 0;
      this.effects[kind] = doubled ? Math.max(2 * full, left + full) : Math.max(left, full);
      if (doubled || left < full) this.effectSpan[kind] = this.effects[kind];
      if (kind === "wings") this.takeOff();
      return doubled;
    }
    if (kind === "warp") this.warp();
    if (kind === "coinrain") this.coinRain();
    return false;
  }

  /** Jump to the first open grass at least WARP_ROWS (more when upgraded) ahead. */
  private warp() {
    const p = this.player;
    const want = Math.max(-COLS, Math.min(COLS, Math.round(p.x)));
    const rows = warpRowsAt(wallet.get().upgrades.warp);
    for (let row = p.row + rows; row < p.row + rows + 15; row++) {
      const lane = this.lanes.get(row);
      if (lane?.type !== "grass") continue;
      const x = this.freeColumn(lane, want);
      if (x === null) continue;
      Object.assign(p, { row, x, z: row, y: 0, hop: null, queued: null, ride: null, flight: null });
      this.effects.wings = 0;
      p.shield = Math.max(p.shield, 1);
      this.idle = 0;
      if (row > this.ui.score) this.setUi({ score: row });
      this.ensureLanes();
      return;
    }
  }

  private coinRain() {
    const p = this.player;
    for (let row = p.row + 1; row <= p.row + coinRainRowsAt(wallet.get().upgrades.coinrain); row++) {
      const lane = this.lanes.get(row);
      if (!lane || lane.coin !== null || (lane.type !== "grass" && lane.type !== "road")) continue;
      lane.coin = this.freeColumn(lane, Math.floor(Math.random() * (COLS * 2 + 1)) - COLS);
    }
  }

  /** Nearest column to `want` with no tree on it. */
  private freeColumn(lane: Lane, want: number) {
    for (let d = 0; d <= COLS * 2; d++) {
      for (const x of [want + d, want - d]) {
        if (Math.abs(x) <= COLS && !lane.blocked.has(x)) return x;
      }
    }
    return null;
  }

  /** Wreck every vehicle in view on the next few road lanes. */
  private breatheFire() {
    const p = this.player;
    for (let row = p.row + 1; row <= p.row + this.traits.bowserFireRows; row++) {
      const lane = this.lanes.get(row);
      if (lane?.type !== "road") continue;
      for (const m of lane.movers) if (m.wrecked === null && Math.abs(m.x) < COLS + 3) m.wrecked = 0;
    }
    this.fire = 0.7;
    this.setUi({ toast: { text: "FIRE BREATH!", id: ++this.toastId } });
  }

  private chop(lane: Lane, x: number) {
    lane.blocked.delete(x);
    lane.trees = lane.trees.filter((t) => t.x !== x);
  }

  /** Push whole-second effect timers to the HUD when they change. */
  private syncEffects(force = false) {
    const next = {} as Effects;
    let changed = force;
    for (const k of Object.keys(this.effects) as PowerUp[]) {
      next[k] = Math.ceil(this.effects[k]);
      if (next[k] !== this.ui.effects[k]) changed = true;
    }
    if (changed) this.setUi({ effects: next });
  }

  private die(kind: DeathKind, pushX = 0) {
    const p = this.player;
    if (p.death) return;
    const revive = this.ui.lives > 0;
    p.death = { kind, t: 0, pushX, revive };
    if (kind === "car") sound.crash();
    else if (kind === "train") sound.crash(true);
    else if (kind === "water") {
      if (this.lanes.get(p.row)?.biome === "volcano") sound.sizzle();
      else sound.splash();
      this.addSplash();
    }
    p.queued = null;
    p.ride = null;
    p.flight = null;
    if (kind !== "eagle") p.hop = null;
    // Power-ups end with the life they were collected on.
    this.effects = noEffects();
    this.effectSpan = noEffects();
    this.syncEffects();
    if (revive) {
      if (this.character === "cat") {
        // Each life spent makes the next refill take twice as long; progress carries over proportionally.
        const progress = this.catHops / this.catRefillHops;
        this.catLivesSpent++;
        this.catHops = Math.floor(progress * this.catRefillHops);
        this.setUi({ refill: (this.catHalves + this.catHops / this.catRefillHops) / 2 });
      }
      this.setUi({ lives: this.ui.lives - 1, toast: { text: "-1 LIFE", id: ++this.toastId } });
      return;
    }
    const best = Math.max(this.ui.best, this.ui.score);
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage can be unavailable (private mode); the best score just won't persist.
    }
    this.setUi({ status: "dead", best });
  }

  /** Put the chicken back on the nearest safe grass at or behind where it died. */
  private respawn() {
    const p = this.player;
    let row = p.row;
    while (row > this.minRow && this.lanes.get(row)?.type !== "grass") row--;
    const lane = this.lanes.get(row)!;
    const want = Math.max(-COLS, Math.min(COLS, Math.round(p.x)));
    let x = want;
    for (let d = 0; d <= COLS * 2; d++) {
      if (Math.abs(want + d) <= COLS && !lane.blocked.has(want + d)) { x = want + d; break; }
      if (Math.abs(want - d) <= COLS && !lane.blocked.has(want - d)) { x = want - d; break; }
    }
    Object.assign(p, { row, x, z: row, y: 0, hop: null, queued: null, ride: null, death: null, facing: 0, flight: null });
    p.shield = RESPAWN_SHIELD;
    this.eagle = null;
    this.idle = 0;
    this.focus = Math.min(this.focus, row);
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
    if (this.paused) return;
    const dt = Math.min(rawDt, 1 / 20);
    // Slowmo slows the world down, easing in and out; the chicken's own hops stay at full speed.
    const step = dt / SLOWMO_EASE;
    this.slowmoBlend = this.effects.slowmo > 0 ? Math.min(1, this.slowmoBlend + step) : Math.max(0, this.slowmoBlend - step);
    const b = this.slowmoBlend;
    const eased = b * b * (3 - 2 * b);
    const worldDt = dt * (1 - (1 - SLOWMO_SCALE) * eased);
    this.time += dt;
    const playing = this.ui.status === "playing";
    const p = this.player;

    // Freeze stops traffic and trains outright.
    const trafficDt = this.effects.freeze > 0 ? 0 : worldDt;
    for (const lane of this.lanes.values()) this.updateLane(lane, trafficDt);
    if (this.audible) this.hearRivers();

    for (const k of Object.keys(this.effects) as PowerUp[]) this.effects[k] = Math.max(0, this.effects[k] - dt);
    p.shield = Math.max(0, p.shield - dt);
    this.fire = Math.max(0, this.fire - dt);
    this.syncEffects();

    if (p.flight && !p.death) this.updateFlight(dt);

    // Hop animation.
    if (p.hop) {
      const hop = p.hop;
      hop.t += dt / (HOP_DURATION * hop.span);
      hop.fromX += hop.drift * trafficDt;
      hop.toX += hop.drift * trafficDt;
      const t = Math.min(1, hop.t);
      p.x = hop.fromX + (hop.toX - hop.fromX) * t;
      p.z = hop.fromZ + (hop.toZ - hop.fromZ) * t;
      p.y = Math.sin(Math.PI * t) * (hop.span > 1 ? 2 : 1);
      if (hop.t >= 1 && !p.death) this.land();
    }

    if (p.ride && !p.death) {
      p.x = p.ride.x + p.rideOffset;
      if (Math.abs(p.x) > COLS + 0.6) {
        // Swept to the edge: the frog leaps to the nearest log still in play.
        const lane = this.lanes.get(p.row);
        const slot = this.character === "frog" && lane ? this.nearestLogSlot(lane, p.x) : null;
        if (slot !== null && lane) {
          p.x = slot;
          this.boardLog(lane);
        } else if (lane) {
          this.splash(lane);
        } else {
          this.die("water");
        }
      }
    }

    // Standing in open water (a log swept away, or a warp gone wrong): grab a log underneath or fall in.
    const here = this.lanes.get(p.row);
    if (here?.type === "river" && !p.ride && !p.hop && !p.flight && !p.death && !this.boardLog(here)) {
      this.splash(here);
    }

    if ((this.effects.magnet > 0 || this.character === "luigi") && !p.death) {
      // Luigi's Poltergust reaches further as he is upgraded; the magnet power-up keeps its own reach.
      const reach = Math.max(this.effects.magnet > 0 ? MAGNET_RADIUS : 0, this.character === "luigi" ? this.traits.luigiRadius : 0);
      for (let r = p.row - Math.ceil(reach); r <= p.row + Math.ceil(reach); r++) {
        const lane = this.lanes.get(r);
        if (lane && lane.coin !== null && Math.abs(lane.coin - p.x) <= reach + 0.5 && Math.abs(r - p.row) <= reach) this.pullCoin(lane);
      }
    }

    for (const s of this.splashes) s.t += dt / SPLASH_TIME;
    if (this.splashes.some((s) => s.t >= 1)) this.splashes = this.splashes.filter((s) => s.t < 1);

    for (const c of this.pulled) c.t += dt / MAGNET_PULL_TIME;
    if (this.pulled.some((c) => c.t >= 1)) {
      for (const c of this.pulled) if (c.t >= 1) this.bankCoin();
      this.pulled = this.pulled.filter((c) => c.t < 1);
    }

    if (playing && !p.death) {
      this.checkCollisions();
      // The eagle lives in world time: slowmo slows its idle clock, freeze stops it outright.
      this.idle += trafficDt;
      if (this.effects.scarecrow > 0) {
        // No eagle: forget idling and hold the camera back so it can't leave the chicken behind.
        this.idle = 0;
        this.focus = Math.min(this.focus, p.row + MAX_ROWS_BEHIND_CAMERA - 0.5);
      } else if (this.effects.freeze > 0) {
        // Frozen eagle: the idle clock is paused above, and the camera can't leave the chicken behind.
        this.focus = Math.min(this.focus, p.row + MAX_ROWS_BEHIND_CAMERA - 0.5);
      } else if ((this.idle > IDLE_LIMIT * 0.4 || p.row < this.focus - MAX_ROWS_BEHIND_CAMERA + 2) && this.hint("eagle")) {
        // Warned about the eagle: start its clock afresh once play resumes.
        this.idle = 0;
      } else if (this.idle > IDLE_LIMIT || p.row < this.focus - MAX_ROWS_BEHIND_CAMERA) {
        this.die("eagle");
        this.eagle = { t: 0, startZ: p.z + 14 };
      }
    }

    if (p.death) {
      // An eagle that is already swooping flies in world time too, so slowmo slows the grab.
      this.updateDeath(dt, worldDt);
      const delay = p.death.kind === "eagle" ? RESPAWN_DELAY + 0.6 : RESPAWN_DELAY;
      if (p.death.revive && p.death.t > delay) this.respawn();
    }

    // Camera focus: chase the player when ahead, otherwise creep forward.
    if (playing) {
      const creep = 0.28 + Math.min(0.5, this.ui.score / 400);
      this.focus += creep * trafficDt;
      if (p.z > this.focus) this.focus += (p.z - this.focus) * Math.min(1, dt * 4);
    }
    this.cameraX += (Math.max(-2, Math.min(2, p.x * 0.6)) - this.cameraX) * Math.min(1, dt * 3);

    this.ensureLanes();
  }

  private updateLane(lane: Lane, dt: number) {
    if (lane.type === "road" || lane.type === "river") {
      for (const m of lane.movers) {
        if (m.wrecked !== null) {
          m.wrecked += dt;
          continue;
        }
        const before = m.x - this.player.x;
        m.x += lane.speed * dt * (lane.type === "road" ? this.speedScale : 1);
        // A car going past the player's column, close by.
        const after = m.x - this.player.x;
        if (lane.type === "road" && this.audible && Math.sign(before) !== Math.sign(after) && Math.abs(after) < 2) {
          sound.carPass(lane.row - this.player.row, m.length);
        }
        // A fixed period keeps the spacing between movers constant forever.
        if (m.x > WRAP) m.x -= WRAP * 2;
        if (m.x < -WRAP) m.x += WRAP * 2;
      }
    } else if (lane.type === "rail") {
      const train = lane.train;
      const len = trainLength(lane);
      const dir = Math.sign(lane.speed);
      const rows = lane.row - this.player.row;
      if (train.active) {
        const before = train.x - this.player.x;
        train.x += dir * TRAIN_SPEED * this.speedScale * dt;
        // The engine reaching the player's column (the train's x is its middle, so lead by half its length).
        const lead = dir * len / 2;
        if (this.audible && Math.sign(before + lead) !== Math.sign(train.x - this.player.x + lead)) sound.trainPass(rows);
        if (Math.abs(train.x) > WRAP + len) {
          train.active = false;
          train.warning = false;
          train.timer = 3 + Math.random() * 6;
        }
      } else {
        train.timer -= dt;
        const warned = train.warning;
        train.warning = train.timer < TRAIN_WARNING;
        if (train.warning && !warned && this.audible) sound.trainBell(rows);
        if (train.timer <= 0) {
          train.active = true;
          if (this.audible) sound.trainHorn(rows);
          train.x = -dir * (WRAP + len / 2);
        }
      }
    }
  }

  /** Sounds play only during a run, not behind the menu. */
  private get audible() {
    return this.ui.status === "playing";
  }

  /** The murmur of the nearest river (or lava) within a few rows. */
  private hearRivers() {
    const p = this.player;
    let level = 0;
    let lava = false;
    for (let r = p.row - 3; r <= p.row + 3; r++) {
      const lane = this.lanes.get(r);
      if (lane?.type !== "river") continue;
      const l = 1 - Math.abs(r - p.row) / 4;
      if (l > level) [level, lava] = [l, lane.biome === "volcano"];
    }
    sound.riverAmbience(level, lava);
  }

  private checkCollisions() {
    const p = this.player;
    const lane = this.lanes.get(p.row);
    // High in the air, nothing on the ground can reach the player.
    if (!lane || p.flight) return;
    // Mid-hop between lanes the chicken only counts as being in its target lane once past halfway.
    if (p.hop && p.hop.t < 0.5) return;
    // Tiny chickens are harder to hit.
    const margin = this.effects.tiny > 0 ? 0.08 : 0.3;
    if (lane.type === "road") {
      for (const m of lane.movers) {
        if (m.wrecked !== null || this.untouchable(lane) || Math.abs(p.x - m.x) >= m.length / 2 + margin) continue;
        // A rock chicken wrecks whatever drives into it.
        if (this.effects.rock > 0) m.wrecked = 0;
        else if (p.shield <= 0 && !this.popShield() && !this.shrink()) {
          this.die("car");
          return;
        }
      }
    } else if (lane.type === "rail" && lane.train.active && p.shield <= 0) {
      const len = trainLength(lane);
      if (
        !this.untouchable(lane) &&
        Math.abs(p.x - lane.train.x) < len / 2 + margin &&
        !this.popShield() &&
        !this.shrink()
      ) {
        this.die("train", Math.sign(lane.speed));
      }
    }
  }

  /** The shield bubble soaks up one hit, then gives a moment to get clear. */
  private popShield() {
    if (this.effects.shield <= 0) return false;
    this.effects.shield = 0;
    this.player.shield = 1.5;
    this.syncEffects();
    this.setUi({ toast: { text: "SHIELD POPPED", id: ++this.toastId } });
    return true;
  }

  /** Big Mario takes a hit by shrinking, with a moment to get clear. */
  private shrink() {
    if (!this.marioBig) return false;
    this.big = false;
    this.player.shield = 1.5;
    this.setUi({ toast: { text: "SHRUNK!", id: ++this.toastId } });
    return true;
  }

  private updateDeath(dt: number, worldDt: number) {
    const p = this.player;
    const death = p.death!;
    // Keep the eagle's grab and the respawn wait in step, so a slowed swoop still finishes before respawn.
    death.t += death.kind === "eagle" ? worldDt : dt;
    if (death.kind === "train") {
      p.x += death.pushX * TRAIN_SPEED * dt * Math.max(0, 1 - death.t * 2);
    }
    if (this.eagle) this.eagle.t += worldDt;
  }
}
