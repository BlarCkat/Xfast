"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * The speech box drawn like the store's card: cream paper with torn edges, a navy panel and a teal
 * name banner (without the card's moving shine). Drawn in pixels at the box's measured size, so the
 * corners keep their shape at any width.
 */
function GuideFrame({ w, h }: { w: number; h: number }) {
  if (!w || !h) return null;
  const path = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
  const paper = path([
    [w - 1, 0],
    [20, 7],
    [20, 34],
    [9, 27],
    [19, h - 40],
    [0, h - 24],
    [23, h - 12],
    [16, h],
    [w - 10, h - 9],
    [w - 1, 25],
    [w - 10, 14],
  ]);
  const panel = path([
    [w - 18, 20],
    [36, 20],
    [26, h - 18],
    [w - 80, h - 14],
    [w - 22, h - 44],
  ]);
  const banner = "M39 23H196L193 58H150C147 61 141 67 139 70C137 67 88 61 37 58Z";
  return (
    <svg className="guide-frame" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={paper} fill="#F3EED1" />
      <path d={panel} fill="#212139" />
      <path d={banner} fill="#2DDED3" />
    </svg>
  );
}

/** The element's size in pixels, kept up to date as it changes. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The chicken's tip box: the chicken stands at the bottom and talks in a speech box, one short line
 * at a time. Tap (or Space, Enter, right arrow) to go on; Skip leaves early.
 */
export default function Walkthrough({ pages, onDone, doneLabel = "OK!" }: { pages: GuidePage[]; onDone: () => void; doneLabel?: string }) {
  const [index, setIndex] = useState(0);
  const [boxRef, box] = useSize<HTMLDivElement>();
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
    <div className="guide" role="dialog" aria-label="Chicken's tip" onPointerDown={stop} onPointerUp={stop} onClick={next}>
      {pages.length > 2 && (
        <button
          className="guide-skip"
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
        >
          SKIP
        </button>
      )}

      {page.art && <Art art={page.art} />}

      <div className="guide-stage">
        <img className="guide-chicken" key={index} src="/characters/chicken.png" alt="" draggable={false} />
        <div className="guide-box" ref={boxRef}>
          <GuideFrame w={box.w} h={box.h} />
          <span className="guide-name">CHICKEN</span>
          <p className="guide-text" aria-live="polite">
            {page.text.slice(0, shown)}
            {/* The rest of the line holds its space so the box doesn't grow while typing. */}
            <span className="guide-hidden">{page.text.slice(shown)}</span>
          </p>
          <div className="guide-foot">
            <span className="guide-dots" aria-label={`Page ${index + 1} of ${pages.length}`}>
              {pages.length > 1 && pages.map((_, i) => <i key={i} className={i === index ? "on" : i < index ? "done" : ""} />)}
            </span>
            <span className={`guide-next${typing ? " waiting" : ""}`}>{last ? doneLabel : "NEXT ▶"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
