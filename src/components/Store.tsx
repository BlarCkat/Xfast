"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { TIER_SIZE, isInstant, nextUpgrade, strengthAt, tierOf, type PowerUp } from "@/game/powerups";
import { CHARACTER_TIERS, CHARACTER_TIER_COST, nextPerk, traitText } from "@/game/characters";
import { CHARACTERS, STORE_ITEMS, wallet, type CharacterId, type StoreItemId, type WalletState } from "@/game/wallet";
import { Icon } from "./icons";
import { CharacterModel } from "./models";
import { CurrencyHeap } from "./CurrencyArt";
import { ART_POWERUPS } from "./PowerupArt";
import * as sound from "@/game/sound";
import { GoalList } from "./Achievements";

export type StoreTab = "characters" | "powerups" | "bank" | "achievements";
const TABS: { id: StoreTab; label: string }[] = [
  { id: "characters", label: "CHARACTERS" },
  { id: "powerups", label: "POWER-UPS" },
  { id: "bank", label: "BANK" },
  { id: "achievements", label: "ACHIEVEMENTS" },
];

// Coin and gem packs. Payments aren't wired up yet, so they can't be bought.
type PackId = `${"coins" | "gems"}-${number}`;
const PACKS = (["coins", "gems"] as const).flatMap((kind) =>
  [10, 50, 100, 1000].map((amount) => ({ id: `${kind}-${amount}` as PackId, kind, amount })),
);
const packOf = (id: Cell["id"]) => PACKS.find((p) => p.id === id);

interface Cell {
  id: CharacterId | StoreItemId | PackId;
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
  human: "Finally, someone who knows what the green man means. Still ignores him.",
  leopard: "Spots an opening, then a few more. Never changes them.",
  owl: "Wise enough to look both ways. Can turn its head far enough to do it at once.",
};

const cellsFor = (tab: StoreTab, w: WalletState): Cell[] =>
  tab === "bank"
    ? PACKS.map((p) => ({
        id: p.id,
        name: `${p.amount} ${p.kind}`,
        price: 0,
        kind: p.kind === "coins" ? "Coin pack" : "Gem pack",
        description: `Adds ${p.amount} ${p.kind} to your wallet.`,
      }))
    : tab === "characters"
    ? CHARACTERS.map((c) => {
        const tier = wallet.tierOf(c.id);
        return {
          id: c.id,
          name: c.name,
          price: c.price,
          kind: w.owned.includes(c.id) ? `Character · Tier ${tier}` : "Character",
          description: `${traitText(c.id, tier)} ${CHARACTER_BLURB[c.id]}`,
        };
      })
    : STORE_ITEMS.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        kind:
          i.id === "life"
            ? "Extra life"
            : `${isInstant(i.id) ? "Instant" : "Power-up"} · Tier ${tierOf(w.upgrades[i.id]).tier} · ${strengthAt(i.id, w.upgrades[i.id])}`,
        description: i.description,
      }));

function Spinner({ y, children }: { y: number; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.2;
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      {children}
    </group>
  );
}

/** A slowly turning model on the card: a character, an illustrated power-up or a currency pack. */
function Preview({ id, zoom = 72 }: { id: Cell["id"]; zoom?: number }) {
  const art = ART_POWERUPS[id as PowerUp];
  const pack = packOf(id);
  return (
    <div className="menu-preview">
      {/* Keyed by zoom: the camera only takes its zoom when the canvas is created. */}
      <Canvas key={zoom} orthographic camera={{ position: [0, 1.2, 3], zoom }}>
        <hemisphereLight args={["#ffffff", "#9fc3e8", 1.8]} />
        <directionalLight position={[-2, 4, 3]} intensity={1.6} />
        {pack ? (
          <Spinner y={0.25}>
            <CurrencyHeap kind={pack.kind} amount={pack.amount} />
          </Spinner>
        ) : art ? (
          <Spinner y={0.25}>{art()}</Spinner>
        ) : (
          <Spinner y={-0.7}>
            <CharacterModel id={id as CharacterId} />
          </Spinner>
        )}
      </Canvas>
    </div>
  );
}

const hasPreview = (id: Cell["id"]) => CHARACTERS.some((c) => c.id === id) || !!ART_POWERUPS[id as PowerUp] || !!packOf(id);

export function useWallet() {
  return useSyncExternalStore(wallet.subscribe, wallet.get, wallet.get);
}

