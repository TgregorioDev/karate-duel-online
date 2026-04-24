import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { Fighter, FighterState, GameState, ScoreCall } from "@/game/types";
import {
  CANVAS_WIDTH,
  FIGHTER_HEIGHT,
  GROUND_Y,
  HIT_STUN_FRAMES,
  KICK_DURATION_FRAMES,
  MAE_GERI_DURATION_FRAMES,
  PARRY_DEFENSE_DURATION_FRAMES,
  PUNCH_DURATION_FRAMES,
  GYAKU_ZUKI_DURATION_FRAMES,
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

type FighterAsset = {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
};

const WORLD_WIDTH = 12;
const WORLD_HEIGHT_SCALE = 0.02;
const WORLD_HALF_WIDTH = WORLD_WIDTH / 2;
const CAMERA_HEIGHT = 4.6;
const CAMERA_Z = 7.4;
const LOOK_Y = 1.65;
const DEFAULT_FIGHTER_MODEL_URL = "/models/karate-fighter.glb";

const SCORE_COLORS: Record<ScoreCall, string> = {
  YUKO: "#f6f3cf",
  "WAZA-ARI": "#ffd166",
  IPPON: "#ff5d5d",
};

const ANIMATION_TRACKS = {
  idle: ["idle"],
  kizami_tsuki: ["kizami_tsuki", "kizami-tsuki", "punch"],
  gyaku_zuki: ["gyaku_zuki", "gyaku-zuki"],
  mae_geri: ["mae_geri", "mae-geri"],
  kick_ippon: ["kick_ippon", "kick-ippon", "kick"],
  block: ["block"],
  hit: ["hit"],
  uchi_uke: ["uchi_uke", "uchi-uke"],
  gedan_barai: ["gedan_barai", "gedan-barai"],
  exhausted: ["exhausted"],
} as const;

const TARGET_ANIMATION_FRAMES: Partial<Record<FighterState, number>> = {
  punch: PUNCH_DURATION_FRAMES,
  kick: KICK_DURATION_FRAMES,
  "gyaku-zuki": GYAKU_ZUKI_DURATION_FRAMES,
  "mae-geri": MAE_GERI_DURATION_FRAMES,
  hit: HIT_STUN_FRAMES,
  "uchi-uke": PARRY_DEFENSE_DURATION_FRAMES,
  "gedan-barai": PARRY_DEFENSE_DURATION_FRAMES,
};

function normalizeClipName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function toWorldX(engineX: number) {
  return (engineX / CANVAS_WIDTH) * WORLD_WIDTH - WORLD_HALF_WIDTH;
}

function toWorldY(engineY: number) {
  return (GROUND_Y - engineY) * WORLD_HEIGHT_SCALE;
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

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function applyShadowSetup(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

class FighterVisual {
  private static assetPromise: Promise<FighterAsset | null> | null = null;
  private static assetWarningShown = false;

  readonly root = new THREE.Group();

  private readonly modelRoot = new THREE.Group();
  private readonly placeholder = new THREE.Group();
  private readonly labelAnchor = new THREE.Group();
  private readonly labelSprite: THREE.Sprite;
  private readonly actionMap = new Map<string, THREE.AnimationAction>();
  private mixer: THREE.AnimationMixer | null = null;
  private currentActionName = "";
  private lastFighterState: FighterState | null = null;

  constructor(
    private readonly options: {
      bodyColor: string;
      accentColor: string;
      beltColor: string;
      label: string;
      depthOffset: number;
      fighterModelUrl?: string | null;
    },
  ) {
    this.root.add(this.modelRoot);
    this.root.add(this.placeholder);
    this.root.add(this.labelAnchor);
    this.root.position.y = (FIGHTER_HEIGHT * WORLD_HEIGHT_SCALE) / 2;
    this.labelSprite = createTextSprite(this.options.label, "#f8fafc", {
      background: "rgba(9, 18, 28, 0.72)",
      borderColor: this.options.accentColor,
      fontSize: 84,
      scale: new THREE.Vector2(2.45, 0.98),
    });
    this.labelAnchor.position.set(0, 3.02, 0);
    this.labelAnchor.add(this.labelSprite);
    this.buildPlaceholder();
    this.loadModel();
  }

  private static async loadSharedAsset(modelUrl: string) {
    if (!this.assetPromise) {
      const loader = new GLTFLoader();
      this.assetPromise = loader
        .loadAsync(modelUrl)
        .then((gltf) => ({
          scene: gltf.scene,
          clips: gltf.animations,
        }))
        .catch((error) => {
          if (!this.assetWarningShown) {
            console.warn(`ThreeRenderer: failed to load fighter GLB at ${modelUrl}. Using placeholders.`, error);
            this.assetWarningShown = true;
          }
          return null;
        });
    }
    return this.assetPromise;
  }

  private buildPlaceholder() {
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
    const footLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.36), accentMaterial);
    const footRight = footLeft.clone();
    footLeft.position.set(-0.18, 0.08, 0.12);
    footRight.position.set(0.18, 0.08, 0.12);

    this.placeholder.add(body, head, belt, gloveLeft, gloveRight, footLeft, footRight);
    applyShadowSetup(this.placeholder);
  }

  private async loadModel() {
    const modelUrl = this.options.fighterModelUrl ?? DEFAULT_FIGHTER_MODEL_URL;
    const asset = await FighterVisual.loadSharedAsset(modelUrl);
    if (!asset) return;

    const model = clone(asset.scene) as THREE.Group;
    applyShadowSetup(model);

    this.modelRoot.add(model);
    this.placeholder.visible = false;
    this.mixer = new THREE.AnimationMixer(model);

    asset.clips.forEach((clip) => {
      this.actionMap.set(normalizeClipName(clip.name), this.mixer!.clipAction(clip));
    });
    this.playAnimation("idle", 0.01);
  }

  private findAction(trackName: keyof typeof ANIMATION_TRACKS) {
    const aliases = ANIMATION_TRACKS[trackName];
    for (const alias of aliases) {
      const action = this.actionMap.get(normalizeClipName(alias));
      if (action) return action;
    }
    return null;
  }

  private getAnimationKey(state: FighterState, exhausted: boolean): keyof typeof ANIMATION_TRACKS {
    if (exhausted) return "exhausted";
    switch (state) {
      case "punch":
        return "kizami_tsuki";
      case "gyaku-zuki":
        return "gyaku_zuki";
      case "mae-geri":
        return "mae_geri";
      case "kick":
        return "kick_ippon";
      case "block":
        return "block";
      case "hit":
        return "hit";
      case "uchi-uke":
        return "uchi_uke";
      case "gedan-barai":
        return "gedan_barai";
      default:
        return "idle";
    }
  }

  private getAnimationTimeScale(state: FighterState, action: THREE.AnimationAction) {
    const clip = action.getClip();
    const targetFrames = TARGET_ANIMATION_FRAMES[state];
    if (!targetFrames || clip.duration <= 0) return 1;
    return clip.duration / (targetFrames / 60);
  }

  private playAnimation(trackName: keyof typeof ANIMATION_TRACKS, fadeDuration: number, state?: FighterState) {
    const next = this.findAction(trackName);
    if (!next) return;
    if (this.currentActionName === trackName) {
      if (state) next.timeScale = this.getAnimationTimeScale(state, next);
      return;
    }

    next.reset();
    next.enabled = true;
    next.clampWhenFinished = trackName !== "idle" && trackName !== "block";
    next.setLoop(trackName === "idle" || trackName === "block" ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.fadeIn(fadeDuration).play();
    next.timeScale = state ? this.getAnimationTimeScale(state, next) : 1;

    if (this.currentActionName) {
      const previous = this.findAction(this.currentActionName as keyof typeof ANIMATION_TRACKS);
      previous?.fadeOut(fadeDuration);
    }
    this.currentActionName = trackName;
  }

  private animatePlaceholder(fighter: Fighter, dtSeconds: number) {
    const moving = fighter.state === "walk-forward" || fighter.state === "walk-backward";
    const bobSpeed = moving ? 8 : 2.4;
    const bobAmount = moving ? 0.05 : 0.02;
    const elapsed = performance.now() * 0.001;
    this.placeholder.position.y = Math.sin(elapsed * bobSpeed) * bobAmount;

    let targetPitch = 0;
    if (fighter.state === "bow") targetPitch = -0.6;
    if (fighter.state === "block") targetPitch = 0.18;
    if (fighter.state === "kick" || fighter.state === "mae-geri") targetPitch = -0.25;
    if (fighter.state === "hit") targetPitch = 0.35;
    this.placeholder.rotation.z = THREE.MathUtils.damp(this.placeholder.rotation.z, targetPitch, 10, dtSeconds);

    const targetYaw = fighter.facing === "right" ? -Math.PI / 2 : Math.PI / 2;
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 10, dtSeconds);

    const attackStretch =
      fighter.state === "punch" || fighter.state === "gyaku-zuki" || fighter.state === "kick" || fighter.state === "mae-geri"
        ? 1.1
        : 1;
    this.placeholder.scale.x = THREE.MathUtils.damp(this.placeholder.scale.x, attackStretch, 8, dtSeconds);
  }

  update(fighter: Fighter, dtSeconds: number) {
    this.root.position.x = THREE.MathUtils.damp(this.root.position.x, toWorldX(fighter.x), 14, dtSeconds);
    this.root.position.z = this.options.depthOffset;
    this.root.position.y = (FIGHTER_HEIGHT * WORLD_HEIGHT_SCALE) / 2;

    if (this.mixer) {
      const animationKey = this.getAnimationKey(fighter.state, fighter.exhausted > 0);
      if (fighter.state !== this.lastFighterState || animationKey !== (this.currentActionName as keyof typeof ANIMATION_TRACKS)) {
        this.playAnimation(animationKey, 0.08, fighter.state);
      } else if (TARGET_ANIMATION_FRAMES[fighter.state]) {
        const action = this.findAction(animationKey);
        if (action) action.timeScale = this.getAnimationTimeScale(fighter.state, action);
      }

      const targetYaw = fighter.facing === "right" ? -Math.PI / 2 : Math.PI / 2;
      this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 10, dtSeconds);
      this.mixer.update(dtSeconds);
    } else {
      this.animatePlaceholder(fighter, dtSeconds);
    }

    this.lastFighterState = fighter.state;
  }

  dispose() {
    this.mixer?.stopAllAction();
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

export default class ThreeRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly clock = new THREE.Clock();
  private readonly fighterVisuals: Record<"player" | "opponent", FighterVisual>;
  private readonly refereeVisual = new RefereeVisual();
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

  constructor(options?: { fighterModelUrl?: string | null }) {
    this.scene.background = new THREE.Color("#e7edf3");
    this.scene.fog = new THREE.Fog("#e7edf3", 16, 32);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Modern Three.js uses outputColorSpace; keep the legacy property aligned for older integrations.
    (this.renderer as THREE.WebGLRenderer & { outputEncoding?: number }).outputEncoding = 3001;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(0, CAMERA_HEIGHT, CAMERA_Z);
    this.cameraBasePosition.copy(this.camera.position);
    this.camera.lookAt(this.midpointTarget);

    this.setupLights();
    this.setupEnvironment();

    this.fighterVisuals = {
      player: new FighterVisual({
        bodyColor: "#f9fafb",
        accentColor: "#d4202a",
        beltColor: "#d4202a",
        label: "AKA",
        depthOffset: 0.62,
        fighterModelUrl: options?.fighterModelUrl,
      }),
      opponent: new FighterVisual({
        bodyColor: "#f9fafb",
        accentColor: "#1f5cd1",
        beltColor: "#1f5cd1",
        label: "AO",
        depthOffset: -0.62,
        fighterModelUrl: options?.fighterModelUrl,
      }),
    };
    this.scene.add(this.fighterVisuals.player.root, this.fighterVisuals.opponent.root, this.refereeVisual.root);

    this.resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            this.resize();
          })
        : null;
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
    const outerTatami = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.2, 12),
      new THREE.MeshStandardMaterial({
        color: "#a2242b",
        roughness: 0.8,
        metalness: 0.05,
      }),
    );
    outerTatami.position.y = -0.1;
    outerTatami.receiveShadow = true;
    this.scene.add(outerTatami);

    const innerTatami = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.12, 8),
      new THREE.MeshStandardMaterial({
        color: "#2563a6",
        roughness: 0.8,
        metalness: 0.04,
      }),
    );
    innerTatami.position.y = -0.02;
    innerTatami.receiveShadow = true;
    this.scene.add(innerTatami);

    const ringLine = new THREE.Mesh(
      new THREE.RingGeometry(4.06, 4.14, 64),
      new THREE.MeshStandardMaterial({
        color: "#e6eef9",
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    ringLine.rotation.x = -Math.PI / 2;
    ringLine.position.y = 0.01;
    this.scene.add(ringLine);

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
    this.mountNode.appendChild(this.renderer.domElement);
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
    const sprite = createTextSprite(label, SCORE_COLORS[label]);
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

  render(state: GameState, dtSeconds: number) {
    this.trackScoringTransitions(state);
    this.fighterVisuals.player.update(state.player, dtSeconds);
    this.fighterVisuals.opponent.update(state.opponent, dtSeconds);
    this.refereeVisual.update(state, dtSeconds);
    this.updateCamera(state, dtSeconds);
    this.updateTransientEffects(dtSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    if (!this.mountNode) return;
    const width = Math.max(1, this.mountNode.clientWidth);
    const height = Math.max(1, this.mountNode.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.fighterVisuals.player.dispose();
    this.fighterVisuals.opponent.dispose();
    this.refereeVisual.dispose();
    this.pointEffects.forEach((effect) => {
      this.scene.remove(effect.sprite);
      if (effect.sprite.material instanceof THREE.SpriteMaterial) {
        effect.sprite.material.map?.dispose();
        effect.sprite.material.dispose();
      }
    });
    this.burstParticles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      disposeMaterial(particle.mesh.material);
    });
    this.renderer.dispose();
    this.mountNode?.replaceChildren();
  }
}
