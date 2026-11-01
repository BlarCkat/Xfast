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
| Underwater (duck only) | Coral, kelp, rocks, treasure chests | Sharks, fish, octopi, jellyfish and turtles | None; it ends at the river where the duck surfaces |

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
| Duck | 50 | Saves power-ups it picks up instead of using them; tap one in the HUD (or press its number) to use it any time that run. Falling in water dives to the seabed: 30 rows of coral, kelp and rocks with lanes of sharks, fish, octopi, jellyfish and turtles, ending at a river where it surfaces and paddles back to land. |
| Frog | 100 | Never drowns: hops aim for the nearest log in the river ahead, and when a log drifts off the edge it leaps to the nearest log still in play. |
| Penguin | 150 | Starts every run with a 20s shield. |
| Cat | 200 | Starts every run with nine lives (eight extra on the HUD) and regrows lost ones: half a life every 20 hops after the first life is spent, doubling to 40, 80, and so on with each further life spent. A pink ring on the heart shows progress. |
| Robot | 250 | Foresight is always on. |
| Sparrow | 300 | Stops time (Freeze) every 100 hops. |
| Snail | 350 | Slows time (Slowmo) every 100 hops. |
| Red Plumber | 400 | Super Mushroom: the first car or train hit shrinks him instead of costing a life, and he grows back in each new biome. Every 100 coins in a run is a 1-UP. |
| Green Plumber | 450 | Poltergust: pulls in coins within 2 tiles. Ghost hunter: nothing can hit him in the Spooky biome. |
| Giant Turtle | 500 | Smashes through trees and rocks, and breathes fire every 50 hops to wreck the traffic on the next 4 lanes. |
| Human | 550 | Coins are always doubled. |
| Leopard | 600 | Pounces ahead to safe grass (Warp) every 50 hops. |
| Owl | 650 | Takes flight (Wings) every 50 hops. |

## Upgrades

Every power-up can be upgraded in the store (select it on the Power-ups tab and tap the red button, or press **U**). Upgrades come in three tiers of seven, shown as the row of boxes under the card: lime for tier 1, light red for tier 2, gold for tier 3. Upgrades are paid in gems: each one costs 2 gems in tier 1, 4 in tier 2 and 6 in tier 3. Once a tier's seven boxes are full, stepping up to tier 2 costs 10 gems and to tier 3 costs 20, and the boxes start again. A fully upgraded power-up lasts three times as long; Warp reaches up to 12 more rows and Coin rain up to 24 more lanes. Upgrades apply to power-ups you pick up on the road as well as ones bought in the store, and stack with the Chicken's 50% bonus.

Owned characters level up the same way, also with gems (select one on the Characters tab and tap the red button, or press **U**). There are nine levels of five boxes. On level 1 the boxes start see-through white; each upgrade fills the next box green. Once all five are green, stepping up to level 2 becomes available, and on level 2 each upgrade repaints the next box yellow over the green, so the new level builds on top of the last. The level colours are green, yellow, orange, red, pink, sky, teal, lavender and white. A box upgrade costs 2 gems on level 1, rising by 1 a level to 10 on level 9; stepping up to level 2 costs 10 gems, rising by 5 a level to 45 for level 9. Every step strengthens the character's trait a little, and a fully upgraded character is as strong as the old top tier.

## Reward chests

Stars from achievements fill three chests, opened from **Rewards** on the main menu:

| Chest | Earned | Inside |
| --- | --- | --- |
| Basic | Every 3 stars earned in a day | 1-30 coins, 1-5 gems, and a rare 5% chance of an upgrade for the character you play |
| Epic | Every 21 stars earned in a week (Monday to Sunday) | 30-100 coins, 6-15 gems, a rare 8% chance of an upgrade each for 2 characters the chest picks, and 1-3 power-up upgrades |
| Mega | Every 90 stars earned in a calendar month | 100-500 coins, 20-50 gems, an 80% chance of a whole free level for the character you play, and 1-5 power-up upgrades |

A character upgrade from a chest fills that character's next box, or takes the level-up once the boxes are all full. A Mega or holiday chest's free level fills the rest of the current level and steps up to the next one. Character rewards only go to characters you own that can still level up; power-up upgrades are free steps along the store's upgrade path. Chests also turn up on the road: 5% of the collectibles that spawn are chests (80% Basic, 17% Epic, 3% Mega), and hopping on one keeps it. When a run ends, every chest found or earned in it is opened first ("You have found a chest!", tap to open) before the score screen; the rest wait on the Rewards screen and never expire. Opening a chest rattles it for 3 seconds, then it hops up, throws back its lid and hands out its items one at a time with **Next**.

## Coins and the store

- Coins sit on grass and road lanes. They are saved in your browser as soon as you pick them up, even if you die.
- Open the **Store** from the start or game over screen to unlock characters (Duck 50, Frog 100, Penguin 150, Cat 200, Robot 250, Sparrow 300, Snail 350, Red Plumber 400, Green Plumber 450, Giant Turtle 500, Human 550, Leopard 600, Owl 650) and buy power-ups (Foresight 30, Slowmo 30, Rock 40, Extra life 60).
- Bought power-ups appear as buttons in the bottom right during a run, or use keys 1 to 0 for the first ten power-ups in store order. Bought extra lives are added when your next run starts.
