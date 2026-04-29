import {
  AIProfile, Fighter, FighterState, GameMode, GameState, HitZone, InputState, JudgeSide, ScoreCall,
  CANVAS_WIDTH, GROUND_Y, FIGHT_DURATION,
  FIGHTER_WIDTH, PUNCH_RANGE, KICK_RANGE, GYAKU_ZUKI_RANGE, MAE_GERI_RANGE,
  STAMINA_MAX, STAMINA_REGEN_IDLE, BLOCK_DRAIN, MOVEMENT_DRAIN,
  PUNCH_COST, KICK_COST, GYAKU_ZUKI_COST, MAE_GERI_COST,
  YUKO_POINTS, WAZA_ARI_POINTS, IPPON_POINTS, VICTORY_POINT_GAP,
  PARRY_WINDOW, ATTACK_STARTUP_TELEGRAPH,
  PUNCH_DURATION_FRAMES, KICK_DURATION_FRAMES, GYAKU_ZUKI_DURATION_FRAMES,
  MAE_GERI_DURATION_FRAMES, HIT_STUN_FRAMES, PARRY_DEFENSE_DURATION_FRAMES,
  EXHAUSTED_DURATION_FRAMES,
  WKF_TOTAL_SIZE_METERS, WKF_COMPETITION_SIZE_METERS, WKF_START_LINE_OFFSET_METERS,
} from './types';

function worldXToEngineX(worldX: number) {
  return ((worldX + WKF_TOTAL_SIZE_METERS / 2) / WKF_TOTAL_SIZE_METERS) * CANVAS_WIDTH;
}

export const MATCH_START_POSITIONS = {
  player: Math.round(worldXToEngineX(-WKF_START_LINE_OFFSET_METERS)),
  opponent: Math.round(worldXToEngineX(WKF_START_LINE_OFFSET_METERS)),
} as const;

export const COMPETITION_AREA_BOUNDS = {
  left: Math.round(worldXToEngineX(-(WKF_COMPETITION_SIZE_METERS / 2))),
  right: Math.round(worldXToEngineX(WKF_COMPETITION_SIZE_METERS / 2)),
} as const;

const JOGAI_HOLD = 45;
const DEFAULT_AI_PROFILE: AIProfile = 'dan';
const AI_PROFILE_BASE_DIFFICULTY: Record<AIProfile, number> = {
  kyu: 0.28,
  dan: 0.58,
  sensei: 0.84,
};
const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  punch: false,
  kick: false,
  gyakuZuki: false,
  maeGeri: false,
  block: false,
};

export function createFighter(x: number, facing: 'left' | 'right', color: string, accent: string, belt: string): Fighter {
  return {
    x, y: GROUND_Y, width: FIGHTER_WIDTH, height: 120,
    velocityX: 0, health: 100, score: 0,
    facing, state: 'idle', stateTimer: 0,
    attackTimerMax: 0, attackContacted: false,
    stamina: STAMINA_MAX, staminaRegenDelay: 0, staminaFlash: 0, fatigueTimer: 0,
    hitCooldown: 0, blockTimer: 0, guardHeld: false,
    color, accentColor: accent, beltColor: belt,
    lungeVelocity: 0, lungeFramesLeft: 0, lungeDistanceLeft: 0,
    parryFlash: 0, parryWindow: 0, exhausted: 0, telegraphFlash: 0,
  };
}

function startLunge(fighter: Fighter, target: Fighter, attack: string, effectiveDuration = getAttackDurationFrames(attack)) {
  const baseSpeed = LUNGE_SPEED[attack] ?? 0;
  const minimumFrames = LUNGE_FRAMES[attack] ?? 0;
  if (!baseSpeed || !minimumFrames) return;
  const dir = target.x < fighter.x ? -1 : 1;
  // Don't overshoot the opponent — clamp by current distance minus a small buffer
  const gap = Math.max(0, Math.abs(target.x - fighter.x) - 65);
  const hitFrame = Math.max(minimumFrames, Math.floor(effectiveDuration / 2));
  const frames = Math.max(minimumFrames, Math.min(24, hitFrame));
  const distance = Math.min(LUNGE_DISTANCE[attack] ?? LUNGE_MAX_DISTANCE, LUNGE_MAX_DISTANCE, gap);
  if (distance <= 0) return;

  const speed = Math.max(2.5, Math.min(baseSpeed, distance / frames));
  fighter.lungeVelocity = dir * speed;
  fighter.lungeFramesLeft = Math.ceil(distance / speed);
  fighter.lungeDistanceLeft = distance;
}

export function createInitialState(gameMode: GameMode = 'player-vs-ai', aiProfile: AIProfile = DEFAULT_AI_PROFILE): GameState {
  resetAIState();
  resetInputBuffers();
  return {
    // WKF style: AKA wears RED belt+gloves, AO wears BLUE belt+gloves.
    player: createFighter(MATCH_START_POSITIONS.player, 'right', '#ffffff', '#d4202a', '#d4202a'),
    opponent: createFighter(MATCH_START_POSITIONS.opponent, 'left', '#ffffff', '#1f5cd1', '#1f5cd1'),
    gameMode,
    aiProfile,
    timeRemaining: FIGHT_DURATION,
    gameStatus: 'menu',
    paused: false,
    finished: false,
    pointScoredBy: null,
    winner: null,
    aiDifficulty: AI_PROFILE_BASE_DIFFICULTY[aiProfile],
    judgeMessage: '',
    judgeTimer: 0,
    hitEffect: null,
    judge: { state: 'idle', side: null, timer: 0 },
    ceremonyTimer: 0,
    areaWarningBy: null,
    areaWarningTimer: 0,
  };
}

// ===== Ceremony helpers =====
const BOW_DURATION = 72;           // frames lutadores ficam reverenciando
const HAJIME_HOLD = 24;            // frames com juiz no gesto de HAJIME antes da luta
const POINT_HOLD = 90;             // frames com juiz apontando para o ponto
const WINNER_HOLD = 180;           // frames de cerimônia final apontando o vencedor
const POINT_BOW_DURATION = 70;     // frames de reverência mútua após cada ponto, antes do HAJIME

export function startBowIn(state: GameState) {
  state.paused = false;
  state.finished = false;
  resetFighters(state, 'bow', BOW_DURATION);
  state.gameStatus = 'bow-in';
  state.ceremonyTimer = BOW_DURATION + HAJIME_HOLD;
  state.judge = { state: 'idle', side: null, timer: BOW_DURATION };
  state.judgeMessage = 'REI';
  state.judgeTimer = BOW_DURATION;
}

export function startBowOut(state: GameState) {
  state.paused = false;
  state.finished = false;
  state.gameStatus = 'bow-out';
  // Lutadores retornam aos seus marcos iniciais e se cumprimentam (rei final).
  resetFighters(state, 'bow', BOW_DURATION);
  state.ceremonyTimer = BOW_DURATION + 60;
  let side: JudgeSide = null;
  if (state.winner === 'player') side = 'aka';
  else if (state.winner === 'opponent') side = 'ao';
  state.judge = { state: 'winner', side, timer: WINNER_HOLD };
  state.judgeMessage = state.winner === 'draw' ? 'HIKIWAKE' : 'SHOBU ARI!';
  state.judgeTimer = WINNER_HOLD;
}

export function resetPositions(state: GameState) {
  resetFighters(state);
}

export function resetFighters(state: GameState, pose: 'idle' | 'bow' = 'idle', poseTimer = 0) {
  resetAIState();
  resetInputBuffers();
  state.player.x = MATCH_START_POSITIONS.player;
  state.opponent.x = MATCH_START_POSITIONS.opponent;
  state.player.facing = 'right';
  state.opponent.facing = 'left';
  state.player.state = pose;
  state.opponent.state = pose;
  state.player.stateTimer = poseTimer;
  state.opponent.stateTimer = poseTimer;
  state.player.attackTimerMax = 0;
  state.player.attackContacted = false;
  state.opponent.attackTimerMax = 0;
  state.opponent.attackContacted = false;
  state.player.velocityX = 0;
  state.opponent.velocityX = 0;
  state.player.stamina = STAMINA_MAX;
  state.opponent.stamina = STAMINA_MAX;
  state.player.staminaRegenDelay = 0;
  state.opponent.staminaRegenDelay = 0;
  state.player.staminaFlash = 0;
  state.opponent.staminaFlash = 0;
  state.player.fatigueTimer = 0;
  state.opponent.fatigueTimer = 0;
  state.player.blockTimer = 0;
  state.opponent.blockTimer = 0;
  state.player.guardHeld = false;
  state.opponent.guardHeld = false;
  state.player.lungeVelocity = 0;
  state.player.lungeFramesLeft = 0;
  state.player.lungeDistanceLeft = 0;
  state.opponent.lungeVelocity = 0;
  state.opponent.lungeFramesLeft = 0;
  state.opponent.lungeDistanceLeft = 0;
  state.player.parryFlash = 0;
  state.player.parryWindow = 0;
  state.player.exhausted = 0;
  state.player.telegraphFlash = 0;
  state.opponent.parryFlash = 0;
  state.opponent.parryWindow = 0;
  state.opponent.exhausted = 0;
  state.opponent.telegraphFlash = 0;
  state.hitEffect = null;
  state.areaWarningBy = null;
  state.areaWarningTimer = 0;
  state.paused = false;
  state.finished = false;
}

