import {
  BOWSER_FIRE_HOPS,
  BOWSER_FIRE_ROWS,
  CAT_REFILL_HOPS,
  CHICKEN_POWERUP_BONUS,
  LEAP_TRAIT_HOPS,
  MAGNET_RADIUS,
  MARIO_COINS_PER_LIFE,
  TIGER_ROAR_HOPS,
  TIME_TRAIT_HOPS,
} from "./config";
import type { CharacterId } from "./wallet";

// Character upgrades. Every character climbs nine levels of five boxes each, like the power-ups:
// each upgrade fills the next box of the current level, and once all five are full the character can
// step up a level, which starts filling the boxes again in that level's colour. Every step (box or
// level) strengthens the character's own trait a little, and nothing else. A character's progress is
// one count of steps taken, from 0 (level 1 as bought) up to MAX_CHARACTER_STEPS.

export const CHARACTER_LEVELS = 9;
export const CHARACTER_BOXES = 5;
export const MAX_CHARACTER_STEPS = CHARACTER_LEVELS * (CHARACTER_BOXES + 1) - 1;
/** Gems for one box upgrade on each level, 1 to 9. */
export const CHARACTER_BOX_COST = [2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Gems to step up into each level, indexed by that level (levels 2 to 9). */
export const CHARACTER_LEVEL_COST = [0, 0, 10, 15, 20, 25, 30, 35, 40, 45];
/** Each level's box colour: green, yellow, orange, red, pink, sky, teal, lavender, white. */
export const CHARACTER_LEVEL_COLORS = ["#7ed957", "#f4d03f", "#ff9a3c", "#f2545b", "#ff7ac8", "#5bc0eb", "#2ee6c4", "#c9a7ff", "#ffffff"];

/** Which level (1-9) a character is on, and how many of that level's boxes are filled. */
export function characterLevelOf(steps: number) {
  const s = Math.max(0, Math.min(MAX_CHARACTER_STEPS, Math.round(steps) || 0));
  const level = Math.min(CHARACTER_LEVELS, Math.floor(s / (CHARACTER_BOXES + 1)) + 1);
  return { level, filled: s - (level - 1) * (CHARACTER_BOXES + 1) };
}

/** Steps taken by the time a character first reaches this level, with no boxes filled. */
export const stepsAtLevel = (level: number) => (Math.max(1, Math.min(CHARACTER_LEVELS, level)) - 1) * (CHARACTER_BOXES + 1);

/** The next step for a character: another box on this level, a step up a level, or nothing at max. */
export function nextCharacterStep(steps: number): { kind: "box" | "level"; level: number; cost: number } | null {
  if (steps >= MAX_CHARACTER_STEPS) return null;
  const { level, filled } = characterLevelOf(steps);
  if (filled < CHARACTER_BOXES) return { kind: "box", level, cost: CHARACTER_BOX_COST[level - 1] };
  return { kind: "level", level: level + 1, cost: CHARACTER_LEVEL_COST[level + 1] };
}

/** The numbers behind every trait. A character only uses its own; the rest stay as bought. */
export interface Traits {
  /** Chicken: power-ups last this many times longer. */
  powerupBonus: number;
  /** Duck: random power-ups already saved when a run starts. */
  duckStart: number;
  /** Frog: chance of catching a coin on each log it lands on. */
  frogCoin: number;
  /** Penguin: the starting shield lasts this many times longer. */
  penguinShield: number;
  /** Cat: hops for half a life to grow back. */
  catRefillHops: number;
  /** Robot: hops per bonus coin, 0 for none. */
  robotCoinHops: number;
  /** Sparrow and snail: hops between each bend in time. */
  timeTraitHops: number;
  /** Mario: coins per 1-UP. */
  marioCoinsPerLife: number;
  /** Luigi: how far the Poltergust reaches, in tiles. */
  luigiRadius: number;
  /** Bowser: hops between fire breaths, and how many rows they reach. */
  bowserFireHops: number;
  bowserFireRows: number;
  /** Human: chance a coin comes in triple instead of double. */
  humanTriple: number;
  /** Leopard and owl: hops between each pounce or flight. */
  leapHops: number;
  /** Tiger: hops between each roar, which puts up a shield. */
  tigerRoarHops: number;
}

const BASE: Traits = {
  powerupBonus: CHICKEN_POWERUP_BONUS,
  duckStart: 0,
  frogCoin: 0,
  penguinShield: 1,
  catRefillHops: CAT_REFILL_HOPS,
  robotCoinHops: 0,
  timeTraitHops: TIME_TRAIT_HOPS,
  marioCoinsPerLife: MARIO_COINS_PER_LIFE,
  luigiRadius: MAGNET_RADIUS,
  bowserFireHops: BOWSER_FIRE_HOPS,
  bowserFireRows: BOWSER_FIRE_ROWS,
  humanTriple: 0,
  leapHops: LEAP_TRAIT_HOPS,
  tigerRoarHops: TIGER_ROAR_HOPS,
};

/**
 * Each character's trait values along the upgrade path, from bought to fully upgraded. A trait moves
 * smoothly between these points with every step taken.
 */
const LADDER: { [K in CharacterId]: Partial<{ [T in keyof Traits]: number[] }> } = {
  chicken: { powerupBonus: [1.5, 1.6, 1.75, 1.9, 2] },
  duck: { duckStart: [0, 1, 2, 3, 4] },
  frog: { frogCoin: [0, 0.25, 0.5, 0.75, 1] },
  penguin: { penguinShield: [1, 1.5, 2, 2.5, 3] },
  cat: { catRefillHops: [20, 17, 14, 12, 10] },
  // Off as bought; the first upgrade switches it on (see OFF_AS_BOUGHT).
  robot: { robotCoinHops: [50, 40, 30, 20] },
  sparrow: { timeTraitHops: [100, 85, 70, 60, 50] },
  snail: { timeTraitHops: [100, 85, 70, 60, 50] },
  mario: { marioCoinsPerLife: [100, 90, 80, 70, 60] },
  luigi: { luigiRadius: [2, 2.5, 3, 3.5, 4] },
  bowser: { bowserFireHops: [50, 45, 40, 35, 30], bowserFireRows: [4, 5, 5, 6, 7] },
  human: { humanTriple: [0, 0.1, 0.2, 0.3, 0.4] },
  leopard: { leapHops: [50, 45, 40, 35, 30] },
  owl: { leapHops: [50, 45, 40, 35, 30] },
  tiger: { tigerRoarHops: [60, 52, 45, 38, 30] },
};

/** Traits a character doesn't have at all until its first upgrade. */
const OFF_AS_BOUGHT: (keyof Traits)[] = ["robotCoinHops"];

/** A trait's value this far (0 to 1) along its ladder: whole numbers stay whole, the rest keep two decimals. */
function along(values: number[], progress: number) {
  const x = Math.max(0, Math.min(1, progress)) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(x));
  const v = values[i] + (values[i + 1] - values[i]) * (x - i);
  return values.every(Number.isInteger) ? Math.round(v) : Math.round(v * 100) / 100;
}

