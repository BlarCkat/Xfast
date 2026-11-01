import { COIN_RAIN_ROWS, POWERUP_DURATION, WARP_ROWS } from "./config";

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

/** One line describing what a power-up does after a number of upgrades, for the store. */
export function strengthAt(k: PowerUp, upgrades: number) {
  if (k === "warp") return `${warpRowsAt(upgrades)}+ rows`;
  if (k === "coinrain") return `${coinRainRowsAt(upgrades)} lanes`;
  const s = durationAt(k, upgrades);
  return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
}
