"use client";

import { useSyncExternalStore } from "react";
import { achievements, GOALS, type Goal } from "../game/achievements";
import { PowerRing } from "./PowerRing";
import { ShopBackdrop } from "./Store";

// The achievements page: today's milestones, each worth a star, and the long-term badges.

const GOLD = "#f4c542";
const BADGE_COLORS: Record<string, string> = { worldTour: "#2ee6c9", collector: "#ff6fb1" };

export function StarIcon({ size = 22, filled = true }: { size?: number; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"
        fill={filled ? GOLD : "none"}
        stroke={filled ? "#c98a12" : "rgba(255,255,255,0.4)"}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BadgeIcon({ size = 22, color = GOLD }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M8 13 5 22l4-2 2 3 1-8zM16 13l3 9-4-2-2 3-1-8z" fill="#e8455f" />
      <circle cx={12} cy={9.5} r={7} fill={color} stroke="#101418" strokeWidth={1.4} />
      <path d="M12 6l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 12l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="#fff" />
    </svg>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const s = useSyncExternalStore(achievements.subscribe, achievements.snapshot, achievements.snapshot);
  const value = achievements.progress(goal, s);
  const done = achievements.earned(goal, s);
  const color = goal.kind === "daily" ? GOLD : BADGE_COLORS[goal.id] ?? GOLD;
  return (
    <div className={`goal${done ? " goal-done" : ""}`}>
      <PowerRing color={color} size={58} lit={value / goal.target} label={`${value}/${goal.target}`} active={done}>
        {goal.kind === "daily" ? <StarIcon size={24} filled={done} /> : <BadgeIcon size={26} color={done ? color : "#c9c9d6"} />}
      </PowerRing>
      <div className="goal-text">
        <span className="goal-title">{goal.title}</span>
        <span className="goal-desc">{goal.description}</span>
      </div>
      {done && <span className="goal-check">{goal.kind === "daily" ? "+1 ★" : "EARNED"}</span>}
    </div>
  );
}

export default function Achievements({ onClose }: { onClose: () => void }) {
  const s = useSyncExternalStore(achievements.subscribe, achievements.snapshot, achievements.snapshot);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className="shop options-screen" role="dialog" aria-label="Achievements" onPointerDown={stop} onPointerUp={stop}>
      <ShopBackdrop />
      <header className="shop-head goals-top">
        <button className="shop-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="options-title">ACHIEVEMENTS</h2>
        <span className="shop-pill goals-pill" aria-label={`${s.stars} stars, ${s.badges.length} badges`}>
          <StarIcon size={16} /> {s.stars}
          <BadgeIcon size={18} /> {s.badges.length}
        </span>
      </header>
      <div className="options-list goals">
        <h3 className="goals-head">Today</h3>
        <p className="goals-note">A star for each, every day.</p>
        {GOALS.filter((g) => g.kind === "daily").map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
        <h3 className="goals-head">Badges</h3>
        <p className="goals-note">Yours to keep once earned.</p>
        {GOALS.filter((g) => g.kind === "badge").map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </div>
    </div>
  );
}
