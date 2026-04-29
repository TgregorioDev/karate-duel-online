import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { createClipSignature, getAkaFacingRotationY, getAoFacingRotationY, getPreferredSourceClipIndex } from "@/game/akaAnimationUtils";
import type { Fighter, FighterState, GameState, ScoreCall } from "@/game/types";
import {
  CANVAS_WIDTH,
  HIT_STUN_FRAMES,
  KICK_DURATION_FRAMES,
  MAE_GERI_DURATION_FRAMES,
  PARRY_DEFENSE_DURATION_FRAMES,
  PUNCH_DURATION_FRAMES,
  GYAKU_ZUKI_DURATION_FRAMES,
  GROUND_Y,
  WKF_COMPETITION_SIZE_METERS,
  WKF_START_LINE_LENGTH_METERS,
  WKF_START_LINE_OFFSET_METERS,
  WKF_TOTAL_SIZE_METERS,
} from "@/game/types";

type ScoreEffect = {
  sprite: THREE.Sprite;
  life: number;
  velocityY: number;
};

type BurstParticle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
};

type ScoreboardSide = "player" | "opponent";
type FighterTargetHitboxes = {
  head?: THREE.Mesh;
  body?: THREE.Mesh;
};

type MasterSkeletonBinding = {
  rootObject: THREE.Object3D;
  boneNames: Set<string>;
  boneNameByCanonical: Map<string, string>;
  rootScaleByBoneName: Map<string, THREE.Vector3>;
};

export type ThreeRendererLoadState = {
  ready: boolean;
  failed: boolean;
  loaded: number;
  total: number;
  progress: number;
  label: string;
};

export type ThreeRendererOptions = {
  onLoadStateChange?: (state: ThreeRendererLoadState) => void;
  onReady?: () => void;
  onAkaAttackDurationsResolved?: (durations: Partial<Record<"punch" | "gyaku-zuki" | "kick" | "mae-geri", number>>) => void;
  onAkaAttackAnimationComplete?: (animation: "punch" | "gyaku-zuki" | "kick" | "mae-geri") => void;
};

type FighterVisualSlot = "player" | "opponent";

type FighterVisualAdapter = {
  root: THREE.Group;
  isReady: () => boolean;
  update: (fighter: Fighter, dtSeconds: number, gameState: GameState) => void;
  reset: (fighter: Fighter, gameState: GameState) => void;
  dispose: () => void;
};

type FighterClipKey =
  | "bow"
  | "idle"
  | "walk"
  | "kizami_tsuki"
  | "gyaku_zuki"
  | "mae_geri"
  | "mawashi_geri"
  | "block_high"
  | "block_low";

type AttackActionKey = "kizami_tsuki" | "gyaku_zuki" | "mae_geri" | "mawashi_geri";
type AttackEngineKey = "punch" | "gyaku-zuki" | "mae-geri" | "kick";
type FighterClipDefinition = {
  actionName: string;
  fileName: string;
  loop: boolean;
  attackEngineKey?: AttackEngineKey;
  targetFrames?: number;
};

type AnimatedFighterVisualOptions = {
  slot: FighterVisualSlot;
  label: string;
  loadLabel: string;
  accentColor: string;
  beltColor: string;
  bodyColor: string;
  depthOffset: number;
  assetBase: string;
  startWorldX: number;
  getFacingRotationY: (facing: Fighter["facing"]) => number;
  onLoadStateChange?: (slot: FighterVisualSlot, state: ThreeRendererLoadState) => void;
  onReady?: (slot: FighterVisualSlot) => void;
  onAttackDurationsResolved?: (durations: Partial<Record<"punch" | "gyaku-zuki" | "kick" | "mae-geri", number>>) => void;
  onAttackFinished?: (animation: "punch" | "gyaku-zuki" | "kick" | "mae-geri") => void;
};

const WORLD_WIDTH = WKF_TOTAL_SIZE_METERS;
const WORLD_HEIGHT_SCALE = 0.02;
const WORLD_HALF_WIDTH = WORLD_WIDTH / 2;
const FIGHTER_LANE_Z = 0;
const COMPETITION_AREA_SIZE = WKF_COMPETITION_SIZE_METERS;
const COMPETITION_AREA_HALF = COMPETITION_AREA_SIZE / 2;
const START_LINE_OFFSET = WKF_START_LINE_OFFSET_METERS;
const START_LINE_LENGTH = WKF_START_LINE_LENGTH_METERS;
const CAMERA_HEIGHT = 4.6;
const CAMERA_Z = 7.4;
const LOOK_Y = 1.65;
const FIGHTER_TARGET_HEIGHT = 1.8;
const DEFAULT_BLEND_SECONDS = 0.2;
const COMBO_BLEND_SECONDS = 0.15;
const DEFENSE_BLEND_SECONDS = 0.06;
const AKA_ASSET_BASE = "/models/fighters/aka/animations";
const AO_ASSET_BASE = "/models/fighters/ao/animations";
const FIGHTER_CLIP_DEFINITIONS: Record<FighterClipKey, FighterClipDefinition> = {
  bow: {
    actionName: "bow_in",
    fileName: "reference.glb",
    loop: false,
  },
  idle: {
    actionName: "idle",
    fileName: "stance.glb",
    loop: true,
  },
  walk: {
    actionName: "walk",
    fileName: "walk.glb",
    loop: true,
  },
  kizami_tsuki: {
    actionName: "kizami_tsuki",
    fileName: "kizame.glb",
    loop: false,
    attackEngineKey: "punch",
    targetFrames: PUNCH_DURATION_FRAMES,
  },
  gyaku_zuki: {
    actionName: "gyaku_zuki",
    fileName: "gyaku.glb",
    loop: false,
    attackEngineKey: "gyaku-zuki",
    targetFrames: GYAKU_ZUKI_DURATION_FRAMES,
  },
  mae_geri: {
    actionName: "mae_geri",
    fileName: "mae-geri.glb",
    loop: false,
    attackEngineKey: "mae-geri",
    targetFrames: MAE_GERI_DURATION_FRAMES,
  },
  mawashi_geri: {
    actionName: "mawashi_geri",
    fileName: "mawashi-geri.glb",
    loop: false,
    attackEngineKey: "kick",
    targetFrames: KICK_DURATION_FRAMES,
  },
  block_high: {
    actionName: "block_high",
    fileName: "uchi-uke.glb",
    loop: false,
    targetFrames: PARRY_DEFENSE_DURATION_FRAMES,
  },
  block_low: {
    actionName: "block_low",
    fileName: "gedan-barai.glb",
    loop: false,
    targetFrames: PARRY_DEFENSE_DURATION_FRAMES,
  },
};
const FIGHTER_CLIP_KEYS = Object.keys(FIGHTER_CLIP_DEFINITIONS) as FighterClipKey[];
const ATTACK_CLIP_KEY_LIST = FIGHTER_CLIP_KEYS.filter((clipKey) => FIGHTER_CLIP_DEFINITIONS[clipKey].attackEngineKey) as AttackActionKey[];
const ATTACK_CLIP_KEYS = new Set<FighterClipKey>(ATTACK_CLIP_KEY_LIST);
const DEFENSE_CLIP_KEYS = new Set<FighterClipKey>(["block_high", "block_low"]);
const ONE_SHOT_KEYS = new Set<FighterClipKey>(FIGHTER_CLIP_KEYS.filter((clipKey) => FIGHTER_CLIP_DEFINITIONS[clipKey].loop === false));

const SCORE_COLORS: Record<ScoreCall, string> = {
  YUKO: "#f6f3cf",
  "WAZA-ARI": "#ffd166",
  IPPON: "#ff5d5d",
};
const SCOREBOARD_WIDTH = 6.2;
const SCOREBOARD_HEIGHT = 1.58;
const SCOREBOARD_CANVAS_WIDTH = 1024;
const SCOREBOARD_CANVAS_HEIGHT = 360;
const HEAD_TARGET_BONE_ALIASES = ["head", "neck"];
const BODY_TARGET_BONE_ALIASES = ["spine2", "spine02", "chest", "upperchest", "spine1", "spine"];

function toWorldX(engineX: number) {
  return (engineX / CANVAS_WIDTH) * WORLD_WIDTH - WORLD_HALF_WIDTH;
}

function toWorldY(engineY: number) {
  return (GROUND_Y - engineY) * WORLD_HEIGHT_SCALE;
}

