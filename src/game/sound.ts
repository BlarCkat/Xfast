// Sound effects, synthesised with the Web Audio API so there are no audio files to download.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** The shared audio context, made on first use (always inside a tap or key press, which browsers require). */
function audio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // Go quiet with the tab, so the river doesn't keep running in the background.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) void ctx?.suspend();
      else void ctx?.resume();
    });
  }
  if (ctx.state === "suspended" && !document.hidden) void ctx.resume();
  return ctx;
}

/** Two seconds of white noise, shared by every hiss, whoosh and splash. */
function noise(ac: AudioContext) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

/** A gain envelope: a quick rise to `peak`, then an exponential fall that is silent by `t + length`. */
function envelope(ac: AudioContext, t: number, peak: number, length: number, attack = 0.005) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  return g;
}

function filter(ac: AudioContext, type: BiquadFilterType, frequency: number, q = 1) {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** A burst of filtered noise, the base of most effects here. */
function hiss(ac: AudioContext, t: number, opts: { type: BiquadFilterType; from: number; to?: number; q?: number; peak: number; length: number; attack?: number }) {
  const src = noise(ac);
  const f = filter(ac, opts.type, opts.from, opts.q);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.length);
  const g = envelope(ac, t, opts.peak, opts.length, opts.attack);
  src.connect(f).connect(g).connect(master!);
  // Start somewhere random so repeated sounds don't share the same grain.
  src.start(t, Math.random() * 1.5);
  src.stop(t + opts.length + 0.05);
}

/** A single oscillator note with a pitch slide. */
function tone(ac: AudioContext, t: number, opts: { type: OscillatorType; from: number; to?: number; peak: number; length: number; attack?: number; lowpass?: number }) {
  const osc = ac.createOscillator();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.length * 0.8);
  const g = envelope(ac, t, opts.peak, opts.length, opts.attack);
  let out: AudioNode = osc;
  if (opts.lowpass) out = osc.connect(filter(ac, "lowpass", opts.lowpass));
  out.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + opts.length + 0.05);
}

/** How loud something `rows` away sounds: full at the player's row, fading out over a few rows. */
const near = (rows: number, reach = 4) => Math.max(0, 1 - Math.abs(rows) / reach);

/**
 * A soft mouth pop: a sine whose pitch flicks quickly upward, like a finger popped from the cheek,
 * rounded off by a low-pass filter. Each pop is pitched a little differently so hops don't sound
 * mechanical; `big` (a super hop) pops lower and lasts a touch longer.
 */
