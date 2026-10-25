"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction } from "@/game/engine";
import { CHICKEN_POWERUP_BONUS } from "@/game/config";
import { POWERUPS, durationAt, hotkeyFor, type PowerUp } from "@/game/powerups";
import { audioSettings, onAudioSettings, setAudioSettings } from "@/game/sound";
import { CHARACTERS, wallet } from "@/game/wallet";
import { Scene } from "./Scene";
import { Hex, Icon } from "./icons";
import Store, { useWallet, type StoreTab } from "./Store";

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

type MenuItem = "play" | "characters" | "store" | "options" | "exit";
const MENU: { id: MenuItem; label: string }[] = [
  { id: "play", label: "PLAY" },
  { id: "characters", label: "CHARACTERS" },
  { id: "store", label: "STORE" },
  { id: "options", label: "OPTIONS" },
  { id: "exit", label: "EXIT" },
];

export default function Game({ onReady, onExit, locked = false }: GameProps) {
  const [engine, setEngine] = useState(() => new Engine(wallet.get().selected));
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const sound = useSyncExternalStore(onAudioSettings, audioSettings, audioSettings);
  const w = useWallet();
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeTab, setStoreTab] = useState<StoreTab>("characters");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [hovered, setHovered] = useState<MenuItem>("play");
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
    durationAt(key, w.upgrades[key]) * (engine.character === "chicken" ? CHICKEN_POWERUP_BONUS : 1);
  const character = CHARACTERS.find((c) => c.id === engine.character) ?? CHARACTERS[0];

  // Show a newly picked character straight away on the start screen.
  useEffect(() => {
    if (engine.status === "ready" && engine.character !== w.selected) setEngine(new Engine(w.selected));
  }, [engine, w.selected]);

  useEffect(() => {
    if (ui.status === "dead") diedAt.current = performance.now();
  }, [ui.status]);

  const restart = useCallback(() => {
    if (performance.now() - diedAt.current < RESTART_DELAY) return;
    setStoreOpen(false);
    setEngine(new Engine(wallet.get().selected));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || locked) return;
      if (optionsOpen) {
        if (e.code === "Escape") setOptionsOpen(false);
        else if (e.code === "KeyB") toggleFx();
        return;
      }
      if (storeOpen) {
        if (e.code === "Escape") setStoreOpen(false);
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
        engine.move(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine, restart, storeOpen, optionsOpen, locked, toggleFx, openStore]);

  const pick = (item: MenuItem) => {
    if (item === "play") engine.move("up");
    else if (item === "characters") openStore("characters");
    else if (item === "store") openStore("powerups");
    else if (item === "options") setOptionsOpen(true);
    else onExit?.();
  };

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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) engine.move("up");
    else if (Math.abs(dx) > Math.abs(dy)) engine.move(dx > 0 ? "right" : "left");
    else engine.move(dy > 0 ? "down" : "up");
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
            <Icon id="coin" size={14} /> {w.coins}
          </span>
        </div>
        <div className="effects">
          {POWERUPS.map(
            ({ key, label }) =>
              ui.effects[key] > 0 && (
                <div key={key} className="effect" title={label}>
                  <Hex tone="teal" size={40} ring={ui.effects[key] / fullDuration(key)}>
                    <Icon id={key} size={17} />
                  </Hex>
                  <span>{ui.effects[key]}s</span>
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
          {POWERUPS.map(({ key, label }, i) =>
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
                <span className="cell-badge">{w.inventory[key] + ui.stash[key]}</span>
                <Hex tone={ui.effects[key] > 0 ? "teal" : "white"} size={54}>
                  <Icon id={key} size={22} />
                </Hex>
                {hotkeyFor(i) && <kbd>{hotkeyFor(i)!.slice(-1)}</kbd>}
              </button>
            ) : null,
          )}
        </div>
      )}

      {ui.toast && (
        <div key={ui.toast.id} className="toast">
          {ui.toast.text}
        </div>
      )}

      {ui.status === "ready" && (
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
          <p className="menu-trait">
            {character.name}: {character.trait}
          </p>
        </div>
      )}

      {optionsOpen && (
        <div className="options" onPointerDown={stop} onPointerUp={stop}>
          <div className="options-panel">
            <h2>OPTIONS</h2>
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
            {sound.musicOn && <Volume label="Music volume" value={sound.music} onChange={(music) => setAudioSettings({ music })} />}
            <button className="options-back" onClick={() => setOptionsOpen(false)}>
              BACK
            </button>
          </div>
        </div>
      )}

      {ui.status === "dead" && (
        <div className="overlay">
          <div className="panel">
            <p className="menu-kind">SCORE</p>
            <p className="panel-score">{ui.score}</p>
            <p className="panel-best">{ui.score >= ui.best && ui.score > 0 ? "NEW TOP SCORE" : `TOP ${ui.best}`}</p>
            <p className="panel-coins">
              <Icon id="coin" size={16} /> +{ui.coins}
            </p>
          </div>
          <div className="menu-hints overlay-hints">
            <button
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                openStore("powerups");
              }}
            >
              <kbd>S</kbd> Store
            </button>
            <button
              className="primary"
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                restart();
              }}
            >
              <kbd>↵</kbd> Play again
            </button>
          </div>
        </div>
      )}

      {storeOpen && <Store initialTab={storeTab} onClose={() => setStoreOpen(false)} />}
    </div>
  );
}
