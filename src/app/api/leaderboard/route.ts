import { NextResponse } from "next/server";
import { cleanName } from "@/game/names";

// The online leaderboard. Scores live in the Upstash Redis store connected to the Vercel project:
// one sorted set per board (today, this week, all time), each keeping a player's best score, and
// a hash of player names. Only this route talks to the store, so its token never reaches the browser.

export const dynamic = "force-dynamic";

const BOARDS = ["day", "week", "all"] as const;
type Board = (typeof BOARDS)[number];

const TOP = 50;
const MAX_SCORE = 100_000;
/** Even with super hops and warps nobody covers more rows than this per second. */
const MAX_ROWS_PER_SECOND = 15;
const NAMES = "lb:names";
const ID = /^[0-9a-f-]{36}$/i;

function store() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

type Command = (string | number)[];

/** Send commands to Redis in one round trip and return each result. */
async function redis(commands: Command[]): Promise<unknown[]> {
  const s = store()!;
  const res = await fetch(`${s.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

/** The key for a board's current window, in UTC, and how long to keep it. Weeks start on Monday. */
function keyFor(board: Board, now = new Date()) {
  if (board === "all") return { key: "lb:all", ttl: 0 };
  const day = now.toISOString().slice(0, 10);
  if (board === "day") return { key: `lb:day:${day}`, ttl: 3 * 86400 };
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  return { key: `lb:week:${monday.toISOString().slice(0, 10)}`, ttl: 15 * 86400 };
}

const unavailable = () => NextResponse.json({ error: "Leaderboard is not set up" }, { status: 503 });

/** Read a board: GET /api/leaderboard?board=day&player=<id>. */
export async function GET(req: Request) {
  if (!store()) return unavailable();
  const params = new URL(req.url).searchParams;
  const board = (BOARDS as readonly string[]).includes(params.get("board") ?? "") ? (params.get("board") as Board) : "all";
  const player = params.get("player");
  const me = player && ID.test(player) ? player : null;
  const { key } = keyFor(board);
  try {
    const [top, rank, score] = await redis([
      ["ZRANGE", key, 0, TOP - 1, "REV", "WITHSCORES"],
      me ? ["ZREVRANK", key, me] : ["PING"],
      me ? ["ZSCORE", key, me] : ["PING"],
    ]);
    const flat = top as string[];
    const ids = flat.filter((_, i) => i % 2 === 0);
    const names = ids.length ? ((await redis([["HMGET", NAMES, ...ids]]))[0] as (string | null)[]) : [];
    // Equal scores share a rank, like on a podium.
    const rows: { rank: number; name: string; score: number; me: boolean }[] = [];
    ids.forEach((id, i) => {
      const s = Number(flat[i * 2 + 1]);
      const prev = rows[i - 1];
      rows.push({ rank: prev && prev.score === s ? prev.rank : i + 1, name: names[i] ?? "???", score: s, me: id === me });
    });
    let mine = null;
    if (me && typeof rank === "number" && score != null) {
      const s = Number(score);
      const higher = (await redis([["ZCOUNT", key, `(${s}`, "+inf"]]))[0] as number;
      mine = { rank: higher + 1, name: (await redis([["HGET", NAMES, me]]))[0] as string, score: s };
    }
    return NextResponse.json({ board, rows, me: mine }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Leaderboard is unavailable" }, { status: 502 });
  }
}

/**
 * Save a finished run: POST { player, name, score, seconds }. Each board keeps the player's best,
 * and the answer gives their rank on every board. Scores that are faster than any real run are refused.
 */
export async function POST(req: Request) {
  if (!store()) return unavailable();
  let body: { player?: unknown; name?: unknown; score?: unknown; seconds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { player, score, seconds } = body;
  const name = cleanName(body.name);
  if (typeof player !== "string" || !ID.test(player)) return NextResponse.json({ error: "Bad player" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Pick another name" }, { status: 422 });
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > MAX_SCORE)
    return NextResponse.json({ error: "Bad score" }, { status: 400 });
  if (typeof seconds !== "number" || !(seconds >= 0) || (score as number) > seconds * MAX_ROWS_PER_SECOND + 30)
    return NextResponse.json({ error: "Score not accepted" }, { status: 422 });

  try {
    // One save per player every few seconds stops scripted floods.
    const [fresh] = await redis([["SET", `lb:wait:${player}`, 1, "EX", 3, "NX"], ["HSET", NAMES, player, name]]);
    const keys = BOARDS.map((b) => keyFor(b));
    if (fresh === "OK" && (score as number) > 0) {
      await redis(
        keys.flatMap(({ key, ttl }) => {
          const cmds: Command[] = [["ZADD", key, "GT", score as number, player]];
          if (ttl) cmds.push(["EXPIRE", key, ttl]);
          return cmds;
        }),
      );
    }
    const scores = (await redis(keys.map(({ key }) => ["ZSCORE", key, player]))) as (string | null)[];
    const higher = (await redis(
      keys.map(({ key }, i) => (scores[i] == null ? ["PING"] : ["ZCOUNT", key, `(${scores[i]}`, "+inf"])),
    )) as (number | string)[];
    const ranks = Object.fromEntries(
      BOARDS.map((b, i) => [b, scores[i] == null ? null : { rank: (higher[i] as number) + 1, score: Number(scores[i]) }]),
    );
    return NextResponse.json({ name, ranks });
  } catch {
    return NextResponse.json({ error: "Leaderboard is unavailable" }, { status: 502 });
  }
}
