import { NextResponse } from "next/server";
import { weekKey } from "@/game/leaderboard";
import { userFrom } from "@/lib/server/auth";
import { addRun, entries, fallbackName } from "@/lib/server/boards";
import { adminDb } from "@/lib/server/firebaseAdmin";

/** Highest score a single run can report. */
const MAX_SCORE = 20_000;
/** Even with super hop and warp, a run can't gain a row faster than this on average. */
const MIN_MS_PER_ROW = 40;

/**
 * Record a finished run: its score is added to the player's points on the
 * global board and this week's board, and their best score is kept.
 * Scores come from the browser, so this only screens out the obviously impossible.
 */
export async function POST(req: Request) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { score } = (await req.json().catch(() => ({}))) as { score?: unknown };
  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > MAX_SCORE) {
    return NextResponse.json({ error: "Bad score" }, { status: 400 });
  }

  const db = adminDb();
  const now = Date.now();
  const profileRef = db.collection("profiles").doc(user.uid);
  const week = weekKey(new Date(now));
  const rejected = await db.runTransaction(async (tx) => {
    const [profileSnap, global, weekly] = await Promise.all([
      tx.get(profileRef),
      tx.get(entries(db, "global").doc(user.uid)),
      tx.get(entries(db, week).doc(user.uid)),
    ]);
    const profile = profileSnap.data() ?? {};
    if (profile.lastRunAt && score * MIN_MS_PER_ROW > now - profile.lastRunAt) return true;
    const shown = { username: profile.username || fallbackName(user.uid), photo: profile.photo ?? "" };
    tx.set(profileRef, { lastRunAt: now }, { merge: true });
    tx.set(global.ref, { ...shown, ...addRun(score), best: Math.max(score, global.get("best") ?? 0) }, { merge: true });
    tx.set(weekly.ref, { ...shown, ...addRun(score), best: Math.max(score, weekly.get("best") ?? 0) }, { merge: true });
    return false;
  });
  if (rejected) return NextResponse.json({ error: "Run too fast to count" }, { status: 429 });
  return NextResponse.json({ ok: true });
}
