"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction } from "@/game/engine";
import { POWERUPS, TIER_SIZE, durationAt, hotkeyFor, tierOf, type PowerUp } from "@/game/powerups";
import { TRACKS, audioSettings, onAudioSettings, setAudioSettings, type TrackId } from "@/game/sound";
import { wallet } from "@/game/wallet";
import { Scene } from "./Scene";
import { Hex, Icon } from "./icons";
import { PowerRing } from "./PowerRing";
import Achievements, { EarnedToast } from "./Achievements";
import Store, { ShopBackdrop, useWallet, type StoreTab } from "./Store";
import Walkthrough from "./Walkthrough";
import { beforeRun, markSeen, tip, type GuidePage, type HintId } from "@/game/guide";
import type { CharacterId } from "@/game/wallet";

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const SWIPE_MIN = 24;

const stop = (e: React.PointerEvent) => e.stopPropagation();
// Ignore input for a moment after dying so a held key doesn't skip the score screen.
const RESTART_DELAY = 600;

const FX_KEY = "xfast-fx";
/** Realistic rendering (bloom, ambient occlusion) is on unless the player switched it off. */
function readFx() {
  try {
    return localStorage.getItem(FX_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The track after this one, wrapping round. */
const nextTrack = (id: TrackId) => TRACKS[(TRACKS.findIndex((t) => t.id === id) + 1) % TRACKS.length].id;

/** A labelled volume slider for the options panel. */
function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="options-row options-slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label={label}
      />
      <span className="options-value">{Math.round(value * 100)}</span>
    </label>
  );
}

export interface GameProps {
  /** Called once the first frame of the scene has rendered. */
  onReady?: () => void;
  /** Called when the player picks Exit on the main menu. */
  onExit?: () => void;
  /** Ignore keyboard input while something covers the game. */
  locked?: boolean;
}

type MenuItem = "play" | "characters" | "store" | "achievements" | "options" | "exit";
const MENU: { id: MenuItem; label: string }[] = [
  { id: "play", label: "PLAY" },
  { id: "characters", label: "CHARACTERS" },
  { id: "store", label: "STORE" },
  { id: "achievements", label: "ACHIEVEMENTS" },
  { id: "options", label: "OPTIONS" },
  { id: "exit", label: "EXIT" },
];

/** Counts up from 0 to `to`, starting after `delay` seconds and easing out over about a second. */
function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    const start = performance.now() + delay * 1000;
    const length = Math.min(1400, 400 + to * 6);
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, Math.max(0, (now - start) / length));
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [to, delay]);
  return <>{value}</>;
}

