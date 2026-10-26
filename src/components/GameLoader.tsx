"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import type { GameProps } from "./Game";

// Each step fills a third of the bar: the game code, the fonts, and the first rendered frame.
type Step = "code" | "fonts" | "scene";
const STEPS: Step[] = ["code", "fonts", "scene"];
// The bar stays up at least this long so it never flashes past on a warm cache.
const MIN_SHOW = 900;
// Matches the .curtain slide in globals.css.
const SLIDE_MS = 500;

type Phase = "loading" | "leaving" | "gone" | "returning" | "paused";

export default function GameLoader() {
  // WebGL only exists in the browser, so the game is imported on the client and never server-rendered.
  const [Game, setGame] = useState<ComponentType<GameProps> | null>(null);
  const [done, setDone] = useState<Set<Step>>(() => new Set());
  const [phase, setPhase] = useState<Phase>("loading");
  const [shown, setShown] = useState(0);
  // Once the player has used Exit, the curtain shows the title instead of the loading bar.
  const [exited, setExited] = useState(false);
  const mark = useCallback((step: Step) => setDone((d) => (d.has(step) ? d : new Set(d).add(step))), []);

  useEffect(() => {
    import("./Game").then((m) => {
      setGame(() => m.default);
      mark("code");
    });
    document.fonts.ready.then(() => mark("fonts"));
  }, [mark]);

  // Ease the bar toward the finished steps, creeping a little ahead so it never looks stuck.
  const target = done.size / STEPS.length;
  const started = useRef(0);
  useEffect(() => {
    if (phase !== "loading") return;
    if (!started.current) started.current = performance.now();
    let raf = 0;
    const tick = () => {
      setShown((s) => {
        const creep = Math.min(target + 0.3, 0.95);
        const goal = target >= 1 ? 1 : Math.max(target, Math.min(creep, s + 0.002));
        const next = s + (goal - s) * 0.12;
        return goal - next < 0.002 ? goal : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, target]);

  useEffect(() => {
    if (phase !== "loading" || shown < 1) return;
    const wait = Math.max(150, MIN_SHOW - (performance.now() - started.current));
    const t = setTimeout(() => setPhase("leaving"), wait);
    return () => clearTimeout(t);
  }, [phase, shown]);

  useEffect(() => {
    if (phase !== "leaving" && phase !== "returning") return;
    const t = setTimeout(() => setPhase(phase === "leaving" ? "gone" : "paused"), SLIDE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Any key brings the player back from the title curtain.
  useEffect(() => {
    if (phase !== "paused") return;
    const onKey = () => setPhase("leaving");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const onReady = useCallback(() => mark("scene"), [mark]);
  const onExit = useCallback(() => {
    setExited(true);
    setPhase("returning");
  }, []);
  const resume = () => {
    if (phase === "paused") setPhase("leaving");
  };

  return (
    <>
      {Game && <Game onReady={onReady} onExit={onExit} locked={phase !== "gone"} />}
      {phase !== "gone" && (
        <div
          className={`curtain curtain-${phase}`}
          role={exited ? "button" : "progressbar"}
          aria-label={exited ? "Tap to continue" : "Loading"}
          aria-valuenow={phase === "loading" ? Math.round(shown * 100) : undefined}
          onClick={resume}
        >
          {exited ? (
            <div className="curtain-title">
              <h1>ROADMASTERS</h1>
              <p>Tap to continue</p>
            </div>
          ) : (
            <div className="loading">
              <span className="loading-label">LOADING...</span>
              <div className="loading-bar">
                <div className="loading-fill" style={{ transform: `scaleX(${shown})` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
