import { describe, expect, it } from "vitest";

import { createInitialState, getAICombatMode, getAIDistanceZone, getAIProfileConfig, isWhiffRecoveryWindow } from "@/game/engine";

describe("AI combat mode", () => {
  it("detects a whiff punish window when the player recovers out of range", () => {
    expect(isWhiffRecoveryWindow("kick", 4, 160)).toBe(true);
    expect(isWhiffRecoveryWindow("punch", 7, 70)).toBe(false);
  });

  it("prioritizes punish after a parry or clear whiff", () => {
    expect(getAICombatMode({
      scoreDelta: 0,
      timeRemaining: 50,
      opponentStamina: 70,
      playerStamina: 70,
      dist: 150,
      playerState: "kick",
      playerStateTimer: 4,
      playerTelegraphing: false,
      opponentParryWindow: 0,
    })).toBe("punish");

    expect(getAICombatMode({
      scoreDelta: 0,
      timeRemaining: 50,
      opponentStamina: 70,
      playerStamina: 70,
      dist: 80,
      playerState: "idle",
      playerStateTimer: 0,
      playerTelegraphing: false,
      opponentParryWindow: 10,
    })).toBe("punish");
  });

  it("goes evasive on close telegraphs or low stamina", () => {
    expect(getAICombatMode({
      scoreDelta: 2,
      timeRemaining: 18,
      opponentStamina: 70,
      playerStamina: 70,
      dist: 100,
      playerState: "punch",
      playerStateTimer: 8,
      playerTelegraphing: true,
      opponentParryWindow: 0,
    })).toBe("evasive");

    expect(getAICombatMode({
      scoreDelta: 0,
      timeRemaining: 60,
      opponentStamina: 20,
      playerStamina: 70,
      dist: 120,
      playerState: "idle",
      playerStateTimer: 0,
      playerTelegraphing: false,
      opponentParryWindow: 0,
    })).toBe("evasive");
  });

  it("goes into pressure mode when behind or when the player is fading", () => {
    expect(getAICombatMode({
      scoreDelta: -2,
      timeRemaining: 40,
      opponentStamina: 70,
      playerStamina: 70,
      dist: 120,
      playerState: "idle",
      playerStateTimer: 0,
      playerTelegraphing: false,
      opponentParryWindow: 0,
    })).toBe("pressure");

    expect(getAICombatMode({
      scoreDelta: 0,
      timeRemaining: 40,
      opponentStamina: 70,
      playerStamina: 25,
      dist: 120,
      playerState: "idle",
      playerStateTimer: 0,
      playerTelegraphing: false,
      opponentParryWindow: 0,
    })).toBe("pressure");
  });

  it("classifies maai zones for strategic movement", () => {
    expect(getAIDistanceZone(150)).toBe("tohma");
    expect(getAIDistanceZone(110)).toBe("maai");
    expect(getAIDistanceZone(70)).toBe("chika");
  });

  it("creates selectable AI profiles with distinct reaction timing", () => {
    const kyu = getAIProfileConfig("kyu");
    const dan = getAIProfileConfig("dan");
    const sensei = getAIProfileConfig("sensei");

    expect(kyu.reactionMinFrames).toBeGreaterThan(dan.reactionMinFrames);
    expect(dan.blockChance).toBeCloseTo(0.7);
    expect(sensei.anticipationChance).toBeGreaterThan(dan.anticipationChance);

    const state = createInitialState("player-vs-ai", "sensei");
    expect(state.aiProfile).toBe("sensei");
    expect(state.aiDifficulty).toBe(sensei.difficulty);
  });
});