/** The character's trait numbers after this many upgrade steps (see characterLevelOf). */
export function traitsAt(id: CharacterId, steps: number): Traits {
  const out = { ...BASE };
  for (const [key, values] of Object.entries(LADDER[id]) as [keyof Traits, number[]][]) {
    if (OFF_AS_BOUGHT.includes(key)) out[key] = steps > 0 ? along(values, (steps - 1) / (MAX_CHARACTER_STEPS - 1)) : 0;
    else out[key] = along(values, steps / MAX_CHARACTER_STEPS);
  }
  return out;
}

/** One decimal at most, for the numbers the cards show. */
const short = (n: number) => String(Math.round(n * 10) / 10);

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The character's trait as it plays after this many steps, for the store card. */
export function traitText(id: CharacterId, steps: number): string {
  const t = traitsAt(id, steps);
  switch (id) {
    case "chicken":
      return `Power-ups last ${pct(t.powerupBonus - 1)} longer.`;
    case "duck":
      return `Saves power-ups it picks up to use whenever you like that run${
        t.duckStart ? `, and starts every run with ${t.duckStart} already saved` : ""
      }. Falling in water dives to the seabed until it surfaces in the next river.`;
    case "frog":
      return `Never drowns: always lands on the nearest log ahead.${t.frogCoin ? ` Catches a coin on ${pct(t.frogCoin)} of logs.` : ""}`;
    case "penguin":
      return t.penguinShield > 1 ? `Starts every run with a shield that lasts ${short(t.penguinShield)}× as long.` : "Starts every run with a shield.";
    case "cat":
      return `Nine lives, and regrows lost ones: half a life every ${t.catRefillHops} hops, twice as slow after each life spent.`;
    case "robot":
      return `Foresight is always on.${t.robotCoinHops ? ` Mints a coin every ${t.robotCoinHops} hops.` : ""}`;
    case "sparrow":
      return `Stops time for a moment every ${t.timeTraitHops} hops.`;
    case "snail":
      return `Slows time for a moment every ${t.timeTraitHops} hops.`;
    case "mario":
      return `Super Mushroom: the first hit shrinks him instead of costing a life, and he grows back in each new biome. Every ${t.marioCoinsPerLife} coins is a 1-UP.`;
    case "luigi":
      return `Poltergust: sucks up coins within ${short(t.luigiRadius)} tiles. Ghost hunter: nothing can hit him in the Spooky biome.`;
    case "bowser":
      return `Smashes through trees and rocks, and breathes fire every ${t.bowserFireHops} hops to wreck ${t.bowserFireRows} rows of traffic ahead.`;
    case "human":
      return `Picks up every coin twice: coins are always doubled.${t.humanTriple ? ` ${pct(t.humanTriple)} of coins come in triple.` : ""}`;
    case "leopard":
      return `Pounces every ${t.leapHops} hops, leaping ahead to safe grass like a Warp.`;
    case "owl":
      return `Takes flight every ${t.leapHops} hops: Wings carry it over everything to safe grass.`;
    case "tiger":
      return `Roars every ${t.tigerRoarHops} hops, putting up a shield that soaks up the next hit.`;
  }
}

