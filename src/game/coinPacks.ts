export type PackId = "pocket" | "bag" | "chest";

export interface CoinPack {
  id: PackId;
  name: string;
  coins: number;
  /** Shown in the store only. The real price is whatever the Lemon Squeezy variant charges, so keep them in step. */
  price: string;
  description: string;
}

export const COIN_PACKS: CoinPack[] = [
  { id: "pocket", name: "Pocket of coins", coins: 300, price: "$0.99", description: "Enough for a new character or a handful of power-ups." },
  { id: "bag", name: "Bag of coins", coins: 1000, price: "$2.99", description: "Unlock a couple of characters and start upgrading." },
  { id: "chest", name: "Chest of coins", coins: 3000, price: "$6.99", description: "The best value. Unlock everyone and max out your favourite power-ups." },
];

export const isPackId = (id: unknown): id is PackId => COIN_PACKS.some((p) => p.id === id);