export function setPaused(state: GameState, paused: boolean) {
  state.paused = paused;
}

const DEFAULT_ATTACK_DURATION: Record<"punch" | "kick" | "gyaku-zuki" | "mae-geri", number> = {
  punch: PUNCH_DURATION_FRAMES,
  kick: KICK_DURATION_FRAMES,
  'gyaku-zuki': GYAKU_ZUKI_DURATION_FRAMES,
  'mae-geri': MAE_GERI_DURATION_FRAMES,
};
const attackDurations = { ...DEFAULT_ATTACK_DURATION };
const ATTACK_COSTS: Record<string, number> = {
  punch: PUNCH_COST,
  'gyaku-zuki': GYAKU_ZUKI_COST,
  kick: KICK_COST,
  'mae-geri': MAE_GERI_COST,
};
const HIT_STUN = HIT_STUN_FRAMES;

export function setAttackAnimationDurations(overrides: Partial<Record<"punch" | "kick" | "gyaku-zuki" | "mae-geri", number>>) {
  (Object.keys(DEFAULT_ATTACK_DURATION) as Array<keyof typeof DEFAULT_ATTACK_DURATION>).forEach((key) => {
    const next = overrides[key];
    if (typeof next === 'number' && Number.isFinite(next) && next > 0) {
      attackDurations[key] = Math.max(1, Math.round(next));
    }
  });
}

export function resetAttackAnimationDurations() {
  Object.assign(attackDurations, DEFAULT_ATTACK_DURATION);
}

export function getAttackDurationFrames(attack: string) {
  return attackDurations[attack as keyof typeof attackDurations] ?? 12;
}

// Explosive lunge (tobikomi) — burst forward at the start of each attack.
// Tuned per technique: jabs are quick darts, gyaku-zuki commits deeper, kicks lunge the most.
const LUNGE_SPEED: Record<string, number> = {
  punch: 9,
  'gyaku-zuki': 11,
  kick: 8,
  'mae-geri': 10,
};
// How many startup frames the lunge impulse lasts (then decays sharply)
const LUNGE_FRAMES: Record<string, number> = {
  punch: 4,
  'gyaku-zuki': 5,
  kick: 5,
  'mae-geri': 6,
};
const LUNGE_DISTANCE: Record<string, number> = {
  punch: 76,
  'gyaku-zuki': 72,
  kick: 88,
  'mae-geri': 68,
};
// Maximum lunge distance (px) — keeps it precise, not a teleport
const LUNGE_MAX_DISTANCE = 90;
const MAWASHI_JODAN_MIN_RANGE = 90;
const MAWASHI_CHUDAN_RANGE = 102;

// Combo: if you chain attacks quickly, reduced stamina cost & faster startup
const COMBO_WINDOW = 25; // frames after an attack ends where combo is possible
const COMBO_SPEED_BONUS = 0.7; // duration multiplier
const COMBO_STAMINA_BONUS = 0.8; // stamina cost multiplier
const HEAVY_STAMINA_DELAY_THRESHOLD = 15;
const STAMINA_REGEN_DELAY_FRAMES = 90;
const FATIGUE_LOCK_FRAMES = 120;
const STAMINA_FLASH_FRAMES = 18;
const FATIGUE_MOVEMENT_MULTIPLIER = 0.6;

// Cancel window: during the LAST N frames of an attack animation (after the hit-frame),
// a new attack input can cancel the recovery, enabling fluid sequences like kizami → gyaku-zuki.
const CANCEL_WINDOW = 6;
const ATTACK_ACTIVE_LEAD_RATIO = 0.08;
const ATTACK_ACTIVE_LAG_RATIO = 0.18;
const ATTACK_ACTIVE_MIN_LEAD_FRAMES = 1;
const ATTACK_ACTIVE_MIN_LAG_FRAMES = 3;
const ATTACK_ACTIVE_MAX_LEAD_FRAMES = 6;
const ATTACK_ACTIVE_MAX_LAG_FRAMES = 14;
const GUARD_BLOCK_STAMINA_DRAIN = 5;
const ENABLE_LEGACY_AI_BRANCHES = false;

// Input buffer: remembers an attack press for N frames so the player can pre-input
// a combo follow-up during the startup of the previous attack. The buffered attack
// fires automatically as soon as the cancel window opens.
const INPUT_BUFFER_FRAMES = 12;
type BufferedAttack = 'punch' | 'gyaku-zuki' | 'kick' | 'mae-geri';
const inputBuffer: { player: { attack: BufferedAttack | null; frames: number }, opponent: { attack: BufferedAttack | null; frames: number } } = {
  player: { attack: null, frames: 0 },
  opponent: { attack: null, frames: 0 },
};

function resetInputBuffers() {
  inputBuffer.player.attack = null;
  inputBuffer.player.frames = 0;
  inputBuffer.opponent.attack = null;
  inputBuffer.opponent.frames = 0;
}

function canStartAttack(fighter: Fighter): boolean {
  // Free to act when not currently attacking, or when in the cancel window of an ongoing attack
  if (fighter.state === 'hit') return false;
  if (fighter.fatigueTimer > 0) return false;
  if (!isAttackState(fighter.state)) return fighter.stateTimer <= 0;
  // In an attack: only allow cancel after the hit frame has passed (recovery phase)
  return fighter.stateTimer > 0 && fighter.stateTimer <= CANCEL_WINDOW;
}

function tickStaminaTimers(fighter: Fighter, dt: number) {
  fighter.staminaRegenDelay = advanceFrameTimer(fighter.staminaRegenDelay || 0, dt);
  fighter.fatigueTimer = advanceFrameTimer(fighter.fatigueTimer || 0, dt);
  fighter.staminaFlash = advanceFrameTimer(fighter.staminaFlash || 0, dt);
}

function triggerStaminaFlash(fighter: Fighter) {
  fighter.staminaFlash = Math.max(fighter.staminaFlash || 0, STAMINA_FLASH_FRAMES);
}

function triggerFatigue(fighter: Fighter) {
  fighter.stamina = 0;
  fighter.fatigueTimer = Math.max(fighter.fatigueTimer || 0, FATIGUE_LOCK_FRAMES);
  fighter.staminaRegenDelay = Math.max(fighter.staminaRegenDelay || 0, STAMINA_REGEN_DELAY_FRAMES);
  fighter.lungeVelocity = 0;
  fighter.lungeFramesLeft = 0;
  fighter.lungeDistanceLeft = 0;
  triggerStaminaFlash(fighter);
}

function drainStamina(fighter: Fighter, amount: number, shouldDelayRecovery = false) {
  const drain = Math.max(0, amount);
  if (drain <= 0) return;

  fighter.stamina = Math.max(0, fighter.stamina - drain);
  if (shouldDelayRecovery) {
    fighter.staminaRegenDelay = Math.max(fighter.staminaRegenDelay || 0, STAMINA_REGEN_DELAY_FRAMES);
  }
  if (fighter.stamina <= 0) {
    triggerFatigue(fighter);
  }
}

function trySpendStamina(fighter: Fighter, amount: number) {
  const cost = Math.max(0, amount);
  if (fighter.fatigueTimer > 0 || fighter.stamina < cost) {
    triggerStaminaFlash(fighter);
    return false;
  }

  drainStamina(fighter, cost, cost > HEAVY_STAMINA_DELAY_THRESHOLD);
  return true;
}

function recoverStamina(fighter: Fighter, dt: number) {
  if (fighter.staminaRegenDelay > 0 || fighter.stamina >= STAMINA_MAX) return;
  if (fighter.state === 'hit' || fighter.state === 'block' || isAttackState(fighter.state)) return;
  if (fighter.state === 'uchi-uke' || fighter.state === 'gedan-barai') return;

  fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_IDLE * dt);
}

function isAttackState(state: string): boolean {
  return state === 'punch' || state === 'kick' || state === 'gyaku-zuki' || state === 'mae-geri';
}

function getAttackTimerMax(fighter: Fighter): number {
  return Math.max(1, fighter.attackTimerMax || getAttackDurationFrames(fighter.state));
}

function isAttackCollisionActive(attacker: Fighter): boolean {
  const duration = getAttackTimerMax(attacker);
  const hitFrame = Math.max(1, Math.floor(duration / 2));
  const activeLead = Math.min(
    ATTACK_ACTIVE_MAX_LEAD_FRAMES,
    Math.max(ATTACK_ACTIVE_MIN_LEAD_FRAMES, Math.floor(duration * ATTACK_ACTIVE_LEAD_RATIO)),
  );
  const activeLag = Math.min(
    ATTACK_ACTIVE_MAX_LAG_FRAMES,
    Math.max(ATTACK_ACTIVE_MIN_LAG_FRAMES, Math.floor(duration * ATTACK_ACTIVE_LAG_RATIO)),
  );
  const activeStart = Math.min(duration, hitFrame + activeLead);
  const activeEnd = Math.max(1, hitFrame - activeLag);

  return attacker.stateTimer <= activeStart && attacker.stateTimer >= activeEnd;
}

type ScoreAward = {
  call: ScoreCall;
  points: number;
};

const HIT_ZONE_LABELS: Record<HitZone, string> = {
  head: 'Jodan',
  body: 'Chudan',
};