export default function Game({ onReady, onExit, locked = false }: GameProps) {
  const [engine, setEngine] = useState(() => new Engine(wallet.get().selected));
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const sound = useSyncExternalStore(onAudioSettings, audioSettings, audioSettings);
  const w = useWallet();
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeTab, setStoreTab] = useState<StoreTab>("characters");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [hovered, setHovered] = useState<MenuItem>("play");
  /** The chicken's walkthrough on screen: its pages, who it introduces, and whether finishing starts the run. */
  const [guide, setGuide] = useState<null | {
    pages: GuidePage[];
    tips: HintId[];
    character: CharacterId | null;
    /** Shown before the run, so closing it makes the first hop. */
    thenPlay: boolean;
  }>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    if (!optionsOpen) setConfirmReset(false);
  }, [optionsOpen]);
  const openStore = useCallback((tab: StoreTab) => {
    setStoreTab(tab);
    setStoreOpen(true);
  }, []);
  const [fx, setFx] = useState(readFx);
  const toggleFx = useCallback(() => {
    setFx((on) => {
      try {
        localStorage.setItem(FX_KEY, on ? "off" : "on");
      } catch {}
      return !on;
    });
  }, []);
  const diedAt = useRef(0);
  // Upgrades and the chicken's bonus stretch power-ups, so the HUD rings measure against the real length.
  const fullDuration = (key: PowerUp) =>
    durationAt(key, w.upgrades[key]) * (engine.character === "chicken" ? engine.traits.powerupBonus : 1);

  // Show a newly picked or upgraded character straight away on the start screen.
  const selectedTier = w.charTiers[w.selected] ?? 1;
  useEffect(() => {
    if (engine.status !== "ready") return;
    if (engine.character !== w.selected || engine.tier !== selectedTier) setEngine(new Engine(w.selected));
  }, [engine, w.selected, selectedTier]);

  useEffect(() => {
    if (ui.status === "dead") diedAt.current = performance.now();
  }, [ui.status]);

  // Leaving the store goes back to the main menu, even when it was opened from the score screen.
  const closeStore = useCallback(() => {
    setStoreOpen(false);
    setEngine((current) => (current.status === "dead" ? new Engine(wallet.get().selected) : current));
  }, []);

  const restart = useCallback(() => {
    if (performance.now() - diedAt.current < RESTART_DELAY) return;
    setStoreOpen(false);
    setEngine(new Engine(wallet.get().selected));
  }, []);

  /**
   * Every way of starting a run comes through here. A new player, or a character played for the
   * first time, hears from the chicken first; the hop happens once the chicken is done.
   */
  const startRun = useCallback(
    (dir: Direction) => {
      if (engine.status === "ready") {
        const inv = wallet.get().inventory;
        const pending = beforeRun(engine.character, engine.tier, POWERUPS.some((p) => inv[p.key] > 0));
        if (pending) {
          setGuide({ ...pending, thenPlay: true });
          return;
        }
      }
      engine.move(dir);
    },
    [engine],
  );

  // During a run the engine asks for a tip at the moments that need one; the game holds still while the chicken talks.
  useEffect(() => {
    engine.onHint = (id) => {
      const pages = tip(id);
      if (!pages) return false;
      engine.paused = true;
      setGuide({ pages, character: null, tips: [id], thenPlay: false });
      return true;
    };
    return () => {
      engine.onHint = null;
    };
  }, [engine]);

  /** The first visit to the Characters screen: every friend has a power, and here's mine. */
  const onStoreTab = useCallback((t: StoreTab) => {
    const pages = t === "characters" ? tip("characters") : null;
    if (pages) setGuide({ pages, character: "chicken", tips: ["characters"], thenPlay: false });
  }, []);

  const endGuide = useCallback(() => {
    if (!guide) return;
    markSeen(guide.tips, guide.character);
    setGuide(null);
    engine.paused = false;
    if (guide.thenPlay && engine.status === "ready") engine.move("up");
  }, [guide, engine]);

  /** Wipe everything this game saved in the browser and start fresh. */
  const resetAll = useCallback(() => {
    try {
      localStorage.clear();
    } catch {}
    window.location.reload();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || locked || guide) return;
      if (optionsOpen) {
        if (e.code === "Escape") setOptionsOpen(false);
        else if (e.code === "KeyB") toggleFx();
        return;
      }
      if (storeOpen) {
        if (e.code === "Escape") closeStore();
        return;
      }
      if (goalsOpen) {
        if (e.code === "Escape") setGoalsOpen(false);
        return;
      }
      if (e.code === "KeyB") {
        toggleFx();
        return;
      }
      if (e.code === "KeyS" && engine.status !== "playing") {
        openStore("powerups");
        return;
      }
      if (e.code === "KeyC" && engine.status !== "playing") {
        openStore("characters");
        return;
      }
      const power = POWERUPS.find((_, i) => hotkeyFor(i) === e.code);
      if (power) {
        engine.activate(power.key);
        return;
      }
      if (engine.status === "dead") {
        if (e.code === "Space" || e.code === "Enter" || KEYS[e.code]) restart();
        return;
      }
      const dir = KEYS[e.code] ?? (e.code === "Space" ? "up" : undefined);
      if (dir) {
        e.preventDefault();
        startRun(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, restart, storeOpen, optionsOpen, goalsOpen, locked, toggleFx, openStore, closeStore, guide, startRun]);

  const pick = (item: MenuItem) => {
    if (item === "play") startRun("up");
    else if (item === "characters") openStore("characters");
    else if (item === "store") openStore("powerups");
    else if (item === "achievements") setGoalsOpen(true);
    else if (item === "options") setOptionsOpen(true);
    else onExit?.();
  };

  // iOS Safari still zooms on pinch and quick double taps despite the viewport meta.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const events = ["gesturestart", "gesturechange", "dblclick"];
    for (const name of events) document.addEventListener(name, block, { passive: false });
    return () => {
      for (const name of events) document.removeEventListener(name, block);
    };
  }, []);

  // Tap to hop forward, swipe to hop in any direction.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (engine.status === "dead") {
      restart();
      return;
    }
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) startRun("up");
    else if (Math.abs(dx) > Math.abs(dy)) startRun(dx > 0 ? "right" : "left");
    else startRun(dy > 0 ? "down" : "up");
  };

  return (
    <div className="game" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <Canvas
        orthographic
        shadows
        dpr={[1, 2]}
        camera={{ position: [3, 11, 7.5], zoom: 50, near: -50, far: 200 }}
        onCreated={() => requestAnimationFrame(() => onReady?.())}
      >
        <Scene key={engine.id} engine={engine} fx={fx} />
      </Canvas>

      {ui.effects.slowmo > 0 && <div className="tint tint-slowmo" />}
      {ui.effects.foresight > 0 && <div className="tint tint-foresight" />}
      {ui.effects.freeze > 0 && <div className="tint tint-freeze" />}

      <div className="hud">
        <div className="score" aria-label={`Score ${ui.score}`}>
          {ui.score}
        </div>
        <div className="hud-stats">
          <span>TOP {ui.best}</span>
          {engine.speedScale > 1 && <span className="hud-speed">SPEED ×{engine.speedScale.toFixed(1)}</span>}
          <span className="hud-coins">
            <Icon id="coin" size={22} /> {w.coins}
          </span>
        </div>
        <div className="effects">
          {POWERUPS.map(
            ({ key, label, color }) =>
              ui.effects[key] > 0 && (
                <div key={key} className="effect" title={label}>
                  <PowerRing color={color} size={46} lit={ui.effects[key] / fullDuration(key)} label={`${ui.effects[key]}s`} active>
                    <Icon id={key} size={20} />
                  </PowerRing>
                </div>
              ),
          )}
        </div>
      </div>

      <div className="lives" aria-label={`${ui.lives} extra lives`}>
        <Hex tone="white" size={40} ring={ui.refill ?? undefined} ringColor="#ff4d6d">
          <span className="heart">
            <Icon id="life" size={18} />
          </span>
        </Hex>
        <span>×{ui.lives}</span>
      </div>

      {ui.status === "playing" && (
        <div className="inventory">
          {POWERUPS.map(({ key, label, color }, i) =>
            w.inventory[key] + ui.stash[key] > 0 ? (
              <button
                key={key}
                className="use-power"
                aria-label={`Use ${label}${hotkeyFor(i) ? ` (key ${hotkeyFor(i)!.slice(-1)})` : ""}`}
                onPointerDown={stop}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  engine.activate(key);
                }}
              >
                {/* The ring drains while the power-up runs; otherwise it shows the progress through its upgrade tier. */}
                <PowerRing
                  color={color}
                  size={58}
                  active={ui.effects[key] > 0}
                  lit={ui.effects[key] > 0 ? ui.effects[key] / fullDuration(key) : tierOf(w.upgrades[key]).filled / TIER_SIZE}
                  label={`×${w.inventory[key] + ui.stash[key]}`}
                >
                  <Icon id={key} size={26} />
                </PowerRing>
                {hotkeyFor(i) && <kbd>{hotkeyFor(i)!.slice(-1)}</kbd>}
              </button>
            ) : null,
          )}
        </div>
      )}

      {ui.toast && (
        <div key={ui.toast.id} className="toast">
          {ui.toast.icon && <img className="toast-icon" src={ui.toast.icon} alt="" />}
          {ui.toast.text}
        </div>
      )}

      {ui.earned[0] && (
        <EarnedToast key={ui.earned[0].id} goal={ui.earned[0].goal} onDone={() => engine.dismissEarned(ui.earned[0].id)} />
      )}

      {ui.status === "ready" && !guide && (
        <div className="main-menu">
          {/* Text stand-in until the Roadmasters logo arrives. */}
          <h1 className="title">ROADMASTERS</h1>
          <nav className="menu-list" aria-label="Main menu">
            {MENU.map(({ id, label }) => (
              <button
                key={id}
                className={hovered === id ? "on" : ""}
                onPointerEnter={() => setHovered(id)}
                onFocus={() => setHovered(id)}
                onPointerDown={stop}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  pick(id);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {optionsOpen && (
        <div className="shop options-screen" role="dialog" aria-label="Options" onPointerDown={stop} onPointerUp={stop}>
          <ShopBackdrop />
          <header className="shop-head">
            <button className="shop-back" onClick={() => setOptionsOpen(false)} aria-label="Back">
              <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true">
                <path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 className="options-title">OPTIONS</h2>
          </header>
          <div className="options-list">
            <button className="options-row" onClick={toggleFx}>
              <span>Graphics</span>
              <span className="options-value">{fx ? "Realistic" : "Classic"}</span>
              <kbd>B</kbd>
            </button>
            <Volume label="Sound effects" value={sound.sfx} onChange={(sfx) => setAudioSettings({ sfx })} />
            <button className="options-row" onClick={() => setAudioSettings({ musicOn: !sound.musicOn })}>
              <span>Music</span>
              <span className="options-value">{sound.musicOn ? "On" : "Off"}</span>
            </button>
            {sound.musicOn && (
              <>
                <button className="options-row" onClick={() => setAudioSettings({ track: nextTrack(sound.track) })}>
                  <span>Track</span>
                  <span className="options-value">{TRACKS.find((t) => t.id === sound.track)!.name}</span>
                </button>
                <Volume label="Music volume" value={sound.music} onChange={(music) => setAudioSettings({ music })} />
              </>
            )}
            {confirmReset ? (
              <div className="options-row options-confirm" role="alertdialog" aria-label="Reset game">
                <span>Erase all coins, friends and progress?</span>
                <button className="options-cancel" onClick={() => setConfirmReset(false)}>
                  Keep
                </button>
                <button className="options-danger" onClick={resetAll}>
                  Erase
                </button>
              </div>
            ) : (
              <button className="options-row options-reset" onClick={() => setConfirmReset(true)}>
                <span>Reset game</span>
                <span className="options-value">Start fresh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {ui.status === "dead" && (
        <div className="game-over" role="dialog" aria-label="Run over" onPointerDown={stop} onPointerUp={stop}>
          <ShopBackdrop />
          <div className="game-over-score">
            <p className="game-over-kind" style={{ "--i": 0 } as React.CSSProperties}>
              SCORE
            </p>
            <p className="game-over-value" style={{ "--i": 1 } as React.CSSProperties}>
              <CountUp to={ui.score} delay={0.85} />
            </p>
            <p className="game-over-best" style={{ "--i": 2 } as React.CSSProperties}>
              {ui.score >= ui.best && ui.score > 0 ? "NEW TOP SCORE!" : `TOP ${ui.best}`}
            </p>
            <p className="game-over-coins" style={{ "--i": 3 } as React.CSSProperties}>
              <Icon id="coin" size={30} /> +<CountUp to={ui.coins} delay={1.2} />
            </p>
          </div>
          <div className="game-over-actions">
            <button className="game-over-store" style={{ "--i": 4 } as React.CSSProperties} onClick={() => openStore("powerups")}>
              <span>STORE</span>
            </button>
            <button className="game-over-play" style={{ "--i": 5 } as React.CSSProperties} onClick={restart}>
              <span>PLAY</span>
            </button>
          </div>
        </div>
      )}

      {goalsOpen && <Achievements onClose={() => setGoalsOpen(false)} />}
      {storeOpen && <Store initialTab={storeTab} onClose={closeStore} onTab={onStoreTab} />}
      {guide && <Walkthrough pages={guide.pages} onDone={endGuide} doneLabel={guide.thenPlay ? "LET'S GO!" : "OK!"} />}
    </div>
  );
}
