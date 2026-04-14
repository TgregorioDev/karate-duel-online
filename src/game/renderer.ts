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
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, '#1a0a0a');
  grad.addColorStop(0.6, '#2a1515');
  grad.addColorStop(1, '#1a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#8B7355';
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
  
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

  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, GROUND_Y + 2);
  ctx.lineTo(CANVAS_WIDTH - 100, GROUND_Y + 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(139, 0, 0, 0.15)';
  ctx.fillRect(380, 40, 12, 200);
  ctx.fillRect(568, 40, 12, 200);
  ctx.fillRect(365, 40, 230, 14);
  ctx.fillRect(370, 70, 220, 10);
}

// ============ REALISTIC KARATE FIGHTER ============
// Body proportions based on real martial arts silhouettes
// All positions relative to hip center (0,0 is at feet/ground)

function drawFighter(ctx: CanvasRenderingContext2D, fighter: Fighter, label: string) {
  const { x, y, facing, state: fState, accentColor } = fighter;

  ctx.save();
  ctx.translate(x, y);
  if (facing === 'left') ctx.scale(-1, 1);

  const hitShake = fState === 'hit' ? (Math.random() - 0.5) * 4 : 0;
  const bobY = fState === 'idle' ? Math.sin(Date.now() / 300) * 1.5 : 0;

  const skin = '#e2b88a';
  const skinDark = '#c9985e';
  const giMain = fState === 'hit' ? '#ffaaaa' : '#f0ede6';
  const giShade = fState === 'hit' ? '#e08888' : '#d8d4ca';
  const giFold = fState === 'hit' ? '#cc7777' : '#c0bbb0';
  const beltCol = '#1a1a1a';
  const gloveCol = accentColor;

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 42, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body part lengths (athletic proportions)
  const thighLen = 38;
  const shinLen = 36;
  const torsoLen = 44;
  const upperArmLen = 24;
  const forearmLen = 22;
  const headR = 12;

  if (fState === 'idle' || fState === 'walk-forward' || fState === 'walk-backward') {
    const walkPhase = (fState === 'walk-forward' || fState === 'walk-backward') ? Math.sin(Date.now() / 120) * 0.15 : 0;
    
    // KAMAE stance - natural fighting position
    // Hip position
    const hipY = -40 + bobY;
    
    // Back leg: slightly angled back, mostly straight
    const backHipAngle = -Math.PI / 2 - 0.35 + walkPhase;
    const backKneeX = Math.cos(backHipAngle) * thighLen;
    const backKneeY = hipY - Math.sin(backHipAngle) * thighLen;
    const backFootX = backKneeX - 8;
    const backFootY = 0;
    
    // Front leg: slightly forward, slight bend
    const frontHipAngle = -Math.PI / 2 + 0.3 - walkPhase;
    const frontKneeX = Math.cos(frontHipAngle) * thighLen;
    const frontKneeY = hipY - Math.sin(frontHipAngle) * thighLen;
    const frontFootX = frontKneeX + 6;
    const frontFootY = 0;

    // Draw legs
    drawLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, backFootY, giMain, giFold, skin, skinDark, 12);
    drawLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, frontFootY, giMain, giFold, skin, skinDark, 12);

    // Torso - slightly angled forward
    const shoulderY = hipY - torsoLen;
    const shoulderX = 2;
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Back arm - fist at hip (hikite)
    const backShoulderX = shoulderX - 14;
    const backElbowX = backShoulderX - 6;
    const backElbowY = shoulderY + 18;
    const backFistX = backShoulderX - 2;
    const backFistY = hipY + 2;
    drawArm(ctx, backShoulderX, shoulderY + 4, backElbowX, backElbowY, backFistX, backFistY, giMain, skin, skinDark, false, gloveCol);

    // Front arm - guard up at chest/chin height
    const frontShoulderX = shoulderX + 14;
    const frontElbowX = frontShoulderX + 12;
    const frontElbowY = shoulderY + 16;
    const frontFistX = frontShoulderX + 8;
    const frontFistY = shoulderY + 4;
    drawArm(ctx, frontShoulderX, shoulderY + 4, frontElbowX, frontElbowY, frontFistX, frontFistY, giMain, skin, skinDark, true, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);

  } else if (fState === 'punch') {
    // GYAKU-ZUKI: Deep lunge, fully extended punch
    // Reference: back leg FULLY straight and extended, front knee deeply bent
    const hipY = -36;
    
    // Back leg - fully extended straight behind (like in reference)
    const backFootX = -32;
    const backKneeX = -18;
    const backKneeY = hipY + 18;
    
    // Front leg - deep lunge, knee bent at ~90°
    const frontFootX = 28;
    const frontKneeX = 22;
    const frontKneeY = hipY + 14;

    drawLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinDark, 13);
    drawLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinDark, 13);

    // Torso - rotated into punch (hip rotation)
    const shoulderY = hipY - torsoLen;
    const shoulderX = 4;
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // HIKITE arm - pulled back tight to hip
    const backShoulderX = shoulderX - 14;
    drawArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 4, shoulderY + 20, backShoulderX, hipY + 2, giMain, skin, skinDark, false, gloveCol);

    // PUNCH arm - fully extended forward, straight line from shoulder to fist
    const frontShoulderX = shoulderX + 14;
    const punchReach = 55; // long reach
    const punchElbowX = frontShoulderX + punchReach * 0.5;
    const punchElbowY = shoulderY + 6;
    const punchFistX = frontShoulderX + punchReach;
    const punchFistY = shoulderY + 8;
    drawArm(ctx, frontShoulderX, shoulderY + 4, punchElbowX, punchElbowY, punchFistX, punchFistY, giMain, skin, skinDark, true, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);

  } else if (fState === 'kick') {
    // YOKO-GERI / MAE-GERI - high kick as in the reference image
    // Standing on back leg, kicking leg extended HIGH (head height)
    const hipY = -42;
    
    // Standing leg - slightly bent, supporting weight
    const standFootX = -10;
    const standKneeX = -6;
    const standKneeY = hipY + 20;
    drawLeg(ctx, 0, hipY, standKneeX, standKneeY, standFootX, 0, giMain, giFold, skin, skinDark, 12);

    // Kicking leg - extended HIGH and forward (like reference silhouette)
    // Thigh goes up and forward, shin extends out horizontally at head height
    const kickKneeX = 18;
    const kickKneeY = hipY - 20;
    const kickFootX = 62;
    const kickFootY = hipY - torsoLen + 10; // at head height!

    // Kicking leg gi pants
    drawLegKick(ctx, 0, hipY, kickKneeX, kickKneeY, kickFootX, kickFootY, giMain, giFold, skin, skinDark);

    // Torso - leaning back slightly for balance (as in reference)
    const shoulderY = hipY - torsoLen;
    const shoulderX = -4; // lean back
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms - both in guard position, slightly back for balance
    const backShoulderX = shoulderX - 14;
    drawArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 8, shoulderY + 16, backShoulderX - 4, hipY, giMain, skin, skinDark, false, gloveCol);

    const frontShoulderX = shoulderX + 14;
    drawArm(ctx, frontShoulderX, shoulderY + 4, frontShoulderX + 6, shoulderY + 14, frontShoulderX + 2, shoulderY + 4, giMain, skin, skinDark, true, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);

  } else if (fState === 'block') {
    // UCHI UKE - inside forearm block
    // Deep Zenkutsu-dachi, blocking arm sweeps across body, hikite on opposite hip
    const hipY = -40 + bobY;
    
    // Wide Zenkutsu-dachi stance (like in reference image)
    const backFootX = -28;
    const backKneeX = -16;
    const backKneeY = hipY + 20;
    const frontFootX = 24;
    const frontKneeX = 20;
    const frontKneeY = hipY + 14;

    drawLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinDark, 12);
    drawLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinDark, 12);

    // Torso - rotated into the block (hip rotation visible)
    const shoulderY = hipY - torsoLen;
    const shoulderX = 2;
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // HIKITE arm - pulled back tight to hip (back arm)
    const backShoulderX = shoulderX - 14;
    drawArm(ctx, backShoulderX, shoulderY + 4, backShoulderX - 4, shoulderY + 20, backShoulderX, hipY + 2, giMain, skin, skinDark, true, gloveCol);

    // UCHI UKE blocking arm - forearm extended outward away from body
    // Elbow away from torso, fist sweeps out to intercept
    const frontShoulderX = shoulderX + 14;
    const blockElbowX = frontShoulderX + 18;
    const blockElbowY = shoulderY + 14;
    const blockFistX = frontShoulderX + 24;
    const blockFistY = shoulderY - 6;
    drawArm(ctx, frontShoulderX, shoulderY + 4, blockElbowX, blockElbowY, blockFistX, blockFistY, giMain, skin, skinDark, true, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);

  } else if (fState === 'hit') {
    // Recoiling backward
    const hipY = -38 + hitShake;
    
    const backFootX = -14;
    const backKneeX = -10;
    const backKneeY = hipY + 18;
    const frontFootX = 10;
    const frontKneeX = 8;
    const frontKneeY = hipY + 20;

    drawLeg(ctx, 0, hipY, backKneeX, backKneeY, backFootX, 0, giMain, giFold, skin, skinDark, 11);
    drawLeg(ctx, 0, hipY, frontKneeX, frontKneeY, frontFootX, 0, giMain, giFold, skin, skinDark, 11);

    const shoulderY = hipY - torsoLen + 6; // hunched
    const shoulderX = -6; // leaning back
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms flailing
    drawArm(ctx, shoulderX - 14, shoulderY + 4, shoulderX - 22, shoulderY + 14, shoulderX - 18, shoulderY + 24, giMain, skin, skinDark, false, gloveCol);
    drawArm(ctx, shoulderX + 14, shoulderY + 4, shoulderX + 20, shoulderY + 12, shoulderX + 16, shoulderY + 22, giMain, skin, skinDark, false, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);

  } else if (fState === 'victory') {
    const hipY = -42;
    
    drawLeg(ctx, 0, hipY, -6, hipY + 20, -10, 0, giMain, giFold, skin, skinDark, 12);
    drawLeg(ctx, 0, hipY, 6, hipY + 20, 10, 0, giMain, giFold, skin, skinDark, 12);

    const shoulderY = hipY - torsoLen;
    const shoulderX = 0;
    drawTorsoBody(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Arms raised in victory
    drawArm(ctx, shoulderX - 14, shoulderY + 4, shoulderX - 20, shoulderY - 20, shoulderX - 16, shoulderY - 36, giMain, skin, skinDark, true, gloveCol);
    drawArm(ctx, shoulderX + 14, shoulderY + 4, shoulderX + 22, shoulderY - 22, shoulderX + 18, shoulderY - 38, giMain, skin, skinDark, true, gloveCol);

    drawHeadNew(ctx, shoulderX, shoulderY, fState, skin, skinDark, accentColor, headR);
  }

  ctx.restore();
}