const ATTACK_LABELS: Partial<Record<FighterState, string>> = {
  punch: 'Kizami-zuki',
  'gyaku-zuki': 'Gyaku-zuki',
  kick: 'Mawashi-geri',
  'mae-geri': 'Mae-geri',
};

function getDefaultImpactZone(attack: FighterState): HitZone {
  return attack === 'kick' ? 'head' : 'body';
}

export function getScoreAward(
  attack: FighterState,
  defender: Pick<Fighter, 'state' | 'stateTimer' | 'exhausted'>,
  impactZone: HitZone = getDefaultImpactZone(attack),
): ScoreAward | null {
  const againstDownedOpponent = defender.exhausted > 0 || (defender.state === 'hit' && defender.stateTimer > 0);
  if (againstDownedOpponent) {
    return { call: 'IPPON', points: IPPON_POINTS };
  }

  switch (attack) {
    case 'kick':
      return impactZone === 'head'
        ? { call: 'IPPON', points: IPPON_POINTS }
        : { call: 'WAZA-ARI', points: WAZA_ARI_POINTS };
    case 'mae-geri':
      return impactZone === 'body' ? { call: 'WAZA-ARI', points: WAZA_ARI_POINTS } : null;
    case 'punch':
    case 'gyaku-zuki':
      return { call: 'YUKO', points: YUKO_POINTS };
    default:
      return null;
  }
}

export function getPointGapWinner(playerScore: number, opponentScore: number): 'player' | 'opponent' | null {
  const diff = playerScore - opponentScore;
  if (Math.abs(diff) < VICTORY_POINT_GAP) return null;
  return diff > 0 ? 'player' : 'opponent';
}

export function isFacingDefender(
  attacker: Pick<Fighter, 'x' | 'facing'>,
  defender: Pick<Fighter, 'x'>,
): boolean {
  const dx = defender.x - attacker.x;
  if (Math.abs(dx) < 1e-5) return true;
  return dx > 0 ? attacker.facing === 'right' : attacker.facing === 'left';
}

export type AICombatMode = 'pressure' | 'bait' | 'evasive' | 'punish';

export function isWhiffRecoveryWindow(
  attack: FighterState,
  stateTimer: number,
  dist: number,
): boolean {
  if (!isAttackState(attack)) return false;
  const range = getAttackRange(attack);
  const duration = getAttackDurationFrames(attack);
  const hitFrame = Math.floor(duration / 2);
  return stateTimer > 0 && stateTimer < hitFrame && dist > range + 16;
}

export function getAICombatMode(params: {
  scoreDelta: number;
  timeRemaining: number;
  opponentStamina: number;
  playerStamina: number;
  dist: number;
  playerState: FighterState;
  playerStateTimer: number;
  playerTelegraphing: boolean;
  opponentParryWindow: number;
}): AICombatMode {
  const {
    scoreDelta,
    timeRemaining,
    opponentStamina,
    playerStamina,
    dist,
    playerState,
    playerStateTimer,
    playerTelegraphing,
    opponentParryWindow,
  } = params;

  if (opponentParryWindow > 0) return 'punish';
  if (isWhiffRecoveryWindow(playerState, playerStateTimer, dist)) return 'punish';
  if (playerTelegraphing && dist < KICK_RANGE + 22) return 'evasive';
  if (opponentStamina < 24) return 'evasive';
  if (scoreDelta <= -2 || (timeRemaining < 20 && scoreDelta < 0) || playerStamina < 30) return 'pressure';
  if (scoreDelta >= 3 && timeRemaining < 25) return 'evasive';
  return 'bait';
}

function ensureGameStateShape(state: GameState) {
  if (!state.gameMode) {
    state.gameMode = 'player-vs-ai';
  }
  if (!state.aiProfile) {
    state.aiProfile = DEFAULT_AI_PROFILE;
  }
  if (typeof state.paused !== 'boolean') {
    state.paused = false;
  }
  if (typeof state.finished !== 'boolean') {
    state.finished = false;
  }
  if (!state.judge) {
    state.judge = { state: 'idle', side: null, timer: 0 };
  }
  if (typeof state.ceremonyTimer !== 'number') {
    state.ceremonyTimer = 0;
  }
  if (state.areaWarningBy === undefined) {
    state.areaWarningBy = null;
  }
  if (typeof state.areaWarningTimer !== 'number') {
    state.areaWarningTimer = 0;
  }
  if (typeof state.player.attackTimerMax !== 'number') {
    state.player.attackTimerMax = 0;
  }
  if (typeof state.opponent.attackTimerMax !== 'number') {
    state.opponent.attackTimerMax = 0;
  }
  if (typeof state.player.attackContacted !== 'boolean') {
    state.player.attackContacted = false;
  }
  if (typeof state.opponent.attackContacted !== 'boolean') {
    state.opponent.attackContacted = false;
  }
  if (typeof state.player.guardHeld !== 'boolean') {
    state.player.guardHeld = false;
  }
  if (typeof state.opponent.guardHeld !== 'boolean') {
    state.opponent.guardHeld = false;
  }
  if (typeof state.player.staminaRegenDelay !== 'number') {
    state.player.staminaRegenDelay = 0;
  }
  if (typeof state.opponent.staminaRegenDelay !== 'number') {
    state.opponent.staminaRegenDelay = 0;
  }
  if (typeof state.player.staminaFlash !== 'number') {
    state.player.staminaFlash = 0;
  }
  if (typeof state.opponent.staminaFlash !== 'number') {
    state.opponent.staminaFlash = 0;
  }
  if (typeof state.player.fatigueTimer !== 'number') {
    state.player.fatigueTimer = 0;
  }
  if (typeof state.opponent.fatigueTimer !== 'number') {
    state.opponent.fatigueTimer = 0;
  }
}

function advanceFrameTimer(timer: number, dt: number) {
  if (timer <= 0) return 0;
  return Math.max(0, timer - dt);
}

function crossedTimerThreshold(previous: number, next: number, threshold: number) {
  return previous > threshold && next <= threshold;
}

function isAreaWarningMessage(message: string) {
  return /^JOGAI\b/.test(message);
}

function clearExpiredAreaWarning(state: GameState) {
  if (state.areaWarningTimer > 0) return;
  state.areaWarningBy = null;
  if (isAreaWarningMessage(state.judgeMessage)) {
    state.judgeMessage = '';
    state.judgeTimer = 0;
  }
}

function fighterTouchesSafetyArea(fighter: Fighter) {
  const halfWidth = fighter.width * 0.5;
  return fighter.x - halfWidth < COMPETITION_AREA_BOUNDS.left
    || fighter.x + halfWidth > COMPETITION_AREA_BOUNDS.right;
}

function registerAreaWarning(state: GameState, offender: 'player' | 'opponent') {
  if (state.gameStatus !== 'fighting' || state.areaWarningTimer > 0) return;
  state.areaWarningBy = offender;
  state.areaWarningTimer = JOGAI_HOLD;
  state.judgeMessage = offender === 'player' ? 'JOGAI AKA' : 'JOGAI AO';
  state.judgeTimer = JOGAI_HOLD;
}

function checkAreaBoundaries(state: GameState) {
  if (state.gameStatus !== 'fighting') return;
  if (fighterTouchesSafetyArea(state.player)) {
    registerAreaWarning(state, 'player');
    return;
  }
  if (fighterTouchesSafetyArea(state.opponent)) {
    registerAreaWarning(state, 'opponent');
  }
}

