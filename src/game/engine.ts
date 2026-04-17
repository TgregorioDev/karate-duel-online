import {
  Fighter, GameState, InputState,
  CANVAS_WIDTH, GROUND_Y, FIGHT_DURATION, MAX_SCORE,
  FIGHTER_WIDTH, PUNCH_RANGE, KICK_RANGE, GYAKU_ZUKI_RANGE, MAE_GERI_RANGE,
  STAMINA_MAX, STAMINA_REGEN, PUNCH_COST, KICK_COST, GYAKU_ZUKI_COST, MAE_GERI_COST,
} from './types';

export function createFighter(x: number, facing: 'left' | 'right', color: string, accent: string, belt: string): Fighter {
  return {
    x, y: GROUND_Y, width: FIGHTER_WIDTH, height: 120,
    velocityX: 0, health: 100, score: 0,
    facing, state: 'idle', stateTimer: 0,
    stamina: STAMINA_MAX, hitCooldown: 0, blockTimer: 0,
    color, accentColor: accent, beltColor: belt,
    lungeVelocity: 0, lungeFramesLeft: 0, lungeDistanceLeft: 0,
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
  const gap = Math.max(0, Math.abs(target.x - fighter.x) - 50);
  fighter.lungeDistanceLeft = Math.min(LUNGE_MAX_DISTANCE, gap);
}

export function createInitialState(): GameState {
  return {
    player: createFighter(280, 'right', '#1a3a6a', '#cc2222', '#111'),
    opponent: createFighter(680, 'left', '#6a1a1a', '#2255cc', '#111'),
    timeRemaining: FIGHT_DURATION,
    gameStatus: 'menu',
    pointScoredBy: null,
    winner: null,
    aiDifficulty: 0.3,
    judgeMessage: '',
    judgeTimer: 0,
    hitEffect: null,
  };
}

export function resetPositions(state: GameState) {
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
  state.hitEffect = null;
}

const ATTACK_DURATION: Record<string, number> = {
  punch: 12,
  kick: 18,
  'gyaku-zuki': 14,
  'mae-geri': 16,
};
const HIT_STUN = 20;

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

function isAttackState(state: string): boolean {
  return state === 'punch' || state === 'kick' || state === 'gyaku-zuki' || state === 'mae-geri';
}

export function updateGame(state: GameState, input: InputState, dt: number): GameState {
  if (state.gameStatus !== 'fighting' && state.gameStatus !== 'point-scored') return state;

  // Judge message timer
  if (state.judgeTimer > 0) {
    state.judgeTimer -= 1;
    if (state.judgeTimer <= 0 && state.gameStatus === 'point-scored') {
      if (state.player.score >= MAX_SCORE || state.opponent.score >= MAX_SCORE) {
        state.gameStatus = 'game-over';
        state.winner = state.player.score >= MAX_SCORE ? 'player' : 'opponent';
        const w = state.winner === 'player' ? state.player : state.opponent;
        w.state = 'victory';
        return state;
      }
      resetPositions(state);
      state.gameStatus = 'fighting';
      state.judgeMessage = 'HAJIME!';
      state.judgeTimer = 40;
    }
    if (state.gameStatus === 'point-scored') return state;
  }

  // Timer
  state.timeRemaining -= dt / 60;
  if (state.timeRemaining <= 0) {
    state.timeRemaining = 0;
    state.gameStatus = 'game-over';
    if (state.player.score > state.opponent.score) state.winner = 'player';
    else if (state.opponent.score > state.player.score) state.winner = 'opponent';
    else state.winner = 'draw';
    return state;
  }

  // Hit effect
  if (state.hitEffect) {
    state.hitEffect.timer -= 1;
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
  // Stamina regen
  fighter.stamina = Math.min(STAMINA_MAX, fighter.stamina + STAMINA_REGEN);
  if (fighter.hitCooldown > 0) fighter.hitCooldown--;

  // State timer
  if (fighter.stateTimer > 0) {
    fighter.stateTimer--;
    if (fighter.stateTimer <= 0 && fighter.state !== 'block') {
      fighter.state = 'idle';
    }
    if (fighter.state === 'hit' || isAttackState(fighter.state)) return;
  }

  // Block
  if (input.block && !isAttackState(fighter.state) && fighter.state !== 'hit') {
    if (fighter.state !== 'block') {
      fighter.blockTimer = 0;
    }
    fighter.state = 'block';
    fighter.blockTimer++;
    fighter.velocityX = 0;
    return;
  } else if (fighter.state === 'block' && !input.block) {
    fighter.state = 'idle';
    fighter.blockTimer = 0;
  }

  if (fighter.state === 'block') return;

  // Check if in combo window (hitCooldown is set after attacks land, but we use stateTimer transition)
  const inCombo = fighter.hitCooldown > 0 && fighter.hitCooldown <= COMBO_WINDOW;

  const target = fighter === state.player ? state.opponent : state.player;

  // Attacks - check all four, combo-aware
  if (input.punch && fighter.stateTimer <= 0 && fighter.hitCooldown <= 0) {
    const cost = inCombo ? PUNCH_COST * COMBO_STAMINA_BONUS : PUNCH_COST;
    if (fighter.stamina >= cost) {
      fighter.state = 'punch';
      fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION.punch * COMBO_SPEED_BONUS) : ATTACK_DURATION.punch;
      fighter.stamina -= cost;
      fighter.velocityX = 0;
      startLunge(fighter, target, 'punch');
      return;
    }
  }
  if (input.gyakuZuki && fighter.stateTimer <= 0 && fighter.hitCooldown <= 0) {
    const cost = inCombo ? GYAKU_ZUKI_COST * COMBO_STAMINA_BONUS : GYAKU_ZUKI_COST;
    if (fighter.stamina >= cost) {
      fighter.state = 'gyaku-zuki';
      fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION['gyaku-zuki'] * COMBO_SPEED_BONUS) : ATTACK_DURATION['gyaku-zuki'];
      fighter.stamina -= cost;
      fighter.velocityX = 0;
      startLunge(fighter, target, 'gyaku-zuki');
      return;
    }
  }
  if (input.kick && fighter.stateTimer <= 0 && fighter.hitCooldown <= 0) {
    const cost = inCombo ? KICK_COST * COMBO_STAMINA_BONUS : KICK_COST;
    if (fighter.stamina >= cost) {
      fighter.state = 'kick';
      fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION.kick * COMBO_SPEED_BONUS) : ATTACK_DURATION.kick;
      fighter.stamina -= cost;
      fighter.velocityX = 0;
      startLunge(fighter, target, 'kick');
      return;
    }
  }
  if (input.maeGeri && fighter.stateTimer <= 0 && fighter.hitCooldown <= 0) {
    const cost = inCombo ? MAE_GERI_COST * COMBO_STAMINA_BONUS : MAE_GERI_COST;
    if (fighter.stamina >= cost) {
      fighter.state = 'mae-geri';
      fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION['mae-geri'] * COMBO_SPEED_BONUS) : ATTACK_DURATION['mae-geri'];
      fighter.stamina -= cost;
      fighter.velocityX = 0;
      startLunge(fighter, target, 'mae-geri');
      return;
    }
  }

  // Movement
  const speed = 3.5;
  if (input.left) {
    fighter.velocityX = -speed;
    fighter.state = fighter.facing === 'left' ? 'walk-forward' : 'walk-backward';
  } else if (input.right) {
    fighter.velocityX = speed;
    fighter.state = fighter.facing === 'right' ? 'walk-forward' : 'walk-backward';
  } else {
    fighter.velocityX = 0;
    if (fighter.state === 'walk-forward' || fighter.state === 'walk-backward') fighter.state = 'idle';
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
  if (dist < 40) {
    const push = (40 - dist) / 2;
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

  // Blocked? Only effective if timed correctly (within first 12 frames)
  const BLOCK_WINDOW = 12;
  if (defender.state === 'block' && defender.blockTimer <= BLOCK_WINDOW) {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 10, type: 'punch' };
    defender.stamina -= 5;
    return;
  }

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
  attacker.score += 1;
  state.pointScoredBy = attackerLabel;
  state.gameStatus = 'point-scored';

  const scoreNames = ['', 'IPPON!', 'NIHON!', 'SANBON!', 'YONHON!'];
  state.judgeMessage = `YAME! — ${scoreNames[attacker.score] || 'PONTO!'}`;
  state.judgeTimer = 90;

  // Increase AI difficulty
  if (attackerLabel === 'player') {
    state.aiDifficulty = Math.min(0.9, state.aiDifficulty + 0.1);
  }
}