export function pop(big = false) {
  const ac = audio();
  if (!ac) return;
  const pitch = (big ? 0.75 : 1) * (0.92 + Math.random() * 0.16);
  const length = big ? 0.12 : 0.09;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(820 * pitch, t + length * 0.55);
  osc.connect(filter(ac, "lowpass", 1800)).connect(envelope(ac, t, 0.22, length, 0.004)).connect(master!);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

let lastCar = 0;

/**
 * A car going past the player: a swell of road noise whose pitch drops as it passes (a little
 * Doppler), over a low engine note. Trucks and buses sound lower. `rows` is how far the lane is.
 */
export function carPass(rows: number, length: number) {
  const ac = audio();
  if (!ac) return;
  const level = near(rows, 3);
  // Busy roads can pass several cars at once; keep it from turning into a wall of noise.
  if (level <= 0 || ac.currentTime - lastCar < 0.12) return;
  lastCar = ac.currentTime;
  const t = ac.currentTime;
  const heavy = length > 1.5;
  const pitch = (heavy ? 0.7 : 1) * (0.9 + Math.random() * 0.2);
  hiss(ac, t, { type: "lowpass", from: 1500 * pitch, to: 600 * pitch, peak: 0.3 * level, length: 0.45, attack: 0.18 });
  tone(ac, t, { type: "sawtooth", from: 110 * pitch, to: 80 * pitch, peak: 0.08 * level, length: 0.45, attack: 0.18, lowpass: 400 });
}

/** The crossing bell before a train: three bright dings. */
export function trainBell(rows: number) {
  const ac = audio();
  if (!ac) return;
  const level = near(rows, 6);
  if (level <= 0) return;
  for (let i = 0; i < 3; i++) {
    const t = ac.currentTime + i * 0.28;
    tone(ac, t, { type: "triangle", from: 1320, peak: 0.12 * level, length: 0.25, attack: 0.002 });
    tone(ac, t, { type: "sine", from: 2640, peak: 0.03 * level, length: 0.12, attack: 0.002 });
  }
}

/** A train arriving: a two-note horn over a long rumble. */
export function trainHorn(rows: number) {
  const ac = audio();
  if (!ac) return;
  const level = near(rows, 6);
  if (level <= 0) return;
  const t = ac.currentTime;
  for (const f of [311, 370]) tone(ac, t, { type: "sawtooth", from: f, peak: 0.09 * level, length: 0.9, attack: 0.04, lowpass: 1400 });
  hiss(ac, t, { type: "lowpass", from: 260, peak: 0.4 * level, length: 1.8, attack: 0.3 });
}

/** The train thundering past the player's column. */
export function trainPass(rows: number) {
  const ac = audio();
  if (!ac) return;
  const level = near(rows, 4);
  if (level <= 0) return;
  const t = ac.currentTime;
  hiss(ac, t, { type: "lowpass", from: 700, to: 300, peak: 0.5 * level, length: 1.2, attack: 0.1 });
  // The clatter of wheels over rail joints.
  for (let i = 0; i < 6; i++) hiss(ac, t + i * 0.16, { type: "bandpass", from: 2200, q: 3, peak: 0.12 * level, length: 0.06, attack: 0.002 });
}

/** Falling into water: a bright splash and a sinking bloop. */
export function splash() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  hiss(ac, t, { type: "bandpass", from: 2400, to: 700, q: 0.7, peak: 0.45, length: 0.6, attack: 0.004 });
  tone(ac, t + 0.05, { type: "sine", from: 700, to: 140, peak: 0.25, length: 0.35, attack: 0.01 });
  for (let i = 0; i < 3; i++) {
    const at = t + 0.35 + i * 0.12 + Math.random() * 0.05;
    tone(ac, at, { type: "sine", from: 500 + Math.random() * 300, to: 900, peak: 0.06, length: 0.07, attack: 0.004 });
  }
}

/** Falling into lava: a fierce sizzle over a low, heavy plop. */
export function sizzle() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, { type: "sine", from: 220, to: 60, peak: 0.35, length: 0.4, attack: 0.005 });
  hiss(ac, t, { type: "bandpass", from: 3500, to: 2500, q: 0.6, peak: 0.22, length: 1.3, attack: 0.02 });
  // Crackles in the sizzle.
  for (let i = 0; i < 10; i++) {
    hiss(ac, t + 0.05 + Math.random() * 1, { type: "bandpass", from: 2000 + Math.random() * 2500, q: 4, peak: 0.15, length: 0.03, attack: 0.001 });
  }
}

/** Getting hit by a car (or, `heavy`, a train): a thump with a crunch of metal. */
export function crash(heavy = false) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, { type: "sine", from: heavy ? 110 : 160, to: 45, peak: 0.5, length: heavy ? 0.5 : 0.3, attack: 0.002 });
  hiss(ac, t, { type: "lowpass", from: 2600, to: 400, peak: 0.45, length: heavy ? 0.7 : 0.4, attack: 0.002 });
  tone(ac, t + 0.02, { type: "square", from: 420, to: 260, peak: 0.07, length: 0.18, attack: 0.002, lowpass: 2000 });
}

// ---- River ambience --------------------------------------------------------------

let river: { gain: GainNode; tone: BiquadFilterNode } | null = null;
let riverHeard = 0;

/**
 * The steady murmur of a nearby river (or the low rumble of a lava flow), as a level from 0 to 1.
 * Call every frame; if the calls stop (game paused, store open) it fades out by itself.
 */
export function riverAmbience(level: number, lava = false) {
  const ac = audio();
  if (!ac) return;
  if (!river) {
    const src = noise(ac);
    const tone = filter(ac, "lowpass", 600, 0.5);
    // A slow wobble in the filter makes the water sound like it's moving.
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 0.35;
    depth.gain.value = 180;
    lfo.connect(depth).connect(tone.frequency);
    const gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(tone).connect(gain).connect(master!);
    src.start();
    lfo.start();
    river = { gain, tone };
    window.setInterval(() => {
      if (river && ac.currentTime - riverHeard > 0.25) river.gain.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    }, 250);
  }
  riverHeard = ac.currentTime;
  river.gain.gain.setTargetAtTime(0.07 * level, ac.currentTime, 0.3);
  river.tone.frequency.setTargetAtTime(lava ? 220 : 650, ac.currentTime, 0.3);
}
