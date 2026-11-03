import type { BiomeId } from "./biomes";
import type { LaneType } from "./lanes";
import type { PowerUp } from "./powerups";
import { CHARACTERS, type CharacterId } from "./wallet";

// Achievements. Each day ten goals are drawn at random from a pool of daily goals, each at one of
// its targets, and earn a star each; each Monday seven harder weekly goals are drawn the same way
// and earn three stars each. Monthly goals are fixed and earn ten stars each. Badges are long-term
// goals that stay once earned. Progress is kept in local storage alongside the wallet.

export type GoalKind = "daily" | "weekly" | "monthly" | "badge";

/** Stars a finished goal pays out. Badges pay nothing but stay for good. */
export const STARS_FOR: Record<GoalKind, number> = { daily: 1, weekly: 3, monthly: 10, badge: 0 };

/** How many goals are drawn for each day and each week. */
const DRAWN: Partial<Record<GoalKind, number>> = { daily: 10, weekly: 7 };

interface Counters {
  hops: number;
  coins: number;
  runs: number;
  /** Power-ups used, from the store or picked up on the road. */
  powerups: number;
  /** Power-ups picked up on the road. */
  pickups: number;
  /** Logs hopped onto. */
  logs: number;
  /** Chests found on the road. */
  chests: number;
  /** Stars earned from other goals. */
  stars: number;
  /** Days with at least one run. */
  days: number;
  /** Every run's score added up. */
  scoreSum: number;
  roads: number;
  rivers: number;
  rails: number;
  /** Days this month with at least 5 runs. */
  busyDays: number;
  /** Days this month with at least 5 stars earned. */
  starDays: number;
  // Best single run.
  boost: number;
  score: number;
  biomes: number;
  runCoins: number;
  runHops: number;
  runRoads: number;
  runRivers: number;
}

const BEST: (keyof Counters)[] = ["boost", "score", "biomes", "runCoins", "runHops", "runRoads", "runRivers"];

/**
 * What a goal counts. Counted stats add up over the day, week, month or all time; best-of stats
 * keep the best single run in that time. `picked` and `characters` count kinds ever seen, and
 * `played` counts runs with the goal's character.
 */
type Stat = keyof Counters | "picked" | "characters" | "played";

export interface Goal {
  id: string;
  kind: GoalKind;
  title: string;
  description: string;
  target: number;
  stat: Stat;
  /** The character a Hopper badge counts runs with. */
  character?: CharacterId;
  /** The medal picture's name, when it isn't the goal's id. */
  medal?: string;
}

