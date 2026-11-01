"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { CHESTS, chests, type ChestKind, type Loot } from "@/game/chests";
import { POWERUPS } from "@/game/powerups";
import { CHARACTERS, UPGRADES_PER_LEVEL, wallet, type CharacterId, type StoreItemId } from "@/game/wallet";
import * as sound from "@/game/sound";
import { ChestArt, ChestLights } from "./ChestArt";
import { Icon } from "./icons";

// Opening a chest, full screen. The chest can wait for a tap ("You have found a chest!"), then it
// rattles for three seconds, hops up and throws back its lid, and what was inside comes out one item
// at a time, each on its own, as the player taps Next.

function Sway({ children, spin, bob }: { children: React.ReactNode; spin: boolean; bob: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.y = spin ? -0.5 + Math.sin(t * 0.9) * 0.35 : -0.35;
    g.position.y = bob ? Math.sin(t * 2.4) * 0.05 : 0;
  });
  return <group ref={ref}>{children}</group>;
}

/** Eases the camera to a new zoom, so the chest can shrink back to make room for its loot. */
function Zoom({ to }: { to: number }) {
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    if (Math.abs(camera.zoom - to) < 0.5) return;
    camera.zoom += (to - camera.zoom) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  });
  return null;
}

/** A chest in its own little scene, seen from a little above and to the front. */
export function ChestStage({
  kind,
  zoom,
  open = false,
  shaking = false,
  spin = true,
  bob = false,
}: {
  kind: ChestKind;
  zoom: number;
  open?: boolean;
  shaking?: boolean;
  spin?: boolean;
  bob?: boolean;
}) {
  return (
    <Canvas orthographic camera={{ position: [0, 1.4, 3], zoom }} onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}>
      <ChestLights />
      <Zoom to={zoom} />
      <Sway spin={spin} bob={bob}>
        <ChestArt kind={kind} open={open} shaking={shaking} />
      </Sway>
    </Canvas>
  );
}

const charName = (id: string) => CHARACTERS.find((c) => c.id === id)?.name ?? id;
const powerName = (id: string) => {
  const label = POWERUPS.find((p) => p.key === id)?.label ?? id;
  return label.charAt(0) + label.slice(1).toLowerCase();
};

type Item = Loot & { times?: number };

/** Stacks repeated power-up upgrades into one item each. */
function group(loot: Loot[]): Item[] {
  const out: Item[] = [];
  for (const l of loot) {
    const same = l.kind === "powerup" ? out.find((o) => o.kind === "powerup" && o.powerup === l.powerup) : undefined;
    if (same) same.times = (same.times ?? 1) + 1;
    else out.push({ ...l });
  }
  return out;
}

/** What an item looks like on its own: its icon, its headline and the line under it. */
function describe(item: Item): { icon: StoreItemId | CharacterId | "coin" | "gem"; title: string; sub: string; big?: boolean } {
  switch (item.kind) {
    case "coins":
      return { icon: "coin", title: `+${item.amount}`, sub: "COINS" };
    case "gems":
      return { icon: "gem", title: `+${item.amount}`, sub: "GEMS" };
    case "upgrade":
      return item.levelUp
        ? { icon: item.character, title: charName(item.character), sub: `LEVEL UP! LEVEL ${wallet.tierOf(item.character)}`, big: true }
        : {
            icon: item.character,
            title: charName(item.character),
            sub: `UPGRADE · ${wallet.upgradesOf(item.character)}/${UPGRADES_PER_LEVEL} TO NEXT LEVEL`,
          };
    case "level":
      return { icon: item.character, title: charName(item.character), sub: `LEVEL UP! LEVEL ${item.level}`, big: true };
    case "powerup":
      return { icon: item.powerup, title: powerName(item.powerup), sub: `UPGRADE${item.times ? ` ×${item.times}` : ""}` };
  }
}

