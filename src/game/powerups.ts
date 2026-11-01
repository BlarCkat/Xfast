import {
  COIN_RAIN_ROWS,
  FLIGHT_SPEED,
  FORESIGHT_STEPS,
  MAGNET_RADIUS,
  POWERUP_DURATION,
  SLOWMO_SCALE,
  WARP_ROWS,
} from "./config";

const FORESIGHT_FAR = FORESIGHT_STEPS[FORESIGHT_STEPS.length - 1];

export type PowerUp = keyof typeof POWERUP_DURATION;
export type Effects = Record<PowerUp, number>;

export interface PowerUpInfo {
  key: PowerUp;
  label: string;
  color: string;
  price: number;
  description: string;
}

/** Every power-up, in store order; the first ten get hotkeys 1-9 then 0. */
export const POWERUPS: PowerUpInfo[] = [
  { key: "foresight", label: "FORESIGHT", color: "#8e5cf7", price: 30, description: "See traffic a moment ahead." },
  { key: "slowmo", label: "SLOWMO", color: "#2f6fb5", price: 30, description: "Slow the world while you hop at full speed." },
  { key: "rock", label: "ROCK", color: "#6f7177", price: 40, description: "Wreck any car that hits you." },
  { key: "magnet", label: "MAGNET", color: "#d63c3c", price: 25, description: "Pull in coins within 2 tiles." },
  { key: "double", label: "2X COINS", color: "#d9a400", price: 25, description: "Every coin counts twice." },
  { key: "superhop", label: "SUPER HOP", color: "#2e9e4f", price: 35, description: "Forward hops jump 2 rows." },
  { key: "shield", label: "SHIELD", color: "#1fa3b8", price: 45, description: "A bubble that absorbs one hit from a car or train." },
  { key: "freeze", label: "FREEZE", color: "#5bc0eb", price: 40, description: "Stop all traffic and trains." },
  { key: "wings", label: "FLIGHT", color: "#9aa5b1", price: 35, description: "Soar forward over everything, then land on safe grass." },
  { key: "scarecrow", label: "SCARECROW", color: "#a0692e", price: 30, description: "Keep the eagle away, however slow you go." },
  { key: "ghost", label: "GHOST", color: "#b9a7e8", price: 50, description: "Cars and trains pass straight through you." },
  { key: "tiny", label: "TINY", color: "#f28fb1", price: 30, description: "Shrink so traffic has to miss by less." },
  { key: "lumberjack", label: "LUMBERJACK", color: "#7a4b2a", price: 25, description: "Chop through trees in your way." },
  { key: "warp", label: "WARP", color: "#3f51b5", price: 45, description: "Instantly jump ahead to safe grass." },
  { key: "coinrain", label: "COIN RAIN", color: "#e0a800", price: 20, description: "Instantly drop coins on the lanes ahead." },
];

export const POWERUP_KEYS = POWERUPS.map((p) => p.key);

export const noEffects = (): Effects =>
  Object.fromEntries(POWERUP_KEYS.map((k) => [k, 0])) as Effects;

export const hotkeyFor = (i: number) => (i < 10 ? `Digit${(i + 1) % 10}` : null);

export const isInstant = (k: PowerUp) => POWERUP_DURATION[k] === 0;

// ---- Upgrades -------------------------------------------------------------------
//
// A power-up climbs three tiers of seven upgrades each. Filling a tier unlocks a pricier step into
// the next one, which starts again from an empty row of boxes. Progress is stored as a single count
// of steps taken (level upgrades and tier steps alike), from 0 up to MAX_UPGRADES.

export const TIERS = 3;
export const TIER_SIZE = 7;
/** Gems for one upgrade inside each tier. */
export const LEVEL_COST = [2, 4, 6];
/** Gems to step up into tier 2 and tier 3. */
export const TIER_COST = [0, 10, 20];
export const MAX_UPGRADES = TIERS * (TIER_SIZE + 1) - 1;

/** Which tier (1-3) a power-up is on, and how many of that tier's boxes are filled. */
export function tierOf(upgrades: number) {
  const tier = Math.min(TIERS, Math.floor(upgrades / (TIER_SIZE + 1)) + 1);
  return { tier, filled: upgrades - (tier - 1) * (TIER_SIZE + 1) };
}

/** The next step for a power-up: another box in this tier, a step into the next tier, or nothing at max. */
export function nextUpgrade(upgrades: number): { kind: "level" | "tier"; tier: number; cost: number } | null {
  if (upgrades >= MAX_UPGRADES) return null;
  const { tier, filled } = tierOf(upgrades);
  if (filled < TIER_SIZE) return { kind: "level", tier, cost: LEVEL_COST[tier - 1] };
  return { kind: "tier", tier: tier + 1, cost: TIER_COST[tier] };
}

/** How far along the whole upgrade path a power-up is, 0 to 1. */
const progress = (upgrades: number) => Math.min(1, upgrades / MAX_UPGRADES);

/** Fully upgraded power-ups last three times as long. */
export const durationAt = (k: PowerUp, upgrades: number) => POWERUP_DURATION[k] * (1 + 2 * progress(upgrades));

/** Warp reaches up to 12 more rows; coin rain covers up to 24 more lanes. */
export const warpRowsAt = (upgrades: number) => WARP_ROWS + Math.round(12 * progress(upgrades));
export const coinRainRowsAt = (upgrades: number) => COIN_RAIN_ROWS + Math.round(24 * progress(upgrades));

