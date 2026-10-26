// Playable columns run from -COLS to COLS (9 wide, like the original).
export const COLS = 4;
// Movers wrap around within [-WRAP, WRAP] so lanes look endless off-screen.
export const WRAP = 16;
// Decorative world width rendered for each lane.
export const LANE_WIDTH = WRAP * 2 + 8;

export const HOP_DURATION = 0.12;
export const HOP_HEIGHT = 0.45;

// How many rows to keep generated behind / ahead of the camera focus.
export const ROWS_BEHIND = 14;
export const ROWS_AHEAD = 26;

// The camera creeps forward on its own; fall this many rows behind it and the eagle comes.
export const MAX_ROWS_BEHIND_CAMERA = 3.2;
// Standing still this long also brings the eagle.
export const IDLE_LIMIT = 8;

export const TRAIN_SPEED = 32;
export const TRAIN_CAR_LENGTH = 3.6;
export const TRAIN_WARNING = 1.3;

// Lives and power-ups.
export const START_LIVES = 1;
/** The cat's nine lives: the one it's on plus eight extra. */
export const CAT_LIVES = 8;
/** Hops for the cat to regrow half a life; doubles every time it spends a life. */
export const CAT_REFILL_HOPS = 20;
/** Power-up durations are stretched by this much for the chicken. */
export const CHICKEN_POWERUP_BONUS = 1.5;
/** The sparrow stops time and the snail slows it every this many hops. */
export const TIME_TRAIT_HOPS = 100;
/** Mario gets an extra life for every this many coins collected in a run. */
export const MARIO_COINS_PER_LIFE = 100;
/** Bowser breathes fire every this many hops, wrecking traffic on the next few road lanes. */
export const BOWSER_FIRE_HOPS = 50;
export const BOWSER_FIRE_ROWS = 4;
/** The leopard pounces ahead and the owl takes flight every this many hops. */
export const LEAP_TRAIT_HOPS = 50;
/** Rows of seabed the duck crosses after diving, before the river where it surfaces. */
export const UNDERWATER_ROWS = 30;
export const RESPAWN_DELAY = 1.2;
export const RESPAWN_SHIELD = 2;
export const POWERUP_DURATION = {
  foresight: 5,
  slowmo: 5,
  rock: 6,
  magnet: 8,
  double: 10,
  superhop: 8,
  shield: 20,
  freeze: 4,
  wings: 6,
  scarecrow: 10,
  ghost: 6,
  tiny: 8,
  lumberjack: 8,
  // 0 = instant: the effect happens once when used.
  warp: 0,
  coinrain: 0,
} as const;
/** Every this many hops, cars and trains get faster. */
export const STEPS_PER_SPEEDUP = 1000;
export const SPEEDUP_STEP = 0.2;
export const MAX_SPEED_SCALE = 3;
export const WARP_ROWS = 6;
export const COIN_RAIN_ROWS = 12;
export const MAGNET_RADIUS = 2;
/** Seconds a magnetised coin takes to fly to the player. */
export const MAGNET_PULL_TIME = 0.35;
/** World speed while slowmo is active; the chicken keeps hopping at full speed. */
export const SLOWMO_SCALE = 0.35;
/** Seconds the world takes to ease into slowmo, and back up to full speed when it ends. */
export const SLOWMO_EASE = 0.8;
/** How far ahead (seconds) the foresight ghosts show traffic. */
export const FORESIGHT_STEPS = [0.6, 1.2];
