import { BIOMES, biomeAt, type BiomeId } from "./biomes";
import {
  COLS,
  HOP_DURATION,
  IDLE_LIMIT,
  MAGNET_RADIUS,
  MAX_SPEED_SCALE,
  SPEEDUP_STEP,
  STEPS_PER_SPEEDUP,
  MAX_ROWS_BEHIND_CAMERA,
  RESPAWN_DELAY,
  RESPAWN_SHIELD,
  SLOWMO_SCALE,
  START_LIVES,
  CAT_LIVES,
  CAT_REFILL_HOPS,
  CHICKEN_POWERUP_BONUS,
  TIME_TRAIT_HOPS,
  MARIO_COINS_PER_LIFE,
  BOWSER_FIRE_HOPS,
  BOWSER_FIRE_ROWS,
  ROWS_AHEAD,
  ROWS_BEHIND,
  TRAIN_SPEED,
  TRAIN_WARNING,
  WRAP,
} from "./config";
import { Lane, LaneGenerator, Mover, PickupKind, trainLength } from "./lanes";
import {
  POWERUPS,
  coinRainRowsAt,
  durationAt,
  isInstant,
  noEffects,
  warpRowsAt,
  type Effects,
  type PowerUp,
} from "./powerups";
import { type CharacterId, wallet } from "./wallet";

export type { Effects, PowerUp };