export function updateGame(state: GameState, input: InputState, dt: number, opponentInput: InputState = EMPTY_INPUT): GameState {
  ensureGameStateShape(state);
  if (state.paused || state.finished) return state;
  // ===== Bow-in ceremony =====
  if (state.gameStatus === 'bow-in') {
    const previousCeremonyTimer = state.ceremonyTimer;
    state.judge.timer = advanceFrameTimer(state.judge.timer, dt);
    state.judgeTimer = advanceFrameTimer(state.judgeTimer, dt);
    state.player.stateTimer = advanceFrameTimer(state.player.stateTimer, dt);
    state.opponent.stateTimer = advanceFrameTimer(state.opponent.stateTimer, dt);
    state.ceremonyTimer = advanceFrameTimer(state.ceremonyTimer, dt);

    // After the bow ends, fighters return to idle and judge calls HAJIME
    if (crossedTimerThreshold(previousCeremonyTimer, state.ceremonyTimer, HAJIME_HOLD)) {
      state.player.state = 'idle';
      state.opponent.state = 'idle';
      state.player.stateTimer = 0;
      state.opponent.stateTimer = 0;
      state.judge = { state: 'hajime', side: null, timer: HAJIME_HOLD };
      state.judgeMessage = 'HAJIME!';
      state.judgeTimer = HAJIME_HOLD;
    }
    if (state.ceremonyTimer <= 0) {
      state.gameStatus = 'fighting';
      state.judge = { state: 'idle', side: null, timer: 0 };
      state.judgeMessage = '';
      state.judgeTimer = 0;
    }
    return state;
  }

  // ===== Bow-out ceremony (end of match) =====
  if (state.gameStatus === 'bow-out') {
    state.judge.timer = advanceFrameTimer(state.judge.timer, dt);
    state.judgeTimer = advanceFrameTimer(state.judgeTimer, dt);
    state.player.stateTimer = advanceFrameTimer(state.player.stateTimer, dt);
    state.opponent.stateTimer = advanceFrameTimer(state.opponent.stateTimer, dt);
    state.ceremonyTimer = advanceFrameTimer(state.ceremonyTimer, dt);
    if (state.ceremonyTimer <= 0) {
      state.gameStatus = 'game-over';
      state.finished = true;
    }
    return state;
  }

  if (state.gameStatus !== 'fighting' && state.gameStatus !== 'point-scored') return state;

  // Judge timers / paused point ceremony
  state.judge.timer = advanceFrameTimer(state.judge.timer, dt);
  state.areaWarningTimer = advanceFrameTimer(state.areaWarningTimer, dt);
  clearExpiredAreaWarning(state);

  if (state.gameStatus === 'point-scored') {
    state.areaWarningBy = null;
    state.areaWarningTimer = 0;
    state.judgeTimer = advanceFrameTimer(state.judgeTimer, dt);

    // Reverência pós-ponto em andamento: avança a cerimônia enquanto a luta fica pausada.
    if (state.ceremonyTimer > 0) {
      state.player.stateTimer = advanceFrameTimer(state.player.stateTimer, dt);
      state.opponent.stateTimer = advanceFrameTimer(state.opponent.stateTimer, dt);
      state.ceremonyTimer = advanceFrameTimer(state.ceremonyTimer, dt);

      if (state.ceremonyTimer <= 0) {
        state.player.state = 'idle';
        state.opponent.state = 'idle';
        state.player.stateTimer = 0;
        state.opponent.stateTimer = 0;
        state.gameStatus = 'fighting';
        state.judge = { state: 'hajime', side: null, timer: HAJIME_HOLD };
        state.judgeMessage = 'HAJIME!';
        state.judgeTimer = HAJIME_HOLD;
      }
      return state;
    }

    // Quando o anúncio do ponto termina, ou encerra a luta ou inicia a reverência pós-ponto.
    if (state.judgeTimer <= 0) {
      const pointGapWinner = getPointGapWinner(state.player.score, state.opponent.score);
      if (pointGapWinner) {
        state.winner = pointGapWinner;
        startBowOut(state);
        return state;
      }

      resetFighters(state, 'bow', POINT_BOW_DURATION);
      state.ceremonyTimer = POINT_BOW_DURATION;
      state.judge = { state: 'idle', side: null, timer: POINT_BOW_DURATION };
      state.judgeMessage = 'REI';
      state.judgeTimer = POINT_BOW_DURATION;
    }

    return state;
  }

  state.judgeTimer = advanceFrameTimer(state.judgeTimer, dt);

  // Timer
  state.timeRemaining -= dt / 60;
  if (state.timeRemaining <= 0) {
    state.timeRemaining = 0;
    if (state.player.score > state.opponent.score) state.winner = 'player';
    else if (state.opponent.score > state.player.score) state.winner = 'opponent';
    else state.winner = 'draw';
    startBowOut(state);
    return state;
  }

  // Hit effect
  if (state.hitEffect) {
    state.hitEffect.timer = advanceFrameTimer(state.hitEffect.timer, dt);
    if (state.hitEffect.timer <= 0) state.hitEffect = null;
  }

  updateFighter(state.player, input, state, dt);
  if (state.gameMode === 'local-1v1') {
    updateFighter(state.opponent, opponentInput, state, dt);
  } else {
    updateAI(state, dt);
  }
  updateFighterPhysics(state.player, dt);
  updateFighterPhysics(state.opponent, dt);
  checkHits(state);

  // Face each other
  state.player.facing = state.player.x < state.opponent.x ? 'right' : 'left';
  state.opponent.facing = state.opponent.x < state.player.x ? 'right' : 'left';
  checkAreaBoundaries(state);

  return state;
}

function updateFighter(fighter: Fighter, input: InputState, state: GameState, dt = 1) {
  const frameStep = Math.max(0, dt);
  const isPlayer = fighter === state.player;
  const buffer = isPlayer ? inputBuffer.player : inputBuffer.opponent;
  const attackInputPressed = input.punch || input.gyakuZuki || input.kick || input.maeGeri;

  tickStaminaTimers(fighter, frameStep);
  fighter.guardHeld = input.block && fighter.fatigueTimer <= 0;

  // Push fresh inputs into the buffer (most recent press wins).
  // This lets the player pre-input a follow-up DURING the startup of the previous attack.
  if (fighter.fatigueTimer > 0) {
    if (attackInputPressed) triggerStaminaFlash(fighter);
    buffer.attack = null;
    buffer.frames = 0;
  } else {
    if (input.punch) { buffer.attack = 'punch'; buffer.frames = INPUT_BUFFER_FRAMES; }
    if (input.gyakuZuki) { buffer.attack = 'gyaku-zuki'; buffer.frames = INPUT_BUFFER_FRAMES; }
    if (input.kick) { buffer.attack = 'kick'; buffer.frames = INPUT_BUFFER_FRAMES; }
    if (input.maeGeri) { buffer.attack = 'mae-geri'; buffer.frames = INPUT_BUFFER_FRAMES; }
  }
  if (buffer.frames > 0) {
    buffer.frames = advanceFrameTimer(buffer.frames, frameStep);
    if (buffer.frames <= 0) buffer.attack = null;
  }

  // Decay visual/tactical timers
  if (fighter.parryFlash > 0) fighter.parryFlash = advanceFrameTimer(fighter.parryFlash, frameStep);
  if (fighter.parryWindow > 0) fighter.parryWindow = advanceFrameTimer(fighter.parryWindow, frameStep);
  if (fighter.telegraphFlash > 0) fighter.telegraphFlash = advanceFrameTimer(fighter.telegraphFlash, frameStep);
  if (fighter.hitCooldown > 0) fighter.hitCooldown = advanceFrameTimer(fighter.hitCooldown, frameStep);

  // Exhausted state — locked out, recover stamina slowly while down
  if (fighter.exhausted > 0) {
    fighter.exhausted = advanceFrameTimer(fighter.exhausted, frameStep);
    fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_IDLE * 0.6 * frameStep);
    fighter.velocityX = 0;
    fighter.guardHeld = false;
    fighter.state = 'hit';
    if (fighter.exhausted <= 0) {
      fighter.state = 'idle';
      fighter.stateTimer = 0;
    }
    buffer.attack = null; buffer.frames = 0;
    return;
  }

  // State timer
  if (fighter.stateTimer > 0) {
    fighter.stateTimer = advanceFrameTimer(fighter.stateTimer, frameStep);
    if (fighter.stateTimer <= 0 && fighter.state !== 'block') {
      fighter.state = 'idle';
    }
    if (fighter.state === 'hit') { buffer.attack = null; buffer.frames = 0; return; }
    // Animação de parry (uchi-uke / gedan barai) precisa terminar antes
    // de qualquer outra ação — assim o jogador VÊ a defesa que disparou.
    if ((fighter.state === 'uchi-uke' || fighter.state === 'gedan-barai') && fighter.stateTimer > 0) {
      fighter.velocityX = 0;
      buffer.attack = null; buffer.frames = 0;
      return;
    }
    // If mid-attack but NOT in the cancel window, lock out other actions
    // (but KEEP the buffered input alive so the combo fires when cancel window opens)
    if (isAttackState(fighter.state) && fighter.stateTimer > CANCEL_WINDOW) {
      const dur = getAttackDurationFrames(fighter.state);
      const hitFrame = Math.floor(dur / 2);
      if (fighter.stateTimer > hitFrame && fighter.stateTimer <= hitFrame + ATTACK_STARTUP_TELEGRAPH) {
        fighter.telegraphFlash = 2;
      }
      return;
    }
  }

  // Block: segurar o botão mantém guarda ativa. Qualquer golpe recebido é defendido
  // em checkAttack(), com a animação escolhida pela zona de impacto.
  if (fighter.fatigueTimer > 0 && fighter.state === 'block') {
    fighter.state = 'idle';
    fighter.blockTimer = 0;
    fighter.guardHeld = false;
  }

  if (input.block && fighter.fatigueTimer <= 0 && !isAttackState(fighter.state) && fighter.state !== 'hit'
      && fighter.state !== 'uchi-uke' && fighter.state !== 'gedan-barai') {
    if (fighter.state !== 'block') fighter.blockTimer = 0;
    fighter.state = 'block';
    fighter.blockTimer += frameStep;
    fighter.velocityX = 0;
    if (fighter.blockTimer > PARRY_WINDOW) {
      drainStamina(fighter, BLOCK_DRAIN * frameStep);
      if (fighter.fatigueTimer > 0) {
        fighter.state = 'idle';
        fighter.blockTimer = 0;
        fighter.guardHeld = false;
      }
    }
    // Holding block clears the buffer (player switched to defense)
    buffer.attack = null; buffer.frames = 0;
    return;
  } else if (fighter.state === 'block' && !input.block) {
    fighter.state = 'idle';
    fighter.blockTimer = 0;
  }

  if (fighter.state === 'block') return;

  const inParryCounter = fighter.parryWindow > 0;
  const inCombo = inParryCounter || (fighter.hitCooldown > 0 && fighter.hitCooldown <= COMBO_WINDOW) || isAttackState(fighter.state);

  const target = isPlayer ? state.opponent : state.player;
  const ready = canStartAttack(fighter);

  // Resolve attack from BUFFER (not raw input) — supports pre-input combos
  if (ready && buffer.attack) {
    const name = buffer.attack;
    const baseCost = ATTACK_COSTS[name];
    const cost = inCombo ? baseCost * COMBO_STAMINA_BONUS : baseCost;
    if (trySpendStamina(fighter, cost)) {
      fighter.state = name;
      const attackDuration = getAttackDurationFrames(name);
      fighter.stateTimer = inCombo ? Math.floor(attackDuration * COMBO_SPEED_BONUS) : attackDuration;
      fighter.attackTimerMax = fighter.stateTimer;
      fighter.attackContacted = false;
      fighter.velocityX = 0;
      fighter.telegraphFlash = ATTACK_STARTUP_TELEGRAPH;
      if (inParryCounter) fighter.parryWindow = 0;
      startLunge(fighter, target, name, fighter.stateTimer);
      buffer.attack = null; buffer.frames = 0;
      return;
    }
    // Not enough stamina → drop the buffered attack so it doesn't auto-fire later
    buffer.attack = null; buffer.frames = 0;
  }

  // If we got here while still mid-attack (cancel window with no input), keep playing the attack
  if (isAttackState(fighter.state)) return;

  // Movement + stamina regen based on action
  const speed = 3.5 * (fighter.fatigueTimer > 0 ? FATIGUE_MOVEMENT_MULTIPLIER : 1);
  if (input.left) {
    fighter.velocityX = -speed;
    const movingBackward = fighter.facing === 'right';
    fighter.state = movingBackward ? 'walk-backward' : 'walk-forward';
    recoverStamina(fighter, frameStep);
    drainStamina(fighter, MOVEMENT_DRAIN * frameStep);
  } else if (input.right) {
    fighter.velocityX = speed;
    const movingBackward = fighter.facing === 'left';
    fighter.state = movingBackward ? 'walk-backward' : 'walk-forward';
    recoverStamina(fighter, frameStep);
    drainStamina(fighter, MOVEMENT_DRAIN * frameStep);
  } else {
    fighter.velocityX = 0;
    if (fighter.state === 'walk-forward' || fighter.state === 'walk-backward') fighter.state = 'idle';
    // Idle — full regen
    recoverStamina(fighter, frameStep);
  }
}

