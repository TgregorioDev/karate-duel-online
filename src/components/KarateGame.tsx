import { startTransition, useEffect, useRef, useState } from "react";

import { createInitialState, resetAttackAnimationDurations, setAttackAnimationDurations, startBowIn, updateGame } from "@/game/engine";
import ThreeRenderer, { type ThreeRendererLoadState } from "@/game/ThreeRenderer";
import {
  GYAKU_ZUKI_COST,
  KICK_COST,
  MAE_GERI_COST,
  GameState,
  InputState,
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
};

type AttackState = "punch" | "gyaku-zuki" | "kick" | "mae-geri";

const COMBO_CANCEL_COST_MULTIPLIER = 0.8;
const ATTACK_INPUT_COSTS: Record<AttackState, number> = {
  punch: PUNCH_COST,
  "gyaku-zuki": GYAKU_ZUKI_COST,
  kick: KICK_COST,
  "mae-geri": MAE_GERI_COST,
};

const INITIAL_AKA_LOAD_STATE: ThreeRendererLoadState = {
  ready: false,
  failed: false,
  loaded: 0,
  total: 9,
  progress: 0,
  label: "Carregando modelo AKA...",
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

  // Open the cancel window immediately so the engine can resolve the buffered follow-up this frame.
  player.stateTimer = Math.min(player.stateTimer, 1);
}

