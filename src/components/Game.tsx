"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction } from "@/game/engine";
import { POWERUP_DURATION } from "@/game/config";
import { POWERUPS, hotkeyFor } from "@/game/powerups";
import { CHARACTERS, wallet } from "@/game/wallet";
import { Scene } from "./Scene";
import { Hex, Icon } from "./icons";
import Store, { useWallet } from "./Store";

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

export default function Game() {
  const [engine, setEngine] = useState(() => new Engine(wallet.get().selected));
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const w = useWallet();
  const [storeOpen, setStoreOpen] = useState(false);
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
      if (e.repeat) return;
      if (storeOpen) {
        if (e.code === "Escape") setStoreOpen(false);
        return;
      }
      if (e.code === "KeyB") {
        toggleFx();
        return;
      }
      if (e.code === "KeyS" && engine.status !== "playing") {
        setStoreOpen(true);
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
  }, [engine, restart, storeOpen, toggleFx]);

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
                  <Hex tone="teal" size={40} ring={ui.effects[key] / POWERUP_DURATION[key]}>
                    <Icon id={key} size={17} />
                  </Hex>
                  <span>{ui.effects[key]}s</span>
                </div>
              ),
          )}
        </div>
      </div>

      <div className="lives" aria-label={`${ui.lives} extra lives`}>
        <Hex tone="white" size={40}>
          <span className="heart">
            <Icon id="life" size={18} />
          </span>
        </Hex>
        <span>×{ui.lives}</span>
      </div>

      {ui.status === "playing" && (
        <div className="inventory">
          {POWERUPS.map(({ key, label }, i) =>
            w.inventory[key] > 0 ? (
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
                <span className="cell-badge">{w.inventory[key]}</span>
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
        <div className="overlay">
          <h1 className="title">XFAST</h1>
          <p className="hint">Tap or press ↑ to hop</p>
          <p className="sub">Swipe or use arrows / WASD. Grab coins, hearts and power-ups.</p>
          <p className="sub">
            <strong>{character.name}:</strong> {character.trait}
          </p>
          <div className="menu-hints overlay-hints">
            <button
              className="primary"
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                setStoreOpen(true);
              }}
            >
              <kbd>S</kbd> Store
            </button>
            <button
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                toggleFx();
              }}
            >
              <kbd>B</kbd> {fx ? "Realistic" : "Classic"}
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
                setStoreOpen(true);
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

      {storeOpen && <Store onClose={() => setStoreOpen(false)} />}
    </div>
  );
}
