import MoveListPanel from "@/components/game-ui/MoveListPanel";

type PauseModalProps = {
  open: boolean;
  showMoveList: boolean;
  onContinue: () => void;
  onShowMoves: () => void;
  onHideMoves: () => void;
  onRestart: () => void;
  onBackToMenu: () => void;
};

function PauseActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-white/12 bg-white/10 px-4 py-3 text-left text-sm font-black uppercase tracking-[0.22em] text-white transition hover:bg-white/18"
    >
      {label}
    </button>
  );
}

export default function PauseModal({
  open,
  showMoveList,
  onContinue,
  onShowMoves,
  onHideMoves,
  onRestart,
  onBackToMenu,
}: PauseModalProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/56 px-4 py-6 backdrop-blur-md">
      <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-6 lg:flex-row lg:items-stretch">
        <div className="w-full max-w-xl rounded-[30px] border border-white/14 bg-slate-950/78 p-6 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur-md">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-200">Pause</div>
            <h2 className="mt-2 text-4xl font-black uppercase tracking-[0.16em]">Mokuso</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-200">
              O combate esta congelado. Timer, animacoes e entradas de luta ficam travados ate o retorno ao tatame.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <PauseActionButton label="Continuar" onClick={onContinue} />
            <PauseActionButton
              label={showMoveList ? "Ocultar lista de movimentos" : "Lista de movimentos"}
              onClick={showMoveList ? onHideMoves : onShowMoves}
            />
            <PauseActionButton label="Reiniciar" onClick={onRestart} />
            <PauseActionButton label="Voltar ao menu" onClick={onBackToMenu} />
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200/18 bg-amber-100/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-50/80">
            ESC alterna a pausa. Enter inicia revanche quando o resultado estiver aberto.
          </div>
        </div>

        <MoveListPanel open={showMoveList} onClose={onHideMoves} />
      </div>
    </div>
  );
}
