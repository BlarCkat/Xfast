# Xfast

An endless voxel road-crossing hopper in the style of Crossy Road, built with Next.js, TypeScript and three.js (via @react-three/fiber).

## Play

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- **Keyboard:** arrows or WASD to hop, Space hops forward / restarts.
- **Touch:** tap to hop forward, swipe to hop in any direction.

## Rules

- Lanes are generated forever: grass (trees block you), roads (cars and trucks), rivers (ride the logs, the water kills), and railways (a warning light flashes before the train).
- Your score is the furthest row you reach. Your top score is saved in the browser.
- The camera keeps creeping forward. Fall too far behind it, or stand still too long, and the eagle takes you.
- Getting carried off the edge on a log drowns you.

## Lives and power-ups

- You start with 1 extra life (the heart counter, top right). Losing a life puts you back on the nearest grass with a short blinking shield.
- Collectibles appear on some grass and road lanes. Each one has a 20% chance to be a ♥ extra life; otherwise it is one of the power-ups below. Power-ups end early if you lose a life.
- **Foresight (5s):** ghost outlines show where cars, logs and trains will be over the next moment.
- **Slowmo (5s):** the world slows to about a third of its speed while you keep hopping at full speed.
- **Rock (6s):** you turn to stone and any car or truck that hits you is wrecked. Trains and water still get you.

## Code layout

- `src/game/` holds the rules with no rendering: `lanes.ts` generates lanes, `engine.ts` runs hopping, collisions, the camera focus and scoring.
- `src/components/` renders it: `Scene.tsx` (camera, lights, player, eagle), `Lanes.tsx` (each lane type), `models.tsx` (voxel models), `Game.tsx` (HUD and input).

## Coins and the store

- Coins sit on grass and road lanes. They are saved in your browser as soon as you pick them up, even if you die.
- Open the **Store** from the start or game over screen to unlock characters (Duck 50, Frog 100, Penguin 150, Robot 250) and buy power-ups (Foresight 30, Slowmo 30, Rock 40, Extra life 60).
- Bought power-ups appear as buttons in the bottom right during a run, or use keys 1, 2 and 3. Bought extra lives are added when your next run starts.
