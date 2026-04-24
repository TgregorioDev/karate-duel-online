import {
  Fighter, FighterState, GameState, InputState, JudgeSide, ScoreCall,
  CANVAS_WIDTH, GROUND_Y, FIGHT_DURATION,
  FIGHTER_WIDTH, PUNCH_RANGE, KICK_RANGE, GYAKU_ZUKI_RANGE, MAE_GERI_RANGE,
  STAMINA_MAX, STAMINA_REGEN_IDLE, STAMINA_REGEN_RETREAT, BLOCK_DRAIN,
  PUNCH_COST, KICK_COST, GYAKU_ZUKI_COST, MAE_GERI_COST,
  YUKO_POINTS, WAZA_ARI_POINTS, IPPON_POINTS, VICTORY_POINT_GAP,
  PARRY_WINDOW, PARRY_COUNTER_WINDOW, ATTACK_STARTUP_TELEGRAPH,
  PUNCH_DURATION_FRAMES, KICK_DURATION_FRAMES, GYAKU_ZUKI_DURATION_FRAMES,
  MAE_GERI_DURATION_FRAMES, HIT_STUN_FRAMES, PARRY_DEFENSE_DURATION_FRAMES,
  EXHAUSTED_DURATION_FRAMES,
} from './types';

export function createFighter(x: number, facing: 'left' | 'right', color: string, accent: string, belt: string): Fighter {
  return {
    x, y: GROUND_Y, width: FIGHTER_WIDTH, height: 120,
    velocityX: 0, health: 100, score: 0,
    facing, state: 'idle', stateTimer: 0,
    stamina: STAMINA_MAX, hitCooldown: 0, blockTimer: 0,
    color, accentColor: accent, beltColor: belt,
    lungeVelocity: 0, lungeFramesLeft: 0, lungeDistanceLeft: 0,
    parryFlash: 0, parryWindow: 0, exhausted: 0, telegraphFlash: 0,
  };
}

function startLunge(fighter: Fighter, target: Fighter, attack: string) {
  const speed = LUNGE_SPEED[attack] ?? 0;
  const frames = LUNGE_FRAMES[attack] ?? 0;
  if (!speed || !frames) return;
  const dir = target.x < fighter.x ? -1 : 1;
  fighter.lungeVelocity = dir * speed;
  fighter.lungeFramesLeft = frames;
  // Don't overshoot the opponent — clamp by current distance minus a small buffer
  const gap = Math.max(0, Math.abs(target.x - fighter.x) - 65);
  fighter.lungeDistanceLeft = Math.min(LUNGE_MAX_DISTANCE, gap);
}

export function createInitialState(): GameState {
  resetAIState();
  return {
    // WKF style: AKA wears RED belt+gloves, AO wears BLUE belt+gloves.
    player: createFighter(280, 'right', '#ffffff', '#d4202a', '#d4202a'),
    opponent: createFighter(680, 'left', '#ffffff', '#1f5cd1', '#1f5cd1'),
    timeRemaining: FIGHT_DURATION,
    gameStatus: 'menu',
    pointScoredBy: null,
    winner: null,
    aiDifficulty: 0.3,
    judgeMessage: '',
    judgeTimer: 0,
    hitEffect: null,
    judge: { state: 'idle', side: null, timer: 0 },
    ceremonyTimer: 0,
  };
}

// ===== Ceremony helpers =====
const BOW_DURATION = 72;           // frames lutadores ficam reverenciando
const HAJIME_HOLD = 24;            // frames com juiz no gesto de HAJIME antes da luta
const POINT_HOLD = 90;             // frames com juiz apontando para o ponto
const WINNER_HOLD = 180;           // frames de cerimônia final apontando o vencedor
const POINT_BOW_DURATION = 70;     // frames de reverência mútua após cada ponto, antes do HAJIME

