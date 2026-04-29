import { describe, expect, it } from "vitest";

import { createInitialState, updateGame } from "@/game/engine";
import { STAMINA_MAX } from "@/game/types";

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

function fightingState() {
  const state = createInitialState("local-1v1");
  state.gameStatus = "fighting";
  return state;
}

describe("dynamic stamina", () => {
  it("spends WKF technique costs when attacks start", () => {
    const cases = [
      { key: "punch", expected: STAMINA_MAX - 10 },
      { key: "gyakuZuki", expected: STAMINA_MAX - 15 },
      { key: "maeGeri", expected: STAMINA_MAX - 25 },
      { key: "kick", expected: STAMINA_MAX - 40 },
    ] as const;

    cases.forEach(({ key, expected }) => {
      const state = fightingState();
      const input = emptyInput();
      input[key] = true;

      updateGame(state, input, 1, emptyInput());

      expect(state.player.stamina).toBeCloseTo(expected, 5);
    });
  });

  it("blocks attacks without enough stamina and flashes the stamina bar", () => {
    const state = fightingState();
    state.player.stamina = 20;
    state.player.staminaRegenDelay = 10;
    const input = emptyInput();
    input.kick = true;

    updateGame(state, input, 1, emptyInput());

    expect(state.player.state).not.toBe("kick");
    expect(state.player.stamina).toBeCloseTo(20, 5);
    expect(state.player.staminaFlash).toBeGreaterThan(0);
  });

  it("delays regeneration after high-cost attacks and then recovers at 15 stamina per second", () => {
    const state = fightingState();
    const input = emptyInput();
    input.kick = true;

    updateGame(state, input, 1, emptyInput());
    expect(state.player.stamina).toBeCloseTo(60, 5);
    expect(state.player.staminaRegenDelay).toBeGreaterThan(0);

    state.player.state = "idle";
    state.player.stateTimer = 0;
    updateGame(state, emptyInput(), 60, emptyInput());
    expect(state.player.stamina).toBeCloseTo(60, 5);

    updateGame(state, emptyInput(), 30, emptyInput());
    expect(state.player.stamina).toBeCloseTo(67.5, 5);

    updateGame(state, emptyInput(), 60, emptyInput());
    expect(state.player.stamina).toBeCloseTo(82.5, 5);
  });

  it("drains movement stamina at two units per second while recovery is delayed", () => {
    const state = fightingState();
    state.player.stamina = 50;
    state.player.staminaRegenDelay = 61;
    const input = emptyInput();
    input.right = true;

    updateGame(state, input, 60, emptyInput());

    expect(state.player.stamina).toBeCloseTo(48, 5);
  });

  it("enters fatigue at zero stamina, slows movement, and blocks attacks briefly", () => {
    const state = fightingState();
    state.player.stamina = 1;
    state.player.staminaRegenDelay = 120;
    const moveInput = emptyInput();
    moveInput.right = true;

    updateGame(state, moveInput, 60, emptyInput());
    expect(state.player.fatigueTimer).toBeGreaterThan(0);

    const startX = state.player.x;
    updateGame(state, moveInput, 1, emptyInput());
    expect(state.player.x - startX).toBeCloseTo(2.1, 5);

    const attackInput = emptyInput();
    attackInput.punch = true;
    updateGame(state, attackInput, 1, emptyInput());

    expect(state.player.state).not.toBe("punch");
    expect(state.player.staminaFlash).toBeGreaterThan(0);
  });
});
