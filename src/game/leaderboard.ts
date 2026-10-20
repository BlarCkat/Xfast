export type Board = "weekly" | "global";

/** ISO week in UTC, e.g. "2026-W43". Weekly boards start fresh every Monday at 00:00 UTC. */
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  // The ISO week belongs to the year its Thursday falls in.
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** When the current weekly board closes: next Monday, 00:00 UTC. */
export function weekEnds(date = new Date()) {
  const day = date.getUTCDay() || 7;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 8 - day);
}

export interface Profile {
  username: string;
  /** An https URL (e.g. the Google account photo) or a small JPEG data URL. Empty for none. */
  photo: string;
}

export const USERNAME_RULE = /^[A-Za-z0-9_]{3,16}$/;
export const USERNAME_HINT = "3 to 16 letters, numbers or underscores";
/** Uploaded pictures are shrunk in the browser to a small JPEG well under this. */
export const MAX_PHOTO_LENGTH = 24_000;

export function validPhoto(photo: unknown): photo is string {
  if (typeof photo !== "string") return false;
  if (photo === "") return true;
  if (photo.startsWith("data:image/jpeg;base64,")) return photo.length <= MAX_PHOTO_LENGTH;
  return /^https:\/\/[^\s"'<>]+$/.test(photo) && photo.length <= 1000;
}

export interface LeaderboardRow {
  rank: number;
  username: string;
  photo: string;
  points: number;
  best: number;
  you: boolean;
}

export interface LeaderboardResponse {
  board: Board;
  week: string;
  /** Weekly only: when this week's board closes (ms since epoch). */
  endsAt: number | null;
  top: LeaderboardRow[];
  /** The signed-in player's own standing, even when outside the top list. */
  me: { rank: number; points: number; best: number } | null;
}
