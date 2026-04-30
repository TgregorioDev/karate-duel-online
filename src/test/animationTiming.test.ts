import { describe, expect, it } from "vitest";

import { COMBO_CANCEL_WINDOW_FRAMES, createInitialState, getAttackDurationFrames, updateGame } from "@/game/engine";

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

describe("animation timing", () => {
  it("starts a faster follow-up when an attack is pressed inside the combo window", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.state = "punch";
    state.player.stateTimer = COMBO_CANCEL_WINDOW_FRAMES;
    state.player.attackTimerMax = 12;

    const followUpInput = emptyInput();
    followUpInput.gyakuZuki = true;

    updateGame(state, followUpInput, 1, emptyInput());

    expect(state.player.state).toBe("gyaku-zuki");
    expect(state.player.stateTimer).toBe(Math.floor(getAttackDurationFrames("gyaku-zuki") * 0.7));
  });
});
