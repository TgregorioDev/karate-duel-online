import { Fighter, GameState, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, STAMINA_MAX, MAX_SCORE } from './types';

// ============ ANIME-STYLE KARATE RENDERER ============
// Cel-shaded look with bold outlines, expressive anime faces, speed lines, and manga effects

const OUTLINE_W = 2.5;
const OUTLINE_COL = '#1a1012';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawAnimeBackground(ctx);
  drawFighter(ctx, state.player, 'P1');
  drawFighter(ctx, state.opponent, 'P2');
  if (state.hitEffect) drawAnimeHitEffect(ctx, state.hitEffect);
  drawAnimeHUD(ctx, state);
  if (state.judgeTimer > 0) drawAnimeJudgeMessage(ctx, state.judgeMessage);
  if (state.gameStatus === 'menu') drawAnimeMenu(ctx);
  if (state.gameStatus === 'game-over') drawAnimeGameOver(ctx, state);
}

// ============ ANIME BACKGROUND ============
function drawAnimeBackground(ctx: CanvasRenderingContext2D) {
  // Dramatic sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#0d0820');
  skyGrad.addColorStop(0.3, '#1a1040');
  skyGrad.addColorStop(0.6, '#2a1535');
  skyGrad.addColorStop(1, '#3a1a28');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);

  // Anime radial burst behind fighters
  ctx.save();
  ctx.globalAlpha = 0.06;
  const cx = CANVAS_WIDTH / 2;
  const cy = GROUND_Y - 80;
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 / 24) * i;
    ctx.fillStyle = i % 2 === 0 ? '#ff4466' : '#4466ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 400, angle, angle + Math.PI / 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Dojo floor — polished wood
  const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
  floorGrad.addColorStop(0, '#c49a6c');
  floorGrad.addColorStop(0.3, '#a87d50');
  floorGrad.addColorStop(1, '#8b6538');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

  // Wood grain lines
  ctx.strokeStyle = 'rgba(90,55,25,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < CANVAS_WIDTH; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, GROUND_Y);
    ctx.lineTo(i, CANVAS_HEIGHT);
    ctx.stroke();
  }

  // Floor shine
  ctx.save();
  ctx.globalAlpha = 0.08;
  const shineGrad = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 40);
  shineGrad.addColorStop(0, '#fff');
  shineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = shineGrad;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 40);
  ctx.restore();

  // Red boundary line with glow
  ctx.save();
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#cc2233';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, GROUND_Y + 2);
  ctx.lineTo(CANVAS_WIDTH - 80, GROUND_Y + 2);
  ctx.stroke();
  ctx.restore();

  // Torii silhouette in background
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#cc2233';
  ctx.fillRect(380, 50, 10, 180);
  ctx.fillRect(570, 50, 10, 180);
  ctx.fillRect(365, 50, 230, 12);
  ctx.fillRect(370, 78, 220, 8);
  // Curved top
  ctx.beginPath();
  ctx.moveTo(355, 52);
  ctx.quadraticCurveTo(480, 30, 605, 52);
  ctx.lineTo(605, 60);
  ctx.quadraticCurveTo(480, 40, 355, 60);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============ FIGHTER DRAWING ============
