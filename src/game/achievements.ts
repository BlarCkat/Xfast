import type { BiomeId } from "./biomes";
import type { PowerUp } from "./powerups";
import type { CharacterId } from "./wallet";

// Achievements. Daily goals reset every day and earn a star each; weekly goals reset every Monday
// and earn three stars each; badges are long-term goals that stay once earned. Progress is kept in
// local storage alongside the wallet.

export type GoalKind = "daily" | "weekly" | "badge";

/** Stars a finished goal pays out. Badges pay nothing but stay for good. */
export const STARS_FOR: Record<GoalKind, number> = { daily: 1, weekly: 3, badge: 0 };

/**
 * What a goal counts. Counted stats add up over the day, week or all time; best-of stats
 * (boost, score, biomes) keep the best single run in that time.
 */
type Stat = keyof Counters | "picked" | "characters";

export interface Goal {
  id: string;
  kind: GoalKind;
  title: string;
  description: string;
  target: number;
  stat: Stat;
}

export const GOALS: Goal[] = [
  // Today
  { id: "hops", kind: "daily", stat: "hops", title: "Leg day", description: "Hop 300 times today.", target: 300 },
  { id: "coins", kind: "daily", stat: "coins", title: "Pocket money", description: "Collect 50 coins today.", target: 50 },
  { id: "boost", kind: "daily", stat: "boost", title: "Powered up", description: "Use 3 power-ups in one run.", target: 3 },
  { id: "warmUp", kind: "daily", stat: "runs", title: "Warm up", description: "Play 3 games today.", target: 3 },
  { id: "farHop", kind: "daily", stat: "score", title: "Far hopper", description: "Score 50 in one run today.", target: 50 },
  // This week
  { id: "hopWeek", kind: "weekly", stat: "hops", title: "Hop hop week", description: "Hop 2,000 times this week.", target: 2000 },
  { id: "piggyBank", kind: "weekly", stat: "coins", title: "Piggy bank", description: "Collect 300 coins this week.", target: 300 },
  { id: "gameTime", kind: "weekly", stat: "runs", title: "Game time", description: "Play 15 games this week.", target: 15 },
  { id: "powerWeek", kind: "weekly", stat: "powerups", title: "Power week", description: "Use 10 power-ups this week.", target: 10 },
  { id: "bigRun", kind: "weekly", stat: "score", title: "Big run", description: "Score 100 in one run this week.", target: 100 },
  // Badges
  { id: "worldTour", kind: "badge", stat: "biomes", title: "World tour", description: "Pass through 5 biomes in one run.", target: 5 },
  { id: "collector", kind: "badge", stat: "picked", title: "Collector", description: "Pick up 5 different power-ups on the road.", target: 5 },
  { id: "coinHoard", kind: "badge", stat: "coins", title: "Coin hoard", description: "Collect 1,000 coins in all.", target: 1000 },
  { id: "roadMaster", kind: "badge", stat: "score", title: "Road master", description: "Score 250 in one run.", target: 250 },
  { id: "bestFriends", kind: "badge", stat: "characters", title: "Best friends", description: "Play as 3 different characters.", target: 3 },
];

/** Ring colour for each goal: gold stars for daily, orange for weekly, a colour of its own for each badge. */
export const GOAL_COLOR: Record<string, string> = {
  daily: "#f4c542",
  weekly: "#ff9f43",
  worldTour: "#2ee6c9",
  collector: "#ff6fb1",
  coinHoard: "#7bd94a",
  roadMaster: "#ff5d5d",
  bestFriends: "#a98bff",
};

export const goalColor = (g: Goal) => (g.kind === "badge" ? GOAL_COLOR[g.id] : GOAL_COLOR[g.kind]);

/** The goal's icon: a star for daily and weekly goals, its own medal for a badge. */
export const goalIcon = (g?: Goal) => (!g || g.kind !== "badge" ? "/achievements/star.png" : `/achievements/medal-${g.id}.png`);

interface Counters {
  hops: number;
  coins: number;
  runs: number;
  powerups: number;
  /** Most power-ups used in one run. */
  boost: number;
  /** Best score in one run. */
  score: number;
  /** Most biomes passed through in one run. */
  biomes: number;
}

const BEST: (keyof Counters)[] = ["boost", "score", "biomes"];

