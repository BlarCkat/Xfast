import {
  BOWSER_FIRE_HOPS,
  BOWSER_FIRE_ROWS,
  CAT_REFILL_HOPS,
  CHICKEN_POWERUP_BONUS,
  LEAP_TRAIT_HOPS,
  MAGNET_RADIUS,
  MARIO_COINS_PER_LIFE,
  TIME_TRAIT_HOPS,
} from "./config";
import type { CharacterId } from "./wallet";

// Character upgrades. Every character climbs five tiers; each tier strengthens its own trait, and
// nothing else. Tier 1 is the character as bought.

export const CHARACTER_TIERS = 5;
/** Coins to step up into tiers 2 to 5. */
export const CHARACTER_TIER_COST = [0, 150, 300, 500, 800];

/** The numbers behind every trait. A character only uses its own; the rest stay at tier 1. */
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
};

/** Each character's trait values from tier 1 to tier 5. */
const LADDER: { [K in CharacterId]: Partial<{ [T in keyof Traits]: number[] }> } = {
  chicken: { powerupBonus: [1.5, 1.6, 1.75, 1.9, 2] },
  duck: { duckStart: [0, 1, 2, 3, 4] },
  frog: { frogCoin: [0, 0.25, 0.5, 0.75, 1] },
  penguin: { penguinShield: [1, 1.5, 2, 2.5, 3] },
  cat: { catRefillHops: [20, 17, 14, 12, 10] },
  robot: { robotCoinHops: [0, 50, 40, 30, 20] },
  sparrow: { timeTraitHops: [100, 85, 70, 60, 50] },
  snail: { timeTraitHops: [100, 85, 70, 60, 50] },
  mario: { marioCoinsPerLife: [100, 90, 80, 70, 60] },
  luigi: { luigiRadius: [2, 2.5, 3, 3.5, 4] },
  bowser: { bowserFireHops: [50, 45, 40, 35, 30], bowserFireRows: [4, 5, 5, 6, 7] },
  human: { humanTriple: [0, 0.1, 0.2, 0.3, 0.4] },
  leopard: { leapHops: [50, 45, 40, 35, 30] },
  owl: { leapHops: [50, 45, 40, 35, 30] },
};

const clampTier = (tier: number) => Math.max(1, Math.min(CHARACTER_TIERS, Math.round(tier) || 1));

export function traitsAt(id: CharacterId, tier: number): Traits {
  const t = clampTier(tier) - 1;
  const out = { ...BASE };
  for (const [key, values] of Object.entries(LADDER[id]) as [keyof Traits, number[]][]) out[key] = values[t];
  return out;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The character's trait as it plays at this tier, for the store card. */
export function traitText(id: CharacterId, tier: number): string {
  const t = traitsAt(id, tier);
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
      return t.penguinShield > 1 ? `Starts every run with a shield that lasts ${t.penguinShield}× as long.` : "Starts every run with a shield.";
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
      return `Poltergust: sucks up coins within ${t.luigiRadius} tiles. Ghost hunter: nothing can hit him in the Spooky biome.`;
    case "bowser":
      return `Smashes through trees and rocks, and breathes fire every ${t.bowserFireHops} hops to wreck ${t.bowserFireRows} rows of traffic ahead.`;
    case "human":
      return `Picks up every coin twice: coins are always doubled.${t.humanTriple ? ` ${pct(t.humanTriple)} of coins come in triple.` : ""}`;
    case "leopard":
      return `Pounces every ${t.leapHops} hops, leaping ahead to safe grass like a Warp.`;
    case "owl":
      return `Takes flight every ${t.leapHops} hops: Wings carry it over rivers for a moment.`;
  }
}

/** What the next tier improves, in a few words, for the store card. */
export function nextPerk(id: CharacterId, tier: number): string | null {
  if (tier >= CHARACTER_TIERS) return null;
  const now = traitsAt(id, tier);
  const next = traitsAt(id, tier + 1);
  switch (id) {
    case "chicken":
      return `power-ups +${pct(next.powerupBonus - 1)}`;
    case "duck":
      return `${next.duckStart} saved at start`;
    case "frog":
      return `coin on ${pct(next.frogCoin)} of logs`;
    case "penguin":
      return `${next.penguinShield}× starting shield`;
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
      return `${next.luigiRadius}-tile Poltergust`;
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
  }
}