export function startBowIn(state: GameState) {
  state.gameStatus = 'bow-in';
  state.ceremonyTimer = BOW_DURATION + HAJIME_HOLD;
  state.player.state = 'bow';
  state.opponent.state = 'bow';
  state.player.stateTimer = BOW_DURATION;
  state.opponent.stateTimer = BOW_DURATION;
  state.judge = { state: 'idle', side: null, timer: BOW_DURATION };
  state.judgeMessage = 'REI';
  state.judgeTimer = BOW_DURATION;
}

export function startBowOut(state: GameState) {
  state.gameStatus = 'bow-out';
  // Lutadores retornam aos seus marcos iniciais e se cumprimentam (rei final).
  resetPositions(state);
  state.ceremonyTimer = BOW_DURATION + 60;
  state.player.state = 'bow';
  state.opponent.state = 'bow';
  state.player.stateTimer = BOW_DURATION;
  state.opponent.stateTimer = BOW_DURATION;
  let side: JudgeSide = null;
  if (state.winner === 'player') side = 'aka';
  else if (state.winner === 'opponent') side = 'ao';
  state.judge = { state: 'winner', side, timer: WINNER_HOLD };
  state.judgeMessage = state.winner === 'draw' ? 'HIKIWAKE' : 'SHOBU ARI!';
  state.judgeTimer = WINNER_HOLD;
}

export function resetPositions(state: GameState) {
  resetAIState();
  state.player.x = 280;
  state.opponent.x = 680;
  state.player.state = 'idle';
  state.opponent.state = 'idle';
  state.player.stateTimer = 0;
  state.opponent.stateTimer = 0;
  state.player.stamina = STAMINA_MAX;
  state.opponent.stamina = STAMINA_MAX;
  state.player.blockTimer = 0;
  state.opponent.blockTimer = 0;
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
}

const ATTACK_DURATION: Record<string, number> = {
  punch: PUNCH_DURATION_FRAMES,
  kick: KICK_DURATION_FRAMES,
  'gyaku-zuki': GYAKU_ZUKI_DURATION_FRAMES,
  'mae-geri': MAE_GERI_DURATION_FRAMES,
};
const ATTACK_COSTS: Record<string, number> = {
  punch: PUNCH_COST,
  'gyaku-zuki': GYAKU_ZUKI_COST,
  kick: KICK_COST,
  'mae-geri': MAE_GERI_COST,
};
const HIT_STUN = HIT_STUN_FRAMES;

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
// Maximum lunge distance (px) — keeps it precise, not a teleport
const LUNGE_MAX_DISTANCE = 90;

// Combo: if you chain attacks quickly, reduced stamina cost & faster startup
const COMBO_WINDOW = 25; // frames after an attack ends where combo is possible
const COMBO_SPEED_BONUS = 0.7; // duration multiplier
const COMBO_STAMINA_BONUS = 0.8; // stamina cost multiplier

// Cancel window: during the LAST N frames of an attack animation (after the hit-frame),
// a new attack input can cancel the recovery, enabling fluid sequences like kizami → gyaku-zuki.
const CANCEL_WINDOW = 6;

// Input buffer: remembers an attack press for N frames so the player can pre-input
// a combo follow-up during the startup of the previous attack. The buffered attack
// fires automatically as soon as the cancel window opens.
const INPUT_BUFFER_FRAMES = 12;
type BufferedAttack = 'punch' | 'gyaku-zuki' | 'kick' | 'mae-geri';
const inputBuffer: { player: { attack: BufferedAttack | null; frames: number }, opponent: { attack: BufferedAttack | null; frames: number } } = {
  player: { attack: null, frames: 0 },
  opponent: { attack: null, frames: 0 },
};

function canStartAttack(fighter: Fighter): boolean {
  // Free to act when not currently attacking, or when in the cancel window of an ongoing attack
  if (fighter.state === 'hit') return false;
  if (!isAttackState(fighter.state)) return fighter.stateTimer <= 0;
  // In an attack: only allow cancel after the hit frame has passed (recovery phase)
  return fighter.stateTimer > 0 && fighter.stateTimer <= CANCEL_WINDOW;
}