function updateFighterPhysics(fighter: Fighter, dt = 1) {
  // Apply explosive lunge during attack startup, with distance cap
  if (fighter.lungeFramesLeft > 0 && fighter.lungeDistanceLeft > 0) {
    const frameStep = Math.max(0, dt);
    const step = Math.min(Math.abs(fighter.lungeVelocity) * frameStep, fighter.lungeDistanceLeft);
    fighter.x += Math.sign(fighter.lungeVelocity) * step;
    fighter.lungeDistanceLeft -= step;
    fighter.lungeFramesLeft = Math.max(0, fighter.lungeFramesLeft - frameStep);
    if (fighter.lungeFramesLeft <= 0 || fighter.lungeDistanceLeft <= 0) {
      fighter.lungeVelocity = 0;
      fighter.lungeDistanceLeft = 0;
    }
  } else {
    fighter.x += fighter.velocityX;
  }
  fighter.x = Math.max(80, Math.min(CANVAS_WIDTH - 80, fighter.x));
}

function checkHits(state: GameState) {
  checkAttack(state.player, state.opponent, 'player', state);
  if (state.gameStatus !== 'fighting') return;
  checkAttack(state.opponent, state.player, 'opponent', state);
  if (state.gameStatus !== 'fighting') return;
  
  // Push apart if overlapping
  const dist = Math.abs(state.player.x - state.opponent.x);
  if (dist < 55) {
    const push = (55 - dist) / 2;
    if (state.player.x < state.opponent.x) {
      state.player.x -= push;
      state.opponent.x += push;
    } else {
      state.player.x += push;
      state.opponent.x -= push;
    }
  }
}

function getAttackRange(state: string): number {
  switch (state) {
    case 'punch': return PUNCH_RANGE;
    case 'kick': return KICK_RANGE;
    case 'gyaku-zuki': return GYAKU_ZUKI_RANGE;
    case 'mae-geri': return MAE_GERI_RANGE;
    default: return 0;
  }
}

function resolveImpactZone(attack: FighterState, dist: number): HitZone | null {
  switch (attack) {
    case 'kick':
      if (dist >= MAWASHI_JODAN_MIN_RANGE && dist <= KICK_RANGE) return 'head';
      if (dist <= MAWASHI_CHUDAN_RANGE) return 'body';
      return null;
    case 'mae-geri':
      return dist <= MAE_GERI_RANGE ? 'body' : null;
    case 'punch':
      if (dist <= PUNCH_RANGE) return dist > PUNCH_RANGE * 0.72 ? 'head' : 'body';
      return null;
    case 'gyaku-zuki':
      if (dist <= GYAKU_ZUKI_RANGE) return dist > GYAKU_ZUKI_RANGE * 0.72 ? 'head' : 'body';
      return null;
    default:
      return null;
  }
}

function getDefenseStateForImpact(impactZone: HitZone): 'uchi-uke' | 'gedan-barai' {
  return impactZone === 'head' ? 'uchi-uke' : 'gedan-barai';
}

function applySuccessfulDefense(
  attacker: Fighter,
  defender: Fighter,
  attack: FighterState,
  impactZone: HitZone,
  state: GameState,
) {
  const isKickType = attack === 'kick' || attack === 'mae-geri';
  const defenseState = getDefenseStateForImpact(impactZone);
  state.hitEffect = {
    x: (attacker.x + defender.x) / 2,
    y: GROUND_Y - 60,
    timer: 12,
    type: isKickType ? 'kick' : 'punch',
    zone: impactZone,
  };
  defender.parryFlash = 10;
  defender.parryWindow = 0;
  drainStamina(defender, GUARD_BLOCK_STAMINA_DRAIN);
  defender.state = defenseState;
  defender.stateTimer = PARRY_DEFENSE_DURATION_FRAMES;
  defender.blockTimer = 0;
  attacker.attackContacted = true;
}

function checkAttack(attacker: Fighter, defender: Fighter, attackerLabel: 'player' | 'opponent', state: GameState) {
  if (!isAttackState(attacker.state)) return;
  if (attacker.attackContacted) return;
  if (!isFacingDefender(attacker, defender)) return;
  
  const dist = Math.abs(attacker.x - defender.x);
  const impactZone = resolveImpactZone(attacker.state, dist);

  if (!impactZone) return;

  if (defender.guardHeld || defender.state === 'block') {
    applySuccessfulDefense(attacker, defender, attacker.state, impactZone, state);
    if (defender.fatigueTimer > 0) {
      defender.guardHeld = false;
    }
    return;
  }

  if (!isAttackCollisionActive(attacker)) return;

  attacker.attackContacted = true;

  const award = getScoreAward(attacker.state, defender, impactZone);
  if (!award) return;

  // HIT!
  defender.state = 'hit';
  defender.stateTimer = HIT_STUN;
  defender.hitCooldown = 10;
  
  // Set attacker hitCooldown for combo window tracking
  attacker.hitCooldown = COMBO_WINDOW;
  
  const isKickType = attacker.state === 'kick' || attacker.state === 'mae-geri';
  state.hitEffect = {
    x: (attacker.x + defender.x) / 2,
    y: GROUND_Y - 70,
    timer: 15,
    type: isKickType ? 'kick' : 'punch',
    zone: impactZone,
  };

  // Score point
  attacker.score += award.points;
  state.pointScoredBy = attackerLabel;
  state.gameStatus = 'point-scored';
  state.winner = getPointGapWinner(state.player.score, state.opponent.score) ?? state.winner;

  const scoreNames = [`${award.call}! +${award.points}`];
  state.judgeMessage = `YAME! — ${scoreNames[attacker.score] || 'PONTO!'}`;
  state.judgeMessage = `YAME! ${scoreNames[0]}`;
  state.judgeTimer = POINT_HOLD;
  state.judge = {
    state: 'point',
    side: attackerLabel === 'player' ? 'aka' : 'ao',
    timer: POINT_HOLD,
  };

  // Increase AI difficulty
  if (attackerLabel === 'player') {
    state.aiDifficulty = Math.min(0.9, state.aiDifficulty + 0.1);
  }

  const fighterName = attackerLabel === 'player' ? 'AKA' : 'AO';
  const techniqueName = ATTACK_LABELS[attacker.state] ?? attacker.state;
  console.log(`[Arbitragem] ${fighterName} marcou ${award.call} com ${techniqueName} na ${HIT_ZONE_LABELS[impactZone]}.`);
}

// ===== AI =====
type AIAttack = 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri';
type AIAction = 'idle' | 'advance' | 'retreat' | 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri' | 'block' | 'hold-range' | 'dash-in' | 'feint';
export type AIDistanceZone = 'tohma' | 'maai' | 'chika';
type AIPendingDecision = {
  action: AIAction;
  timer: number;
  comboNext: AIAttack | null;
};
type AIProfileConfig = {
  difficulty: number;
  reactionMinFrames: number;
  reactionMaxFrames: number;
  blockChance: number;
  anticipationChance: number;
  aggression: number;
  comboChance: number;
  randomness: number;
};

let aiActionTimer = 0;
let aiAction: AIAction = 'idle';
let aiComboNext: AIAttack | null = null;
let aiReactionTimer = 0;
let aiPendingDecision: AIPendingDecision | null = null;
let aiReactionStimulus = '';
let aiObservedPlayerAttack: FighterState | null = null;
let aiObservedPlayerStateTimer = 0;
let aiPlayerAttackHistory: AIAttack[] = [];