// ---- Upgraded strength ------------------------------------------------------------
//
// Upgrades make each power-up last longer and also work better. The numbers below go from the
// base effect with no upgrades to the strongest one at MAX_UPGRADES; a few power-ups also gain an
// extra trick when they step up into a new tier.

/** Foresight's ghosts look further ahead: x1 up to x1.75 (the far ghost from 1.2s to 2.1s). */
export const foresightReachAt = (upgrades: number) => 1 + 0.75 * progress(upgrades);
/** Slowmo's world speed: 35% down to 15%. */
export const slowmoScaleAt = (upgrades: number) => SLOWMO_SCALE - 0.2 * progress(upgrades);
/** Coins a car pays out when it crashes into a rock: none, up to 3. */
export const rockCoinsAt = (upgrades: number) => Math.round(3 * progress(upgrades));
/** Magnet reach in tiles: 2 up to 4. */
export const magnetRadiusAt = (upgrades: number) => MAGNET_RADIUS + 2 * progress(upgrades);
/** Chance a 2x coin comes in triple instead: 0% up to 50%. */
export const tripleChanceAt = (upgrades: number) => 0.5 * progress(upgrades);
/** Rows a super hop covers: 2, then 3 from tier 3. */
export const superHopRowsAt = (upgrades: number) => (tierOf(upgrades).tier >= 3 ? 3 : 2);
/** Hits a shield soaks up: one per tier. */
export const shieldHitsAt = (upgrades: number) => tierOf(upgrades).tier;
/** Seconds traffic takes to thaw back up to speed after a freeze: none, up to 3. */
export const freezeThawAt = (upgrades: number) => 3 * progress(upgrades);
/** Flight speed in rows a second: 4 up to 6. */
export const flightSpeedAt = (upgrades: number) => FLIGHT_SPEED + 2 * progress(upgrades);
/** Seconds the eagle keeps away after a scarecrow runs out: none, up to 6. */
export const scarecrowGraceAt = (upgrades: number) => 6 * progress(upgrades);
/** A ghost floats through trees too from tier 2. */
export const ghostTreesAt = (upgrades: number) => tierOf(upgrades).tier >= 2;
/** Tiny's size (55% down to 40%) and how close traffic has to pass (0.08 down to -0.12 tiles). */
export const tinyScaleAt = (upgrades: number) => 0.55 - 0.15 * progress(upgrades);
export const tinyMarginAt = (upgrades: number) => 0.08 - 0.2 * progress(upgrades);
/** Chance a chopped tree drops a coin: 0% up to 100%. */
export const chopCoinAt = (upgrades: number) => progress(upgrades);

const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (s: number) => `${Number.isInteger(s) ? s : s.toFixed(1)}s`;

/** What upgrading adds to a power-up beyond its timer, for the store; null when there is nothing yet. */
export function effectAt(k: PowerUp, upgrades: number): string | null {
  switch (k) {
    case "foresight":
      return `sees ${secs(Math.round(FORESIGHT_FAR * foresightReachAt(upgrades) * 10) / 10)} ahead`;
    case "slowmo":
      return `world at ${pct(slowmoScaleAt(upgrades))} speed`;
    case "rock": {
      const n = rockCoinsAt(upgrades);
      return n ? `+${n} coin${n > 1 ? "s" : ""} per wrecked car` : null;
    }
    case "magnet":
      return `${(Math.round(magnetRadiusAt(upgrades) * 10) / 10).toString()} tile reach`;
    case "double": {
      const c = tripleChanceAt(upgrades);
      return c ? `${pct(c)} triple coins` : null;
    }
    case "superhop":
      return `hops ${superHopRowsAt(upgrades)} rows`;
    case "shield": {
      const n = shieldHitsAt(upgrades);
      return `blocks ${n} hit${n > 1 ? "s" : ""}`;
    }
    case "freeze": {
      const t = freezeThawAt(upgrades);
      return t ? `${secs(Math.round(t * 10) / 10)} thaw after` : null;
    }
    case "wings":
      return `flies ${(Math.round(flightSpeedAt(upgrades) * 10) / 10).toString()} rows/s`;
    case "scarecrow": {
      const t = scarecrowGraceAt(upgrades);
      return t ? `eagle waits ${secs(Math.round(t * 10) / 10)} after` : null;
    }
    case "ghost":
      return ghostTreesAt(upgrades) ? "through trees too" : null;
    case "tiny":
      return `${pct(tinyScaleAt(upgrades))} size`;
    case "lumberjack": {
      const c = chopCoinAt(upgrades);
      return c ? `${pct(c)} chance of a coin per tree` : null;
    }
    case "warp":
      return `${warpRowsAt(upgrades)}+ rows`;
    case "coinrain":
      return `${coinRainRowsAt(upgrades)} lanes`;
  }
}

/** One line describing what a power-up does after a number of upgrades, for the store. */
export function strengthAt(k: PowerUp, upgrades: number) {
  const effect = effectAt(k, upgrades);
  if (isInstant(k)) return effect ?? "";
  const time = secs(durationAt(k, upgrades));
  return effect ? `${time}, ${effect}` : time;
}

/** Just the timer, or the instant effect, for the short line on the store card. */
export function headlineAt(k: PowerUp, upgrades: number) {
  return isInstant(k) ? (effectAt(k, upgrades) ?? "") : secs(durationAt(k, upgrades));
}