function isAttackState(state: string): boolean {
  return state === 'punch' || state === 'kick' || state === 'gyaku-zuki' || state === 'mae-geri';
}

type ScoreAward = {
  call: ScoreCall;
  points: number;
};

export function getScoreAward(
  attack: FighterState,
  defender: Pick<Fighter, 'state' | 'stateTimer' | 'exhausted'>,
): ScoreAward | null {
  const againstDownedOpponent = defender.exhausted > 0 || (defender.state === 'hit' && defender.stateTimer > 0);
  if (againstDownedOpponent) {
    return { call: 'IPPON', points: IPPON_POINTS };
  }

  switch (attack) {
    case 'kick':
      return { call: 'IPPON', points: IPPON_POINTS };
    case 'mae-geri':
      return { call: 'WAZA-ARI', points: WAZA_ARI_POINTS };
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

export type AICombatMode = 'pressure' | 'bait' | 'evasive' | 'punish';

export function isWhiffRecoveryWindow(
  attack: FighterState,
  stateTimer: number,
  dist: number,
): boolean {
  if (!isAttackState(attack)) return false;
  const range = getAttackRange(attack);
  const duration = ATTACK_DURATION[attack] || 12;
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
  if (!state.judge) {
    state.judge = { state: 'idle', side: null, timer: 0 };
  }
  if (typeof state.ceremonyTimer !== 'number') {
    state.ceremonyTimer = 0;
  }
}

function advanceFrameTimer(timer: number, dt: number) {
  if (timer <= 0) return 0;
  return Math.max(0, timer - dt);
}

function crossedTimerThreshold(previous: number, next: number, threshold: number) {
  return previous > threshold && next <= threshold;
}

export function updateGame(state: GameState, input: InputState, dt: number): GameState {
  ensureGameStateShape(state);
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
    }
    return state;
  }

  if (state.gameStatus !== 'fighting' && state.gameStatus !== 'point-scored') return state;

  // Judge timers / paused point ceremony
  state.judge.timer = advanceFrameTimer(state.judge.timer, dt);

  if (state.gameStatus === 'point-scored') {
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

      resetPositions(state);
      state.player.state = 'bow';
      state.opponent.state = 'bow';
      state.player.stateTimer = POINT_BOW_DURATION;
      state.opponent.stateTimer = POINT_BOW_DURATION;
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

  updateFighter(state.player, input, state);
  updateAI(state);
  updateFighterPhysics(state.player);
  updateFighterPhysics(state.opponent);
  checkHits(state);

  // Face each other
  state.player.facing = state.player.x < state.opponent.x ? 'right' : 'left';
  state.opponent.facing = state.opponent.x < state.player.x ? 'right' : 'left';

  return state;
}

function updateFighter(fighter: Fighter, input: InputState, state: GameState) {
  const isPlayer = fighter === state.player;
  const buffer = isPlayer ? inputBuffer.player : inputBuffer.opponent;

  // Push fresh inputs into the buffer (most recent press wins).
  // This lets the player pre-input a follow-up DURING the startup of the previous attack.
  if (input.punch) { buffer.attack = 'punch'; buffer.frames = INPUT_BUFFER_FRAMES; }
  if (input.gyakuZuki) { buffer.attack = 'gyaku-zuki'; buffer.frames = INPUT_BUFFER_FRAMES; }
  if (input.kick) { buffer.attack = 'kick'; buffer.frames = INPUT_BUFFER_FRAMES; }
  if (input.maeGeri) { buffer.attack = 'mae-geri'; buffer.frames = INPUT_BUFFER_FRAMES; }
  if (buffer.frames > 0) {
    buffer.frames--;
    if (buffer.frames <= 0) buffer.attack = null;
  }

  // Decay visual/tactical timers
  if (fighter.parryFlash > 0) fighter.parryFlash--;
  if (fighter.parryWindow > 0) fighter.parryWindow--;
  if (fighter.telegraphFlash > 0) fighter.telegraphFlash--;
  if (fighter.hitCooldown > 0) fighter.hitCooldown--;

  // Exhausted state — locked out, recover stamina slowly while down
  if (fighter.exhausted > 0) {
    fighter.exhausted--;
    fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_IDLE * 0.6);
    fighter.velocityX = 0;
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
    fighter.stateTimer--;
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
      const dur = ATTACK_DURATION[fighter.state] || 12;
      const hitFrame = Math.floor(dur / 2);
      if (fighter.stateTimer > hitFrame && fighter.stateTimer <= hitFrame + ATTACK_STARTUP_TELEGRAPH) {
        fighter.telegraphFlash = 2;
      }
      return;
    }
  }

  // Block — segurar o botão = guarda firme/alta. Os primeiros PARRY_WINDOW frames
  // são uma janela de parry: se levar um golpe nesse intervalo, o engine troca
  // automaticamente o estado para uchi-uke (golpe alto) ou gedan-barai (golpe baixo).
  if (input.block && !isAttackState(fighter.state) && fighter.state !== 'hit'
      && fighter.state !== 'uchi-uke' && fighter.state !== 'gedan-barai') {
    if (fighter.state !== 'block') fighter.blockTimer = 0;
    fighter.state = 'block';
    fighter.blockTimer++;
    fighter.velocityX = 0;
    if (fighter.blockTimer > PARRY_WINDOW) {
      fighter.stamina = Math.max(0, fighter.stamina - BLOCK_DRAIN);
      if (fighter.stamina <= 0) {
        fighter.exhausted = EXHAUSTED_DURATION_FRAMES;
        fighter.state = 'hit';
        fighter.stateTimer = EXHAUSTED_DURATION_FRAMES;
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
    if (fighter.stamina >= cost) {
      fighter.state = name;
      fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION[name] * COMBO_SPEED_BONUS) : ATTACK_DURATION[name];
      fighter.stamina -= cost;
      fighter.velocityX = 0;
      fighter.telegraphFlash = ATTACK_STARTUP_TELEGRAPH;
      if (inParryCounter) fighter.parryWindow = 0;
      startLunge(fighter, target, name);
      buffer.attack = null; buffer.frames = 0;
      return;
    }
    // Not enough stamina → drop the buffered attack so it doesn't auto-fire later
    buffer.attack = null; buffer.frames = 0;
  }

  // If we got here while still mid-attack (cancel window with no input), keep playing the attack
  if (isAttackState(fighter.state)) return;

  // Movement + stamina regen based on action
  const speed = 3.5;
  if (input.left) {
    fighter.velocityX = -speed;
    const movingBackward = fighter.facing === 'right';
    fighter.state = movingBackward ? 'walk-backward' : 'walk-forward';
    if (movingBackward) fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_RETREAT);
  } else if (input.right) {
    fighter.velocityX = speed;
    const movingBackward = fighter.facing === 'left';
    fighter.state = movingBackward ? 'walk-backward' : 'walk-forward';
    if (movingBackward) fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_RETREAT);
  } else {
    fighter.velocityX = 0;
    if (fighter.state === 'walk-forward' || fighter.state === 'walk-backward') fighter.state = 'idle';
    // Idle — full regen
    fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN_IDLE);
  }
}

