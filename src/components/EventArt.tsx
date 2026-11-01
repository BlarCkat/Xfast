"use client";

import type { EventId } from "@/game/events";
import { Drum, Ink } from "./toon";

// The holiday events' special items: a 3D model for the road and a flat icon for the HUD and the
// Rewards screen.

/** A red Santa bonnet: a red cone with a white fur band round the brim and a pompom at the tip. */
export function BonnetArt() {
  return (
    <group>
      <group rotation={[0, 0, 0.18]}>
        <Drum r={0.3} rTop={0.05} h={0.56} y={0.3} color="#d62839" sides={24} />
        <group position={[0.02, 0.62, 0]}>
          <mesh>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshToonMaterial color="#ffffff" />
          </mesh>
          <mesh scale={1.35}>
            <sphereGeometry args={[0.1, 16, 12]} />
            <Ink />
          </mesh>
        </group>
      </group>
      <Drum r={0.36} h={0.14} y={0.04} color="#ffffff" sides={24} />
    </group>
  );
}

export function EventItemArt({ id }: { id: EventId }) {
  switch (id) {
    case "christmas":
      return <BonnetArt />;
  }
}

/** The item as a small flat picture, in full colour. */
export function EventIcon({ id, size = 24 }: { id: EventId; size?: number }) {
  switch (id) {
    case "christmas":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="event-icon">
          <path d="M4 18C5 10 9 4 15 4c3 0 5 2 5.5 5l-2.5.5C17 8 16 7.5 15 7.6 12 8 11 13 11.5 18Z" fill="#d62839" stroke="#14101f" strokeWidth="1.4" strokeLinejoin="round" />
          <rect x="2.5" y="16.5" width="15" height="4.5" rx="2.2" fill="#fff" stroke="#14101f" strokeWidth="1.4" />
          <circle cx="20" cy="10" r="2.6" fill="#fff" stroke="#14101f" strokeWidth="1.4" />
        </svg>
      );
  }
}
