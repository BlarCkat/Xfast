import { CHARACTER_TIERS, CHARACTER_TIER_COST } from "./characters";
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
    name: "Mario",
    price: 400,
    trait: "Super Mushroom: the first car or train hit shrinks him instead of costing a life, and he grows back in each new biome. Every 100 coins is a 1-UP.",
  },
  {
    id: "luigi",
    name: "Luigi",
    price: 450,
    trait: "Poltergust: sucks up coins within 2 tiles. Ghost hunter: nothing can hit him in the Spooky biome.",
  },
  {
    id: "bowser",
    name: "Bowser",
    price: 500,
    trait: "Smashes through trees and rocks in his way, and breathes fire every 50 hops to wreck the traffic ahead.",
  },
  { id: "human", name: "Human", price: 550, trait: "Picks up every coin twice: coins are always doubled." },
  { id: "leopard", name: "Leopard", price: 600, trait: "Pounces every 50 hops, leaping ahead to safe grass like a Warp." },
  { id: "owl", name: "Owl", price: 650, trait: "Takes flight every 50 hops: Wings carry it over rivers for a moment." },
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
  /** Each character's tier, 1 to CHARACTER_TIERS (see characters.ts). */
  charTiers: Partial<Record<CharacterId, number>>;
  /** Character upgrades from chests toward each character's next free tier (see UPGRADES_PER_LEVEL). */
  charUpgrades: Partial<Record<CharacterId, number>>;
}

/** Chest upgrades a character collects to step up a tier for free. */
export const UPGRADES_PER_LEVEL = 3;

const KEY = "xfast-wallet";

const fresh = (): WalletState => ({
  coins: 0,
  gems: 0,
  owned: ["chicken"],
  selected: "chicken",
  inventory: { life: 0, ...noEffects() },
  upgrades: Object.fromEntries(POWERUPS.map((p) => [p.key, 0])) as Record<PowerUp, number>,
  charTiers: {},
  charUpgrades: {},
});

/** Older saves kept a level from 1 to 5; each level above 1 becomes one filled tier-1 box. */
function fromLevels(levels?: Record<PowerUp, number>) {
  if (!levels) return {};
  return Object.fromEntries(Object.entries(levels).map(([k, l]) => [k, Math.max(0, Math.min(MAX_UPGRADES, (Number(l) || 1) - 1))]));
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as Partial<WalletState> & { levels?: Record<PowerUp, number> };
    const base = fresh();
    return {
      coins: Math.max(0, Number(saved.coins) || 0),
      gems: Math.max(0, Number(saved.gems) || 0),
      owned: Array.isArray(saved.owned) ? Array.from(new Set(["chicken", ...saved.owned])) as CharacterId[] : base.owned,
      selected: saved.selected && saved.owned?.includes(saved.selected) ? saved.selected : "chicken",
      inventory: { ...base.inventory, ...saved.inventory },
      upgrades: { ...base.upgrades, ...(saved.upgrades ?? fromLevels(saved.levels)) },
      charTiers: { ...saved.charTiers },
      charUpgrades: { ...saved.charUpgrades },
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
    if (!next || s.coins < next.cost) return false;
    this.set({ ...s, coins: s.coins - next.cost, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } });
    return true;
  }

  /** A character's tier, 1 to CHARACTER_TIERS. */
  tierOf(id: CharacterId) {
    return Math.max(1, Math.min(CHARACTER_TIERS, this.get().charTiers[id] ?? 1));
  }

  /** Step an owned character up a tier, strengthening its trait. */
  upgradeCharacter(id: CharacterId) {
    const s = this.get();
    const tier = this.tierOf(id);
    const cost = CHARACTER_TIER_COST[tier];
    if (!s.owned.includes(id) || tier >= CHARACTER_TIERS || s.coins < cost) return false;
    this.set({ ...s, coins: s.coins - cost, charTiers: { ...s.charTiers, [id]: tier + 1 } });
    return true;
  }

  /** Chest upgrades a character has toward its next tier. */
  upgradesOf(id: CharacterId) {
    return this.get().charUpgrades[id] ?? 0;
  }

  /**
   * A character upgrade from a chest. Every UPGRADES_PER_LEVEL of them step the character up a
   * tier for free; returns true when this one did.
   */
  grantCharacterUpgrade(id: CharacterId) {
    const s = this.get();
    const tier = this.tierOf(id);
    if (tier >= CHARACTER_TIERS) return false;
    const have = (s.charUpgrades[id] ?? 0) + 1;
    const levelUp = have >= UPGRADES_PER_LEVEL;
    this.set({
      ...s,
      charUpgrades: { ...s.charUpgrades, [id]: levelUp ? 0 : have },
      charTiers: levelUp ? { ...s.charTiers, [id]: tier + 1 } : s.charTiers,
    });
    return levelUp;
  }

  /** A whole free tier for a character, from a chest. */
  grantCharacterLevel(id: CharacterId) {
    const s = this.get();
    const tier = this.tierOf(id);
    if (tier >= CHARACTER_TIERS) return false;
    this.set({ ...s, charTiers: { ...s.charTiers, [id]: tier + 1 }, charUpgrades: { ...s.charUpgrades, [id]: 0 } });
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