function formatScoreboardTime(timeRemaining: number) {
  const totalSeconds = Math.max(0, Math.ceil(timeRemaining));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createEvaNormalMap(size = 128) {
  const data = new Uint8Array(size * size * 4);
  let seed = 1337;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const grain = (random() - 0.5) * 0.34;
      const waveX = Math.sin(x * 0.28) * 0.18;
      const waveY = Math.cos(y * 0.24) * 0.18;
      const nx = THREE.MathUtils.clamp(0.5 + grain + waveX, 0, 1);
      const ny = THREE.MathUtils.clamp(0.5 - grain + waveY, 0, 1);
      data[index] = Math.round(nx * 255);
      data[index + 1] = Math.round(ny * 255);
      data[index + 2] = 255;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.needsUpdate = true;
  return texture;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const limitedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + limitedRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, limitedRadius);
  ctx.arcTo(x + width, y + height, x, y + height, limitedRadius);
  ctx.arcTo(x, y + height, x, y, limitedRadius);
  ctx.arcTo(x, y, x + width, y, limitedRadius);
  ctx.closePath();
}

function createTextSprite(
  text: string,
  color: string,
  options?: {
    background?: string;
    borderColor?: string;
    fontSize?: number;
    scale?: THREE.Vector2;
  },
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (options?.background) {
      drawRoundedRect(ctx, 32, 52, canvas.width - 64, canvas.height - 104, 36);
      ctx.fillStyle = options.background;
      ctx.fill();

      if (options.borderColor) {
        ctx.lineWidth = 8;
        ctx.strokeStyle = options.borderColor;
        ctx.stroke();
      }
    }

    ctx.font = `700 ${options?.fontSize ?? 92}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(24, 16, 16, 0.95)";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    texture.needsUpdate = true;
  }

  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  sprite.scale.set(options?.scale?.x ?? 3.6, options?.scale?.y ?? 1.8, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function createBrushedMetalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#c7ccd2");
    gradient.addColorStop(0.45, "#6f7882");
    gradient.addColorStop(1, "#d7dbe0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 2) {
      ctx.strokeStyle = y % 4 === 0 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(canvas.width, y + 0.5);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class TournamentScoreboard {
  readonly root = new THREE.Group();

  private readonly canvas = document.createElement("canvas");
  private readonly texture: THREE.CanvasTexture;
  private readonly panelMaterial: THREE.MeshBasicMaterial;
  private readonly metalTexture = createBrushedMetalTexture();
  private readonly metalMaterial = new THREE.MeshStandardMaterial({
    color: "#9aa2aa",
    metalness: 0.82,
    roughness: 0.34,
    map: this.metalTexture,
  });
  private readonly darkMaterial = new THREE.MeshStandardMaterial({
    color: "#11151b",
    metalness: 0.38,
    roughness: 0.48,
  });

  private ctx: CanvasRenderingContext2D | null;
  private playerPulse = 0;
  private opponentPulse = 0;
  private previousPlayerScore = -1;
  private previousOpponentScore = -1;
  private previousTimeText = "";
  private previousJudgeMessage = "";

  constructor() {
    this.canvas.width = SCOREBOARD_CANVAS_WIDTH;
    this.canvas.height = SCOREBOARD_CANVAS_HEIGHT;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.panelMaterial = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    const backPlate = new THREE.Mesh(
      new THREE.BoxGeometry(SCOREBOARD_WIDTH + 0.36, SCOREBOARD_HEIGHT + 0.28, 0.16),
      this.darkMaterial,
    );
    backPlate.position.z = -0.07;
    backPlate.castShadow = true;
    backPlate.receiveShadow = true;

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(SCOREBOARD_WIDTH + 0.48, 0.12, 0.22), this.metalMaterial);
    const bottomRail = topRail.clone();
    topRail.position.set(0, SCOREBOARD_HEIGHT / 2 + 0.1, 0);
    bottomRail.position.set(0, -SCOREBOARD_HEIGHT / 2 - 0.1, 0);

    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.13, SCOREBOARD_HEIGHT + 0.24, 0.22), this.metalMaterial);
    const rightRail = leftRail.clone();
    leftRail.position.set(-SCOREBOARD_WIDTH / 2 - 0.16, 0, 0);
    rightRail.position.set(SCOREBOARD_WIDTH / 2 + 0.16, 0, 0);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(SCOREBOARD_WIDTH, SCOREBOARD_HEIGHT), this.panelMaterial);
    glass.position.z = 0.04;

    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 1.15, 12), this.metalMaterial);
    const rightPost = leftPost.clone();
    leftPost.position.set(-SCOREBOARD_WIDTH * 0.36, -SCOREBOARD_HEIGHT / 2 - 0.63, -0.03);
    rightPost.position.set(SCOREBOARD_WIDTH * 0.36, -SCOREBOARD_HEIGHT / 2 - 0.63, -0.03);
    leftPost.castShadow = true;
    rightPost.castShadow = true;

    this.root.add(backPlate, topRail, bottomRail, leftRail, rightRail, glass, leftPost, rightPost);
    this.root.position.set(0, 4.42, -7.46);
  }

  triggerScorePulse(side: ScoreboardSide) {
    if (side === "player") {
      this.playerPulse = 0.72;
    } else {
      this.opponentPulse = 0.72;
    }
  }

  update(state: GameState, dtSeconds: number) {
    this.playerPulse = Math.max(0, this.playerPulse - dtSeconds);
    this.opponentPulse = Math.max(0, this.opponentPulse - dtSeconds);

    const timeText = formatScoreboardTime(state.timeRemaining);
    const shouldRedraw =
      state.player.score !== this.previousPlayerScore ||
      state.opponent.score !== this.previousOpponentScore ||
      timeText !== this.previousTimeText ||
      state.judgeMessage !== this.previousJudgeMessage ||
      this.playerPulse > 0 ||
      this.opponentPulse > 0;

    if (!shouldRedraw) return;

    this.draw(state, timeText);
    this.previousPlayerScore = state.player.score;
    this.previousOpponentScore = state.opponent.score;
    this.previousTimeText = timeText;
    this.previousJudgeMessage = state.judgeMessage;
  }

  private draw(state: GameState, timeText: string) {
    const ctx = this.ctx;
    if (!ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);

    const glassGradient = ctx.createLinearGradient(0, 0, 0, height);
    glassGradient.addColorStop(0, "rgba(34, 42, 52, 0.92)");
    glassGradient.addColorStop(0.48, "rgba(9, 13, 19, 0.9)");
    glassGradient.addColorStop(1, "rgba(24, 30, 38, 0.92)");
    drawRoundedRect(ctx, 18, 18, width - 36, height - 36, 34);
    ctx.fillStyle = glassGradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let x = 34; x < width - 34; x += 18) {
      ctx.fillRect(x, 32, 1, height - 64);
    }

    this.drawScoreBlock("AKA", state.player.score, 58, 116, 254, 172, "#C8102E", this.playerPulse);
    this.drawScoreBlock("AO", state.opponent.score, 712, 116, 254, 172, "#0055A4", this.opponentPulse);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 30px 'Arial Narrow', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(212, 175, 55, 0.9)";
    ctx.fillText("WORLD KARATE FEDERATION", width / 2, 58);

    ctx.font = "900 122px 'Arial Narrow', 'Segoe UI', sans-serif";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.78)";
    ctx.shadowColor = "rgba(255, 255, 255, 0.85)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#f8fafc";
    ctx.strokeText(timeText, width / 2, 186);
    ctx.fillText(timeText, width / 2, 186);
    ctx.shadowBlur = 0;

    ctx.font = "800 24px 'Arial Narrow', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
    ctx.fillText("MATCH TIMER", width / 2, 284);

    if (state.judgeMessage) {
      ctx.font = "900 24px 'Arial Narrow', 'Segoe UI', sans-serif";
      ctx.fillStyle = "rgba(255, 214, 102, 0.95)";
      ctx.fillText(state.judgeMessage.toUpperCase().slice(0, 42), width / 2, 326);
    }

    this.texture.needsUpdate = true;
  }

  private drawScoreBlock(
    label: string,
    score: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    pulse: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;

    const pulseAlpha = Math.min(1, pulse / 0.72);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + pulseAlpha * 32;
    drawRoundedRect(ctx, x, y, width, height, 24);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 4 + pulseAlpha * 5;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.22 + pulseAlpha * 0.42})`;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 28px 'Arial Narrow', 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.fillText(label, x + width / 2, y + 38);

    ctx.font = "900 110px 'Arial Narrow', 'Segoe UI', sans-serif";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(score.toString(), x + width / 2, y + 112);
    ctx.fillText(score.toString(), x + width / 2, y + 112);
    ctx.restore();
  }

  reset(state: GameState) {
    this.playerPulse = 0;
    this.opponentPulse = 0;
    this.previousPlayerScore = -1;
    this.previousOpponentScore = -1;
    this.previousTimeText = "";
    this.previousJudgeMessage = "";
    this.update(state, 0);
  }

  dispose() {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.panelMaterial.dispose();
    this.texture.dispose();
    this.metalTexture.dispose();
    this.metalMaterial.dispose();
    this.darkMaterial.dispose();
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function disposeMaterialTextures(material: THREE.Material | THREE.Material[]) {
  const disposeSingle = (entry: THREE.Material) => {
    Object.values(entry).forEach((value) => {
      if (value instanceof THREE.Texture) {
        value.dispose();
      }
    });
    entry.dispose();
  };

  if (Array.isArray(material)) {
    material.forEach(disposeSingle);
    return;
  }

  disposeSingle(material);
}

function disposeObjectResources(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      child.skeleton.dispose();
    }

    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterialTextures(child.material);
    }
  });
}