// ===== AI =====
let aiActionTimer = 0;
let aiAction: 'idle' | 'advance' | 'retreat' | 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri' | 'block' = 'idle';

export function updateAI(state: GameState) {
  const opp = state.opponent;
  const player = state.player;
  
  opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN);
  if (opp.hitCooldown > 0) opp.hitCooldown--;

  if (opp.stateTimer > 0) {
    opp.stateTimer--;
    if (opp.stateTimer <= 0 && opp.state !== 'block') opp.state = 'idle';
    if (opp.state === 'hit' || isAttackState(opp.state)) return;
  }

  const dist = Math.abs(opp.x - player.x);
  const diff = state.aiDifficulty;

  aiActionTimer--;
  if (aiActionTimer <= 0) {
    const rand = Math.random();
    
    if (isAttackState(player.state)) {
      // React to player attack
      if (rand < diff * 0.7) {
        aiAction = 'block';
        aiActionTimer = 20;
      } else if (rand < diff) {
        aiAction = 'retreat';
        aiActionTimer = 15;
      } else {
        aiAction = 'idle';
        aiActionTimer = 10;
      }
    } else if (dist < GYAKU_ZUKI_RANGE + 10 && opp.stamina >= GYAKU_ZUKI_COST) {
      // Close range - use variety of attacks
      if (rand < diff * 0.5) {
        const attackRoll = Math.random();
        if (attackRoll < 0.3) aiAction = 'punch';
        else if (attackRoll < 0.55) aiAction = 'gyaku-zuki';
        else if (attackRoll < 0.8) aiAction = 'kick';
        else aiAction = 'mae-geri';
        aiActionTimer = 8;
      } else {
        aiAction = Math.random() < 0.5 ? 'retreat' : 'block';
        aiActionTimer = 20;
      }
    } else if (dist < KICK_RANGE + 20 && opp.stamina >= KICK_COST) {
      if (rand < diff * 0.4) {
        aiAction = Math.random() < 0.5 ? 'kick' : 'mae-geri';
        aiActionTimer = 10;
      } else {
        aiAction = 'advance';
        aiActionTimer = 15;
      }
    } else {
      aiAction = rand < 0.7 ? 'advance' : 'idle';
      aiActionTimer = 20 + Math.floor(Math.random() * 20);
    }
  }

  // Execute action
  const speed = 2.5 + diff;
  const dir = player.x < opp.x ? -1 : 1;

  switch (aiAction) {
    case 'advance':
      opp.velocityX = dir * speed;
      opp.state = 'walk-forward';
      break;
    case 'retreat':
      opp.velocityX = -dir * (speed * 0.8);
      opp.state = 'walk-backward';
      break;
    case 'punch':
      if (opp.stateTimer <= 0 && opp.stamina >= PUNCH_COST && opp.hitCooldown <= 0) {
        opp.state = 'punch';
        opp.stateTimer = ATTACK_DURATION.punch;
        opp.stamina -= PUNCH_COST;
        opp.velocityX = 0;
        aiAction = 'idle';
      }
      break;
    case 'gyaku-zuki':
      if (opp.stateTimer <= 0 && opp.stamina >= GYAKU_ZUKI_COST && opp.hitCooldown <= 0) {
        opp.state = 'gyaku-zuki';
        opp.stateTimer = ATTACK_DURATION['gyaku-zuki'];
        opp.stamina -= GYAKU_ZUKI_COST;
        opp.velocityX = 0;
        aiAction = 'idle';
      }
      break;
    case 'kick':
      if (opp.stateTimer <= 0 && opp.stamina >= KICK_COST && opp.hitCooldown <= 0) {
        opp.state = 'kick';
        opp.stateTimer = ATTACK_DURATION.kick;
        opp.stamina -= KICK_COST;
        opp.velocityX = 0;
        aiAction = 'idle';
      }
      break;
    case 'mae-geri':
      if (opp.stateTimer <= 0 && opp.stamina >= MAE_GERI_COST && opp.hitCooldown <= 0) {
        opp.state = 'mae-geri';
        opp.stateTimer = ATTACK_DURATION['mae-geri'];
        opp.stamina -= MAE_GERI_COST;
        opp.velocityX = 0;
        aiAction = 'idle';
      }
      break;
    case 'block':
      if (opp.state !== 'block') {
        opp.blockTimer = 0;
      }
      opp.state = 'block';
      opp.blockTimer++;
      opp.velocityX = 0;
      break;
    default:
      opp.velocityX = 0;
      if (opp.state === 'walk-forward' || opp.state === 'walk-backward') opp.state = 'idle';
  }
}
