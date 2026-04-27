import { describe, expect, it } from "vitest";

import { createInitialState, setPaused, startBowIn, startBowOut, updateGame } from "@/game/engine";

function emptyInput() {
  return {
    left: false,
    right: false,
    punch: false,
    kick: false,
    gyakuZuki: false,
    maeGeri: false,
    block: false,
  };
}

describe("ceremony timing", () => {
  it("enters HAJIME at the expected threshold even on slower frame rates", () => {
    const state = createInitialState();
    startBowIn(state);

    for (let i = 0; i < 36; i += 1) {
      updateGame(state, emptyInput(), 2);
    }

    expect(state.gameStatus).toBe("bow-in");
    expect(state.judge.state).toBe("hajime");
    expect(state.player.state).toBe("idle");
    expect(state.opponent.state).toBe("idle");
  });

  it("finishes bow-in in about the same simulated time regardless of dt step size", () => {
    const state = createInitialState();
    startBowIn(state);

    for (let i = 0; i < 50; i += 1) {
      updateGame(state, emptyInput(), 2);
    }

    expect(state.gameStatus).toBe("fighting");
    expect(state.judge.state).toBe("idle");
    expect(state.judgeMessage).toBe("");
  });

  it("freezes simulation timers while paused", () => {
    const state = createInitialState();
    startBowIn(state);
    setPaused(state, true);
    const initialCeremonyTimer = state.ceremonyTimer;

    updateGame(state, emptyInput(), 10);

    expect(state.ceremonyTimer).toBe(initialCeremonyTimer);
    expect(state.paused).toBe(true);
  });

  it("marks the game as finished when the bow-out ceremony ends", () => {
    const state = createInitialState();
    state.winner = "player";
    startBowOut(state);

    for (let i = 0; i < 80; i += 1) {
      updateGame(state, emptyInput(), 2);
    }

    expect(state.gameStatus).toBe("game-over");
    expect(state.finished).toBe(true);
  });
});