function action(tab: StoreTab, cell: Cell, w: WalletState) {
  if (tab === "bank") return { label: "Coming soon", run: null };
  if (tab === "characters") {
    const id = cell.id as CharacterId;
    if (w.selected === id) return { label: "Equipped", run: null };
    if (w.owned.includes(id)) return { label: "Equip", run: () => wallet.select(id) };
    return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyCharacter(id) : null };
  }
  const id = cell.id as StoreItemId;
  return { label: `Buy · ${cell.price}`, run: w.coins >= cell.price ? () => wallet.buyItem(id) : null };
}

/** Tier colours, shared by the boxes under the card and the upgrade sweep: lime, light red, gold, sky, violet. */
const TIER_COLORS = ["#b4e33d", "#f2867a", "#f4c542", "#5bc0eb", "#c77dff"];

/**
 * Upgrading a power-up (longer duration, or more rows for the instant ones), or stepping an owned
 * character up a tier, which strengthens its trait.
 */
function upgradeAction(tab: StoreTab, cell: Cell, w: WalletState) {
  if (tab === "characters") {
    const id = cell.id as CharacterId;
    if (!w.owned.includes(id)) return null;
    const tier = wallet.tierOf(id);
    if (tier >= CHARACTER_TIERS) return { label: "Max tier", run: null, next: null };
    const cost = CHARACTER_TIER_COST[tier];
    return {
      label: `Tier ${tier + 1} · ${cost}`,
      next: `Tier ${tier + 1}: ${nextPerk(id, tier)}`,
      run: w.coins >= cost ? () => wallet.upgradeCharacter(id) : null,
    };
  }
  if (tab !== "powerups" || cell.id === "life") return null;
  const id = cell.id as PowerUp;
  const done = w.upgrades[id];
  const step = nextUpgrade(done);
  if (!step) return { label: "Max level", run: null, next: null };
  return {
    label: step.kind === "tier" ? `Tier ${step.tier} · ${step.cost}` : `Upgrade · ${step.cost}`,
    next: `Next level: ${strengthAt(id, done + 1)}`,
    run: w.coins >= step.cost ? () => wallet.upgrade(id) : null,
  };
}