function updateFighterPhysics(fighter: Fighter) {
  // Apply explosive lunge during attack startup, with distance cap
  if (fighter.lungeFramesLeft > 0 && fighter.lungeDistanceLeft > 0) {
    const step = Math.min(Math.abs(fighter.lungeVelocity), fighter.lungeDistanceLeft);
    fighter.x += Math.sign(fighter.lungeVelocity) * step;
    fighter.lungeDistanceLeft -= step;
    fighter.lungeFramesLeft--;
    if (fighter.lungeFramesLeft <= 0) {
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
  checkAttack(state.opponent, state.player, 'opponent', state);
  
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

function checkAttack(attacker: Fighter, defender: Fighter, attackerLabel: 'player' | 'opponent', state: GameState) {
  if (!isAttackState(attacker.state)) return;
  
  // Only check on the "hit frame" (middle of animation)
  const duration = ATTACK_DURATION[attacker.state] || 12;
  const hitFrame = Math.floor(duration / 2);
  if (attacker.stateTimer !== hitFrame) return;

  const range = getAttackRange(attacker.state);
  const dist = Math.abs(attacker.x - defender.x);

  if (dist > range) return;

  // PARRY — first PARRY_WINDOW frames of block = perfect timing → counter window opens
  // Defesa escolhida pela ALTURA do golpe recebido:
  //   - punch / gyaku-zuki  → ataques jodan/chudan altos  → UCHI-UKE
  //   - kick  / mae-geri    → ataques chudan/gedan baixos → GEDAN BARAI
  if (defender.state === 'block' && defender.blockTimer <= PARRY_WINDOW) {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 18, type: 'punch' };
    defender.parryFlash = 20;
    defender.parryWindow = PARRY_COUNTER_WINDOW;
    defender.stamina = Math.min(STAMINA_MAX, defender.stamina + 15); // reward perfect timing
    // Mostra a defesa correspondente à altura do golpe por alguns frames
    const isHighAttack = attacker.state === 'punch' || attacker.state === 'gyaku-zuki';
    defender.state = isHighAttack ? 'uchi-uke' : 'gedan-barai';
    defender.stateTimer = PARRY_DEFENSE_DURATION_FRAMES;
    defender.blockTimer = 0;
    // Attacker stunned briefly, exposed to counter
    attacker.state = 'hit';
    attacker.stateTimer = 18;
    attacker.hitCooldown = 12;
    state.judgeMessage = isHighAttack ? 'UCHI-UKE!' : 'GEDAN BARAI!';
    state.judgeTimer = 35;
    return;
  }

  // Late block — partial protection, no counter, costs stamina
  const LATE_BLOCK_WINDOW = 14;
  if (defender.state === 'block' && defender.blockTimer <= LATE_BLOCK_WINDOW) {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 10, type: 'punch' };
    defender.stamina = Math.max(0, defender.stamina - 12);
    if (defender.stamina <= 0) {
      defender.exhausted = EXHAUSTED_DURATION_FRAMES;
      defender.state = 'hit';
      defender.stateTimer = EXHAUSTED_DURATION_FRAMES;
    }
    return;
  }

  const award = getScoreAward(attacker.state, defender);
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
  };

  // Score point
  attacker.score += award.points;
  state.pointScoredBy = attackerLabel;
  state.gameStatus = 'point-scored';
  state.winner = getPointGapWinner(state.player.score, state.opponent.score) ?? state.winner;

  const scoreNames = [`${award.call} +${award.points}`];
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
}

