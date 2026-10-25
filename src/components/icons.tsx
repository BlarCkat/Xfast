import type { CharacterId, StoreItemId } from "@/game/wallet";

// Bold single-colour glyphs for the store and HUD hexagons. They draw in currentColor.

type IconId = StoreItemId | CharacterId | "coin" | "gem";

const PATHS: Record<IconId, React.ReactNode> = {
  life: <path d="M12 21 3.5 12.6A5.2 5.2 0 0 1 12 5.9a5.2 5.2 0 0 1 8.5 6.7Z" />,
  foresight: (
    <>
      <path d="M12 5C6.5 5 2.6 9.2 1 12c1.6 2.8 5.5 7 11 7s9.4-4.2 11-7c-1.6-2.8-5.5-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  slowmo: <path d="M5 2h14v2h-1.5v2.5a5.5 5.5 0 0 1-3 4.9v1.2a5.5 5.5 0 0 1 3 4.9V20H19v2H5v-2h1.5v-2.5a5.5 5.5 0 0 1 3-4.9v-1.2a5.5 5.5 0 0 1-3-4.9V4H5Zm4 2v2.5c0 1 .5 2 1.3 2.6L12 10.3l1.7-1.2A3.3 3.3 0 0 0 15 6.5V4Z" />,
  rock: <path d="M7 4h7l5 4 3 7-4 6H6l-4-5 1-7Zm2 3-2.4 2.6.5 2.4L10 10l1-3Z" />,
  magnet: <path d="M3 3h6v8a3 3 0 0 0 6 0V3h6v8A9 9 0 0 1 3 11Zm2 2v2h2V5Zm12 0v2h2V5Z" />,
  double: (
    <>
      <circle cx="9" cy="12" r="7" />
      <path d="M15.5 5.2A7 7 0 0 1 15.5 18.8a8.6 8.6 0 0 0 0-13.6Z" />
      <path d="M18 5a7 7 0 0 1 0 14 8.8 8.8 0 0 0 0-14Z" />
    </>
  ),
  superhop: <path d="M12 2 21 11h-6v2h-6v-2H3Zm-6 13h12l-6 6Z" />,
  shield: <path d="M12 1 21 5v6c0 6-4 10.5-9 12-5-1.5-9-6-9-12V5Zm0 4.2L7 7.4V11c0 3.6 2 6.7 5 7.9Z" />,
  freeze: <path d="M11 1h2v4.3l2.6-2.6 1.4 1.4-4 4V11h2.9l4-4 1.4 1.4-2.6 2.6H23v2h-4.3l2.6 2.6-1.4 1.4-4-4H13v2.9l4 4-1.4 1.4-2.6-2.6V23h-2v-4.3l-2.6 2.6L7 19.9l4-4V13H8.1l-4 4-1.4-1.4L5.3 13H1v-2h4.3L2.7 8.4 4.1 7l4 4H11V8.1l-4-4 1.4-1.4L11 5.3Z" />,
  wings: <path d="M12 9c-2-4-6-6-11-6 0 7 3 12 9 13l2 3 2-3c6-1 9-6 9-13-5 0-9 2-11 6Z" />,
  scarecrow: <path d="M8 2h8l1 4h4v2H3V6h4Zm-1 8h10v3l-3 1v2h7v2h-7v5h-4v-5H3v-2h7v-2l-3-1Z" />,
  ghost: <path d="M12 2a8 8 0 0 1 8 8v12l-2.7-2-2.6 2L12 20l-2.7 2-2.6-2L4 22V10a8 8 0 0 1 8-8Zm-3 7v3h2V9Zm4 0v3h2V9Z" />,
  tiny: <path d="M3 3h6v2H6.4l3.3 3.3-1.4 1.4L5 6.4V9H3Zm18 0v6h-2V6.4l-3.3 3.3-1.4-1.4L17.6 5H15V3ZM3 21v-6h2v2.6l3.3-3.3 1.4 1.4L6.4 19H9v2Zm18 0h-6v-2h2.6l-3.3-3.3 1.4-1.4 3.3 3.3V15h2Z" />,
  lumberjack: <path d="M13 2h5l1 3c2 .5 3 2.2 3 4.5-1.4-.9-2.9-1.3-4.5-1.1l-1.5.2V22h-3V8.6l-1.5-.2C9.9 8.2 8.4 8.6 7 9.5 7 7.2 8 5.5 10 5Z" />,
  warp: <path d="M12 2a10 10 0 1 1-7.1 17.1l2.1-2.1A7 7 0 1 0 12 5V2Zm0 5a5 5 0 1 1-3.5 8.5l2.1-2.1A2 2 0 1 0 12 10V7ZM2 12h4l-2 3Zm0 0" />,
  coinrain: (
    <>
      <circle cx="6" cy="6" r="3.5" />
      <circle cx="17" cy="9" r="3.5" />
      <circle cx="9" cy="17" r="3.5" />
      <path d="M17 15v6M20 17v3M3 10v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  chicken: <path d="M10 2h4v2h-2v2h3v3h4l-2 3h2v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4l3-2V6h3Zm1 6v2h2V8Z" />,
  duck: <path d="M9 3h5a4 4 0 0 1 4 4v1h4l-3 3h-1v1a7 7 0 0 1 3 5.5V18a4 4 0 0 1-4 4H7a5 5 0 0 1-5-5v-1l4 1a3 3 0 0 0 3-3v-3a4 4 0 0 1-3-4V7a4 4 0 0 1 3-4Zm2 3v2h2V6Z" />,
  frog: <path d="M5 4a3 3 0 0 1 6 0v1h2V4a3 3 0 0 1 6 0v2.5a8 8 0 0 1 4 6.5c0 5-5 8-11 8S1 18 1 13a8 8 0 0 1 4-6.5Zm2-1v2h2V3Zm8 0v2h2V3ZM6 14v2c3 2 9 2 12 0v-2c-3 2-9 2-12 0Z" />,
  penguin: <path d="M12 1a6 6 0 0 1 6 6v3l3 5-3-.5V19l2 3H4l2-3v-4.5L3 15l3-5V7a6 6 0 0 1 6-6Zm-2 5v2h1V6Zm3 0v2h1V6Zm-1 4-2 1 2 1 2-1Zm0 3c-2 0-3 1.5-3 4v2h6v-2c0-2.5-1-4-3-4Z" />,
  cat: <path d="M3 2l5 4h8l5-4v9a9 9 0 0 1-18 0Zm5 9v2h2v-2Zm6 0v2h2v-2Zm-3 4 1 1 1-1Z" />,
  sparrow: <path d="M14 3a4 4 0 0 1 4 3l4 1-4 2v2a8 8 0 0 1-8 8H6l-4 3 2-5 4-3 2-6a4 4 0 0 1 4-5Zm1 3v2h2V6Z" />,
  snail: <path d="M11 4a7 7 0 0 1 7 7 7 7 0 0 1-.6 2.9L18 14V6l1-3 1 3v2l2-3 1 1-3 5v7a2 2 0 0 1-2 2H2v-2l3-1a7 7 0 0 1 6-12Zm0 4a3 3 0 1 0 3 3 3 3 0 0 0-3-3Zm0 2a1 1 0 1 1-1 1 1 1 0 0 1 1-1Z" />,
  robot: <path d="M11 1h2v3h4a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2v2h3v4H6v-4h3v-2H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4Zm-3 7v3h3V8Zm5 0v3h3V8ZM1 8h2v5H1Zm20 0h2v5h-2Z" />,
  // A plumber's cap with its letter cut out.
  mario: (
    <path
      fillRule="evenodd"
      d="M12 3a9 9 0 0 1 9 9v2h2v3H1v-3h2v-2a9 9 0 0 1 9-9Zm-4 4v6h2v-3l2 2 2-2v3h2V7h-2l-2 2.5L10 7Z"
    />
  ),
  luigi: <path fillRule="evenodd" d="M12 3a9 9 0 0 1 9 9v2h2v3H1v-3h2v-2a9 9 0 0 1 9-9Zm-2 4v6h5v-2h-3V7Z" />,
  // A spiked shell.
  bowser: (
    <path d="M12 2l2 3.2 3.6-1.2-.6 3.8 3.6 1.4-2.8 2.6L20 15h-3.4L16 19H8l-.6-4H4l2.2-3.2-2.8-2.6L7 7.8 6.4 4 10 5.2ZM6 20h12v2H6Z" />
  ),
  gem: <path d="M12 1 23 12 12 23 1 12Zm0 5-6 6 6 6 6-6Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path fill="#fff" d="M11 6h2v1.1c1.5.3 2.6 1.3 2.8 2.9h-2a1.6 1.6 0 0 0-1.8-1.2c-1 0-1.6.5-1.6 1.1 0 .7.6 1 2 1.3 2.2.5 3.6 1.2 3.6 3.2 0 1.6-1.1 2.7-3 3V18h-2v-1.1c-1.8-.3-3-1.5-3.1-3.2h2a1.8 1.8 0 0 0 2.1 1.4c1.1 0 1.8-.5 1.8-1.2 0-.8-.7-1.1-2.2-1.4-2-.5-3.4-1.2-3.4-3.1 0-1.4 1-2.5 2.8-2.9Z" />
    </>
  ),
};

/** Illustrated icons that replace a glyph wherever it appears (store, HUD, inventory). */
const ART: Partial<Record<IconId, string>> = {
  wings: "/powerups/wings.png",
  // Snapshots of the 3D models in PowerupArt and CurrencyArt.
  superhop: "/powerups/superhop.png",
  freeze: "/powerups/freeze.png",
  magnet: "/powerups/magnet.png",
  slowmo: "/powerups/slowmo.png",
  shield: "/powerups/shield.png",
  double: "/powerups/double.png",
  coinrain: "/powerups/coinrain.png",
  coin: "/currency/coin.png",
  gem: "/currency/gem.png",
};

export function Icon({ id, size = 24 }: { id: IconId; size?: number }) {
  const art = ART[id];
  // Painted art reads smaller than a solid glyph, so give it a little more room.
  if (art) return <img src={art} width={size * 1.3} height={size * 1.3} alt="" draggable={false} className="icon-art" />;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {PATHS[id]}
    </svg>
  );
}

