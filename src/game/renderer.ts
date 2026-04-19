import { Fighter, GameState, CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, STAMINA_MAX, MAX_SCORE } from './types';

// ============ ANIME-STYLE KARATE RENDERER ============
// Cel-shaded look with bold outlines, expressive anime faces, speed lines, and manga effects

// WKF scoreboard mannequin style: pure white karategi, soft gray outline,
// faceless rounded head, colored belt + gloves + foot guards (red=AKA, blue=AO).
const OUTLINE_W = 2;
const OUTLINE_COL = '#9aa0a6';
const MANNEQUIN_SHADE = '#e6e8eb';
const MANNEQUIN_DEEP = '#cdd1d6';

// Team-colored foot/shin guard (set per-fighter at draw start). WKF mannequins
// always wear colored foot protectors matching the belt — red for AKA, blue for AO.
let CURRENT_FOOT_GUARD = '#d4202a';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawAnimeBackground(ctx);
  // Judge sits in the back of the dojo BEFORE the fighters render,
  // so the athletes always appear in front and combat is never obstructed.
  drawJudge(ctx, state);
  drawFighter(ctx, state.player, 'P1');
  drawFighter(ctx, state.opponent, 'P2');
  if (state.hitEffect) drawAnimeHitEffect(ctx, state.hitEffect);
  drawAnimeHUD(ctx, state);
  if (state.judgeTimer > 0) drawAnimeJudgeMessage(ctx, state.judgeMessage);
  if (state.gameStatus === 'menu') drawAnimeMenu(ctx);
  if (state.gameStatus === 'game-over') drawAnimeGameOver(ctx, state);
}