// ===== AI =====
type AIAttack = 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri';
type AIAction = 'idle' | 'advance' | 'retreat' | 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri' | 'block' | 'hold-range' | 'dash-in';

let aiActionTimer = 0;
let aiAction: AIAction = 'idle';
let aiComboNext: AIAttack | null = null;

function resetAIState() {
  aiActionTimer = 0;
  aiAction = 'idle';
  aiComboNext = null;
}

function isCornered(fighter: Fighter): boolean {
  return fighter.x <= 120 || fighter.x >= CANVAS_WIDTH - 120;
}

function chooseAIAttack(
  dist: number,
  stamina: number,
  mode: AICombatMode,
  diff: number,
): AIAttack {
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
  diff: number,
): AIAttack | null {
  if (stamina < 44) return null;
  const comboChance = mode === 'pressure'
    ? 0.35 + diff * 0.35
    : mode === 'punish'
      ? 0.45 + diff * 0.3
      : 0.18 + diff * 0.15;
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

export function updateAI(state: GameState) {
  const opp = state.opponent;
  const player = state.player;

  // Tactical timers
  if (opp.parryFlash > 0) opp.parryFlash--;
  if (opp.parryWindow > 0) opp.parryWindow--;
  if (opp.telegraphFlash > 0) opp.telegraphFlash--;
  if (opp.hitCooldown > 0) opp.hitCooldown--;

  // Exhausted lock-out
  if (opp.exhausted > 0) {
    opp.exhausted--;
    opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_IDLE * 0.6);
    opp.velocityX = 0;
    opp.state = 'hit';
    if (opp.exhausted <= 0) { opp.state = 'idle'; opp.stateTimer = 0; }
    return;
  }

  if (opp.stateTimer > 0) {
    opp.stateTimer--;
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
      const dur = ATTACK_DURATION[opp.state] || 12;
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
  const diff = state.aiDifficulty;

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

  aiActionTimer--;
  if (aiActionTimer <= 0) {
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
  if (false && aiActionTimer <= 0) {
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
  const speed = 2.5 + diff;
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
      break;
    case 'dash-in':
      releaseBlock();
      opp.velocityX = dir * (speed * 1.35);
      opp.state = 'walk-forward';
      break;
    case 'retreat':
      releaseBlock();
      opp.velocityX = -dir * (speed * 0.8);
      opp.state = 'walk-backward';
      opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_RETREAT);
      break;
    case 'hold-range': {
      releaseBlock();
      const desiredRange = aiMode === 'bait' ? KICK_RANGE + 18 : GYAKU_ZUKI_RANGE + 12;
      if (dist < desiredRange - 14 && !cornered) {
        opp.velocityX = -dir * (speed * 0.7);
        opp.state = 'walk-backward';
        opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_RETREAT);
      } else if (dist > desiredRange + 20) {
        opp.velocityX = dir * (speed * 0.75);
        opp.state = 'walk-forward';
      } else {
        opp.velocityX = 0;
        opp.state = 'idle';
        opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_IDLE);
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
      if (opp.state !== 'block') opp.blockTimer = 0;
      opp.state = 'block';
      opp.blockTimer++;
      opp.velocityX = 0;
      // Drain stamina while blocking past parry window
      if (opp.blockTimer > PARRY_WINDOW) {
        opp.stamina = Math.max(0, opp.stamina - BLOCK_DRAIN);
        if (opp.stamina <= 0) {
          opp.exhausted = EXHAUSTED_DURATION_FRAMES;
          opp.state = 'hit';
          opp.stateTimer = EXHAUSTED_DURATION_FRAMES;
        }
      }
      break;
    default:
      releaseBlock();
      opp.velocityX = 0;
      if (opp.state === 'walk-forward' || opp.state === 'walk-backward') opp.state = 'idle';
      // Idle regen
      opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_IDLE);
  }
}

function executeAIAttack(opp: Fighter, player: Fighter, attack: 'punch' | 'gyaku-zuki' | 'kick' | 'mae-geri', _diff: number): boolean {
  const baseCost = ATTACK_COSTS[attack];
  // If chaining out of an attack's cancel window, apply combo discount/speedup
  const chaining = isAttackState(opp.state) && opp.stateTimer <= CANCEL_WINDOW;
  const cost = chaining ? baseCost * COMBO_STAMINA_BONUS : baseCost;
  if (opp.stamina < cost) return false;

  const baseDuration = ATTACK_DURATION[attack];
  opp.state = attack;
  opp.stateTimer = chaining ? Math.floor(baseDuration * COMBO_SPEED_BONUS) : baseDuration;
  opp.stamina -= cost;
  opp.velocityX = 0;
  opp.telegraphFlash = ATTACK_STARTUP_TELEGRAPH;
  startLunge(opp, player, attack);
  return true;
}