/** A daily or weekly goal before it is drawn: one of `targets` is picked for the day or week. */
interface Template {
  id: string;
  stat: keyof Counters;
  title: string;
  targets: number[];
  text: (n: string, one: boolean) => string;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const s = (one: boolean) => (one ? "" : "s");

const DAILY: Template[] = [
  { id: "legDay", stat: "hops", title: "Leg Day", targets: [1000], text: (n) => `Hop ${n} times today.` },
  { id: "hopAlong", stat: "hops", title: "Hop along", targets: [200, 300, 500], text: (n) => `Hop ${n} times today.` },
  { id: "pocketMoney", stat: "coins", title: "Pocket Money", targets: [50, 100, 500], text: (n) => `Collect ${n} coins today.` },
  { id: "warmUp", stat: "runs", title: "Just a Warm Up", targets: [5, 10, 20], text: (n) => `Run ${n} times today.` },
  { id: "gameOn", stat: "runs", title: "Game on", targets: [3, 10], text: (n) => `Play ${n} games today.` },
  { id: "farHop", stat: "score", title: "Far hopper", targets: [50, 75, 100], text: (n) => `Score ${n} in one run today.` },
  { id: "longHaul", stat: "score", title: "Long haul", targets: [150, 200], text: (n) => `Score ${n} in one run today.` },
  { id: "boost", stat: "boost", title: "Powered up", targets: [2, 3, 4], text: (n) => `Use ${n} power-ups in one run today.` },
  { id: "boosted", stat: "powerups", title: "Boosted", targets: [3, 5, 8], text: (n) => `Use ${n} power-ups today.` },
  { id: "scenic", stat: "biomes", title: "Scenic route", targets: [2, 3], text: (n) => `Pass through ${n} biomes in one run today.` },
  { id: "deepPockets", stat: "runCoins", title: "Deep pockets", targets: [20, 30, 50], text: (n) => `Collect ${n} coins in one run today.` },
  { id: "mileage", stat: "scoreSum", title: "Mileage", targets: [200, 300, 500], text: (n) => `Score a total of ${n} today.` },
  { id: "treasure", stat: "chests", title: "Treasure hunter", targets: [1, 2], text: (n, one) => `Find ${n} chest${s(one)} on the road today.` },
  { id: "logRoller", stat: "logs", title: "Log roller", targets: [10, 20, 40], text: (n) => `Hop onto ${n} logs today.` },
  { id: "grabBag", stat: "pickups", title: "Grab bag", targets: [2, 4, 6], text: (n) => `Pick up ${n} power-ups on the road today.` },
  { id: "marathon", stat: "runHops", title: "Marathon", targets: [100, 150, 200], text: (n) => `Hop ${n} times in one run today.` },
  { id: "starStruck", stat: "stars", title: "Star struck", targets: [3, 5], text: (n) => `Earn ${n} stars today.` },
  { id: "roadRunner", stat: "roads", title: "Road runner", targets: [20, 40, 60], text: (n) => `Cross ${n} roads today.` },
  { id: "riverRat", stat: "rivers", title: "River rat", targets: [10, 20, 30], text: (n) => `Cross ${n} rivers today.` },
  { id: "allAboard", stat: "rails", title: "All aboard", targets: [5, 10, 15], text: (n) => `Cross ${n} train tracks today.` },
  { id: "dodger", stat: "runRoads", title: "Traffic dodger", targets: [15, 25], text: (n) => `Cross ${n} roads in one run today.` },
  { id: "rapids", stat: "runRivers", title: "Rapids run", targets: [8, 12], text: (n) => `Cross ${n} rivers in one run today.` },
];

const WEEKLY: Template[] = [
  { id: "hopWeek", stat: "hops", title: "Hop hop week", targets: [3000, 5000, 8000], text: (n) => `Hop ${n} times this week.` },
  { id: "piggyBank", stat: "coins", title: "Piggy bank", targets: [500, 1000, 2000], text: (n) => `Collect ${n} coins this week.` },
  { id: "gameTime", stat: "runs", title: "Game time", targets: [25, 40, 60], text: (n) => `Play ${n} games this week.` },
  { id: "powerWeek", stat: "powerups", title: "Power week", targets: [15, 25, 40], text: (n) => `Use ${n} power-ups this week.` },
  { id: "bigRun", stat: "score", title: "Big run", targets: [150, 200, 300], text: (n) => `Score ${n} in one run this week.` },
  { id: "epicRun", stat: "score", title: "Epic run", targets: [400, 500], text: (n) => `Score ${n} in one run this week.` },
  { id: "roadTrip", stat: "scoreSum", title: "Road trip", targets: [2000, 3000, 5000], text: (n) => `Score a total of ${n} this week.` },
  { id: "xMarks", stat: "chests", title: "X marks the spot", targets: [3, 5, 8], text: (n) => `Find ${n} chests on the road this week.` },
  { id: "lumberYard", stat: "logs", title: "Lumber yard", targets: [100, 200, 300], text: (n) => `Hop onto ${n} logs this week.` },
  { id: "finders", stat: "pickups", title: "Finders keepers", targets: [15, 25, 40], text: (n) => `Pick up ${n} power-ups on the road this week.` },
  { id: "ultra", stat: "runHops", title: "Ultra marathon", targets: [250, 350, 500], text: (n) => `Hop ${n} times in one run this week.` },
  { id: "explorer", stat: "biomes", title: "Explorer", targets: [4, 5, 6], text: (n) => `Pass through ${n} biomes in one run this week.` },
  { id: "jackpot", stat: "runCoins", title: "Jackpot", targets: [75, 100, 150], text: (n) => `Collect ${n} coins in one run this week.` },
  { id: "supercharged", stat: "boost", title: "Supercharged", targets: [5, 6, 8], text: (n) => `Use ${n} power-ups in one run this week.` },
  { id: "starryWeek", stat: "stars", title: "Starry week", targets: [15, 25, 35], text: (n) => `Earn ${n} stars this week.` },
  { id: "regular", stat: "days", title: "Regular", targets: [3, 5, 7], text: (n) => `Play on ${n} different days this week.` },
  { id: "freeway", stat: "roads", title: "Freeway", targets: [200, 300, 500], text: (n) => `Cross ${n} roads this week.` },
  { id: "ferryman", stat: "rivers", title: "Ferryman", targets: [100, 150, 250], text: (n) => `Cross ${n} rivers this week.` },
  { id: "conductor", stat: "rails", title: "Conductor", targets: [50, 80, 120], text: (n) => `Cross ${n} train tracks this week.` },
  { id: "rushHour", stat: "runRoads", title: "Rush hour", targets: [40, 60], text: (n) => `Cross ${n} roads in one run this week.` },
  { id: "whitewater", stat: "runRivers", title: "Whitewater", targets: [20, 30], text: (n) => `Cross ${n} rivers in one run this week.` },
  { id: "hopWeekRun", stat: "runs", title: "Frequent hopper", targets: [80, 100], text: (n) => `Run ${n} times this week.` },
];

/** Every daily and weekly goal a template can be drawn as, one per target. */
const drawn = (kind: GoalKind, templates: Template[]): Goal[] =>
  templates.flatMap((t) =>
    t.targets.map((target) => ({
      id: `${t.id}-${target}`,
      kind,
      stat: t.stat,
      title: t.title,
      description: t.text(fmt(target), target === 1),
      target,
    })),
  );

/** Days in the current month: the target for the "every day" monthly goals. */
const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

const monthly = (): Goal[] => [
  { id: "dailyGamer", kind: "monthly", stat: "busyDays", title: "Daily gamer", description: "Play 5 games every day this month.", target: daysInMonth() },
  { id: "starEveryDay", kind: "monthly", stat: "starDays", title: "Shining star", description: "Earn 5 stars every day this month.", target: daysInMonth() },
  { id: "chestHunter", kind: "monthly", stat: "chests", title: "Chest hunter", description: "Find 100 chests on the road this month.", target: 100 },
];

/** Runs with one character for each Hopper badge, lowest first. */
export const HOPPER_TIERS = [10, 50, 100];

const BADGES: Goal[] = [
  { id: "worldTour", kind: "badge", stat: "biomes", title: "World tour", description: "Pass through 5 biomes in one run.", target: 5 },
  { id: "collector", kind: "badge", stat: "picked", title: "Collector", description: "Pick up 5 different power-ups on the road.", target: 5 },
  { id: "coinHoard", kind: "badge", stat: "coins", title: "Moolah", description: "Collect a total of 1,000 coins.", target: 1000 },
  { id: "coinoisseur", kind: "badge", stat: "runCoins", title: "Coin-oisseur", description: "Collect 500 coins in one run.", target: 500 },
  { id: "master", kind: "badge", stat: "scoreSum", title: "Master", description: "Score a total of 10,000 in all.", target: 10000 },
  // Road master was 250 in one run; the new target gets a new id so earlier badges don't carry over.
  { id: "roadMaster5k", kind: "badge", stat: "score", title: "Road Master", description: "Score 5,000 in one run.", target: 5000, medal: "roadMaster" },
  { id: "roadLegend", kind: "badge", stat: "score", title: "Road Legend", description: "Score 10,000 in one run.", target: 10000 },
  { id: "bestFriends", kind: "badge", stat: "characters", title: "Best friends", description: "Play as 3 different characters.", target: 3 },
  ...CHARACTERS.flatMap((c) =>
    HOPPER_TIERS.map((target, i) => ({
      id: `hopper-${c.id}-${target}`,
      kind: "badge" as const,
      stat: "played" as const,
      character: c.id,
      title: "Hopper",
      description: `Run with ${c.name} ${target} times.`,
      target,
      medal: `hopper-${i + 1}`,
    })),
  ),
];

/** Every goal there is, for looking one up by id. */
export const ALL_GOALS: Goal[] = [...drawn("daily", DAILY), ...drawn("weekly", WEEKLY), ...monthly(), ...BADGES];
const BY_ID = new Map(ALL_GOALS.map((g) => [g.id, g]));

/** Ring colour for each goal: gold stars for daily, orange for weekly, pink for monthly, a colour of its own for each badge. */
export const GOAL_COLOR: Record<string, string> = {
  daily: "#f4c542",
  weekly: "#ff9f43",
  monthly: "#ff6fd8",
  worldTour: "#2ee6c9",
  collector: "#ff6fb1",
  coinHoard: "#7bd94a",
  coinoisseur: "#ff8c1a",
  master: "#4aa8ff",
  roadMaster: "#ff5d5d",
  roadLegend: "#b44dff",
  bestFriends: "#a98bff",
  "hopper-1": "#cd7f32",
  "hopper-2": "#c9d3dd",
  "hopper-3": "#fff06a",
};

const medalOf = (g: Goal) => g.medal ?? g.id;

export const goalColor = (g: Goal) => (g.kind === "badge" ? GOAL_COLOR[medalOf(g)] : GOAL_COLOR[g.kind]);

/** The goal's icon: a star for timed goals, its own medal for a badge. */
export const goalIcon = (g?: Goal) => (!g || g.kind !== "badge" ? "/achievements/star.png" : `/achievements/medal-${medalOf(g)}.png`);

interface State {
  /** The local date the daily counters belong to. */
  day: string;
  /** The local date of the Monday the weekly counters belong to. */
  week: string;
  /** The year and month the monthly counters belong to. */
  month: string;
  daily: Counters;
  weekly: Counters;
  monthly: Counters;
  /** All time; badges read these. */
  total: Counters;
  /** Ids of the goals drawn for today and for this week. */
  todayGoals: string[];
  weekGoals: string[];
  doneToday: string[];
  doneThisWeek: string[];
  doneThisMonth: string[];
  /** Stars earned over all time. */
  stars: number;
  badges: string[];
  /** Different power-ups picked up on the road, ever. */
  picked: PowerUp[];
  /** Characters played at least one run with. */
  characters: CharacterId[];
  /** Runs played with each character, ever. */
  played: Partial<Record<CharacterId, number>>;
}

const KEY = "xfast-achievements";

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

const zero = (): Counters => ({
  hops: 0,
  coins: 0,
  runs: 0,
  powerups: 0,
  pickups: 0,
  logs: 0,
  chests: 0,
  stars: 0,
  days: 0,
  scoreSum: 0,
  roads: 0,
  rivers: 0,
  rails: 0,
  busyDays: 0,
  starDays: 0,
  boost: 0,
  score: 0,
  biomes: 0,
  runCoins: 0,
  runHops: 0,
  runRoads: 0,
  runRivers: 0,
});

/**
 * Draw `count` goals from the templates, each at a random target. Templates counting a stat not yet
 * drawn go first, so a day mixes hops, coins, runs and the rest before doubling up on any.
 */
function draw(kind: GoalKind, templates: Template[]): string[] {
  const shuffled = [...templates].sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  const fresh = shuffled.filter((t) => !seen.has(t.stat) && seen.add(t.stat));
  const order = [...fresh, ...shuffled.filter((t) => !fresh.includes(t))];
  return order.slice(0, DRAWN[kind]).map((t) => `${t.id}-${t.targets[Math.floor(Math.random() * t.targets.length)]}`);
}

const fresh = (): State => ({
  day: today(),
  week: thisWeek(),
  month: thisMonth(),
  daily: zero(),
  weekly: zero(),
  monthly: zero(),
  total: zero(),
  todayGoals: draw("daily", DAILY),
  weekGoals: draw("weekly", WEEKLY),
  doneToday: [],
  doneThisWeek: [],
  doneThisMonth: [],
  stars: 0,
  badges: [],
  picked: [],
  characters: [],
  played: {},
});

let state: State | null = null;
const listeners = new Set<() => void>();
// This run's progress; not saved.
let runBiomes = new Set<BiomeId>();
let runPowerups = 0;
let runCoins = 0;
let runHops = 0;
let runScore = 0;
let runRoads = 0;
let runRivers = 0;

/** Drawn goal ids that still exist; a save from an older version may name goals since removed. */
const known = (ids: unknown) => (Array.isArray(ids) ? ids.filter((id) => BY_ID.has(id)) : []);

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const base = fresh();
    const todayGoals = known(raw.todayGoals);
    const weekGoals = known(raw.weekGoals);
    return {
      ...base,
      ...raw,
      todayGoals: todayGoals.length ? todayGoals : base.todayGoals,
      weekGoals: weekGoals.length ? weekGoals : base.weekGoals,
      daily: { ...base.daily, ...raw.daily },
      weekly: { ...base.weekly, ...raw.weekly },
      monthly: { ...base.monthly, ...raw.monthly },
      // Saves from before weekly goals kept only the best World tour run.
      total: { ...base.total, ...raw.total, biomes: Math.max(raw.total?.biomes ?? 0, raw.bestBiomes ?? 0) },
      played: { ...raw.played },
    };
  } catch {
    return fresh();
  }
}

