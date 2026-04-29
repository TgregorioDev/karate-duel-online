import { startTransition, useEffect, useRef, useState } from "react";

import IntroScreen from "@/components/game-ui/IntroScreen";
import PauseModal from "@/components/game-ui/PauseModal";
import ResultModal from "@/components/game-ui/ResultModal";
import { GameUiProvider, useGameUi } from "@/components/game-ui/GameUiContext";
import {
  createInitialState,
  resetAttackAnimationDurations,
  setAttackAnimationDurations,
  setPaused,
  startBowIn,
  updateGame,
} from "@/game/engine";
import InputManager from "@/game/InputManager";
import ThreeRenderer, { type ThreeRendererLoadState } from "@/game/ThreeRenderer";
import {
  GYAKU_ZUKI_COST,
  KICK_COST,
  MAE_GERI_COST,
  type AIProfile,
  type Fighter,
  type GameMode,
  type GameState,
  type InputState,
  PUNCH_COST,
  STAMINA_MAX,
} from "@/game/types";

type HudState = {
  playerScore: number;
  opponentScore: number;
  playerStamina: number;
  opponentStamina: number;
  playerStaminaFlash: number;
  opponentStaminaFlash: number;
  playerFatigueTimer: number;
  opponentFatigueTimer: number;
  timeRemaining: number;
  judgeMessage: string;
  status: GameState["gameStatus"];
  winner: GameState["winner"];
  paused: boolean;
  finished: boolean;
  gameMode: GameMode;
  aiProfile: AIProfile;
};

type AttackState = "punch" | "gyaku-zuki" | "kick" | "mae-geri";

const COMBO_CANCEL_COST_MULTIPLIER = 0.8;
const ATTACK_INPUT_COSTS: Record<AttackState, number> = {
  punch: PUNCH_COST,
  "gyaku-zuki": GYAKU_ZUKI_COST,
  kick: KICK_COST,
  "mae-geri": MAE_GERI_COST,
};

const INITIAL_LOAD_STATE: ThreeRendererLoadState = {
  ready: false,
  failed: false,
  loaded: 0,
  total: 18,
  progress: 0,
  label: "Carregando lutadores...",
};

function makeHudSnapshot(state: GameState): HudState {
  return {
    playerScore: state.player.score,
    opponentScore: state.opponent.score,
    playerStamina: state.player.stamina,
    opponentStamina: state.opponent.stamina,
    playerStaminaFlash: state.player.staminaFlash,
    opponentStaminaFlash: state.opponent.staminaFlash,
    playerFatigueTimer: state.player.fatigueTimer,
    opponentFatigueTimer: state.opponent.fatigueTimer,
    timeRemaining: state.timeRemaining,
    judgeMessage: state.judgeMessage,
    status: state.gameStatus,
    winner: state.winner,
    paused: state.paused,
    finished: state.finished,
    gameMode: state.gameMode,
    aiProfile: state.aiProfile,
  };
}

function isAttackState(state: string): state is AttackState {
  return state === "punch" || state === "gyaku-zuki" || state === "kick" || state === "mae-geri";
}

function getQueuedAttack(input: InputState): AttackState | null {
  if (input.maeGeri) return "mae-geri";
  if (input.kick) return "kick";
  if (input.gyakuZuki) return "gyaku-zuki";
  if (input.punch) return "punch";
  return null;
}

function primeComboCancel(fighter: Fighter, input: InputState) {
  const queuedAttack = getQueuedAttack(input);
  if (!queuedAttack) return;

  if (fighter.fatigueTimer > 0) return;
  if (!isAttackState(fighter.state) || fighter.stateTimer <= 1) return;

  const comboCost = ATTACK_INPUT_COSTS[queuedAttack] * COMBO_CANCEL_COST_MULTIPLIER;
  if (fighter.stamina < comboCost) return;

  fighter.stateTimer = Math.min(fighter.stateTimer, 1);
}

function createMatchState(gameMode: GameMode, aiProfile: AIProfile) {
  const fresh = createInitialState(gameMode, aiProfile);
  startBowIn(fresh);
  return fresh;
}

