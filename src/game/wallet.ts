import { CHARACTER_LEVELS, MAX_CHARACTER_STEPS, characterLevelOf, nextCharacterStep, stepsAtLevel } from "./characters";
import { MAX_UPGRADES, POWERUPS, nextUpgrade, noEffects, type PowerUp } from "./powerups";

export type CharacterId = "chicken" | "duck" | "frog" | "cat" | "penguin" | "robot" | "sparrow" | "snail" | "mario" | "luigi" | "bowser" | "human" | "leopard" | "owl" | "tiger";
export type StoreItemId = PowerUp | "life";

export interface Character {
  id: CharacterId;
  name: string;
  price: number;
  /** What this character does differently, shown in the store. */
  trait: string;
}

export const CHARACTERS: Character[] = [
  { id: "chicken", name: "Chicken", price: 0, trait: "Power-ups last 50% longer." },
  { id: "duck", name: "Duck", price: 50, trait: "Saves power-ups it picks up to use whenever you like that run. Falling in water dives to the seabed, past sharks, fish and octopi, until it surfaces in the next river." },
  { id: "frog", name: "Frog", price: 100, trait: "Never drowns: always lands on the nearest log ahead." },
  { id: "penguin", name: "Penguin", price: 150, trait: "Starts every run with a shield." },
  { id: "cat", name: "Cat", price: 200, trait: "Nine lives, and regrows lost ones: half a life every 20 hops, twice as slow after each life spent." },
  { id: "robot", name: "Robot", price: 250, trait: "Foresight is always on." },
  { id: "sparrow", name: "Sparrow", price: 300, trait: "Stops time for a moment every 100 hops." },
  { id: "snail", name: "Snail", price: 350, trait: "Slows time for a moment every 100 hops." },
  {
    id: "mario",
    name: "Red Plumber",
    price: 400,
    trait: "Super Mushroom: the first car or train hit shrinks him instead of costing a life, and he grows back in each new biome. Every 100 coins is a 1-UP.",
  },
  {
    id: "luigi",
    name: "Green Plumber",
    price: 450,
    trait: "Poltergust: sucks up coins within 2 tiles. Ghost hunter: nothing can hit him in the Spooky biome.",
  },
  {
    id: "bowser",
    name: "Giant Turtle",
    price: 500,
    trait: "Smashes through trees and rocks in his way, and breathes fire every 50 hops to wreck the traffic ahead.",
  },
  { id: "human", name: "Human", price: 550, trait: "Picks up every coin twice: coins are always doubled." },
  { id: "leopard", name: "Leopard", price: 600, trait: "Pounces every 50 hops, leaping ahead to safe grass like a Warp." },
  { id: "owl", name: "Owl", price: 650, trait: "Takes flight every 50 hops: Wings carry it over everything to safe grass." },
  { id: "tiger", name: "Tiger", price: 700, trait: "Roars every 60 hops, putting up a shield that soaks up the next hit." },
];

export interface StoreItem {
  id: StoreItemId;
  name: string;
  price: number;
  description: string;
}

export const STORE_ITEMS: StoreItem[] = [
  { id: "life", name: "Extra life", price: 60, description: "Start your next run with one more life." },
  ...POWERUPS.map((p) => ({
    id: p.key,
    name: p.label.charAt(0) + p.label.slice(1).toLowerCase(),
    price: p.price,
    description: p.description,
  })),
];

export interface WalletState {
  coins: number;
  /** The premium currency; bought in the store once payments are in. */
  gems: number;
  owned: CharacterId[];
  selected: CharacterId;
  inventory: Record<StoreItemId, number>;
  /** Upgrade steps taken on each power-up, 0 to MAX_UPGRADES (see tierOf). */
  upgrades: Record<PowerUp, number>;
  /** Upgrade steps taken on each character, 0 to MAX_CHARACTER_STEPS (see characterLevelOf). */
  charSteps: Partial<Record<CharacterId, number>>;
}

const KEY = "xfast-wallet";

const fresh = (): WalletState => ({
  coins: 0,
  gems: 0,
  owned: ["chicken"],
  selected: "chicken",
  inventory: { life: 0, ...noEffects() },
  upgrades: Object.fromEntries(POWERUPS.map((p) => [p.key, 0])) as Record<PowerUp, number>,
  charSteps: {},
});

/**
 * Older saves kept a tier from 1 to 5 plus chest upgrades toward the next one. Each tier becomes the
 * same strength on the nine-level path, and each chest upgrade one more step.
 */
function fromTiers(tiers?: Partial<Record<CharacterId, number>>, partial?: Partial<Record<CharacterId, number>>) {
  const out: Partial<Record<CharacterId, number>> = {};
  for (const id of new Set([...Object.keys(tiers ?? {}), ...Object.keys(partial ?? {})]) as Set<CharacterId>) {
    const tier = Math.max(1, Math.min(5, Number(tiers?.[id]) || 1));
    const steps = Math.round(((tier - 1) / 4) * MAX_CHARACTER_STEPS) + (tier < 5 ? Math.max(0, Number(partial?.[id]) || 0) : 0);
    out[id] = Math.min(MAX_CHARACTER_STEPS, steps);
  }
  return out;
}

