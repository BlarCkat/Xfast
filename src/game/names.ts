// Leaderboard nicknames: 3 to 12 letters, digits, spaces, dashes or underscores, and nothing rude.
// The same check runs in the browser, to explain a refusal, and on the server, which has the last word.

const BLOCKED = [
  "fuck", "shit", "cunt", "bitch", "nigg", "fag", "dick", "cock", "pussy", "slut", "whore", "rape",
  "nazi", "hitler", "penis", "vagina", "porn", "sex", "anal", "twat", "wank", "retard",
];

/** The name tidied up, or null when it can't be used. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9 _-]{3,12}$/.test(name)) return null;
  const flat = name.toLowerCase().replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/[^a-z]/g, "");
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return name;
}

/** Why a name was refused, for the nickname box. */
export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 3) return "At least 3 characters";
  if (name.length > 12) return "At most 12 characters";
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return "Letters, numbers, spaces, - and _ only";
  return cleanName(name) ? null : "Pick another name";
}
