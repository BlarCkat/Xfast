import { POWERUP_DURATION } from "./config";

export type PowerUp = keyof typeof POWERUP_DURATION;
export type Effects = Record<PowerUp, number>;

export interface PowerUpInfo {
  key: PowerUp;
  label: string;
  color: string;
  price: number;
  description: string;
}

/** Every power-up, in store and hotkey order (keys 1-9 then 0). */
export const POWERUPS: PowerUpInfo[] = [
  { key: "foresight", label: "FORESIGHT", color: "#8e5cf7", price: 30, description: "See traffic a moment ahead for 5s." },
  { key: "slowmo", label: "SLOWMO", color: "#2f6fb5", price: 30, description: "Slow the world for 5s while you hop at full speed." },
  { key: "rock", label: "ROCK", color: "#6f7177", price: 40, description: "Wreck any car that hits you for 6s." },
  { key: "magnet", label: "MAGNET", color: "#d63c3c", price: 25, description: "Pull in coins within 2 tiles for 8s." },
  { key: "double", label: "2X COINS", color: "#d9a400", price: 25, description: "Every coin counts twice for 10s." },
  { key: "superhop", label: "SUPER HOP", color: "#2e9e4f", price: 35, description: "Forward hops jump 2 rows for 8s." },
  { key: "shield", label: "SHIELD", color: "#1fa3b8", price: 45, description: "A bubble that absorbs one hit from a car or train (lasts 20s)." },
  { key: "freeze", label: "FREEZE", color: "#5bc0eb", price: 40, description: "Stop all traffic and trains for 4s." },
  { key: "wings", label: "WINGS", color: "#9aa5b1", price: 35, description: "Hover over water without drowning for 6s." },
  { key: "scarecrow", label: "SCARECROW", color: "#a0692e", price: 30, description: "Keep the eagle away for 10s, however slow you go." },
];

export const POWERUP_KEYS = POWERUPS.map((p) => p.key);

export const noEffects = (): Effects =>
  Object.fromEntries(POWERUP_KEYS.map((k) => [k, 0])) as Effects;

export const hotkeyFor = (i: number) => `Digit${(i + 1) % 10}`;
