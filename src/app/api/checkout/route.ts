import { NextResponse } from "next/server";
import { isPackId } from "@/game/coinPacks";
import { adminAuth } from "@/lib/server/firebaseAdmin";
import { createCheckout } from "@/lib/server/lemonsqueezy";

/** Start a Lemon Squeezy checkout for a coin pack. Only signed-in players can buy, so coins have an account to land in. */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return NextResponse.json({ error: "Sign in to buy coins" }, { status: 401 });

  let user;
  try {
    user = await adminAuth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Sign in to buy coins" }, { status: 401 });
  }

  const { pack } = (await req.json().catch(() => ({}))) as { pack?: unknown };
  if (!isPackId(pack)) return NextResponse.json({ error: "Unknown coin pack" }, { status: 400 });

  try {
    const url = await createCheckout({
      pack,
      uid: user.uid,
      email: user.email,
      redirectUrl: `${new URL(req.url).origin}/?purchase=${pack}`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Checkout is unavailable right now" }, { status: 502 });
  }
}