export default function KarateGame() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState>(createInitialState());
  const akaLoadStateRef = useRef<ThreeRendererLoadState>(INITIAL_AKA_LOAD_STATE);
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
  const [akaLoadState, setAkaLoadState] = useState<ThreeRendererLoadState>(INITIAL_AKA_LOAD_STATE);

  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;

    const commitStart = () => {
      clearAllInputs(inputRef.current);
      const fresh = createInitialState();
      startBowIn(fresh);
      gameStateRef.current = fresh;
    };

    const threeRenderer = new ThreeRenderer({
      onAkaLoadStateChange: (nextState) => {
        akaLoadStateRef.current = nextState;
        startTransition(() => {
          setAkaLoadState(nextState);
        });

        if (nextState.ready && queuedStartRef.current) {
          queuedStartRef.current = false;
          commitStart();
        }
      },
      onAkaReady: () => {
        akaLoadStateRef.current = { ...akaLoadStateRef.current, ready: true, failed: false, progress: 1 };
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
    threeRenderer.attach(mountNode);
    threeRenderer.render(gameStateRef.current, 0);

    const startGame = () => {
      const current = gameStateRef.current;
      if (current.gameStatus === "menu" || current.gameStatus === "game-over") {
        if (!akaLoadStateRef.current.ready) {
          queuedStartRef.current = true;
          return;
        }
        queuedStartRef.current = false;
        commitStart();
      }
    };

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
        previous.winner !== next.winner;

      if (changed) {
        hudRef.current = next;
        startTransition(() => {
          setHudState(next);
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const input = inputRef.current;
      switch (e.key.toLowerCase()) {
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
        case "enter":
        case " ":
          e.preventDefault();
          startGame();
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
      const dtSeconds = threeRenderer.getDeltaSeconds();
      const dtFrames = Math.min(dtSeconds * 60, 2);

      primePlayerComboCancel(gameStateRef.current, inputRef.current);
      gameStateRef.current = updateGame(gameStateRef.current, inputRef.current, dtFrames);

      clearTransientInputs(inputRef.current);

      syncHud(gameStateRef.current);
      threeRenderer.render(gameStateRef.current, dtSeconds);
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
      resetAttackAnimationDurations();
      threeRenderer.dispose();
    };
  }, []);

  const timerText = Math.ceil(hudState.timeRemaining).toString().padStart(2, "0");
  const playerStaminaPercent = Math.max(0, Math.min(100, (hudState.playerStamina / STAMINA_MAX) * 100));
  const opponentStaminaPercent = Math.max(0, Math.min(100, (hudState.opponentStamina / STAMINA_MAX) * 100));
  const resultText =
    hudState.winner === "draw"
      ? "Empate"
      : hudState.winner === "player"
        ? "AKA vence"
        : hudState.winner === "opponent"
          ? "AO vence"
          : null;
  const isMenu = hudState.status === "menu";
  const isStartCeremony = hudState.status === "bow-in";
  const akaLoadingPercent = Math.round(akaLoadState.progress * 100);
  const canStartFight = akaLoadState.ready && !akaLoadState.failed;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f6fbff_0%,_#dfe8ef_45%,_#becbd7_100%)] px-4 py-6 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[0.25em] text-red-700">KARATE DUEL</h1>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-600">Three.js WKF Combat Prototype</p>
          </div>
          <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm backdrop-blur">
            {hudState.status}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-slate-950/10 shadow-[0_20px_80px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          {isMenu ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.16)_0%,_rgba(15,23,42,0.5)_58%,_rgba(15,23,42,0.72)_100%)] p-6">
              <div className="w-full max-w-2xl rounded-[30px] border border-white/15 bg-slate-950/72 p-6 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md md:p-8">
                <div className="flex flex-col gap-5">
                  <div className="space-y-2 text-center">
                    <div className="text-[11px] font-bold uppercase tracking-[0.42em] text-amber-300">WKF Kumite Demo</div>
                    <h2 className="text-3xl font-black uppercase tracking-[0.18em] text-white md:text-4xl">Entre no Tatame</h2>
                    <p className="mx-auto max-w-xl text-sm leading-6 text-slate-200 md:text-base">
                      Duelo arcade de karate com parry, stamina e arbitragem. Inicie com <span className="font-bold text-white">Enter</span> e a luta comeca logo em seguida.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.34em] text-slate-300">Movimento</div>
                      <div className="mt-2 space-y-1 text-sm text-white">
                        <div>A/D ou setas: mover</div>
                        <div>C: block</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.34em] text-slate-300">Ataques</div>
                      <div className="mt-2 space-y-1 text-sm text-white">
                        <div>Z: kizami-tsuki</div>
                        <div>V: gyaku-zuki</div>
                        <div>X: kick ippon</div>
                        <div>B: mae-geri</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 text-center">
                    {canStartFight ? (
                      <div className="rounded-full border border-amber-300/45 bg-amber-300/14 px-5 py-2 text-sm font-black uppercase tracking-[0.3em] text-amber-100">
                        Pressione Enter para Comecar
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-sky-100">
                        {akaLoadState.failed ? "Falha ao carregar os clips do AKA" : `${akaLoadState.label} ${akaLoadingPercent}%`}
                      </div>
                    )}
                    {!canStartFight && !akaLoadState.failed ? (
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-300">
                        A luta sera liberada quando o modelo e todas as animacoes forem carregados.
                      </div>
                    ) : null}
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-300">Pontuacao: Yuko 1, Waza-ari 2, Ippon 3</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isStartCeremony ? (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
              <div className="rounded-full border border-white/20 bg-slate-950/58 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.35em] text-white shadow-lg backdrop-blur-md">
                Reverencia inicial. Hajime em instantes.
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 p-4 md:p-6">
            <div className="w-full max-w-xs rounded-2xl border border-red-200/80 bg-white/85 p-3 shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-[0.24em] text-red-700">
                <span>AKA</span>
                <span>{hudState.playerScore}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-red-600 transition-[width]" style={{ width: `${playerStaminaPercent}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/92 px-5 py-3 text-center shadow-lg">
              <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-slate-500">Tempo</div>
              <div className="text-3xl font-black tabular-nums text-slate-900">{timerText}</div>
              {hudState.judgeMessage ? (
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{hudState.judgeMessage}</div>
              ) : null}
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-blue-200/80 bg-white/85 p-3 shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-sm font-bold uppercase tracking-[0.24em] text-blue-700">
                <span>AO</span>
                <span>{hudState.opponentScore}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${opponentStaminaPercent}%` }} />
              </div>
            </div>
          </div>

          <div ref={mountRef} className="aspect-[16/9] w-full bg-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent p-4 text-xs font-medium text-white md:flex-row md:items-end md:justify-between md:p-6">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.32em] text-slate-300">Controles</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-100">
                <span>A/D ou setas: mover</span>
                <span>Z: kizami-tsuki</span>
                <span>V: gyaku-zuki</span>
                <span>X: kick ippon</span>
                <span>B: mae-geri</span>
                <span>C: block</span>
                <span>Enter/Espaço: iniciar</span>
              </div>
            </div>

            {resultText ? (
              <div className="rounded-2xl border border-amber-200/25 bg-amber-100/20 px-4 py-3 text-right text-amber-50 backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.32em] text-amber-200">Resultado</div>
                <div className="text-lg font-black uppercase tracking-[0.18em]">{resultText}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
