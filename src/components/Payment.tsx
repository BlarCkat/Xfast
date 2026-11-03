"use client";

import { useEffect, useRef, useState } from "react";
import * as sound from "@/game/sound";

// Mock checkout for the bank's coin and gem packs. Nothing is charged: the purchase is "validated"
// when the player swipes the confirm slider across. The flow is a 2s "Processing Payment" screen,
// the confirm sheet sliding up, then another 2s processing screen once confirmed.

export interface PaymentPack {
  kind: "coins" | "gems";
  amount: number;
  /** Price in Ghana cedis. */
  price: number;
  /** Art for the pack, shown at the top of the sheet. */
  art: string;
}

/** How long each "Processing Payment" screen shows, in ms. */
const PROCESSING_MS = 2000;
/** The sheet's slide in and out, in ms (keep in sync with .pay-sheet in globals.css). */
const SLIDE_MS = 500;
/** Mock checkout: no fee is charged. */
const FEE = 0;

const ghs = (n: number) => `GHS${n.toFixed(2)}`;

type Stage = "processing" | "confirm" | "closing" | "paying";

export default function Payment({
  pack,
  onCancel,
  onPaid,
}: {
  pack: PaymentPack;
  onCancel: () => void;
  /** Called after the second processing screen, once the purchase has been confirmed. */
  onPaid: () => void;
}) {
  const [stage, setStage] = useState<Stage>("processing");
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const after = (ms: number, fn: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  useEffect(() => {
    after(PROCESSING_MS, () => setStage("confirm"));
    return () => clearTimeout(timer.current);
  }, []);
  // Mount the sheet off-screen, then slide it up on the next frame.
  useEffect(() => {
    if (stage !== "confirm") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [stage]);

  const cancel = () => {
    if (stage !== "confirm") return;
    setShown(false);
    setStage("closing");
    after(SLIDE_MS, onCancel);
  };
  const confirm = () => {
    sound.button();
    setShown(false);
    after(SLIDE_MS, () => {
      setStage("paying");
      after(PROCESSING_MS, onPaid);
    });
  };

  // Escape backs out of the sheet rather than closing the store behind it (the store ignores its
  // other keys while a payment is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.stopImmediatePropagation();
      cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const name = `${pack.amount.toLocaleString("en-US")} ${pack.kind === "coins" ? "Coins" : "Gems"}`;
  const rows: [string, string, boolean?][] = [
    ["Game", "Xfast"],
    ["Item", name],
    ["Amount (GHS)", ghs(pack.price)],
    ["Transaction Fee", ghs(FEE)],
    ["Total", ghs(pack.price + FEE), true],
  ];

  return (
    <div className="pay" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      {(stage === "processing" || stage === "paying") && (
        <div className="pay-processing" role="status" aria-live="polite">
          <span className="pay-spinner" aria-hidden="true" />
          <p>Processing Payment</p>
        </div>
      )}
      {(stage === "confirm" || stage === "closing") && (
        <>
          <div className={`pay-dim${shown ? " on" : ""}`} onClick={cancel} />
          <section className={`pay-sheet${shown ? " on" : ""}`} role="dialog" aria-modal="true" aria-labelledby="pay-title">
            <button className="pay-handle" onClick={cancel} aria-label="Cancel purchase" />
            <div className="pay-art">
              <img src={pack.art} alt="" draggable={false} />
            </div>
            <h2 id="pay-title" className="pay-title">
              Confirm Purchase
            </h2>
            <p className="pay-sub">Confirm Purchase details to proceed</p>
            <dl className="pay-table">
              {rows.map(([k, v, total]) => (
                <div key={k} className="pay-row">
                  <dt>{k}</dt>
                  <dd className={total ? "total" : undefined}>{v}</dd>
                </div>
              ))}
            </dl>
            <SwipeToConfirm onConfirm={confirm} disabled={!shown} />
          </section>
        </>
      )}
    </div>
  );
}

/** A pill track with a red knob: drag it to the far end to confirm. Enter or Space on the knob also confirms. */
function SwipeToConfirm({ onConfirm, disabled }: { onConfirm: () => void; disabled: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ start: number; max: number } | null>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);

  const max = () => (track.current && knob.current ? track.current.clientWidth - knob.current.offsetWidth - 2 * KNOB_INSET : 0);
  const finish = () => {
    setDone(true);
    setX(max());
    onConfirm();
  };

  return (
    <div className={`pay-swipe${done ? " done" : ""}`} ref={track}>
      <span className="pay-swipe-label" style={{ opacity: 1 - Math.min(1, x / Math.max(1, max() * 0.6)) }}>
        Swipe to confirm
      </span>
      <button
        ref={knob}
        className="pay-swipe-knob"
        aria-label="Swipe to confirm purchase"
        disabled={disabled || done}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? "none" : undefined }}
        onPointerDown={(e) => {
          if (disabled || done) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { start: e.clientX - x, max: max() };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setX(Math.max(0, Math.min(drag.current.max, e.clientX - drag.current.start)));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (!d) return;
          // Swiped (nearly) all the way: the payment is validated. Otherwise the knob springs back.
          if (e.clientX - d.start >= d.max * 0.9) finish();
          else setX(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setX(0);
        }}
        onKeyDown={(e) => {
          if (e.code === "Enter" || e.code === "Space") {
            e.preventDefault();
            if (!disabled && !done) finish();
          }
        }}
      >
        <svg viewBox="0 0 24 24" width={30} height={30} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.5 9.2a4 4 0 0 1 0 5.6" />
          <path d="M12.4 7.4a6.6 6.6 0 0 1 0 9.2" />
          <path d="M15.3 5.8a9 9 0 0 1 0 12.4" />
        </svg>
      </button>
    </div>
  );
}

/** Gap between the knob and the track's edge, in px (keep in sync with .pay-swipe in globals.css). */
const KNOB_INSET = 8;
