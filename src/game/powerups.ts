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
  { key: "wings", label: "FLIGHT", color: "#9aa5b1", price: 35, description: "Hover over water without drowning." },
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

export const MAX_LEVEL = 5;

/** Coins to go from `level` to `level + 1`: four times the power-up's price per level. */
export const upgradeCost = (k: PowerUp, level: number) =>
  POWERUPS.find((p) => p.key === k)!.price * 4 * level;

/** Each level past the first adds a quarter of the base duration, so level 5 lasts twice as long. */
export const durationAt = (k: PowerUp, level: number) => POWERUP_DURATION[k] * (1 + (level - 1) * 0.25);

/** Warp jumps 2 more rows per level; coin rain covers 4 more lanes per level. */
export const warpRowsAt = (level: number) => WARP_ROWS + (level - 1) * 2;
export const coinRainRowsAt = (level: number) => COIN_RAIN_ROWS + (level - 1) * 4;

/** One line describing what a power-up does at a level, for the store. */
export function strengthAt(k: PowerUp, level: number) {
  if (k === "warp") return `${warpRowsAt(level)}+ rows`;
  if (k === "coinrain") return `${coinRainRowsAt(level)} lanes`;
  const s = durationAt(k, level);
  return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
}
