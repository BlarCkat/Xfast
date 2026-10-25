"use client";

import { useSyncExternalStore } from "react";
import { achievements, GOALS, type Goal } from "../game/achievements";
import { PowerRing } from "./PowerRing";
import { ShopBackdrop } from "./Store";

// The achievements page: today's milestones, each worth a star, and the long-term badges.

const GOLD = "#f4c542";
const BADGE_COLORS: Record<string, string> = { worldTour: "#2ee6c9", collector: "#ff6fb1" };

/** Snapshots of the 3D star and medals in AchievementArt; greyed out until earned. */
export function GoalArt({ goal, size, earned = true }: { goal?: Goal; size: number; earned?: boolean }) {
  const src = !goal || goal.kind === "daily" ? "/achievements/star.png" : `/achievements/medal-${goal.id}.png`;
  return <img className={`goal-art${earned ? "" : " goal-art-off"}`} src={src} width={size} height={size} alt="" draggable={false} />;
}

function GoalRow({ goal }: { goal: Goal }) {
  const s = useSyncExternalStore(achievements.subscribe, achievements.snapshot, achievements.snapshot);
  const value = achievements.progress(goal, s);
  const done = achievements.earned(goal, s);
  const color = goal.kind === "daily" ? GOLD : BADGE_COLORS[goal.id] ?? GOLD;
  return (
    <div className={`goal${done ? " goal-done" : ""}`}>
      <PowerRing color={color} size={58} lit={value / goal.target} label={`${value}/${goal.target}`} active={done}>
        <GoalArt goal={goal} size={34} earned={done} />
      </PowerRing>
      <div className="goal-text">
        <span className="goal-title">{goal.title}</span>
        <span className="goal-desc">{goal.description}</span>
      </div>
      {done && <span className="goal-check">{goal.kind === "daily" ? "+1 STAR" : "EARNED"}</span>}
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
          <GoalArt size={22} /> {s.stars}
          <GoalArt goal={GOALS.find((g) => g.kind === "badge")} size={22} /> {s.badges.length}
        </span>
      </header>
      <GoalList />
    </div>
  );
}

/** Today's goals and the badges, as listed on this page and on the store's Achievements tab. */
export function GoalList() {
  return (
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
  );
}
