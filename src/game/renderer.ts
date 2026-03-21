import { Fighter, GameState, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, STAMINA_MAX, MAX_SCORE } from './types';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground(ctx);
  drawFighter(ctx, state.player, 'P1');
  drawFighter(ctx, state.opponent, 'P2');
  if (state.hitEffect) drawHitEffect(ctx, state.hitEffect);
  drawHUD(ctx, state);
  if (state.judgeTimer > 0) drawJudgeMessage(ctx, state.judgeMessage);
  if (state.gameStatus === 'menu') drawMenu(ctx);
  if (state.gameStatus === 'game-over') drawGameOver(ctx, state);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  // Dojo background
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, '#1a0a0a');
  grad.addColorStop(0.6, '#2a1515');
  grad.addColorStop(1, '#1a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Tatami floor
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  
  // Tatami lines
  ctx.strokeStyle = '#7A6548';
  ctx.lineWidth = 1;
  for (let i = 0; i < CANVAS_WIDTH; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, GROUND_Y);
    ctx.lineTo(i, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let j = GROUND_Y; j < CANVAS_HEIGHT; j += 20) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(CANVAS_WIDTH, j);
    ctx.stroke();
  }

  // Fighting area boundary
  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, GROUND_Y + 2);
  ctx.lineTo(CANVAS_WIDTH - 100, GROUND_Y + 2);
  ctx.stroke();

  // Background decoration - torii gate silhouette
  ctx.fillStyle = 'rgba(139, 0, 0, 0.15)';
  // Pillars
  ctx.fillRect(380, 40, 12, 200);
  ctx.fillRect(568, 40, 12, 200);
  // Top beam
  ctx.fillRect(365, 40, 230, 14);
  ctx.fillRect(370, 70, 220, 10);
}

function drawFighter(ctx: CanvasRenderingContext2D, fighter: Fighter, label: string) {
  const { x, y, facing, state: fState, color, accentColor, beltColor } = fighter;
  const flip = facing === 'left' ? -1 : 1;
  
  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, GROUND_Y - y + 5, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyOffsetY = fState === 'hit' ? -5 : 0;
  const bobY = (fState === 'idle') ? Math.sin(Date.now() / 300) * 2 : 0;
  const totalOffsetY = bodyOffsetY + bobY;

  // Legs
  ctx.fillStyle = color;
  if (fState === 'kick') {
    // Kicking leg extended
    ctx.fillRect(5, -30 + totalOffsetY, 40, 14);
    ctx.fillRect(-10, -15 + totalOffsetY, 14, 50);
  } else if (fState === 'walk-forward' || fState === 'walk-backward') {
    const legAnim = Math.sin(Date.now() / 100) * 8;
    ctx.fillRect(-8 + legAnim, -15 + totalOffsetY, 12, 50);
    ctx.fillRect(2 - legAnim, -15 + totalOffsetY, 12, 50);
  } else {
    ctx.fillRect(-8, -15 + totalOffsetY, 12, 50);
    ctx.fillRect(2, -15 + totalOffsetY, 12, 50);
  }

  // Body (gi)
  ctx.fillStyle = fState === 'hit' ? '#ff6666' : '#f5f5f0';
  ctx.fillRect(-18, -70 + totalOffsetY, 36, 58);
  
  // Gi lapel
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(0, -70 + totalOffsetY);
  ctx.lineTo(-10, -40 + totalOffsetY);
  ctx.lineTo(10, -40 + totalOffsetY);
  ctx.closePath();
  ctx.fill();

  // Belt
  ctx.fillStyle = beltColor;
  ctx.fillRect(-20, -18 + totalOffsetY, 40, 6);

  // Arms
  ctx.fillStyle = '#e8c9a0';
  if (fState === 'punch') {
    // Punching arm extended
    ctx.fillRect(10, -60 + totalOffsetY, 50, 10);
    // Fist
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(55, -62 + totalOffsetY, 12, 14);
    // Back arm
    ctx.fillStyle = '#e8c9a0';
    ctx.fillRect(-25, -55 + totalOffsetY, 12, 25);
  } else if (fState === 'block') {
    // Arms crossed in front
    ctx.fillRect(-5, -65 + totalOffsetY, 10, 35);
    ctx.fillRect(5, -65 + totalOffsetY, 10, 35);
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(-7, -68 + totalOffsetY, 14, 10);
    ctx.fillRect(3, -68 + totalOffsetY, 14, 10);
  } else {
    // Karate stance
    ctx.fillRect(14, -60 + totalOffsetY, 10, 30);
    ctx.fillRect(-22, -55 + totalOffsetY, 10, 25);
    // Fists
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(13, -62 + totalOffsetY, 12, 10);
    ctx.fillRect(-23, -57 + totalOffsetY, 12, 10);
  }

  // Head
  ctx.fillStyle = '#e8c9a0';
  ctx.beginPath();
  ctx.arc(0, -82 + totalOffsetY, 16, 0, Math.PI * 2);
  ctx.fill();

  // Hair/headband
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(0, -88 + totalOffsetY, 16, Math.PI, 0);
  ctx.fill();
  // Headband tails
  ctx.fillRect(-16, -85 + totalOffsetY, -12, 4);

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(4, -84 + totalOffsetY, 4, 4);
  ctx.fillRect(-6, -84 + totalOffsetY, 4, 4);

  // Victory pose
  if (fState === 'victory') {
    ctx.fillStyle = '#e8c9a0';
    ctx.fillRect(-5, -110, 10, 35);
    ctx.fillRect(5, -115, 10, 35);
  }

  ctx.restore();
}