const AI_PROFILE_CONFIGS: Record<AIProfile, AIProfileConfig> = {
  kyu: {
    difficulty: 0.28,
    reactionMinFrames: 18,
    reactionMaxFrames: 24,
    blockChance: 0.35,
    anticipationChance: 0.08,
    aggression: 0.3,
    comboChance: 0.12,
    randomness: 0.55,
  },
  dan: {
    difficulty: 0.58,
    reactionMinFrames: 12,
    reactionMaxFrames: 20,
    blockChance: 0.7,
    anticipationChance: 0.24,
    aggression: 0.58,
    comboChance: 0.48,
    randomness: 0.22,
  },
  sensei: {
    difficulty: 0.84,
    reactionMinFrames: 9,
    reactionMaxFrames: 16,
    blockChance: 0.84,
    anticipationChance: 0.45,
    aggression: 0.78,
    comboChance: 0.72,
    randomness: 0.1,
  },
};

export function getAIDistanceZone(dist: number): AIDistanceZone {
  if (dist > KICK_RANGE + 30) return 'tohma';
  if (dist > PUNCH_RANGE + 8) return 'maai';
  return 'chika';
}

export function getAIProfileConfig(profile: AIProfile): Readonly<AIProfileConfig> {
  return AI_PROFILE_CONFIGS[profile] ?? AI_PROFILE_CONFIGS[DEFAULT_AI_PROFILE];
}

function resetAIState() {
  aiActionTimer = 0;
  aiAction = 'idle';
  aiComboNext = null;
  aiReactionTimer = 0;
  aiPendingDecision = null;
  aiReactionStimulus = '';
  aiObservedPlayerAttack = null;
  aiObservedPlayerStateTimer = 0;
  aiPlayerAttackHistory = [];
}

function isCornered(fighter: Fighter): boolean {
  return fighter.x <= 120 || fighter.x >= CANVAS_WIDTH - 120;
}

function normalizeAIConfig(configOrDifficulty: AIProfileConfig | number): AIProfileConfig {
  if (typeof configOrDifficulty !== 'number') return configOrDifficulty;
  return {
    ...AI_PROFILE_CONFIGS.dan,
    difficulty: configOrDifficulty,
  };
}

function chooseAIAttack(
  dist: number,
  stamina: number,
  mode: AICombatMode,
  configOrDifficulty: AIProfileConfig | number,
): AIAttack {
  const config = normalizeAIConfig(configOrDifficulty);
  const diff = config.difficulty;
  if (stamina >= KICK_COST && dist > MAE_GERI_RANGE + 6) return 'kick';
  if (stamina >= MAE_GERI_COST && dist > GYAKU_ZUKI_RANGE + 6) return 'mae-geri';

  const roll = Math.random();
  if (mode === 'punish') {
    if (dist <= PUNCH_RANGE + 6) return roll < 0.65 ? 'gyaku-zuki' : 'punch';
    if (dist <= GYAKU_ZUKI_RANGE + 10 && stamina >= GYAKU_ZUKI_COST) return 'gyaku-zuki';
    return stamina >= MAE_GERI_COST ? 'mae-geri' : 'kick';
  }

  if (mode === 'pressure') {
    if (dist <= PUNCH_RANGE + 4) return roll < 0.55 ? 'punch' : 'gyaku-zuki';
    if (dist <= GYAKU_ZUKI_RANGE + 10) return roll < 0.6 ? 'gyaku-zuki' : 'mae-geri';
    return roll < 0.45 + diff * 0.15 ? 'kick' : 'mae-geri';
  }

  if (dist <= PUNCH_RANGE) return roll < 0.4 ? 'punch' : 'gyaku-zuki';
  return roll < 0.5 ? 'mae-geri' : 'kick';
}

function planAICombo(
  opener: AIAttack,
  stamina: number,
  mode: AICombatMode,
  configOrDifficulty: AIProfileConfig | number,
): AIAttack | null {
  const config = normalizeAIConfig(configOrDifficulty);
  if (stamina < 44) return null;
  const comboChance = mode === 'pressure'
    ? config.comboChance
    : mode === 'punish'
      ? Math.min(0.9, config.comboChance + 0.12)
      : Math.max(0.08, config.comboChance - 0.18);
  if (Math.random() >= comboChance) return null;

  if (opener === 'punch') return Math.random() < 0.75 ? 'gyaku-zuki' : 'mae-geri';
  if (opener === 'gyaku-zuki') return Math.random() < 0.55 ? 'kick' : 'punch';
  if (opener === 'kick') return 'gyaku-zuki';
  return Math.random() < 0.5 ? 'punch' : 'gyaku-zuki';
}

function setAIAction(nextAction: AIAction, timer: number, comboNext: AIAttack | null = null) {
  aiAction = nextAction;
  aiActionTimer = timer;
  aiComboNext = comboNext;
}

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function queueAIReaction(
  action: AIAction,
  timer: number,
  comboNext: AIAttack | null,
  config: AIProfileConfig,
  stimulus: string,
  fast = false,
) {
  if (aiPendingDecision && aiReactionStimulus === stimulus) return;
  const min = fast ? Math.max(5, config.reactionMinFrames - 5) : config.reactionMinFrames;
  const max = fast ? Math.max(min, config.reactionMaxFrames - 6) : config.reactionMaxFrames;
  aiPendingDecision = { action, timer, comboNext };
  aiReactionTimer = randomInt(min, max);
  aiReactionStimulus = stimulus;
}

function applyPendingAIReaction() {
  if (!aiPendingDecision) return false;
  aiReactionTimer--;
  if (aiReactionTimer > 0) return true;

  setAIAction(aiPendingDecision.action, aiPendingDecision.timer, aiPendingDecision.comboNext);
  aiPendingDecision = null;
  aiReactionStimulus = '';
  aiReactionTimer = 0;
  return false;
}

function observePlayerAttack(player: Fighter) {
  if (!isAttackState(player.state)) {
    aiObservedPlayerAttack = null;
    aiObservedPlayerStateTimer = 0;
    return false;
  }

  const attackRestarted =
    aiObservedPlayerAttack !== player.state ||
    player.stateTimer > aiObservedPlayerStateTimer + 0.5;

  aiObservedPlayerAttack = player.state;
  aiObservedPlayerStateTimer = player.stateTimer;

  if (attackRestarted) {
    aiPlayerAttackHistory = [...aiPlayerAttackHistory.slice(-2), player.state];
  }

  return attackRestarted;
}

function getRepeatedPlayerAttack(): AIAttack | null {
  if (aiPlayerAttackHistory.length < 3) return null;
  const [first, second, third] = aiPlayerAttackHistory.slice(-3);
  return first === second && second === third ? third : null;
}

function chooseSpecificCounter(repeatedAttack: AIAttack, dist: number, stamina: number): AIAttack {
  if (repeatedAttack === 'kick') return dist <= PUNCH_RANGE + 12 && stamina >= PUNCH_COST ? 'punch' : 'gyaku-zuki';
  if (repeatedAttack === 'mae-geri') return stamina >= GYAKU_ZUKI_COST ? 'gyaku-zuki' : 'punch';
  if (repeatedAttack === 'gyaku-zuki') return dist <= PUNCH_RANGE + 4 ? 'punch' : 'mae-geri';
  return stamina >= GYAKU_ZUKI_COST ? 'gyaku-zuki' : 'punch';
}

