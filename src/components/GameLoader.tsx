"use client";

import dynamic from "next/dynamic";

// WebGL only exists in the browser, so the game is never server-rendered.
const Game = dynamic(() => import("./Game"), { ssr: false });

export default function GameLoader() {
  return <Game />;
}