/** The saved state, with yesterday's, last week's and last month's progress cleared and new goals drawn. */
function get(): State {
  state ??= load();
  if (state.day !== today()) state = { ...state, day: today(), daily: zero(), doneToday: [], todayGoals: draw("daily", DAILY) };
  if (state.week !== thisWeek()) state = { ...state, week: thisWeek(), weekly: zero(), doneThisWeek: [], weekGoals: draw("weekly", WEEKLY) };
  if (state.month !== thisMonth()) state = { ...state, month: thisMonth(), monthly: zero(), doneThisMonth: [] };
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

/** Raise a stat in every counter: added, or kept as a best. */
const count = (stat: keyof Counters, n: number) => (s: State): State => {
  if (n === 0 && !BEST.includes(stat)) return s;
  const bump = (c: Counters) => ({ ...c, [stat]: BEST.includes(stat) ? Math.max(c[stat], n) : c[stat] + n });
  return { ...s, daily: bump(s.daily), weekly: bump(s.weekly), monthly: bump(s.monthly), total: bump(s.total) };
};

/** A day just reached 5 of something: count it toward the monthly "every day" goal. */
const reachedFive = (before: number, after: number) => before < 5 && after >= 5;

const scopeOf = (kind: GoalKind, s: State) =>
  kind === "daily" ? s.daily : kind === "weekly" ? s.weekly : kind === "monthly" ? s.monthly : s.total;

const doneOf = (kind: GoalKind, s: State) =>
  kind === "daily" ? s.doneToday : kind === "weekly" ? s.doneThisWeek : kind === "monthly" ? s.doneThisMonth : s.badges;

const lookUp = (ids: string[]) => ids.map((id) => BY_ID.get(id)).filter((g): g is Goal => !!g);

export const achievements = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  snapshot: () => get(),

  /** The goals in play: today's and this week's draws, this month's and every badge. */
  goals(kind: GoalKind, s: State = get()): Goal[] {
    if (kind === "daily") return lookUp(s.todayGoals);
    if (kind === "weekly") return lookUp(s.weekGoals);
    if (kind === "monthly") return monthly();
    return BADGES;
  },

  /**
   * The badges to list for the characters unlocked: the fixed ones, then one Hopper badge per
   * character, at the lowest tier not yet earned (or the top tier once all are).
   */
  badgesFor(owned: CharacterId[], s: State = get()): Goal[] {
    const hoppers = owned.flatMap((id) => {
      const tiers = BADGES.filter((g) => g.character === id);
      return tiers.find((g) => !s.badges.includes(g.id)) ?? tiers.slice(-1);
    });
    return [...BADGES.filter((g) => !g.character), ...hoppers];
  },

  /** Badges earned that are still in the game. */
  badgeCount: (s: State = get()) => BADGES.filter((g) => s.badges.includes(g.id)).length,

  /** Progress toward a goal, from 0 up to its target. */
  progress(goal: Goal, s: State = get()) {
    const value =
      goal.stat === "picked"
        ? s.picked.length
        : goal.stat === "characters"
          ? s.characters.length
          : goal.stat === "played"
            ? (s.played[goal.character!] ?? 0)
            : scopeOf(goal.kind, s)[goal.stat];
    return Math.min(goal.target, value);
  },

  earned: (goal: Goal, s: State = get()) => doneOf(goal.kind, s).includes(goal.id),

  startRun(biome: BiomeId, character: CharacterId) {
    runBiomes = new Set([biome]);
    runPowerups = runCoins = runHops = runScore = runRoads = runRivers = 0;
    return update((s) => {
      let next = count("runs", 1)(s);
      if (s.daily.runs === 0) next = count("days", 1)(next);
      if (reachedFive(s.daily.runs, next.daily.runs)) next = count("busyDays", 1)(next);
      next = { ...next, played: { ...next.played, [character]: (next.played[character] ?? 0) + 1 } };
      return s.characters.includes(character) ? next : { ...next, characters: [...s.characters, character] };
    });
  },

  hop() {
    runHops++;
    return update((s) => count("runHops", runHops)(count("hops", 1)(s)));
  },
  coins(n: number) {
    runCoins += n;
    return update((s) => count("runCoins", runCoins)(count("coins", n)(s)));
  },
  /** A new best row this run, and the kind of lane it is. */
  scored(score: number, lane?: LaneType) {
    const gained = Math.max(0, score - runScore);
    runScore = Math.max(runScore, score);
    if (lane === "road") runRoads++;
    if (lane === "river") runRivers++;
    return update((s) => {
      let next = count("score", score)(count("scoreSum", gained)(s));
      if (lane === "road") next = count("runRoads", runRoads)(count("roads", 1)(next));
      if (lane === "river") next = count("runRivers", runRivers)(count("rivers", 1)(next));
      if (lane === "rail") next = count("rails", 1)(next);
      return next;
    });
  },
  usedPowerup() {
    runPowerups++;
    return update((s) => count("boost", runPowerups)(count("powerups", 1)(s)));
  },
  pickedUp: (kind: PowerUp) =>
    update((s) => {
      const next = count("pickups", 1)(s);
      return s.picked.includes(kind) ? next : { ...next, picked: [...s.picked, kind] };
    }),
  rodeLog: () => update(count("logs", 1)),
  foundChest: () => update(count("chests", 1)),
  enteredBiome(biome: BiomeId) {
    runBiomes.add(biome);
    return update(count("biomes", runBiomes.size));
  },
};

