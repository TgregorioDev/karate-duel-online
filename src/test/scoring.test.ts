import { describe, expect, it } from "vitest";

import { getPointGapWinner, getScoreAward, isFacingDefender } from "@/game/engine";

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
});