/** What the trait becomes after this many steps, compared with now, in a few words for the store card. */
export function nextPerk(id: CharacterId, steps: number, at: number): string | null {
  if (steps >= MAX_CHARACTER_STEPS) return null;
  const now = traitsAt(id, steps);
  const next = traitsAt(id, Math.min(MAX_CHARACTER_STEPS, at));
  switch (id) {
    case "chicken":
      return `power-ups +${pct(next.powerupBonus - 1)}`;
    case "duck":
      return `${next.duckStart} saved at start`;
    case "frog":
      return `coin on ${pct(next.frogCoin)} of logs`;
    case "penguin":
      return `${short(next.penguinShield)}× starting shield`;
    case "cat":
      return `regrow every ${next.catRefillHops} hops`;
    case "robot":
      return `a coin every ${next.robotCoinHops} hops`;
    case "sparrow":
    case "snail":
      return `every ${next.timeTraitHops} hops`;
    case "mario":
      return `1-UP every ${next.marioCoinsPerLife} coins`;
    case "luigi":
      return `${short(next.luigiRadius)}-tile Poltergust`;
    case "bowser":
      return next.bowserFireRows > now.bowserFireRows
        ? `fire every ${next.bowserFireHops} hops, ${next.bowserFireRows} rows`
        : `fire every ${next.bowserFireHops} hops`;
    case "human":
      return `${pct(next.humanTriple)} triple coins`;
    case "leopard":
      return `pounce every ${next.leapHops} hops`;
    case "owl":
      return `fly every ${next.leapHops} hops`;
    case "tiger":
      return `roar every ${next.tigerRoarHops} hops`;
  }
}
