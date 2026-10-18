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

## Code layout

- `src/game/` holds the rules with no rendering: `lanes.ts` generates lanes, `engine.ts` runs hopping, collisions, the camera focus and scoring.
- `src/components/` renders it: `Scene.tsx` (camera, lights, player, eagle), `Lanes.tsx` (each lane type), `models.tsx` (voxel models), `Game.tsx` (HUD and input).
