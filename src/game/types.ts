export interface Fighter {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  health: number;
  score: number;
  facing: 'left' | 'right';
  state: FighterState;
  stateTimer: number;
  stamina: number;
  hitCooldown: number;
  blockTimer: number;
  color: string;
  accentColor: string;
  beltColor: string;
  // Explosive lunge during attacks (tobikomi)
  lungeVelocity: number;
  lungeFramesLeft: number;
  lungeDistanceLeft: number;
  // Tactical combat additions
  parryFlash: number;       // frames remaining for parry visual feedback
  parryWindow: number;      // frames left in which a counter is guaranteed (after a successful parry)
  exhausted: number;        // frames left in exhausted state (cannot act)
  telegraphFlash: number;   // frames of startup telegraph remaining (visual cue for opponent)
}

export type FighterState = 
  | 'idle'
  | 'walk-forward'
  | 'walk-backward'
  | 'punch'
  | 'kick'
  | 'gyaku-zuki'
  | 'mae-geri'
  | 'block'
  | 'hit'
  | 'victory';

export interface GameState {
  player: Fighter;
  opponent: Fighter;
  timeRemaining: number;
  gameStatus: 'menu' | 'fighting' | 'point-scored' | 'game-over';
  pointScoredBy: 'player' | 'opponent' | null;
  winner: 'player' | 'opponent' | 'draw' | null;
  aiDifficulty: number;
  judgeMessage: string;
  judgeTimer: number;
  hitEffect: HitEffect | null;
}

export interface HitEffect {
  x: number;
  y: number;
  timer: number;
  type: 'punch' | 'kick';
}

export interface InputState {
  left: boolean;
  right: boolean;
  punch: boolean;
  kick: boolean;
  gyakuZuki: boolean;
  maeGeri: boolean;
  block: boolean;
}

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
export const GROUND_Y = 420;
export const FIGHT_DURATION = 90;
export const MAX_SCORE = 4;
export const FIGHTER_WIDTH = 75;
export const FIGHTER_HEIGHT = 150;
export const PUNCH_RANGE = 88;
export const KICK_RANGE = 112;
export const GYAKU_ZUKI_RANGE = 82;
export const MAE_GERI_RANGE = 100;
export const STAMINA_MAX = 100;
export const STAMINA_REGEN_IDLE = 0.9;       // standing still / recovering
export const STAMINA_REGEN_RETREAT = 0.55;   // backing away
export const STAMINA_REGEN_ACTIVE = 0;       // walking forward / attacking / blocking — NO regen
export const BLOCK_DRAIN = 0.35;             // stamina drained per frame while holding block
export const PUNCH_COST = 18;
export const KICK_COST = 28;
export const GYAKU_ZUKI_COST = 24;
export const MAE_GERI_COST = 26;
// Tactical timing windows
export const PARRY_WINDOW = 4;               // frames at start of block where a perfect parry triggers
export const PARRY_COUNTER_WINDOW = 25;      // frames after a successful parry to land a guaranteed counter
export const ATTACK_STARTUP_TELEGRAPH = 5;   // frames of "wind-up" before the hit frame — opponent can read this
