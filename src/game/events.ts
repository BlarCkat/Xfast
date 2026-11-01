import { chests } from "./chests";

// Holiday events. While an event runs, its special item turns up on grass and road lanes. Collect
// enough of them during the collecting days and the event's chest can be claimed on the holiday
// itself, or any day after it until the event closes. Progress is kept per event and per year, so
// next year's Christmas starts again from zero.

export type EventId = "christmas";

/** A month and day, January = 1. */
type MonthDay = [number, number];

export interface EventInfo {
  id: EventId;
  name: string;
  /** The special item, singular and plural, as the HUD and Rewards screen name it. */
  item: string;
  items: string;
  /** Items needed for the chest. */
  target: number;
  /** Chance that a grass or road lane carries one of the items. */
  spawnChance: number;
  /** First collecting day. */
  start: MonthDay;
  /** The holiday: the last collecting day and the first day the chest can be claimed. */
  reward: MonthDay;
  /** Last day the chest can be claimed. */
  end: MonthDay;
  chestName: string;
}

export const EVENTS: Record<EventId, EventInfo> = {
  christmas: {
    id: "christmas",
    name: "Christmas",
    item: "red bonnet",
    items: "red bonnets",
    target: 5000,
    spawnChance: 0.5,
    start: [12, 1],
    reward: [12, 25],
    end: [12, 31],
    chestName: "Christmas chest",
  },
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** "25 DEC" */
export const dayLabel = ([m, d]: MonthDay) => `${d} ${MONTHS[m - 1]}`;

/**
 * Today's date. Outside the live site, `?date=2026-12-25` in the address pretends it is that day,
 * so an event can be tried out before it starts.
 */
function now(): Date {
  const testable = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  if (testable && typeof window !== "undefined") {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(new URLSearchParams(window.location.search).get("date") ?? "");
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  }
  return new Date();
}

const ord = ([m, d]: MonthDay) => m * 100 + d;

export interface ActiveEvent {
  info: EventInfo;
  year: number;
  /** "collect" while the items are out, "claim" from the holiday to the event's end. */
  phase: "collect" | "claim";
  /** True on the holiday itself, which is both the last collecting day and the first claiming day. */
  holiday: boolean;
}

/** The event running today, if any. */
export function activeEvent(d: Date = now()): ActiveEvent | null {
  const today = ord([d.getMonth() + 1, d.getDate()]);
  for (const info of Object.values(EVENTS)) {
    if (today < ord(info.start) || today > ord(info.end)) continue;
    const reward = ord(info.reward);
    return { info, year: d.getFullYear(), phase: today <= reward ? "collect" : "claim", holiday: today === reward };
  }
  return null;
}

/** The event whose items should be on the road today, if any. */
export function collectingEvent(): EventInfo | null {
  const e = activeEvent();
  return e?.phase === "collect" ? e.info : null;
}

interface Progress {
  items: number;
  claimed: boolean;
}

type State = Record<string, Progress>;

const KEY = "xfast-events";
const keyOf = (id: EventId, year: number) => `${id}-${year}`;
const empty: Progress = { items: 0, claimed: false };

let state: State | null = null;
const listeners = new Set<() => void>();

function get(): State {
  if (state) return state;
  try {
    state = JSON.parse(localStorage.getItem(KEY) ?? "{}") as State;
  } catch {
    state = {};
  }
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

const serverState: State = {};

export const events = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  snapshot: () => get(),
  serverSnapshot: () => serverState,

  /** Items collected for this year's run of an event, and whether its chest was claimed. */
  progress(e: ActiveEvent, s: State = get()): Progress {
    return s[keyOf(e.info.id, e.year)] ?? empty;
  },

  /** Count one item picked up on the road. Returns the new total, or null when no event is collecting. */
  collect(): { total: number; info: EventInfo } | null {
    const e = activeEvent();
    if (!e || e.phase !== "collect") return null;
    const s = get();
    const key = keyOf(e.info.id, e.year);
    const p = s[key] ?? empty;
    save({ ...s, [key]: { ...p, items: p.items + 1 } });
    return { total: p.items + 1, info: e.info };
  },

  /** Whether today's event chest is waiting to be claimed. */
  claimable(s: State = get()) {
    const e = activeEvent();
    if (!e || (e.phase !== "claim" && !e.holiday)) return false;
    const p = events.progress(e, s);
    return !p.claimed && p.items >= e.info.target;
  },

  /** Claim today's event chest into the player's collection. */
  claim(): EventId | null {
    if (!events.claimable()) return null;
    const e = activeEvent()!;
    const s = get();
    const key = keyOf(e.info.id, e.year);
    save({ ...s, [key]: { ...events.progress(e, s), claimed: true } });
    chests.grant(e.info.id);
    return e.info.id;
  },
};