function drawHitEffect(ctx: CanvasRenderingContext2D, effect: { x: number; y: number; timer: number; type: string }) {
  const alpha = effect.timer / 15;
  const size = (15 - effect.timer) * 3;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  
  // Impact burst
  ctx.strokeStyle = effect.type === 'kick' ? '#ff4444' : '#ffaa00';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i;
    ctx.beginPath();
    ctx.moveTo(effect.x + Math.cos(angle) * size * 0.3, effect.y + Math.sin(angle) * size * 0.3);
    ctx.lineTo(effect.x + Math.cos(angle) * size, effect.y + Math.sin(angle) * size);
    ctx.stroke();
  }

  // Impact text
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${14 + size/3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(effect.type === 'kick' ? 'KICK!' : 'HIT!', effect.x, effect.y - size);
  
  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  // Score display
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
  
  // Player score
  ctx.fillStyle = '#4488ff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('JOGADOR', 20, 20);
  
  // Score dots
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 28, 38, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < state.player.score ? '#4488ff' : '#333';
    ctx.fill();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Opponent score
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('OPONENTE', CANVAS_WIDTH - 20, 20);
  
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 20 - i * 28, 38, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < state.opponent.score ? '#ff4444' : '#333';
    ctx.fill();
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Timer
  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = Math.floor(state.timeRemaining % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  ctx.fillStyle = state.timeRemaining <= 10 ? '#ff4444' : '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(timeStr, CANVAS_WIDTH / 2, 36);

  // Stamina bars
  const barWidth = 150;
  const barHeight = 6;
  
  // Player stamina
  ctx.fillStyle = '#333';
  ctx.fillRect(20, 48, barWidth, barHeight - 2);
  ctx.fillStyle = state.player.stamina > 25 ? '#44cc44' : '#cccc44';
  ctx.fillRect(20, 48, (state.player.stamina / STAMINA_MAX) * barWidth, barHeight - 2);

  // Opponent stamina
  ctx.fillStyle = '#333';
  ctx.fillRect(CANVAS_WIDTH - 20 - barWidth, 48, barWidth, barHeight - 2);
  ctx.fillStyle = state.opponent.stamina > 25 ? '#44cc44' : '#cccc44';
  const oppStaminaW = (state.opponent.stamina / STAMINA_MAX) * barWidth;
  ctx.fillRect(CANVAS_WIDTH - 20 - oppStaminaW, 48, oppStaminaW, barHeight - 2);
}

function drawJudgeMessage(ctx: CanvasRenderingContext2D, message: string) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT / 2 - 40, 320, 80);
  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 3;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 160, CANVAS_HEIGHT / 2 - 40, 320, 80);
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.restore();
}

function drawMenu(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Title
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('空手 KARATÊ', CANVAS_WIDTH / 2, 160);
  
  ctx.fillStyle = '#8B7355';
  ctx.font = '20px sans-serif';
  ctx.fillText('O Caminho das Mãos Vazias', CANVAS_WIDTH / 2, 200);

  // Instructions
  ctx.fillStyle = '#ccc';
  ctx.font = '16px sans-serif';
  const instructions = [
    '← → ou A/D — Mover',
    'Z ou J — Soco',
    'X ou K — Chute',
    'C ou L — Defesa',
  ];
  instructions.forEach((text, i) => {
    ctx.fillText(text, CANVAS_WIDTH / 2, 270 + i * 28);
  });

  // Start prompt
  ctx.fillStyle = Math.sin(Date.now() / 400) > 0 ? '#cc3333' : '#ff5555';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Pressione ENTER ou ESPAÇO para lutar!', CANVAS_WIDTH / 2, 430);
  
  ctx.restore();
}

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.textAlign = 'center';
  
  if (state.winner === 'player') {
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('VITÓRIA!', CANVAS_WIDTH / 2, 200);
  } else if (state.winner === 'opponent') {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('DERROTA', CANVAS_WIDTH / 2, 200);
  } else {
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('EMPATE', CANVAS_WIDTH / 2, 200);
  }

  ctx.fillStyle = '#ccc';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Placar: ${state.player.score} × ${state.opponent.score}`, CANVAS_WIDTH / 2, 260);

  ctx.fillStyle = Math.sin(Date.now() / 400) > 0 ? '#cc3333' : '#ff5555';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Pressione ENTER para jogar novamente', CANVAS_WIDTH / 2, 360);
  
  ctx.restore();
}
