import { achievements } from "./achievements";
import { CHARACTER_TIERS } from "./characters";
import { POWERUP_KEYS, type PowerUp } from "./powerups";
import { wallet, type CharacterId } from "./wallet";

// Reward chests. Stars from achievements fill three chests: a Basic chest for every 3 stars earned
// in a day, an Epic chest for every 21 in a week (3 a day) and a Mega chest for every 90 in a month
// (3 a day). Chests also turn up on the road now and then. Earned chests wait in the player's
// collection until they are opened on the Rewards screen; their loot is rolled when opened.

export type ChestKind = "basic" | "epic" | "mega";
export const CHEST_KINDS: ChestKind[] = ["basic", "epic", "mega"];

export interface ChestInfo {
  kind: ChestKind;
  name: string;
  /** How often the chest comes round, for the Rewards screen. */
  period: "Daily" | "Weekly" | "Monthly";
  /** Stars earned in the period for each chest. */
  stars: number;
  /** The words on the period's progress line, such as "today". */
  scope: string;
}

export const CHESTS: Record<ChestKind, ChestInfo> = {
  basic: { kind: "basic", name: "Basic chest", period: "Daily", stars: 3, scope: "today" },
  epic: { kind: "epic", name: "Epic chest", period: "Weekly", stars: 21, scope: "this week" },
  mega: { kind: "mega", name: "Mega chest", period: "Monthly", stars: 90, scope: "this month" },
};

/** A chest found on the road is one of these, by weight. */
const FOUND_WEIGHTS: [ChestKind, number][] = [
  ["basic", 0.8],
  ["epic", 0.17],
  ["mega", 0.03],
];

export function foundChest(rng: () => number): ChestKind {
  let r = rng();
  for (const [kind, w] of FOUND_WEIGHTS) {
    if (r < w) return kind;
    r -= w;
  }
  return "basic";
}

/** One line of loot from an opened chest. */
export type Loot =
  | { kind: "coins"; amount: number }
  | { kind: "gems"; amount: number }
  /** One character upgrade; every UPGRADES_PER_LEVEL of them on a character level it up for free. */
  | { kind: "upgrade"; character: CharacterId; levelUp: boolean }
  /** A whole free level for a character. */
  | { kind: "level"; character: CharacterId; level: number }
  | { kind: "powerup"; powerup: PowerUp };

interface State {
  day: string;
  week: string;
  month: string;
  /** Stars earned today, this week and this month. */
  dayStars: number;
  weekStars: number;
  monthStars: number;
  /** The achievements' all-time star count when last seen, to spot new stars. */
  seenStars: number | null;
  /** Unopened chests. */
  owned: Record<ChestKind, number>;
}

const KEY = "xfast-chests";

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = () => dateKey(new Date());
const thisWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
};
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

const fresh = (): State => ({
  day: today(),
  week: thisWeek(),
  month: thisMonth(),
  dayStars: 0,
  weekStars: 0,
  monthStars: 0,
  seenStars: null,
  owned: { basic: 0, epic: 0, mega: 0 },
});

let state: State | null = null;
const listeners = new Set<() => void>();
/** Chests earned or found since the run last asked, for its toast. */
let unannounced: ChestKind[] = [];

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const base = fresh();
    return { ...base, ...raw, owned: { ...base.owned, ...raw.owned } };
  } catch {
    return fresh();
  }
}

/** The saved state with stale periods cleared and any new stars counted toward chests. */
function get(): State {
  state ??= load();
  let s = state;
  if (s.day !== today()) s = { ...s, day: today(), dayStars: 0 };
  if (s.week !== thisWeek()) s = { ...s, week: thisWeek(), weekStars: 0 };
  if (s.month !== thisMonth()) s = { ...s, month: thisMonth(), monthStars: 0 };
  const stars = achievements.snapshot().stars;
  // Stars from before chests existed don't count; they were never part of a day here.
  if (s.seenStars === null) s = { ...s, seenStars: stars };
  else if (stars > s.seenStars) s = addStars(s, stars - s.seenStars, stars);
  // Saved quietly: this runs while React reads the snapshot, too early to tell listeners.
  if (s !== state) persist(s);
  return state!;
}

