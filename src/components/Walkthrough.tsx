"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { GuidePage } from "@/game/guide";
import { button as buttonSound } from "@/game/sound";
import { Icon } from "./icons";
import { CharacterModel } from "./models";

/** Letters typed per second. */
const TYPE_SPEED = 38;

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.1;
  });
  return (
    <group ref={ref} position={[0, 0, 0]}>
      {children}
    </group>
  );
}

/** The picture beside the chicken: a power-up or coin, or the friend being introduced turning slowly. */
function Art({ art }: { art: NonNullable<GuidePage["art"]> }) {
  if ("icon" in art)
    return (
      <div className="guide-art guide-art-icon" key={art.icon}>
        <Icon id={art.icon} size={64} />
      </div>
    );
  return (
    <div className="guide-art guide-art-model">
      <Canvas orthographic camera={{ position: [0, 1.2, 3], zoom: 110 }}>
        <hemisphereLight args={["#ffffff", "#9fc3e8", 1.8]} />
        <directionalLight position={[-2, 4, 3]} intensity={1.6} />
        <Turntable>
          <CharacterModel id={art.model} />
        </Turntable>
      </Canvas>
    </div>
  );
}

/** Types the line out a letter at a time; reports when it has finished. */
function useTyped(text: string) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const n = Math.min(text.length, Math.floor(((now - start) / 1000) * TYPE_SPEED));
      setShown(n);
      if (n < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return [shown, () => setShown(text.length)] as const;
}

const stop = (e: React.PointerEvent) => e.stopPropagation();

/**
 * The chicken's visual-novel walkthrough: the chicken stands at the bottom and talks in a speech
 * box, one short line at a time. Tap (or Space, Enter, right arrow) to go on; Skip leaves early.
 */
export default function Walkthrough({ pages, onDone }: { pages: GuidePage[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const [shown, finish] = useTyped(page.text);
  const typing = shown < page.text.length;
  const last = index === pages.length - 1;

  const next = () => {
    if (typing) {
      finish();
      return;
    }
    buttonSound();
    if (last) onDone();
    else setIndex(index + 1);
  };
  const back = () => {
    if (index > 0) setIndex(index - 1);
  };

  // Read by the key handler, so it always sees the latest page without re-subscribing.
  const keys = useRef({ next, back, onDone });
  keys.current = { next, back, onDone };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight" || e.code === "KeyD" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        keys.current.next();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.back();
      else if (e.code === "Escape") keys.current.onDone();
    };
    // Capture, so the game underneath never sees these keys while the chicken is talking.
    const swallow = (e: KeyboardEvent) => {
      onKey(e);
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", swallow, true);
    return () => window.removeEventListener("keydown", swallow, true);
  }, []);

  return (
    <div className="guide" role="dialog" aria-label="How to play" onPointerDown={stop} onPointerUp={stop} onClick={next}>
      <button
        className="guide-skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        SKIP
      </button>

      {page.art && <Art art={page.art} />}

      <div className="guide-stage">
        <img className="guide-chicken" key={index} src="/characters/chicken.png" alt="" draggable={false} />
        <div className="guide-box">
          <span className="guide-name">CHICKEN</span>
          <p className="guide-text" aria-live="polite">
            {page.text.slice(0, shown)}
            {/* The rest of the line holds its space so the box doesn't grow while typing. */}
            <span className="guide-hidden">{page.text.slice(shown)}</span>
          </p>
          <div className="guide-foot">
            <span className="guide-dots" aria-label={`Page ${index + 1} of ${pages.length}`}>
              {pages.map((_, i) => (
                <i key={i} className={i === index ? "on" : i < index ? "done" : ""} />
              ))}
            </span>
            {!typing && <span className="guide-next">{last ? "LET'S GO!" : "NEXT ▶"}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