function canonicalizeBoneName(name: string) {
  return name
    .toLowerCase()
    .replace(/^mixamorig/, "")
    .replace(/[^a-z0-9]/g, "");
}

function splitTrackBinding(trackName: string) {
  const propertyIndex = trackName.lastIndexOf(".");
  if (propertyIndex < 0) {
    return {
      targetPath: trackName,
      property: "",
    };
  }

  return {
    targetPath: trackName.slice(0, propertyIndex),
    property: trackName.slice(propertyIndex + 1),
  };
}

function extractTrackTargetCandidates(targetPath: string) {
  const sanitizedPath = targetPath.replace(/\[[^\]]*\]/g, "");
  const rawSegments = sanitizedPath.split(/[|/]/).filter(Boolean);
  const candidates: string[] = [];

  rawSegments.forEach((segment) => {
    const namespaceFree = segment.replace(/^.*:/, "");
    if (namespaceFree) {
      candidates.push(namespaceFree);
    }

    const dottedSegments = namespaceFree.split(".").filter(Boolean);
    for (let index = dottedSegments.length - 1; index >= 0; index -= 1) {
      const candidate = dottedSegments.slice(index).join(".");
      if (candidate) {
        candidates.push(candidate);
      }
    }
  });

  return [...new Set(candidates.reverse())];
}

