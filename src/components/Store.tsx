"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { MAX_LEVEL, isInstant, strengthAt, upgradeCost, type PowerUp } from "@/game/powerups";
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

const cellsFor = (tab: Tab, w: WalletState): Cell[] =>
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

/** Upgrading a power-up: longer duration, or more rows for the instant ones. */
function upgradeAction(tab: Tab, cell: Cell, w: WalletState) {
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

export default function Store({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const [tab, setTab] = useState<Tab>("characters");
  const cells = cellsFor(tab, w);
  const [focus, setFocus] = useState(() => Math.max(0, CHARACTERS.findIndex((c) => c.id === w.selected)));
  const cell = cells[Math.min(focus, cells.length - 1)];
  const act = action(tab, cell, w);
  const up = upgradeAction(tab, cell, w);
  const selected = CHARACTERS.find((c) => c.id === w.selected)!;

  const switchTab = (next: Tab) => {
    setTab(next);
    setFocus(0);
  };

  // Keyboard: arrows move through the honeycomb, Enter buys or equips, Q/E switch tabs, Esc closes.
  const latest = useRef({ act, up, cells, tab });
  latest.current = { act, up, cells, tab };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { act, up, cells, tab } = latest.current;
      const n = cells.length;
      const moves: Record<string, number> = { ArrowLeft: -2, ArrowRight: 2, ArrowUp: -1, ArrowDown: 1 };
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
                const level = isChar || c.id === "life" ? 0 : w.levels[c.id as PowerUp];
                return (
                  <button
                    key={c.id}
                    ref={focused ? (el) => el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }) : undefined}
                    role="option"
                    aria-selected={focused}
                    aria-label={c.name}
                    className={`comb-cell ${focused ? "focused" : ""} ${focused && tone !== "locked" ? "bounce" : ""}`}
                    onClick={() => (focused ? act.run?.() : setFocus(i))}
                  >
                    {focused && showProgress && (
                      <span className="cell-progress">
                        {w.coins} / {c.price}
                      </span>
                    )}
                    {count > 0 && <span className="cell-badge">{count}</span>}
                    {level > 1 && <span className="cell-level">Lv{level}</span>}
                    <Hex
                      tone={tone}
                      size={96}
                      outline={focused}
                      ring={showProgress ? w.coins / c.price : level > 1 ? level / MAX_LEVEL : undefined}
                      ringColor={showProgress ? undefined : "var(--ui-gold)"}
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
        <p className="menu-desc">
          {cell.description}
          {up?.next && ` Next level: ${up.next}.`}
        </p>
      </section>

      <footer className="menu-hints">
        <button onClick={() => switchTab(tab === "characters" ? "powerups" : "characters")}>
          <kbd>Q</kbd> {tab === "characters" ? "Power-ups" : "Characters"}
        </button>
        <button className="primary" disabled={!act.run} onClick={() => act.run?.()}>
          <kbd>↵</kbd> {act.label}
        </button>
        {up && (
          <button disabled={!up.run} onClick={() => up.run?.()}>
            <kbd>U</kbd> {up.label}
          </button>
        )}
        <button onClick={onClose}>
          Back <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
