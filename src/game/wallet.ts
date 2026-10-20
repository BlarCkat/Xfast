import { MAX_LEVEL, POWERUPS, noEffects, upgradeCost, type PowerUp } from "./powerups";

export type CharacterId = "chicken" | "duck" | "frog" | "cat" | "penguin" | "robot" | "sparrow" | "snail" | "mario" | "luigi" | "bowser";
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
  owned: CharacterId[];
  selected: CharacterId;
  inventory: Record<StoreItemId, number>;
  /** Upgrade level of each power-up, 1 to MAX_LEVEL. */
  levels: Record<PowerUp, number>;
  /** Total coins bought with real money that have already been added to `coins`. */
  bought: number;
}

const KEY = "xfast-wallet";

export const fresh = (): WalletState => ({
  coins: 0,
  owned: ["chicken"],
  selected: "chicken",
  inventory: { life: 0, ...noEffects() },
  levels: Object.fromEntries(POWERUPS.map((p) => [p.key, 1])) as Record<PowerUp, number>,
  bought: 0,
});

/** Fill in anything missing from a saved wallet, whether it came from this browser or the cloud. */
export function normalize(saved: Partial<WalletState> | null | undefined): WalletState {
  const base = fresh();
  if (!saved) return base;
  return {
    coins: Math.max(0, Number(saved.coins) || 0),
    owned: Array.isArray(saved.owned) ? Array.from(new Set(["chicken", ...saved.owned])) as CharacterId[] : base.owned,
    selected: saved.selected && saved.owned?.includes(saved.selected) ? saved.selected : "chicken",
    inventory: { ...base.inventory, ...saved.inventory },
    levels: { ...base.levels, ...saved.levels },
    bought: Math.max(0, Number(saved.bought) || 0),
  };
}

/** Combine guest progress with a cloud save so signing in never loses either. */
export function merge(a: WalletState, b: WalletState): WalletState {
  const max = <K extends string>(x: Record<K, number>, y: Record<K, number>) =>
    Object.fromEntries(Object.keys({ ...x, ...y }).map((k) => [k, Math.max(x[k as K] ?? 0, y[k as K] ?? 0)])) as Record<K, number>;
  return {
    coins: Math.max(a.coins, b.coins),
    owned: Array.from(new Set([...a.owned, ...b.owned])),
    selected: b.selected,
    inventory: max(a.inventory, b.inventory),
    levels: max(a.levels, b.levels),
    bought: Math.max(a.bought, b.bought),
  };
}

function load(): WalletState {
  try {
    const raw = localStorage.getItem(KEY);
    return normalize(raw ? (JSON.parse(raw) as Partial<WalletState>) : null);
  } catch {
    return fresh();
  }
}

/**
 * Coins, unlocked characters and bought power-ups. Kept in the browser's
 * local storage so they survive between runs and visits; when the player is
 * signed in, `cloud` also mirrors it to Firestore.
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

  /** Swap in a whole wallet, e.g. one loaded from the cloud. */
  replace(next: WalletState) {
    this.set(normalize(next));
  }

  /**
   * Add coins bought with real money. `total` is every coin the server has
   * recorded for this account, so crediting is idempotent. Returns how many were new.
   */
  credit(total: number) {
    const s = this.get();
    const n = total - s.bought;
    if (n <= 0) return 0;
    this.set({ ...s, coins: s.coins + n, bought: total });
    return n;
  }

  addCoins(n: number) {
    const s = this.get();
    this.set({ ...s, coins: s.coins + n });
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
    const level = s.levels[id];
    const cost = upgradeCost(id, level);
    if (level >= MAX_LEVEL || s.coins < cost) return false;
    this.set({ ...s, coins: s.coins - cost, levels: { ...s.levels, [id]: level + 1 } });
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
