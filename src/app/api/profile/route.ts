import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { USERNAME_HINT, USERNAME_RULE, validPhoto } from "@/game/leaderboard";
import { userFrom } from "@/lib/server/auth";
import { readProfile, syncEntries } from "@/lib/server/boards";
import { adminDb } from "@/lib/server/firebaseAdmin";

/** The signed-in player's username and picture. An empty username means they haven't picked one yet. */
export async function GET(req: Request) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { username, photo } = await readProfile(adminDb(), user.uid);
  return NextResponse.json({ username, photo });
}

/** Set a username (unique, case-insensitive) and picture. Usernames are claimed in usernames/{lowercase}. */
export async function PUT(req: Request) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; photo?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!USERNAME_RULE.test(username)) return NextResponse.json({ error: `Usernames are ${USERNAME_HINT}` }, { status: 400 });
  if (!validPhoto(body.photo)) return NextResponse.json({ error: "That picture can't be used" }, { status: 400 });
  const photo = body.photo;

  const db = adminDb();
  const profileRef = db.collection("profiles").doc(user.uid);
  const taken = await db.runTransaction(async (tx) => {
    const lower = username.toLowerCase();
    const nameRef = db.collection("usernames").doc(lower);
    const [owner, current] = await Promise.all([tx.get(nameRef), tx.get(profileRef)]);
    if (owner.exists && owner.get("uid") !== user.uid) return true;
    const previous = current.get("usernameLower") as string | undefined;
    if (previous && previous !== lower) tx.delete(db.collection("usernames").doc(previous));
    tx.set(nameRef, { uid: user.uid });
    tx.set(profileRef, { username, usernameLower: lower, photo, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return false;
  });
  if (taken) return NextResponse.json({ error: "That username is taken" }, { status: 409 });

  await syncEntries(db, user.uid, { username, photo });
  return NextResponse.json({ username, photo });
}
