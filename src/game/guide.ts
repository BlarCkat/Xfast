import { traitsAt } from "./characters";
import type { PickupKind } from "./lanes";
import { CHARACTERS, type CharacterId, type StoreItemId } from "./wallet";

// The chicken's tips. Instead of one long lesson, the chicken pops up the first time something
// happens (a road ahead, a power-up picked up, a new character) and explains just that, in short
// words for a young reader.

/** What sits beside the chicken on a page: a power-up or coin picture, or a turning character. */
export type GuideArt = { icon: StoreItemId | "coin" } | { model: CharacterId };

export interface GuidePage {
  text: string;
  art?: GuideArt;
}

/** Moments the chicken has something to say about. Power-ups and hearts use their own names. */
export type HintId = "start" | "side" | "road" | "river" | "rail" | "eagle" | "coin" | "duck-saved" | "inventory" | PickupKind;

const KEY = "xfast-guide";
const BEST_KEY = "xfast-best";

interface GuideState {
  /** Tips already shown. */
  seen: string[];
  /** Characters the chicken has already introduced. */
  met: CharacterId[];
}

/** Tips a returning player has learned by playing, so they aren't told again. */
const BASIC_TIPS: HintId[] = ["start", "side", "road", "river", "rail", "eagle", "coin"];

function load(): GuideState {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<GuideState> & { basics?: boolean }) : {};
    // Someone with a top score (or who saw the old walkthrough) already knows the basics.
    const veteran = !!saved.basics || Number(localStorage.getItem(BEST_KEY)) > 0;
    const seen = Array.isArray(saved.seen) ? saved.seen : veteran ? BASIC_TIPS : [];
    const met = Array.isArray(saved.met) ? saved.met : [];
    return { seen, met: veteran && !met.includes("chicken") ? [...met, "chicken"] : met };
  } catch {
    return { seen: [], met: [] };
  }
}

let state: GuideState | null = null;
const get = () => (state ??= load());

function save(next: GuideState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Without storage the tips just show again next visit.
  }
}

/** Is a phone or tablet: taps and swipes rather than keys. */
export const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** What each power-up and the heart do, in a few simple words. */
const PICKUP_TIPS: Record<PickupKind, string> = {
  life: "A heart! That's an extra life. Now you get one more try!",
  foresight: "Foresight! See-through cars show where the real cars will go.",
  slowmo: "Slowmo! Everything goes slow, but you stay fast.",
  rock: "Rock! You're made of stone. Cars that bump you go crash!",
  magnet: "Magnet! Coins near you fly right to you.",
  double: "Double coins! Every coin counts two times.",
  superhop: "Super hop! Each hop forward jumps two rows.",
  shield: "Shield! A bubble keeps you safe from one bump.",
  freeze: "Freeze! All the cars and trains stop still.",
  wings: "Wings! You can fly over the water for a little while.",
  scarecrow: "Scarecrow! The eagle stays away, so you can take your time.",
  ghost: "Ghost! Cars and trains go right through you.",
  tiny: "Tiny! You're so small that cars have a harder time hitting you.",
  lumberjack: "Lumberjack! Hop into trees to chop them down.",
  warp: "Warp! Zoom! You jumped far ahead.",
  coinrain: "Coin rain! Coins fell all over the road ahead. Go grab them!",
};

/** The page for one tip. */
function tipPages(id: HintId, touch: boolean): GuidePage[] {
  if (id in PICKUP_TIPS) return [{ text: PICKUP_TIPS[id as PickupKind], art: { icon: id as PickupKind } }];
  switch (id) {
    case "start":
      return [
        { text: "Hi! I'm Chicken. I'll help you play!" },
        { text: touch ? "Tap the screen to hop forward. Hop, hop, hop!" : "Press the up arrow to hop forward. Hop, hop, hop!" },
      ];
    case "side":
      return [{ text: touch ? "A tree is in the way! Swipe left or right to hop around it." : "A tree is in the way! Press left or right to hop around it." }];
    case "road":
      return [{ text: "Cars! Wait for a gap, then hop across." }];
    case "river":
      return [{ text: "Water is too deep to swim. Hop on the logs to get across!" }];
    case "rail":
      return [{ text: "Train tracks! When the red light blinks, a train is coming. Stay back!" }];
    case "eagle":
      return [{ text: "Keep hopping! If you stop too long, a big eagle will grab you!" }];
    case "coin":
      return [{ text: "You got a coin! Save coins to buy new friends.", art: { icon: "coin" } }];
    case "duck-saved":
      return [{ text: touch ? "Duck saved it! Tap it at the bottom when you need it." : "Duck saved it! Press its number key when you need it.", art: { icon: "shield" } }];
    case "inventory":
      return [{ text: touch ? "Your power-ups wait at the bottom. Tap one to use it!" : "Your power-ups wait at the bottom. Press its number key to use it!", art: { icon: "magnet" } }];
  }
  return [];
}

