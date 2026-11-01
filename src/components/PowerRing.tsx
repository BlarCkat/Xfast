// A round power-up button in the style of the reference badges: a tinted disc holding the icon, a
// ring of separate arc segments around it (lit ones in the power-up's colour, the rest pale grey),
// and a small pill underneath.

const SEGMENTS = 5;
/** Degrees left empty between segments. */
const GAP = 14;

function arc(r: number, from: number, to: number) {
  const pt = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`;
  };
  return `M ${pt(from)} A ${r} ${r} 0 0 1 ${pt(to)}`;
}

/** Mix a #rrggbb colour toward white by `amount` (0-1). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) + (255 - ((n >> shift) & 255)) * amount);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}

export function PowerRing({
  color,
  size,
  lit,
  label,
  active = false,
  children,
}: {
  color: string;
  size: number;
  /** How much of the ring is lit, 0-1; partly lit segments light up whole once past halfway. */
  lit: number;
  label?: React.ReactNode;
  /** Running right now: a brighter disc. */
  active?: boolean;
  children: React.ReactNode;
}) {
  const on = Math.round(lit * SEGMENTS);
  const step = 360 / SEGMENTS;
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="ring-shape" aria-hidden="true">
        <circle cx={50} cy={50} r={34} fill={tint(color, active ? 0.25 : 0.55)} />
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <path
            key={i}
            // Start at the bottom left and run clockwise, like the reference.
            d={arc(45, 200 + i * step + GAP / 2, 200 + (i + 1) * step - GAP / 2)}
            className="ring-seg"
            // Inline so it wins over the pale stroke in the stylesheet; --i lets a card light them in turn.
            style={{ ...(i < on ? { stroke: color } : null), ["--i" as string]: i }}
          />
        ))}
      </svg>
      <span className="ring-icon">{children}</span>
      {label !== undefined && (
        <span className="ring-label" style={{ background: color }}>
          {label}
        </span>
      )}
    </span>
  );
}
