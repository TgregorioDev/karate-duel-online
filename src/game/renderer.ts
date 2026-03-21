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
  const { x, y, facing, state: fState, accentColor } = fighter;

  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);

  const hitShake = fState === 'hit' ? (Math.random() - 0.5) * 4 : 0;
  const bobY = fState === 'idle' ? Math.sin(Date.now() / 300) * 1.5 : 0;
  const oY = (fState === 'hit' ? -3 : 0) + bobY + hitShake;

  const skin = '#e2b88a';
  const skinDark = '#c9985e';
  const skinLight = '#f0d4a8';
  const giMain = fState === 'hit' ? '#ffaaaa' : '#f0ede6';
  const giShade = fState === 'hit' ? '#e08888' : '#d8d4ca';
  const giFold = fState === 'hit' ? '#cc7777' : '#c0bbb0';
  const beltCol = '#1a1a1a';
  const beltShade = '#0a0a0a';

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, GROUND_Y - y + 4, 42, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // ============ STANCE-BASED DRAWING ============
  // The key insight from the reference: wide zenkutsu-dachi stance
  // Front leg bent, back leg extended, torso upright, weight centered

  if (fState === 'idle' || fState === 'walk-forward' || fState === 'walk-backward') {
    const walkPhase = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(Date.now() / 120) : 0;
    const legSpread = 18 + walkPhase * 5;

    // === BACK LEG (straight, extended behind) ===
    // Foot
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-legSpread - 4, 34 + oY, 10, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Calf + thigh as one angled gi pant
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-8, -10 + oY);       // hip
    ctx.lineTo(-legSpread - 10, 30 + oY); // outer ankle
    ctx.lineTo(-legSpread + 6, 30 + oY);  // inner ankle
    ctx.lineTo(0, -10 + oY);        // inner hip
    ctx.closePath();
    ctx.fill();
    // Pant fold
    ctx.strokeStyle = giFold;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, -5 + oY);
    ctx.quadraticCurveTo(-legSpread * 0.5, 10 + oY, -legSpread - 2, 28 + oY);
    ctx.stroke();

    // === FRONT LEG (bent knee, forward) ===
    // Foot
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(legSpread + 2, 34 + oY, 10, 4, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Thigh going forward-down to knee
    const kneeX = legSpread * 0.6;
    const kneeY = 10 + oY;
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(2, -10 + oY);       // hip
    ctx.lineTo(kneeX - 6, kneeY);   // outer knee
    ctx.lineTo(kneeX + 8, kneeY);   // inner knee
    ctx.lineTo(10, -10 + oY);       // inner hip
    ctx.closePath();
    ctx.fill();
    // Shin from knee down
    ctx.beginPath();
    ctx.moveTo(kneeX - 6, kneeY);
    ctx.lineTo(legSpread - 4, 30 + oY);
    ctx.lineTo(legSpread + 10, 30 + oY);
    ctx.lineTo(kneeX + 8, kneeY);
    ctx.closePath();
    ctx.fill();
    // Knee detail
    ctx.strokeStyle = giFold;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY - 2);
    ctx.quadraticCurveTo(kneeX + 2, kneeY + 4, legSpread + 3, 28 + oY);
    ctx.stroke();

    // === TORSO ===
    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // === ARMS (fighting stance like reference) ===
    // BACK ARM - hikite at hip, fist pulled back
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-16, -62 + oY);  // shoulder
    ctx.lineTo(-22, -42 + oY);  // elbow area
    ctx.lineTo(-18, -28 + oY);  // near belt
    ctx.lineTo(-8, -28 + oY);
    ctx.lineTo(-12, -42 + oY);
    ctx.lineTo(-8, -56 + oY);
    ctx.closePath();
    ctx.fill();
    // Fist at hip
    ctx.fillStyle = skinDark;
    drawFist(ctx, -18, -26 + oY, 0);

    // FRONT ARM - guard up, forearm raised, fist at face height
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(16, -62 + oY);   // shoulder
    ctx.lineTo(24, -52 + oY);   // upper arm going forward
    ctx.lineTo(22, -46 + oY);
    ctx.lineTo(14, -54 + oY);
    ctx.closePath();
    ctx.fill();
    // Forearm going up
    ctx.fillStyle = skin;
    ctx.save();
    ctx.translate(23, -50 + oY);
    ctx.rotate(-1.2);
    drawRoundedRect(ctx, 0, -3, 22, 8, 3);
    ctx.fill();
    ctx.restore();
    // Fist raised
    ctx.fillStyle = skinDark;
    drawFist(ctx, 30, -72 + oY, -0.3);

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);

  } else if (fState === 'punch') {
    // PUNCH: front leg lunges, back leg pushes, arm extends
    const legSpread = 22;

    // Back leg (pushing, straight)
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-legSpread - 2, 34 + oY, 10, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-6, -10 + oY);
    ctx.lineTo(-legSpread - 8, 30 + oY);
    ctx.lineTo(-legSpread + 8, 30 + oY);
    ctx.lineTo(2, -10 + oY);
    ctx.closePath();
    ctx.fill();

    // Front leg (lunging forward, bent)
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(legSpread + 6, 34 + oY, 10, 4, -0.1, 0, Math.PI * 2);
    ctx.fill();
    const kneeX = legSpread * 0.7;
    const kneeY = 8 + oY;
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(4, -10 + oY);
    ctx.lineTo(kneeX - 4, kneeY);
    ctx.lineTo(kneeX + 10, kneeY);
    ctx.lineTo(12, -10 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(kneeX - 4, kneeY);
    ctx.lineTo(legSpread, 30 + oY);
    ctx.lineTo(legSpread + 14, 30 + oY);
    ctx.lineTo(kneeX + 10, kneeY);
    ctx.closePath();
    ctx.fill();

    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // BACK ARM - hikite pulled tight to hip
    ctx.fillStyle = giMain;
    drawRoundedRect(ctx, -24, -56 + oY, 14, 26, 3);
    ctx.fill();
    ctx.fillStyle = skinDark;
    drawFist(ctx, -20, -28 + oY, 0);

    // FRONT ARM - fully extended gyaku-zuki
    // Sleeve
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(16, -64 + oY);
    ctx.lineTo(32, -60 + oY);
    ctx.lineTo(32, -50 + oY);
    ctx.lineTo(16, -48 + oY);
    ctx.closePath();
    ctx.fill();
    // Extended forearm
    ctx.fillStyle = skin;
    ctx.fillRect(32, -59 + oY, 32, 9);
    // Fist impact
    ctx.fillStyle = skinDark;
    drawFist(ctx, 62, -58 + oY, 0);
    // Wrist detail
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(31, -55 + oY);
    ctx.lineTo(33, -55 + oY);
    ctx.stroke();

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);

  } else if (fState === 'kick') {
    // MAWASHI-GERI / side kick - standing on back leg, front leg extended high

    // Standing leg (slightly bent)
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-8, 34 + oY, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-6, -10 + oY);
    ctx.lineTo(-16, 30 + oY);
    ctx.lineTo(4, 30 + oY);
    ctx.lineTo(6, -10 + oY);
    ctx.closePath();
    ctx.fill();

    // Kicking leg - extended horizontally
    // Thigh
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(4, -12 + oY);
    ctx.lineTo(20, -30 + oY);
    ctx.lineTo(24, -20 + oY);
    ctx.lineTo(10, -4 + oY);
    ctx.closePath();
    ctx.fill();
    // Shin + foot extended
    ctx.beginPath();
    ctx.moveTo(20, -30 + oY);
    ctx.lineTo(55, -34 + oY);
    ctx.lineTo(55, -24 + oY);
    ctx.lineTo(24, -20 + oY);
    ctx.closePath();
    ctx.fill();
    // Bare foot
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(55, -34 + oY);
    ctx.lineTo(68, -32 + oY);
    ctx.lineTo(68, -26 + oY);
    ctx.lineTo(55, -24 + oY);
    ctx.closePath();
    ctx.fill();
    // Toes
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(68, -29 + oY, 3, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Gi pant wrinkles on kicking leg
    ctx.strokeStyle = giFold;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(12, -8 + oY);
    ctx.quadraticCurveTo(30, -22 + oY, 50, -28 + oY);
    ctx.stroke();

    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // Arms in guard during kick
    // Back arm
    ctx.fillStyle = giMain;
    drawRoundedRect(ctx, -24, -60 + oY, 14, 26, 3);
    ctx.fill();
    ctx.fillStyle = skinDark;
    drawFist(ctx, -20, -32 + oY, 0);
    // Front arm guard
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(14, -64 + oY);
    ctx.lineTo(22, -56 + oY);
    ctx.lineTo(18, -44 + oY);
    ctx.lineTo(10, -48 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.save();
    ctx.translate(20, -50 + oY);
    ctx.rotate(-0.8);
    drawRoundedRect(ctx, 0, -3, 16, 7, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = skinDark;
    drawFist(ctx, 28, -66 + oY, -0.4);

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);

  } else if (fState === 'block') {
    // Defensive stance - arms crossed/raised, weight back
    const legSpread = 16;

    // Back leg
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-legSpread, 34 + oY, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-6, -10 + oY);
    ctx.lineTo(-legSpread - 8, 30 + oY);
    ctx.lineTo(-legSpread + 8, 30 + oY);
    ctx.lineTo(2, -10 + oY);
    ctx.closePath();
    ctx.fill();

    // Front leg
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(legSpread, 34 + oY, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(2, -10 + oY);
    ctx.lineTo(legSpread - 6, 30 + oY);
    ctx.lineTo(legSpread + 10, 30 + oY);
    ctx.lineTo(10, -10 + oY);
    ctx.closePath();
    ctx.fill();

    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // Arms in gedan-barai block (forearm crossing body)
    // Both sleeves
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-14, -64 + oY);
    ctx.lineTo(-6, -50 + oY);
    ctx.lineTo(6, -66 + oY);
    ctx.lineTo(14, -66 + oY);
    ctx.lineTo(4, -44 + oY);
    ctx.lineTo(-20, -58 + oY);
    ctx.closePath();
    ctx.fill();
    // Forearms crossed
    ctx.strokeStyle = skin;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -46 + oY);
    ctx.lineTo(8, -70 + oY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, -46 + oY);
    ctx.lineTo(-4, -70 + oY);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Fists
    ctx.fillStyle = skinDark;
    drawFist(ctx, 4, -74 + oY, -0.5);
    drawFist(ctx, -8, -74 + oY, 0.5);

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);

  } else if (fState === 'hit') {
    // Recoiling - leaning back, legs stumbling
    const legSpread = 14;

    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-legSpread, 34 + oY, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(legSpread - 4, 34 + oY, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-6, -10 + oY);
    ctx.lineTo(-legSpread - 6, 30 + oY);
    ctx.lineTo(-legSpread + 6, 30 + oY);
    ctx.lineTo(0, -10 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -10 + oY);
    ctx.lineTo(legSpread - 10, 30 + oY);
    ctx.lineTo(legSpread + 4, 30 + oY);
    ctx.lineTo(8, -10 + oY);
    ctx.closePath();
    ctx.fill();

    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // Arms flailing
    ctx.fillStyle = giMain;
    drawRoundedRect(ctx, -26, -62 + oY, 14, 22, 3);
    ctx.fill();
    drawRoundedRect(ctx, 14, -58 + oY, 14, 18, 3);
    ctx.fill();
    ctx.fillStyle = skin;
    drawRoundedRect(ctx, -24, -42 + oY, 10, 8, 3);
    ctx.fill();
    drawRoundedRect(ctx, 16, -42 + oY, 10, 8, 3);
    ctx.fill();

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);

  } else if (fState === 'victory') {
    // Standing tall, arms raised
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.ellipse(-8, 34 + oY, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, 34 + oY, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-6, -10 + oY);
    ctx.lineTo(-14, 30 + oY);
    ctx.lineTo(2, 30 + oY);
    ctx.lineTo(2, -10 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -10 + oY);
    ctx.lineTo(0, 30 + oY);
    ctx.lineTo(16, 30 + oY);
    ctx.lineTo(8, -10 + oY);
    ctx.closePath();
    ctx.fill();

    drawTorso(ctx, oY, giMain, giShade, giFold, beltCol, beltShade);

    // Arms raised in triumph
    ctx.fillStyle = giMain;
    ctx.beginPath();
    ctx.moveTo(-14, -64 + oY);
    ctx.lineTo(-24, -100 + oY);
    ctx.lineTo(-12, -100 + oY);
    ctx.lineTo(-4, -64 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -64 + oY);
    ctx.lineTo(14, -105 + oY);
    ctx.lineTo(26, -105 + oY);
    ctx.lineTo(16, -64 + oY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin;
    drawFist(ctx, -22, -106 + oY, 0);
    drawFist(ctx, 16, -111 + oY, 0);

    drawHead(ctx, oY, fState, skin, skinDark, skinLight, accentColor);
  }

  ctx.restore();
}

