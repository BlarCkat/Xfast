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
- **Magnet (8s):** coins within 2 tiles fly to you.
- **2x coins (10s):** every coin counts twice.
- **Super hop (8s):** forward hops jump 2 rows when the landing spot is open.
- **Shield (20s or one hit):** a bubble absorbs one hit from a car or train.
- **Freeze (4s):** all traffic and trains stop where they are (a parked car still blocks you).
- **Wings (6s):** hover over water; you drop in if the wings run out while over open water.
- **Scarecrow (10s):** the eagle stays away, so standing still or falling behind is safe.
- **Ghost (6s):** cars and trains pass straight through you.
- **Tiny (8s):** you shrink, so traffic has to come closer to hit you.
- **Lumberjack (8s):** hop into trees to chop them down.
- **Warp (instant):** jump at least 6 rows ahead to open grass.
- **Coin rain (instant):** coins drop on the next 12 lanes.

## Getting faster

Every 1,000 hops in a run, cars, trucks and trains speed up by 20% (up to 3x). The HUD shows the current speed once it rises.

Lanes stay at their starting density until score 500. From there roads gradually get more cars, longer stretches of road and faster base traffic, rivers get shorter logs with wider gaps, and grass gets more trees, all reaching full difficulty at score 1,000.

## Biomes

Every 50 rows the world changes theme, then the cycle repeats after the eleventh. A new biome always starts on a strip of grass, and its name pops up as you enter it. Biomes change the look only; every lane plays the same.

| Biome | Obstacles | Road traffic | River |
| --- | --- | --- | --- |
| Meadow | Trees | Cars and trucks | Logs |
| Farm | Hay bales, corn, apple trees | Tractors and hay wagons | Logs |
| Safari | Bushes, boulders, baobabs | Safari jeeps and rhinos | Logs |
| Savannah | Dry grass, termite mounds, acacias | Zebras and elephants | Logs |
| Desert | Sandstone rocks, barrel cacti, saguaros | Dune buggies and camel caravans | Logs |
| Beach | Sandcastles, umbrellas, palms | Crabs and ice cream trucks | Pool floats |
| Jungle | Ferns, flowering bushes, jungle trees | Tigers and crocodiles | Logs |
| City | Hydrants, planters, buildings | Taxis, cars and buses | Logs |
| Spooky | Pumpkins, gravestones, dead trees | Ghosts and hearses | Coffins |
| Volcano | Lava rocks, obsidian spikes, mini volcanoes | Lava rovers and dump trucks | Basalt slabs on glowing lava |
| North Pole | Snowmen, presents, snowy pines | Snowmobiles and Santa's sleigh | Ice floes |

## Rendering

Every block has bevelled edges so light rolls over the corners. Lighting is baked into the models: when a car, log, coin or lane of trees appears, the sun and sky light, a soft darkening towards its base and a slight per-block colour wobble are written into its vertex colours, so it renders unlit. Ground lanes get small procedural textures (grass tufts, paving slabs in the city, snow, road grain, water ripples and rail gravel). The default **Realistic** mode adds post-processing: soft ambient occlusion where blocks meet the ground, HDR bloom on bright things (headlights, coins, lit city windows, the flashing rail light, sunlit snow), filmic tone mapping and a light vignette. Press **B** or use the button on the start screen to switch to **Classic**, which skips the post-processing and runs lighter on slow devices. The choice is saved in your browser.

Performance: every car, train, log, coin and lane of trees is merged into one mesh when it appears, so a frame costs a couple of hundred draw calls instead of about two thousand. Phones start on a lighter tier (bloom at half resolution, no ambient occlusion or anti-aliasing, 1.5x pixel density, smaller shadow map). If the frame rate stays under 45 fps the game steps down again, ending at no post-processing, no shadows and 1x pixel density.

## Code layout

- `src/game/` holds the rules with no rendering: `lanes.ts` generates lanes, `biomes.ts` defines the themes, `engine.ts` runs hopping, collisions, the camera focus and scoring.
- `src/components/` renders it: `Scene.tsx` (camera, lights, player, eagle), `Lanes.tsx` (each lane type), `models.tsx` and `biomeModels.tsx` (voxel models), `Game.tsx` (HUD and input).

## Characters

Each character has its own trait, shown on the start screen and in the store.

| Character | Price | Trait |
| --- | --- | --- |
| Chicken | Free | Power-ups last 50% longer. |
| Duck | 50 | Swims: landing in open water (or slipping off a log at the edge) is safe; it paddles in place until it hops on. |
| Frog | 100 | Never drowns: hops aim for the nearest log in the river ahead, and when a log drifts off the edge it leaps to the nearest log still in play. |
| Penguin | 150 | Starts every run with a 20s shield. |
| Cat | 200 | Starts every run with nine lives (eight extra on the HUD) and regrows lost ones: half a life every 20 hops after the first life is spent, doubling to 40, 80, and so on with each further life spent. A pink ring on the heart shows progress. |
| Robot | 250 | Foresight is always on. |
| Sparrow | 300 | Stops time (Freeze) every 100 hops. |
| Snail | 350 | Slows time (Slowmo) every 100 hops. |
| Mario | 400 | Super Mushroom: the first car or train hit shrinks him instead of costing a life, and he grows back in each new biome. Every 100 coins in a run is a 1-UP. |
| Luigi | 450 | Poltergust: pulls in coins within 2 tiles. Ghost hunter: nothing can hit him in the Spooky biome. |
| Bowser | 500 | Smashes through trees and rocks, and breathes fire every 50 hops to wreck the traffic on the next 4 lanes. |

## Upgrades

Every power-up can be upgraded in the store (select it on the Power-ups tab and press **U** or tap Upgrade), up to level 5. Each level adds a quarter of the base duration, so level 5 lasts twice as long. Warp jumps 2 more rows per level and Coin rain covers 4 more lanes per level. An upgrade costs four times the power-up's price times its current level (Foresight: 120, 240, 360, 480). Levels apply to power-ups you pick up on the road as well as ones bought in the store, and stack with the Chicken's 50% bonus.

## Coins and the store

- Coins sit on grass and road lanes. They are saved in your browser as soon as you pick them up, even if you die.
- Open the **Store** from the start or game over screen to unlock characters (Duck 50, Frog 100, Penguin 150, Cat 200, Robot 250, Sparrow 300, Snail 350, Mario 400, Luigi 450, Bowser 500) and buy power-ups (Foresight 30, Slowmo 30, Rock 40, Extra life 60).
- Bought power-ups appear as buttons in the bottom right during a run, or use keys 1 to 0 for the first ten power-ups in store order. Bought extra lives are added when your next run starts.
