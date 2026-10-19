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
/** World speed while slowmo is active; the chicken keeps hopping at full speed. */
export const SLOWMO_SCALE = 0.35;
/** How far ahead (seconds) the foresight ghosts show traffic. */
export const FORESIGHT_STEPS = [0.6, 1.2];