function decideStrategicAIAction(params: {
  state: GameState;
  dist: number;
  zone: AIDistanceZone;
  mode: AICombatMode;
  config: AIProfileConfig;
  playerTelegraphing: boolean;
  playerWhiffing: boolean;
  playerAttackStarted: boolean;
  cornered: boolean;
}): AIPendingDecision {
  const { state, dist, zone, mode, config, playerTelegraphing, playerWhiffing, playerAttackStarted, cornered } = params;
  const opp = state.opponent;
  const player = state.player;
  const repeatedAttack = getRepeatedPlayerAttack();
  const rand = Math.random();
  const attackWindow = dist <= KICK_RANGE + 20;

  if (opp.stamina < 30) {
    return { action: cornered ? 'block' : 'retreat', timer: 16 + Math.floor((1 - config.difficulty) * 10), comboNext: null };
  }

  if (isAttackState(player.state) && dist <= getAttackRange(player.state) + 28) {
    const patternBonus = repeatedAttack === player.state ? 0.5 : 0;
    if (
      player.state === 'kick' &&
      dist <= PUNCH_RANGE + 10 &&
      opp.stamina >= PUNCH_COST &&
      rand < config.anticipationChance + patternBonus
    ) {
      return { action: 'punch', timer: 5, comboNext: planAICombo('punch', opp.stamina, 'punish', config) };
    }

    if (playerAttackStarted || playerTelegraphing) {
      if (rand < config.blockChance + patternBonus) {
        return { action: 'block', timer: 12 + Math.floor(config.difficulty * 8), comboNext: null };
      }
      return { action: cornered ? 'block' : 'retreat', timer: 10 + Math.floor(Math.random() * 8), comboNext: null };
    }
  }

  if (player.exhausted > 0 || player.stamina < 25) {
    if (zone === 'tohma') return { action: 'dash-in', timer: 10, comboNext: null };
    const finisher = state.aiProfile === 'sensei' && dist >= MAWASHI_JODAN_MIN_RANGE && opp.stamina >= KICK_COST
      ? 'kick'
      : chooseAIAttack(dist, opp.stamina, 'pressure', config);
    return { action: finisher, timer: 5, comboNext: planAICombo(finisher, opp.stamina, 'pressure', config) };
  }

  if (playerWhiffing && attackWindow) {
    const punish = chooseAIAttack(dist, opp.stamina, 'punish', config);
    return { action: punish, timer: 5, comboNext: planAICombo(punish, opp.stamina, 'punish', config) };
  }

  if (repeatedAttack && attackWindow && rand < 0.5 + config.aggression * 0.25) {
    const counter = chooseSpecificCounter(repeatedAttack, dist, opp.stamina);
    return { action: counter, timer: 6, comboNext: planAICombo(counter, opp.stamina, 'punish', config) };
  }

  if (zone === 'tohma') {
    if (rand < config.randomness * 0.45) return { action: 'hold-range', timer: 12 + Math.floor(Math.random() * 8), comboNext: null };
    return { action: rand < 0.35 + config.aggression * 0.35 ? 'dash-in' : 'advance', timer: 10 + Math.floor(Math.random() * 8), comboNext: null };
  }

  if (zone === 'maai') {
    if (rand < 0.28 + config.randomness * 0.2) return { action: 'feint', timer: 8 + Math.floor(Math.random() * 8), comboNext: null };
    if (rand < 0.42 + config.aggression * 0.4) {
      const opener: AIAttack = rand < 0.62 ? 'punch' : chooseAIAttack(dist, opp.stamina, mode, config);
      return { action: opener, timer: 6, comboNext: planAICombo(opener, opp.stamina, mode, config) };
    }
    return { action: 'hold-range', timer: 10 + Math.floor(Math.random() * 8), comboNext: null };
  }

  if (zone === 'chika') {
    if (rand < 0.18 + config.blockChance * 0.25) return { action: 'block', timer: 10 + Math.floor(config.difficulty * 8), comboNext: null };
    if (opp.stamina >= GYAKU_ZUKI_COST && rand < 0.46 + config.aggression * 0.3) {
      return { action: 'gyaku-zuki', timer: 5, comboNext: planAICombo('gyaku-zuki', opp.stamina, 'pressure', config) };
    }
    return { action: cornered ? 'block' : 'retreat', timer: 8 + Math.floor(Math.random() * 8), comboNext: null };
  }

  return { action: 'idle', timer: 10, comboNext: null };
}

