import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { weekKey, type Profile } from "@/game/leaderboard";

/**
 * Leaderboards live at boards/global/entries/{uid} and boards/{week}/entries/{uid},
 * e.g. boards/2026-W43. A new week simply starts writing to a new board, so
 * weekly boards reset themselves and old weeks stay on record.
 */
export const entries = (db: Firestore, board: string) => db.collection("boards").doc(board).collection("entries");

export const fallbackName = (uid: string) => `player_${uid.slice(0, 6).toLowerCase()}`;

export async function readProfile(db: Firestore, uid: string): Promise<Profile & { lastRunAt: number }> {
  const data = (await db.collection("profiles").doc(uid).get()).data();
  return { username: data?.username ?? "", photo: data?.photo ?? "", lastRunAt: data?.lastRunAt ?? 0 };
}

/** Copy a renamed player's name and picture onto their entries, so the boards don't need a join. */
export async function syncEntries(db: Firestore, uid: string, profile: Profile) {
  const batch = db.batch();
  for (const board of ["global", weekKey()]) {
    const ref = entries(db, board).doc(uid);
    if ((await ref.get()).exists) batch.update(ref, { username: profile.username, photo: profile.photo });
  }
  await batch.commit();
}

export const addRun = (score: number) => ({
  points: FieldValue.increment(score),
  runs: FieldValue.increment(1),
  updatedAt: FieldValue.serverTimestamp(),
});