interface State {
  /** The local date the daily counters belong to. */
  day: string;
  /** The local date of the Monday the weekly counters belong to. */
  week: string;
  daily: Counters;
  weekly: Counters;
  /** All time; badges read these. */
  total: Counters;
  doneToday: string[];
  doneThisWeek: string[];
  /** Stars earned over all time. */
  stars: number;
  badges: string[];
  /** Different power-ups picked up on the road, ever. */
  picked: PowerUp[];
  /** Characters played at least one run with. */
  characters: CharacterId[];
}

const KEY = "xfast-achievements";

const dateKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = () => dateKey(new Date());
const thisWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
};

const zero = (): Counters => ({ hops: 0, coins: 0, runs: 0, powerups: 0, boost: 0, score: 0, biomes: 0 });

const fresh = (): State => ({
  day: today(),
  week: thisWeek(),
  daily: zero(),
  weekly: zero(),
  total: zero(),
  doneToday: [],
  doneThisWeek: [],
  stars: 0,
  badges: [],
  picked: [],
  characters: [],
});

let state: State | null = null;
const listeners = new Set<() => void>();
// This run's progress; not saved.
let runBiomes = new Set<BiomeId>();
let runPowerups = 0;

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const base = fresh();
    return {
      ...base,
      ...raw,
      daily: { ...base.daily, ...raw.daily },
      weekly: { ...base.weekly, ...raw.weekly },
      // Saves from before weekly goals kept only the best World tour run.
      total: { ...base.total, ...raw.total, biomes: Math.max(raw.total?.biomes ?? 0, raw.bestBiomes ?? 0) },
    };
  } catch {
    return fresh();
  }
}

/** The saved state, with yesterday's and last week's progress cleared. */
function get(): State {
  state ??= load();
  if (state.day !== today()) state = { ...state, day: today(), daily: zero(), doneToday: [] };
  if (state.week !== thisWeek()) state = { ...state, week: thisWeek(), weekly: zero(), doneThisWeek: [] };
  return state;
}

function save(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Progress still counts for this visit.
  }
  listeners.forEach((fn) => fn());
}

/** Raise a stat in the daily, weekly and all-time counters: added, or kept as a best. */
const count = (stat: keyof Counters, n: number) => (s: State): State => {
  const bump = (c: Counters) => ({ ...c, [stat]: BEST.includes(stat) ? Math.max(c[stat], n) : c[stat] + n });
  return { ...s, daily: bump(s.daily), weekly: bump(s.weekly), total: bump(s.total) };
};

export const achievements = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  snapshot: () => get(),

  /** Progress toward a goal, from 0 up to its target. */
  progress(goal: Goal, s: State = get()) {
    const scope = goal.kind === "daily" ? s.daily : goal.kind === "weekly" ? s.weekly : s.total;
    const value = goal.stat === "picked" ? s.picked.length : goal.stat === "characters" ? s.characters.length : scope[goal.stat];
    return Math.min(goal.target, value);
  },

  earned(goal: Goal, s: State = get()) {
    const done = goal.kind === "daily" ? s.doneToday : goal.kind === "weekly" ? s.doneThisWeek : s.badges;
    return done.includes(goal.id);
  },

  startRun(biome: BiomeId, character: CharacterId) {
    runBiomes = new Set([biome]);
    runPowerups = 0;
    return update((s) => {
      const next = count("runs", 1)(s);
      return s.characters.includes(character) ? next : { ...next, characters: [...s.characters, character] };
    });
  },

  hop: () => update(count("hops", 1)),
  coins: (n: number) => update(count("coins", n)),
  scored: (score: number) => update(count("score", score)),
  usedPowerup() {
    runPowerups++;
    return update((s) => count("boost", runPowerups)(count("powerups", 1)(s)));
  },
  pickedUp: (kind: PowerUp) => update((s) => (s.picked.includes(kind) ? s : { ...s, picked: [...s.picked, kind] })),
  enteredBiome(biome: BiomeId) {
    runBiomes.add(biome);
    return update(count("biomes", runBiomes.size));
  },
};

/** Apply a change, award anything it completes, and return the goals newly earned. */
function update(change: (s: State) => State): Goal[] {
  const before = get();
  let next = change(before);
  const earned = GOALS.filter((g) => !achievements.earned(g, next) && achievements.progress(g, next) >= g.target);
  for (const g of earned) {
    next = { ...next, stars: next.stars + STARS_FOR[g.kind] };
    if (g.kind === "daily") next = { ...next, doneToday: [...next.doneToday, g.id] };
    else if (g.kind === "weekly") next = { ...next, doneThisWeek: [...next.doneThisWeek, g.id] };
    else next = { ...next, badges: [...next.badges, g.id] };
  }
  if (next !== before) save(next);
  return earned;
}
