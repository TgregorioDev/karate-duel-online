import {
  Fighter, GameState, InputState,
  CANVAS_WIDTH, GROUND_Y, FIGHT_DURATION, MAX_SCORE,
  FIGHTER_WIDTH, PUNCH_RANGE, KICK_RANGE,
  STAMINA_MAX, STAMINA_REGEN, PUNCH_COST, KICK_COST,
} from './types';

export function createFighter(x: number, facing: 'left' | 'right', color: string, accent: string, belt: string): Fighter {
  return {
    x, y: GROUND_Y, width: FIGHTER_WIDTH, height: 120,
    velocityX: 0, health: 100, score: 0,
    facing, state: 'idle', stateTimer: 0,
    stamina: STAMINA_MAX, hitCooldown: 0,
    color, accentColor: accent, beltColor: belt,
  };
}

export function createInitialState(): GameState {
  return {
    player: createFighter(280, 'right', '#1a3a6a', '#4488ff', '#111'),
    opponent: createFighter(680, 'left', '#6a1a1a', '#ff4444', '#111'),
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
  state.hitEffect = null;
}

const ATTACK_DURATION: Record<string, number> = { punch: 12, kick: 18 };
const HIT_STUN = 20;

export function updateGame(state: GameState, input: InputState, dt: number): GameState {
  if (state.gameStatus !== 'fighting' && state.gameStatus !== 'point-scored') return state;

  // Judge message timer
  if (state.judgeTimer > 0) {
    state.judgeTimer -= 1;
    if (state.judgeTimer <= 0 && state.gameStatus === 'point-scored') {
      // Check win
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
    if (fighter.state === 'hit' || fighter.state === 'punch' || fighter.state === 'kick') return;
  }

  // Block
  if (input.block && fighter.state !== 'punch' && fighter.state !== 'kick' && fighter.state !== 'hit') {
    fighter.state = 'block';
    fighter.velocityX = 0;
    return;
  } else if (fighter.state === 'block' && !input.block) {
    fighter.state = 'idle';
  }

  if (fighter.state === 'block') return;

  // Attack
  if (input.punch && fighter.stateTimer <= 0 && fighter.stamina >= PUNCH_COST && fighter.hitCooldown <= 0) {
    fighter.state = 'punch';
    fighter.stateTimer = ATTACK_DURATION.punch;
    fighter.stamina -= PUNCH_COST;
    fighter.velocityX = 0;
    return;
  }
  if (input.kick && fighter.stateTimer <= 0 && fighter.stamina >= KICK_COST && fighter.hitCooldown <= 0) {
    fighter.state = 'kick';
    fighter.stateTimer = ATTACK_DURATION.kick;
    fighter.stamina -= KICK_COST;
    fighter.velocityX = 0;
    return;
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
  fighter.x += fighter.velocityX;
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

function checkAttack(attacker: Fighter, defender: Fighter, attackerLabel: 'player' | 'opponent', state: GameState) {
  if (attacker.state !== 'punch' && attacker.state !== 'kick') return;
  
  // Only check on the "hit frame" (middle of animation)
  const duration = attacker.state === 'punch' ? ATTACK_DURATION.punch : ATTACK_DURATION.kick;
  const hitFrame = Math.floor(duration / 2);
  if (attacker.stateTimer !== hitFrame) return;

  const range = attacker.state === 'punch' ? PUNCH_RANGE : KICK_RANGE;
  const dist = Math.abs(attacker.x - defender.x);

  if (dist > range) return;

  // Blocked?
  if (defender.state === 'block') {
    state.hitEffect = { x: (attacker.x + defender.x) / 2, y: GROUND_Y - 60, timer: 10, type: 'punch' };
    defender.stamina -= 5;
    return;
  }

  // HIT!
  defender.state = 'hit';
  defender.stateTimer = HIT_STUN;
  defender.hitCooldown = 10;
  
  state.hitEffect = {
    x: (attacker.x + defender.x) / 2,
    y: GROUND_Y - 70,
    timer: 15,
    type: attacker.state === 'kick' ? 'kick' : 'punch',
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
let aiAction: 'idle' | 'advance' | 'retreat' | 'punch' | 'kick' | 'block' = 'idle';

export function updateAI(state: GameState) {
  const opp = state.opponent;
  const player = state.player;
  
  opp.stamina = Math.min(STAMINA_MAX, opp.stamina + STAMINA_REGEN);
  if (opp.hitCooldown > 0) opp.hitCooldown--;

  if (opp.stateTimer > 0) {
    opp.stateTimer--;
    if (opp.stateTimer <= 0 && opp.state !== 'block') opp.state = 'idle';
    if (opp.state === 'hit' || opp.state === 'punch' || opp.state === 'kick') return;
  }

  const dist = Math.abs(opp.x - player.x);
  const diff = state.aiDifficulty;

  aiActionTimer--;
  if (aiActionTimer <= 0) {
    // Decide action
    const rand = Math.random();
    
    if (player.state === 'punch' || player.state === 'kick') {
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
    } else if (dist < PUNCH_RANGE + 10 && opp.stamina >= PUNCH_COST) {
      // In range - attack
      if (rand < diff * 0.5) {
        aiAction = rand < diff * 0.25 ? 'kick' : 'punch';
        aiActionTimer = 8;
      } else {
        aiAction = Math.random() < 0.5 ? 'retreat' : 'block';
        aiActionTimer = 20;
      }
    } else if (dist < KICK_RANGE + 20 && opp.stamina >= KICK_COST) {
      if (rand < diff * 0.4) {
        aiAction = 'kick';
        aiActionTimer = 10;
      } else {
        aiAction = 'advance';
        aiActionTimer = 15;
      }
    } else {
      // Far - approach
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
    case 'kick':
      if (opp.stateTimer <= 0 && opp.stamina >= KICK_COST && opp.hitCooldown <= 0) {
        opp.state = 'kick';
        opp.stateTimer = ATTACK_DURATION.kick;
        opp.stamina -= KICK_COST;
        opp.velocityX = 0;
        aiAction = 'idle';
      }
      break;
    case 'block':
      opp.state = 'block';
      opp.velocityX = 0;
      break;
    default:
      opp.velocityX = 0;
      if (opp.state === 'walk-forward' || opp.state === 'walk-backward') opp.state = 'idle';
  }
}
