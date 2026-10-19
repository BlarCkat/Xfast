// The world cycles through themed biomes as the player hops forward. Biomes only
// change how lanes look; the mechanics of each lane type stay the same.

export type BiomeId = "meadow" | "farm" | "safari" | "savannah" | "city" | "northpole";

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
export const BIOME_ORDER: BiomeId[] = ["meadow", "farm", "safari", "savannah", "city", "northpole"];
/** Rows each biome lasts before the next one takes over. */
export const BIOME_LENGTH = 50;

export const biomeAt = (row: number): BiomeId =>
  BIOME_ORDER[Math.floor(Math.max(0, row) / BIOME_LENGTH) % BIOME_ORDER.length];
