import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "./firebaseAdmin";

/** The signed-in player behind a request's `Authorization: Bearer <Firebase ID token>`, or null. */
export async function userFrom(req: Request): Promise<DecodedIdToken | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token);
  } catch {
    return null;
  }
}
