"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction, type PowerUp } from "@/game/engine";
import { Scene } from "./Scene";

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

const POWERUPS: { key: PowerUp; label: string; color: string }[] = [
  { key: "foresight", label: "FORESIGHT", color: "#8e5cf7" },
  { key: "slowmo", label: "SLOWMO", color: "#2f6fb5" },
  { key: "rock", label: "ROCK", color: "#6f7177" },
];
// Ignore input for a moment after dying so a held key doesn't skip the score screen.
const RESTART_DELAY = 600;

export default function Game() {
  const [engine, setEngine] = useState(() => new Engine());
  const ui = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const diedAt = useRef(0);

  useEffect(() => {
    if (ui.status === "dead") diedAt.current = performance.now();
  }, [ui.status]);

  const restart = useCallback(() => {
    if (performance.now() - diedAt.current < RESTART_DELAY) return;
    setEngine(new Engine());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
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
  }, [engine, restart]);

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

      <div className="hud">
        <div className="score">{ui.score}</div>
        <div className="best">TOP {ui.best}</div>
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
          <p className="sub">Grab ♥ for extra lives, plus foresight, slowmo and rock power-ups</p>
        </div>
      )}

      {ui.status === "dead" && (
        <div className="overlay">
          <div className="panel">
            <p className="panel-label">SCORE</p>
            <p className="panel-score">{ui.score}</p>
            <p className="panel-best">{ui.score >= ui.best && ui.score > 0 ? "NEW TOP SCORE!" : `TOP ${ui.best}`}</p>
            <button
              className="play"
              onPointerUp={(e) => {
                e.stopPropagation();
                restart();
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
