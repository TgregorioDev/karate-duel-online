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
import ThreeRenderer, { type ThreeRendererLoadState } from "@/game/ThreeRenderer";
import {
  GYAKU_ZUKI_COST,
  KICK_COST,
  MAE_GERI_COST,
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
  timeRemaining: number;
  judgeMessage: string;
  status: GameState["gameStatus"];
  winner: GameState["winner"];
  paused: boolean;
  finished: boolean;
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
    timeRemaining: state.timeRemaining,
    judgeMessage: state.judgeMessage,
    status: state.gameStatus,
    winner: state.winner,
    paused: state.paused,
    finished: state.finished,
  };
}

function clearTransientInputs(input: InputState) {
  input.punch = false;
  input.kick = false;
  input.gyakuZuki = false;
  input.maeGeri = false;
}

function clearAllInputs(input: InputState) {
  input.left = false;
  input.right = false;
  input.block = false;
  clearTransientInputs(input);
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

function primePlayerComboCancel(state: GameState, input: InputState) {
  if (state.gameStatus !== "fighting") return;

  const queuedAttack = getQueuedAttack(input);
  if (!queuedAttack) return;

  const player = state.player;
  if (!isAttackState(player.state) || player.stateTimer <= 1) return;

  const comboCost = ATTACK_INPUT_COSTS[queuedAttack] * COMBO_CANCEL_COST_MULTIPLIER;
  if (player.stamina < comboCost) return;

  player.stateTimer = Math.min(player.stateTimer, 1);
}

function createMatchState() {
  const fresh = createInitialState();
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
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    punch: false,
    kick: false,
    gyakuZuki: false,
    maeGeri: false,
    block: false,
  });
  const animFrameRef = useRef<number>(0);
  const hudRef = useRef<HudState>(makeHudSnapshot(gameStateRef.current));
  const [hudState, setHudState] = useState<HudState>(hudRef.current);
  const [loadState, setLoadState] = useState<ThreeRendererLoadState>(INITIAL_LOAD_STATE);
  const [transientJudgeMessage, setTransientJudgeMessage] = useState("");

  const syncHud = (state: GameState) => {
    const next = makeHudSnapshot(state);
    const previous = hudRef.current;
    const changed =
      previous.playerScore !== next.playerScore ||
      previous.opponentScore !== next.opponentScore ||
      Math.floor(previous.playerStamina) !== Math.floor(next.playerStamina) ||
      Math.floor(previous.opponentStamina) !== Math.floor(next.opponentStamina) ||
      Math.ceil(previous.timeRemaining) !== Math.ceil(next.timeRemaining) ||
      previous.judgeMessage !== next.judgeMessage ||
      previous.status !== next.status ||
      previous.winner !== next.winner ||
      previous.paused !== next.paused ||
      previous.finished !== next.finished;

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

  const startMatch = () => {
    if (!loadStateRef.current.ready) {
      queuedStartRef.current = true;
      return;
    }
    queuedStartRef.current = false;
    clearAllInputs(inputRef.current);
    closeMoveList();
    applyGameState(createMatchState(), true);
  };

  const returnToMenu = () => {
    queuedStartRef.current = false;
    clearAllInputs(inputRef.current);
    closeMoveList();
    applyGameState(createInitialState(), true);
  };

  const restartMatch = () => {
    queuedStartRef.current = false;
    clearAllInputs(inputRef.current);
    closeMoveList();
    applyGameState(createMatchState(), true);
  };

  const togglePause = () => {
    const current = gameStateRef.current;
    if (current.gameStatus === "menu" || current.finished) return;
    setPaused(current, !current.paused);
    if (current.paused) {
      closeMoveList();
    } else {
      clearAllInputs(inputRef.current);
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
          startMatch();
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
        startMatch();
        return;
      }

      if (current.paused || current.finished || current.gameStatus === "menu") {
        return;
      }

      const input = inputRef.current;
      switch (key) {
        case "arrowleft":
        case "a":
          input.left = true;
          break;
        case "arrowright":
        case "d":
          input.right = true;
          break;
        case "z":
        case "j":
          input.punch = true;
          break;
        case "x":
        case "k":
          input.kick = true;
          break;
        case "v":
        case "n":
          input.gyakuZuki = true;
          break;
        case "b":
        case "m":
          input.maeGeri = true;
          break;
        case "c":
        case "l":
          input.block = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const input = inputRef.current;
      switch (e.key.toLowerCase()) {
        case "arrowleft":
        case "a":
          input.left = false;
          break;
        case "arrowright":
        case "d":
          input.right = false;
          break;
        case "z":
        case "j":
          input.punch = false;
          break;
        case "x":
        case "k":
          input.kick = false;
          break;
        case "v":
        case "n":
          input.gyakuZuki = false;
          break;
        case "b":
        case "m":
          input.maeGeri = false;
          break;
        case "c":
        case "l":
          input.block = false;
          break;
      }
    };

    const handleWindowBlur = () => {
      clearAllInputs(inputRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearAllInputs(inputRef.current);
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

      if (!isFrozen) {
        primePlayerComboCancel(state, inputRef.current);
        gameStateRef.current = updateGame(state, inputRef.current, dtFrames);
      }

      clearTransientInputs(inputRef.current);
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
      clearAllInputs(inputRef.current);
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
                <span>AKA</span>
                <span className="text-[10px] tracking-[0.28em] text-white/58">Stamina</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-white/20 bg-slate-950/70 shadow-[inset_0_0_8px_rgba(255,255,255,0.12)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,_#8f0d1f,_#dc2626,_#fecaca)] transition-[width]"
                  style={{ width: `${playerStaminaPercent}%` }}
                />
              </div>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-blue-200/45 bg-slate-950/55 p-3 text-white shadow-lg backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-[0.24em] text-blue-100">
                <span>AO</span>
                <span className="text-[10px] tracking-[0.28em] text-white/58">Stamina</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-white/20 bg-slate-950/70 shadow-[inset_0_0_8px_rgba(255,255,255,0.12)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,_#083b75,_#2563eb,_#bfdbfe)] transition-[width]"
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

          <div ref={mountRef} className="aspect-[16/9] w-full bg-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent p-4 text-xs font-medium text-white md:flex-row md:items-end md:justify-between md:p-6">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-300">Controles</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-100">
                <span>A / D ou Setas: mover</span>
                <span>Z: kizami-zuki</span>
                <span>V: gyaku-zuki</span>
                <span>X: mawashi-geri</span>
                <span>B: mae-geri</span>
                <span>C: block</span>
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
            canStartFight={canStartFight}
            loadingFailed={loadState.failed}
            loadingLabel={loadState.label}
            loadingPercent={loadingPercent}
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
