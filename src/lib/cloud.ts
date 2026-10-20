import { GoogleAuthProvider, connectAuthEmulator, getAuth, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { BEST_KEY, readBest } from "@/game/engine";
import type { PackId } from "@/game/coinPacks";
import { USERNAME_RULE, type Board, type LeaderboardResponse, type Profile } from "@/game/leaderboard";
import { fresh, merge, normalize, wallet, type WalletState } from "@/game/wallet";
import { firebaseApp, firebaseEnabled, useEmulators } from "./firebase";

export type CloudStatus = "off" | "loading" | "guest" | "signed-in";

export interface CloudState {
  status: CloudStatus;
  uid: string | null;
  name: string | null;
  /** A checkout is being created. */
  busy: boolean;
  /** Username and picture, once loaded. An empty username means the player hasn't picked one. */
  profile: Profile | null;
  /** While the profile editor is open, what it starts from. */
  editing: Profile | null;
  notice: { text: string; id: number } | null;
}

/** Which account the progress in this browser belongs to, and when it last changed. */
const SYNC_KEY = "xfast-sync";
const SAVE_DELAY = 1500;

interface LocalSync {
  uid: string | null;
  at: number;
}

interface CloudSave {
  save: WalletState;
  best: number;
  savedAt: number;
}

function readSync(): LocalSync {
  try {
    const s = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "null") as Partial<LocalSync> | null;
    return { uid: s?.uid ?? null, at: Number(s?.at) || 0 };
  } catch {
    return { uid: null, at: 0 };
  }
}

function writeSync(s: LocalSync) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {}
}

function writeBest(best: number) {
  try {
    if (best > 0) localStorage.setItem(BEST_KEY, String(best));
    else localStorage.removeItem(BEST_KEY);
  } catch {}
}

/**
 * Accounts and cloud saves. Guests keep playing on local storage as before;
 * signing in with Google mirrors the wallet and top score to players/{uid} in
 * Firestore, folding any guest progress in the first time. Coins bought through
 * Lemon Squeezy are credited server-side to purchases/{uid} and claimed here.
 */
class Cloud {
  private state: CloudState = { status: firebaseEnabled ? "loading" : "off", uid: null, name: null, busy: false, notice: null, profile: null, editing: null };
  private listeners = new Set<() => void>();
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private started = false;
  private loaded = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopPurchases: (() => void) | null = null;
  private noticeId = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  get = () => this.state;

  private setState(patch: Partial<CloudState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  private notify(text: string) {
    this.setState({ notice: { text, id: ++this.noticeId } });
  }

  /** Called once on the client when the game mounts. */
  start() {
    if (this.started || !firebaseEnabled) return;
    this.started = true;
    this.auth = getAuth(firebaseApp());
    this.db = getFirestore(firebaseApp());
    if (useEmulators) {
      connectAuthEmulator(this.auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(this.db, "127.0.0.1", 8085);
    }
    onAuthStateChanged(this.auth, (user) => void this.onUser(user));
    wallet.subscribe(() => this.touch());
    const flush = () => document.visibilityState === "hidden" && void this.save();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", () => void this.save());

    // Back from a Lemon Squeezy checkout. The coins arrive once its webhook has run.
    const url = new URL(window.location.href);
    if (url.searchParams.has("purchase")) {
      this.notify("THANKS! YOUR COINS ARE ON THEIR WAY");
      url.searchParams.delete("purchase");
      window.history.replaceState(null, "", url);
    }
  }

  /** Progress changed locally: remember when, and push it to the cloud shortly. */
  touch() {
    if (!this.loaded) return;
    writeSync({ uid: this.state.uid, at: Date.now() });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), SAVE_DELAY);
  }

