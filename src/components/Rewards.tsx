"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CHEST_KINDS, CHESTS, chests, type ChestKind, type StarChestKind } from "@/game/chests";
import { activeEvent, dayLabel, events, type ActiveEvent } from "@/game/events";
import { EventIcon } from "./EventArt";
import { ChestOpening, ChestStage } from "./ChestOpening";
import { Icon } from "./icons";
import { ShopBackdrop, useWallet } from "./Store";

// The Rewards screen: the three chests, how close each one is from today's, this week's and this
// month's stars, and how many are waiting. Opening one plays the sequence in ChestOpening.

export function useChests() {
  return useSyncExternalStore(chests.subscribe, chests.snapshot, chests.snapshot);
}

export function useEvents() {
  return useSyncExternalStore(events.subscribe, events.snapshot, events.serverSnapshot);
}

function ChestCard({ kind, onOpen }: { kind: StarChestKind; onOpen: () => void }) {
  const c = useChests();
  const info = CHESTS[kind];
  const { have, need } = chests.progress(kind, c);
  const count = c.owned[kind];
  return (
    <div className={`chest-card chest-${kind}${count ? " ready" : ""}`}>
      <div className="chest-card-art">
        <ChestStage kind={kind} zoom={62} />
      </div>
      <div className="chest-card-text">
        <span className="goal-title">{info.name}</span>
        <span className="goal-desc">
          {info.period} · one for every {info.stars} stars earned {info.scope}
        </span>
        <div className="chest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={have}>
          <span style={{ width: `${(have / need) * 100}%` }} />
          <em>
            {have}/{need} ★
          </em>
        </div>
      </div>
      <button className="chest-card-open" disabled={!count} onClick={onOpen}>
        {count ? `OPEN ×${count}` : "LOCKED"}
      </button>
    </div>
  );
}

/** The running holiday event: items collected toward its chest, and claiming or opening it. */
function EventCard({ event, onOpen }: { event: ActiveEvent; onOpen: () => void }) {
  const c = useChests();
  const s = useEvents();
  const { info } = event;
  const { items, claimed } = events.progress(event, s);
  const have = Math.min(items, info.target);
  const owned = c.owned[info.id];
  const claimable = events.claimable(s);
  const button = owned
    ? `OPEN ×${owned}`
    : claimable
      ? "CLAIM"
      : claimed
        ? "CLAIMED"
        : event.phase === "collect" && have >= info.target
          ? dayLabel(info.reward)
          : "LOCKED";
  const desc =
    event.phase === "collect"
      ? `Collect ${info.target} ${info.items} from ${dayLabel(info.start)}. The chest opens on ${dayLabel(info.reward)}!`
      : `${info.name} is here! Claim it until ${dayLabel(info.end)}.`;
  const act = () => {
    if (!owned && !events.claim()) return;
    onOpen();
  };
  return (
    <div className={`chest-card chest-event${owned || claimable ? " ready" : ""}`}>
      <div className="chest-card-art">
        <ChestStage kind={info.id} zoom={62} />
      </div>
      <div className="chest-card-text">
        <span className="goal-title">{info.chestName}</span>
        <span className="goal-desc">{desc}</span>
        <div className="chest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={info.target} aria-valuenow={have}>
          <span style={{ width: `${(have / info.target) * 100}%` }} />
          <em>
            {have}/{info.target} <EventIcon id={info.id} size={15} />
          </em>
        </div>
      </div>
      <button className="chest-card-open" disabled={!owned && !claimable} onClick={act}>
        {button}
      </button>
    </div>
  );
}

export default function Rewards({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const c = useChests();
  const [opening, setOpening] = useState<ChestKind | null>(null);
  /** Counts "open another" presses, to start the sequence afresh. */
  const [run, setRun] = useState(0);
  const event = activeEvent();
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      if (opening) setOpening(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opening, onClose]);
  return (
    <div className="shop options-screen" role="dialog" aria-label="Rewards" onPointerDown={stop} onPointerUp={stop}>
      <ShopBackdrop />
      <header className="shop-head goals-top">
        <button className="shop-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="options-title">REWARDS</h2>
        <div className="shop-pill" aria-label={`${w.coins} coins`}>
          <span>{w.coins}</span>
          <span className="shop-pill-coin">
            <Icon id="coin" size={24} />
          </span>
        </div>
        <div className="shop-pill" aria-label={`${w.gems} gems`}>
          <span>{w.gems}</span>
          <span className="shop-pill-coin">
            <Icon id="gem" size={24} />
          </span>
        </div>
      </header>
      <div className="options-list chests">
        {event && <EventCard event={event} onOpen={() => setOpening(event.info.id)} />}
        {CHEST_KINDS.map((kind) => (
          <ChestCard key={kind} kind={kind} onOpen={() => setOpening(kind)} />
        ))}
        <p className="chest-note">Chests also turn up on the road now and then. Hop on one to keep it.</p>
      </div>
      {opening && (
        <ChestOpening
          key={`${opening}-${run}`}
          kind={opening}
          onDone={() => setOpening(null)}
          onAgain={c.owned[opening] > 0 ? () => setRun((n) => n + 1) : undefined}
          againLabel={`OPEN ANOTHER (${c.owned[opening]})`}
        />
      )}
    </div>
  );
}
