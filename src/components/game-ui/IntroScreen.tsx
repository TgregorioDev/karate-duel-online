import type { AIProfile, GameMode } from "@/game/types";

type IntroScreenProps = {
  open: boolean;
  selectedMode: GameMode;
  selectedAIProfile: AIProfile;
  canStartFight: boolean;
  loadingFailed: boolean;
  loadingLabel: string;
  loadingPercent: number;
  onSelectMode: (mode: GameMode) => void;
  onSelectAIProfile: (profile: AIProfile) => void;
  onStart: (mode?: GameMode, aiProfile?: AIProfile) => void;
};

const infoPanels = [
  {
    title: "Player 1 - AKA",
    entries: ["A / D: mover", "Z: kizami", "V: gyaku", "X: mawashi", "B: mae-geri", "C: guarda/parry"],
  },
  {
    title: "Player 2 - AO",
    entries: ["Setas: mover", "I: kizami", "O: gyaku", "P: mawashi", "K: mae-geri", "L: guarda/parry"],
  },
];

const modeOptions: Array<{
  mode: GameMode;
  title: string;
  description: string;
  accentClass: string;
}> = [
  {
    mode: "player-vs-ai",
    title: "Player vs IA",
    description: "AKA contra AO controlado pela IA.",
    accentClass: "border-red-300/55 bg-red-700/28 text-red-50",
  },
  {
    mode: "local-1v1",
    title: "1 vs 1 Local",
    description: "Dois jogadores no mesmo teclado.",
    accentClass: "border-blue-300/55 bg-blue-700/28 text-blue-50",
  },
];

const aiProfileOptions: Array<{
  profile: AIProfile;
  title: string;
  description: string;
}> = [
  {
    profile: "kyu",
    title: "Kyu",
    description: "Iniciante: reage tarde, erra leituras e ataca com mais aleatoriedade.",
  },
  {
    profile: "dan",
    title: "Dan",
    description: "Avancado: controla maai, defende melhor e usa Kizami + Gyaku.",
  },
  {
    profile: "sensei",
    title: "Sensei",
    description: "Expert: antecipa chutes, pune repeticoes e busca Ippon.",
  },
];

export default function IntroScreen({
  open,
  selectedMode,
  selectedAIProfile,
  canStartFight,
  loadingFailed,
  loadingLabel,
  loadingPercent,
  onSelectMode,
  onSelectAIProfile,
  onStart,
}: IntroScreenProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_rgba(15,23,42,0.48)_56%,_rgba(15,23,42,0.76)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px] opacity-35" />
      <div className="absolute right-8 top-4 text-[96px] font-black text-white/8 md:right-16 md:text-[142px]">空手道</div>

      <div className="relative z-10 flex min-h-full items-start justify-center p-2 sm:p-3 md:p-4">
        <div className="max-h-[calc(100vh-9rem)] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-white/20 bg-[#21160d]/78 p-4 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md md:p-5 lg:p-6">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-300">WKF Kumite Demo</div>
            <h2
              className="mt-2 text-3xl font-black text-white md:text-4xl"
              style={{ fontFamily: '"Yuji Boku", "Hiragino Mincho ProN", "MS Mincho", serif' }}
            >
              Entre no Dojo
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-amber-50/85 md:text-sm">
              Duelo arcade de karate com parry, stamina e arbitragem. Escolha o modo e pressione Enter para iniciar.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {modeOptions.map((option) => {
              const selected = selectedMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => onSelectMode(option.mode)}
                  className={`rounded-2xl border px-4 py-3 text-left shadow-[inset_0_0_28px_rgba(255,255,255,0.05)] transition hover:scale-[1.01] ${
                    selected
                      ? `${option.accentClass} ring-2 ring-amber-200/70`
                      : "border-white/14 bg-slate-950/42 text-white/80 hover:border-amber-200/40"
                  }`}
                >
                  <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">
                    {selected ? "Selecionado" : "Modo de jogo"}
                  </div>
                  <div className="mt-1 text-lg font-black uppercase tracking-[0.14em]">{option.title}</div>
                  <div className="mt-1 text-xs font-semibold text-white/78 md:text-sm">{option.description}</div>
                </button>
              );
            })}
          </div>

          {selectedMode === "player-vs-ai" ? (
            <div className="mt-3 rounded-2xl border border-blue-200/20 bg-slate-950/35 p-3">
              <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">Nivel da IA AO</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {aiProfileOptions.map((option) => {
                  const selected = selectedAIProfile === option.profile;
                  return (
                    <button
                      key={option.profile}
                      type="button"
                      onClick={() => onSelectAIProfile(option.profile)}
                      className={`rounded-2xl border px-3 py-2.5 text-left transition hover:scale-[1.01] ${
                        selected
                          ? "border-blue-200/65 bg-blue-700/30 text-blue-50 ring-2 ring-amber-200/60"
                          : "border-white/14 bg-slate-950/38 text-white/72 hover:border-blue-200/45"
                      }`}
                    >
                      <div className="text-sm font-black uppercase tracking-[0.22em]">{option.title}</div>
                      <div className="mt-1 text-[11px] font-semibold leading-4 text-white/72 md:text-xs">{option.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {infoPanels.map((panel) => (
              <div key={panel.title} className="rounded-2xl border border-amber-200/25 bg-[#5a341c]/55 p-3 shadow-inner md:p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">{panel.title}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-semibold text-white md:text-sm">
                  {panel.entries.map((entry) => (
                    <div key={entry}>{entry}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 mt-3 flex flex-col items-center gap-2 border-t border-white/10 bg-[#21160d]/92 px-4 py-3 text-center backdrop-blur-md md:-mx-5 md:px-5 lg:-mx-6 lg:px-6">
            {canStartFight ? (
              <button
                type="button"
                onClick={() => onStart(selectedMode, selectedAIProfile)}
                className="animate-pulse rounded-full border border-amber-200/55 bg-red-700 px-7 py-2.5 text-sm font-black uppercase tracking-[0.28em] text-white shadow-[0_0_34px_rgba(185,28,28,0.34)] transition hover:bg-red-600"
              >
                Pressione Enter para Comecar
              </button>
            ) : (
              <div className="rounded-2xl border border-sky-300/30 bg-sky-300/12 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-sky-100">
                {loadingFailed ? "Falha ao carregar os lutadores" : `${loadingLabel} ${loadingPercent}%`}
              </div>
            )}

            {!canStartFight && !loadingFailed ? (
              <div className="text-xs uppercase tracking-[0.24em] text-amber-50/70">
                A luta sera liberada quando AKA e AO terminarem de carregar.
              </div>
            ) : null}
            <div className="text-[10px] uppercase tracking-[0.28em] text-amber-50/72 md:text-xs">Pontuacao: Yuko 1, Waza-ari 2, Ippon 3</div>
          </div>
        </div>
      </div>
    </div>
  );
}