/** Seconds the chest rattles before it opens. */
const SHAKE_MS = 3000;
/** The hop and the lid flying open, before the first item comes out. */
const BOUNCE_MS = 650;

type Phase = "wait" | "shake" | "bounce" | "reveal";

/**
 * The opening sequence for one chest. `found` starts it waiting for a tap, with the "found a chest"
 * lines; otherwise it starts rattling straight away. `onAgain` offers to open another after the last
 * item.
 */
export function ChestOpening({
  kind,
  found = false,
  onDone,
  onAgain,
  againLabel,
}: {
  kind: ChestKind;
  found?: boolean;
  onDone: () => void;
  onAgain?: () => void;
  againLabel?: string;
}) {
  const [phase, setPhase] = useState<Phase>(found ? "wait" : "shake");
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState(0);
  // Held in a ref so a parent re-rendering mid-rattle doesn't restart the timers.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (phase === "shake") {
      const t = setTimeout(() => {
        const loot = chests.open(kind);
        if (!loot) {
          done.current();
          return;
        }
        setItems(group(loot));
        setPhase("bounce");
        sound.upgrade();
      }, SHAKE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "bounce") {
      const t = setTimeout(() => {
        setPhase("reveal");
        sound.coin(true);
      }, BOUNCE_MS);
      return () => clearTimeout(t);
    }
  }, [phase, kind]);

  const tapToOpen = () => {
    if (phase !== "wait") return;
    sound.button();
    setPhase("shake");
  };
  const last = shown >= items.length - 1;
  const next = () => {
    sound.button();
    if (!last) {
      setShown((n) => n + 1);
      sound.coin(false);
    } else onDone();
  };

  const item = phase === "reveal" ? items[shown] : null;
  const look = item && describe(item);
  const title = found && (phase === "wait" || phase === "shake") ? "YOU HAVE FOUND A CHEST!" : CHESTS[kind].name.toUpperCase();
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className={`chest-open chest-phase-${phase}`}
      role="dialog"
      aria-label={title}
      onPointerDown={stop}
      onPointerUp={(e) => {
        e.stopPropagation();
        tapToOpen();
      }}
    >
      <div className="chest-open-glow" />
      <h2 className="chest-open-title">{title}</h2>
      {look && (
        // Keyed by the item, so each one pops out of the chest afresh.
        <div key={shown} className={`chest-item${look.big ? " big" : ""}`} aria-live="polite">
          <span className="chest-item-icon">
            <Icon id={look.icon} size={92} />
          </span>
          <span className="chest-item-title">{look.title}</span>
          <span className="chest-item-sub">{look.sub}</span>
        </div>
      )}
      <div className="chest-open-stage">
        <ChestStage
          kind={kind}
          zoom={phase === "reveal" ? 105 : 150}
          open={phase === "bounce" || phase === "reveal"}
          shaking={phase === "shake"}
          spin={false}
          bob={phase === "wait"}
        />
      </div>
      {phase === "wait" && <p className="chest-open-tap">TAP TO OPEN IT</p>}
      {phase === "reveal" && (
        <>
          {/* What has come out so far, small, with no backgrounds. */}
          <ul className="chest-tally" aria-label="Items so far">
            {items.slice(0, shown + 1).map((it, i) => {
              const d = describe(it);
              return (
                <li key={i} className={i === shown ? "on" : ""}>
                  <Icon id={d.icon} size={30} />
                  {(it.kind === "coins" || it.kind === "gems") && <span>{it.amount}</span>}
                </li>
              );
            })}
            {items.slice(shown + 1).map((_, i) => (
              <li key={`q${i}`} className="hidden-item">
                ?
              </li>
            ))}
          </ul>
          <div className="chest-actions">
            {last && onAgain && (
              <button className="chest-btn-alt" onClick={onAgain}>
                <span>{againLabel ?? "OPEN ANOTHER"}</span>
              </button>
            )}
            <button className="chest-btn-main" onClick={next}>
              <span>{last ? "COLLECT" : "NEXT"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