/** Older saves kept a level from 1 to 5; each level above 1 becomes one filled tier-1 box. */
function fromLevels(levels?: Record<PowerUp, number>) {
  if (!levels) return {};
  return Object.fromEntries(Object.entries(levels).map(([k, l]) => [k, Math.max(0, Math.min(MAX_UPGRADES, (Number(l) || 1) - 1))]));
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as Partial<WalletState> & {
      levels?: Record<PowerUp, number>;
      charTiers?: Partial<Record<CharacterId, number>>;
      charUpgrades?: Partial<Record<CharacterId, number>>;
    };
    const base = fresh();
    return {
      coins: Math.max(0, Number(saved.coins) || 0),
      gems: Math.max(0, Number(saved.gems) || 0),
      owned: Array.isArray(saved.owned) ? Array.from(new Set(["chicken", ...saved.owned])) as CharacterId[] : base.owned,
      selected: saved.selected && saved.owned?.includes(saved.selected) ? saved.selected : "chicken",
      inventory: { ...base.inventory, ...saved.inventory },
      upgrades: { ...base.upgrades, ...(saved.upgrades ?? fromLevels(saved.levels)) },
      charSteps: { ...(saved.charSteps ?? fromTiers(saved.charTiers, saved.charUpgrades)) },
    };
  } catch {
    return fresh();
  }
}

/**
 * Coins, unlocked characters and bought power-ups. Kept in the browser's
 * local storage so they survive between runs and visits.
 */
class Wallet {
  private state: WalletState | null = null;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = (): WalletState => (this.state ??= load());

  private set(next: WalletState) {
    this.state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Without storage the wallet still works for this visit.
    }
    this.listeners.forEach((fn) => fn());
  }

  addCoins(n: number) {
    const s = this.get();
    this.set({ ...s, coins: s.coins + n });
  }

  addGems(n: number) {
    const s = this.get();
    this.set({ ...s, gems: s.gems + n });
  }

  buyCharacter(id: CharacterId) {
    const s = this.get();
    const c = CHARACTERS.find((c) => c.id === id)!;
    if (s.owned.includes(id) || s.coins < c.price) return false;
    this.set({ ...s, coins: s.coins - c.price, owned: [...s.owned, id], selected: id });
    return true;
  }

  select(id: CharacterId) {
    const s = this.get();
    if (s.owned.includes(id)) this.set({ ...s, selected: id });
  }

  buyItem(id: StoreItemId) {
    const s = this.get();
    const item = STORE_ITEMS.find((i) => i.id === id)!;
    if (s.coins < item.price) return false;
    this.set({ ...s, coins: s.coins - item.price, inventory: { ...s.inventory, [id]: s.inventory[id] + 1 } });
    return true;
  }

  upgrade(id: PowerUp) {
    const s = this.get();
    const next = nextUpgrade(s.upgrades[id]);
    if (!next || s.gems < next.cost) return false;
    this.set({ ...s, gems: s.gems - next.cost, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } });
    return true;
  }

  /** Upgrade steps a character has taken, 0 to MAX_CHARACTER_STEPS. */
  stepsOf(id: CharacterId) {
    return Math.max(0, Math.min(MAX_CHARACTER_STEPS, this.get().charSteps[id] ?? 0));
  }

  /** A character's level (1 to 9) and how many of that level's boxes are filled. */
  levelOf(id: CharacterId) {
    return characterLevelOf(this.stepsOf(id));
  }

  canUpgradeCharacter(id: CharacterId) {
    return this.stepsOf(id) < MAX_CHARACTER_STEPS;
  }

  private setSteps(id: CharacterId, steps: number, gems = this.get().gems) {
    const s = this.get();
    this.set({ ...s, gems, charSteps: { ...s.charSteps, [id]: Math.min(MAX_CHARACTER_STEPS, steps) } });
  }

  /** Buy an owned character's next step: fill the next box, or step up a level once all are full. */
  upgradeCharacter(id: CharacterId) {
    const s = this.get();
    const next = nextCharacterStep(this.stepsOf(id));
    if (!s.owned.includes(id) || !next || s.gems < next.cost) return false;
    this.setSteps(id, this.stepsOf(id) + 1, s.gems - next.cost);
    return true;
  }

  /**
   * A free step for a character, from a chest: the next box, or the level-up when the boxes are all
   * full. Returns true when it was a level-up.
   */
  grantCharacterUpgrade(id: CharacterId) {
    const next = nextCharacterStep(this.stepsOf(id));
    if (!next) return false;
    this.setSteps(id, this.stepsOf(id) + 1);
    return next.kind === "level";
  }

  /**
   * A whole free level for a character, from a Mega or holiday chest: the rest of this level's boxes
   * fill and the character steps up to the next level. On the last level it fills the remaining boxes.
   */
  grantCharacterLevel(id: CharacterId) {
    if (!this.canUpgradeCharacter(id)) return false;
    const { level } = this.levelOf(id);
    this.setSteps(id, level < CHARACTER_LEVELS ? stepsAtLevel(level + 1) : MAX_CHARACTER_STEPS);
    return true;
  }

  canUpgrade(id: PowerUp) {
    return this.get().upgrades[id] < MAX_UPGRADES;
  }

  /** A free upgrade step on a power-up, from a chest. */
  grantPowerupUpgrade(id: PowerUp) {
    const s = this.get();
    if (!this.canUpgrade(id)) return false;
    this.set({ ...s, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } });
    return true;
  }

  /** Spend one owned item; returns false when none are left. */
  use(id: StoreItemId) {
    const s = this.get();
    if (s.inventory[id] <= 0) return false;
    this.set({ ...s, inventory: { ...s.inventory, [id]: s.inventory[id] - 1 } });
    return true;
  }

  /** Spend every bought extra life at the start of a run. */
  takeLives() {
    const n = this.get().inventory.life;
    if (n > 0) this.set({ ...this.get(), inventory: { ...this.get().inventory, life: 0 } });
    return n;
  }
}

export const wallet = new Wallet();