function addStars(s: State, n: number, seen: number): State {
  const owned = { ...s.owned };
  const next = { ...s, dayStars: s.dayStars + n, weekStars: s.weekStars + n, monthStars: s.monthStars + n, seenStars: seen, owned };
  const earned: [ChestKind, number, number][] = [
    ["basic", s.dayStars, next.dayStars],
    ["epic", s.weekStars, next.weekStars],
    ["mega", s.monthStars, next.monthStars],
  ];
  for (const [kind, before, after] of earned) {
    const per = CHESTS[kind].stars;
    const got = Math.floor(after / per) - Math.floor(before / per);
    for (let i = 0; i < got; i++) unannounced.push(kind);
    owned[kind] += got;
  }
  return next;
}

function persist(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The chests still work for this visit.
  }
}

function save(next: State) {
  persist(next);
  listeners.forEach((fn) => fn());
}

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const pickOne = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const shuffled = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

/** Owned characters that still have a level to climb. */
const upgradable = () => wallet.get().owned.filter((id) => wallet.tierOf(id) < CHARACTER_TIERS);

/** Roll and hand over a chest's loot. */
function roll(kind: ChestKind): Loot[] {
  const loot: Loot[] = [];
  const coins = kind === "basic" ? randInt(1, 30) : kind === "epic" ? randInt(30, 100) : randInt(100, 500);
  const gems = kind === "basic" ? randInt(1, 5) : kind === "epic" ? randInt(6, 15) : randInt(20, 50);
  wallet.addCoins(coins);
  wallet.addGems(gems);
  loot.push({ kind: "coins", amount: coins }, { kind: "gems", amount: gems });

  const chars = upgradable();
  if (kind === "basic" && chars.length && Math.random() < 0.8) {
    // "Any character": the one you play with when it can still level up, otherwise another you own.
    const selected = wallet.get().selected;
    const id = chars.includes(selected) ? selected : pickOne(chars);
    loot.push({ kind: "upgrade", character: id, levelUp: wallet.grantCharacterUpgrade(id) });
  }
  if (kind === "epic" && chars.length && Math.random() < 0.6) {
    // Two upgrades on two different characters, picked by the chest. With one character it gets both.
    const ids = shuffled(chars);
    for (const id of [ids[0], ids[1] ?? ids[0]]) {
      if (wallet.tierOf(id) >= CHARACTER_TIERS) continue;
      loot.push({ kind: "upgrade", character: id, levelUp: wallet.grantCharacterUpgrade(id) });
    }
  }
  if (kind === "mega" && chars.length && Math.random() < 0.8) {
    const selected = wallet.get().selected;
    const id = chars.includes(selected) ? selected : pickOne(chars);
    wallet.grantCharacterLevel(id);
    loot.push({ kind: "level", character: id, level: wallet.tierOf(id) });
  }
  if (kind !== "basic") {
    const n = kind === "epic" ? randInt(1, 3) : randInt(1, 5);
    for (let i = 0; i < n; i++) {
      const open = POWERUP_KEYS.filter((k) => wallet.canUpgrade(k));
      if (!open.length) break;
      const k = pickOne(open);
      wallet.grantPowerupUpgrade(k);
      loot.push({ kind: "powerup", powerup: k });
    }
  }
  return loot;
}

export const chests = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  snapshot: () => get(),

  /** Stars earned toward the next chest of a kind, and how many it takes. */
  progress(kind: ChestKind, s: State = get()) {
    const per = CHESTS[kind].stars;
    const have = kind === "basic" ? s.dayStars : kind === "epic" ? s.weekStars : s.monthStars;
    return { have: have % per, need: per, total: have };
  },

  total: (s: State = get()) => s.owned.basic + s.owned.epic + s.owned.mega,

  /** A chest picked up on the road. */
  found(kind: ChestKind) {
    const s = get();
    unannounced.push(kind);
    save({ ...s, owned: { ...s.owned, [kind]: s.owned[kind] + 1 } });
  },

  /** Chests earned or found since the last call, so the run can say so. */
  takeNew() {
    get();
    const out = unannounced;
    unannounced = [];
    return out;
  },

  /** Open one chest of a kind; null when there is none. */
  open(kind: ChestKind): Loot[] | null {
    const s = get();
    if (s.owned[kind] <= 0) return null;
    save({ ...s, owned: { ...s.owned, [kind]: s.owned[kind] - 1 } });
    return roll(kind);
  },
};

// New stars count toward chests the moment they are earned, wherever the player is.
if (typeof window !== "undefined") {
  achievements.subscribe(() => {
    const before = state;
    get();
    if (state !== before) listeners.forEach((fn) => fn());
  });
}
