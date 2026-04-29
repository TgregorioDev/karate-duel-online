import { describe, expect, it } from "vitest";

import {
  COMPETITION_AREA_BOUNDS,
  MATCH_START_POSITIONS,
  createInitialState,
  getPointGapWinner,
  getScoreAward,
  isFacingDefender,
  resetFighters,
  resetAttackAnimationDurations,
  setAttackAnimationDurations,
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
    expect(getScoreAward("mae-geri", { state: "idle", stateTimer: 0, exhausted: 0 }, "body")).toEqual({
      call: "WAZA-ARI",
      points: 2,
    });
    expect(getScoreAward("kick", { state: "idle", stateTimer: 0, exhausted: 0 }, "head")).toEqual({
      call: "IPPON",
      points: 3,
    });
    expect(getScoreAward("kick", { state: "idle", stateTimer: 0, exhausted: 0 }, "body")).toEqual({
      call: "WAZA-ARI",
      points: 2,
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

  it("keeps the forward lunge visible during long 3D attack animations", () => {
    setAttackAnimationDurations({ "gyaku-zuki": 96 });

    try {
      const state = createInitialState();
      state.gameStatus = "fighting";
      state.player.x = MATCH_START_POSITIONS.player;
      state.opponent.x = MATCH_START_POSITIONS.opponent + 120;
      const startX = state.player.x;
      const input = emptyInput();
      input.gyakuZuki = true;

      updateGame(state, input, 1);
      expect(state.player.x).toBeGreaterThan(startX);

      for (let frame = 0; frame < 8; frame += 1) {
        updateGame(state, emptyInput(), 1);
      }

      expect(state.player.x).toBeGreaterThan(startX + 24);
      expect(state.player.lungeFramesLeft).toBeGreaterThan(0);
    } finally {
      resetAttackAnimationDurations();
    }
  });

  it("does not score during early windup even if fighters overlap", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "punch";
    state.player.stateTimer = 11;
    state.player.attackTimerMax = 12;
    state.player.attackContacted = false;

    updateGame(state, emptyInput(), 1);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
  });

  it("starts held-guard defense as soon as an attack enters collision range", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "gyaku-zuki";
    state.player.stateTimer = 14;
    state.player.attackTimerMax = 14;
    state.player.attackContacted = false;
    state.opponent.state = "block";
    state.opponent.blockTimer = 18;
    const opponentInput = emptyInput();
    opponentInput.block = true;

    updateGame(state, emptyInput(), 1, opponentInput);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
    expect(state.player.attackContacted).toBe(true);
    expect(state.opponent.state).toBe("uchi-uke");
    expect(state.judgeMessage).toBe("");
    expect(state.judgeTimer).toBe(0);
  });

  it("scores near impact when an active attack collides before the old single hit frame", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "punch";
    state.player.stateTimer = 8;
    state.player.attackTimerMax = 12;
    state.player.attackContacted = false;
    state.opponent.state = "uchi-uke";
    state.opponent.stateTimer = 10;

    updateGame(state, emptyInput(), 1);

    expect(state.gameStatus).toBe("point-scored");
    expect(state.pointScoredBy).toBe("player");
    expect(state.player.score).toBe(1);
  });

  it("stops hit checks as soon as a point is scored", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";

    state.player.state = "punch";
    state.player.stateTimer = 8;
    state.player.attackTimerMax = 12;
    state.player.attackContacted = false;

    state.opponent.state = "punch";
    state.opponent.stateTimer = 8;
    state.opponent.attackTimerMax = 12;
    state.opponent.attackContacted = false;

    updateGame(state, emptyInput(), 1);

    expect(state.gameStatus).toBe("point-scored");
    expect(state.player.score + state.opponent.score).toBe(1);
  });

  it("scores mawashi-geri as ippon on jodan contact", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 520;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "kick";
    state.player.stateTimer = 10;
    state.player.attackTimerMax = 18;
    state.player.attackContacted = false;

    updateGame(state, emptyInput(), 1);

    expect(state.gameStatus).toBe("point-scored");
    expect(state.player.score).toBe(3);
    expect(state.judgeMessage).toBe("YAME! IPPON! +3");
  });

  it("scores mawashi-geri as waza-ari on chudan contact", () => {
    const state = createInitialState();
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 500;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "kick";
    state.player.stateTimer = 10;
    state.player.attackTimerMax = 18;
    state.player.attackContacted = false;

    updateGame(state, emptyInput(), 1);

    expect(state.gameStatus).toBe("point-scored");
    expect(state.player.score).toBe(2);
    expect(state.judgeMessage).toBe("YAME! WAZA-ARI! +2");
  });

  it("lets both local players start attacks on the same frame", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 360;
    state.opponent.x = 600;
    const playerInput = emptyInput();
    const opponentInput = emptyInput();
    playerInput.punch = true;
    opponentInput.punch = true;

    updateGame(state, playerInput, 1, opponentInput);

    expect(state.player.state).toBe("punch");
    expect(state.opponent.state).toBe("punch");
  });

  it("ignores player two keyboard input while in player-vs-ai mode", () => {
    const state = createInitialState("player-vs-ai");
    state.gameStatus = "fighting";
    const playerInput = emptyInput();
    const opponentInput = emptyInput();
    opponentInput.punch = true;

    updateGame(state, playerInput, 1, opponentInput);

    expect(state.opponent.state).not.toBe("punch");
  });

  it("defends any incoming jodan attack while guard is held", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 520;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "kick";
    state.player.stateTimer = 10;
    state.player.attackTimerMax = 18;
    state.player.attackContacted = false;
    state.opponent.state = "block";
    state.opponent.blockTimer = 14;
    const opponentInput = emptyInput();
    opponentInput.block = true;

    updateGame(state, emptyInput(), 1, opponentInput);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
    expect(state.opponent.state).toBe("uchi-uke");
    expect(state.opponent.parryWindow).toBe(0);
    expect(state.judgeMessage).toBe("");
    expect(state.judgeTimer).toBe(0);
  });

  it("uses gedan-barai for chudan kick defense", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 500;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "kick";
    state.player.stateTimer = 10;
    state.player.attackTimerMax = 18;
    state.player.attackContacted = false;
    state.opponent.state = "block";
    state.opponent.blockTimer = 14;
    const opponentInput = emptyInput();
    opponentInput.block = true;

    updateGame(state, emptyInput(), 1, opponentInput);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
    expect(state.opponent.state).toBe("gedan-barai");
    expect(state.judgeMessage).toBe("");
    expect(state.judgeTimer).toBe(0);
  });

  it("lets sustained guard block without awarding a counter window", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "punch";
    state.player.stateTimer = 8;
    state.player.attackTimerMax = 12;
    state.player.attackContacted = false;
    state.opponent.state = "block";
    state.opponent.blockTimer = 40;
    const opponentInput = emptyInput();
    opponentInput.block = true;

    updateGame(state, emptyInput(), 1, opponentInput);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
    expect(state.opponent.state).toBe("uchi-uke");
    expect(state.opponent.parryWindow).toBe(0);
  });

  it("continues defending while the guard button is held during a defense animation", () => {
    const state = createInitialState("local-1v1");
    state.gameStatus = "fighting";
    state.player.x = 420;
    state.opponent.x = 490;
    state.player.facing = "right";
    state.opponent.facing = "left";
    state.player.state = "punch";
    state.player.stateTimer = 8;
    state.player.attackTimerMax = 12;
    state.player.attackContacted = false;
    state.opponent.state = "uchi-uke";
    state.opponent.stateTimer = 8;
    state.opponent.guardHeld = true;
    const opponentInput = emptyInput();
    opponentInput.block = true;

    updateGame(state, emptyInput(), 1, opponentInput);

    expect(state.gameStatus).toBe("fighting");
    expect(state.player.score).toBe(0);
    expect(state.opponent.state).toBe("uchi-uke");
    expect(state.judgeMessage).toBe("");
    expect(state.judgeTimer).toBe(0);
  });
});
