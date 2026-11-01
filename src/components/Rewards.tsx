"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { CHEST_KINDS, CHESTS, chests, type ChestKind, type Loot, type StarChestKind } from "@/game/chests";
import { activeEvent, dayLabel, events, type ActiveEvent } from "@/game/events";
import { EventIcon } from "./EventArt";
import { POWERUPS } from "@/game/powerups";
import { CHARACTERS, UPGRADES_PER_LEVEL, wallet } from "@/game/wallet";
import * as sound from "@/game/sound";
import { ChestArt } from "./ChestArt";
import { Icon } from "./icons";
import { ShopBackdrop, useWallet } from "./Store";

// The Rewards screen: the three chests, how close each one is from today's, this week's and this
// month's stars, and how many are waiting. Opening one rattles it, throws the lid back and lists
// what was inside.

export function useChests() {
  return useSyncExternalStore(chests.subscribe, chests.snapshot, chests.snapshot);
}

export function useEvents() {
  return useSyncExternalStore(events.subscribe, events.snapshot, events.serverSnapshot);
}

function Sway({ children, spin }: { children: React.ReactNode; spin: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = spin ? -0.5 + Math.sin(clock.elapsedTime * 0.9) * 0.35 : -0.35;
  });
  return <group ref={ref}>{children}</group>;
}

/** A chest in its own little scene, seen from a little above and to the front. */
function ChestStage({ kind, zoom, open = false, shaking = false, spin = true }: { kind: ChestKind; zoom: number; open?: boolean; shaking?: boolean; spin?: boolean }) {
  return (
    <Canvas orthographic camera={{ position: [0, 1.4, 3], zoom }} onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}>
      <hemisphereLight args={["#ffffff", "#9fc3e8", 1.8]} />
      <directionalLight position={[-2, 4, 3]} intensity={1.6} />
      <Sway spin={spin}>
        <ChestArt kind={kind} open={open} shaking={shaking} />
      </Sway>
    </Canvas>
  );
}

const charName = (id: string) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
const powerName = (id: string) => {
  const label = POWERUPS.find((p) => p.key === id)?.label ?? id;
  return label.charAt(0) + label.slice(1).toLowerCase();
};

/** One line of loot as shown when a chest opens. */
function LootLine({ loot, i }: { loot: Loot & { times?: number }; i: number }) {
  const style = { "--i": i } as React.CSSProperties;
  switch (loot.kind) {
    case "coins":
    case "gems":
      return (
        <li style={style}>
          <Icon id={loot.kind === "coins" ? "coin" : "gem"} size={26} />
          <span>
            +{loot.amount} {loot.kind}
          </span>
        </li>
      );
    case "upgrade":
      return (
        <li style={style}>
          <Icon id={loot.character} size={26} />
          <span>
            {charName(loot.character)} upgrade
            {loot.levelUp
              ? `: level ${wallet.tierOf(loot.character)}!`
              : ` (${wallet.upgradesOf(loot.character)}/${UPGRADES_PER_LEVEL} to next level)`}
          </span>
        </li>
      );
    case "level":
      return (
        <li style={style} className="loot-big">
          <Icon id={loot.character} size={26} />
          <span>
            {charName(loot.character)} up to level {loot.level}!
          </span>
        </li>
      );
    case "powerup":
      return (
        <li style={style}>
          <Icon id={loot.powerup} size={26} />
          <span>
            {powerName(loot.powerup)} upgrade{loot.times ? ` ×${loot.times}` : ""}
          </span>
        </li>
      );
  }
}

/** Stacks repeated power-up upgrades into one line each, so a Mega chest's list stays short. */
function group(loot: Loot[]): (Loot & { times?: number })[] {
  const out: (Loot & { times?: number })[] = [];
  for (const l of loot) {
    const same = l.kind === "powerup" ? out.find((o) => o.kind === "powerup" && o.powerup === l.powerup) : undefined;
    if (same) same.times = (same.times ?? 1) + 1;
    else out.push({ ...l });
  }
  return out;
}

const SHAKE_MS = 900;

/** The full-screen moment of opening a chest. */
function Opening({ kind, onClose }: { kind: ChestKind; onClose: () => void }) {
  const c = useChests();
  const [run, setRun] = useState(0);
  const [loot, setLoot] = useState<Loot[] | null>(null);
  useEffect(() => {
    setLoot(null);
    const t = setTimeout(() => {
      setLoot(chests.open(kind));
      sound.upgrade();
    }, SHAKE_MS);
    return () => clearTimeout(t);
  }, [kind, run]);
  const left = c.owned[kind];
  return (
    <div className="chest-open" role="dialog" aria-label={`Opening a ${CHESTS[kind].name}`}>
      <h2 className="chest-open-title">{CHESTS[kind].name.toUpperCase()}</h2>
      <div className="chest-open-stage">
        <ChestStage kind={kind} zoom={150} open={!!loot} shaking={!loot} spin={false} />
      </div>
      {loot && (
        <>
          <ul className="chest-loot">
            {group(loot).map((l, i) => (
              <LootLine key={`${run}-${i}`} loot={l} i={i} />
            ))}
          </ul>
          <div className="chest-open-actions">
            {left > 0 && (
              <button className="chest-again" onClick={() => setRun((n) => n + 1)}>
                OPEN ANOTHER ({left})
              </button>
            )}
            <button className="chest-collect" onClick={onClose}>
              COLLECT
            </button>
          </div>
        </>
      )}
    </div>
  );
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
  const [opening, setOpening] = useState<ChestKind | null>(null);
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
      {opening && <Opening kind={opening} onClose={() => setOpening(null)} />}
    </div>
  );
}
