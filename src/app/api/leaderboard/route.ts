import { NextResponse } from "next/server";
import { weekEnds, weekKey, type Board, type LeaderboardResponse, type LeaderboardRow } from "@/game/leaderboard";
import { userFrom } from "@/lib/server/auth";
import { entries } from "@/lib/server/boards";
import { adminDb } from "@/lib/server/firebaseAdmin";

const TOP = 50;

/** The top players by points on the weekly or global board, plus the caller's own rank when signed in. */
export async function GET(req: Request) {
  const board: Board = new URL(req.url).searchParams.get("board") === "global" ? "global" : "weekly";
  const now = new Date();
  const week = weekKey(now);
  const col = entries(adminDb(), board === "global" ? "global" : week);
  const user = await userFrom(req);

  const snap = await col.orderBy("points", "desc").limit(TOP).get();
  const top: LeaderboardRow[] = [];
  snap.docs.forEach((d, i) => {
    const points = d.get("points") ?? 0;
    // Tied players share a rank.
    const rank = i > 0 && top[i - 1].points === points ? top[i - 1].rank : i + 1;
    top.push({ rank, username: d.get("username"), photo: d.get("photo") ?? "", points, best: d.get("best") ?? 0, you: d.id === user?.uid });
  });

  let me: LeaderboardResponse["me"] = null;
  if (user) {
    const mine = await col.doc(user.uid).get();
    if (mine.exists) {
      const points = mine.get("points") ?? 0;
      const ahead = await col.where("points", ">", points).count().get();
      me = { rank: ahead.data().count + 1, points, best: mine.get("best") ?? 0 };
    }
  }

  const body: LeaderboardResponse = { board, week, endsAt: board === "weekly" ? weekEnds(now) : null, top, me };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
