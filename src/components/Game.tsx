"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction } from "@/game/engine";
import { POWERUPS, hotkeyFor } from "@/game/powerups";
import { wallet } from "@/game/wallet";
import { Scene } from "./Scene";
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

export default function Game() {
  const [engine, setEngine] = useState(() => new Engine(wallet.get().selected));
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const w = useWallet();
  const [storeOpen, setStoreOpen] = useState(false);
  const diedAt = useRef(0);

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
  }, [engine, restart, storeOpen]);

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
        <Scene key={engine.id} engine={engine} />
      </Canvas>

      {ui.effects.slowmo > 0 && <div className="tint tint-slowmo" />}
      {ui.effects.foresight > 0 && <div className="tint tint-foresight" />}
      {ui.effects.freeze > 0 && <div className="tint tint-freeze" />}

      <div className="hud">
        <div className="score">{ui.score}</div>
        <div className="best">TOP {ui.best}</div>
        <div className="coins">
          <span className="coin-icon" /> {w.coins}
        </div>
        <div className="effects">
          {POWERUPS.map(
            ({ key, label, color }) =>
              ui.effects[key] > 0 && (
                <div key={key} className="effect" style={{ background: color }}>
                  {label} {ui.effects[key]}s
                </div>
              ),
          )}
        </div>
      </div>

      <div className="lives" aria-label={`${ui.lives} extra lives`}>
        <span className="heart">♥</span> × {ui.lives}
      </div>

      {ui.status === "playing" && (
        <div className="inventory">
          {POWERUPS.map(({ key, label, color }, i) =>
            w.inventory[key] > 0 ? (
              <button
                key={key}
                className="use-power"
                style={{ background: color }}
                onPointerDown={stop}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  engine.activate(key);
                }}
              >
                {label} ×{w.inventory[key]}
                <small>key {hotkeyFor(i).slice(-1)}</small>
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
          <p className="sub">Swipe or use arrows / WASD to move</p>
          <p className="sub">Grab coins, ♥ extra lives and power-ups</p>
          <button
            className="play store-button"
            onPointerDown={stop}
            onPointerUp={(e) => {
              e.stopPropagation();
              setStoreOpen(true);
            }}
          >
            STORE
          </button>
        </div>
      )}

      {ui.status === "dead" && (
        <div className="overlay">
          <div className="panel">
            <p className="panel-label">SCORE</p>
            <p className="panel-score">{ui.score}</p>
            <p className="panel-best">{ui.score >= ui.best && ui.score > 0 ? "NEW TOP SCORE!" : `TOP ${ui.best}`}</p>
            <p className="panel-coins">
              +{ui.coins} <span className="coin-icon" />
            </p>
            <button
              className="play"
              onPointerUp={(e) => {
                e.stopPropagation();
                restart();
              }}
            >
              PLAY AGAIN
            </button>
            <button
              className="play secondary"
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                setStoreOpen(true);
              }}
            >
              STORE
            </button>
          </div>
        </div>
      )}

      {storeOpen && <Store onClose={() => setStoreOpen(false)} />}
    </div>
  );
}