export type Direction = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "dead";
export type DeathKind = "car" | "train" | "water" | "eagle";
const PICKUP_LABEL = {
  life: "+1 LIFE",
  ...Object.fromEntries(POWERUPS.map((p) => [p.key, p.label])),
} as Record<PickupKind, string>;

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
  /** Whole seconds left on each power-up (0 = inactive); only changes once a second. */
  effects: Effects;
  toast: null | { text: string; id: number };
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
  /** Bumped whenever lanes are added or removed so React can re-render the list. */
  laneVersion = 0;
  eagle: null | { t: number; startZ: number } = null;
  /** Exact seconds left on each power-up. */
  effects: Effects = noEffects();
  private toastId = 0;
  /** Biome the player is currently in, announced when it changes. */
  biome: BiomeId = biomeAt(0);
  /** Multiplier on car, truck and train speed, raised every STEPS_PER_SPEEDUP hops. */
  speedScale = 1;

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
  };

  private generator: LaneGenerator;
  private ui: UiSnapshot;
  private listeners = new Set<() => void>();

  readonly character: CharacterId;

  constructor(character: CharacterId = "chicken", seed = Math.floor(Math.random() * 1e9)) {
    this.character = character;
    this.generator = new LaneGenerator(seed);
    this.ui = {
      status: "ready",
      score: 0,
      best: readBest(),
      lives: character === "cat" ? CAT_LIVES : START_LIVES,
      steps: 0,
      coins: 0,
      effects: noEffects(),
      toast: null,
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
    if (this.ui.status === "dead") return;
    if (this.ui.status === "ready") {
      // Extra lives bought in the store are spent when a run starts.
      this.setUi({ status: "playing", lives: this.ui.lives + wallet.takeLives() });
      if (this.character === "penguin") {
        this.apply("shield");
        this.syncEffects(true);
      }
    }
    const p = this.player;
    if (p.death) return;
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
    if (!open(toRow)) return;
    // The frog aims for the nearest log in the river it is jumping into, so it never lands in water.
    if (this.character === "frog" && !riding) {
      const lane = this.lanes.get(toRow);
      if (lane?.type === "river") toX = this.nearestLogSlot(lane, toX, HOP_DURATION * span) ?? toX;
    }

    p.hop = { fromX: p.x, toX, fromZ: p.z, toZ: toRow, t: 0, drift, span };
    p.row = toRow;
    p.ride = null;

    this.countStep();
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
    if (lane?.type === "river" && this.character === "frog" && !this.boardLog(lane)) {
      const slot = this.nearestLogSlot(lane, p.x);
      if (slot !== null) p.x = slot;
    }
    if (lane?.type === "river" && !this.boardLog(lane)) {
      // Wings let the chicken hover over open water.
      if (this.effects.wings <= 0 && this.splash(lane)) return;
    }

    if (lane && lane.biome !== this.biome) {
      this.biome = lane.biome;
      this.setUi({ toast: { text: BIOMES[lane.biome].label.toUpperCase(), id: ++this.toastId } });
      // Mario finds a fresh Super Mushroom in every new biome.
      if (this.character === "mario") this.big = true;
    }
    if (lane?.type === "grass" && lane.blocked.has(Math.round(p.x))) this.chop(lane, Math.round(p.x));
    if (lane?.pickup && Math.round(p.x) === lane.pickup.x) this.collect(lane);
    if (lane && lane.coin !== null && Math.round(p.x) === lane.coin) this.collectCoin(lane);

    if (p.queued) {
      const next = p.queued;
      p.queued = null;
      this.startHop(next);
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
    if (this.character === "duck") this.dive();
    else this.die("water");
    return true;
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

  private collectCoin(lane: Lane) {
    lane.coin = null;
    const n = this.effects.double > 0 ? 2 : 1;
    wallet.addCoins(n);
    this.setUi({ coins: this.ui.coins + n });
    if (this.character === "mario") {
      this.marioCoins += n;
      if (this.marioCoins >= MARIO_COINS_PER_LIFE) {
        this.marioCoins -= MARIO_COINS_PER_LIFE;
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
    return CAT_REFILL_HOPS * 2 ** Math.max(0, this.catLivesSpent - 1);
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
    if (this.character === "cat") this.catRefill();
    const steps = this.ui.steps + 1;
    // Sparrow and snail bend time every so many hops.
    const timeTrait = this.character === "sparrow" ? "freeze" : this.character === "snail" ? "slowmo" : null;
    if (this.character === "bowser" && steps % BOWSER_FIRE_HOPS === 0) this.breatheFire();
    if (timeTrait && steps % TIME_TRAIT_HOPS === 0) {
      this.apply(timeTrait);
      this.syncEffects(true);
      this.setUi({ toast: { text: PICKUP_LABEL[timeTrait], id: ++this.toastId } });
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
    if (kind === "life") this.setUi({ lives: this.ui.lives + 1 });
    else if (this.character === "duck") {
      // The duck pockets power-ups for later in the run instead of using them straight away.
      this.setUi({
        stash: { ...this.ui.stash, [kind]: this.ui.stash[kind] + 1 },
        toast: { text: `${PICKUP_LABEL[kind]} SAVED`, id: ++this.toastId },
      });
      return;
    } else this.apply(kind);
    this.syncEffects(true);
    this.setUi({ toast: { text: PICKUP_LABEL[kind], id: ++this.toastId } });
  }

  /** Use a power-up bought in the store. */
  activate(kind: PowerUp) {
    if (this.ui.status !== "playing" || this.player.death) return false;
    // Spend what the duck saved this run before anything bought in the store.
    if (this.ui.stash[kind] > 0) this.setUi({ stash: { ...this.ui.stash, [kind]: this.ui.stash[kind] - 1 } });
    else if (!wallet.use(kind)) return false;
    this.apply(kind);
    this.syncEffects(true);
    this.setUi({ toast: { text: PICKUP_LABEL[kind], id: ++this.toastId } });
    return true;
  }

  private apply(kind: PowerUp) {
    if (!isInstant(kind)) {
      const level = wallet.get().levels[kind];
      this.effects[kind] = durationAt(kind, level) * (this.character === "chicken" ? CHICKEN_POWERUP_BONUS : 1);
      return;
    }
    if (kind === "warp") this.warp();
    if (kind === "coinrain") this.coinRain();
  }

  /** Jump to the first open grass at least WARP_ROWS (more when upgraded) ahead. */
  private warp() {
    const p = this.player;
    const want = Math.max(-COLS, Math.min(COLS, Math.round(p.x)));
    const rows = warpRowsAt(wallet.get().levels.warp);
    for (let row = p.row + rows; row < p.row + rows + 15; row++) {
      const lane = this.lanes.get(row);
      if (lane?.type !== "grass") continue;
      const x = this.freeColumn(lane, want);
      if (x === null) continue;
      Object.assign(p, { row, x, z: row, y: 0, hop: null, queued: null, ride: null });
      p.shield = Math.max(p.shield, 1);
      this.idle = 0;
      if (row > this.ui.score) this.setUi({ score: row });
      this.ensureLanes();
      return;
    }
  }

  private coinRain() {
    const p = this.player;
    for (let row = p.row + 1; row <= p.row + coinRainRowsAt(wallet.get().levels.coinrain); row++) {
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
    for (let row = p.row + 1; row <= p.row + BOWSER_FIRE_ROWS; row++) {
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
    p.queued = null;
    p.ride = null;
    if (kind !== "eagle") p.hop = null;
    // Power-ups end with the life they were collected on.
    this.effects = noEffects();
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
    Object.assign(p, { row, x, z: row, y: 0, hop: null, queued: null, ride: null, death: null, facing: 0 });
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
    const dt = Math.min(rawDt, 1 / 20);
    // Slowmo slows the world down; the chicken's own hops stay at full speed.
    const worldDt = this.effects.slowmo > 0 ? dt * SLOWMO_SCALE : dt;
    this.time += dt;
    const playing = this.ui.status === "playing";
    const p = this.player;

    // Freeze stops traffic and trains outright.
    const trafficDt = this.effects.freeze > 0 ? 0 : worldDt;
    for (const lane of this.lanes.values()) this.updateLane(lane, trafficDt);

    for (const k of Object.keys(this.effects) as PowerUp[]) this.effects[k] = Math.max(0, this.effects[k] - dt);
    p.shield = Math.max(0, p.shield - dt);
    this.fire = Math.max(0, this.fire - dt);
    this.syncEffects();

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

    // Hovering over water on wings: grab a log that drifts underneath, or fall in once the wings run out.
    const here = this.lanes.get(p.row);
    if (
      here?.type === "river" &&
      !p.ride &&
      !p.hop &&
      !p.death &&
      !this.boardLog(here) &&
      this.effects.wings <= 0
    ) {
      this.splash(here);
    }

    if ((this.effects.magnet > 0 || this.character === "luigi") && !p.death) {
      for (let r = p.row - MAGNET_RADIUS; r <= p.row + MAGNET_RADIUS; r++) {
        const lane = this.lanes.get(r);
        if (lane && lane.coin !== null && Math.abs(lane.coin - p.x) <= MAGNET_RADIUS + 0.5) this.collectCoin(lane);
      }
    }

    if (playing && !p.death) {
      this.checkCollisions();
      this.idle += worldDt;
      if (this.effects.scarecrow > 0) {
        // No eagle: forget idling and hold the camera back so it can't leave the chicken behind.
        this.idle = 0;
        this.focus = Math.min(this.focus, p.row + MAX_ROWS_BEHIND_CAMERA - 0.5);
      } else if (this.idle > IDLE_LIMIT || p.row < this.focus - MAX_ROWS_BEHIND_CAMERA) {
        this.die("eagle");
        this.eagle = { t: 0, startZ: p.z + 14 };
      }
    }

    if (p.death) {
      this.updateDeath(dt);
      const delay = p.death.kind === "eagle" ? RESPAWN_DELAY + 0.6 : RESPAWN_DELAY;
      if (p.death.revive && p.death.t > delay) this.respawn();
    }

    // Camera focus: chase the player when ahead, otherwise creep forward.
    if (playing) {
      const creep = 0.28 + Math.min(0.5, this.ui.score / 400);
      this.focus += creep * worldDt;
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
        m.x += lane.speed * dt * (lane.type === "road" ? this.speedScale : 1);
        // A fixed period keeps the spacing between movers constant forever.
        if (m.x > WRAP) m.x -= WRAP * 2;
        if (m.x < -WRAP) m.x += WRAP * 2;
      }
    } else if (lane.type === "rail") {
      const train = lane.train;
      const len = trainLength(lane);
      const dir = Math.sign(lane.speed);
      if (train.active) {
        train.x += dir * TRAIN_SPEED * this.speedScale * dt;
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