// ============ JUDGE (REFEREE) ============
// Drawn at the back of the dojo, on a slight rise, behind & between the fighters.
// Smaller scale + faded contrast so the eye prioritizes the athletes in the foreground.
function drawJudge(ctx: CanvasRenderingContext2D, state: GameState) {
  // Defensive: state shape may be stale during hot-reload — fall back to a safe default.
  const j = state.judge ?? { state: 'idle' as const, side: null, timer: 0 };
  const jx = CANVAS_WIDTH / 2;
  const jy = GROUND_Y - 78;
  const scale = 0.62;

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(10,5,20,0.35)';
  ctx.beginPath();
  ctx.ellipse(jx, jy + 78, 26, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(jx, jy);
  ctx.scale(scale, scale);

  const aka = state.player;
  const ao = state.opponent;
  const akaSideSign = aka.x < ao.x ? -1 : 1;
  const aoSideSign = -akaSideSign;
  const pointDir = j.side === 'aka' ? akaSideSign : (j.side === 'ao' ? aoSideSign : 0);

  const skin = '#d9a878';
  const skinShade = '#b88458';
  const jacket = '#1a1a22';
  const jacketShade = '#0d0d14';
  const shirt = '#f4f0e6';
  const tie = '#7a1e2a';
  const trouser = '#0d0d14';

  // Legs
  ctx.fillStyle = trouser;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath(); ctx.rect(-14, 14, 12, 60); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.rect(2, 14, 12, 60); ctx.fill(); ctx.stroke();
  // Shoes
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(-8, 78, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(8, 78, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Torso (jacket)
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(-22, 14); ctx.lineTo(-20, -34); ctx.lineTo(20, -34); ctx.lineTo(22, 14);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Shirt V + tie
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(-7, -34); ctx.lineTo(7, -34); ctx.lineTo(0, -14);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = tie;
  ctx.beginPath();
  ctx.moveTo(-3, -28); ctx.lineTo(3, -28); ctx.lineTo(2, 4); ctx.lineTo(-2, 4);
  ctx.closePath(); ctx.fill();

  // Lapels
  ctx.fillStyle = jacketShade;
  ctx.beginPath(); ctx.moveTo(-20, -34); ctx.lineTo(-2, -16); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(20, -34); ctx.lineTo(2, -16); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill();

  // Arms
  drawJudgeArms(ctx, j.state, pointDir, jacket, skin, skinShade);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -44, 11, 13, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // Hair
  ctx.fillStyle = '#1a1015';
  ctx.beginPath();
  ctx.ellipse(0, -52, 11, 7, 0, Math.PI, 0);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#1a1015';
  const eyeOffset = pointDir === 0 ? 0 : pointDir * 1.5;
  ctx.beginPath(); ctx.arc(-3 + eyeOffset, -44, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3 + eyeOffset, -44, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  if (state.gameStatus === 'bow-in' || state.gameStatus === 'bow-out' || j.state === 'point' || j.state === 'winner') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'italic 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SHUSHIN (主審)', jx, jy + 96);
    ctx.restore();
  }
}

function drawJudgeArms(
  ctx: CanvasRenderingContext2D,
  jState: 'idle' | 'point' | 'hajime' | 'yame' | 'winner',
  pointDir: number,
  jacket: string,
  skin: string,
  _skinShade: string,
) {
  ctx.fillStyle = jacket;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;

  const drawArm = (sx: number, sy: number, ex: number, ey: number, hand = true) => {
    ctx.fillStyle = jacket;
    ctx.beginPath();
    ctx.moveTo(sx - 4, sy);
    ctx.lineTo(sx + 4, sy);
    ctx.lineTo(ex + 3, ey);
    ctx.lineTo(ex - 3, ey);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (hand) {
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  };

  if (jState === 'point' && pointDir !== 0) {
    const dir = pointDir;
    drawArm(dir * 14, -28, dir * 46, -10);
    drawArm(-dir * 14, -28, -dir * 16, 10);
  } else if (jState === 'winner' && pointDir !== 0) {
    const dir = pointDir;
    drawArm(dir * 14, -28, dir * 40, -64);
    drawArm(-dir * 14, -28, -dir * 16, 10);
  } else if (jState === 'hajime') {
    drawArm(-14, -28, -22, 14);
    drawArm(14, -28, 22, 14);
  } else if (jState === 'yame') {
    drawArm(-14, -28, -16, 10);
    drawArm(14, -28, 26, -42);
  } else {
    drawArm(-14, -28, -16, 12);
    drawArm(14, -28, 16, 12);
  }
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

  // ===== Tactical visual cues drawn in WORLD space (not flipped/scaled with body) =====
  // Telegraph wind-up: pulsing white aura around the fighter just before the hit-frame.
  if (fighter.telegraphFlash > 0) {
    ctx.save();
    const pulse = 0.35 + Math.sin(Date.now() / 40) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(x, y - 80, 50, 95, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Parry flash: golden ring + spark, signals counter-window opened.
  if (fighter.parryFlash > 0) {
    ctx.save();
    const fade = fighter.parryFlash / 20;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 25;
    const r = 50 + (1 - fade) * 35;
    ctx.beginPath();
    ctx.arc(x, y - 80, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Counter-window indicator: subtle golden underglow while the parry counter is active.
  if (fighter.parryWindow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 80) * 0.15;
    ctx.fillStyle = '#ffd84a';
    ctx.shadowColor = '#ffd84a';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 36, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  // Global fighter scale — bigger athletes, closer presence on screen
  const FIGHTER_SCALE = 1.25;
  ctx.scale(facing === 'left' ? -FIGHTER_SCALE : FIGHTER_SCALE, FIGHTER_SCALE);

  const hitShake = fState === 'hit' ? (Math.random() - 0.5) * 5 : 0;
  const t = Date.now();
  const breathe = Math.sin(t / 400) * 1.2; // subtle breathing
  const bobY = fState === 'idle' ? breathe : 0;

  // WKF mannequin palette — uniform white "doll" with team-colored gear.
  // No skin tones, no ink details. Hands/feet/head use the same off-white as the gi.
  const teamCol = accentColor; // red for AKA, blue for AO
  CURRENT_FOOT_GUARD = teamCol;
  const skin = '#ffffff';
  const skinShade = MANNEQUIN_SHADE;
  const skinHighlight = '#ffffff';
  const telegraphing = fighter.telegraphFlash > 0;
  const giMain = telegraphing ? '#fff7d8' : (fState === 'hit' ? '#ffd8d8' : '#ffffff');
  const giShade = telegraphing ? '#f0e6c2' : (fState === 'hit' ? '#f0bcbc' : MANNEQUIN_SHADE);
  const giFold = MANNEQUIN_DEEP;
  const beltCol = teamCol;
  const gloveCol = teamCol;

  // Subtle speed lines on attack (kept faint so the mannequin reads clean)
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
    // Gyaku-zuki com rotação de quadril (kaiten):
    // perna de trás empurra firme contra o solo (calcanhar plantado),
    // os quadris giram para encarar frontalmente o oponente,
    // o ombro de trás dispara para frente junto com o quadril,
    // e o punho viaja em LINHA RETA partindo do peito até o alvo.

    // Stance Zenkutsu-dachi: peso ~70% perna da frente, perna de trás reta empurrando
    const hipY = -36;

    // Perna de trás (esquerda no canvas) — esticada, empurrando o solo
    drawAnimeLeg(ctx, -6, hipY, -22, hipY + 26, -34, 4, giMain, giFold, skin, skinShade, legW);
    // Perna da frente (direita) — joelho flexionado sobre o pé, suportando peso
    drawAnimeLeg(ctx, 6, hipY, 22, hipY + 12, 30, 2, giMain, giFold, skin, skinShade, legW);

    // Quadril rotacionado para frente: ombros vêm bem à frente do eixo dos pés.
    // shoulderX positivo = ombros avançaram na direção do oponente acompanhando o quadril.
    const shoulderY = hipY - torsoLen;
    const shoulderX = 14; // forte avanço do tronco/quadril (kaiten)

    drawAnimeTorso(ctx, 4, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Hikite — mão da frente puxada com força até a costela (cotovelo travado para trás)
    const hikiteSX = shoulderX + 18;
    drawAnimeArm(ctx, hikiteSX, shoulderY + 6, hikiteSX + 6, shoulderY + 18, hikiteSX - 4, hipY - 6, giMain, skin, skinShade, true, gloveCol);

    // Soco reverso — ombro de trás VEM PARA FRENTE com o quadril.
    // Trajetória RETA: ombro, cotovelo e punho alinhados horizontalmente na altura do peito.
    const punchShoulderX = shoulderX - 6; // ombro de trás avançou (não está mais atrás)
    const punchY = shoulderY + 14; // altura do peito (chudan)
    const elbowX = punchShoulderX + 22;
    const fistX = punchShoulderX + 58;
    drawAnimeArm(ctx, punchShoulderX, shoulderY + 6, elbowX, punchY, fistX, punchY, giMain, skin, skinShade, true, gloveCol);

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

  } else if (fState === 'bow') {
    // Reverência (REI / ritsu-rei): tronco inclinado ~30° para frente,
    // mãos junto às coxas, olhar baixo. Pernas retas em musubi-dachi.
    const hipY = -36;
    // Pernas retas e juntas
    drawAnimeLeg(ctx, -4, hipY, -6, hipY + 24, -8, 2, giMain, giFold, skin, skinShade, legW);
    drawAnimeLeg(ctx, 4, hipY, 6, hipY + 24, 8, 2, giMain, giFold, skin, skinShade, legW);

    // Tronco inclinado para frente: ombros avançam e descem
    const bowAmount = 22; // quão baixo a reverência desce
    const shoulderY = hipY - torsoLen + bowAmount;
    const shoulderX = 14; // tronco projetado para frente
    drawAnimeTorso(ctx, 0, hipY, shoulderX, shoulderY, giMain, giShade, giFold, beltCol);

    // Braços retos ao longo das coxas (mão na coxa)
    const backSX = shoulderX - 18;
    const frontSX = shoulderX + 18;
    drawAnimeArm(ctx, backSX, shoulderY + 6, backSX + 4, shoulderY + 22, backSX + 8, shoulderY + 38, giMain, skin, skinShade, false, gloveCol);
    drawAnimeArm(ctx, frontSX, shoulderY + 6, frontSX + 4, shoulderY + 22, frontSX + 8, shoulderY + 38, giMain, skin, skinShade, false, gloveCol);

    // Cabeça inclinada para baixo (frente do tronco)
    drawAnimeHead(ctx, shoulderX + 6, shoulderY + 4, 'idle', skin, skinShade, skinHighlight, accentColor, headR);
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

// ============ LEG (tapered, muscular) ============
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
  const shinW = limbW - 3;
  const calfBulge = 2; // slight calf muscle curve

  // Thigh — tapered from hip to knee
  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle);
  const perpY = -Math.cos(thighAngle);

  ctx.fillStyle = giCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;

  // Thigh with slight quad bulge
  const midThX = (hipX + kneeX) / 2;
  const midThY = (hipY + kneeY) / 2;
  ctx.beginPath();
  ctx.moveTo(hipX + perpX * thighW / 2, hipY + perpY * thighW / 2);
  ctx.quadraticCurveTo(
    midThX + perpX * (thighW / 2 + 2), midThY + perpY * (thighW / 2 + 2),
    kneeX + perpX * (thighW * 0.4), kneeY + perpY * (thighW * 0.4)
  );
  ctx.lineTo(kneeX - perpX * (thighW * 0.4), kneeY - perpY * (thighW * 0.4));
  ctx.quadraticCurveTo(
    midThX - perpX * (thighW / 2 + 1), midThY - perpY * (thighW / 2 + 1),
    hipX - perpX * thighW / 2, hipY - perpY * thighW / 2
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shin — tapered with calf bulge
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPx = Math.sin(shinAngle);
  const sPy = -Math.cos(shinAngle);
  const midShX = (kneeX + footX) * 0.4 + kneeX * 0.1;
  const midShY = (kneeY + footY) * 0.4 + kneeY * 0.1;

  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.moveTo(kneeX + sPx * shinW / 2, kneeY + sPy * shinW / 2);
  ctx.quadraticCurveTo(
    midShX + sPx * (shinW / 2 + calfBulge), midShY + sPy * (shinW / 2 + calfBulge),
    footX + sPx * (shinW * 0.3), footY + sPy * (shinW * 0.3)
  );
  ctx.lineTo(footX - sPx * (shinW * 0.3), footY - sPy * (shinW * 0.3));
  ctx.quadraticCurveTo(
    midShX - sPx * (shinW / 2), midShY - sPy * (shinW / 2),
    kneeX - sPx * shinW / 2, kneeY - sPy * shinW / 2
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Knee joint circle
  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, thighW * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = foldCol;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Foot guard — team color (WKF foot protector)
  ctx.fillStyle = CURRENT_FOOT_GUARD;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  const footDir = footX > kneeX ? 1 : (footX < kneeX ? -1 : 1);
  ctx.beginPath();
  ctx.ellipse(footX + footDir * 5, footY, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ============ LEG KICK (tapered, muscular) ============
function drawAnimeLegKick(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  kneeX: number, kneeY: number,
  footX: number, footY: number,
  giCol: string, foldCol: string,
  skinCol: string, skinDarkCol: string,
) {
  const limbW = 16;

  const thighAngle = Math.atan2(kneeY - hipY, kneeX - hipX);
  const perpX = Math.sin(thighAngle);
  const perpY = -Math.cos(thighAngle);

  const midThX = (hipX + kneeX) / 2;
  const midThY = (hipY + kneeY) / 2;

  ctx.fillStyle = giCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(hipX + perpX * limbW / 2, hipY + perpY * limbW / 2);
  ctx.quadraticCurveTo(
    midThX + perpX * (limbW / 2 + 2), midThY + perpY * (limbW / 2 + 2),
    kneeX + perpX * (limbW * 0.4), kneeY + perpY * (limbW * 0.4)
  );
  ctx.lineTo(kneeX - perpX * (limbW * 0.4), kneeY - perpY * (limbW * 0.4));
  ctx.quadraticCurveTo(
    midThX - perpX * (limbW / 2 + 1), midThY - perpY * (limbW / 2 + 1),
    hipX - perpX * limbW / 2, hipY - perpY * limbW / 2
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Shin
  const shinW = limbW - 2;
  const shinAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const sPx = Math.sin(shinAngle);
  const sPy = -Math.cos(shinAngle);

  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.moveTo(kneeX + sPx * shinW / 2, kneeY + sPy * shinW / 2);
  ctx.lineTo(footX + sPx * (shinW * 0.3), footY + sPy * (shinW * 0.3));
  ctx.lineTo(footX - sPx * (shinW * 0.3), footY - sPy * (shinW * 0.3));
  ctx.lineTo(kneeX - sPx * shinW / 2, kneeY - sPy * shinW / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Knee joint
  ctx.fillStyle = giCol;
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, limbW * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Foot guard (team-colored, pointed forward like WKF foot protector)
  ctx.fillStyle = CURRENT_FOOT_GUARD;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.save();
  ctx.translate(footX, footY);
  ctx.rotate(shinAngle);
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(17, -4);
  ctx.lineTo(22, 0);
  ctx.lineTo(17, 4);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ============ ARM (with bicep/forearm muscle curves) ============
function drawAnimeArm(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  elbowX: number, elbowY: number,
  fistX: number, fistY: number,
  giCol: string, skinCol: string, skinDarkCol: string,
  isFist: boolean,
  gloveColor?: string
) {
  const armW = 12;

  // Upper arm with bicep bulge
  const uAngle = Math.atan2(elbowY - shoulderY, elbowX - shoulderX);
  const uPx = Math.sin(uAngle);
  const uPy = -Math.cos(uAngle);
  const midUX = (shoulderX + elbowX) / 2;
  const midUY = (shoulderY + elbowY) / 2;

  ctx.fillStyle = giCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(shoulderX + uPx * armW / 2, shoulderY + uPy * armW / 2);
  ctx.quadraticCurveTo(
    midUX + uPx * (armW / 2 + 2), midUY + uPy * (armW / 2 + 2),
    elbowX + uPx * (armW * 0.4), elbowY + uPy * (armW * 0.4)
  );
  ctx.lineTo(elbowX - uPx * (armW * 0.4), elbowY - uPy * (armW * 0.4));
  ctx.quadraticCurveTo(
    midUX - uPx * (armW / 2 + 1), midUY - uPy * (armW / 2 + 1),
    shoulderX - uPx * armW / 2, shoulderY - uPy * armW / 2
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Elbow joint
  ctx.fillStyle = skinCol;
  ctx.beginPath();
  ctx.arc(elbowX, elbowY, armW * 0.32, 0, Math.PI * 2);
  ctx.fill();

  // Forearm with muscle taper
  const fArmW = 10;
  const fAngle = Math.atan2(fistY - elbowY, fistX - elbowX);
  const fPx = Math.sin(fAngle);
  const fPy = -Math.cos(fAngle);
  const midFX = (elbowX + fistX) * 0.4 + elbowX * 0.1;
  const midFY = (elbowY + fistY) * 0.4 + elbowY * 0.1;

  ctx.fillStyle = skinCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(elbowX + fPx * fArmW / 2, elbowY + fPy * fArmW / 2);
  ctx.quadraticCurveTo(
    midFX + fPx * (fArmW / 2 + 1), midFY + fPy * (fArmW / 2 + 1),
    fistX + fPx * (fArmW * 0.35), fistY + fPy * (fArmW * 0.35)
  );
  ctx.lineTo(fistX - fPx * (fArmW * 0.35), fistY - fPy * (fArmW * 0.35));
  ctx.quadraticCurveTo(
    midFX - fPx * (fArmW / 2), midFY - fPy * (fArmW / 2),
    elbowX - fPx * fArmW / 2, elbowY - fPy * fArmW / 2
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glove
  if (gloveColor) {
    const gloveR = isFist ? 9 : 8;
    ctx.fillStyle = gloveColor;
    ctx.strokeStyle = OUTLINE_COL;
    ctx.lineWidth = OUTLINE_W;
    ctx.beginPath();
    ctx.arc(fistX, fistY, gloveR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(fistX - 2, fistY - 3, gloveR * 0.35, 0, Math.PI * 2);
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

// ============ WKF MANNEQUIN TORSO ============
// Smooth white karategi with a single bold colored belt (team color).
// No muscle definition, no cel-shading, no lapel V — just clean rounded form.
function drawAnimeTorso(
  ctx: CanvasRenderingContext2D,
  hipX: number, hipY: number,
  shoulderX: number, shoulderY: number,
  giMain: string, giShade: string, _giFold: string, beltCol: string
) {
  const shoulderW = 46;
  const waistW = 30;

  // Main jacket — soft rounded silhouette
  ctx.fillStyle = giMain;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2, shoulderY + 2);
  ctx.quadraticCurveTo(shoulderX - shoulderW / 2 - 2, (shoulderY + hipY) / 2, hipX - waistW / 2, hipY);
  ctx.lineTo(hipX + waistW / 2, hipY);
  ctx.quadraticCurveTo(shoulderX + shoulderW / 2 + 2, (shoulderY + hipY) / 2, shoulderX + shoulderW / 2, shoulderY + 2);
  ctx.quadraticCurveTo(shoulderX, shoulderY - 4, shoulderX - shoulderW / 2, shoulderY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Soft side shadow (single subtle gradient hint)
  ctx.fillStyle = giShade;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(shoulderX - shoulderW / 2 + 2, shoulderY + 4);
  ctx.quadraticCurveTo(shoulderX - shoulderW / 2, (shoulderY + hipY) / 2, hipX - waistW / 2 + 2, hipY - 1);
  ctx.lineTo(hipX - waistW / 2 + 10, hipY - 1);
  ctx.lineTo(shoulderX - shoulderW / 2 + 12, shoulderY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Rounded shoulder caps (mannequin balls)
  ctx.fillStyle = giMain;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.arc(shoulderX - shoulderW / 2, shoulderY + 4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(shoulderX + shoulderW / 2, shoulderY + 4, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belt — solid team color, the strongest visual identifier
  const beltY = hipY - 4;
  const beltH = 10;
  ctx.fillStyle = beltCol;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.rect(hipX - waistW / 2 - 3, beltY, waistW + 6, beltH);
  ctx.fill();
  ctx.stroke();

  // Belt knot
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.ellipse(hipX + 2, beltY + beltH / 2, 5, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belt tails (short, hanging straight)
  ctx.fillStyle = beltCol;
  ctx.beginPath();
  ctx.moveTo(hipX - 1, beltY + beltH);
  ctx.lineTo(hipX - 3, beltY + beltH + 14);
  ctx.lineTo(hipX + 2, beltY + beltH + 14);
  ctx.lineTo(hipX + 4, beltY + beltH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ============ WKF MANNEQUIN HEAD ============
// Faceless rounded white head — same off-white as the gi.
// State is conveyed through tiny posture cues (slight tilt on hit / victory),
// never through facial features. This matches the WKF scoreboard pictogram.
function drawAnimeHead(
  ctx: CanvasRenderingContext2D,
  shoulderX: number, shoulderY: number,
  fState: string,
  skin: string, skinShade: string, _skinHighlight: string,
  _accentColor: string, headR: number
) {
  const neckX = shoulderX + 1;
  const neckY = shoulderY;

  // Posture cue: slight forward tilt on hit, slight upward chin on victory
  let headOffsetX = 0;
  let headOffsetY = 0;
  if (fState === 'hit') { headOffsetX = -3; headOffsetY = 2; }
  else if (fState === 'victory') { headOffsetY = -1; }

  const headX = neckX + headOffsetX;
  const headY = neckY - headR - 4 + headOffsetY;

  // Short neck — same white tone, smooth trapezoid
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(neckX - 6, neckY);
  ctx.lineTo(neckX - 4, neckY - 7);
  ctx.lineTo(neckX + 4, neckY - 7);
  ctx.lineTo(neckX + 6, neckY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Head — perfect round mannequin ball
  ctx.fillStyle = skin;
  ctx.strokeStyle = OUTLINE_COL;
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.arc(headX, headY, headR + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Single soft side-shadow crescent — gives 3D form without any features
  ctx.fillStyle = skinShade;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(headX - 2, headY + 1, headR + 1, Math.PI * 0.6, Math.PI * 1.4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Subtle highlight dot (top-right) for the rounded plastic-doll feel
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(headX + headR * 0.35, headY - headR * 0.4, headR * 0.35, headR * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ============ ANIME HIT EFFECT ============
function drawAnimeHitEffect(ctx: CanvasRenderingContext2D, effect: { x: number; y: number; timer: number; type: string }) {
  const maxTimer = Math.max(15, effect.timer);
  const alpha = Math.max(0, Math.min(1, effect.timer / maxTimer));
  const size = Math.max(2, (maxTimer - effect.timer) * 3.5);
  
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

  // Player label — AKA (red)
  ctx.fillStyle = '#ff6666';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('AKA', 20, 18);

  // Score circles
  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 26, 36, 7, 0, Math.PI * 2);
    if (i < state.player.score) {
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

  // Opponent label — AO (blue)
  ctx.fillStyle = '#66aaff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('AO', CANVAS_WIDTH - 20, 18);

  for (let i = 0; i < MAX_SCORE; i++) {
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH - 20 - i * 26, 36, 7, 0, Math.PI * 2);
    if (i < state.opponent.score) {
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

  // Stamina bars with anime style — pulse red when critical
  const barWidth = 140;
  const barHeight = 5;
  const barY = 50;
  const lowPulse = 0.5 + Math.sin(Date.now() / 90) * 0.5;

  // Player stamina
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(20, barY, barWidth, barHeight);
  const pLow = state.player.stamina < 25;
  const pStamGrad = ctx.createLinearGradient(20, 0, 20 + barWidth, 0);
  if (pLow) {
    pStamGrad.addColorStop(0, `rgba(255,${Math.floor(60 + lowPulse * 60)},60,1)`);
    pStamGrad.addColorStop(1, `rgba(255,${Math.floor(100 + lowPulse * 80)},80,1)`);
  } else {
    pStamGrad.addColorStop(0, state.player.stamina > 50 ? '#22cc66' : '#cccc22');
    pStamGrad.addColorStop(1, state.player.stamina > 50 ? '#44ff88' : '#ffff44');
  }
  ctx.fillStyle = pStamGrad;
  ctx.fillRect(20, barY, (state.player.stamina / STAMINA_MAX) * barWidth, barHeight);

  // Opponent stamina
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(CANVAS_WIDTH - 20 - barWidth, barY, barWidth, barHeight);
  const oLow = state.opponent.stamina < 25;
  const oStamGrad = ctx.createLinearGradient(CANVAS_WIDTH - 20 - barWidth, 0, CANVAS_WIDTH - 20, 0);
  if (oLow) {
    oStamGrad.addColorStop(0, `rgba(255,${Math.floor(100 + lowPulse * 80)},80,1)`);
    oStamGrad.addColorStop(1, `rgba(255,${Math.floor(60 + lowPulse * 60)},60,1)`);
  } else {
    oStamGrad.addColorStop(0, state.opponent.stamina > 50 ? '#44ff88' : '#ffff44');
    oStamGrad.addColorStop(1, state.opponent.stamina > 50 ? '#22cc66' : '#cccc22');
  }
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
  const panelX = cx - 180;
  const panelY = 215;
  ctx.fillRect(panelX, panelY, 360, 215);
  ctx.strokeRect(panelX, panelY, 360, 215);

  ctx.fillStyle = '#ddd';
  ctx.font = '14px sans-serif';
  const instructions = [
    '← → ou A/D — Mover  •  C/L — Defesa',
    'Z — Kizami    V — Gyaku-zuki',
    'X — Yoko-geri    B — Mae-geri',
    '',
    '⚡ TÁTICA: stamina só recupera parado/recuando.',
    '🛡 PARRY: defenda no instante exato do golpe',
    '   (4 frames) → contra-ataque garantido!',
    '⚠ Telegraph: aura branca avisa o golpe — leia!',
  ];
  instructions.forEach((text, i) => {
    ctx.fillText(text, cx, panelY + 22 + i * 22);
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
