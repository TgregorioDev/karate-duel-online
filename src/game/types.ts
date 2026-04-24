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
  | 'uchi-uke'      // parry contra ataque alto (jodan) — defesa do tronco/cabeça
  | 'gedan-barai'   // parry contra ataque baixo/tronco (chudan/gedan) — varredura baixa
  | 'hit'
  | 'victory'
  | 'bow';

// Altura do golpe — define qual defesa de parry será disparada
export type AttackHeight = 'high' | 'low';

// Judge state — referee at the back of the dojo.
// 'idle'  : standing at attention, hands at sides
// 'point' : arm extended toward the scoring fighter ('aka' or 'ao')
// 'hajime': both arms swept down to start/resume the bout
// 'yame'  : one arm raised palm-out to stop the action
// 'winner': arm extended high toward the match winner
export type JudgeState = 'idle' | 'point' | 'hajime' | 'yame' | 'winner';
export type JudgeSide = 'aka' | 'ao' | null;

export interface Judge {
  state: JudgeState;
  side: JudgeSide;     // which fighter the judge is pointing at
  timer: number;       // frames remaining in the current pose
}

export interface GameState {
  player: Fighter;
  opponent: Fighter;
  timeRemaining: number;
  gameStatus: 'menu' | 'bow-in' | 'fighting' | 'point-scored' | 'bow-out' | 'game-over';
  pointScoredBy: 'player' | 'opponent' | null;
  winner: 'player' | 'opponent' | 'draw' | null;
  aiDifficulty: number;
  judgeMessage: string;
  judgeTimer: number;
  hitEffect: HitEffect | null;
  judge: Judge;
  // Phase timer for bow-in / bow-out ceremonies
  ceremonyTimer: number;
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

export type ScoreCall = 'YUKO' | 'WAZA-ARI' | 'IPPON';

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;
export const GROUND_Y = 420;
export const FIGHT_DURATION = 90;
export const FIGHTER_WIDTH = 75;
export const FIGHTER_HEIGHT = 150;
export const PUNCH_RANGE = 88;
export const KICK_RANGE = 112;
export const GYAKU_ZUKI_RANGE = 82;
export const MAE_GERI_RANGE = 100;
export const YUKO_POINTS = 1;
export const WAZA_ARI_POINTS = 2;
export const IPPON_POINTS = 3;
export const VICTORY_POINT_GAP = 8;
export const STAMINA_MAX = 100;
export const STAMINA_REGEN_IDLE = 0.9;       // standing still / recovering
export const STAMINA_REGEN_RETREAT = 0.55;   // backing away
export const STAMINA_REGEN_ACTIVE = 0;       // walking forward / attacking / blocking — NO regen
export const BLOCK_DRAIN = 0.35;             // stamina drained per frame while holding block
export const PUNCH_COST = 18;
export const KICK_COST = 28;
export const GYAKU_ZUKI_COST = 24;
export const MAE_GERI_COST = 26;
export const PUNCH_DURATION_FRAMES = 12;
export const KICK_DURATION_FRAMES = 18;
export const GYAKU_ZUKI_DURATION_FRAMES = 14;
export const MAE_GERI_DURATION_FRAMES = 16;
export const HIT_STUN_FRAMES = 20;
export const PARRY_DEFENSE_DURATION_FRAMES = 22;
export const EXHAUSTED_DURATION_FRAMES = 60;
// Tactical timing windows
export const PARRY_WINDOW = 4;               // frames at start of block where a perfect parry triggers
export const PARRY_COUNTER_WINDOW = 25;      // frames after a successful parry to land a guaranteed counter
export const ATTACK_STARTUP_TELEGRAPH = 5;   // frames of "wind-up" before the hit frame — opponent can read this
