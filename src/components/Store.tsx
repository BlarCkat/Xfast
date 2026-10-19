"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { CHARACTERS, STORE_ITEMS, wallet, type CharacterId } from "@/game/wallet";
import { CharacterModel } from "./models";

function Spinner({ id }: { id: CharacterId }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.2;
  });
  return (
    <group ref={ref} position={[0, -0.6, 0]}>
      <CharacterModel id={id} />
    </group>
  );
}

function Preview({ id }: { id: CharacterId }) {
  return (
    <div className="store-preview">
      <Canvas orthographic camera={{ position: [2.2, 1.8, 3], zoom: 90 }}>
        <hemisphereLight args={["#ffffff", "#9bbf7a", 1.6]} />
        <directionalLight position={[-2, 4, 3]} intensity={1.6} />
        <Spinner id={id} />
      </Canvas>
    </div>
  );
}

export function useWallet() {
  return useSyncExternalStore(wallet.subscribe, wallet.get, wallet.get);
}

export default function Store({ onClose }: { onClose: () => void }) {
  const w = useWallet();
  const [tab, setTab] = useState<"characters" | "powerups">("characters");
  const [focus, setFocus] = useState<CharacterId>(w.selected);
  const focused = CHARACTERS.find((c) => c.id === focus)!;
  const owned = w.owned.includes(focus);

  return (
    <div
      className="store-backdrop"
      // Keep taps inside the store from moving the chicken underneath.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="store" role="dialog" aria-label="Store">
        <div className="store-head">
          <h2>STORE</h2>
          <span className="store-coins">
            <span className="coin-icon" /> {w.coins}
          </span>
          <button className="store-close" onClick={onClose} aria-label="Close store">
            ✕
          </button>
        </div>

        <div className="store-tabs">
          <button className={tab === "characters" ? "on" : ""} onClick={() => setTab("characters")}>
            Characters
          </button>
          <button className={tab === "powerups" ? "on" : ""} onClick={() => setTab("powerups")}>
            Power-ups
          </button>
        </div>

        {tab === "characters" ? (
          <>
            <Preview id={focus} />
            <div className="store-action">
              {w.selected === focus ? (
                <button className="play" disabled>
                  PLAYING AS {focused.name.toUpperCase()}
                </button>
              ) : owned ? (
                <button className="play" onClick={() => wallet.select(focus)}>
                  USE {focused.name.toUpperCase()}
                </button>
              ) : (
                <button className="play" disabled={w.coins < focused.price} onClick={() => wallet.buyCharacter(focus)}>
                  BUY FOR <span className="coin-icon" /> {focused.price}
                </button>
              )}
            </div>
            <div className="store-grid">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  className={`store-card ${focus === c.id ? "on" : ""}`}
                  onClick={() => setFocus(c.id)}
                >
                  <span>{c.name}</span>
                  <small>
                    {w.selected === c.id ? "Selected" : w.owned.includes(c.id) ? "Owned" : `${c.price} coins`}
                  </small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="store-list">
            {STORE_ITEMS.map((item) => (
              <div key={item.id} className="store-row">
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                  <small>You have {w.inventory[item.id]}</small>
                </div>
                <button className="buy" disabled={w.coins < item.price} onClick={() => wallet.buyItem(item.id)}>
                  <span className="coin-icon" /> {item.price}
                </button>
              </div>
            ))}
            <p className="store-note">
              Bought power-ups show as buttons during a run (keys 1, 2, 3). Bought lives are added when your next run
              starts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
