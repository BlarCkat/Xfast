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
