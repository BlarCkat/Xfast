// Sound: effects synthesised with the Web Audio API (so they add nothing to the download), plus the
// background music track. Volumes and the music switch live in Options and are remembered.

export interface AudioSettings {
  /** Sound effects volume, 0 to 1. */
  sfx: number;
  /** Music volume, 0 to 1. */
  music: number;
  musicOn: boolean;
  track: TrackId;
}

/** The background tracks, both loudness-matched; the first is the default. */
export const TRACKS = [
  { id: "theme", name: "Roadmasters" },
  { id: "pixel-pulse", name: "Pixel Pulse" },
] as const;
export type TrackId = (typeof TRACKS)[number]["id"];

const SETTINGS_KEY = "xfast-audio";
const DEFAULTS: AudioSettings = { sfx: 0.8, music: 0.5, musicOn: true, track: "theme" };
/**
 * Music at full volume sits about 9 dB under the effects at full volume, so hops and coins always
 * cut through it at matching slider positions.
 */
const MUSIC_HEADROOM = 0.35;

let settings: AudioSettings = DEFAULTS;
const listeners = new Set<() => void>();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<AudioSettings>;
    settings = { ...DEFAULTS, ...saved };
    if (!TRACKS.some((t) => t.id === settings.track)) settings.track = DEFAULTS.track;
  } catch {
    settings = DEFAULTS;
  }
}
if (typeof window !== "undefined") loadSettings();

export const audioSettings = () => settings;
export function onAudioSettings(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function setAudioSettings(next: Partial<AudioSettings>) {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings still apply for this visit.
  }
  applyVolumes();
  if (settings.musicOn) void startMusic();
  listeners.forEach((fn) => fn());
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let music: HTMLAudioElement | null = null;
let noiseBuffer: AudioBuffer | null = null;
// The button sound (see the end of this file); declared up here because unlocking audio loads it.
const BUTTON_SRC = "/audio/ui/button.wav";
let buttonData: Promise<ArrayBuffer | null> | null = null;
let buttonBuffer: AudioBuffer | null = null;
let lastButton = -1;

function applyVolumes() {
  if (!ctx || !master || !musicBus) return;
  // Squared, so the sliders feel even to the ear rather than all the change bunching at the top.
  master.gain.setTargetAtTime(settings.sfx ** 2, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(settings.musicOn ? settings.music ** 2 * MUSIC_HEADROOM : 0, ctx.currentTime, 0.05);
  if (music && !settings.musicOn) music.pause();
}

/** The shared audio context. Browsers only allow sound after a tap or key press; see unlock(). */
function audio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    // On iPhones this lets the game play even with the silent switch on, like other games.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(ctx.destination);
    applyVolumes();
    loadButtonSound(ctx);
    // Go quiet with the tab, so the music and the river don't keep running in the background.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        void ctx?.suspend();
        music?.pause();
      } else {
        void ctx?.resume();
        if (settings.musicOn) void music?.play().catch(() => {});
      }
    });
  }
  if (ctx.state === "suspended" && !document.hidden) void ctx.resume();
  return ctx;
}

/** Stream the background track on a loop, through the music volume. Resolves once it is playing (or refused). */
function startMusic() {
  const ac = audio();
  if (!ac || !musicBus) return Promise.resolve();
  if (!music) {
    music = new Audio();
    music.loop = true;
    music.crossOrigin = "anonymous";
    ac.createMediaElementSource(music).connect(musicBus);
  }
  // Opus is about a third smaller at the same quality; older Safari falls back to MP3.
  const opus = music.canPlayType('audio/webm; codecs="opus"') !== "";
  const src = `/audio/${settings.track}.${opus ? "webm" : "mp3"}`;
  if (!music.src.endsWith(src)) music.src = src;
  return music.paused ? music.play().catch(() => {}) : Promise.resolve();
}

