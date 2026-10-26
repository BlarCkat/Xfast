import type { BiomeId } from "./biomes";
import type { PowerUp } from "./powerups";

// Achievements. Daily milestones reset every day and earn a star each; badges are long-term goals
// that stay once earned. Progress is kept in local storage alongside the wallet.

export type GoalKind = "daily" | "badge";

export interface Goal {
  id: GoalId;
  kind: GoalKind;
  title: string;
  description: string;
  target: number;
}

export type GoalId = "hops" | "coins" | "boost" | "worldTour" | "collector";

export const GOALS: Goal[] = [
  { id: "hops", kind: "daily", title: "Leg day", description: "Hop 300 times today.", target: 300 },
  { id: "coins", kind: "daily", title: "Pocket money", description: "Collect 50 coins today.", target: 50 },
  { id: "boost", kind: "daily", title: "Powered up", description: "Use 3 power-ups in one run.", target: 3 },
  { id: "worldTour", kind: "badge", title: "World tour", description: "Pass through 5 biomes in one run.", target: 5 },
  { id: "collector", kind: "badge", title: "Collector", description: "Pick up 5 different power-ups on the road.", target: 5 },
];

interface State {
  /** The local date the daily counters belong to. */
  day: string;
  daily: { hops: number; coins: number; boost: number };
  /** Daily goals finished today. */
  doneToday: GoalId[];
  /** Stars earned over all time, one per finished daily goal. */
  stars: number;
  badges: GoalId[];
  /** Best single run toward World tour. */
  bestBiomes: number;
  /** Different power-ups picked up on the road, ever. */
  picked: PowerUp[];
}

const KEY = "xfast-achievements";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const fresh = (): State => ({
  day: today(),
  daily: { hops: 0, coins: 0, boost: 0 },
  doneToday: [],
  stars: 0,
  badges: [],
  bestBiomes: 0,
  picked: [],
});

let state: State | null = null;
const listeners = new Set<() => void>();
// This run's progress; not saved.
let runBiomes = new Set<BiomeId>();
let runPowerups = 0;

function load(): State {
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return fresh();
  }
}

/** The saved state, with yesterday's daily progress cleared. */
function get(): State {
  state ??= load();
  if (state.day !== today()) state = { ...state, day: today(), daily: fresh().daily, doneToday: [] };
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

export const achievements = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  snapshot: () => get(),

  /** Progress toward a goal, from 0 up to its target. */
  progress(goal: Goal, s: State = get()) {
    const value =
      goal.id === "worldTour" ? s.bestBiomes : goal.id === "collector" ? s.picked.length : s.daily[goal.id as keyof State["daily"]];
    return Math.min(goal.target, value);
  },

  earned(goal: Goal, s: State = get()) {
    return goal.kind === "daily" ? s.doneToday.includes(goal.id) : s.badges.includes(goal.id);
  },

  startRun(biome: BiomeId) {
    runBiomes = new Set([biome]);
    runPowerups = 0;
  },

  hop: () => update((s) => ({ ...s, daily: { ...s.daily, hops: s.daily.hops + 1 } })),
  coins: (n: number) => update((s) => ({ ...s, daily: { ...s.daily, coins: s.daily.coins + n } })),
  usedPowerup() {
    runPowerups++;
    return update((s) => ({ ...s, daily: { ...s.daily, boost: Math.max(s.daily.boost, runPowerups) } }));
  },
  pickedUp: (kind: PowerUp) => update((s) => (s.picked.includes(kind) ? s : { ...s, picked: [...s.picked, kind] })),
  enteredBiome(biome: BiomeId) {
    runBiomes.add(biome);
    return update((s) => ({ ...s, bestBiomes: Math.max(s.bestBiomes, runBiomes.size) }));
  },
};

/** Apply a change, award anything it completes, and return the goals newly earned. */
function update(change: (s: State) => State): Goal[] {
  const before = get();
  let next = change(before);
  const earned = GOALS.filter((g) => !achievements.earned(g, next) && achievements.progress(g, next) >= g.target);
  for (const g of earned) {
    next =
      g.kind === "daily"
        ? { ...next, doneToday: [...next.doneToday, g.id], stars: next.stars + 1 }
        : { ...next, badges: [...next.badges, g.id] };
  }
  // Hops and coins change constantly; only write when something else changed too or every so often.
  if (next !== before) save(next);
  return earned;
}
