// The world cycles through themed biomes as the player hops forward. Biomes only
// change how lanes look; the mechanics of each lane type stay the same.

export type BiomeId =
  | "meadow"
  | "farm"
  | "safari"
  | "savannah"
  | "desert"
  | "beach"
  | "jungle"
  | "city"
  | "spooky"
  | "volcano"
  | "northpole";

export interface Biome {
  id: BiomeId;
  label: string;
  /** Alternating ground colours for grass lanes. */
  grass: [string, string];
  road: string;
  /** Lane marking colour between consecutive road lanes. */
  marking: string;
  water: string;
  railBed: string;
  carColors: string[];
  truckColors: string[];
  trainColors: string[];
}

export const BIOMES: Record<BiomeId, Biome> = {
  meadow: {
    id: "meadow",
    label: "Meadow",
    grass: ["#a6e35f", "#9ad653"],
    road: "#575c66",
    marking: "#e8e8e8",
    water: "#5fc6f0",
    railBed: "#8a7b6c",
    carColors: ["#e94f37", "#f6c90e", "#3f88c5", "#44bba4", "#f49d37", "#a663cc", "#ffffff"],
    truckColors: ["#3f88c5", "#e94f37", "#44bba4", "#f6f6f6"],
    trainColors: ["#d64545", "#3a7bd5", "#f2b134", "#4caf50"],
  },
  farm: {
    id: "farm",
    label: "Farm",
    grass: ["#8fd44c", "#84c943"],
    road: "#a07a52",
    marking: "#c9a678",
    water: "#58b9e0",
    railBed: "#8a7b6c",
    carColors: ["#d93a2b", "#3f9d3a", "#2f6fbf", "#f2b134"],
    truckColors: ["#c8a24a", "#e3c26b"],
    trainColors: ["#7a3b2e", "#c9842f", "#e0c48a", "#5d7f3a"],
  },
  safari: {
    id: "safari",
    label: "Safari",
    grass: ["#b7c460", "#acb957"],
    road: "#b8895a",
    marking: "#d6ad80",
    water: "#5bb3a6",
    railBed: "#9a7a5a",
    carColors: ["#c9b27c", "#7c8a4a", "#d8c79a", "#6f7a3c"],
    truckColors: ["#8d9196", "#9a9ea3"],
    trainColors: ["#5f6b3a", "#c9b27c", "#8a6a3e", "#d8c79a"],
  },
  savannah: {
    id: "savannah",
    label: "Savannah",
    grass: ["#e8c35a", "#ddb84f"],
    road: "#c79e66",
    marking: "#e2c08c",
    water: "#4fa8c7",
    railBed: "#a5835c",
    carColors: ["#ffffff"],
    truckColors: ["#9da2a8"],
    trainColors: ["#b5532f", "#e09a3c", "#f0d27a", "#7a4a2a"],
  },
  desert: {
    id: "desert",
    label: "Desert",
    grass: ["#ecd08f", "#e4c682"],
    road: "#b9925e",
    marking: "#e8d2a6",
    water: "#4fb6c9",
    railBed: "#a98a62",
    carColors: ["#e94f37", "#3f88c5", "#f6c90e", "#44bba4"],
    truckColors: ["#c8a06a"],
    trainColors: ["#b5532f", "#d9a45b", "#8a5a3a", "#e6c58f"],
  },
  beach: {
    id: "beach",
    label: "Beach",
    grass: ["#f6e2a8", "#efd99a"],
    road: "#c8a27a",
    marking: "#e8cfa9",
    water: "#2fb3d6",
    railBed: "#b59c7c",
    carColors: ["#e5533d", "#f07a3a"],
    truckColors: ["#ffffff", "#ffd1dc", "#bfe9ff"],
    trainColors: ["#ff6f61", "#ffd166", "#06d6a0", "#118ab2"],
  },
  jungle: {
    id: "jungle",
    label: "Jungle",
    grass: ["#5fae3f", "#55a238"],
    road: "#7a5a3c",
    marking: "#9c7b55",
    water: "#3f9a8a",
    railBed: "#6f5a44",
    carColors: ["#f29c38", "#e8892c"],
    truckColors: ["#4f7a3a"],
    trainColors: ["#3d6b35", "#8a6a3e", "#c9842f", "#5d7f3a"],
  },
  city: {
    id: "city",
    label: "City",
    grass: ["#c9ccd2", "#bdc1c8"],
    road: "#3f444d",
    marking: "#f6c90e",
    water: "#4a8fb8",
    railBed: "#6d6f74",
    carColors: ["#f6c90e", "#f6c90e", "#e94f37", "#3f88c5", "#ffffff", "#2b2f36"],
    truckColors: ["#d93a2b", "#3f88c5", "#44bba4"],
    trainColors: ["#b9c0c8", "#9aa3ad", "#c9d0d8", "#aab2bb"],
  },
  spooky: {
    id: "spooky",
    label: "Spooky",
    grass: ["#4f6a3f", "#48613a"],
    road: "#3b3640",
    marking: "#a07cc5",
    water: "#3c5a6b",
    railBed: "#4d4350",
    carColors: ["#e8eef2", "#d6e0e6"],
    truckColors: ["#1f1c24"],
    trainColors: ["#3b2f45", "#5a4a6b", "#ff8c1a", "#2b2530"],
  },
  volcano: {
    id: "volcano",
    label: "Volcano",
    grass: ["#5a4e4a", "#524643"],
    road: "#3a3433",
    marking: "#ff7a2f",
    water: "#ff6a1a",
    railBed: "#4a403c",
    carColors: ["#5b5f66", "#7a2e1f", "#8a8f96"],
    truckColors: ["#f2b134", "#d98c1f"],
    trainColors: ["#2b2626", "#4a403c", "#7a2e1f", "#3a3433"],
  },
  northpole: {
    id: "northpole",
    label: "North Pole",
    grass: ["#f4f8fc", "#e6eef6"],
    road: "#b7cde0",
    marking: "#ffffff",
    water: "#3d86c6",
    railBed: "#9fb3c4",
    carColors: ["#e94f37", "#3f88c5", "#2f9e5a", "#f6c90e"],
    truckColors: ["#c0392b"],
    trainColors: ["#c0392b", "#2f7d4a", "#f2f2f2", "#d4af37"],
  },
};

/** The order biomes appear in; after the last one the cycle starts over. */
export const BIOME_ORDER: BiomeId[] = [
  "meadow",
  "farm",
  "safari",
  "savannah",
  "desert",
  "beach",
  "jungle",
  "city",
  "spooky",
  "volcano",
  "northpole",
];
/** Rows each biome lasts before the next one takes over. */
export const BIOME_LENGTH = 50;

export const biomeAt = (row: number): BiomeId =>
  BIOME_ORDER[Math.floor(Math.max(0, row) / BIOME_LENGTH) % BIOME_ORDER.length];
