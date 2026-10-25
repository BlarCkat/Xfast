"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_LEVEL, isInstant, strengthAt, upgradeCost, type PowerUp } from "@/game/powerups";
import { CHARACTERS, STORE_ITEMS, wallet, type CharacterId, type StoreItemId, type WalletState } from "@/game/wallet";
import { Icon } from "./icons";
import { CharacterModel } from "./models";

export type StoreTab = "characters" | "powerups";

interface Cell {
  id: CharacterId | StoreItemId;
  name: string;
  price: number;
  kind: string;
  description: string;
}

const CHARACTER_BLURB: Record<CharacterId, string> = {
  chicken: "The original road crosser. Fearless, flightless, and very fond of the other side.",
  duck: "Never wastes a good find, and treats every river as a shortcut to the seabed.",
  frog: "Built for hopping. Has strong opinions about logs.",
  penguin: "Dressed for a formal event, crossing roads anyway.",
  cat: "Lands on its feet. Usually. Nine times, at least.",
  sparrow: "Small, quick, and somehow on first-name terms with time itself.",
  snail: "Takes its time. Occasionally takes everyone else's too.",
  robot: "Hop module v2. Runs on coins and optimism.",
  mario: "Has crossed worse. Mostly pipes, lava and the occasional castle.",
  luigi: "Jumps a little higher, worries a lot more.",
  bowser: "King of the Koopas. Does not wait for the green man.",
};

const cellsFor = (tab: StoreTab, w: WalletState): Cell[] =>
  tab === "characters"
    ? CHARACTERS.map((c) => ({ id: c.id, name: c.name, price: c.price, kind: "Character", description: `${c.trait} ${CHARACTER_BLURB[c.id]}` }))
    : STORE_ITEMS.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        kind:
          i.id === "life"
            ? "Extra life"
            : `${isInstant(i.id) ? "Instant" : "Power-up"} · Level ${w.levels[i.id]}/${MAX_LEVEL} · ${strengthAt(i.id, w.levels[i.id])}`,
        description: i.description,
      }));

function Spinner({ id }: { id: CharacterId }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.2;
  });
  return (
    <group ref={ref} position={[0, -0.55, 0]}>
      <CharacterModel id={id} />
    </group>
  );
}

function Preview({ id }: { id: CharacterId }) {
  return (
    <div className="menu-preview">
      <Canvas orthographic camera={{ position: [0, 1.2, 3], zoom: 80 }}>
        <hemisphereLight args={["#ffffff", "#9fc3e8", 1.8]} />
        <directionalLight position={[-2, 4, 3]} intensity={1.6} />
        <Spinner id={id} />
      </Canvas>
    </div>
  );
}

export function useWallet() {
  return useSyncExternalStore(wallet.subscribe, wallet.get, wallet.get);
}

function action(tab: StoreTab, cell: Cell, w: WalletState) {
  if (tab === "characters") {
    const id = cell.id as CharacterId;
    if (w.selected === id) return { label: "Equipped", run: null };
    if (w.owned.includes(id)) return { label: "Equip", run: () => wallet.select(id) };
    return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyCharacter(id) : null };
  }
  const id = cell.id as StoreItemId;
  return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyItem(id) : null };
}

/** Upgrading a power-up: longer duration, or more rows for the instant ones. */
function upgradeAction(tab: StoreTab, cell: Cell, w: WalletState) {
  if (tab !== "powerups" || cell.id === "life") return null;
  const id = cell.id as PowerUp;
  const level = w.levels[id];
  if (level >= MAX_LEVEL) return { label: "Max level", run: null, next: null };
  const cost = upgradeCost(id, level);
  return {
    label: `Upgrade · ${cost}`,
    next: strengthAt(id, level + 1),
    run: w.coins >= cost ? () => wallet.upgrade(id) : null,
  };
}