export default function Store({ onClose, initialTab = "characters" }: { onClose: () => void; initialTab?: StoreTab }) {
  const w = useWallet();
  const [tab, setTab] = useState<StoreTab>(initialTab);
  const goals = tab === "achievements";
  // The achievements tab has no card or grid; the power-ups stand in so the hooks below stay simple.
  const cells = cellsFor(goals ? "powerups" : tab, w);
  const shop = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const size = useCardSize();

  // Tiles fade out as they scroll up under the pinned card, rather than showing round its edges.
  const fadeTiles = useCallback(() => {
    const top = pin.current?.getBoundingClientRect().bottom;
    if (top === undefined || !grid.current) return;
    for (const tile of Array.from(grid.current.children) as HTMLElement[]) {
      // Side by side on wide screens, nothing scrolls under the card.
      if (size.wide) {
        tile.style.opacity = "";
        continue;
      }
      const r = tile.getBoundingClientRect();
      const fade = r.height * 0.35;
      tile.style.opacity = String(Math.max(0, Math.min(1, (r.top - (top - fade)) / (fade + 12))));
    }
  }, [size.wide]);
  useLayoutEffect(fadeTiles, [fadeTiles, tab, size]);
  const [focus, setFocus] = useState(() =>
    tab === "characters" ? Math.max(0, CHARACTERS.findIndex((c) => c.id === w.selected)) : 0,
  );
  const cell = cells[Math.min(focus, cells.length - 1)];
  const act = action(tab, cell, w);
  const up = upgradeAction(tab, cell, w);
  // An upgrade turns the card the new tier's colour and sweeps a dot grid up it three times, with a ticking sound.
  const [boosting, setBoosting] = useState(0);
  const boostTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const doUpgrade = up?.run
    ? () => {
        up.run!();
        sound.upgrade();
        setBoosting((n) => n + 1);
        clearTimeout(boostTimer.current);
        boostTimer.current = setTimeout(() => setBoosting(0), 3 * sound.UPGRADE_SWEEP * 1000 + 250);
      }
    : null;
  useEffect(() => () => clearTimeout(boostTimer.current), []);

  const switchTab = (next: StoreTab) => {
    setTab(next);
    setFocus(0);
  };

  // Keyboard: arrows move through the grid, Enter buys or equips, Q/E switch tabs, Esc closes.
  const latest = useRef({ act, doUpgrade, cells, tab });
  latest.current = { act, doUpgrade, cells, tab };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { act, doUpgrade, cells, tab } = latest.current;
      const n = cells.length;
      // The grid has more columns on wide screens; read how many it has now.
      const cols = grid.current
        ? getComputedStyle(grid.current).gridTemplateColumns.split(" ").filter(Boolean).length || GRID_COLS
        : GRID_COLS;
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
      if (e.code in moves) {
        e.preventDefault();
        setFocus((f) => Math.max(0, Math.min(n - 1, f + moves[e.code])));
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        act.run?.();
      } else if (e.code === "KeyU") {
        doUpgrade?.();
      } else if (e.code === "KeyQ" || e.code === "KeyE") {
        const i = TABS.findIndex((t) => t.id === tab) + (e.code === "KeyE" ? 1 : -1);
        switchTab(TABS[(i + TABS.length) % TABS.length].id);
      } else if (e.code === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isChar = tab === "characters";
  const owned = isChar && w.owned.includes(cell.id as CharacterId);
  // The boxes under the card: a power-up's upgrades in its current tier (lime, light red, gold),
  // or savings toward the price for characters and extra lives.
  const isBank = tab === "bank";
  const upgradable = tab === "powerups" && cell.id !== "life";
  const tier = upgradable ? tierOf(w.upgrades[cell.id as PowerUp]) : null;
  // An owned character's boxes are its five tiers instead, each in its tier's colour.
  const charTier = owned ? wallet.tierOf(cell.id as CharacterId) : 0;
  const pips = charTier ? CHARACTER_TIERS : PIPS;
  const filled = tier ? tier.filled : charTier || Math.min(PIPS, Math.floor((w.coins / cell.price) * PIPS));
  const boostColor = TIER_COLORS[(tier?.tier ?? charTier ?? 1) - 1] ?? TIER_COLORS[0];

  return (
    <div
      ref={shop}
      className={`shop${size.wide ? " wide" : ""}`}
      role="dialog"
      aria-label="Store"
      onScroll={fadeTiles}
      style={{ "--card-w": `${size.width}px`, "--card-h": `${size.height}px`, "--card-units": size.units } as React.CSSProperties}
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
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => switchTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
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

      {goals && <GoalList />}

      {/* The selected item's card stays pinned while the grid scrolls up under it. */}
      {!goals && (
      <div className="shop-main">
      <div className="shop-pin" ref={pin}>
        <section className="shop-card" aria-live="polite">
          <CardFrame wide={size.units - 256} boost={boosting} color={boostColor} />
          <h2 className="shop-card-title">{cell.name.toUpperCase()}</h2>
          <div className="shop-card-body">
            {hasPreview(cell.id) ? (
              <Preview id={cell.id} zoom={size.wide ? Math.round(72 * Math.max(1, size.height / 420)) : 72} />
            ) : (
              <span className="shop-card-icon">
                <Icon id={cell.id as StoreItemId | CharacterId} size={size.wide ? Math.round(64 * Math.max(1, size.height / 420)) : 64} />
              </span>
            )}
            <p className="shop-card-kind">{cell.kind}</p>
            <p className="shop-card-desc">
              {cell.description}
              {up?.next && ` ${up.next}.`}
            </p>
            <div className="shop-card-actions">
              <button className="shop-card-buy" disabled={!act.run} onClick={() => act.run?.()}>
                {act.label}
              </button>
              {up?.next && (
                <button className={`shop-card-up${up.run ? " ready" : ""}`} disabled={!doUpgrade} onClick={() => doUpgrade?.()} aria-label={up.label}>
                  <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                    <path d="M12 4 4 13h5v7h6v-7h5Z" fill="currentColor" />
                  </svg>
                  {up.label.replace(/^Upgrade · /, "")}
                </button>
              )}
            </div>
          </div>
        </section>

        <div
          className={`shop-pips${tier ? ` tier-${tier.tier}` : ""}`}
          aria-label={
            tier
              ? `Tier ${tier.tier}, ${tier.filled} of ${TIER_SIZE} upgrades`
              : charTier
              ? `Tier ${charTier} of ${CHARACTER_TIERS}`
              : undefined
          }
          // Packs have nothing to save toward; keep the space so the card doesn't jump between tabs.
          style={isBank ? { visibility: "hidden" } : undefined}
        >
          {(tier || charTier > 0) && <span className="shop-pips-tier">TIER {tier?.tier ?? charTier}</span>}
          {Array.from({ length: pips }, (_, i) => (
            <span
              key={i}
              className={`pip${i < filled ? " full" : i === filled ? " next" : ""}`}
              style={charTier && i < filled ? { background: TIER_COLORS[i] } : undefined}
            />
          ))}
        </div>
      </div>

      <div className="shop-grid" ref={grid} role="listbox" aria-label={TABS.find((t) => t.id === tab)!.label}>
        {cells.map((c, i) => {
          const mine = isChar && w.owned.includes(c.id as CharacterId);
          const equipped = isChar && w.selected === c.id;
          const pack = packOf(c.id);
          const count = tab === "powerups" ? w.inventory[c.id as StoreItemId] : 0;
          const locked = !mine && !pack && w.coins < c.price;
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
              {pack ? (
                <img className="shop-tile-art pack" src={`/currency/${pack.id}.png`} alt="" draggable={false} />
              ) : isChar && CHARACTER_ART[c.id as CharacterId] ? (
                <img className="shop-tile-art" src={CHARACTER_ART[c.id as CharacterId]} alt="" draggable={false} />
              ) : (
                <Icon id={c.id as StoreItemId | CharacterId} size={34} />
              )}
              {count > 0 && <span className="shop-tile-badge">{count}</span>}
              <span className="shop-tile-price">{pack ? `×${pack.amount}` : mine ? (equipped ? "ON" : "OWNED") : c.price}</span>
            </button>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}

/**
 * The card's size. Its height stays as before, but it widens to fill most of the screen's width,
 * leaving a margin so it never touches the edges. The extra width is added to the card's drawing in
 * SVG units (see CardFrame), so the corners and notches keep their shape.
 */
function useCardSize() {
  const measure = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (isWide(vw, vh)) {
      // Wide screens: the card fills the left ~40% of the screen, as tall as fits under the header.
      const width = vw * WIDE_CARD - 2 * CARD_MARGIN;
      const height = Math.max(320, Math.min(vh - WIDE_CHROME, (width * (312 + CARD_STRETCH)) / 256));
      return { width, height, units: (width / height) * (312 + CARD_STRETCH), wide: true };
    }
    const base = Math.min(vw * 0.62, 270, vh * 0.52 * 0.653);
    const height = (base * (312 + CARD_STRETCH)) / 256;
    const width = Math.max(base, Math.min(vw - 2 * CARD_MARGIN, height * 0.95));
    return { width, height, units: (width / height) * (312 + CARD_STRETCH), wide: false };
  };
  // Start from the server's size so hydration matches, then measure the real screen before paint.
  const [size, setSize] = useState(SERVER_CARD);
  useLayoutEffect(() => {
    const onResize = () => setSize(measure());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

const GRID_COLS = 3;
const SERVER_CARD = { width: 256, height: 392, units: 256, wide: false };
/** Screens at least this wide, and wider than tall, put the card on the left and the list on the right. */
const WIDE_MIN = 900;
const isWide = (vw: number, vh: number) => vw >= WIDE_MIN && vw > vh;
/** Share of the screen's width the card's column takes on wide screens. */
const WIDE_CARD = 0.4;
/** Height kept for the header, pips and padding when sizing the card on wide screens. */
const WIDE_CHROME = 190;
/** Space kept between the card and the sides of the screen. */
const CARD_MARGIN = 22;
/** Extra height (in card SVG units) added to the middle of the card; keep in sync with --card-h in globals.css. */
const CARD_STRETCH = 80;
/** Illustrated portraits that replace the glyph on a character's tile. */
const CHARACTER_ART: Partial<Record<CharacterId, string>> = {
  chicken: "/characters/chicken.png",
};
const PIPS = TIER_SIZE;

/** The purple backdrop with its darker diagonal bands and thin swirl lines. */
export function ShopBackdrop() {
  // Each shape drifts slowly on its own path and timing (see .drift in globals.css), so the
  // background never quite repeats.
  return (
    <svg className="shop-backdrop" viewBox="0 0 393 852" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="393" height="852" fill="#7048e8" />
      <path className="drift drift-1" d="M-40 250 C 120 300 260 330 440 420 L 440 520 C 260 430 120 400 -40 350 Z" fill="#5f3bd6" />
      <path className="drift drift-2" d="M120 -20 C 180 60 300 110 440 120 L 440 40 C 320 30 230 0 200 -20 Z" fill="#5f3bd6" />
      <path className="drift drift-3" d="M-40 560 C 100 620 260 640 440 610 L 440 680 C 260 720 100 700 -40 640 Z" fill="#6440dc" />
      <path className="drift drift-4" d="M-40 140 C 60 120 160 160 230 240" fill="none" stroke="#5a37cc" strokeWidth="2" />
      <path className="drift drift-5" d="M-40 660 C 80 650 200 690 300 760 S 420 820 440 800" fill="none" stroke="#5a37cc" strokeWidth="2" />
      <circle className="drift drift-6" cx="392" cy="98" r="18" fill="#5f3bd6" />
      <circle className="drift drift-7" cx="340" cy="628" r="18" fill="#5f3bd6" />
    </svg>
  );
}

/**
 * The card from the mockup: cream torn-paper frame, a sweeping shine, dark notched panel and teal
 * title banner. Points below the banner are pushed down by CARD_STRETCH so the panel is tall enough
 * to show a whole character, and points right of the middle are pushed right by `wide` so the card
 * can fill the screen's width; the corners keep their shape.
 */
function CardFrame({ wide, boost = 0, color }: { wide: number; boost?: number; color: string }) {
  const e = CARD_STRETCH;
  const x = (v: number) => (v > 128 ? v + wide : v);
  const W = 256 + wide;
  const H = 312 + e;
  const path = (points: [number, number][]) => `M${points.map(([px, py]) => `${x(px)} ${py}`).join("L")}Z`;
  const paper = path([
    [255.024, 0],
    [20.3935, 7.56873],
    [20.3935, 64.5445],
    [8.61995, 55.7143],
    [18.9218, 265.957 + e],
    [0, 289.714 + e],
    [22.7062, 301.488 + e],
    [15.558, 312 + e],
    [245.353, 302.119 + e],
    [255.024, 25.0189],
    [245.353, 14.717],
  ]);
  const panel = path([
    [237.575, 20.6055],
    [35.7425, 20.6055],
    [24.5996, 290.557 + e],
    [192.163, 294.131 + e],
    [231.689, 260.913 + e],
  ]);
  const banner = `M${x(170.717)} 106.384C${x(168.531)} 109.075 80.1028 99.9363 36.1621 95.0306L38.8953 23.3379H${x(234.631)}L${x(
    232.739,
  )} 95.0306H${x(181.44)}C${x(178.777)} 97.6937 ${x(172.904)} 103.693 ${x(170.717)} 106.384Z`;
  return (
    <svg
      className={`shop-card-frame${boost ? " boosting" : ""}`}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      aria-hidden="true"
      style={{ "--boost-color": color } as React.CSSProperties}
    >
      <defs>
        <pattern id="shop-card-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="2.4" fill={color === TIER_COLORS[2] ? "#fff7d1" : "#F2E38C"} />
        </pattern>
        {/* Fades the band of dots out towards its top and bottom edges. */}
        <linearGradient id="shop-card-dots-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="shop-card-dots-mask" maskContentUnits="objectBoundingBox">
          <rect width="1" height="1" fill="url(#shop-card-dots-fade)" />
        </mask>
      </defs>
      <path className="shop-card-paper" d={paper} />
      <mask id="shop-card-paper" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <path d={paper} fill="#F3EED1" />
      </mask>
      <g mask="url(#shop-card-paper)">
        {boost > 0 && (
          // Keyed by the upgrade count, so a second upgrade restarts the sweeps.
          <g key={boost} className="shop-card-dots">
            <rect x="0" y="0" width={W} height="130" fill="url(#shop-card-dots)" mask="url(#shop-card-dots-mask)" />
          </g>
        )}
        <g className="shop-card-shine">
          <rect x="-24.9609" y="52.293" width={350.672 + wide} height="43.31" transform="rotate(18.5736 -24.9609 52.293)" fill="#F2E38C" />
        </g>
      </g>
      <path d={panel} fill="#212139" />
      <path d={banner} fill="#2DDED3" />
    </svg>
  );
}
