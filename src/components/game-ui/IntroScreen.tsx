type IntroScreenProps = {
  open: boolean;
  canStartFight: boolean;
  loadingFailed: boolean;
  loadingLabel: string;
  loadingPercent: number;
  onStart: () => void;
};

const infoPanels = [
  {
    title: "Movimento",
    entries: ["A / D ou setas: mover", "C / L: block e parry"],
  },
  {
    title: "Ataques",
    entries: ["Z / J: kizami-zuki", "V / N: gyaku-zuki", "X / K: mawashi-geri", "B / M: mae-geri"],
  },
];

export default function IntroScreen({
  open,
  canStartFight,
  loadingFailed,
  loadingLabel,
  loadingPercent,
  onStart,
}: IntroScreenProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_rgba(15,23,42,0.48)_56%,_rgba(15,23,42,0.76)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px] opacity-35" />
      <div className="absolute right-8 top-4 text-[96px] font-black text-white/8 md:right-16 md:text-[142px]">空手道</div>

      <div className="relative z-10 flex h-full items-center justify-center p-6">
        <div className="w-full max-w-4xl rounded-[30px] border border-white/20 bg-[#21160d]/78 p-6 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md md:p-8">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-300">WKF Kumite Demo</div>
            <h2
              className="mt-3 text-4xl font-black text-white md:text-5xl"
              style={{ fontFamily: '"Yuji Boku", "Hiragino Mincho ProN", "MS Mincho", serif' }}
            >
              Entre no Dojo
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-amber-50/85 md:text-base">
              Duelo arcade de karate com parry, stamina e arbitragem. Inicie com Enter e a luta comeca logo em seguida.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {infoPanels.map((panel) => (
              <div key={panel.title} className="rounded-2xl border border-amber-200/25 bg-[#5a341c]/55 p-5 shadow-inner">
                <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">{panel.title}</div>
                <div className="mt-3 space-y-2 text-sm font-semibold text-white">
                  {panel.entries.map((entry) => (
                    <div key={entry}>{entry}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col items-center gap-3 text-center">
            {canStartFight ? (
              <button
                type="button"
                onClick={onStart}
                className="animate-pulse rounded-full border border-amber-200/55 bg-red-700 px-7 py-3 text-sm font-black uppercase tracking-[0.28em] text-white shadow-[0_0_34px_rgba(185,28,28,0.34)] transition hover:bg-red-600"
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
            <div className="text-xs uppercase tracking-[0.28em] text-amber-50/72">Pontuacao: Yuko 1, Waza-ari 2, Ippon 3</div>
          </div>
        </div>
      </div>
    </div>
  );
}