function KarateGameScene() {
  const { activeOverlay, moveListOpen, syncFromGame, openMoveList, closeMoveList } = useGameUi();
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRendererRef = useRef<ThreeRenderer | null>(null);
  const gameStateRef = useRef<GameState>(createInitialState());
  const loadStateRef = useRef<ThreeRendererLoadState>(INITIAL_LOAD_STATE);
  const queuedStartRef = useRef(false);
  const queuedGameModeRef = useRef<GameMode>("player-vs-ai");
  const queuedAIProfileRef = useRef<AIProfile>("dan");
  const inputManagerRef = useRef(new InputManager());
  const animFrameRef = useRef<number>(0);
  const hudRef = useRef<HudState>(makeHudSnapshot(gameStateRef.current));
  const [hudState, setHudState] = useState<HudState>(hudRef.current);
  const [loadState, setLoadState] = useState<ThreeRendererLoadState>(INITIAL_LOAD_STATE);
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>("player-vs-ai");
  const [selectedAIProfile, setSelectedAIProfile] = useState<AIProfile>("dan");
  const [transientJudgeMessage, setTransientJudgeMessage] = useState("");

  const syncHud = (state: GameState) => {
    const next = makeHudSnapshot(state);
    const previous = hudRef.current;
    const changed =
      previous.playerScore !== next.playerScore ||
      previous.opponentScore !== next.opponentScore ||
      Math.floor(previous.playerStamina) !== Math.floor(next.playerStamina) ||
      Math.floor(previous.opponentStamina) !== Math.floor(next.opponentStamina) ||
      Math.ceil(previous.playerStaminaFlash) !== Math.ceil(next.playerStaminaFlash) ||
      Math.ceil(previous.opponentStaminaFlash) !== Math.ceil(next.opponentStaminaFlash) ||
      Math.ceil(previous.playerFatigueTimer) !== Math.ceil(next.playerFatigueTimer) ||
      Math.ceil(previous.opponentFatigueTimer) !== Math.ceil(next.opponentFatigueTimer) ||
      Math.ceil(previous.timeRemaining) !== Math.ceil(next.timeRemaining) ||
      previous.judgeMessage !== next.judgeMessage ||
      previous.status !== next.status ||
      previous.winner !== next.winner ||
      previous.paused !== next.paused ||
      previous.finished !== next.finished ||
      previous.gameMode !== next.gameMode ||
      previous.aiProfile !== next.aiProfile;

    if (changed) {
      hudRef.current = next;
      startTransition(() => {
        setHudState(next);
      });
    }
  };

  const syncUi = (state: GameState) => {
    syncFromGame({
      gameStatus: state.gameStatus,
      paused: state.paused,
      finished: state.finished,
    });
  };

  const applyGameState = (state: GameState, resetRenderer = false) => {
    gameStateRef.current = state;
    syncHud(state);
    syncUi(state);
    if (resetRenderer) {
      threeRendererRef.current?.reset(state);
    }
  };

  const selectGameMode = (mode: GameMode) => {
    setSelectedGameMode(mode);
    queuedGameModeRef.current = mode;
    const current = gameStateRef.current;
    if (current.gameStatus === "menu") {
      current.gameMode = mode;
      syncHud(current);
    }
  };

  const selectAIProfile = (profile: AIProfile) => {
    setSelectedAIProfile(profile);
    queuedAIProfileRef.current = profile;
    const current = gameStateRef.current;
    if (current.gameStatus === "menu") {
      current.aiProfile = profile;
      syncHud(current);
    }
  };

  const startMatch = (mode: GameMode = queuedGameModeRef.current, aiProfile: AIProfile = queuedAIProfileRef.current) => {
    if (!loadStateRef.current.ready) {
      queuedStartRef.current = true;
      queuedGameModeRef.current = mode;
      queuedAIProfileRef.current = aiProfile;
      return;
    }
    queuedStartRef.current = false;
    queuedGameModeRef.current = mode;
    queuedAIProfileRef.current = aiProfile;
    inputManagerRef.current.clearAllInputs();
    closeMoveList();
    setSelectedGameMode(mode);
    setSelectedAIProfile(aiProfile);
    applyGameState(createMatchState(mode, aiProfile), true);
  };

  const returnToMenu = () => {
    const mode = gameStateRef.current.gameMode;
    const aiProfile = gameStateRef.current.aiProfile;
    queuedStartRef.current = false;
    queuedGameModeRef.current = mode;
    queuedAIProfileRef.current = aiProfile;
    inputManagerRef.current.clearAllInputs();
    closeMoveList();
    setSelectedGameMode(mode);
    setSelectedAIProfile(aiProfile);
    applyGameState(createInitialState(mode, aiProfile), true);
  };

  const restartMatch = () => {
    const mode = gameStateRef.current.gameMode;
    const aiProfile = gameStateRef.current.aiProfile;
    queuedStartRef.current = false;
    queuedGameModeRef.current = mode;
    queuedAIProfileRef.current = aiProfile;
    inputManagerRef.current.clearAllInputs();
    closeMoveList();
    setSelectedGameMode(mode);
    setSelectedAIProfile(aiProfile);
    applyGameState(createMatchState(mode, aiProfile), true);
  };

  const togglePause = () => {
    const current = gameStateRef.current;
    if (current.gameStatus === "menu" || current.finished) return;
    setPaused(current, !current.paused);
    if (current.paused) {
      closeMoveList();
    } else {
      inputManagerRef.current.clearAllInputs();
    }
    syncHud(current);
    syncUi(current);
    threeRendererRef.current?.render(current, 0);
  };

  const resumeMatch = () => {
    const current = gameStateRef.current;
    if (!current.paused) return;
    setPaused(current, false);
    closeMoveList();
    syncHud(current);
    syncUi(current);
    threeRendererRef.current?.render(current, 0);
  };

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    const threeRenderer = new ThreeRenderer({
      onLoadStateChange: (nextState) => {
        loadStateRef.current = nextState;
        startTransition(() => {
          setLoadState(nextState);
        });

        if (nextState.ready && queuedStartRef.current) {
          queuedStartRef.current = false;
          startMatch(queuedGameModeRef.current, queuedAIProfileRef.current);
        }
      },
      onReady: () => {
        loadStateRef.current = { ...loadStateRef.current, ready: true, failed: false, progress: 1 };
      },
      onAkaAttackDurationsResolved: (durations) => {
        setAttackAnimationDurations(durations);
      },
      onAkaAttackAnimationComplete: () => {
        const current = gameStateRef.current;
        const player = current.player;
        if (current.gameStatus !== "fighting") return;
        if (!["punch", "gyaku-zuki", "kick", "mae-geri"].includes(player.state)) return;
        if (player.stateTimer > 1) return;
        player.state = "idle";
        player.stateTimer = 0;
      },
    });
    threeRendererRef.current = threeRenderer;
    threeRenderer.attach(mountNode);
    threeRenderer.render(gameStateRef.current, 0);
    syncUi(gameStateRef.current);
    syncHud(gameStateRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = gameStateRef.current;
      const key = e.key.toLowerCase();

      if (key === "escape") {
        if (current.gameStatus !== "menu" && !current.finished) {
          e.preventDefault();
          togglePause();
        }
        return;
      }

      if ((key === "enter" || key === " ") && current.finished) {
        e.preventDefault();
        restartMatch();
        return;
      }

      if ((key === "enter" || key === " ") && current.gameStatus === "menu") {
        e.preventDefault();
        startMatch(queuedGameModeRef.current, queuedAIProfileRef.current);
        return;
      }

      if (current.paused || current.finished || current.gameStatus === "menu") {
        return;
      }

      if (inputManagerRef.current.handleKeyDown(e)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (inputManagerRef.current.handleKeyUp(e)) {
        e.preventDefault();
      }
    };

    const handleWindowBlur = () => {
      inputManagerRef.current.clearAllInputs();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        inputManagerRef.current.clearAllInputs();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const loop = () => {
      const renderer = threeRendererRef.current;
      if (!renderer) return;

      const rawDtSeconds = renderer.getDeltaSeconds();
      const state = gameStateRef.current;
      const isFrozen = state.paused || state.finished || state.gameStatus === "menu";
      const dtSeconds = isFrozen ? 0 : rawDtSeconds;
      const dtFrames = Math.min(dtSeconds * 60, 2);
      const playerInput = inputManagerRef.current.getPlayerInput();
      const opponentInput = inputManagerRef.current.getOpponentInput();

      if (!isFrozen) {
        if (state.gameStatus === "fighting") {
          primeComboCancel(state.player, playerInput);
          if (state.gameMode === "local-1v1") {
            primeComboCancel(state.opponent, opponentInput);
          }
        }
        gameStateRef.current = updateGame(state, playerInput, dtFrames, opponentInput);
      }

      inputManagerRef.current.clearTransientInputs();
      syncHud(gameStateRef.current);
      syncUi(gameStateRef.current);
      renderer.render(gameStateRef.current, dtSeconds);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      queuedStartRef.current = false;
      inputManagerRef.current.clearAllInputs();
      closeMoveList();
      resetAttackAnimationDurations();
      threeRenderer.dispose();
      threeRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hudState.judgeMessage || activeOverlay !== null) {
      setTransientJudgeMessage("");
      return;
    }

    setTransientJudgeMessage(hudState.judgeMessage);
    const timeout = window.setTimeout(() => {
      setTransientJudgeMessage("");
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeOverlay, hudState.judgeMessage]);

  const playerStaminaPercent = Math.max(0, Math.min(100, (hudState.playerStamina / STAMINA_MAX) * 100));
  const opponentStaminaPercent = Math.max(0, Math.min(100, (hudState.opponentStamina / STAMINA_MAX) * 100));
  const playerStaminaAlert = hudState.playerStaminaFlash > 0 || hudState.playerFatigueTimer > 0;
  const opponentStaminaAlert = hudState.opponentStaminaFlash > 0 || hudState.opponentFatigueTimer > 0;
  const loadingPercent = Math.round(loadState.progress * 100);
  const canStartFight = loadState.ready && !loadState.failed;
  const statusLabel = hudState.finished ? "results" : hudState.paused ? "pause" : hudState.status;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5efe1_0%,_#d8c7ae_35%,_#8f6d4b_100%)] px-4 py-6 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-black text-stone-950"
              style={{ fontFamily: '"Yuji Boku", "Hiragino Mincho ProN", "MS Mincho", serif' }}
            >
              Karate Duel
            </h1>
            <p className="text-sm uppercase tracking-[0.28em] text-stone-700">Dojo Combat Arena</p>
          </div>
          <div className="rounded-full border border-white/65 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-700 shadow-sm backdrop-blur">
            {statusLabel}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/55 bg-slate-950/10 shadow-[0_20px_80px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 md:p-6">
            <div className="w-full max-w-xs rounded-2xl border border-red-200/45 bg-slate-950/55 p-3 text-white shadow-lg backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-[0.24em] text-red-100">
                <span className="flex items-center gap-2">
                  <span className="rounded-full border border-red-200/45 bg-red-700/70 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white">P1</span>
                  AKA
                </span>
                <span className="text-[10px] tracking-[0.28em] text-white/58">Stamina</span>
              </div>
              <div className={`h-2.5 overflow-hidden rounded-full border bg-slate-950/70 shadow-[inset_0_0_8px_rgba(255,255,255,0.12)] ${playerStaminaAlert ? "border-white/70" : "border-white/20"}`}>
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${playerStaminaAlert ? "animate-pulse bg-[linear-gradient(90deg,_#f8fafc,_#9ca3af,_#f8fafc)]" : "bg-[linear-gradient(90deg,_#8f0d1f,_#dc2626,_#fecaca)]"}`}
                  style={{ width: `${playerStaminaPercent}%` }}
                />
              </div>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-blue-200/45 bg-slate-950/55 p-3 text-white shadow-lg backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-[0.24em] text-blue-100">
                <span className="flex items-center gap-2">
                  <span className="rounded-full border border-blue-200/45 bg-blue-700/70 px-2 py-0.5 text-[10px] tracking-[0.2em] text-white">
                    {hudState.gameMode === "local-1v1" ? "P2" : "IA"}
                  </span>
                  AO
                </span>
                <span className="text-[10px] tracking-[0.28em] text-white/58">Stamina</span>
              </div>
              <div className={`h-2.5 overflow-hidden rounded-full border bg-slate-950/70 shadow-[inset_0_0_8px_rgba(255,255,255,0.12)] ${opponentStaminaAlert ? "border-white/70" : "border-white/20"}`}>
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${opponentStaminaAlert ? "animate-pulse bg-[linear-gradient(90deg,_#f8fafc,_#9ca3af,_#f8fafc)]" : "bg-[linear-gradient(90deg,_#083b75,_#2563eb,_#bfdbfe)]"}`}
                  style={{ width: `${opponentStaminaPercent}%` }}
                />
              </div>
            </div>
          </div>

          {transientJudgeMessage && activeOverlay === null ? (
            <div className="pointer-events-none absolute inset-x-0 top-[22%] z-20 flex justify-center px-4">
              <div className="animate-pulse rounded-2xl border border-amber-200/35 bg-slate-950/62 px-7 py-4 text-center text-white shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-amber-200">Arbitragem</div>
                <div className="mt-1 text-2xl font-black uppercase tracking-[0.22em] text-white md:text-3xl">
                  {transientJudgeMessage}
                </div>
              </div>
            </div>
          ) : null}

          <div ref={mountRef} className="relative aspect-[16/9] w-full overflow-hidden bg-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent p-4 text-xs font-medium text-white md:flex-row md:items-end md:justify-between md:p-6">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-300">Controles</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-100">
                <span>P1: A/D mover</span>
                <span>Z/V/X/B golpes</span>
                <span>C guarda</span>
                {hudState.gameMode === "local-1v1" ? (
                  <>
                    <span>P2: setas mover</span>
                    <span>I/O/P/K golpes</span>
                    <span>L guarda</span>
                  </>
                ) : (
                  <span>AO controlado pela IA</span>
                )}
                <span>ESC: pausa</span>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/25 bg-amber-100/20 px-4 py-3 text-right text-amber-50 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.32em] text-amber-200">Fluxo</div>
              <div className="text-lg font-black uppercase tracking-[0.18em]">
                {hudState.finished ? "Resultado Final" : hudState.paused ? "Combate Pausado" : "Kumite Ativo"}
              </div>
            </div>
          </div>

          <IntroScreen
            open={activeOverlay === "intro"}
            selectedMode={selectedGameMode}
            selectedAIProfile={selectedAIProfile}
            canStartFight={canStartFight}
            loadingFailed={loadState.failed}
            loadingLabel={loadState.label}
            loadingPercent={loadingPercent}
            onSelectMode={selectGameMode}
            onSelectAIProfile={selectAIProfile}
            onStart={startMatch}
          />

          <PauseModal
            open={activeOverlay === "pause"}
            showMoveList={moveListOpen}
            onContinue={resumeMatch}
            onShowMoves={openMoveList}
            onHideMoves={closeMoveList}
            onRestart={restartMatch}
            onBackToMenu={returnToMenu}
          />

          <ResultModal
            open={activeOverlay === "results"}
            winner={hudState.winner}
            playerScore={hudState.playerScore}
            opponentScore={hudState.opponentScore}
            onRematch={restartMatch}
            onBackToMenu={returnToMenu}
          />
        </div>
      </div>
    </div>
  );
}

export default function KarateGame() {
  return (
    <GameUiProvider>
      <KarateGameScene />
    </GameUiProvider>
  );
}
