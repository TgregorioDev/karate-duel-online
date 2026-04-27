import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { GameState } from "@/game/types";

type OverlayView = "intro" | "pause" | "results" | null;

export type GameUiSnapshot = {
  gameStatus: GameState["gameStatus"];
  paused: boolean;
  finished: boolean;
};

type GameUiContextValue = {
  activeOverlay: OverlayView;
  moveListOpen: boolean;
  syncFromGame: (snapshot: GameUiSnapshot) => void;
  openMoveList: () => void;
  closeMoveList: () => void;
};

const GameUiContext = createContext<GameUiContextValue | null>(null);

function resolveOverlay(snapshot: GameUiSnapshot): OverlayView {
  if (snapshot.finished) return "results";
  if (snapshot.paused) return "pause";
  if (snapshot.gameStatus === "menu") return "intro";
  return null;
}

export function GameUiProvider({ children }: { children: ReactNode }) {
  const [activeOverlay, setActiveOverlay] = useState<OverlayView>("intro");
  const [moveListOpen, setMoveListOpen] = useState(false);

  const value = useMemo<GameUiContextValue>(() => ({
    activeOverlay,
    moveListOpen,
    syncFromGame: (snapshot) => {
      const nextOverlay = resolveOverlay(snapshot);
      setActiveOverlay((previous) => (previous === nextOverlay ? previous : nextOverlay));
      if (nextOverlay !== "pause") {
        setMoveListOpen(false);
      }
    },
    openMoveList: () => {
      setMoveListOpen(true);
    },
    closeMoveList: () => {
      setMoveListOpen(false);
    },
  }), [activeOverlay, moveListOpen]);

  return (
    <GameUiContext.Provider value={value}>
      {children}
    </GameUiContext.Provider>
  );
}

export function useGameUi() {
  const context = useContext(GameUiContext);
  if (!context) {
    throw new Error("useGameUi must be used within a GameUiProvider.");
  }
  return context;
}
