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

  const hitShake = fState === 'hit' ? (Math.random() - 0.5) * 6 : 0;
  const bobY = fState === 'idle' ? Math.sin(Date.now() / 300) * 1.5 : 0;

  // Anime cel-shade colors
  const skin = '#f5d0a9';
  const skinShade = '#d4a574';
  const skinHighlight = '#fce4c8';
  const giMain = fState === 'hit' ? '#ffbbbb' : '#f8f6f0';
  const giShade = fState === 'hit' ? '#e09090' : '#ddd8cc';
  const giFold = fState === 'hit' ? '#cc7777' : '#c4bfb4';
  const beltCol = '#1a1a1a';
  const gloveCol = accentColor;

  // Speed lines when attacking
  if (fState === 'punch' || fState === 'kick' || fState === 'gyaku-zuki' || fState === 'mae-geri') {
    drawSpeedLines(ctx, fState);
  }

  // Ground shadow (anime style — sharp ellipse)
  ctx.fillStyle = 'rgba(10,5,20,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 44, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const thighLen = 40;
  const shinLen = 38;
  const torsoLen = 48;
  const upperArmLen = 26;
  const forearmLen = 24;
  const headR = 13;

  if (fState === 'idle' || fState === 'walk-forward' || fState === 'walk-backward') {
    const walkPhase = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(Date.now() / 120) * 0.15 : 0;
    const hipY = -40 + bobY;
    const backHipAngle = -Math.PI / 2 - 0.35 + walkPhase;
    const backKneeX = Math.cos(backHipAngle) * thighLen;
    const backKneeY = hipY - Math.sin(backHipAngle) * thighLen;
    const backFootX = backKneeX - 8;
    const frontHipAngle = -Math.PI / 2 + 0.3 - walkPhase;
    const frontKneeX = Math.cos(frontHipAngle) * thighLen;
    const frontKneeY = hipY - Math.sin(frontHipAngle) * thighLen;
    const frontFootX = frontKneeX + 6;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinShade, 18);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinShade, 18);

    const shoulderY = hipY - torsoLen;
    const shoulderX = 2;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backShoulderX = shoulderX - 20;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 8, shoulderY + 20, backShoulderX - 4, hipY + 2, giMain, skin, skinShade, false, gloveCol);

    const frontShoulderX = shoulderX + 20;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 14, shoulderY + 18, frontShoulderX + 10, shoulderY + 4, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'punch') {
    const hipY = -36;
    const backFootX = -32; const backKneeX = -18; const backKneeY = hipY + 18;
    const frontFootX = 28; const frontKneeX = 22; const frontKneeY = hipY + 14;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinShade, 18);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinShade, 18);

    const shoulderY = hipY - torsoLen; const shoulderX = 4;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backShoulderX = shoulderX - 20;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 4, shoulderY + 20, backShoulderX, hipY + 2, giMain, skin, skinShade, false, gloveCol);

    const frontShoulderX = shoulderX + 20;
    const punchReach = 58;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + punchReach * 0.5, shoulderY + 6, frontShoulderX + punchReach, shoulderY + 8, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'kick') {
    const hipY = -42;
    const standFootX = -10; const standKneeX = -6; const standKneeY = hipY + 20;
    drawAnimeLeg(ctx, 0, hipY, standKneeX, standKneeY, standFootX, 0, giMain, giFold, skin, skinShade, 17);

    const kickKneeX = 18; const kickKneeY = hipY - 20;
    const kickFootX = 62; const kickFootY = hipY - torsoLen + 10;
    drawAnimeLegKick(ctx, 0, hipY, kickKneeX, kickKneeY, kickFootX, kickFootY, giMain, giFold, skin, skinShade);

    const shoulderY = hipY - torsoLen; const shoulderX = -4;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backShoulderX = shoulderX - 20;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 8, shoulderY + 16, backShoulderX - 4, hipY, giMain, skin, skinShade, false, gloveCol);
    const frontShoulderX = shoulderX + 20;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 6, shoulderY + 14, frontShoulderX + 2, shoulderY + 4, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'gyaku-zuki') {
    const hipY = -36;
    const backFootX = -34; const backKneeX = -20; const backKneeY = hipY + 18;
    const frontFootX = 26; const frontKneeX = 22; const frontKneeY = hipY + 12;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinShade, 18);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinShade, 18);

    const shoulderY = hipY - torsoLen; const shoulderX = 6;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const frontShoulderX = shoulderX + 20;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 4, shoulderY + 20, frontShoulderX + 2, hipY + 2, giMain, skin, skinShade, true, gloveCol);

    const backShoulderX = shoulderX - 20;
    const punchReach = 55;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX + punchReach * 0.45, shoulderY + 14, backShoulderX + punchReach, shoulderY + 20, giMain, skin, skinShade, false, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'mae-geri') {
    const hipY = -40;
    const standFootX = -8; const standKneeX = -4; const standKneeY = hipY + 18;
    drawAnimeLeg(ctx, 0, hipY, standKneeX, standKneeY, standFootX, 0, giMain, giFold, skin, skinShade, 17);

    const kickKneeX = 16; const kickKneeY = hipY - 8;
    const kickFootX = 56; const kickFootY = hipY - 14;
    drawAnimeLegKick(ctx, 0, hipY, kickKneeX, kickKneeY, kickFootX, kickFootY, giMain, giFold, skin, skinShade);

    const shoulderY = hipY - torsoLen; const shoulderX = -2;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backShoulderX = shoulderX - 20;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 6, shoulderY + 14, backShoulderX - 2, shoulderY + 2, giMain, skin, skinShade, false, gloveCol);
    const frontShoulderX = shoulderX + 20;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 8, shoulderY + 14, frontShoulderX + 4, shoulderY + 2, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'block') {
    const hipY = -40 + bobY;
    const backFootX = -28; const backKneeX = -16; const backKneeY = hipY + 20;
    const frontFootX = 24; const frontKneeX = 20; const frontKneeY = hipY + 14;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinShade, 17);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinShade, 17);

    const shoulderY = hipY - torsoLen; const shoulderX = 2;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    const backShoulderX = shoulderX - 20;
    drawAnimeArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 4, shoulderY + 20, backShoulderX, hipY + 2, giMain, skin, skinShade, true, gloveCol);

    const frontShoulderX = shoulderX + 20;
    drawAnimeArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 20, shoulderY + 14, frontShoulderX + 26, shoulderY - 6, giMain, skin, skinShade, true, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'hit') {
    const hipY = -38 + hitShake;
    const backFootX = -14; const backKneeX = -10; const backKneeY = hipY + 18;
    const frontFootX = 10; const frontKneeX = 8; const frontKneeY = hipY + 20;

    drawAnimeLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinShade, 16);
    drawAnimeLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinShade, 16);

    const shoulderY = hipY - torsoLen + 6; const shoulderX = -6;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    drawAnimeArm(ctx, shoulderX - 20, shoulderY + 4, shoulderX - 28, shoulderY + 14, shoulderX - 24, shoulderY + 24, giMain, skin, skinShade, false, gloveCol);
    drawAnimeArm(ctx, shoulderX + 20, shoulderY + 4, shoulderX + 26, shoulderY + 12, shoulderX + 22, shoulderY + 22, giMain, skin, skinShade, false, gloveCol);

    drawAnimeHead(ctx, shoulderX, shoulderY, fState, skin, skinShade, skinHighlight, accentColor, headR);

  } else if (fState === 'victory') {
    const hipY = -42;
    drawAnimeLeg(ctx, 0, hipY, -6, hipY + 20, -10, 0, giMain, giFold, skin, skinShade, 17);
    drawAnimeLeg(ctx, 0, hipY, 6, hipY + 20, 10, 0, giMain, giFold, skin, skinShade, 17);

    const shoulderY = hipY - torsoLen; const shoulderX = 0;
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    drawAnimeArm(ctx, shoulderX - 20, shoulderY + 4, shoulderX - 26, shoulderY - 20, shoulderX - 22, shoulderY - 36, giMain, skin, skinShade, true, gloveCol);
    drawAnimeArm(ctx, shoulderX + 20, shoulderY + 4, shoulderX + 28, shoulderY - 22, shoulderX + 24, shoulderY - 38, giMain, skin, skinShade, true, gloveCol);

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
