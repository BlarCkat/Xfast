"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { POWERUP_DURATION } from "@/game/config";
import { CHARACTERS, STORE_ITEMS, wallet, type CharacterId, type StoreItemId, type WalletState } from "@/game/wallet";
import { Hex, Icon } from "./icons";
import { CharacterModel } from "./models";

type Tab = "characters" | "powerups";

interface Cell {
  id: CharacterId | StoreItemId;
  name: string;
  price: number;
  kind: string;
  description: string;
}

const CHARACTER_BLURB: Record<CharacterId, string> = {
  chicken: "The original road crosser. Fearless, flightless, and very fond of the other side.",
  duck: "Waddles like the chicken, but keeps its cool around water. Mostly.",
  frog: "Built for hopping. Has strong opinions about logs.",
  penguin: "Dressed for a formal event, crossing roads anyway.",
  cat: "Lands on its feet. Usually. Nine times, at least.",
  robot: "Hop module v2. Runs on coins and optimism.",
};

const cellsFor = (tab: Tab): Cell[] =>
  tab === "characters"
    ? CHARACTERS.map((c) => ({ id: c.id, name: c.name, price: c.price, kind: "Character", description: `${c.trait} ${CHARACTER_BLURB[c.id]}` }))
    : STORE_ITEMS.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        kind:
          i.id === "life"
            ? "Extra life"
            : POWERUP_DURATION[i.id] === 0
              ? "Power-up · instant"
              : `Power-up · ${POWERUP_DURATION[i.id]}s`,
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

function action(tab: Tab, cell: Cell, w: WalletState) {
  if (tab === "characters") {
    const id = cell.id as CharacterId;
    if (w.selected === id) return { label: "Equipped", run: null };
    if (w.owned.includes(id)) return { label: "Equip", run: () => wallet.select(id) };
    return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyCharacter(id) : null };
  }
  const id = cell.id as StoreItemId;
  return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyItem(id) : null };
}

export default function Store({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const [tab, setTab] = useState<Tab>("characters");
  const cells = cellsFor(tab);
  const [focus, setFocus] = useState(() => Math.max(0, CHARACTERS.findIndex((c) => c.id === w.selected)));
  const cell = cells[Math.min(focus, cells.length - 1)];
  const act = action(tab, cell, w);
  const selected = CHARACTERS.find((c) => c.id === w.selected)!;

  const switchTab = (next: Tab) => {
    setTab(next);
    setFocus(0);
  };

  // Keyboard: arrows move through the honeycomb, Enter buys or equips, Q/E switch tabs, Esc closes.
  const latest = useRef({ act, cells, tab });
  latest.current = { act, cells, tab };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { act, cells, tab } = latest.current;
      const n = cells.length;
      const moves: Record<string, number> = { ArrowLeft: -2, ArrowRight: 2, ArrowUp: -1, ArrowDown: 1 };
      if (e.code in moves) {
        e.preventDefault();
        setFocus((f) => Math.max(0, Math.min(n - 1, f + moves[e.code])));
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        act.run?.();
      } else if (e.code === "KeyQ" || e.code === "KeyE") {
        switchTab(tab === "characters" ? "powerups" : "characters");
      } else if (e.code === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Cells alternate between the top and bottom rows, so the strip reads left to right as a honeycomb.
  const rows = [cells.filter((_, i) => i % 2 === 0), cells.filter((_, i) => i % 2 === 1)];

  return (
    <div
      className="menu"
      role="dialog"
      aria-label="Store"
      // Keep taps inside the store from moving the chicken underneath.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <header className="menu-head">
        <nav className="crumbs">
          <span className="crumb-root">STORE /</span>
          <button className={tab === "characters" ? "on" : ""} onClick={() => switchTab("characters")}>
            CHARACTERS
          </button>
          <button className={tab === "powerups" ? "on" : ""} onClick={() => switchTab("powerups")}>
            POWER-UPS
          </button>
        </nav>
        <div className="wallet-card">
          <div>
            <span className="wallet-label">COINS</span>
            <span className="wallet-coins">{w.coins}</span>
          </div>
          <Hex tone="teal" size={46}>
            <Icon id={selected.id} size={22} />
          </Hex>
        </div>
      </header>

      <div className="menu-sub">
        <Hex tone="white" size={34}>
          <Icon id={selected.id} size={16} />
        </Hex>
        <div>
          <strong>{selected.name}</strong>
          <small>PLAYING AS</small>
        </div>
      </div>

      <div className="comb" role="listbox" aria-label={tab === "characters" ? "Characters" : "Power-ups"}>
        <div className="comb-inner">
          {rows.map((row, r) => (
            <div key={r} className={`comb-row comb-row-${r}`}>
              {row.map((c) => {
                const i = cells.indexOf(c);
                const isChar = tab === "characters";
                const owned = isChar && w.owned.includes(c.id as CharacterId);
                const equipped = isChar && w.selected === c.id;
                const count = isChar ? 0 : w.inventory[c.id as StoreItemId];
                const affordable = w.coins >= c.price;
                const tone = equipped || count > 0 ? "teal" : owned || affordable ? "white" : "locked";
                const focused = i === focus;
                const showProgress = !owned && !equipped && !affordable;
                return (
                  <button
                    key={c.id}
                    ref={focused ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }) : undefined}
                    role="option"
                    aria-selected={focused}
                    aria-label={c.name}
                    className={`comb-cell ${focused ? "focused" : ""}`}
                    onClick={() => (focused ? act.run?.() : setFocus(i))}
                  >
                    {focused && showProgress && (
                      <span className="cell-progress">
                        {w.coins} / {c.price}
                      </span>
                    )}
                    {count > 0 && <span className="cell-badge">{count}</span>}
                    <Hex
                      tone={tone}
                      size={focused ? 112 : 96}
                      outline={focused}
                      ring={showProgress ? w.coins / c.price : undefined}
                    >
                      <Icon id={c.id} size={focused ? 40 : 34} />
                    </Hex>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <section className="menu-details" aria-live="polite">
        <div className="menu-rule">
          <span style={{ left: `${(focus / Math.max(1, cells.length - 1)) * 80}%` }} />
        </div>
        {tab === "characters" && <Preview id={cell.id as CharacterId} />}
        <h2>{cell.name}</h2>
        <p className="menu-kind">{cell.kind.toUpperCase()}</p>
        <p className="menu-desc">{cell.description}</p>
      </section>

      <footer className="menu-hints">
        <button onClick={() => switchTab(tab === "characters" ? "powerups" : "characters")}>
          <kbd>Q</kbd> {tab === "characters" ? "Power-ups" : "Characters"}
        </button>
        <button className="primary" disabled={!act.run} onClick={() => act.run?.()}>
          <kbd>↵</kbd> {act.label}
        </button>
        <button onClick={onClose}>
          Back <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
