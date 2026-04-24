import { describe, expect, it } from "vitest";

import { createInitialState, startBowIn, updateGame } from "@/game/engine";

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
});
