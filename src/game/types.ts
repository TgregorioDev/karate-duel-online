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
export const FIGHTER_WIDTH = 60;
export const FIGHTER_HEIGHT = 120;
export const PUNCH_RANGE = 70;
export const KICK_RANGE = 90;
export const GYAKU_ZUKI_RANGE = 65;
export const MAE_GERI_RANGE = 80;
export const STAMINA_MAX = 100;
export const STAMINA_REGEN = 0.5;
export const PUNCH_COST = 15;
export const KICK_COST = 25;
export const GYAKU_ZUKI_COST = 20;
export const MAE_GERI_COST = 22;
