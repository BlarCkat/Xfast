"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BOARDS, leaderboard, type Board, type BoardData, type Ranks } from "../game/leaderboard";
import { nameProblem } from "../game/names";
import { ShopBackdrop } from "./Store";

// The online leaderboard: the best runs today, this week and of all time, switched by the same
// pill tabs as the achievements. Also the nickname box and the rank line on the score screen.

const stop = (e: React.PointerEvent) => e.stopPropagation();

export const useNickname = () => useSyncExternalStore(leaderboard.subscribe, leaderboard.name, () => null);

/** A box to pick or change the nickname shown on the leaderboard. */
export function NicknameForm({ onSaved, onCancel, label = "SAVE" }: { onSaved?: (name: string) => void; onCancel?: () => void; label?: string }) {
  const current = useNickname();
  const [value, setValue] = useState(current ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const issue = nameProblem(value);
    setProblem(issue);
    if (issue) return;
    const name = value.trim().replace(/\s+/g, " ");
    leaderboard.setName(name);
    onSaved?.(name);
  };
  return (
    <form className="nickname" onSubmit={submit} onPointerDown={stop} onPointerUp={stop}>
      <input
        className="nickname-input"
        value={value}
        maxLength={12}
        placeholder="Your nickname"
        aria-label="Nickname"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setValue(e.target.value);
          setProblem(null);
        }}
      />
      <button className="nickname-save" type="submit">
        {label}
      </button>
      {onCancel && (
        <button className="nickname-cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
      {problem && <span className="nickname-problem">{problem}</span>}
    </form>
  );
}

/** The leaderboard page, opened from the main menu. */
export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<Board>("day");
  const [data, setData] = useState<{ board: Board; data: BoardData | null } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const name = useNickname();

  useEffect(() => {
    let live = true;
    leaderboard.board(board).then((d) => live && setData({ board, data: d }));
    return () => {
      live = false;
    };
  }, [board, name]);

  const shown = data?.board === board ? data : null;
  const meVisible = shown?.data?.rows.some((r) => r.me);

  return (
    <div className="shop options-screen" role="dialog" aria-label="Leaderboard" onPointerDown={stop} onPointerUp={stop}>
      <ShopBackdrop />
      <header className="shop-head goals-top">
        <button className="shop-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="options-title">LEADERBOARD</h2>
      </header>
      <div className="options-list goals">
        {!name || renaming ? (
          <div className="lb-name">
            <span className="lb-name-label">{name ? "Change your nickname" : "Pick a nickname to join the leaderboard"}</span>
            <NicknameForm onSaved={() => setRenaming(false)} onCancel={name ? () => setRenaming(false) : undefined} />
          </div>
        ) : (
          <button className="options-row" onClick={() => setRenaming(true)}>
            <span>Playing as</span>
            <span className="options-value">{name}</span>
          </button>
        )}
        <div className="goals-tabs" role="tablist" aria-label="Leaderboard">
          {BOARDS.map((b) => (
            <button key={b.id} role="tab" aria-selected={board === b.id} className={board === b.id ? "on" : ""} onClick={() => setBoard(b.id)}>
              {b.title}
            </button>
          ))}
        </div>
        <ol className="lb-list" role="tabpanel" aria-busy={!shown}>
          {!shown && <li className="lb-note">Loading…</li>}
          {shown && !shown.data && <li className="lb-note">The leaderboard can&apos;t be reached right now.</li>}
          {shown?.data && shown.data.rows.length === 0 && <li className="lb-note">No runs yet. Be the first!</li>}
          {shown?.data?.rows.map((r, i) => (
            <li key={i} className={`lb-row${r.me ? " lb-me" : ""}${r.rank <= 3 ? ` lb-top lb-top-${r.rank}` : ""}`}>
              <span className="lb-rank">{r.rank}</span>
              <span className="lb-player">{r.name}</span>
              <span className="lb-score">{r.score}</span>
            </li>
          ))}
          {shown?.data?.me && !meVisible && (
            <li className="lb-row lb-me lb-gap">
              <span className="lb-rank">{shown.data.me.rank}</span>
              <span className="lb-player">{shown.data.me.name}</span>
              <span className="lb-score">{shown.data.me.score}</span>
            </li>
          )}
        </ol>
        <p className="lb-foot">Today and this week reset at midnight UTC, weeks on Monday.</p>
      </div>
    </div>
  );
}

/**
 * The leaderboard line on the score screen: the run is saved as soon as the screen shows, or once
 * a first-time player picks a nickname. Shows nothing if the leaderboard can't be reached.
 */
export function RunRank({ runId, score, seconds }: { runId: number; score: number; seconds: number }) {
  const name = useNickname();
  const [ranks, setRanks] = useState<{ run: number; ranks: Ranks | null } | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!name || score <= 0) return;
    let live = true;
    leaderboard.submit(score, seconds).then((r) => live && setRanks({ run: runId, ranks: r }));
    return () => {
      live = false;
    };
  }, [name, runId, score, seconds]);

  if (score <= 0) return null;
  if (!name) {
    if (skipped) return null;
    return (
      <div className="run-rank run-rank-join" style={{ "--i": 4 } as React.CSSProperties}>
        <span>Join the leaderboard</span>
        <NicknameForm onCancel={() => setSkipped(true)} />
      </div>
    );
  }
  const r = ranks?.run === runId ? ranks.ranks : null;
  if (!r) return null;
  const parts = [
    r.day && `#${r.day.rank} TODAY`,
    r.week && `#${r.week.rank} THIS WEEK`,
    r.all && `#${r.all.rank} ALL TIME`,
  ].filter(Boolean);
  return (
    <p className="run-rank" style={{ "--i": 4 } as React.CSSProperties}>
      {parts.join(" · ")}
    </p>
  );
}
