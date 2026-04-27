type MoveListPanelProps = {
  open: boolean;
  onClose: () => void;
};

const movementEntries = ["A / D ou setas: deslocamento lateral", "C / L: block e parry", "ESC: pausa"];

const attackGroups = [
  {
    side: "AKA",
    color: "text-red-200",
    entries: ["Z: kizami-zuki", "V: gyaku-zuki", "X: mawashi-geri", "B: mae-geri"],
  },
  {
    side: "AO",
    color: "text-blue-200",
    entries: ["J: kizami-zuki", "N: gyaku-zuki", "K: mawashi-geri", "M: mae-geri"],
  },
];

const combos = [
  "Kizami Z -> Gyaku V para pressao curta",
  "Mawashi X -> Mae-geri B para variar altura",
  "Parry C -> Gyaku V para contra-ataque imediato",
];

export default function MoveListPanel({ open, onClose }: MoveListPanelProps) {
  if (!open) return null;

  return (
    <div className="w-full max-w-xl rounded-[28px] border border-white/12 bg-slate-950/78 p-5 text-white shadow-[0_20px_60px_rgba(2,6,23,0.36)] backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.36em] text-amber-200">Lista tecnica</div>
          <h3 className="mt-1 text-2xl font-black uppercase tracking-[0.12em]">Movimentos</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-white/18"
        >
          Fechar
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-300">Movimento</div>
          <div className="mt-3 space-y-2 text-sm text-white">
            {movementEntries.map((entry) => (
              <div key={entry}>{entry}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-300">Golpes</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {attackGroups.map((group) => (
              <div key={group.side} className="rounded-xl border border-white/10 bg-slate-900/55 p-4">
                <div className={`text-[10px] font-black uppercase tracking-[0.34em] ${group.color}`}>{group.side}</div>
                <div className="mt-3 space-y-2 text-sm text-white">
                  {group.entries.map((entry) => (
                    <div key={entry}>{entry}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200/18 bg-amber-100/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.34em] text-amber-200">Combos sugeridos</div>
          <div className="mt-3 space-y-2 text-sm text-amber-50">
            {combos.map((entry) => (
              <div key={entry}>{entry}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
