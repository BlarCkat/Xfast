import { traitsAt } from "./characters";
import { CHARACTERS, type CharacterId, type StoreItemId } from "./wallet";

// The chicken's walkthrough: a few simple pages for brand-new players, and a short hello the
// first time each character is played. Written for a young reader: short words, one idea a page.

/** What sits beside the chicken on a page: a power-up or coin picture, or a turning character. */
export type GuideArt = { icon: StoreItemId | "coin" } | { model: CharacterId };

export interface GuidePage {
  text: string;
  art?: GuideArt;
}

const KEY = "xfast-guide";
const BEST_KEY = "xfast-best";

interface GuideState {
  /** The how-to-play pages have been shown. */
  basics: boolean;
  /** Characters the chicken has already introduced. */
  met: CharacterId[];
}

function load(): GuideState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GuideState>;
      return { basics: !!saved.basics, met: Array.isArray(saved.met) ? saved.met : [] };
    }
    // Someone who already has a top score knows how to play, so only new players get the basics.
    const veteran = Number(localStorage.getItem(BEST_KEY)) > 0;
    return { basics: veteran, met: veteran ? ["chicken"] : [] };
  } catch {
    return { basics: true, met: ["chicken"] };
  }
}

let state: GuideState | null = null;
const get = () => (state ??= load());

function save(next: GuideState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Without storage the walkthrough just shows again next visit.
  }
}

/** Is a phone or tablet: taps and swipes rather than keys. */
export const isTouch = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

const BASICS = (touch: boolean): GuidePage[] => [
  { text: "Hi there! I'm Chicken. Let me show you how to play!" },
  { text: touch ? "Tap the screen to hop forward. Hop, hop, hop!" : "Press the up arrow to hop forward. Hop, hop, hop!" },
  { text: touch ? "Swipe left or right to hop to the side." : "Press left or right to hop to the side." },
  { text: "Look out for cars! Wait for a gap, then hop across." },
  { text: "Water is too deep to swim. Hop on the logs to get across!" },
  { text: "When the red light blinks, a train is coming. Stay back!" },
  { text: "Don't stop for too long. A big eagle will swoop down and grab you!" },
  { text: "Grab the shiny coins! You can buy new friends with them.", art: { icon: "coin" } },
  { text: "Hearts give you an extra life. Then you get another try!", art: { icon: "life" } },
  { text: "Grab glowing power-ups to get super powers!", art: { icon: "shield" } },
  {
    text: touch ? "Power-ups you buy wait at the bottom. Tap one to use it!" : "Power-ups you buy wait at the bottom. Press its number key to use it!",
    art: { icon: "magnet" },
  },
];

/** A character's pages: who they are, then their power one idea at a time, using their current numbers. */
function abilityPages(id: CharacterId, tier: number, touch: boolean): GuidePage[] {
  const t = traitsAt(id, tier);
  const self = { model: id } as const;
  switch (id) {
    case "chicken":
      return [{ text: "My super power? Power-ups last longer when I have them!", art: { icon: "slowmo" } }];
    case "duck":
      return [
        { text: "Duck keeps the power-ups it finds. They wait at the bottom of the screen.", art: { icon: "shield" } },
        { text: touch ? "Tap one when you need it!" : "Press its number key when you need it!", art: { icon: "shield" } },
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
  }
}

const AUTO = "You don't have to do anything. It happens all by itself!";

/** Characters whose power needs no button. */
const AUTOMATIC: CharacterId[] = ["chicken", "frog", "penguin", "cat", "robot", "sparrow", "snail", "mario", "luigi", "bowser", "human", "leopard", "owl"];

/** The pages for meeting a character for the first time. */
export function meetPages(id: CharacterId, tier: number, touch = isTouch()): GuidePage[] {
  const name = CHARACTERS.find((c) => c.id === id)!.name;
  const hello = id === "chicken" ? "You picked me! Let me tell you about my super power." : `Ooh, you picked ${name}! Let me tell you about ${name}'s super power.`;
  const pages: GuidePage[] = [{ text: hello, art: { model: id } }];
  pages.push(...abilityPages(id, tier, touch));
  if (AUTOMATIC.includes(id)) pages.push({ text: AUTO, art: { model: id } });
  pages.push({ text: "Have fun! Let's go!", art: { model: id } });
  return pages;
}

/** The pages for a brand-new player: how to play, then the chicken's own power. */
export function basicsPages(touch = isTouch()): GuidePage[] {
  return [...BASICS(touch), ...abilityPages("chicken", 1, touch), { text: "You're ready! Let's go!" }];
}

/** What to show before this run starts, or null when the chicken has nothing new to say. */
export function pendingGuide(id: CharacterId, tier: number): { pages: GuidePage[]; character: CharacterId | null } | null {
  const s = get();
  if (!s.basics) {
    // A new player who already picked a friend hears about the basics first, then the friend.
    const pages = basicsPages();
    if (id !== "chicken") pages.splice(pages.length - 1, 1, ...meetPages(id, tier));
    return { pages, character: id };
  }
  if (!s.met.includes(id)) return { pages: meetPages(id, tier), character: id };
  return null;
}

/** Remember that the basics, and this character, have been explained. */
export function markSeen(character: CharacterId | null) {
  // The basics end with the chicken's own power, so the chicken is always met by now.
  const met = new Set<CharacterId>([...get().met, "chicken"]);
  if (character) met.add(character);
  save({ basics: true, met: [...met] });
}