// === SHARED DRAWING HELPERS ===

function drawTorso(ctx: CanvasRenderingContext2D, oY: number, giMain: string, giShade: string, giFold: string, beltCol: string, beltShade: string) {
  // Torso base (gi jacket)
  ctx.fillStyle = giShade;
  drawRoundedRect(ctx, -20, -72 + oY, 42, 64, 4);
  ctx.fill();
  ctx.fillStyle = giMain;
  drawRoundedRect(ctx, -18, -72 + oY, 40, 62, 4);
  ctx.fill();

  // Gi lapel - cross-over V shape
  ctx.fillStyle = giShade;
  ctx.beginPath();
  ctx.moveTo(-10, -72 + oY);
  ctx.lineTo(-2, -38 + oY);
  ctx.lineTo(12, -72 + oY);
  ctx.lineTo(6, -72 + oY);
  ctx.lineTo(-2, -48 + oY);
  ctx.lineTo(-4, -72 + oY);
  ctx.closePath();
  ctx.fill();

  // Lapel stitching
  ctx.strokeStyle = giFold;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-7, -72 + oY);
  ctx.lineTo(-2, -44 + oY);
  ctx.lineTo(9, -72 + oY);
  ctx.stroke();

  // Fabric fold lines
  ctx.strokeStyle = giFold;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-16, -55 + oY);
  ctx.quadraticCurveTo(-10, -48 + oY, -6, -46 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, -55 + oY);
  ctx.quadraticCurveTo(14, -49 + oY, 8, -46 + oY);
  ctx.stroke();
  // Side seam
  ctx.beginPath();
  ctx.moveTo(-18, -40 + oY);
  ctx.lineTo(-18, -14 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, -40 + oY);
  ctx.lineTo(20, -14 + oY);
  ctx.stroke();

  // === BLACK BELT (obi) ===
  ctx.fillStyle = beltCol;
  ctx.fillRect(-22, -16 + oY, 46, 9);
  // Belt shading
  ctx.fillStyle = beltShade;
  ctx.fillRect(-22, -16 + oY, 46, 3);
  // Belt texture
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-22, -15 + i * 3 + oY);
    ctx.lineTo(24, -15 + i * 3 + oY);
    ctx.stroke();
  }
  // Knot
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(4, -11 + oY, 6, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.ellipse(4, -11 + oY, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Belt tails
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.moveTo(1, -7 + oY);
  ctx.lineTo(-4, 10 + oY);
  ctx.lineTo(-1, 10 + oY);
  ctx.lineTo(4, -7 + oY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -7 + oY);
  ctx.lineTo(12, 8 + oY);
  ctx.lineTo(9, 8 + oY);
  ctx.lineTo(2, -7 + oY);
  ctx.closePath();
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, oY: number, fState: string, skin: string, skinDark: string, skinLight: string, accentColor: string) {
  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(-4, -76 + oY, 10, 8);
  // Neck shadow
  ctx.fillStyle = skinDark;
  ctx.fillRect(-4, -72 + oY, 10, 3);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(1, -88 + oY, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jaw/chin definition
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(1, -78 + oY, 10, 5, 0, 0.2, Math.PI - 0.2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(1, -79 + oY, 10, 5, 0, 0.2, Math.PI - 0.2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(1, -93 + oY, 15, 12, 0, Math.PI + 0.3, -0.3);
  ctx.fill();
  // Side burns
  ctx.fillRect(-13, -93 + oY, 4, 12);
  ctx.fillRect(11, -93 + oY, 4, 12);
  // Hair top volume
  ctx.beginPath();
  ctx.ellipse(1, -96 + oY, 12, 6, 0, Math.PI, 0);
  ctx.fill();

  // Ears
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(-13, -87 + oY, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinLight;
  ctx.beginPath();
  ctx.ellipse(-13, -87 + oY, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  drawRoundedRect(ctx, -7, -91 + oY, 7, 5, 2);
  ctx.fill();
  drawRoundedRect(ctx, 3, -91 + oY, 7, 5, 2);
  ctx.fill();
  // Iris
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(-3, -88 + oY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, -88 + oY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-3, -88 + oY, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, -88 + oY, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-2, -89 + oY, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8, -89 + oY, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, -94 + oY);
  ctx.quadraticCurveTo(-4, -96 + oY, 0, -94 + oY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(3, -94 + oY);
  ctx.quadraticCurveTo(6, -96 + oY, 10, -94 + oY);
  ctx.stroke();

  // Nose
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(2, -86 + oY);
  ctx.lineTo(3, -82 + oY);
  ctx.lineTo(1, -81 + oY);
  ctx.stroke();

  // Mouth
  if (fState === 'hit') {
    ctx.fillStyle = '#6b3a2a';
    ctx.beginPath();
    ctx.ellipse(2, -78 + oY, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, -79 + oY, 4, 2);
  } else if (fState === 'punch' || fState === 'kick') {
    ctx.fillStyle = '#6b3a2a';
    ctx.beginPath();
    ctx.ellipse(2, -78 + oY, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#8b5a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-1, -78 + oY);
    ctx.quadraticCurveTo(2, -77 + oY, 5, -78 + oY);
    ctx.stroke();
  }

  // Headband (hachimaki) - team color identifier
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.moveTo(-14, -97 + oY);
  ctx.lineTo(16, -97 + oY);
  ctx.lineTo(16, -93 + oY);
  ctx.lineTo(-14, -93 + oY);
  ctx.closePath();
  ctx.fill();
  // Headband tails flowing behind
  ctx.beginPath();
  ctx.moveTo(-14, -97 + oY);
  ctx.quadraticCurveTo(-22, -95 + oY, -26, -89 + oY);
  ctx.lineTo(-24, -91 + oY);
  ctx.quadraticCurveTo(-20, -95 + oY, -14, -93 + oY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, -97 + oY);
  ctx.quadraticCurveTo(-24, -93 + oY, -30, -86 + oY);
  ctx.lineTo(-28, -88 + oY);
  ctx.quadraticCurveTo(-22, -93 + oY, -14, -93 + oY);
  ctx.closePath();
  ctx.fill();
}

function drawFist(ctx: CanvasRenderingContext2D, fx: number, fy: number, angle: number) {
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate(angle);
  drawRoundedRect(ctx, 0, 0, 12, 12, 4);
  ctx.fill();
  // Knuckle line
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(3, 1);
  ctx.lineTo(3, 11);
  ctx.stroke();
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
