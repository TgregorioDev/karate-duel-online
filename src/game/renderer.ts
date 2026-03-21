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
  const { x, y, facing, state: fState, accentColor, beltColor } = fighter;

  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);

  const bodyOffsetY = fState === 'hit' ? -5 : 0;
  const bobY = fState === 'idle' ? Math.sin(Date.now() / 300) * 2 : 0;
  const oY = bodyOffsetY + bobY;
  const skin = '#e2b88a';
  const skinDark = '#c9985e';
  const giWhite = fState === 'hit' ? '#ffaaaa' : '#f0ede6';
  const giShadow = fState === 'hit' ? '#e08888' : '#d8d4ca';
  const giDark = fState === 'hit' ? '#cc7777' : '#c5c0b5';
  const belt = '#111';
  const beltKnot = '#222';

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, GROUND_Y - y + 4, 35, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // === FEET (bare) ===
  if (fState === 'kick') {
    // Standing foot
    ctx.fillStyle = skinDark;
    drawRoundedRect(ctx, -10, 30 + oY, 16, 8, 3);
    ctx.fill();
    // Kicking foot extended
    ctx.fillStyle = skin;
    drawRoundedRect(ctx, 40, -28 + oY, 18, 8, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = skinDark;
    const walkOff = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(Date.now() / 100) * 6 : 0;
    drawRoundedRect(ctx, -10 + walkOff, 30 + oY, 16, 8, 3);
    ctx.fill();
    drawRoundedRect(ctx, 2 - walkOff, 30 + oY, 16, 8, 3);
    ctx.fill();
  }

  // === LEGS (gi pants - hakama style, wide) ===
  ctx.fillStyle = giWhite;
  if (fState === 'kick') {
    // Kicking leg - extended horizontal
    ctx.beginPath();
    ctx.moveTo(5, -14 + oY);
    ctx.lineTo(45, -34 + oY);
    ctx.lineTo(45, -22 + oY);
    ctx.lineTo(5, 0 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = giShadow;
    ctx.beginPath();
    ctx.moveTo(5, -5 + oY);
    ctx.lineTo(5, 0 + oY);
    ctx.lineTo(45, -22 + oY);
    ctx.lineTo(45, -26 + oY);
    ctx.closePath();
    ctx.fill();
    // Standing leg
    ctx.fillStyle = giWhite;
    ctx.beginPath();
    ctx.moveTo(-14, -14 + oY);
    ctx.lineTo(-14, 30 + oY);
    ctx.lineTo(8, 30 + oY);
    ctx.lineTo(8, -14 + oY);
    ctx.closePath();
    ctx.fill();
  } else {
    const walkOff = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(Date.now() / 100) * 6 : 0;
    // Left pant leg (wide bottom like gi)
    ctx.beginPath();
    ctx.moveTo(-14, -14 + oY);
    ctx.lineTo(-16 + walkOff, 30 + oY);
    ctx.lineTo(6 + walkOff, 30 + oY);
    ctx.lineTo(2, -14 + oY);
    ctx.closePath();
    ctx.fill();
    // Right pant leg
    ctx.beginPath();
    ctx.moveTo(0, -14 + oY);
    ctx.lineTo(-2 - walkOff, 30 + oY);
    ctx.lineTo(18 - walkOff, 30 + oY);
    ctx.lineTo(14, -14 + oY);
    ctx.closePath();
    ctx.fill();
    // Pant fold line
    ctx.strokeStyle = giDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5 + walkOff, 0 + oY);
    ctx.lineTo(-4 + walkOff, 28 + oY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7 - walkOff, 0 + oY);
    ctx.lineTo(8 - walkOff, 28 + oY);
    ctx.stroke();
  }

  // === TORSO (gi jacket) ===
  // Back of gi
  ctx.fillStyle = giShadow;
  drawRoundedRect(ctx, -20, -72 + oY, 40, 60, 3);
  ctx.fill();
  // Front of gi
  ctx.fillStyle = giWhite;
  drawRoundedRect(ctx, -18, -72 + oY, 38, 58, 3);
  ctx.fill();

  // Gi lapel (V-neck crossover)
  ctx.fillStyle = giShadow;
  ctx.beginPath();
  ctx.moveTo(-12, -72 + oY);
  ctx.lineTo(0, -40 + oY);
  ctx.lineTo(14, -72 + oY);
  ctx.lineTo(6, -72 + oY);
  ctx.lineTo(0, -52 + oY);
  ctx.lineTo(-6, -72 + oY);
  ctx.closePath();
  ctx.fill();

  // Inner lapel line
  ctx.strokeStyle = giDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-8, -72 + oY);
  ctx.lineTo(0, -46 + oY);
  ctx.lineTo(10, -72 + oY);
  ctx.stroke();

  // Gi fold details on torso
  ctx.strokeStyle = giDark;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-15, -50 + oY);
  ctx.quadraticCurveTo(-10, -45 + oY, -5, -44 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, -50 + oY);
  ctx.quadraticCurveTo(12, -46 + oY, 6, -44 + oY);
  ctx.stroke();

  // === BLACK BELT (obi) ===
  ctx.fillStyle = belt;
  ctx.fillRect(-22, -18 + oY, 44, 8);
  // Belt texture lines
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-22, -16 + oY);
  ctx.lineTo(22, -16 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-22, -12 + oY);
  ctx.lineTo(22, -12 + oY);
  ctx.stroke();
  // Belt knot
  ctx.fillStyle = beltKnot;
  ctx.beginPath();
  ctx.ellipse(2, -14 + oY, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belt tails hanging down
  ctx.fillStyle = belt;
  ctx.beginPath();
  ctx.moveTo(-1, -10 + oY);
  ctx.lineTo(-6, 6 + oY);
  ctx.lineTo(-3, 6 + oY);
  ctx.lineTo(2, -10 + oY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, -10 + oY);
  ctx.lineTo(8, 4 + oY);
  ctx.lineTo(5, 4 + oY);
  ctx.lineTo(0, -10 + oY);
  ctx.closePath();
  ctx.fill();

  // === SLEEVES & ARMS ===
  if (fState === 'punch') {
    // Front arm - extended punch
    // Sleeve
    ctx.fillStyle = giWhite;
    ctx.beginPath();
    ctx.moveTo(14, -66 + oY);
    ctx.lineTo(28, -62 + oY);
    ctx.lineTo(28, -52 + oY);
    ctx.lineTo(14, -48 + oY);
    ctx.closePath();
    ctx.fill();
    // Forearm (skin)
    ctx.fillStyle = skin;
    ctx.fillRect(28, -60 + oY, 30, 10);
    // Fist
    ctx.fillStyle = skinDark;
    drawRoundedRect(ctx, 56, -63 + oY, 14, 16, 4);
    ctx.fill();
    // Knuckle line
    ctx.strokeStyle = '#b8854a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, -62 + oY);
    ctx.lineTo(60, -49 + oY);
    ctx.stroke();

    // Back arm tucked at hip
    ctx.fillStyle = giWhite;
    drawRoundedRect(ctx, -26, -60 + oY, 14, 22, 3);
    ctx.fill();
    ctx.fillStyle = skin;
    drawRoundedRect(ctx, -24, -40 + oY, 10, 8, 3);
    ctx.fill();
  } else if (fState === 'block') {
    // Both arms raised in gedan-barai / age-uke
    ctx.fillStyle = giWhite;
    // Left sleeve
    drawRoundedRect(ctx, -22, -68 + oY, 16, 20, 3);
    ctx.fill();
    // Right sleeve
    drawRoundedRect(ctx, 8, -68 + oY, 16, 20, 3);
    ctx.fill();
    // Forearms crossed
    ctx.fillStyle = skin;
    ctx.lineWidth = 8;
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-14, -48 + oY);
    ctx.lineTo(4, -68 + oY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, -48 + oY);
    ctx.lineTo(-2, -68 + oY);
    ctx.stroke();
    // Fists
    ctx.fillStyle = skinDark;
    drawRoundedRect(ctx, -2, -73 + oY, 10, 10, 3);
    ctx.fill();
    drawRoundedRect(ctx, -6, -73 + oY, 10, 10, 3);
    ctx.fill();
  } else if (fState === 'kick') {
    // Arms in guard position during kick
    ctx.fillStyle = giWhite;
    drawRoundedRect(ctx, 10, -66 + oY, 14, 24, 3);
    ctx.fill();
    drawRoundedRect(ctx, -22, -62 + oY, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = skin;
    drawRoundedRect(ctx, 12, -44 + oY, 10, 8, 3);
    ctx.fill();
    drawRoundedRect(ctx, -20, -44 + oY, 10, 8, 3);
    ctx.fill();
  } else if (fState === 'victory') {
    // Arms raised in victory
    ctx.fillStyle = giWhite;
    // Left sleeve going up
    ctx.beginPath();
    ctx.moveTo(-16, -68 + oY);
    ctx.lineTo(-22, -95 + oY);
    ctx.lineTo(-10, -95 + oY);
    ctx.lineTo(-4, -68 + oY);
    ctx.closePath();
    ctx.fill();
    // Right sleeve going up
    ctx.beginPath();
    ctx.moveTo(6, -68 + oY);
    ctx.lineTo(12, -100 + oY);
    ctx.lineTo(24, -100 + oY);
    ctx.lineTo(18, -68 + oY);
    ctx.closePath();
    ctx.fill();
    // Hands
    ctx.fillStyle = skin;
    drawRoundedRect(ctx, -24, -102 + oY, 14, 10, 4);
    ctx.fill();
    drawRoundedRect(ctx, 12, -108 + oY, 14, 10, 4);
    ctx.fill();
  } else {
    // Karate fighting stance (zenkutsu-dachi inspired)
    // Front arm - guard up
    ctx.fillStyle = giWhite;
    ctx.beginPath();
    ctx.moveTo(14, -66 + oY);
    ctx.lineTo(24, -64 + oY);
    ctx.lineTo(24, -50 + oY);
    ctx.lineTo(14, -48 + oY);
    ctx.closePath();
    ctx.fill();
    // Forearm angled up
    ctx.fillStyle = skin;
    ctx.save();
    ctx.translate(24, -56 + oY);
    ctx.rotate(-0.6);
    ctx.fillRect(0, -4, 20, 8);
    ctx.restore();
    // Front fist
    ctx.fillStyle = skinDark;
    drawRoundedRect(ctx, 36, -70 + oY, 11, 12, 4);
    ctx.fill();

    // Back arm - at hip (hikite)
    ctx.fillStyle = giWhite;
    drawRoundedRect(ctx, -24, -62 + oY, 14, 22, 3);
    ctx.fill();
    ctx.fillStyle = skinDark;
    drawRoundedRect(ctx, -22, -42 + oY, 10, 10, 3);
    ctx.fill();
  }

  // === HEAD ===
  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(-5, -76 + oY, 10, 8);

  // Head shape
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -88 + oY, 15, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair (short, dark)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(0, -92 + oY, 15, 13, 0, Math.PI, 0);
  ctx.fill();
  // Side hair
  ctx.fillRect(-15, -92 + oY, 4, 10);
  ctx.fillRect(11, -92 + oY, 4, 10);

  // Ears
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(-15, -87 + oY, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(15, -87 + oY, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  drawRoundedRect(ctx, -9, -91 + oY, 8, 5, 2);
  ctx.fill();
  drawRoundedRect(ctx, 2, -91 + oY, 8, 5, 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-4, -88 + oY, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, -88 + oY, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -94 + oY);
  ctx.lineTo(-2, -93 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -93 + oY);
  ctx.lineTo(11, -94 + oY);
  ctx.stroke();

  // Mouth
  if (fState === 'hit') {
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(1, -80 + oY, 4, 0, Math.PI);
    ctx.stroke();
  } else if (fState === 'punch' || fState === 'kick') {
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.ellipse(1, -80 + oY, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -80 + oY);
    ctx.lineTo(5, -80 + oY);
    ctx.stroke();
  }

  // === ACCENT INDICATOR (colored headband / hachimaki) ===
  ctx.fillStyle = accentColor;
  ctx.fillRect(-16, -96 + oY, 32, 4);
  // Headband tails
  ctx.beginPath();
  ctx.moveTo(-16, -96 + oY);
  ctx.lineTo(-24, -90 + oY);
  ctx.lineTo(-22, -92 + oY);
  ctx.lineTo(-16, -92 + oY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, -96 + oY);
  ctx.lineTo(-28, -88 + oY);
  ctx.lineTo(-26, -86 + oY);
  ctx.lineTo(-16, -92 + oY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
