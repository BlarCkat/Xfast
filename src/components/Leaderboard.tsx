"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Board, LeaderboardResponse } from "@/game/leaderboard";
import { cloud } from "@/lib/cloud";
import { Avatar } from "./Profile";

const TABS: { id: Board; label: string }[] = [
  { id: "weekly", label: "This week" },
  { id: "global", label: "All time" },
];

function timeLeft(endsAt: number) {
  const mins = Math.max(0, Math.floor((endsAt - Date.now()) / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${mins % 60}m`;
}

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const account = useSyncExternalStore(cloud.subscribe, cloud.get, cloud.get);
  const [board, setBoard] = useState<Board>("weekly");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState(false);

  // Reload when the board changes, or the player's identity or name changes.
  useEffect(() => {
    if (account.status === "off" || !account.uid) return;
    let live = true;
    setData(null);
    setError(false);
    cloud
      .leaderboard(board)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [board, account.status, account.uid, account.profile]);

  // The first time a nameless player opens the leaderboard, ask them for a username.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !account.profile || account.profile.username) return;
    asked.current = true;
    cloud.editProfile();
  }, [account.profile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
      else if (e.code === "KeyQ" || e.code === "KeyE") setBoard((b) => (b === "weekly" ? "global" : "weekly"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="menu"
      role="dialog"
      aria-label="Leaderboard"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <header className="menu-head">
        <nav className="crumbs">
          <span className="crumb-root">LEADERBOARD /</span>
          {TABS.map((t) => (
            <button key={t.id} className={board === t.id ? "on" : ""} onClick={() => setBoard(t.id)}>
              {t.label.toUpperCase()}
            </button>
          ))}
        </nav>
      </header>

      <p className="board-note">
        {board === "weekly"
          ? `Points from every run this week. Resets Monday 00:00 UTC${data?.endsAt ? `, in ${timeLeft(data.endsAt)}` : ""}.`
          : "Total points from every run since you signed up."}
      </p>

      <div className="board" aria-live="polite">
        {account.status === "off" ? (
          <p className="board-empty">Leaderboards are coming soon.</p>
        ) : error ? (
          <p className="board-empty">Couldn&apos;t load the leaderboard. Try again in a moment.</p>
        ) : !data ? (
          <p className="board-empty">Loading…</p>
        ) : data.top.length === 0 ? (
          <p className="board-empty">No runs yet{board === "weekly" ? " this week" : ""}. Be the first!</p>
        ) : (
          <ol>
            {data.top.map((r, i) => (
              <li key={i} className={r.you ? "you" : ""}>
                <span className={`board-rank rank-${r.rank}`}>{r.rank}</span>
                <Avatar photo={r.photo} name={r.username} size={36} />
                <span className="board-name">
                  {r.username}
                  <small>TOP {r.best}</small>
                </span>
                <span className="board-points">{r.points.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="board-me">
        {account.uid && (
          <>
            <Avatar photo={account.profile?.photo ?? ""} name={account.profile?.username || "?"} size={36} />
            <span className="board-name">
              {account.profile?.username || "No username yet"}
              <small>
                {data?.me
                  ? `RANK #${data.me.rank} · ${data.me.points.toLocaleString()} POINTS`
                  : data
                  ? "FINISH A RUN TO GET RANKED"
                  : ""}
              </small>
            </span>
            <button className={account.profile?.username ? "" : "primary"} onClick={() => cloud.editProfile()}>
              {account.profile?.username ? "Edit profile" : "Pick a username"}
            </button>
          </>
        )}
      </div>

      <footer className="menu-hints">
        <button onClick={() => setBoard(board === "weekly" ? "global" : "weekly")}>
          <kbd>Q</kbd> {board === "weekly" ? "All time" : "This week"}
        </button>
        <button onClick={onClose}>
          Back <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
