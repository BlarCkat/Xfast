"use client";

import { useSyncExternalStore } from "react";
import { achievements, goalColor, goalIcon, GOALS, STARS_FOR, type Goal, type GoalKind } from "../game/achievements";
import { PowerRing } from "./PowerRing";
import { ShopBackdrop } from "./Store";

// Rings only fill a segment once that fifth of the goal is done, so a full ring always means finished.
// The achievements page: today's goals worth a star each, this week's worth three, and the
// long-term badges. GoalCard is also the card that pops up in a run when a goal is earned.

/** What a finished goal gives, as shown on its row and card. */
function reward(goal: Goal, earnedLabel: string) {
  const stars = STARS_FOR[goal.kind];
  return stars ? `+${stars} STAR${stars > 1 ? "S" : ""}` : earnedLabel;
}

/** Snapshots of the 3D star and medals in AchievementArt; greyed out until earned. */
export function GoalArt({ goal, size, earned = true }: { goal?: Goal; size: number; earned?: boolean }) {
  return <img className={`goal-art${earned ? "" : " goal-art-off"}`} src={goalIcon(goal)} width={size} height={size} alt="" draggable={false} />;
}

/** A goal's ring, title, description and reward. */
function GoalCard({ goal, value, done, earnedLabel = "EARNED" }: { goal: Goal; value: number; done: boolean; earnedLabel?: string }) {
  return (
    <>
      <PowerRing color={goalColor(goal)} size={58} lit={Math.floor((value / goal.target) * 5) / 5} label={`${short(value)}/${short(goal.target)}`} active={done}>
        <GoalArt goal={goal} size={34} earned={done} />
      </PowerRing>
      <div className="goal-text">
        <span className="goal-title">{goal.title}</span>
        <span className="goal-desc">{goal.description}</span>
      </div>
      {done && <span className="goal-check">{reward(goal, earnedLabel)}</span>}
    </>
  );
}

/** 2000 reads as 2k so the pill under the ring stays small. */
const short = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k` : `${n}`);

function GoalRow({ goal }: { goal: Goal }) {
  const s = useSyncExternalStore(achievements.subscribe, achievements.snapshot, achievements.snapshot);
  const done = achievements.earned(goal, s);
  return (
    <div className={`goal${done ? " goal-done" : ""}`}>
      <GoalCard goal={goal} value={achievements.progress(goal, s)} done={done} />
    </div>
  );
}

/**
 * The card that slides down during a run when a goal is earned. The ring fills up one segment at a
 * time to show the goal is complete, then the card slides away and `onDone` brings on the next.
 */
export function EarnedToast({ goal, onDone }: { goal: Goal; onDone: () => void }) {
  return (
    <div
      className="goal earned-toast"
      role="status"
      aria-label={`Achievement: ${goal.title}`}
      onAnimationEnd={(e) => e.target === e.currentTarget && onDone()}
    >
      <GoalCard goal={goal} value={goal.target} done earnedLabel="NEW BADGE" />
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
        {/* Same pills as the store's coins and gems: the count, then the icon in a round badge. */}
        <div className="shop-pill" aria-label={`${s.stars} stars`}>
          <span>{s.stars}</span>
          <span className="shop-pill-coin">
            <GoalArt size={26} />
          </span>
        </div>
        <div className="shop-pill" aria-label={`${s.badges.length} badges`}>
          <span>{s.badges.length}</span>
          <span className="shop-pill-coin">
            <GoalArt goal={GOALS.find((g) => g.kind === "badge")} size={26} />
          </span>
        </div>
      </header>
      <GoalList />
    </div>
  );
}

const SECTIONS: { kind: GoalKind; title: string }[] = [
  { kind: "daily", title: "Today" },
  { kind: "weekly", title: "This week" },
  { kind: "badge", title: "Badges" },
];

/** Today's and this week's goals and the badges, as listed on this page and on the store's Achievements tab. */
export function GoalList() {
  return (
    <div className="options-list goals">
      {SECTIONS.map(({ kind, title }) => (
        <section key={kind} className="goals-section">
          <h3 className="goals-head">{title}</h3>
          {GOALS.filter((g) => g.kind === kind).map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </section>
      ))}
    </div>
  );
}