function applyShadowSetup(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function isAttackState(state: FighterState) {
  return state === "punch" || state === "gyaku-zuki" || state === "kick" || state === "mae-geri";
}

abstract class BaseFighterVisual implements FighterVisualAdapter {
  readonly root = new THREE.Group();

  protected readonly labelAnchor = new THREE.Group();
  protected readonly labelSprite: THREE.Sprite;

  constructor(
    label: string,
    accentColor: string,
    protected readonly depthOffset: number,
  ) {
    this.labelSprite = createTextSprite(label, "#f8fafc", {
      background: "rgba(9, 18, 28, 0.72)",
      borderColor: accentColor,
      fontSize: 84,
      scale: new THREE.Vector2(2.45, 0.98),
    });
    this.labelAnchor.position.set(0, 3.02, 0);
    this.labelAnchor.add(this.labelSprite);
    // Fighter name tags are intentionally hidden; the HUD already identifies both sides.
    this.labelAnchor.visible = false;
    this.root.add(this.labelAnchor);
  }

  protected applyWorldTransform(worldX: number, facing: Fighter["facing"]) {
    this.root.position.x = worldX;
    this.root.position.y = 0;
    this.root.position.z = this.depthOffset;
    this.root.rotation.y = facing === "right" ? -Math.PI / 2 : Math.PI / 2;
  }

  protected updateTransform(fighter: Fighter) {
    this.applyWorldTransform(toWorldX(fighter.x), fighter.facing);
  }

  isReady() {
    return true;
  }

  abstract update(fighter: Fighter, dtSeconds: number, gameState: GameState): void;

  reset(fighter: Fighter) {
    this.updateTransform(fighter);
  }

  dispose() {
    if (this.labelSprite.material instanceof THREE.SpriteMaterial) {
      this.labelSprite.material.map?.dispose();
      this.labelSprite.material.dispose();
    }
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
  }
}

class AnimatedFighterVisual extends BaseFighterVisual {
  private readonly modelRoot = new THREE.Group();
  private readonly fallback = new THREE.Group();
  private readonly actions = new Map<FighterClipKey, THREE.AnimationAction>();
  private readonly actionKeys = new Map<THREE.AnimationAction, FighterClipKey>();
  private readonly loadingState: ThreeRendererLoadState = {
    ready: false,
    failed: false,
    loaded: 0,
    total: FIGHTER_CLIP_KEYS.length,
    progress: 0,
    label: "",
  };

  private mixer: THREE.AnimationMixer | null = null;
  private ready = false;
  private activeAction: THREE.AnimationAction | null = null;
  private activeKey: FighterClipKey | null = null;
  private lastMovementState: FighterState | null = null;
  private lastFacing: Fighter["facing"] | null = null;
  private lastStateTimer = 0;
  private requestReturnToStance = false;
  private masterBinding: MasterSkeletonBinding | null = null;
  private referenceClipSignature: string | null = null;
  private readonly targetHitboxes: FighterTargetHitboxes = {};
  private initializedTransform = false;

  constructor(private readonly options: AnimatedFighterVisualOptions) {
    super(options.label, options.accentColor, options.depthOffset);
    this.loadingState.label = options.loadLabel;
    this.root.add(this.modelRoot);
    this.root.add(this.fallback);
    this.buildFallback();
    this.emitLoadState();
    void this.loadAssets();
  }

  override isReady() {
    return this.ready;
  }

  private emitLoadState(overrides?: Partial<ThreeRendererLoadState>) {
    Object.assign(this.loadingState, overrides);
    this.options.onLoadStateChange?.(this.options.slot, { ...this.loadingState });
  }

  private buildFallback() {
    const giMaterial = new THREE.MeshStandardMaterial({
      color: this.options.bodyColor,
      roughness: 0.78,
      metalness: 0.04,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: this.options.accentColor,
      roughness: 0.65,
      metalness: 0.08,
      emissive: new THREE.Color(this.options.accentColor).multiplyScalar(0.06),
    });
    const beltMaterial = new THREE.MeshStandardMaterial({
      color: this.options.beltColor,
      roughness: 0.72,
      metalness: 0.05,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: "#dcb79c",
      roughness: 0.9,
      metalness: 0,
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.12, 6, 12), giMaterial);
    body.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), skinMaterial);
    head.position.y = 2.15;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.46), beltMaterial);
    belt.position.y = 1.14;
    const gloveLeft = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), accentMaterial);
    const gloveRight = gloveLeft.clone();
    gloveLeft.position.set(-0.42, 1.36, 0.1);
    gloveRight.position.set(0.42, 1.36, 0.1);

    this.fallback.add(body, head, belt, gloveLeft, gloveRight);
    applyShadowSetup(this.fallback);
  }

  private async loadAssets() {
    const manager = new THREE.LoadingManager();
    manager.onStart = () => {
      this.emitLoadState({
        ready: false,
        failed: false,
        loaded: 0,
        total: FIGHTER_CLIP_KEYS.length,
        progress: 0,
        label: this.options.loadLabel,
      });
    };
    manager.onProgress = (_url, loaded, total) => {
      this.emitLoadState({
        loaded,
        total,
        progress: total > 0 ? loaded / total : 0,
        label: `${this.options.loadLabel} (${loaded}/${total})`,
      });
    };
    manager.onError = (url) => {
      this.emitLoadState({
        failed: true,
        label: `Falha ao carregar asset: ${url}`,
      });
    };

    const loader = new GLTFLoader(manager);

    try {
      const reference = await loader.loadAsync(`${this.options.assetBase}/${FIGHTER_CLIP_DEFINITIONS.bow.fileName}`);

      const rootMotionTargets = this.collectRootMotionTargets(reference.scene);
      const model = reference.scene;
      applyShadowSetup(model);
      this.fitModelToScene(model);
      this.modelRoot.add(model);
      this.fallback.visible = false;
      this.masterBinding = this.createMasterBinding(model);
      this.attachTargetHitboxes(model);

      this.mixer = new THREE.AnimationMixer(model);
      this.mixer.addEventListener("finished", this.handleMixerFinished as THREE.EventListener);

      const referenceSourceIndex = getPreferredSourceClipIndex(reference.animations);
      this.referenceClipSignature = referenceSourceIndex >= 0
        ? createClipSignature(reference.animations[referenceSourceIndex])
        : null;
      const bowClip = this.extractClip(reference.animations, "bow", rootMotionTargets, null);
      this.registerAction("bow", bowClip);

      const secondaryEntries = (Object.entries(FIGHTER_CLIP_DEFINITIONS) as [FighterClipKey, FighterClipDefinition][])
        .filter(([clipKey]) => clipKey !== "bow");

      const extractedClips = await Promise.all(
        secondaryEntries.map(async ([clipKey, definition]) => {
          let clip: THREE.AnimationClip | null = null;
          const gltf = await loader.loadAsync(`${this.options.assetBase}/${definition.fileName}`);
          try {
            clip = this.extractClip(gltf.animations, clipKey, rootMotionTargets, this.referenceClipSignature);
            if (clip) {
              console.log(`Clip extraido do arquivo [${definition.fileName}] e mapeado para a acao [${definition.actionName}] com sucesso.`);
            }
            return [clipKey, clip] as const;
          } finally {
            disposeObjectResources(gltf.scene);
            gltf.scene.clear();
            if (clip) {
              console.log(`[Asset System] Clip [${clipKey}] vinculado ao esqueleto Master. Memória de pipeline limpa.`);
            }
          }
        }),
      );

      for (const [clipKey, clip] of extractedClips) {
        this.registerAction(clipKey, clip);
      }

      this.options.onAttackDurationsResolved?.(this.resolveAttackDurations());

      this.ready = true;
      this.emitLoadState({
        ready: true,
        failed: false,
        loaded: this.loadingState.total,
        progress: 1,
        label: `${this.options.label} pronto`,
      });
      this.options.onReady?.(this.options.slot);
      this.playClip("idle", null, 0.01, true);
    } catch (error) {
      console.error(`ThreeRenderer: failed to initialize ${this.options.label} assets.`, error);
      this.ready = false;
      this.emitLoadState({
        ready: false,
        failed: true,
        label: `Falha ao carregar assets ${this.options.label}`,
      });
    }
  }

  private collectRootMotionTargets(scene: THREE.Group) {
    const targets = new Set<string>();
    scene.children.forEach((child) => {
      if (child.name) targets.add(child.name);
    });
    scene.traverse((object) => {
      if (!(object instanceof THREE.Bone)) return;
      const lower = object.name.toLowerCase();
      if (/hips|pelvis|root|armature/.test(lower)) {
        targets.add(object.name);
      }
    });
    return targets;
  }

  private createMasterBinding(rootObject: THREE.Object3D): MasterSkeletonBinding {
    const boneNames = new Set<string>();
    const boneNameByCanonical = new Map<string, string>();
    const rootScaleByBoneName = new Map<string, THREE.Vector3>();

    rootObject.traverse((object) => {
      if (!(object instanceof THREE.Bone)) return;

      boneNames.add(object.name);
      rootScaleByBoneName.set(object.name, object.scale.clone());

      const canonicalName = canonicalizeBoneName(object.name);
      if (!boneNameByCanonical.has(canonicalName)) {
        boneNameByCanonical.set(canonicalName, object.name);
      }
    });

    return {
      rootObject,
      boneNames,
      boneNameByCanonical,
      rootScaleByBoneName,
    };
  }

  private attachTargetHitboxes(rootObject: THREE.Object3D) {
    const scale = Math.max(rootObject.scale.x, 0.0001);
    const toLocal = (value: number) => value / scale;
    const headBone = this.findBoneByAliases(rootObject, HEAD_TARGET_BONE_ALIASES);
    const bodyBone = this.findBoneByAliases(rootObject, BODY_TARGET_BONE_ALIASES);

    if (headBone) {
      const headTarget = this.createInvisibleTargetMesh(
        "head_target",
        new THREE.SphereGeometry(toLocal(0.18), 12, 12),
      );
      headTarget.position.set(0, toLocal(0.04), 0);
      headBone.add(headTarget);
      this.targetHitboxes.head = headTarget;
      console.log(`[Hitbox] ${this.options.label} head_target vinculado ao osso ${headBone.name}.`);
    } else {
      console.warn(`[Hitbox] ${this.options.label} nao encontrou osso Head para head_target.`);
    }

    if (bodyBone) {
      const bodyTarget = this.createInvisibleTargetMesh(
        "body_target",
        new THREE.BoxGeometry(toLocal(0.52), toLocal(0.74), toLocal(0.32)),
      );
      bodyTarget.position.set(0, toLocal(-0.04), 0);
      bodyBone.add(bodyTarget);
      this.targetHitboxes.body = bodyTarget;
      console.log(`[Hitbox] ${this.options.label} body_target vinculado ao osso ${bodyBone.name}.`);
    } else {
      console.warn(`[Hitbox] ${this.options.label} nao encontrou osso Chest/Spine2 para body_target.`);
    }
  }

  private createInvisibleTargetMesh(name: "head_target" | "body_target", geometry: THREE.BufferGeometry) {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.visible = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData = {
      ...mesh.userData,
      targetHitbox: true,
      hitboxName: name,
    };
    return mesh;
  }

  private findBoneByAliases(rootObject: THREE.Object3D, aliases: string[]) {
    const bones: THREE.Bone[] = [];
    rootObject.traverse((object) => {
      if (object instanceof THREE.Bone) {
        bones.push(object);
      }
    });

    const canonicalAliases = aliases.map(canonicalizeBoneName);
    const exact = bones.find((bone) => canonicalAliases.includes(canonicalizeBoneName(bone.name)));
    if (exact) return exact;

    return bones.find((bone) => {
      const canonicalBoneName = canonicalizeBoneName(bone.name);
      return canonicalAliases.some((alias) => canonicalBoneName.includes(alias));
    }) ?? null;
  }

  private extractClip(
    animations: THREE.AnimationClip[],
    clipKey: FighterClipKey,
    rootMotionTargets: Set<string>,
    ignoredSignature: string | null = this.referenceClipSignature,
  ) {
    if (!this.masterBinding) return null;

    const sourceIndex = getPreferredSourceClipIndex(animations, ignoredSignature);
    const source = sourceIndex >= 0 ? animations[sourceIndex] : null;
    if (!source) return null;

    const missingBones = new Set<string>();
    const filteredTracks = source.tracks.flatMap((track) => {
      const remappedTrack = this.remapTrackToMaster(track, rootMotionTargets, missingBones);
      return remappedTrack ? [remappedTrack] : [];
    });

    if (filteredTracks.length === 0) {
      console.error(
        `[Asset System] Clip [${clipKey}] nao encontrou ossos compativeis no esqueleto Master. Ossos ausentes: ${[...missingBones].join(", ") || "nenhum track valido"}.`,
      );
      return null;
    }

    if (missingBones.size > 0) {
      console.error(
        `[Asset System] Clip [${clipKey}] carregado com tracks ignoradas. Ossos ausentes: ${[...missingBones].join(", ")}.`,
      );
    }

    return new THREE.AnimationClip(FIGHTER_CLIP_DEFINITIONS[clipKey].actionName, source.duration, filteredTracks);
  }

  private remapTrackToMaster(
    sourceTrack: THREE.KeyframeTrack,
    rootMotionTargets: Set<string>,
    missingBones: Set<string>,
  ) {
    if (!this.masterBinding) return null;

    const clonedTrack = sourceTrack.clone();
    const { targetPath, property } = splitTrackBinding(clonedTrack.name);
    const sourceBoneCandidates = extractTrackTargetCandidates(targetPath);
    const resolvedBoneName = sourceBoneCandidates.find((candidate) => {
      if (this.masterBinding?.boneNames.has(candidate)) {
        return true;
      }
      const canonicalCandidate = canonicalizeBoneName(candidate);
      return this.masterBinding?.boneNameByCanonical.has(canonicalCandidate);
    });
    const mappedBoneName = resolvedBoneName
      ? (this.masterBinding.boneNames.has(resolvedBoneName)
        ? resolvedBoneName
        : this.masterBinding.boneNameByCanonical.get(canonicalizeBoneName(resolvedBoneName)))
      : null;

    if (!mappedBoneName || !property) {
      missingBones.add(sourceBoneCandidates[0] || clonedTrack.name);
      return null;
    }

    clonedTrack.name = `${mappedBoneName}.${property}`;

    if (property === "scale" && rootMotionTargets.has(mappedBoneName)) {
      const masterScale = this.masterBinding.rootScaleByBoneName.get(mappedBoneName);
      if (masterScale && "values" in clonedTrack && Array.isArray(clonedTrack.values) === false) {
        for (let i = 0; i < clonedTrack.values.length; i += 3) {
          clonedTrack.values[i] = masterScale.x;
          clonedTrack.values[i + 1] = masterScale.y;
          clonedTrack.values[i + 2] = masterScale.z;
        }
      }
    }

    if (this.isRootMotionTrack(clonedTrack.name, rootMotionTargets)) {
      return null;
    }

    return clonedTrack;
  }

  private registerAction(clipKey: FighterClipKey, clip: THREE.AnimationClip | null) {
    if (!clip || !this.mixer || !this.masterBinding) return;

    const action = this.mixer.clipAction(clip, this.masterBinding.rootObject);
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.paused = false;
    action.clampWhenFinished = ONE_SHOT_KEYS.has(clipKey);
    action.setLoop(ONE_SHOT_KEYS.has(clipKey) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    this.actions.set(clipKey, action);
    this.actionKeys.set(action, clipKey);
  }

  private isRootMotionTrack(trackName: string, rootMotionTargets: Set<string>) {
    if (!trackName.endsWith(".position")) return false;
    const nodeName = trackName.split(".")[0] ?? "";
    const lower = nodeName.toLowerCase();
    return rootMotionTargets.has(nodeName) || /armature|root|hips|pelvis/.test(lower);
  }

  private fitModelToScene(model: THREE.Group) {
    const initialBounds = new THREE.Box3().setFromObject(model);
    const initialHeight = initialBounds.max.y - initialBounds.min.y;
    if (initialHeight > 0) {
      const scale = FIGHTER_TARGET_HEIGHT / initialHeight;
      model.scale.setScalar(scale);
    }

    const scaledBounds = new THREE.Box3().setFromObject(model);
    model.position.y = -scaledBounds.min.y;
  }

  private resolveClipKey(fighter: Fighter, gameState: GameState): FighterClipKey {
    if (gameState.gameStatus === "point-scored") {
      return fighter.state === "bow" ? "bow" : "idle";
    }
    if (fighter.state === "bow") return "bow";
    if (fighter.state === "walk-forward" || fighter.state === "walk-backward") return "walk";
    if (fighter.state === "punch") return "kizami_tsuki";
    if (fighter.state === "gyaku-zuki") return "gyaku_zuki";
    if (fighter.state === "kick") return "mawashi_geri";
    if (fighter.state === "mae-geri") return "mae_geri";
    if (fighter.state === "uchi-uke") return "block_high";
    if (fighter.state === "gedan-barai") return "block_low";
    return "idle";
  }

  private getActionTimeScale(clipKey: FighterClipKey, fighter: Fighter, action: THREE.AnimationAction) {
    if (clipKey === "walk") {
      return fighter.state === "walk-backward" ? -1 : 1;
    }
    if (clipKey === "idle" && fighter.fatigueTimer > 0) {
      return 0.78;
    }

    const targetFrames = FIGHTER_CLIP_DEFINITIONS[clipKey].targetFrames;
    if (!targetFrames || action.getClip().duration <= 0) return 1;
    return 1;
  }

  private resolveAttackDurations() {
    const entries = ATTACK_CLIP_KEY_LIST;
    const durations: Partial<Record<"punch" | "gyaku-zuki" | "kick" | "mae-geri", number>> = {};

    entries.forEach((clipKey) => {
      const action = this.actions.get(clipKey);
      const clipDuration = action?.getClip().duration ?? 0;
      const engineKey = FIGHTER_CLIP_DEFINITIONS[clipKey].attackEngineKey;
      if (clipDuration > 0 && engineKey) {
        durations[engineKey] = Math.max(1, Math.round(clipDuration * 60));
      }
    });

    return durations;
  }

  private configureAction(action: THREE.AnimationAction, clipKey: FighterClipKey, fighter: Fighter | null, reset = false) {
    const directionTimeScale = fighter ? this.getActionTimeScale(clipKey, fighter, action) : 1;
    if (reset) {
      action.stop();
      action.reset();
      if (directionTimeScale < 0) {
        action.time = action.getClip().duration;
      }
    }
    action.timeScale = directionTimeScale;
    action.paused = false;
  }

  private playClip(clipKey: FighterClipKey, fighter: Fighter | null, fadeSeconds = DEFAULT_BLEND_SECONDS, force = false) {
    const nextAction = this.actions.get(clipKey);
    if (!nextAction) return;

    if (this.activeKey === clipKey && this.activeAction === nextAction && !force) {
      this.configureAction(nextAction, clipKey, fighter, false);
      return;
    }

    const previousAction = this.activeAction;
    this.configureAction(nextAction, clipKey, fighter, true);
    nextAction.clampWhenFinished = ONE_SHOT_KEYS.has(clipKey);
    nextAction.setLoop(ONE_SHOT_KEYS.has(clipKey) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    nextAction.enabled = true;
    nextAction.play();

    if (previousAction && previousAction !== nextAction) {
      previousAction.crossFadeTo(nextAction, fadeSeconds, false);
      nextAction.crossFadeFrom(previousAction, fadeSeconds, false);
      previousAction.fadeOut(fadeSeconds);
    } else if (previousAction === nextAction && force) {
      nextAction.fadeIn(Math.min(fadeSeconds, 0.05));
    } else if (!previousAction) {
      nextAction.fadeIn(Math.min(fadeSeconds, 0.05));
    }

    this.activeAction = nextAction;
    this.activeKey = clipKey;
  }

  private handleMixerFinished = (event: THREE.Event) => {
    const action = (event as { action?: THREE.AnimationAction }).action;
    if (!action) return;
    const clipKey = this.actionKeys.get(action);
    if (!clipKey) return;

    if (ATTACK_CLIP_KEYS.has(clipKey)) {
      this.requestReturnToStance = true;
      const engineKey = FIGHTER_CLIP_DEFINITIONS[clipKey].attackEngineKey;
      if (engineKey) {
        this.options.onAttackFinished?.(engineKey);
      }
    } else if (clipKey === "block_high" || clipKey === "block_low") {
      this.requestReturnToStance = true;
    }
  };

  update(fighter: Fighter, dtSeconds: number, gameState: GameState) {
    const targetWorldX =
      gameState.gameStatus === "point-scored" || gameState.gameStatus === "bow-in"
        ? this.options.startWorldX
        : toWorldX(fighter.x);

    if (!this.initializedTransform) {
      this.applyWorldTransform(targetWorldX, fighter.facing);
      this.initializedTransform = true;
    } else if (gameState.gameStatus === "point-scored" || gameState.gameStatus === "bow-in") {
      this.root.position.x = THREE.MathUtils.damp(this.root.position.x, targetWorldX, 9, dtSeconds);
      this.root.position.y = 0;
      this.root.position.z = this.depthOffset;
    } else {
      this.applyWorldTransform(targetWorldX, fighter.facing);
    }
    this.root.rotation.y = this.options.getFacingRotationY(fighter.facing);

    if (!this.ready || !this.mixer) {
      const elapsed = performance.now() * 0.001;
      this.fallback.position.y = Math.sin(elapsed * 2.4) * 0.02;
      return;
    }

    const desiredKey = this.resolveClipKey(fighter, gameState);
    const movementChanged = this.lastMovementState !== fighter.state;
    const facingChanged = this.lastFacing !== fighter.facing;
    const shouldForceStance = this.requestReturnToStance && desiredKey === "idle";
    const attackRestarted =
      isAttackState(fighter.state) &&
      fighter.state === this.lastMovementState &&
      fighter.stateTimer > this.lastStateTimer + 0.5;
    const defenseRestarted =
      (fighter.state === "uchi-uke" || fighter.state === "gedan-barai") &&
      fighter.state === this.lastMovementState &&
      fighter.stateTimer > this.lastStateTimer + 0.5;
    const comboTransition =
      isAttackState(fighter.state) &&
      this.activeKey !== null &&
      ATTACK_CLIP_KEYS.has(desiredKey) &&
      ATTACK_CLIP_KEYS.has(this.activeKey) &&
      (desiredKey !== this.activeKey || attackRestarted);
    const fadeSeconds = comboTransition
      ? COMBO_BLEND_SECONDS
      : DEFENSE_CLIP_KEYS.has(desiredKey)
        ? DEFENSE_BLEND_SECONDS
        : DEFAULT_BLEND_SECONDS;

    if (shouldForceStance || desiredKey !== this.activeKey || movementChanged || (desiredKey === "walk" && facingChanged) || attackRestarted || defenseRestarted) {
      this.playClip(desiredKey, fighter, fadeSeconds, shouldForceStance || attackRestarted || defenseRestarted);
      if (desiredKey === "idle") {
        this.requestReturnToStance = false;
      }
    } else if (this.activeAction && this.activeKey) {
      this.configureAction(this.activeAction, this.activeKey, fighter, false);
    }

    this.lastMovementState = fighter.state;
    this.lastFacing = fighter.facing;
    this.lastStateTimer = fighter.stateTimer;
    this.mixer.update(dtSeconds);
  }

  override reset(fighter: Fighter, gameState: GameState) {
    this.requestReturnToStance = false;
    this.lastMovementState = null;
    this.lastFacing = null;
    this.lastStateTimer = 0;
    this.activeAction = null;
    this.activeKey = null;
    this.initializedTransform = false;
    this.mixer?.stopAllAction();
    this.update(fighter, 0, gameState);
  }

  override dispose() {
    if (this.mixer) {
      this.mixer.removeEventListener("finished", this.handleMixerFinished as THREE.EventListener);
      this.mixer.stopAllAction();
    }
    super.dispose();
  }
}

/* Referee visual temporarily disabled until dedicated animations are available.
class RefereeVisual {
  readonly root = new THREE.Group();

  private readonly torsoPivot = new THREE.Group();
  private readonly headPivot = new THREE.Group();
  private readonly leftShoulder = new THREE.Group();
  private readonly rightShoulder = new THREE.Group();
  private readonly leftElbow = new THREE.Group();
  private readonly rightElbow = new THREE.Group();

  constructor() {
    this.root.position.set(0, 0, -2.55);
    this.buildRig();
  }

  private createLimb(length: number, radius: number, material: THREE.Material) {
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 10), material);
    limb.position.y = -length * 0.5;
    return limb;
  }

  private buildRig() {
    const blazerMaterial = new THREE.MeshStandardMaterial({
      color: "#1a2334",
      roughness: 0.8,
      metalness: 0.08,
    });
    const trouserMaterial = new THREE.MeshStandardMaterial({
      color: "#4b5563",
      roughness: 0.84,
      metalness: 0.05,
    });
    const shirtMaterial = new THREE.MeshStandardMaterial({
      color: "#eef2f7",
      roughness: 0.82,
      metalness: 0.02,
    });
    const tieMaterial = new THREE.MeshStandardMaterial({
      color: "#881337",
      roughness: 0.72,
      metalness: 0.04,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: "#d9b79d",
      roughness: 0.92,
      metalness: 0,
    });
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: "#101418",
      roughness: 0.74,
      metalness: 0.1,
    });

    const hip = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.32, 0.34), trouserMaterial);
    hip.position.y = 1.04;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 1.18, 8, 16), blazerMaterial);
    torso.position.y = 1.92;
    const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.04), shirtMaterial);
    shirtPanel.position.set(0, 1.92, 0.27);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.03), tieMaterial);
    tie.position.set(0, 1.78, 0.29);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 18), skinMaterial);
    head.position.y = 2.86;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({
        color: "#16110f",
        roughness: 0.9,
        metalness: 0.02,
      }),
    );
    hair.position.y = 2.93;
    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 1.05, 6, 12), trouserMaterial);
    const rightLeg = leftLeg.clone();
    leftLeg.position.set(-0.16, 0.5, 0);
    rightLeg.position.set(0.16, 0.5, 0);
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.38), shoeMaterial);
    const rightShoe = leftShoe.clone();
    leftShoe.position.set(-0.16, 0.04, 0.08);
    rightShoe.position.set(0.16, 0.04, 0.08);

    const leftUpperArm = this.createLimb(0.72, 0.09, blazerMaterial);
    const rightUpperArm = this.createLimb(0.72, 0.09, blazerMaterial);
    const leftLowerArm = this.createLimb(0.62, 0.075, shirtMaterial);
    const rightLowerArm = this.createLimb(0.62, 0.075, shirtMaterial);
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), skinMaterial);
    const rightHand = leftHand.clone();
    leftHand.position.y = -0.66;
    rightHand.position.y = -0.66;

    this.torsoPivot.position.y = 1.68;
    this.headPivot.position.y = 2.84;
    this.leftShoulder.position.set(-0.42, 2.3, 0);
    this.rightShoulder.position.set(0.42, 2.3, 0);
    this.leftElbow.position.y = -0.76;
    this.rightElbow.position.y = -0.76;

    this.leftElbow.add(leftLowerArm, leftHand);
    this.rightElbow.add(rightLowerArm, rightHand);
    this.leftShoulder.add(leftUpperArm, this.leftElbow);
    this.rightShoulder.add(rightUpperArm, this.rightElbow);

    this.root.add(hip, leftLeg, rightLeg, leftShoe, rightShoe, this.torsoPivot, this.headPivot, this.leftShoulder, this.rightShoulder);
    this.torsoPivot.add(torso, shirtPanel, tie);
    this.headPivot.add(head, hair);

    applyShadowSetup(this.root);
  }

  private applyPose(
    dtSeconds: number,
    options: {
      leftUpperZ: number;
      rightUpperZ: number;
      leftLowerZ: number;
      rightLowerZ: number;
      leftUpperX?: number;
      rightUpperX?: number;
      torsoZ?: number;
      headZ?: number;
      rootY?: number;
    },
  ) {
    this.leftShoulder.rotation.z = THREE.MathUtils.damp(this.leftShoulder.rotation.z, options.leftUpperZ, 9, dtSeconds);
    this.rightShoulder.rotation.z = THREE.MathUtils.damp(this.rightShoulder.rotation.z, options.rightUpperZ, 9, dtSeconds);
    this.leftElbow.rotation.z = THREE.MathUtils.damp(this.leftElbow.rotation.z, options.leftLowerZ, 9, dtSeconds);
    this.rightElbow.rotation.z = THREE.MathUtils.damp(this.rightElbow.rotation.z, options.rightLowerZ, 9, dtSeconds);
    this.leftShoulder.rotation.x = THREE.MathUtils.damp(this.leftShoulder.rotation.x, options.leftUpperX ?? 0, 9, dtSeconds);
    this.rightShoulder.rotation.x = THREE.MathUtils.damp(this.rightShoulder.rotation.x, options.rightUpperX ?? 0, 9, dtSeconds);
    this.torsoPivot.rotation.z = THREE.MathUtils.damp(this.torsoPivot.rotation.z, options.torsoZ ?? 0, 7, dtSeconds);
    this.headPivot.rotation.z = THREE.MathUtils.damp(this.headPivot.rotation.z, options.headZ ?? 0, 7, dtSeconds);
    this.root.position.y = THREE.MathUtils.damp(this.root.position.y, options.rootY ?? 0, 7, dtSeconds);
  }

  update(state: GameState, dtSeconds: number) {
    const midpointX = (toWorldX(state.player.x) + toWorldX(state.opponent.x)) / 2;
    const targetX = THREE.MathUtils.clamp(midpointX * 0.18, -1.1, 1.1);
    const idleShift = state.gameStatus === "point-scored" ? 0.06 : 0;
    this.root.position.x = THREE.MathUtils.damp(this.root.position.x, targetX, 5, dtSeconds);
    this.root.position.z = THREE.MathUtils.damp(this.root.position.z, -2.55, 5, dtSeconds);

    const akaX = toWorldX(state.player.x);
    const aoX = toWorldX(state.opponent.x);
    const pointTargetX = state.judge.side === "aka" ? akaX : state.judge.side === "ao" ? aoX : midpointX;
    const winnerTargetX = state.winner === "player" ? akaX : state.winner === "opponent" ? aoX : midpointX;
    const pointingLeft = pointTargetX < this.root.position.x;
    const winnerLeft = winnerTargetX < this.root.position.x;

    switch (state.judge.state) {
      case "point":
        this.applyPose(dtSeconds, {
          leftUpperZ: pointingLeft ? Math.PI / 2 : 0.1,
          rightUpperZ: pointingLeft ? -0.12 : -Math.PI / 2,
          leftLowerZ: pointingLeft ? 0 : -0.1,
          rightLowerZ: pointingLeft ? 0.08 : 0,
          leftUpperX: 0.15,
          rightUpperX: 0.15,
          torsoZ: pointingLeft ? 0.08 : -0.08,
          headZ: pointingLeft ? 0.1 : -0.1,
          rootY: idleShift,
        });
        break;
      case "hajime":
        this.applyPose(dtSeconds, {
          leftUpperZ: 0.38,
          rightUpperZ: -0.38,
          leftLowerZ: -0.14,
          rightLowerZ: 0.14,
          leftUpperX: -0.52,
          rightUpperX: -0.52,
          rootY: idleShift,
        });
        break;
      case "yame":
        this.applyPose(dtSeconds, {
          leftUpperZ: 0.12,
          rightUpperZ: -0.98,
          leftLowerZ: 0.05,
          rightLowerZ: 0.22,
          rightUpperX: 0.1,
          torsoZ: -0.03,
          headZ: -0.04,
          rootY: idleShift,
        });
        break;
      case "winner":
        this.applyPose(dtSeconds, {
          leftUpperZ: winnerLeft ? Math.PI * 0.72 : 0.08,
          rightUpperZ: winnerLeft ? -0.14 : -Math.PI * 0.72,
          leftLowerZ: winnerLeft ? 0.1 : 0,
          rightLowerZ: winnerLeft ? 0 : -0.1,
          leftUpperX: winnerLeft ? -0.12 : 0,
          rightUpperX: winnerLeft ? 0 : -0.12,
          torsoZ: winnerLeft ? 0.1 : -0.1,
          headZ: winnerLeft ? 0.12 : -0.12,
          rootY: idleShift + 0.03,
        });
        break;
      default:
        this.applyPose(dtSeconds, {
          leftUpperZ: 0.08,
          rightUpperZ: -0.08,
          leftLowerZ: 0,
          rightLowerZ: 0,
          rootY: idleShift,
        });
        break;
    }
  }

  dispose() {
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
  }
}
*/

export default class ThreeRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly clock = new THREE.Clock();
  private readonly fighterVisuals: Record<"player" | "opponent", FighterVisualAdapter>;
  private readonly fighterLoadStates: Record<FighterVisualSlot, ThreeRendererLoadState>;
  private readonly tournamentScoreboard = new TournamentScoreboard();
  // private readonly refereeVisual = new RefereeVisual();
  private readonly pointEffects: ScoreEffect[] = [];
  private readonly burstParticles: BurstParticle[] = [];
  private readonly midpointTarget = new THREE.Vector3(0, LOOK_Y, 0);
  private readonly resizeObserver: ResizeObserver | null;
  private readonly cameraBasePosition = new THREE.Vector3();

  private mountNode: HTMLElement | null = null;
  private previousPointState = {
    gameStatus: "menu" as GameState["gameStatus"],
    playerScore: 0,
    opponentScore: 0,
    hitTimer: 0,
  };
  private cameraShake = {
    duration: 0,
    remaining: 0,
    intensity: 0,
  };
  private hasEmittedReady = false;

  constructor(options?: ThreeRendererOptions) {
    this.scene.background = new THREE.Color("#e7edf3");
    this.scene.fog = new THREE.Fog("#e7edf3", 16, 32);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    (this.renderer as THREE.WebGLRenderer & { outputEncoding?: number }).outputEncoding = 3001;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_Z);
    this.cameraBasePosition.copy(this.camera.position);
    this.camera.lookAt(this.midpointTarget);

    this.setupLights();
    this.setupEnvironment();

    this.fighterLoadStates = {
      player: this.createInitialLoadState("Carregando lutador AKA..."),
      opponent: this.createInitialLoadState("Carregando lutador AO..."),
    };

    this.fighterVisuals = {
      player: new AnimatedFighterVisual({
        slot: "player",
        label: "AKA",
        loadLabel: "Carregando lutador AKA...",
        accentColor: "#d4202a",
        beltColor: "#d4202a",
        bodyColor: "#f9fafb",
        depthOffset: FIGHTER_LANE_Z,
        assetBase: AKA_ASSET_BASE,
        startWorldX: -START_LINE_OFFSET,
        getFacingRotationY: getAkaFacingRotationY,
        onLoadStateChange: (slot, state) => {
          this.handleFighterLoadStateChange(slot, state, options);
        },
        onReady: (slot) => {
          this.handleFighterReady(slot, options);
        },
        onAttackDurationsResolved: options?.onAkaAttackDurationsResolved,
        onAttackFinished: options?.onAkaAttackAnimationComplete,
      }),
      opponent: new AnimatedFighterVisual({
        slot: "opponent",
        label: "AO",
        loadLabel: "Carregando lutador AO...",
        accentColor: "#1f5cd1",
        beltColor: "#1f5cd1",
        bodyColor: "#f9fafb",
        depthOffset: FIGHTER_LANE_Z,
        assetBase: AO_ASSET_BASE,
        startWorldX: START_LINE_OFFSET,
        getFacingRotationY: getAoFacingRotationY,
        onLoadStateChange: (slot, state) => {
          this.handleFighterLoadStateChange(slot, state, options);
        },
        onReady: (slot) => {
          this.handleFighterReady(slot, options);
        },
      }),
    };

    this.scene.add(this.tournamentScoreboard.root, this.fighterVisuals.player.root, this.fighterVisuals.opponent.root);
    // this.scene.add(this.fighterVisuals.player.root, this.fighterVisuals.opponent.root, this.refereeVisual.root);

    this.resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            this.resize();
          })
        : null;

    this.emitCombinedLoadState(options);
  }

  private createInitialLoadState(label: string): ThreeRendererLoadState {
    return {
      ready: false,
      failed: false,
      loaded: 0,
      total: FIGHTER_CLIP_KEYS.length,
      progress: 0,
      label,
    };
  }

  private emitCombinedLoadState(options?: ThreeRendererOptions) {
    const states = Object.values(this.fighterLoadStates);
    const loaded = states.reduce((total, state) => total + state.loaded, 0);
    const total = states.reduce((sum, state) => sum + state.total, 0);
    const ready = states.every((state) => state.ready);
    const failed = states.some((state) => state.failed);
    const firstIncomplete = states.find((state) => !state.ready && !state.failed);
    const firstFailed = states.find((state) => state.failed);
    const label = failed
      ? firstFailed?.label ?? "Falha ao carregar lutadores"
      : ready
        ? "Lutadores prontos"
        : `Carregando lutadores (${loaded}/${total})${firstIncomplete ? ` - ${firstIncomplete.label}` : ""}`;

    options?.onLoadStateChange?.({
      ready,
      failed,
      loaded,
      total,
      progress: total > 0 ? loaded / total : 0,
      label,
    });
  }

  private handleFighterLoadStateChange(
    slot: FighterVisualSlot,
    state: ThreeRendererLoadState,
    options?: ThreeRendererOptions,
  ) {
    this.fighterLoadStates[slot] = state;
    this.emitCombinedLoadState(options);
  }

  private handleFighterReady(slot: FighterVisualSlot, options?: ThreeRendererOptions) {
    this.fighterLoadStates[slot] = {
      ...this.fighterLoadStates[slot],
      ready: true,
      failed: false,
      loaded: this.fighterLoadStates[slot].total,
      progress: 1,
      label: `${slot === "player" ? "AKA" : "AO"} pronto`,
    };
    this.emitCombinedLoadState(options);

    if (!this.hasEmittedReady && Object.values(this.fighterLoadStates).every((state) => state.ready)) {
      this.hasEmittedReady = true;
      options?.onReady?.();
    }
  }

  isReady() {
    return Object.values(this.fighterLoadStates).every((state) => state.ready);
  }

  isAkaReady() {
    return this.isReady();
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight("#ffffff", 0.5));

    const keyLight = new THREE.DirectionalLight("#fff8eb", 1);
    keyLight.position.set(5.5, 10.5, 6.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    keyLight.shadow.bias = -0.0008;
    this.scene.add(keyLight);

    const rim = new THREE.DirectionalLight("#d5e9ff", 0.35);
    rim.position.set(-7, 5, -8);
    this.scene.add(rim);
  }

  private setupEnvironment() {
    const tatamiNormalMap = createEvaNormalMap();
    const outerTatamiMaterial = new THREE.MeshStandardMaterial({
      color: "#C8102E",
      roughness: 0.88,
      metalness: 0.02,
      normalMap: tatamiNormalMap,
      normalScale: new THREE.Vector2(0.26, 0.26),
    });
    const innerTatamiMaterial = new THREE.MeshStandardMaterial({
      color: "#0055A4",
      roughness: 0.88,
      metalness: 0.02,
      normalMap: tatamiNormalMap.clone(),
      normalScale: new THREE.Vector2(0.3, 0.3),
    });
    innerTatamiMaterial.normalMap?.repeat.set(8, 8);

    const outerTatami = new THREE.Mesh(
      new THREE.BoxGeometry(WKF_TOTAL_SIZE_METERS, 0.18, WKF_TOTAL_SIZE_METERS),
      outerTatamiMaterial,
    );
    outerTatami.position.y = -0.09;
    outerTatami.receiveShadow = true;
    this.scene.add(outerTatami);

    const innerTatami = new THREE.Mesh(
      new THREE.BoxGeometry(COMPETITION_AREA_SIZE, 0.1, COMPETITION_AREA_SIZE),
      innerTatamiMaterial,
    );
    innerTatami.position.y = -0.03;
    innerTatami.receiveShadow = true;
    this.scene.add(innerTatami);

    const createStartLine = (color: string, x: number) => {
      const lineGroup = new THREE.Group();

      const outline = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.01, START_LINE_LENGTH + 0.06),
        new THREE.MeshStandardMaterial({
          color: "#f8fafc",
          roughness: 0.9,
          metalness: 0,
        }),
      );
      outline.receiveShadow = true;

      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.012, START_LINE_LENGTH),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.84,
          metalness: 0.01,
        }),
      );
      line.position.y = 0.002;
      line.receiveShadow = true;

      lineGroup.position.set(x, 0.024, 0);
      lineGroup.add(outline, line);
      this.scene.add(lineGroup);
    };

    createStartLine("#C8102E", -START_LINE_OFFSET);
    createStartLine("#C8102E", START_LINE_OFFSET);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 10),
      new THREE.MeshStandardMaterial({
        color: "#eef3f7",
        roughness: 0.95,
      }),
    );
    backWall.position.set(0, 4.4, -7.6);
    this.scene.add(backWall);
  }

  attach(element: HTMLElement) {
    this.mountNode = element;
    this.mountNode.innerHTML = "";
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.mountNode.appendChild(canvas);
    this.resizeObserver?.observe(this.mountNode);
    this.resize();
  }

  getDeltaSeconds() {
    return Math.min(this.clock.getDelta(), 1 / 20);
  }

  private triggerCameraShake(duration: number, intensity: number) {
    this.cameraShake.duration = duration;
    this.cameraShake.remaining = duration;
    this.cameraShake.intensity = intensity;
  }

  private updateCamera(state: GameState, dtSeconds: number) {
    const midpointX = (toWorldX(state.player.x) + toWorldX(state.opponent.x)) / 2;
    this.midpointTarget.set(midpointX, LOOK_Y, 0);

    this.cameraBasePosition.x = THREE.MathUtils.damp(this.cameraBasePosition.x, midpointX, 5, dtSeconds);
    this.cameraBasePosition.y = THREE.MathUtils.damp(this.cameraBasePosition.y, CAMERA_HEIGHT, 5, dtSeconds);
    this.cameraBasePosition.z = THREE.MathUtils.damp(this.cameraBasePosition.z, CAMERA_Z, 5, dtSeconds);

    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShake.remaining > 0 && this.cameraShake.duration > 0) {
      this.cameraShake.remaining = Math.max(0, this.cameraShake.remaining - dtSeconds);
      const elapsed = this.cameraShake.duration - this.cameraShake.remaining;
      const decay = this.cameraShake.remaining / this.cameraShake.duration;
      const amplitude = this.cameraShake.intensity * decay;
      shakeX = (Math.sin(elapsed * 70) + Math.sin(elapsed * 131) * 0.45) * amplitude;
      shakeY = (Math.cos(elapsed * 82) + Math.sin(elapsed * 97) * 0.35) * amplitude * 0.55;
    }

    this.camera.position.set(
      this.cameraBasePosition.x + shakeX,
      this.cameraBasePosition.y + shakeY,
      this.cameraBasePosition.z,
    );
    this.camera.lookAt(this.midpointTarget);
  }

  private spawnHitBurst(state: GameState) {
    if (!state.hitEffect) return;

    const origin = new THREE.Vector3(
      toWorldX(state.hitEffect.x),
      Math.max(1.35, toWorldY(state.hitEffect.y) + 1.2),
      0,
    );
    const color = state.hitEffect.type === "kick" ? "#ff9f43" : "#f8fafc";

    for (let i = 0; i < 8; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.45,
          roughness: 0.3,
        }),
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      this.burstParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(1.4),
          THREE.MathUtils.randFloat(0.6, 1.4),
          THREE.MathUtils.randFloatSpread(0.5),
        ),
        life: 0.35,
      });
    }
  }

  private spawnScoreEffect(label: ScoreCall, x: number) {
    const sprite = createTextSprite(`${label}!`, SCORE_COLORS[label]);
    sprite.position.set(toWorldX(x), 3.2, 0);
    this.scene.add(sprite);
    this.pointEffects.push({
      sprite,
      life: 1.25,
      velocityY: 0.95,
    });
  }

  private updateTransientEffects(dtSeconds: number) {
    for (let i = this.pointEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.pointEffects[i];
      effect.life -= dtSeconds;
      effect.sprite.position.y += effect.velocityY * dtSeconds;
      const material = effect.sprite.material;
      if (material instanceof THREE.SpriteMaterial) {
        material.opacity = Math.max(0, effect.life / 1.25);
      }
      if (effect.life <= 0) {
        this.scene.remove(effect.sprite);
        if (effect.sprite.material instanceof THREE.SpriteMaterial) {
          effect.sprite.material.map?.dispose();
          effect.sprite.material.dispose();
        }
        this.pointEffects.splice(i, 1);
      }
    }

    for (let i = this.burstParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.burstParticles[i];
      particle.life -= dtSeconds;
      particle.mesh.position.addScaledVector(particle.velocity, dtSeconds);
      particle.velocity.y -= 2.6 * dtSeconds;
      particle.mesh.scale.setScalar(Math.max(0.1, particle.life * 2));
      const material = particle.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.opacity = Math.max(0, particle.life / 0.35);
        material.transparent = true;
      }
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        disposeMaterial(particle.mesh.material);
        this.burstParticles.splice(i, 1);
      }
    }
  }

  private trackScoringTransitions(state: GameState) {
    const justScored = state.gameStatus === "point-scored" && this.previousPointState.gameStatus !== "point-scored";
    if (justScored) {
      const playerDelta = state.player.score - this.previousPointState.playerScore;
      const opponentDelta = state.opponent.score - this.previousPointState.opponentScore;
      const delta = Math.max(playerDelta, opponentDelta);
      const scoreCall = delta >= 3 ? "IPPON" : delta === 2 ? "WAZA-ARI" : "YUKO";
      this.spawnScoreEffect(scoreCall, playerDelta > 0 ? state.player.x : state.opponent.x);
      this.tournamentScoreboard.triggerScorePulse(playerDelta > 0 ? "player" : "opponent");
      if (scoreCall === "IPPON") {
        this.triggerCameraShake(0.28, 0.16);
      }
    }

    if (state.hitEffect && state.hitEffect.timer > 0 && this.previousPointState.hitTimer === 0) {
      this.spawnHitBurst(state);
    }

    this.previousPointState = {
      gameStatus: state.gameStatus,
      playerScore: state.player.score,
      opponentScore: state.opponent.score,
      hitTimer: state.hitEffect?.timer ?? 0,
    };
  }

  private clearTransientEffects() {
    this.pointEffects.forEach((effect) => {
      this.scene.remove(effect.sprite);
      if (effect.sprite.material instanceof THREE.SpriteMaterial) {
        effect.sprite.material.map?.dispose();
        effect.sprite.material.dispose();
      }
    });
    this.pointEffects.length = 0;

    this.burstParticles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      disposeMaterial(particle.mesh.material);
    });
    this.burstParticles.length = 0;
  }

  render(state: GameState, dtSeconds: number) {
    this.trackScoringTransitions(state);
    this.tournamentScoreboard.update(state, dtSeconds);
    this.fighterVisuals.player.update(state.player, dtSeconds, state);
    this.fighterVisuals.opponent.update(state.opponent, dtSeconds, state);
    // this.refereeVisual.update(state, dtSeconds);
    this.updateCamera(state, dtSeconds);
    this.updateTransientEffects(dtSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  reset(state: GameState) {
    this.clearTransientEffects();
    this.cameraShake.duration = 0;
    this.cameraShake.remaining = 0;
    this.cameraShake.intensity = 0;
    this.fighterVisuals.player.reset(state.player, state);
    this.fighterVisuals.opponent.reset(state.opponent, state);
    this.tournamentScoreboard.reset(state);
    this.previousPointState = {
      gameStatus: state.gameStatus,
      playerScore: state.player.score,
      opponentScore: state.opponent.score,
      hitTimer: state.hitEffect?.timer ?? 0,
    };
    this.clock.getDelta();
    this.render(state, 0);
  }

  resize() {
    if (!this.mountNode) return;
    const bounds = this.mountNode.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || this.mountNode.clientWidth));
    const height = Math.max(1, Math.round(bounds.height || this.mountNode.clientHeight || width * (9 / 16)));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.fighterVisuals.player.dispose();
    this.fighterVisuals.opponent.dispose();
    this.tournamentScoreboard.dispose();
    // this.refereeVisual.dispose();
    this.clearTransientEffects();
    this.renderer.dispose();
    this.mountNode?.replaceChildren();
  }
}
