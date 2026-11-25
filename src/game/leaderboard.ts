// The browser side of the online leaderboard: who this player is, saving a run, and reading a board.
// The player is a random id plus the nickname they picked, both kept in localStorage. There is no
// login, so clearing site data (or Reset game) starts a new leaderboard entry.

export type Board = "day" | "week" | "all";
export const BOARDS: { id: Board; title: string }[] = [
  { id: "day", title: "Today" },
  { id: "week", title: "This week" },
  { id: "all", title: "All time" },
];

export interface Row {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}
export interface BoardData {
  rows: Row[];
  me: { rank: number; name: string; score: number } | null;
}
export type Ranks = Record<Board, { rank: number; score: number } | null>;

const KEY = "xfast-player";
interface Player {
  id: string;
  name: string | null;
}

let player: Player | null = null;
const listeners = new Set<() => void>();

function load(): Player {
  if (player) return player;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Player | null;
    if (saved && typeof saved.id === "string") return (player = { id: saved.id, name: saved.name ?? null });
  } catch {}
  player = { id: crypto.randomUUID(), name: null };
  save();
  return player;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(player));
  } catch {
    // Without storage the nickname lasts until the page is closed.
  }
}

const API = "/api/leaderboard";
const cache = new Map<Board, { at: number; data: BoardData }>();
const FRESH_MS = 20_000;

export const leaderboard = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** The nickname, or null before the player has picked one. */
  name: () => load().name,
  setName(name: string) {
    load().name = name;
    save();
    cache.clear();
    listeners.forEach((fn) => fn());
  },

  /** Save a run. Resolves to the player's ranks, or null when the leaderboard can't be reached. */
  async submit(score: number, seconds: number): Promise<Ranks | null> {
    const p = load();
    if (!p.name) return null;
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player: p.id, name: p.name, score, seconds }),
      });
      if (!res.ok) return null;
      cache.clear();
      return ((await res.json()) as { ranks: Ranks }).ranks;
    } catch {
      return null;
    }
  },

  /** Read a board. Resolves to null when the leaderboard isn't set up or can't be reached. */
  async board(board: Board): Promise<BoardData | null> {
    const hit = cache.get(board);
    if (hit && performance.now() - hit.at < FRESH_MS) return hit.data;
    try {
      const res = await fetch(`${API}?board=${board}&player=${load().id}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as BoardData;
      cache.set(board, { at: performance.now(), data });
      return data;
    } catch {
      return null;
    }
  },
};