/** Goals that could be earned now: today's and this week's draws, this month's and the badges. */
const inPlay = (s: State) => [...lookUp(s.todayGoals), ...lookUp(s.weekGoals), ...monthly(), ...BADGES];

/**
 * Apply a change, award anything it completes, and return the goals newly earned. Stars from one
 * goal can finish a goal that counts stars, so awarding repeats until nothing more is earned.
 */
function update(change: (s: State) => State): Goal[] {
  const before = get();
  let next = change(before);
  const all: Goal[] = [];
  for (;;) {
    const earned = inPlay(next).filter((g) => !achievements.earned(g, next) && achievements.progress(g, next) >= g.target);
    if (!earned.length) break;
    for (const g of earned) {
      const stars = STARS_FOR[g.kind];
      const dayStars = next.daily.stars;
      next = { ...count("stars", stars)(next), stars: next.stars + stars };
      if (reachedFive(dayStars, next.daily.stars)) next = count("starDays", 1)(next);
      if (g.kind === "daily") next = { ...next, doneToday: [...next.doneToday, g.id] };
      else if (g.kind === "weekly") next = { ...next, doneThisWeek: [...next.doneThisWeek, g.id] };
      else if (g.kind === "monthly") next = { ...next, doneThisMonth: [...next.doneThisMonth, g.id] };
      else next = { ...next, badges: [...next.badges, g.id] };
    }
    all.push(...earned);
  }
  if (next !== before) save(next);
  return all;
}