// ============ BODY PART DRAWING HELPERS ============

function drawLeg(
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

  // Thigh (gi pants)
  ctx.fillStyle = giCol;
  ctx.beginPath();
  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle) * thighW / 2;
  const perpY = -Math.cos(thighAngle) * thighW / 2;
  ctx.moveTo(hipX + perpX, hipY + perpY);
  ctx.lineTo(kneeX + perpX * 0.9, kneeY + perpY * 0.9);
  ctx.lineTo(kneeX - perpX * 0.9, kneeY - perpY * 0.9);
  ctx.lineTo(hipX - perpX, hipY - perpY);
  ctx.closePath();
  ctx.fill();

  // Shin (gi pants lower, slightly narrower)
  ctx.beginPath();
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPerpX = Math.sin(shinAngle) * shinW / 2;
  const sPerpY = -Math.cos(shinAngle) * shinW / 2;
  ctx.moveTo(kneeX + sPerpX, kneeY + sPerpY);
  ctx.lineTo(footX + sPerpX * 0.7, footY + sPerpY * 0.7);
  ctx.lineTo(footX - sPerpX * 0.7, footY - sPerpY * 0.7);
  ctx.lineTo(kneeX - sPerpX, kneeY - sPerpY);
  ctx.closePath();
  ctx.fill();

  // Knee fold line
  ctx.strokeStyle = foldCol;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(kneeX + perpX * 0.5, kneeY + perpY * 0.5);
  ctx.lineTo(kneeX - perpX * 0.5, kneeY - perpY * 0.5);
  ctx.stroke();

  // Pant bottom fold
  ctx.beginPath();
  ctx.moveTo(footX + sPerpX * 0.8, footY + sPerpY * 0.8 - 4);
  ctx.lineTo(footX - sPerpX * 0.8, footY - sPerpY * 0.8 - 4);
  ctx.stroke();

  // Bare foot
  ctx.fillStyle = skinCol;
  const footLen = 14;
  const footDir = footX > kneeX ? 1 : (footX < kneeX ? -1 : 1);
  ctx.beginPath();
  ctx.ellipse(footX + footDir * 4, footY, footLen / 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Toes
  ctx.fillStyle = skinDarkCol;
  ctx.beginPath();
  ctx.ellipse(footX + footDir * 10, footY, 3, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLegKick(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  kneeX: number, kneeY: number,
  footX: number, footY: number,
  giCol: string, foldCol: string,
  skinCol: string, skinDarkCol: string,
) {
  const limbW = 13;

  // Thigh
  ctx.fillStyle = giCol;
  ctx.beginPath();
  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle) * limbW / 2;
  const perpY = -Math.cos(thighAngle) * limbW / 2;
  ctx.moveTo(hipX + perpX, hipY + perpY);
  ctx.lineTo(kneeX + perpX, kneeY + perpY);
  ctx.lineTo(kneeX - perpX, kneeY - perpY);
  ctx.lineTo(hipX - perpX, hipY - perpY);
  ctx.closePath();
  ctx.fill();

  // Shin (extended outward)
  const shinW = limbW - 1;
  ctx.beginPath();
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPerpX = Math.sin(shinAngle) * shinW / 2;
  const sPerpY = -Math.cos(shinAngle) * shinW / 2;
  ctx.moveTo(kneeX + sPerpX, kneeY + sPerpY);
  ctx.lineTo(footX + sPerpX * 0.6, footY + sPerpY * 0.6);
  ctx.lineTo(footX - sPerpX * 0.6, footY - sPerpY * 0.6);
  ctx.lineTo(kneeX - sPerpX, kneeY - sPerpY);
  ctx.closePath();
  ctx.fill();

  // Gi fold wrinkles on thigh
  ctx.strokeStyle = foldCol;
  ctx.lineWidth = 0.7;
  const midThighX = (hipX + kneeX) / 2;
  const midThighY = (hipY + kneeY) / 2;
  ctx.beginPath();
  ctx.moveTo(midThighX + perpX * 0.4, midThighY + perpY * 0.4);
  ctx.lineTo(midThighX - perpX * 0.4, midThighY - perpY * 0.4);
  ctx.stroke();

  // Bare foot - extended, pointed (like in reference)
  ctx.fillStyle = skinCol;
  const footAngle = shinAngle;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(footAngle);
  // Foot shape - elongated and pointed for kicking
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(16, -3);
  ctx.lineTo(18, 0);
  ctx.lineTo(16, 3);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  // Ball of foot (koshi) - the striking surface
  ctx.fillStyle = skinDarkCol;
  ctx.beginPath();
  ctx.ellipse(16, 0, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  elbowX: number, elbowY: number,
  fistX: number, fistY: number,
  giCol: string, skinCol: string, skinDarkCol: string,
  isFist: boolean,
  gloveColor?: string
) {
  const armW = 9;

  // Upper arm (gi sleeve)
  ctx.fillStyle = giCol;
  ctx.beginPath();
  const uAngle = Math.atan2(elbowY - shoulderY, elbowX - shoulderX);
  const uPx = Math.sin(uAngle) * armW / 2;
  const uPy = -Math.cos(uAngle) * armW / 2;
  ctx.moveTo(shoulderX + uPx, shoulderY + uPy);
  ctx.lineTo(elbowX + uPx * 0.9, elbowY + uPy * 0.9);
  ctx.lineTo(elbowX - uPx * 0.9, elbowY - uPy * 0.9);
  ctx.lineTo(shoulderX - uPx, shoulderY - uPy);
  ctx.closePath();
  ctx.fill();

  // Forearm (skin)
  const fArmW = 7;
  ctx.fillStyle = skinCol;
  ctx.beginPath();
  const fAngle = Math.atan2(fistY - elbowY, fistX - elbowX);
  const fPx = Math.sin(fAngle) * fArmW / 2;
  const fPy = -Math.cos(fAngle) * fArmW / 2;
  ctx.moveTo(elbowX + fPx, elbowY + fPy);
  ctx.lineTo(fistX + fPx * 0.8, fistY + fPy * 0.8);
  ctx.lineTo(fistX - fPx * 0.8, fistY - fPy * 0.8);
  ctx.lineTo(elbowX - fPx, elbowY - fPy);
  ctx.closePath();
  ctx.fill();

  // Glove (colored)
  if (gloveColor) {
    const gloveR = isFist ? 7 : 6;
    // Main glove shape
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(fistX, fistY, gloveR, 0, Math.PI * 2);
    ctx.fill();
    // Glove highlight
    const lighter = gloveColor === '#cc2222' ? '#ee4444' : '#4488ee';
    ctx.fillStyle = lighter;
    ctx.beginPath();
    ctx.arc(fistX - 1, fistY - 2, gloveR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    // Glove wrist strap
    const wristX = fistX - Math.cos(fAngle) * (gloveR + 1);
    const wristY = fistY - Math.sin(fAngle) * (gloveR + 1);
    ctx.fillStyle = gloveColor === '#cc2222' ? '#991111' : '#1a3366';
    ctx.beginPath();
    ctx.arc(wristX, wristY, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skinDarkCol;
    ctx.beginPath();
    ctx.arc(fistX, fistY, isFist ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();
    if (isFist) {
      ctx.fillStyle = skinCol;
      ctx.beginPath();
      ctx.arc(fistX + Math.cos(fAngle) * 2, fistY + Math.sin(fAngle) * 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTorsoBody(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  shoulderX: number, shoulderY: number,
  giMain: string, giShade: string, giFold: string, beltCol: string
) {
  // Torso shape - wider at shoulders, narrower at waist
  const shoulderW = 32;
  const waistW = 24;

  // Back shadow
  ctx.fillStyle = giShade;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2 - 1, shoulderY);
  ctx.lineTo(hipX - waistW / 2 - 1, hipY);
  ctx.lineTo(hipX + waistW / 2 + 1, hipY);
  ctx.lineTo(shoulderX + shoulderW / 2 + 1, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Main gi jacket
  ctx.fillStyle = giMain;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2, shoulderY + 1);
  ctx.lineTo(hipX - waistW / 2, hipY);
  ctx.lineTo(hipX + waistW / 2, hipY);
  ctx.lineTo(shoulderX + shoulderW / 2, shoulderY + 1);
  ctx.closePath();
  ctx.fill();

  // Gi lapel V-shape
  const lapelCenterX = (shoulderX + hipX) / 2;
  const lapelCenterY = (shoulderY + hipY) / 2 + 8;
  ctx.fillStyle = giShade;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 6, shoulderY + 2);
  ctx.lineTo(lapelCenterX, lapelCenterY);
  ctx.lineTo(shoulderX + 8, shoulderY + 2);
  ctx.lineTo(shoulderX + 4, shoulderY + 2);
  ctx.lineTo(lapelCenterX, lapelCenterY - 6);
  ctx.lineTo(shoulderX - 2, shoulderY + 2);
  ctx.closePath();
  ctx.fill();

  // Lapel stitching
  ctx.strokeStyle = giFold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 5, shoulderY + 3);
  ctx.lineTo(lapelCenterX, lapelCenterY - 2);
  ctx.lineTo(shoulderX + 7, shoulderY + 3);
  ctx.stroke();

  // Side seam lines
  ctx.strokeStyle = giFold;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2 + 2, shoulderY + 10);
  ctx.lineTo(hipX - waistW / 2 + 1, hipY - 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(shoulderX + shoulderW / 2 - 2, shoulderY + 10);
  ctx.lineTo(hipX + waistW / 2 - 1, hipY - 4);
  ctx.stroke();

  // BLACK BELT (OBI)
  const beltY = hipY - 4;
  const beltH = 8;
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.moveTo(hipX - waistW / 2 - 2, beltY);
  ctx.lineTo(hipX + waistW / 2 + 2, beltY);
  ctx.lineTo(hipX + waistW / 2 + 2, beltY + beltH);
  ctx.lineTo(hipX - waistW / 2 - 2, beltY + beltH);
  ctx.closePath();
  ctx.fill();

  // Belt texture lines
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(hipX - waistW / 2, beltY + 2);
  ctx.lineTo(hipX + waistW / 2, beltY + 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hipX - waistW / 2, beltY + beltH - 2);
  ctx.lineTo(hipX + waistW / 2, beltY + beltH - 2);
  ctx.stroke();

  // Belt knot
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(hipX + 3, beltY + beltH / 2, 5, 3.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.ellipse(hipX + 3, beltY + beltH / 2, 2.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belt tails hanging
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.moveTo(hipX + 1, beltY + beltH);
  ctx.lineTo(hipX - 3, beltY + beltH + 16);
  ctx.lineTo(hipX, beltY + beltH + 16);
  ctx.lineTo(hipX + 4, beltY + beltH);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hipX + 4, beltY + beltH);
  ctx.lineTo(hipX + 10, beltY + beltH + 14);
  ctx.lineTo(hipX + 7, beltY + beltH + 14);
  ctx.lineTo(hipX + 1, beltY + beltH);
  ctx.closePath();
  ctx.fill();
}

function drawHeadNew(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  fState: string,
  skin: string, skinDark: string,
  accentColor: string, headR: number
) {
  const neckX = shoulderX + 1;
  const neckY = shoulderY;
  const headX = neckX;
  const headY = neckY - headR - 4;

  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(neckX - 4, neckY - 6, 8, 8);
  ctx.fillStyle = skinDark;
  ctx.fillRect(neckX - 4, neckY - 2, 8, 3);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(headX, headY, headR, headR + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jaw
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(headX, headY + headR - 4, headR - 3, 4, 0, 0.2, Math.PI - 0.2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(headX, headY + headR - 5, headR - 3, 4, 0, 0.2, Math.PI - 0.2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(headX, headY - 4, headR + 1, headR - 2, 0, Math.PI + 0.3, -0.3);
  ctx.fill();
  ctx.fillRect(headX - headR - 1, headY - 4, 4, 10);
  ctx.fillRect(headX + headR - 2, headY - 4, 4, 10);
  ctx.beginPath();
  ctx.ellipse(headX, headY - 6, headR - 1, 5, 0, Math.PI, 0);
  ctx.fill();

  // Ears
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(headX - headR, headY, 3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(headX - 4, headY - 1, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(headX + 5, headY - 1, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.arc(headX - 3, headY, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headX + 6, headY, 2, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(headX - 3, headY, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headX + 6, headY, 1, 0, Math.PI * 2);
  ctx.fill();

  // Eyebrows
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  if (fState === 'hit') {
    ctx.beginPath();
    ctx.moveTo(headX - 7, headY - 5);
    ctx.lineTo(headX - 1, headY - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX + 3, headY - 3);
    ctx.lineTo(headX + 9, headY - 5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(headX - 7, headY - 4);
    ctx.quadraticCurveTo(headX - 4, headY - 6, headX - 1, headY - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX + 3, headY - 4);
    ctx.quadraticCurveTo(headX + 5, headY - 6, headX + 9, headY - 4);
    ctx.stroke();
  }

  // Mouth
  if (fState === 'hit') {
    ctx.fillStyle = '#6b3a2a';
    ctx.beginPath();
    ctx.ellipse(headX + 1, headY + headR - 7, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (fState === 'punch' || fState === 'kick') {
    ctx.fillStyle = '#6b3a2a';
    ctx.beginPath();
    ctx.ellipse(headX + 1, headY + headR - 7, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (fState === 'victory') {
    ctx.strokeStyle = '#8b5a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(headX + 1, headY + headR - 8, 3, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#8b5a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(headX - 2, headY + headR - 7);
    ctx.quadraticCurveTo(headX + 1, headY + headR - 6, headX + 4, headY + headR - 7);
    ctx.stroke();
  }

}

// ============ HUD, EFFECTS, MENUS (unchanged) ============

function drawHitEffect(ctx: CanvasRenderingContext2D, effect: { x: number; y: number; timer: number; type: string }) {
  const alpha = effect.timer / 15;
  const size = (15 - effect.timer) * 3;
  
  ctx.save();
  ctx.globalAlpha = alpha;
  
  ctx.strokeStyle = effect.type === 'kick' ? '#ff4444' : '#ffaa00';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i;
    ctx.beginPath();
    ctx.moveTo(effect.x + Math.cos(angle) * size * 0.3, effect.y + Math.sin(angle) * size * 0.3);
    ctx.lineTo(effect.x + Math.cos(angle) * size, effect.y + Math.sin(angle) * size);
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${14 + size/3}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(effect.type === 'kick' ? 'KICK!' : 'HIT!', effect.x, effect.y - size);
  
  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 50);
  
  ctx.fillStyle = '#4488ff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('JOGADOR', 20, 20);
  
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 28, 38, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < state.player.score ? '#4488ff' : '#333';
    ctx.fill();
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

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

  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = Math.floor(state.timeRemaining % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  ctx.fillStyle = state.timeRemaining <= 10 ? '#ff4444' : '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(timeStr, CANVAS_WIDTH / 2, 36);

  const barWidth = 150;
  const barHeight = 6;
  
  ctx.fillStyle = '#333';
  ctx.fillRect(20, 48, barWidth, barHeight - 2);
  ctx.fillStyle = state.player.stamina > 25 ? '#44cc44' : '#cccc44';
  ctx.fillRect(20, 48, (state.player.stamina / STAMINA_MAX) * barWidth, barHeight - 2);

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
  
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('空手 KARATÊ', CANVAS_WIDTH / 2, 160);
  
  ctx.fillStyle = '#8B7355';
  ctx.font = '20px sans-serif';
  ctx.fillText('O Caminho das Mãos Vazias', CANVAS_WIDTH / 2, 200);

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
