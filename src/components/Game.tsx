"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { Engine, type Direction } from "@/game/engine";
import { CHICKEN_POWERUP_BONUS } from "@/game/config";
import { POWERUPS, durationAt, hotkeyFor, type PowerUp } from "@/game/powerups";
import { CHARACTERS, wallet } from "@/game/wallet";
import { cloud } from "@/lib/cloud";
import { leaderboardEnabled } from "@/lib/firebase";
import { Scene } from "./Scene";
import { Hex, Icon } from "./icons";
import Store, { useWallet } from "./Store";
import Leaderboard from "./Leaderboard";
import ProfileEditor from "./Profile";

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
  const account = useSyncExternalStore(cloud.subscribe, cloud.get, cloud.get);
  const [storeOpen, setStoreOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
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
    durationAt(key, w.levels[key]) * (engine.character === "chicken" ? CHICKEN_POWERUP_BONUS : 1);
  const character = CHARACTERS.find((c) => c.id === engine.character) ?? CHARACTERS[0];

  useEffect(() => cloud.start(), []);

  // Show a newly picked character, or a just-loaded account's top score, straight away on the start screen.
  const engineUid = useRef(account.uid);
  useEffect(() => {
    const switched = engineUid.current !== account.uid && account.status !== "loading";
    if (engine.status === "ready" && (engine.character !== w.selected || switched)) {
      engineUid.current = account.uid;
      setEngine(new Engine(w.selected));
    }
  }, [engine, w.selected, account.uid, account.status]);

  useEffect(() => {
    if (ui.status !== "dead") return;
    diedAt.current = performance.now();
    // The top score may have changed.
    cloud.touch();
    cloud.submitRun(engine.getSnapshot().score);
  }, [ui.status, engine]);

  const restart = useCallback(() => {
    if (performance.now() - diedAt.current < RESTART_DELAY) return;
    setStoreOpen(false);
    setBoardOpen(false);
    setEngine(new Engine(wallet.get().selected));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The store, leaderboard and profile editor handle their own keys.
      if (e.repeat || storeOpen || boardOpen || cloud.get().editing) return;
      if (e.code === "KeyB") {
        toggleFx();
        return;
      }
      if (e.code === "KeyS" && engine.status !== "playing") {
        setStoreOpen(true);
        return;
      }
      if (e.code === "KeyL" && leaderboardEnabled && engine.status !== "playing") {
        setBoardOpen(true);
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
  }, [engine, restart, storeOpen, boardOpen, toggleFx]);

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

      {account.notice && (
        <div key={`cloud-${account.notice.id}`} className="toast toast-cloud">
          {account.notice.text}
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
        </div>
      )}

      {ui.status === "ready" && (
        <nav className="start-nav" aria-label="Main menu">
          <button
            aria-label="Store"
            onPointerDown={stop}
            onPointerUp={(e) => {
              e.stopPropagation();
              setStoreOpen(true);
            }}
          >
            <span className="start-coin">
              <Icon id="coin" size={22} />
            </span>
            <span>Store</span>
            <kbd>S</kbd>
          </button>
          {leaderboardEnabled && (
            <button
              aria-label="Leaderboard"
              onPointerDown={stop}
              onPointerUp={(e) => {
                e.stopPropagation();
                setBoardOpen(true);
              }}
            >
              <span className="start-coin">
                <Icon id="trophy" size={22} />
              </span>
              <span>Ranks</span>
              <kbd>L</kbd>
            </button>
          )}
          <button
            className="start-play"
            onPointerDown={stop}
            onPointerUp={(e) => {
              e.stopPropagation();
              engine.move("up");
            }}
          >
            <svg viewBox="0 0 24 24" width={26} height={26} fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" />
            </svg>
            <span>Play</span>
          </button>
          <button
            aria-label={`Graphics: ${fx ? "Realistic" : "Classic"}`}
            onPointerDown={stop}
            onPointerUp={(e) => {
              e.stopPropagation();
              toggleFx();
            }}
          >
            <Icon id="foresight" size={22} />
            <span>{fx ? "Realistic" : "Classic"}</span>
            <kbd>B</kbd>
          </button>
        </nav>
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
            {leaderboardEnabled && (
              <button
                onPointerDown={stop}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  setBoardOpen(true);
                }}
              >
                <kbd>L</kbd> Ranks
              </button>
            )}
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
      {boardOpen && <Leaderboard onClose={() => setBoardOpen(false)} />}
      {account.editing && <ProfileEditor start={account.editing} first={!account.profile?.username} />}
    </div>
  );
}