/** A character's pages: who they are, then their power one idea at a time, using their current numbers. */
function abilityPages(id: CharacterId, tier: number): GuidePage[] {
  const t = traitsAt(id, tier);
  const self = { model: id } as const;
  switch (id) {
    case "chicken":
      return [{ text: "My super power? Power-ups last longer when I have them!", art: { icon: "slowmo" } }];
    case "duck":
      return [
        { text: "Duck keeps the power-ups it finds, to use later.", art: { icon: "shield" } },
        { text: "If Duck falls in the water, Duck dives down deep! Duck pops up at the next river.", art: self },
      ];
    case "frog":
      return [{ text: "Frog never falls in the water. Frog always lands on the closest log!", art: self }];
    case "penguin":
      return [{ text: "Penguin starts with a bubble shield. It keeps Penguin safe from one bump!", art: { icon: "shield" } }];
    case "cat":
      return [
        { text: "Cat has nine lives. That's lots of tries!", art: { icon: "life" } },
        { text: "Keep hopping, and Cat grows lost lives back.", art: { icon: "life" } },
      ];
    case "robot":
      return [{ text: "Robot can see what happens next! See-through cars show where real cars will go.", art: { icon: "foresight" } }];
    case "sparrow":
      return [
        { text: `Every ${t.timeTraitHops} hops, Sparrow stops time. Everything freezes!`, art: { icon: "freeze" } },
        { text: "Hop fast while everything is still!", art: self },
      ];
    case "snail":
      return [
        { text: `Every ${t.timeTraitHops} hops, Snail makes everything go slooow.`, art: { icon: "slowmo" } },
        { text: "Hop past the slow cars!", art: self },
      ];
    case "mario":
      return [
        { text: "The first bump makes Mario small. But he keeps playing!", art: self },
        { text: `Every ${t.marioCoinsPerLife} coins gives Mario an extra life!`, art: { icon: "life" } },
      ];
    case "luigi":
      return [
        { text: "Luigi's vacuum sucks up coins near him. Whoosh!", art: { icon: "magnet" } },
        { text: "In the spooky land, nothing can hurt Luigi!", art: { icon: "ghost" } },
      ];
    case "bowser":
      return [
        { text: "Bowser smashes right through trees and rocks. Crash!", art: { icon: "lumberjack" } },
        { text: `Every ${t.bowserFireHops} hops, Bowser breathes fire and burns the cars ahead!`, art: self },
      ];
    case "human":
      return [{ text: "Every coin Human picks up counts two times. Double coins!", art: { icon: "double" } }];
    case "leopard":
      return [{ text: `Every ${t.leapHops} hops, Leopard does a giant pounce to safe grass!`, art: { icon: "warp" } }];
    case "owl":
      return [{ text: `Every ${t.leapHops} hops, Owl flies up. Owl can fly over water!`, art: { icon: "wings" } }];
    case "tiger":
      return [
        { text: `Every ${t.tigerRoarHops} hops, Tiger lets out a big ROAR!`, art: self },
        { text: "Each roar puts up a shield. The next bump just bounces off!", art: { icon: "shield" } },
      ];
  }
}

/** The pages for meeting a character for the first time: who they are, and their power. */
export function meetPages(id: CharacterId, tier: number): GuidePage[] {
  const name = CHARACTERS.find((c) => c.id === id)!.name;
  const pages = abilityPages(id, tier);
  const hello = id === "chicken" ? "" : `This is ${name}! `;
  return pages.map((p, i) => (i === 0 ? { ...p, text: hello + p.text, art: { model: id } } : p));
}

/** A tip the chicken hasn't given yet, or null. */
export function tip(id: HintId, touch = isTouch()): GuidePage[] | null {
  return get().seen.includes(id) ? null : tipPages(id, touch);
}

/** A tip for picking something up; the chicken adds its own power the first time it grabs a power-up. */
export function pickupTip(kind: PickupKind, character: CharacterId): { pages: GuidePage[]; character: CharacterId | null } | null {
  const pages = tip(kind) ?? [];
  const chicken = character === "chicken" && kind !== "life" && !get().met.includes("chicken");
  if (chicken) pages.push(...meetPages("chicken", 1));
  return pages.length ? { pages, character: chicken ? "chicken" : null } : null;
}

/** What to say before a run starts: hello for a new player, and the character if they're new. */
export function beforeRun(id: CharacterId, tier: number, hasPowerups: boolean): { pages: GuidePage[]; tips: HintId[]; character: CharacterId | null } | null {
  const s = get();
  const pages: GuidePage[] = [];
  const tips: HintId[] = [];
  const add = (t: HintId) => {
    const p = tip(t);
    if (p) {
      pages.push(...p);
      tips.push(t);
    }
  };
  add("start");
  // The chicken's own power is told the first time it picks up a power-up (see powerupTip).
  const meet = id !== "chicken" && !s.met.includes(id);
  if (meet) pages.push(...meetPages(id, tier));
  if (hasPowerups) add("inventory");
  return pages.length ? { pages, tips, character: meet ? id : null } : null;
}

/** Remember tips given, and the character introduced. */
export function markSeen(tips: HintId[], character: CharacterId | null = null) {
  const s = get();
  const met = character && !s.met.includes(character) ? [...s.met, character] : s.met;
  save({ seen: Array.from(new Set([...s.seen, ...tips])), met });
}