// Music starts as soon as the game opens where the browser allows it. Most only allow sound after a
// tap or key press, so every one tries again until the audio is actually running. A touch only counts
// once the finger lifts, so the first pointerdown on a phone is too early and mustn't end the retries.
if (typeof window !== "undefined") {
  const events = ["pointerdown", "pointerup", "keydown", "touchend", "click"];
  const unlock = () => {
    const ac = audio();
    if (!ac) return;
    const playing = settings.musicOn ? startMusic() : Promise.resolve();
    void Promise.all([ac.resume().catch(() => {}), playing]).then(() => {
      if (ac.state !== "running" || (settings.musicOn && music?.paused)) return;
      for (const e of events) window.removeEventListener(e, unlock, true);
    });
  };
  for (const e of events) window.addEventListener(e, unlock, true);
  if (settings.musicOn) {
    if (document.readyState === "complete") unlock();
    else window.addEventListener("load", unlock, { once: true });
  }
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
  osc.connect(filter(ac, "lowpass", 1800)).connect(envelope(ac, t, 0.32, length, 0.004)).connect(master!);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

let lastCar = 0;

let lastCoin = 0;

/**
 * Picking up a coin: two quick bell notes a major third apart (about F#6 then A#6), each with a
 * soft octave below and above so it rings like a little bell. Modelled on the reference clip the
 * player sent; double coins ring a little higher.
 */
export function coin(double = false) {
  const ac = audio();
  if (!ac) return;
  // Magnet pulls can land several at once; let the chimes overlap but not pile up.
  const t = Math.max(ac.currentTime, lastCoin + 0.06);
  lastCoin = t;
  const k = double ? 1.12 : 1;
  const bell = (at: number, f: number, ring: number) => {
    tone(ac, at, { type: "sine", from: f, peak: 0.22, length: ring, attack: 0.003 });
    tone(ac, at, { type: "sine", from: f / 2, peak: 0.04, length: ring * 0.6, attack: 0.003 });
    tone(ac, at, { type: "sine", from: f * 2, peak: 0.025, length: ring * 0.4, attack: 0.002 });
  };
  bell(t, 1480 * k, 0.6);
  bell(t + 0.13, 1870 * k, 1.1);
}

/** One sweep of the upgrade dot grid takes this long; the card's CSS animation matches it. */
export const UPGRADE_SWEEP = 2 / 3;

/**
 * Upgrading: one tick per row of the dot grid as it sweeps up the card three times. The ticks climb
 * all the way through, starting deep and round and ending light and bright, over a low swell.
 */
export function upgrade() {
  const ac = audio();
  if (!ac) return;
  const rows = 8;
  const ticks = rows * 3;
  const t0 = ac.currentTime;
  tone(ac, t0, { type: "sine", from: 55, to: 110, peak: 0.22, length: UPGRADE_SWEEP * 1.2, attack: 0.08 });
  for (let i = 0; i < ticks; i++) {
    const t = t0 + (i / rows) * UPGRADE_SWEEP;
    const k = i / (ticks - 1);
    // About three and a half octaves, from 110 Hz to 1250 Hz.
    const f = 110 * 2 ** ((i * 1.8) / 12);
    tone(ac, t, { type: "triangle", from: f, peak: 0.16 - k * 0.07, length: 0.09 - k * 0.03, attack: 0.002, lowpass: 600 + k * 5000 });
    tone(ac, t, { type: "sine", from: f * 2, peak: 0.01 + k * 0.04, length: 0.05, attack: 0.002 });
  }
}

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

// ---- Button sound ----------------------------------------------------------------

// The one recorded effect: a short click for pointing at or pressing a button in the menus and store.
// It is fetched as soon as the game opens and decoded once the audio context exists, so the first
// hover after the player's first tap already has it ready.

function fetchButtonSound() {
  buttonData ??= fetch(BUTTON_SRC)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  return buttonData;
}
if (typeof window !== "undefined") void fetchButtonSound();

function loadButtonSound(ac: AudioContext) {
  void fetchButtonSound().then((data) => {
    if (!data || buttonBuffer) return;
    return ac.decodeAudioData(data.slice(0)).then((b) => void (buttonBuffer = b), () => {});
  });
}

/** The button click, through the effects volume. Rapid calls (sweeping across a row of buttons) are thinned out. */
export function button() {
  const ac = audio();
  if (!ac || !buttonBuffer || ac.state !== "running") return;
  if (ac.currentTime - lastButton < 0.07) return;
  lastButton = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = buttonBuffer;
  src.connect(master!);
  src.start();
}

// Every button in the menus, store and dialogs clicks when the mouse moves onto it, when the keyboard
// moves focus to it, and when it is pressed. The power-up buttons used mid-run stay quiet, as they
// are part of play rather than menus. Touch screens only get the press, since a tap has no hover.
if (typeof window !== "undefined") {
  const target = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.("button");
    return el && !el.disabled && !el.closest(".use-power") ? el : null;
  };
  let hovered: Element | null = null;
  window.addEventListener(
    "pointerover",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const el = target(e);
      if (el && el !== hovered) button();
      hovered = el;
    },
    true,
  );
  window.addEventListener(
    "focusin",
    (e) => {
      const el = target(e);
      if (el && el !== hovered && el.matches(":focus-visible")) button();
      if (el) hovered = el;
    },
    true,
  );
  // Presses sound on pointerdown rather than click: it feels instant, and the main menu acts on
  // pointerup and is gone before a click would arrive. Keyboard presses (Enter, Space) come as clicks.
  const press = () => {
    // A press right after the hover click still sounds, so pressing never feels dead.
    lastButton = -1;
    button();
  };
  window.addEventListener("pointerdown", (e) => void (target(e) && press()), true);
  window.addEventListener("click", (e) => void (e.detail === 0 && target(e) && press()), true);
}
