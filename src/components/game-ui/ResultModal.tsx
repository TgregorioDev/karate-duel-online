type ResultModalProps = {
  open: boolean;
  winner: "player" | "opponent" | "draw" | null;
  playerScore: number;
  opponentScore: number;
  onRematch: () => void;
  onBackToMenu: () => void;
};

function getWinnerLabel(winner: ResultModalProps["winner"]) {
  if (winner === "player") return "AKA VENCE";
  if (winner === "opponent") return "AO VENCE";
  return "HIKIWAKE";
}

export default function ResultModal({
  open,
  winner,
  playerScore,
  opponentScore,
  onRematch,
  onBackToMenu,
}: ResultModalProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.14),_rgba(15,23,42,0.82))] px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[30px] border border-white/18 bg-slate-950/78 p-6 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md md:p-8">
        <div className="text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-200">Shobu Ari</div>
          <h2 className="mt-3 text-4xl font-black uppercase tracking-[0.18em] md:text-5xl">{getWinnerLabel(winner)}</h2>
          <p className="mt-3 text-sm uppercase tracking-[0.28em] text-slate-300">Placar final</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="rounded-2xl border border-red-200/20 bg-red-700/20 px-5 py-6 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.36em] text-red-200">AKA</div>
            <div className="mt-2 text-5xl font-black text-white">{playerScore}</div>
          </div>
          <div className="text-center text-xl font-black uppercase tracking-[0.34em] text-amber-200">VS</div>
          <div className="rounded-2xl border border-blue-200/20 bg-blue-700/20 px-5 py-6 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.36em] text-blue-200">AO</div>
            <div className="mt-2 text-5xl font-black text-white">{opponentScore}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 rounded-2xl border border-red-200/25 bg-red-700 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-white transition hover:bg-red-600"
          >
            Jogar novamente
          </button>
          <button
            type="button"
            onClick={onBackToMenu}
            className="flex-1 rounded-2xl border border-white/14 bg-white/10 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-white transition hover:bg-white/18"
          >
            Voltar ao menu
          </button>
        </div>

        <div className="mt-4 text-center text-xs uppercase tracking-[0.26em] text-slate-300">
          Enter tambem inicia a revanche imediatamente.
        </div>
      </div>
    </div>
  );
}
