import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

// The web config is public by design; Firestore security rules are what protect the data.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** False until the Firebase env vars are set, in which case the game runs as guest-only. */
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

/** Local development against `firebase emulators:start` (auth on 9099, Firestore on 8085). */
export const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "1";
