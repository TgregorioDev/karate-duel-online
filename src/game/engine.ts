import {
  Fighter, GameState, InputState,
  CANVAS_WIDTH, GROUND_Y, FIGHT_DURATION, MAX_SCORE,
  FIGHTER_WIDTH, PUNCH_RANGE, KICK_RANGE, GYAKU_ZUKI_RANGE, MAE_GERI_RANGE,
  STAMINA_MAX, STAMINA_REGEN_IDLE, STAMINA_REGEN_RETREAT, BLOCK_DRAIN,
  PUNCH_COST, KICK_COST, GYAKU_ZUKI_COST, MAE_GERI_COST,
  PARRY_WINDOW, PARRY_COUNTER_WINDOW, ATTACK_STARTUP_TELEGRAPH,
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
    fighter.state = 'hit'; // reuse hit state for visual recoil/exhaustion
    if (fighter.exhausted <= 0) {
      fighter.state = 'idle';
      fighter.stateTimer = 0;
    }
    return;
  }

  // State timer
  if (fighter.stateTimer > 0) {
    fighter.stateTimer--;
    if (fighter.stateTimer <= 0 && fighter.state !== 'block') {
      fighter.state = 'idle';
    }
    if (fighter.state === 'hit') return;
    // If mid-attack but NOT in the cancel window, lock out other actions
    if (isAttackState(fighter.state) && fighter.stateTimer > CANCEL_WINDOW) {
      // Update telegraph flash during startup
      const dur = ATTACK_DURATION[fighter.state] || 12;
      const hitFrame = Math.floor(dur / 2);
      if (fighter.stateTimer > hitFrame && fighter.stateTimer <= hitFrame + ATTACK_STARTUP_TELEGRAPH) {
        fighter.telegraphFlash = 2;
      }
      return;
    }
  }

  // Block — drains stamina while held; first PARRY_WINDOW frames are a parry
  if (input.block && !isAttackState(fighter.state) && fighter.state !== 'hit') {
    if (fighter.state !== 'block') {
      fighter.blockTimer = 0;
    }
    fighter.state = 'block';
    fighter.blockTimer++;
    fighter.velocityX = 0;
    // Drain stamina for sustained blocking
    if (fighter.blockTimer > PARRY_WINDOW) {
      fighter.stamina = Math.max(0, fighter.stamina - BLOCK_DRAIN);
      // Out of stamina while blocking → guard breaks, exhausted
      if (fighter.stamina <= 0) {
        fighter.exhausted = 60;
        fighter.state = 'hit';
        fighter.stateTimer = 60;
      }
    }
    return;
  } else if (fighter.state === 'block' && !input.block) {
    fighter.state = 'idle';
    fighter.blockTimer = 0;
  }

  if (fighter.state === 'block') return;

  // Combo bonus + parry counter bonus: parryWindow grants a guaranteed-counter discount/speed
  const inParryCounter = fighter.parryWindow > 0;
  const inCombo = inParryCounter || (fighter.hitCooldown > 0 && fighter.hitCooldown <= COMBO_WINDOW) || isAttackState(fighter.state);

  const target = fighter === state.player ? state.opponent : state.player;
  const ready = canStartAttack(fighter);

  const tryAttack = (
    inputFlag: boolean,
    name: 'punch' | 'gyaku-zuki' | 'kick' | 'mae-geri',
    baseCost: number,
  ): boolean => {
    if (!inputFlag || !ready) return false;
    const cost = inCombo ? baseCost * COMBO_STAMINA_BONUS : baseCost;
    if (fighter.stamina < cost) return false;
    fighter.state = name;
    fighter.stateTimer = inCombo ? Math.floor(ATTACK_DURATION[name] * COMBO_SPEED_BONUS) : ATTACK_DURATION[name];
    fighter.stamina -= cost;
    fighter.velocityX = 0;
    fighter.telegraphFlash = ATTACK_STARTUP_TELEGRAPH;
    if (inParryCounter) fighter.parryWindow = 0; // consumed
    startLunge(fighter, target, name);
    return true;
  };

  if (tryAttack(input.punch, 'punch', PUNCH_COST)) return;
  if (tryAttack(input.gyakuZuki, 'gyaku-zuki', GYAKU_ZUKI_COST)) return;
  if (tryAttack(input.kick, 'kick', KICK_COST)) return;
  if (tryAttack(input.maeGeri, 'mae-geri', MAE_GERI_COST)) return;

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
  if (defender.state === 'block' && defender.blockTimer <= PARRY_WINDOW) {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 18, type: 'punch' };
    defender.parryFlash = 20;
    defender.parryWindow = PARRY_COUNTER_WINDOW;
    defender.stamina = Math.min(STAMINA_MAX, defender.stamina + 15); // reward perfect timing
    // Attacker stunned briefly, exposed to counter
    attacker.state = 'hit';
    attacker.stateTimer = 18;
    attacker.hitCooldown = 12;
    state.judgeMessage = 'PARRY!';
    state.judgeTimer = 35;
    return;
  }

  // Late block — partial protection, no counter, costs stamina
  const LATE_BLOCK_WINDOW = 14;
  if (defender.state === 'block' && defender.blockTimer <= LATE_BLOCK_WINDOW) {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 10, type: 'punch' };
    defender.stamina = Math.max(0, defender.stamina - 12);
    if (defender.stamina <= 0) {
      defender.exhausted = 60;
      defender.state = 'hit';
      defender.stateTimer = 60;
    }
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
// Pre-planned follow-up attack to chain into the cancel window (AI combos)
let aiComboNext: 'punch' | 'kick' | 'gyaku-zuki' | 'mae-geri' | null = null;

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

  // React to player's TELEGRAPH (smarter AI uses the wind-up window for parry attempts)
  const playerTelegraphing = player.telegraphFlash > 0 && isAttackState(player.state);

  aiActionTimer--;
  if (aiActionTimer <= 0) {
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

  switch (aiAction) {
    case 'advance':
      opp.velocityX = dir * speed;
      opp.state = 'walk-forward';
      break;
    case 'retreat':
      opp.velocityX = -dir * (speed * 0.8);
      opp.state = 'walk-backward';
      opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_RETREAT);
      break;
    case 'punch':
    case 'gyaku-zuki':
    case 'kick':
    case 'mae-geri':
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
          opp.exhausted = 60;
          opp.state = 'hit';
          opp.stateTimer = 60;
        }
      }
      break;
    default:
      opp.velocityX = 0;
      if (opp.state === 'walk-forward' || opp.state === 'walk-backward') opp.state = 'idle';
      // Idle regen
      opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN_IDLE);
  }
}

const ATTACK_COSTS: Record<string, number> = {
  punch: PUNCH_COST,
  'gyaku-zuki': GYAKU_ZUKI_COST,
  kick: KICK_COST,
  'mae-geri': MAE_GERI_COST,
};

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
