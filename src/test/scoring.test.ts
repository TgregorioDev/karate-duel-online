import { describe, expect, it } from "vitest";

import {
  COMPETITION_AREA_BOUNDS,
  MATCH_START_POSITIONS,
  createInitialState,
  getPointGapWinner,
  getScoreAward,
  isFacingDefender,
  resetFighters,
  updateGame,
} from "@/game/engine";

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

describe("kumite scoring", () => {
  it("awards yuko for punches and gyaku-zuki", () => {
    expect(getScoreAward("punch", { state: "idle", stateTimer: 0, exhausted: 0 })).toEqual({
      call: "YUKO",
      points: 1,
    });
    expect(getScoreAward("gyaku-zuki", { state: "idle", stateTimer: 0, exhausted: 0 })).toEqual({
      call: "YUKO",
      points: 1,
    });
  });

  it("awards waza-ari for trunk kicks and ippon for jodan kicks", () => {
    expect(getScoreAward("mae-geri", { state: "idle", stateTimer: 0, exhausted: 0 })).toEqual({
      call: "WAZA-ARI",
      points: 2,
    });
    expect(getScoreAward("kick", { state: "idle", stateTimer: 0, exhausted: 0 })).toEqual({
      call: "IPPON",
      points: 3,
    });
  });

  it("awards ippon against a downed opponent regardless of the technique", () => {
    expect(getScoreAward("punch", { state: "hit", stateTimer: 12, exhausted: 0 })).toEqual({
      call: "IPPON",
      points: 3,
    });
    expect(getScoreAward("mae-geri", { state: "idle", stateTimer: 0, exhausted: 30 })).toEqual({
      call: "IPPON",
      points: 3,
    });
  });

  it("detects automatic victory on an 8-point lead", () => {
    expect(getPointGapWinner(8, 0)).toBe("player");
    expect(getPointGapWinner(4, 12)).toBe("opponent");
    expect(getPointGapWinner(7, 0)).toBeNull();
  });

  it("requires the attacker to be facing the defender", () => {
    expect(isFacingDefender({ x: 280, facing: "right" }, { x: 680 })).toBe(true);
    expect(isFacingDefender({ x: 280, facing: "left" }, { x: 680 })).toBe(false);
    expect(isFacingDefender({ x: 680, facing: "left" }, { x: 280 })).toBe(true);
  });

  it("spawns and resets fighters on the official WKF start lines", () => {
    const state = createInitialState();

    expect(state.player.x).toBe(MATCH_START_POSITIONS.player);
    expect(state.opponent.x).toBe(MATCH_START_POSITIONS.opponent);

    state.player.x = 180;
    state.opponent.x = 760;
    state.player.state = "punch";
    state.opponent.state = "hit";
    resetFighters(state, "bow", 12);

    expect(state.player.x).toBe(MATCH_START_POSITIONS.player);
    expect(state.opponent.x).toBe(MATCH_START_POSITIONS.opponent);
    expect(state.player.state).toBe("bow");
    expect(state.opponent.state).toBe("bow");
    expect(state.player.stateTimer).toBe(12);
    expect(state.opponent.stateTimer).toBe(12);
  });

  it("registers jogai when a fighter steps onto the red safety area", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = COMPETITION_AREA_BOUNDS.left + state.player.width * 0.5 - 1;

    updateGame(state, emptyInput(), 1);

    expect(state.areaWarningBy).toBe("player");
    expect(state.judgeMessage).toBe("JOGAI AKA");
    expect(state.areaWarningTimer).toBeGreaterThan(0);
  });

  it("returns fighters to the official marks before the post-point bow", () => {
    const state = createInitialState();
    state.gameStatus = "point-scored";
    state.judgeTimer = 0;
    state.player.x = 220;
    state.opponent.x = 740;

    updateGame(state, emptyInput(), 1);

    expect(state.player.x).toBe(MATCH_START_POSITIONS.player);
    expect(state.opponent.x).toBe(MATCH_START_POSITIONS.opponent);
    expect(state.player.state).toBe("bow");
    expect(state.opponent.state).toBe("bow");
  });
});