export function updateAI(state: GameState, dt = 1) {
  const frameStep = Math.max(0, dt);
  const opp = state.opponent;
  const player = state.player;
  const config = getAIProfileConfig(state.aiProfile);
  tickStaminaTimers(opp, frameStep);
  opp.guardHeld = aiAction === 'block' && aiActionTimer > 0 && opp.fatigueTimer <= 0;

  // Tactical timers
  if (opp.parryFlash > 0) opp.parryFlash = advanceFrameTimer(opp.parryFlash, frameStep);
  if (opp.parryWindow > 0) opp.parryWindow = advanceFrameTimer(opp.parryWindow, frameStep);
  if (opp.telegraphFlash > 0) opp.telegraphFlash = advanceFrameTimer(opp.telegraphFlash, frameStep);
  if (opp.hitCooldown > 0) opp.hitCooldown = advanceFrameTimer(opp.hitCooldown, frameStep);

  // Exhausted lock-out
  if (opp.exhausted > 0) {
    aiPendingDecision = null;
    aiReactionStimulus = '';
    aiReactionTimer = 0;
    opp.exhausted = advanceFrameTimer(opp.exhausted, frameStep);
    opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_IDLE * 0.6 * frameStep);
    opp.velocityX = 0;
    opp.state = 'hit';
    if (opp.exhausted <= 0) { opp.state = 'idle'; opp.stateTimer = 0; }
    return;
  }

  if (opp.fatigueTimer > 0 && (isAttackState(aiAction) || aiAction === 'block')) {
    aiComboNext = null;
    aiAction = 'idle';
    opp.guardHeld = false;
  }

  if (opp.stateTimer > 0) {
    opp.stateTimer = advanceFrameTimer(opp.stateTimer, frameStep);
    if (opp.stateTimer <= 0 && opp.state !== 'block') opp.state = 'idle';
    if (opp.state === 'hit') return;
    // Animação de parry da IA precisa terminar antes de qualquer outra ação
    if ((opp.state === 'uchi-uke' || opp.state === 'gedan-barai') && opp.stateTimer > 0) {
      opp.velocityX = 0;
      return;
    }
    // Mid-attack: only allow chaining a queued combo during the cancel window
    if (isAttackState(opp.state)) {
      // telegraph during startup
      const dur = getAttackDurationFrames(opp.state);
      const hitFrame = Math.floor(dur / 2);
      if (opp.stateTimer > hitFrame && opp.stateTimer <= hitFrame + ATTACK_STARTUP_TELEGRAPH) {
        opp.telegraphFlash = 2;
      }
      if (opp.stateTimer <= CANCEL_WINDOW && aiComboNext) {
        const queued = aiComboNext;
        aiComboNext = null;
        executeAIAttack(opp, player, queued, state.aiDifficulty);
        return;
      }
      return;
    }
  }

  const dist = Math.abs(opp.x - player.x);
  const zone = getAIDistanceZone(dist);
  const diff = Math.max(state.aiDifficulty, config.difficulty);

  const playerAttackStarted = observePlayerAttack(player);
  const playerTelegraphing = player.telegraphFlash > 0 && isAttackState(player.state);
  const playerWhiffing = isWhiffRecoveryWindow(player.state, player.stateTimer, dist);
  const scoreDelta = opp.score - player.score;
  const aiMode = getAICombatMode({
    scoreDelta,
    timeRemaining: state.timeRemaining,
    opponentStamina: opp.stamina,
    playerStamina: player.stamina,
    dist,
    playerState: player.state,
    playerStateTimer: player.stateTimer,
    playerTelegraphing,
    opponentParryWindow: opp.parryWindow,
  });
  const attackWindow = dist <= KICK_RANGE + 20;
  const cornered = isCornered(opp);

  applyPendingAIReaction();
  aiActionTimer = advanceFrameTimer(aiActionTimer, frameStep);
  if (aiActionTimer <= 0 && !aiPendingDecision) {
    const decision = decideStrategicAIAction({
      state,
      dist,
      zone,
      mode: aiMode,
      config,
      playerTelegraphing,
      playerWhiffing,
      playerAttackStarted,
      cornered,
    });

    const reactive =
      (isAttackState(player.state) && dist <= getAttackRange(player.state) + 28) ||
      playerWhiffing ||
      player.stamina < 25;

    if (reactive) {
      const stimulus = `${player.state}:${aiPlayerAttackHistory.join(',')}:${decision.action}`;
      const fast = decision.action === 'punch' && player.state === 'kick';
      queueAIReaction(decision.action, decision.timer, decision.comboNext, config, stimulus, fast);
    } else {
      setAIAction(decision.action, decision.timer, decision.comboNext);
    }
  }

  if (ENABLE_LEGACY_AI_BRANCHES && aiActionTimer <= 0) {
    const rand = Math.random();

    if (opp.parryWindow > 0 && attackWindow) {
      const punish = chooseAIAttack(dist, opp.stamina, 'punish', diff);
      setAIAction(punish, 6, planAICombo(punish, opp.stamina, 'punish', diff));
    } else if (playerWhiffing && dist < KICK_RANGE + 34) {
      if (dist > GYAKU_ZUKI_RANGE + 12 && rand < 0.55) {
        setAIAction('dash-in', 8);
      } else {
        const punish = chooseAIAttack(dist, opp.stamina, 'punish', diff);
        setAIAction(punish, 6, planAICombo(punish, opp.stamina, 'punish', diff));
      }
    } else if (playerTelegraphing && dist < KICK_RANGE + 22) {
      const playerRange = getAttackRange(player.state);
      if (dist <= playerRange + 10 && rand < 0.4 + diff * 0.45) {
        setAIAction('block', 8 + Math.floor(diff * 6));
      } else if (!cornered && rand < 0.88) {
        setAIAction('retreat', 10 + Math.floor(Math.random() * 8));
      } else if (attackWindow && opp.stamina >= GYAKU_ZUKI_COST && rand < 0.35 + diff * 0.2) {
        const counter = chooseAIAttack(dist, opp.stamina, 'punish', diff);
        setAIAction(counter, 6, planAICombo(counter, opp.stamina, 'punish', diff));
      } else {
        setAIAction('hold-range', 10);
      }
    } else if (aiMode === 'evasive') {
      if (dist < KICK_RANGE + 10 && !cornered) {
        setAIAction(rand < 0.7 ? 'retreat' : 'block', 14 + Math.floor(Math.random() * 8));
      } else if (dist < PUNCH_RANGE && cornered && opp.stamina >= GYAKU_ZUKI_COST) {
        setAIAction('gyaku-zuki', 6, planAICombo('gyaku-zuki', opp.stamina, 'punish', diff));
      } else if (dist > KICK_RANGE + 24) {
        setAIAction(rand < 0.6 ? 'idle' : 'hold-range', 12 + Math.floor(Math.random() * 10));
      } else {
        setAIAction('hold-range', 12 + Math.floor(Math.random() * 8));
      }
    } else if (aiMode === 'pressure') {
      if (dist > KICK_RANGE + 28) {
        setAIAction(rand < 0.65 ? 'dash-in' : 'advance', 10 + Math.floor(Math.random() * 8));
      } else if (dist < PUNCH_RANGE - 10 && !cornered && rand < 0.35) {
        setAIAction('retreat', 8 + Math.floor(Math.random() * 6));
      } else if (attackWindow && rand < 0.55 + diff * 0.25) {
        const opener = chooseAIAttack(dist, opp.stamina, 'pressure', diff);
        setAIAction(opener, 8, planAICombo(opener, opp.stamina, 'pressure', diff));
      } else {
        setAIAction(rand < 0.5 ? 'hold-range' : 'advance', 10 + Math.floor(Math.random() * 8));
      }
    } else {
      if (dist < PUNCH_RANGE - 6 && !cornered) {
        setAIAction(rand < 0.6 ? 'retreat' : 'hold-range', 10 + Math.floor(Math.random() * 10));
      } else if (dist > KICK_RANGE + 44) {
        setAIAction(rand < 0.55 ? 'advance' : 'dash-in', 10 + Math.floor(Math.random() * 8));
      } else if (attackWindow && rand < 0.25 + diff * 0.18) {
        const probe = chooseAIAttack(dist, opp.stamina, 'bait', diff);
        setAIAction(probe, 7, planAICombo(probe, opp.stamina, 'bait', diff));
      } else {
        setAIAction(rand < 0.45 ? 'hold-range' : rand < 0.72 ? 'retreat' : 'idle', 9 + Math.floor(Math.random() * 10));
      }
    }
  }
  if (ENABLE_LEGACY_AI_BRANCHES && aiActionTimer <= 0) {
    const rand = Math.random();

    if (playerTelegraphing && dist < KICK_RANGE + 20) {
      // High-skill AI tries to PARRY (block at the right frame)
      if (rand < diff * 0.85) {
        aiAction = 'block';
        aiActionTimer = 10;
      } else if (rand < diff) {
        aiAction = 'retreat';
        aiActionTimer = 12;
      } else {
        aiAction = 'idle';
        aiActionTimer = 8;
      }
    } else if (isAttackState(player.state)) {
      // Already mid-attack — react defensively
      if (rand < diff * 0.6) {
        aiAction = 'block';
        aiActionTimer = 18;
      } else if (rand < diff) {
        aiAction = 'retreat';
        aiActionTimer = 15;
      } else {
        aiAction = 'idle';
        aiActionTimer = 10;
      }
    } else if (opp.parryWindow > 0 && dist < GYAKU_ZUKI_RANGE + 15) {
      // AI just parried — punish with guaranteed counter
      const counterRoll = Math.random();
      if (counterRoll < 0.5) aiAction = 'gyaku-zuki';
      else if (counterRoll < 0.8) aiAction = 'punch';
      else aiAction = 'kick';
      aiActionTimer = 6;
    } else if (opp.stamina < 30) {
      // LOW STAMINA — back away, recover, no aggression
      aiAction = 'retreat';
      aiActionTimer = 25;
    } else if (dist < GYAKU_ZUKI_RANGE + 10 && opp.stamina >= GYAKU_ZUKI_COST) {
      // Close range - pick attacks based on stamina + difficulty
      if (rand < diff * 0.45) {
        const attackRoll = Math.random();
        if (attackRoll < 0.3) aiAction = 'punch';
        else if (attackRoll < 0.55) aiAction = 'gyaku-zuki';
        else if (attackRoll < 0.8) aiAction = 'kick';
        else aiAction = 'mae-geri';
        aiActionTimer = 8;

        // Plan a follow-up combo (only if enough stamina to chain)
        if (opp.stamina > 50 && Math.random() < 0.3 + diff * 0.4) {
          if (aiAction === 'punch') aiComboNext = Math.random() < 0.7 ? 'gyaku-zuki' : 'mae-geri';
          else if (aiAction === 'gyaku-zuki') aiComboNext = Math.random() < 0.5 ? 'punch' : 'kick';
          else if (aiAction === 'kick') aiComboNext = 'gyaku-zuki';
          else if (aiAction === 'mae-geri') aiComboNext = 'punch';
        } else {
          aiComboNext = null;
        }
      } else {
        aiAction = Math.random() < 0.5 ? 'retreat' : 'idle';
        aiActionTimer = 18;
      }
    } else if (dist < KICK_RANGE + 20 && opp.stamina >= KICK_COST) {
      if (rand < diff * 0.35) {
        aiAction = Math.random() < 0.5 ? 'kick' : 'mae-geri';
        aiActionTimer = 10;
      } else {
        aiAction = 'advance';
        aiActionTimer = 15;
      }
    } else {
      aiAction = rand < 0.6 ? 'advance' : 'idle';
      aiActionTimer = 20 + Math.floor(Math.random() * 20);
    }
  }

  // Execute action with action-based stamina regen
  const speed = (2.5 + diff) * (opp.fatigueTimer > 0 ? FATIGUE_MOVEMENT_MULTIPLIER : 1);
  const dir = player.x < opp.x ? -1 : 1;
  const releaseBlock = () => {
    if (opp.state === 'block') {
      opp.state = 'idle';
      opp.blockTimer = 0;
    }
  };

  switch (aiAction) {
    case 'advance':
      releaseBlock();
      opp.velocityX = dir * speed;
      opp.state = 'walk-forward';
      recoverStamina(opp, frameStep);
      drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      break;
    case 'dash-in':
      releaseBlock();
      opp.velocityX = dir * (speed * 1.35);
      opp.state = 'walk-forward';
      recoverStamina(opp, frameStep);
      drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      break;
    case 'feint':
      releaseBlock();
      opp.velocityX = (aiActionTimer % 6 > 2 ? -dir : dir) * (speed * 0.55);
      opp.state = aiActionTimer % 6 > 2 ? 'walk-backward' : 'walk-forward';
      recoverStamina(opp, frameStep);
      drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      break;
    case 'retreat':
      releaseBlock();
      opp.velocityX = -dir * (speed * 0.8);
      opp.state = 'walk-backward';
      recoverStamina(opp, frameStep);
      drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      break;
    case 'hold-range': {
      releaseBlock();
      const desiredRange = zone === 'tohma'
        ? KICK_RANGE + 12
        : aiMode === 'bait'
          ? KICK_RANGE + 18
          : GYAKU_ZUKI_RANGE + 12;
      if (dist < desiredRange - 14 && !cornered) {
        opp.velocityX = -dir * (speed * 0.7);
        opp.state = 'walk-backward';
        recoverStamina(opp, frameStep);
        drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      } else if (dist > desiredRange + 20) {
        opp.velocityX = dir * (speed * 0.75);
        opp.state = 'walk-forward';
        recoverStamina(opp, frameStep);
        drainStamina(opp, MOVEMENT_DRAIN * frameStep);
      } else {
        opp.velocityX = 0;
        opp.state = 'idle';
        recoverStamina(opp, frameStep);
      }
      break;
    }
    case 'punch':
    case 'gyaku-zuki':
    case 'kick':
    case 'mae-geri':
      releaseBlock();
      if (executeAIAttack(opp, player, aiAction, diff)) {
        aiAction = 'idle';
      }
      break;
    case 'block':
      if (opp.fatigueTimer > 0) {
        releaseBlock();
        aiAction = 'idle';
        opp.guardHeld = false;
        break;
      }
      if (opp.state !== 'block') opp.blockTimer = 0;
      opp.state = 'block';
      opp.guardHeld = true;
      opp.blockTimer += frameStep;
      opp.velocityX = 0;
      // Drain stamina while blocking past parry window
      if (opp.blockTimer > PARRY_WINDOW) {
        drainStamina(opp, BLOCK_DRAIN * frameStep);
        if (opp.fatigueTimer > 0) {
          opp.state = 'idle';
          opp.blockTimer = 0;
          opp.guardHeld = false;
          aiAction = 'idle';
        }
      }
      break;
    default:
      releaseBlock();
      opp.velocityX = 0;
      if (opp.state === 'walk-forward' || opp.state === 'walk-backward') opp.state = 'idle';
      // Idle regen
      recoverStamina(opp, frameStep);
  }
}

function executeAIAttack(opp: Fighter, player: Fighter, attack: 'punch' | 'gyaku-zuki' | 'kick' | 'mae-geri', _diff: number): boolean {
  const baseCost = ATTACK_COSTS[attack];
  // If chaining out of an attack's cancel window, apply combo discount/speedup
  const chaining = isAttackState(opp.state) && opp.stateTimer <= CANCEL_WINDOW;
  const cost = chaining ? baseCost * COMBO_STAMINA_BONUS : baseCost;
  if (!trySpendStamina(opp, cost)) return false;

  const baseDuration = getAttackDurationFrames(attack);
  opp.state = attack;
  opp.stateTimer = chaining ? Math.floor(baseDuration * COMBO_SPEED_BONUS) : baseDuration;
  opp.attackTimerMax = opp.stateTimer;
  opp.attackContacted = false;
  opp.velocityX = 0;
  opp.telegraphFlash = ATTACK_STARTUP_TELEGRAPH;
  startLunge(opp, player, attack, opp.stateTimer);
  return true;
}