export default function Store({ onClose, initialTab = "characters" }: { onClose: () => void; initialTab?: StoreTab }) {
  const w = useWallet();
  const [tab, setTab] = useState<StoreTab>(initialTab);
  const cells = cellsFor(tab, w);
  const [focus, setFocus] = useState(() =>
    tab === "characters" ? Math.max(0, CHARACTERS.findIndex((c) => c.id === w.selected)) : 0,
  );
  const cell = cells[Math.min(focus, cells.length - 1)];
  const act = action(tab, cell, w);
  const up = upgradeAction(tab, cell, w);

  const switchTab = (next: StoreTab) => {
    setTab(next);
    setFocus(0);
  };

  // Keyboard: arrows move through the grid, Enter buys or equips, Q/E switch tabs, Esc closes.
  const latest = useRef({ act, up, cells, tab });
  latest.current = { act, up, cells, tab };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { act, up, cells, tab } = latest.current;
      const n = cells.length;
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -GRID_COLS, ArrowDown: GRID_COLS };
      if (e.code in moves) {
        e.preventDefault();
        setFocus((f) => Math.max(0, Math.min(n - 1, f + moves[e.code])));
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        act.run?.();
      } else if (e.code === "KeyU") {
        up?.run?.();
      } else if (e.code === "KeyQ" || e.code === "KeyE") {
        switchTab(tab === "characters" ? "powerups" : "characters");
      } else if (e.code === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isChar = tab === "characters";
  const owned = isChar && w.owned.includes(cell.id as CharacterId);
  // The pips under the card: upgrade level for power-ups, savings toward the price for anything locked.
  const level = !isChar && cell.id !== "life" ? w.levels[cell.id as PowerUp] : 0;
  const filled = owned ? PIPS : level ? Math.round((level / MAX_LEVEL) * PIPS) : Math.min(PIPS, Math.floor((w.coins / cell.price) * PIPS));

  return (
    <div
      className="shop"
      role="dialog"
      aria-label="Store"
      // Keep taps inside the store from moving the chicken underneath.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <ShopBackdrop />

      <header className="shop-head">
        <button className="shop-back" onClick={onClose} aria-label="Back">
          <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
            <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <nav className="shop-tabs">
          <button className={isChar ? "on" : ""} onClick={() => switchTab("characters")}>
            CHARACTERS
          </button>
          <button className={!isChar ? "on" : ""} onClick={() => switchTab("powerups")}>
            POWER-UPS
          </button>
        </nav>
        <div className="shop-pill" aria-label={`${w.coins} coins`}>
          <span>{w.coins}</span>
          <span className="shop-pill-coin">
            <Icon id="coin" size={16} />
          </span>
        </div>
      </header>

      {/* The selected item's card stays pinned while the grid scrolls up under it. */}
      <div className="shop-pin">
        <section className="shop-card" aria-live="polite">
          <CardFrame />
          <h2 className="shop-card-title">{cell.name.toUpperCase()}</h2>
          <div className="shop-card-body">
            {isChar ? (
              <Preview id={cell.id as CharacterId} />
            ) : (
              <span className="shop-card-icon">
                <Icon id={cell.id} size={64} />
              </span>
            )}
            <p className="shop-card-kind">{cell.kind}</p>
            <p className="shop-card-desc">
              {cell.description}
              {up?.next && ` Next level: ${up.next}.`}
            </p>
            <button className="shop-card-buy" disabled={!act.run} onClick={() => act.run?.()}>
              {act.label}
            </button>
          </div>
          {up?.run && (
            <button className="shop-card-up" onClick={() => up.run?.()} aria-label={up.label} title={up.label} />
          )}
        </section>

        <div className="shop-pips" aria-hidden="true">
          {Array.from({ length: PIPS }, (_, i) => (
            <span key={i} className={i < filled ? "full" : i === filled ? "next" : ""} />
          ))}
        </div>
      </div>

      <div className="shop-grid" role="listbox" aria-label={isChar ? "Characters" : "Power-ups"}>
        {cells.map((c, i) => {
          const mine = isChar && w.owned.includes(c.id as CharacterId);
          const equipped = isChar && w.selected === c.id;
          const count = isChar ? 0 : w.inventory[c.id as StoreItemId];
          const locked = !mine && w.coins < c.price;
          const focused = i === focus;
          return (
            <button
              key={c.id}
              ref={focused ? (el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" }) : undefined}
              role="option"
              aria-selected={focused}
              aria-label={c.name}
              className={`shop-tile${focused ? " on" : ""}${locked ? " locked" : ""}${equipped ? " equipped" : ""}`}
              onClick={() => (focused ? act.run?.() : setFocus(i))}
            >
              {isChar && CHARACTER_ART[c.id as CharacterId] ? (
                <img className="shop-tile-art" src={CHARACTER_ART[c.id as CharacterId]} alt="" draggable={false} />
              ) : (
                <Icon id={c.id} size={34} />
              )}
              {count > 0 && <span className="shop-tile-badge">{count}</span>}
              <span className="shop-tile-price">{mine ? (equipped ? "ON" : "OWNED") : c.price}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const GRID_COLS = 3;
/** Illustrated portraits that replace the glyph on a character's tile. */
const CHARACTER_ART: Partial<Record<CharacterId, string>> = {
  chicken: "/characters/chicken.png",
};
const PIPS = 7;

/** The purple backdrop with its darker diagonal bands and thin swirl lines. */
function ShopBackdrop() {
  return (
    <svg className="shop-backdrop" viewBox="0 0 393 852" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="393" height="852" fill="#7048e8" />
      <path d="M-40 250 C 120 300 260 330 440 420 L 440 520 C 260 430 120 400 -40 350 Z" fill="#5f3bd6" />
      <path d="M120 -20 C 180 60 300 110 440 120 L 440 40 C 320 30 230 0 200 -20 Z" fill="#5f3bd6" />
      <path d="M-40 560 C 100 620 260 640 440 610 L 440 680 C 260 720 100 700 -40 640 Z" fill="#6440dc" />
      <path d="M-40 140 C 60 120 160 160 230 240" fill="none" stroke="#5a37cc" strokeWidth="2" />
      <path d="M-40 660 C 80 650 200 690 300 760 S 420 820 440 800" fill="none" stroke="#5a37cc" strokeWidth="2" />
      <circle cx="392" cy="98" r="18" fill="#5f3bd6" />
      <circle cx="340" cy="628" r="18" fill="#5f3bd6" />
    </svg>
  );
}

/** The card from the mockup: cream torn-paper frame, a sweeping shine, dark notched panel and teal title banner. */
function CardFrame() {
  const paper =
    "M255.024 0L20.3935 7.56873V64.5445L8.61995 55.7143L18.9218 265.957L0 289.714L22.7062 301.488L15.558 312L245.353 302.119L255.024 25.0189L245.353 14.717L255.024 0Z";
  return (
    <svg className="shop-card-frame" viewBox="0 0 256 312" fill="none" aria-hidden="true">
      <path d={paper} fill="#F3EED1" />
      <mask id="shop-card-paper" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="312">
        <path d={paper} fill="#F3EED1" />
      </mask>
      <g mask="url(#shop-card-paper)">
        <g className="shop-card-shine">
          <rect x="-24.9609" y="52.293" width="350.672" height="43.31" transform="rotate(18.5736 -24.9609 52.293)" fill="#F2E38C" />
        </g>
      </g>
      <path d="M237.575 20.6055H35.7425L24.5996 290.557L192.163 294.131L231.689 260.913L237.575 20.6055Z" fill="#212139" />
      <path
        d="M170.717 106.384C168.531 109.075 80.1028 99.9363 36.1621 95.0306L38.8953 23.3379H234.631L232.739 95.0306H181.44C178.777 97.6937 172.904 103.693 170.717 106.384Z"
        fill="#2DDED3"
      />
    </svg>
  );
}
