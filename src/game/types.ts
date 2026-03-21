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
  color: string;
  accentColor: string;
  beltColor: string;
}

export type FighterState = 
  | 'idle'
  | 'walk-forward'
  | 'walk-backward'
  | 'punch'
  | 'kick'
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
export const STAMINA_MAX = 100;
export const STAMINA_REGEN = 0.5;
export const PUNCH_COST = 15;
export const KICK_COST = 25;