function drawFighter(ctx: CanvasRenderingContext2D, fighter: Fighter, label: string) {
  const { x, y, facing, state: fState, accentColor } = fighter;

  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);

  const hitShake = fState === 'hit' ? (Math.random() - 0.5) * 5 : 0;
  const t = Date.now();
  const breathe = Math.sin(t / 400) * 1.2; // subtle breathing
  const bobY = fState === 'idle' ? breathe : 0;

  // Color palette
  const skin = '#e8b888';
  const skinShade = '#c4956a';
  const skinHighlight = '#f5d4b0';
  const giMain = fState === 'hit' ? '#f0b8b8' : '#f0ece4';
  const giShade = fState === 'hit' ? '#d49090' : '#d0ccc0';
  const giFold = fState === 'hit' ? '#b87070' : '#b8b4a8';
  const beltCol = '#1a1a1a';
  const gloveCol = accentColor;

  // Speed lines when attacking
  if (fState === 'punch' || fState === 'kick' || fState === 'gyaku-zuki' || fState === 'mae-geri') {
    drawSpeedLines(ctx, fState);
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(10,5,20,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 38, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Proportions — 7.5 head ratio (realistic athletic build)
  const headR = 12;
  const torsoLen = 42;
  const legW = 16; // thigh width
  const armW = 12;

  if (fState === 'idle' || fState === 'walk-forward' || fState === 'walk-backward') {
    const walkCycle = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(t / 130) * 0.18 : 0;
    const hipY = -38 + bobY;
    const torsoLean = walkCycle * 0.05; // subtle torso sway

    // Wider natural stance — back leg bent, front leg forward
    const backKneeX = -14 - walkCycle * 10;
    const backKneeY = hipY + 22;
    const backFootX = -22 - walkCycle * 6;
    const frontKneeX = 16 + walkCycle * 10;
    const frontKneeY = hipY + 20;
    const frontFootX = 22 + walkCycle * 6;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 2, giMain, giFold, skin, skinShade, legW);

    const shoulderY = hipY - torsoLen;
    const shoulderX = 2 + torsoLean * 8;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms in guard — natural kamae
    const backSX = shoulderX - 20;
    const frontSX = shoulderX + 20;
    // Back arm: relaxed at side, fist near hip
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX - 6, shoulderY + 22, backSX - 2, hipY - 4, giMain, skin, skinShade, true, gloveCol);
    // Front arm: guard up, forearm angled forward
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 10, shoulderY + 18, frontSX + 16, shoulderY + 6, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'punch') {
    // Zenkutsu-dachi — deep front stance, hips rotated
    const hipY = -34;
    drawAnimeLeg(ctx, 0, hipY, -16, hipY + 22, -30, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 0, hipY, 18, hipY + 16, 28, 2, giMain, giFold, skin, skinShade, legW);

    const shoulderY = hipY - torsoLen; const shoulderX = 6; // rotated forward
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Hikite — pulling hand back to hip
    const backSX = shoulderX - 20;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX - 2, shoulderY + 20, backSX + 2, hipY - 6, giMain, skin, skinShade, true, gloveCol);
    // Punching arm — full extension
    const frontSX = shoulderX + 20;
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 28, shoulderY + 4, frontSX + 56, shoulderY + 6, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'kick') {
    // Mawashi-geri — standing leg bent, kicking leg high
    const hipY = -40;
    drawAnimeLeg(ctx, 0, hipY, -8, hipY + 22, -12, 2, giMain, giFold, skin, skinShade, legW);

    const kickKneeX = 16; const kickKneeY = hipY - 18;
    const kickFootX = 58; const kickFootY = hipY - torsoLen + 12;
    drawAnimeLegKick(ctx, 0, hipY, kickKneeX, kickKneeY, kickFootX, kickFootY, giMain, giFold, skin, skinShade);

    const shoulderY = hipY - torsoLen; const shoulderX = -4; // lean back
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backSX = shoulderX - 20;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX - 10, shoulderY + 16, backSX - 6, hipY - 2, giMain, skin, skinShade, false, gloveCol);
    const frontSX = shoulderX + 20;
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 8, shoulderY + 16, frontSX + 4, shoulderY + 6, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'gyaku-zuki') {
    // Deep stance, rear hand punching with hip rotation
    const hipY = -34;
    drawAnimeLeg(ctx, 0, hipY, -18, hipY + 22, -32, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 0, hipY, 18, hipY + 14, 26, 2, giMain, giFold, skin, skinShade, legW);

    const shoulderY = hipY - torsoLen; const shoulderX = 8; // strong rotation
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Front hand pulls back (hikite)
    const frontSX = shoulderX + 20;
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 4, shoulderY + 20, frontSX + 2, hipY - 4, giMain, skin, skinShade, true, gloveCol);
    // Rear hand punches through
    const backSX = shoulderX - 20;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX + 24, shoulderY + 12, backSX + 52, shoulderY + 18, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'mae-geri') {
    // Front snap kick — weight on back leg, front knee chambered
    const hipY = -38;
    drawAnimeLeg(ctx, 0, hipY, -6, hipY + 22, -10, 2, giMain, giFold, skin, skinShade, legW);

    const kickKneeX = 14; const kickKneeY = hipY - 6;
    const kickFootX = 52; const kickFootY = hipY - 12;
    drawAnimeLegKick(ctx, 0, hipY, kickKneeX, kickKneeY, kickFootX, kickFootY, giMain, giFold, skin, skinShade);

    const shoulderY = hipY - torsoLen; const shoulderX = -2;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backSX = shoulderX - 20;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX - 6, shoulderY + 16, backSX - 2, shoulderY + 4, giMain, skin, skinShade, false, gloveCol);
    const frontSX = shoulderX + 20;
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 8, shoulderY + 16, frontSX + 4, shoulderY + 4, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'block') {
    // Uchi-uke — weight centered, blocking arm swept outward
    const hipY = -38 + bobY;
    drawAnimeLeg(ctx, 0, hipY, -14, hipY + 22, -26, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 0, hipY, 16, hipY + 18, 22, 2, giMain, giFold, skin, skinShade, legW);

    const shoulderY = hipY - torsoLen; const shoulderX = 2;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Back arm at hip
    const backSX = shoulderX - 20;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX - 2, shoulderY + 20, backSX + 2, hipY - 4, giMain, skin, skinShade, true, gloveCol);
    // Front arm — uchi uke sweep
    const frontSX = shoulderX + 20;
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 16, shoulderY + 12, frontSX + 24, shoulderY - 4, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'hit') {
    // Recoil — leaning back, arms loose
    const hipY = -36 + hitShake;
    drawAnimeLeg(ctx, 0, hipY, -10, hipY + 20, -14, 2, giMain, giFold, skin, skinShade, legW - 1);
    drawAnimeLeg(ctx, 0, hipY, 8, hipY + 22, 10, 2, giMain, giFold, skin, skinShade, legW - 1);

    const shoulderY = hipY - torsoLen + 6; const shoulderX = -8; // recoiling back
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms flailing from impact
    drawAnimeArm(ctx, shoulderX - 20, shoulderY + 6, shoulderX - 28, shoulderY + 16, shoulderX - 22, shoulderY + 28, giMain, skin, skinShade, false, gloveCol);
    drawAnimeArm(ctx, shoulderX + 20, shoulderY + 6, shoulderX + 26, shoulderY + 14, shoulderX + 20, shoulderY + 26, giMain, skin, skinShade, false, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'victory') {
    // Standing tall, fists raised
    const hipY = -40;
    drawAnimeLeg(ctx, 0, hipY, -8, hipY + 22, -12, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 0, hipY, 8, hipY + 22, 12, 2, giMain, giFold, skin, skinShade, legW);

    const shoulderY = hipY - torsoLen; const shoulderX = 0;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms raised in victory
    drawAnimeArm(ctx, shoulderX - 20, shoulderY + 6, shoulderX - 24, shoulderY - 18, shoulderX - 20, shoulderY - 34, giMain, skin, skinShade, true, gloveCol);
    drawAnimeArm(ctx, shoulderX + 20, shoulderY + 6, shoulderX + 26, shoulderY - 20, shoulderX + 22, shoulderY - 36, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);
  }

  ctx.restore();
}