// Rounded, pointy-top hexagon in a 100 x 100 box.
export const HEX_PATH =
  "M50 3 C52 3 54 4 56 5 L89 24 C93 26 95 30 95 34 L95 66 C95 70 93 74 89 76 L56 95 C54 96 52 97 50 97 C48 97 46 96 44 95 L11 76 C7 74 5 70 5 66 L5 34 C5 30 7 26 11 24 L44 5 C46 4 48 3 50 3 Z";

export type HexTone = "white" | "teal" | "locked";

/** One honeycomb cell: a filled hexagon with an optional progress ring. */
export function Hex({
  tone,
  size,
  ring,
  ringColor = "var(--ui-ink)",
  outline = false,
  children,
}: {
  /** Draw the gold selection outline around the cell. */
  outline?: boolean;
  tone: HexTone;
  size: number;
  /** 0-1 progress drawn around the edge. */
  ring?: number;
  ringColor?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`hex hex-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="-6 -6 112 112" className="hex-shape" aria-hidden="true">
        {outline && <path d={HEX_PATH} className="hex-outline" transform="translate(50 50) scale(1.1) translate(-50 -50)" />}
        <path d={HEX_PATH} className="hex-fill" />
        {ring !== undefined && ring > 0 && (
          <path
            d={HEX_PATH}
            pathLength={100}
            className="hex-ring"
            style={{ stroke: ringColor, strokeDasharray: `${Math.min(1, ring) * 100} 100` }}
          />
        )}
      </svg>
      <span className="hex-icon">{children}</span>
    </span>
  );
}