  private async onUser(user: User | null) {
    this.stopPurchases?.();
    this.stopPurchases = null;
    this.loaded = false;
    if (!user) {
      this.setState({ status: "guest", uid: null, name: null, profile: null, editing: null });
      return;
    }
    this.setState({ status: "loading", uid: user.uid, name: user.displayName ?? user.email });
    try {
      const snap = await getDoc(doc(this.db!, "players", user.uid));
      const remote = snap.exists() ? (snap.data() as Partial<CloudSave>) : null;
      const local = readSync();
      const localWallet = wallet.get();
      const localBest = readBest();
      let next: WalletState;
      let best: number;
      if (!remote?.save) {
        // A new account takes this browser's progress, unless it belonged to someone else.
        next = local.uid && local.uid !== user.uid ? fresh() : localWallet;
        best = local.uid && local.uid !== user.uid ? 0 : localBest;
      } else if (local.uid === null) {
        // Guest progress from before signing in is folded into the account.
        next = merge(localWallet, normalize(remote.save));
        best = Math.max(localBest, remote.best ?? 0);
      } else if (local.uid === user.uid && local.at > (remote.savedAt ?? 0)) {
        // This browser has changes the cloud missed, e.g. the tab closed before the last save.
        next = localWallet;
        best = Math.max(localBest, remote.best ?? 0);
      } else {
        next = normalize(remote.save);
        best = local.uid === user.uid ? Math.max(localBest, remote.best ?? 0) : remote.best ?? 0;
      }
      wallet.replace(next);
      writeBest(best);
      this.loaded = true;
      writeSync({ uid: user.uid, at: Date.now() });
      await this.save();
      this.stopPurchases = onSnapshot(doc(this.db!, "purchases", user.uid), (s) => {
        const added = wallet.credit(Number(s.data()?.coins) || 0);
        if (added > 0) this.notify(`+${added} COINS`);
      });
      this.setState({ status: "signed-in" });
      void this.loadProfile(user);
    } catch (err) {
      console.error("Cloud save failed to load", err);
      this.setState({ status: "signed-in" });
      this.notify("CLOUD SAVE UNAVAILABLE");
    }
  }

  private async save() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const uid = this.state.uid;
    if (!this.loaded || !uid || !this.db) return;
    const data: CloudSave & { updatedAt: unknown } = {
      save: wallet.get(),
      best: readBest(),
      savedAt: readSync().at,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(this.db, "players", uid), data);
    } catch (err) {
      console.error("Cloud save failed", err);
    }
  }

  /** Fetch from one of the game's API routes as the signed-in player. */
  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const user = this.auth?.currentUser;
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
    const res = await fetch(path, { ...init, headers });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json;
  }

  /** New players are asked to pick a username, starting from their Google name and photo. */
  private async loadProfile(user: User) {
    try {
      const profile = await this.api<Profile>("/api/profile");
      this.setState({ profile });
      if (!profile.username) {
        const name = (user.displayName ?? "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
        this.setState({ editing: { username: USERNAME_RULE.test(name) ? name : "", photo: profile.photo || (user.photoURL ?? "") } });
      }
    } catch (err) {
      console.error("Profile failed to load", err);
    }
  }

  editProfile() {
    if (this.state.status === "signed-in") this.setState({ editing: this.state.profile ?? { username: "", photo: "" } });
  }

  closeProfile() {
    this.setState({ editing: null });
  }

  /** Returns an error message to show, or null once saved. */
  async saveProfile(next: Profile): Promise<string | null> {
    try {
      const profile = await this.api<Profile>("/api/profile", { method: "PUT", body: JSON.stringify(next) });
      this.setState({ profile, editing: null });
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  /** Count a finished run towards the weekly and global leaderboards. Guests' runs aren't counted. */
  submitRun(score: number) {
    if (this.state.status !== "signed-in" || score < 1) return;
    this.api("/api/runs", { method: "POST", body: JSON.stringify({ score }) }).catch((err) =>
      console.error("Run not counted", err),
    );
  }

  leaderboard(board: Board) {
    return this.api<LeaderboardResponse>(`/api/leaderboard?board=${board}`);
  }

  async signIn() {
    if (!this.auth) return;
    try {
      await signInWithPopup(this.auth, new GoogleAuthProvider());
    } catch (err) {
      // Closing the popup is not an error worth showing.
      if ((err as { code?: string }).code !== "auth/popup-closed-by-user") {
        console.error(err);
        this.notify("SIGN IN FAILED");
      }
    }
  }

  /** Sign out and leave this browser as a fresh guest, so the next person doesn't inherit the account's coins. */
  async signOut() {
    if (!this.auth) return;
    await this.save();
    this.loaded = false;
    await signOut(this.auth);
    wallet.replace(fresh());
    writeBest(0);
    writeSync({ uid: null, at: 0 });
  }

  /** Send the player to a Lemon Squeezy checkout for a coin pack. */
  async buy(pack: PackId) {
    const user = this.auth?.currentUser;
    if (!user) return this.signIn();
    this.setState({ busy: true });
    try {
      await this.save();
      const { url } = await this.api<{ url: string }>("/api/checkout", { method: "POST", body: JSON.stringify({ pack }) });
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      this.notify("CHECKOUT UNAVAILABLE");
      this.setState({ busy: false });
    }
  }
}

export const cloud = new Cloud();