// ============ SPEED LINES ============
function drawSpeedLines(ctx: CanvasRenderingContext2D, fState: string) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  const isKick = fState === 'kick' || fState === 'mae-geri';
  const lineCount = 6;
  ctx.strokeStyle = isKick ? '#ff6644' : '#ffcc44';
  ctx.lineWidth = 2;
  
  for (let i = 0; i < lineCount; i++) {
    const startX = -30 - Math.random() * 20;
    const startY = -80 + Math.random() * 60;
    const len = 20 + Math.random() * 30;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX - len, startY + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }
  ctx.restore();
}

// ============ ANIME LEG (with outline) ============
function drawAnimeLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  kneeX: number, kneeY: number,
  footX: number, footY: number,
  giCol: string, foldCol: string,
  skinCol: string, skinDarkCol: string,
  limbW: number
) {
  const thighW = limbW;
  const shinW = limbW - 2;

  // Thigh
  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle) * thighW / 2;
  const perpY = -Math.cos(thighAngle) * thighW / 2;

  // Outline
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.moveTo(hipX + perpX, hipY + perpY);
  ctx.lineTo(kneeX + perpX * 0.9, kneeY + perpY * 0.9);
  ctx.lineTo(kneeX - perpX * 0.9, kneeY - perpY * 0.9);
  ctx.lineTo(hipX - perpX, hipY - perpY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shin
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPerpX = Math.sin(shinAngle) * shinW / 2;
  const sPerpY = -Math.cos(shinAngle) * shinW / 2;
  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.moveTo(kneeX + sPerpX, kneeY + sPerpY);
  ctx.lineTo(footX + sPerpX * 0.7, footY + sPerpY * 0.7);
  ctx.lineTo(footX - sPerpX * 0.7, footY - sPerpY * 0.7);
  ctx.lineTo(kneeX - sPerpX, kneeY - sPerpY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cel-shade fold on knee
  ctx.strokeStyle = foldCol;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(kneeX + perpX * 0.5, kneeY + perpY * 0.5);
  ctx.lineTo(kneeX - perpX * 0.5, kneeY - perpY * 0.5);
  ctx.stroke();

  // Foot with outline
  ctx.fillStyle = skinCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  const footDir = footX > kneeX ? 1 : (footX < kneeX ? -1 : 1);
  ctx.beginPath();
  ctx.ellipse(footX + footDir * 4, footY, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ============ ANIME LEG KICK ============
function drawAnimeLegKick(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  kneeX: number, kneeY: number,
  footX: number, footY: number,
  giCol: string, foldCol: string,
  skinCol: string, skinDarkCol: string,
) {
  const limbW = 18;

  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle) * limbW / 2;
  const perpY = -Math.cos(thighAngle) * limbW / 2;

  ctx.fillStyle = giCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(hipX + perpX, hipY + perpY);
  ctx.lineTo(kneeX + perpX, kneeY + perpY);
  ctx.lineTo(kneeX - perpX, kneeY - perpY);
  ctx.lineTo(hipX - perpX, hipY - perpY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const shinW = limbW - 1;
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPerpX = Math.sin(shinAngle) * shinW / 2;
  const sPerpY = -Math.cos(shinAngle) * shinW / 2;
  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.moveTo(kneeX + sPerpX, kneeY + sPerpY);
  ctx.lineTo(footX + sPerpX * 0.6, footY + sPerpY * 0.6);
  ctx.lineTo(footX - sPerpX * 0.6, footY - sPerpY * 0.6);
  ctx.lineTo(kneeX - sPerpX, kneeY - sPerpY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fold
  ctx.strokeStyle = foldCol;
  ctx.lineWidth = 1;
  const midX = (hipX + kneeX) / 2;
  const midY = (hipY + kneeY) / 2;
  ctx.beginPath();
  ctx.moveTo(midX + perpX * 0.4, midY + perpY * 0.4);
  ctx.lineTo(midX - perpX * 0.4, midY - perpY * 0.4);
  ctx.stroke();

  // Foot pointed
  ctx.fillStyle = skinCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  const footAngle = shinAngle;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(footAngle);
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(16, -3);
  ctx.lineTo(18, 0);
  ctx.lineTo(16, 3);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ball of foot
  ctx.fillStyle = skinDarkCol;
  ctx.beginPath();
  ctx.ellipse(16, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ============ ANIME ARM (with outline) ============
function drawAnimeArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  elbowX: number, elbowY: number,
  fistX: number, fistY: number,
  giCol: string, skinCol: string, skinDarkCol: string,
  isFist: boolean,
  gloveColor?: string
) {
  const armW = 14;

  // Upper arm
  const uAngle = Math.atan2(elbowY - shoulderY, elbowX - shoulderX);
  const uPx = Math.sin(uAngle) * armW / 2;
  const uPy = -Math.cos(uAngle) * armW / 2;

  ctx.fillStyle = giCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(shoulderX + uPx, shoulderY + uPy);
  ctx.lineTo(elbowX + uPx * 0.9, elbowY + uPy * 0.9);
  ctx.lineTo(elbowX - uPx * 0.9, elbowY - uPy * 0.9);
  ctx.lineTo(shoulderX - uPx, shoulderY - uPy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Forearm
  const fArmW = 11;
  const fAngle = Math.atan2(fistY - elbowY, fistX - elbowX);
  const fPx = Math.sin(fAngle) * fArmW / 2;
  const fPy = -Math.cos(fAngle) * fArmW / 2;

  ctx.fillStyle = skinCol;
  ctx.beginPath();
  ctx.moveTo(elbowX + fPx, elbowY + fPy);
  ctx.lineTo(fistX + fPx * 0.8, fistY + fPy * 0.8);
  ctx.lineTo(fistX - fPx * 0.8, fistY - fPy * 0.8);
  ctx.lineTo(elbowX - fPx, elbowY - fPy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glove with anime shine
  if (gloveColor) {
    const gloveR = isFist ? 10 : 9;
    ctx.fillStyle = gloveColor;
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = OUTLINE_W;
    ctx.beginPath();
    ctx.arc(fistX, fistY, gloveR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Anime highlight (sharp white crescent)
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(fistX - 2, fistY - 3, gloveR * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Second smaller highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(fistX + 1, fistY - 1, gloveR * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skinDarkCol;
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = OUTLINE_W;
    ctx.beginPath();
    ctx.arc(fistX, fistY, isFist ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// ============ ANIME TORSO ============
function drawAnimeTorso(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  shoulderX: number, shoulderY: number,
  giMain: string, giShade: string, giFold: string, beltCol: string
) {
  const shoulderW = 46;
  const waistW = 32;

  // Shadow layer
  ctx.fillStyle = giShade;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2 - 1, shoulderY);
  ctx.lineTo(hipX - waistW / 2 - 1, hipY);
  ctx.lineTo(hipX + waistW / 2 + 1, hipY);
  ctx.lineTo(shoulderX + shoulderW / 2 + 1, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Main gi
  ctx.fillStyle = giMain;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2, shoulderY + 1);
  ctx.lineTo(hipX - waistW / 2, hipY);
  ctx.lineTo(hipX + waistW / 2, hipY);
  ctx.lineTo(shoulderX + shoulderW / 2, shoulderY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cel-shade: sharp diagonal shadow on torso
  ctx.fillStyle = giFold;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2, shoulderY + 1);
  ctx.lineTo(shoulderX, shoulderY + 20);
  ctx.lineTo(hipX - waistW / 2, hipY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Pectoral muscle lines visible through gi
  ctx.strokeStyle = giFold;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.4;
  // Left pec
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2 + 4, shoulderY + 6);
  ctx.quadraticCurveTo(shoulderX - 4, shoulderY + 14, shoulderX - 2, shoulderY + 18);
  ctx.stroke();
  // Right pec
  ctx.beginPath();
  ctx.moveTo(shoulderX + shoulderW / 2 - 4, shoulderY + 6);
  ctx.quadraticCurveTo(shoulderX + 4, shoulderY + 14, shoulderX + 2, shoulderY + 18);
  ctx.stroke();
  // Center chest line
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY + 4);
  ctx.lineTo(shoulderX, shoulderY + 22);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Shoulder cap / deltoid bumps
  ctx.fillStyle = giMain;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  // Left deltoid
  ctx.beginPath();
  ctx.arc(shoulderX - shoulderW / 2, shoulderY + 3, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Right deltoid
  ctx.beginPath();
  ctx.arc(shoulderX + shoulderW / 2, shoulderY + 3, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lapel V — wider for bigger torso
  ctx.fillStyle = giShade;
  const lapelCY = (shoulderY + hipY) / 2 + 8;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 8, shoulderY + 2);
  ctx.lineTo((shoulderX + hipX) / 2, lapelCY);
  ctx.lineTo(shoulderX + 10, shoulderY + 2);
  ctx.lineTo(shoulderX + 6, shoulderY + 2);
  ctx.lineTo((shoulderX + hipX) / 2, lapelCY - 6);
  ctx.lineTo(shoulderX - 4, shoulderY + 2);
  ctx.closePath();
  ctx.fill();

  // Lapel line
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 7, shoulderY + 3);
  ctx.lineTo((shoulderX + hipX) / 2, lapelCY - 2);
  ctx.lineTo(shoulderX + 9, shoulderY + 3);
  ctx.stroke();

  // Belt
  const beltY = hipY - 4;
  const beltH = 8;
  ctx.fillStyle = beltCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.rect(hipX - waistW / 2 - 2, beltY, waistW + 4, beltH);
  ctx.fill();
  ctx.stroke();

  // Belt knot
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(hipX + 3, beltY + beltH / 2, 5, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belt tails
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.moveTo(hipX + 1, beltY + beltH);
  ctx.lineTo(hipX - 3, beltY + beltH + 16);
  ctx.lineTo(hipX, beltY + beltH + 16);
  ctx.lineTo(hipX + 4, beltY + beltH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hipX + 4, beltY + beltH);
  ctx.lineTo(hipX + 10, beltY + beltH + 14);
  ctx.lineTo(hipX + 7, beltY + beltH + 14);
  ctx.lineTo(hipX + 1, beltY + beltH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ============ SERIOUS INK-STYLE HEAD ============
function drawAnimeHead(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  fState: string,
  skin: string, skinShade: string, skinHighlight: string,
  accentColor: string, headR: number
) {
  const neckX = shoulderX + 1;
  const neckY = shoulderY;
  const headX = neckX;
  const headY = neckY - headR - 4;

  // Thick muscular neck
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(neckX - 7, neckY);
  ctx.lineTo(neckX - 5, neckY - 8);
  ctx.lineTo(neckX + 5, neckY - 8);
  ctx.lineTo(neckX + 7, neckY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Neck shadow/tendon
  ctx.strokeStyle = skinShade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(neckX - 2, neckY);
  ctx.lineTo(neckX - 1, neckY - 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(neckX + 3, neckY);
  ctx.lineTo(neckX + 2, neckY - 7);
  ctx.stroke();

  // Head — angular jaw, not round
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  // Start from top of head, go clockwise
  ctx.moveTo(headX, headY - headR - 1); // top
  ctx.quadraticCurveTo(headX + headR + 3, headY - headR, headX + headR + 2, headY); // right temple
  ctx.lineTo(headX + headR - 1, headY + 6); // right cheek
  ctx.lineTo(headX + 4, headY + headR + 3); // right jaw
  ctx.lineTo(headX, headY + headR + 5); // chin point
  ctx.lineTo(headX - 4, headY + headR + 3); // left jaw
  ctx.lineTo(headX - headR + 1, headY + 6); // left cheek
  ctx.quadraticCurveTo(headX - headR - 3, headY - headR, headX, headY - headR - 1); // left temple to top
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Jaw shadow (sharp angular)
  ctx.fillStyle = skinShade;
  ctx.beginPath();
  ctx.moveTo(headX - headR + 1, headY + 4);
  ctx.lineTo(headX - 4, headY + headR + 2);
  ctx.lineTo(headX, headY + headR + 4);
  ctx.lineTo(headX + 4, headY + headR + 2);
  ctx.lineTo(headX + headR - 1, headY + 4);
  ctx.lineTo(headX + headR - 3, headY + 8);
  ctx.lineTo(headX, headY + headR + 1);
  ctx.lineTo(headX - headR + 3, headY + 8);
  ctx.closePath();
  ctx.fill();

  // Short cropped hair (tight to skull, like the reference)
  ctx.fillStyle = '#111118';
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(headX - headR - 1, headY + 1);
  ctx.quadraticCurveTo(headX - headR - 3, headY - headR, headX, headY - headR - 3);
  ctx.quadraticCurveTo(headX + headR + 3, headY - headR, headX + headR + 1, headY + 1);
  ctx.lineTo(headX + headR - 1, headY - 1);
  ctx.quadraticCurveTo(headX + headR, headY - headR + 3, headX, headY - headR);
  ctx.quadraticCurveTo(headX - headR, headY - headR + 3, headX - headR + 1, headY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hair texture lines
  ctx.strokeStyle = '#2a2a35';
  ctx.lineWidth = 0.8;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(headX + i * 4, headY - headR - 2);
    ctx.lineTo(headX + i * 3, headY - headR + 6);
    ctx.stroke();
  }

  // ---- STERN NARROW EYES ----
  const eyeY = headY + 1;
  const leftEyeX = headX - 5;
  const rightEyeX = headX + 6;

  if (fState === 'hit') {
    // Shut tight — pain
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 4, eyeY);
    ctx.lineTo(leftEyeX + 4, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightEyeX - 4, eyeY);
    ctx.lineTo(rightEyeX + 4, eyeY);
    ctx.stroke();
    // Pain wrinkle
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 3, eyeY - 3);
    ctx.lineTo(leftEyeX + 3, eyeY - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightEyeX - 3, eyeY - 2);
    ctx.lineTo(rightEyeX + 3, eyeY - 3);
    ctx.stroke();
  } else if (fState === 'victory') {
    // Closed, composed
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, 3, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightEyeX, eyeY, 3, 0.3, Math.PI - 0.3);
    ctx.stroke();
  } else {
    const isAttack = fState === 'punch' || fState === 'kick' || fState === 'gyaku-zuki' || fState === 'mae-geri';
    const isBlock = fState === 'block';

    // Narrow, serious eyes — slit-like
    [leftEyeX, rightEyeX].forEach((ex, idx) => {
      // Eye slit shape (narrow and angular)
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = OUTLINE_COL;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ex - 5, eyeY);
      ctx.quadraticCurveTo(ex, eyeY - (isAttack ? 2 : 3), ex + 5, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + 2, ex - 5, eyeY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dark iris — small and intense
      const irisCol = accentColor === '#cc2222' ? '#3a1008' : '#0a1a3a';
      ctx.fillStyle = irisCol;
      ctx.beginPath();
      ctx.arc(ex + 1, eyeY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(ex + 1, eyeY, 1, 0, Math.PI * 2);
      ctx.fill();

      // Tiny highlight
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(ex, eyeY - 0.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    });

    // Strong thick brows — angled for intensity
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 3.5;
    if (isAttack) {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 5, eyeY - 4);
      ctx.lineTo(leftEyeX + 5, eyeY - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 4, eyeY - 6);
      ctx.lineTo(rightEyeX + 6, eyeY - 4);
      ctx.stroke();
    } else if (isBlock) {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 5, eyeY - 5);
      ctx.lineTo(leftEyeX + 5, eyeY - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 4, eyeY - 5);
      ctx.lineTo(rightEyeX + 6, eyeY - 5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 5, eyeY - 5);
      ctx.lineTo(leftEyeX + 5, eyeY - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEyeX - 4, eyeY - 6);
      ctx.lineTo(rightEyeX + 6, eyeY - 5);
      ctx.stroke();
    }
  }

  // Strong nose — angular ink style
  ctx.fillStyle = skinShade;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(headX + 1, eyeY + 2);
  ctx.lineTo(headX + 3, headY + headR - 2);
  ctx.lineTo(headX, headY + headR - 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mouth
  if (fState === 'hit') {
    // Gritting teeth
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX - 4, headY + headR + 1);
    ctx.lineTo(headX + 5, headY + headR + 1);
    ctx.stroke();
    // Teeth line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headX - 3, headY + headR + 1);
    ctx.lineTo(headX + 4, headY + headR + 1);
    ctx.stroke();
  } else if (fState === 'punch' || fState === 'kick' || fState === 'gyaku-zuki' || fState === 'mae-geri') {
    // Kiai mouth — open yell
    ctx.fillStyle = '#3a1010';
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(headX + 1, headY + headR, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (fState === 'victory') {
    // Slight confident smirk
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(headX - 2, headY + headR);
    ctx.quadraticCurveTo(headX + 1, headY + headR + 2, headX + 4, headY + headR - 1);
    ctx.stroke();
  } else {
    // Stern closed mouth
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headX - 3, headY + headR);
    ctx.lineTo(headX + 4, headY + headR);
    ctx.stroke();
  }

  // Ear
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(headX + headR, headY + 1, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Inner ear
  ctx.strokeStyle = skinShade;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(headX + headR, headY + 1, 2, 0.5, Math.PI * 1.5);
  ctx.stroke();
}

// ============ ANIME HIT EFFECT ============
function drawAnimeHitEffect(ctx: CanvasRenderingContext2D, effect: { x: number; y: number; timer: number; type: string }) {
  const alpha = effect.timer / 15;
  const size = (15 - effect.timer) * 3.5;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  
  const isKick = effect.type === 'kick';
  
  // Manga star burst
  ctx.fillStyle = isKick ? '#ff3322' : '#ffdd22';
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * 2 / (spikes * 2)) * i;
    const r = i % 2 === 0 ? size * 1.2 : size * 0.4;
    const px = effect.x + Math.cos(angle) * r;
    const py = effect.y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // White center
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, size * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Onomatopoeia text
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 3;
  ctx.font = `bold italic ${16 + size / 2}px sans-serif`;
  ctx.textAlign = 'center';
  const txt = isKick ? 'バン!' : 'パン!';
  ctx.strokeText(txt, effect.x, effect.y - size - 5);
  ctx.fillText(txt, effect.x, effect.y - size - 5);

  // Small debris particles
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 / 5) * i + effect.timer * 0.3;
    const dist = size * 0.8 + effect.timer;
    ctx.fillStyle = isKick ? '#ff6644' : '#ffaa33';
    ctx.beginPath();
    ctx.arc(effect.x + Math.cos(angle) * dist, effect.y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// ============ ANIME HUD ============
function drawAnimeHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  // Top bar with gradient
  const hudGrad = ctx.createLinearGradient(0, 0, 0, 56);
  hudGrad.addColorStop(0, 'rgba(10,5,20,0.9)');
  hudGrad.addColorStop(1, 'rgba(10,5,20,0.6)');
  ctx.fillStyle = hudGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 56);

  // Bottom border glow
  ctx.strokeStyle = '#cc2233';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(CANVAS_WIDTH, 56);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Player label
  ctx.fillStyle = '#66aaff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AKA', 20, 18);
  
  // Score circles
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 26, 36, 7, 0, Math.PI * 2);
    if (i < state.player.score) {
      ctx.fillStyle = '#4488ff';
      ctx.fill();
      ctx.strokeStyle = '#88bbff';
    } else {
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.strokeStyle = '#444';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Opponent label
  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('AO', CANVAS_WIDTH - 20, 18);
  
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 20 - i * 26, 36, 7, 0, Math.PI * 2);
    if (i < state.opponent.score) {
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = '#ff8888';
    } else {
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.strokeStyle = '#444';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Timer with glow
  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = Math.floor(state.timeRemaining % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  const isLow = state.timeRemaining <= 10;
  ctx.save();
  if (isLow) {
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 15;
  }
  ctx.fillStyle = isLow ? '#ff4444' : '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(timeStr, CANVAS_WIDTH / 2, 40);
  ctx.restore();

  // Stamina bars with anime style
  const barWidth = 140;
  const barHeight = 5;
  const barY = 50;

  // Player stamina
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(20, barY, barWidth, barHeight);
  const pStamGrad = ctx.createLinearGradient(20, 0, 20 + barWidth, 0);
  pStamGrad.addColorStop(0, state.player.stamina > 25 ? '#22cc66' : '#cccc22');
  pStamGrad.addColorStop(1, state.player.stamina > 25 ? '#44ff88' : '#ffff44');
  ctx.fillStyle = pStamGrad;
  ctx.fillRect(20, barY, (state.player.stamina / STAMINA_MAX) * barWidth, barHeight);

  // Opponent stamina
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(CANVAS_WIDTH - 20 - barWidth, barY, barWidth, barHeight);
  const oStamGrad = ctx.createLinearGradient(CANVAS_WIDTH - 20 - barWidth, 0, CANVAS_WIDTH - 20, 0);
  oStamGrad.addColorStop(0, state.opponent.stamina > 25 ? '#44ff88' : '#ffff44');
  oStamGrad.addColorStop(1, state.opponent.stamina > 25 ? '#22cc66' : '#cccc22');
  ctx.fillStyle = oStamGrad;
  const oppW = (state.opponent.stamina / STAMINA_MAX) * barWidth;
  ctx.fillRect(CANVAS_WIDTH - 20 - oppW, barY, oppW, barHeight);
}

// ============ ANIME JUDGE MESSAGE ============
function drawAnimeJudgeMessage(ctx: CanvasRenderingContext2D, message: string) {
  ctx.save();
  
  // Dark overlay
  ctx.fillStyle = 'rgba(5,0,15,0.6)';
  ctx.fillRect(CANVAS_WIDTH / 2 - 180, CANVAS_HEIGHT / 2 - 45, 360, 90);
  
  // Border with glow
  ctx.strokeStyle = '#cc2233';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = 15;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 180, CANVAS_HEIGHT / 2 - 45, 360, 90);
  ctx.shadowBlur = 0;

  // Diagonal accent lines
  ctx.strokeStyle = 'rgba(204,34,51,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const lx = CANVAS_WIDTH / 2 - 180 + i * 50;
    ctx.beginPath();
    ctx.moveTo(lx, CANVAS_HEIGHT / 2 - 45);
    ctx.lineTo(lx + 30, CANVAS_HEIGHT / 2 + 45);
    ctx.stroke();
  }

  // Text with outline
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 4;
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  
  ctx.restore();
}

// ============ ANIME MENU ============
function drawAnimeMenu(ctx: CanvasRenderingContext2D) {
  ctx.save();
  
  // Dark bg with radial burst
  ctx.fillStyle = 'rgba(5,0,15,0.92)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Anime burst
  ctx.save();
  ctx.globalAlpha = 0.08;
  const cx = CANVAS_WIDTH / 2;
  const cy = 280;
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 / 20) * i;
    ctx.fillStyle = i % 2 === 0 ? '#ff2244' : '#2244ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 500, angle, angle + Math.PI / 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Title with glow
  ctx.save();
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ff3344';
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = 4;
  ctx.font = 'bold 68px sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText('空手 KARATÊ', cx, 150);
  ctx.fillText('空手 KARATÊ', cx, 150);
  ctx.restore();

  // Subtitle
  ctx.fillStyle = '#c49a6c';
  ctx.font = 'italic 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('O Caminho das Mãos Vazias', cx, 190);

  // Controls in anime panel
  ctx.fillStyle = 'rgba(20,10,30,0.7)';
  ctx.strokeStyle = '#cc2233';
  ctx.lineWidth = 2;
  const panelX = cx - 160;
  const panelY = 220;
  ctx.fillRect(panelX, panelY, 320, 160);
  ctx.strokeRect(panelX, panelY, 320, 160);

  ctx.fillStyle = '#ddd';
  ctx.font = '15px sans-serif';
  const instructions = [
    '← → ou A/D — Mover',
    'Z ou J — Soco (Oi-zuki)',
    'V ou N — Gyaku-zuki',
    'X ou K — Chute (Yoko-geri)',
    'B ou M — Mae-geri',
    'C ou L — Defesa (Uchi-uke)',
  ];
  instructions.forEach((text, i) => {
    ctx.fillText(text, cx, panelY + 25 + i * 22);
  });

  // Blinking start text
  const blink = Math.sin(Date.now() / 300);
  ctx.save();
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = blink > 0 ? 20 : 5;
  ctx.fillStyle = blink > 0 ? '#ff3344' : '#cc2233';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('▶  Pressione ENTER para lutar!  ◀', cx, 430);
  ctx.restore();

  ctx.restore();
}

// ============ ANIME GAME OVER ============
function drawAnimeGameOver(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,0,15,0.85)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.textAlign = 'center';

  // Dramatic kanji
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = state.winner === 'player' ? '#4488ff' : '#ff4444';
  ctx.font = 'bold 200px sans-serif';
  ctx.fillText(state.winner === 'player' ? '勝' : '負', CANVAS_WIDTH / 2, 340);
  ctx.restore();

  if (state.winner === 'player') {
    ctx.save();
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#66aaff';
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 4;
    ctx.font = 'bold 52px sans-serif';
    ctx.strokeText('VITÓRIA!', CANVAS_WIDTH / 2, 200);
    ctx.fillText('VITÓRIA!', CANVAS_WIDTH / 2, 200);
    ctx.restore();
  } else if (state.winner === 'opponent') {
    ctx.save();
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ff5566';
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 4;
    ctx.font = 'bold 52px sans-serif';
    ctx.strokeText('DERROTA', CANVAS_WIDTH / 2, 200);
    ctx.fillText('DERROTA', CANVAS_WIDTH / 2, 200);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffcc44';
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = 4;
    ctx.font = 'bold 52px sans-serif';
    ctx.strokeText('EMPATE', CANVAS_WIDTH / 2, 200);
    ctx.fillText('EMPATE', CANVAS_WIDTH / 2, 200);
    ctx.restore();
  }

  ctx.fillStyle = '#ccc';
  ctx.font = '22px sans-serif';
  ctx.fillText(`Placar: ${state.player.score} × ${state.opponent.score}`, CANVAS_WIDTH / 2, 260);

  const blink = Math.sin(Date.now() / 300);
  ctx.save();
  ctx.shadowColor = '#ff2244';
  ctx.shadowBlur = blink > 0 ? 15 : 3;
  ctx.fillStyle = blink > 0 ? '#ff3344' : '#cc2233';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Pressione ENTER para jogar novamente', CANVAS_WIDTH / 2, 360);
  ctx.restore();

  ctx.restore();
}
