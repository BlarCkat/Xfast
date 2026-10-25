// Sound effects, synthesised with the Web Audio API so there are no audio files to download.

let ctx: AudioContext | null = null;

/** The shared audio context, made on first use (always inside a tap or key press, which browsers require). */
function audio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * A soft mouth pop: a sine whose pitch flicks quickly upward, like a finger popped from the cheek,
 * rounded off by a low-pass filter. Each pop is pitched a little differently so hops don't sound
 * mechanical; `big` (a super hop) pops lower and lasts a touch longer.
 */
export function pop(big = false) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const pitch = (big ? 0.75 : 1) * (0.92 + Math.random() * 0.16);
  const length = big ? 0.12 : 0.09;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(820 * pitch, t + length * 0.55);

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);

  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}
