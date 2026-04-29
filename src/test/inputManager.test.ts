import { describe, expect, it } from "vitest";

import InputManager from "@/game/InputManager";

function keyEvent(type: "keydown" | "keyup", key: string) {
  return new KeyboardEvent(type, { key });
}

describe("InputManager", () => {
  it("maps player two controls independently from player one", () => {
    const inputManager = new InputManager();

    inputManager.handleKeyDown(keyEvent("keydown", "i"));
    inputManager.handleKeyDown(keyEvent("keydown", "ArrowLeft"));
    inputManager.handleKeyDown(keyEvent("keydown", "z"));

    expect(inputManager.getOpponentInput().punch).toBe(true);
    expect(inputManager.getOpponentInput().left).toBe(true);
    expect(inputManager.getPlayerInput().punch).toBe(true);
    expect(inputManager.getPlayerInput().left).toBe(false);
  });

  it("does not retrigger attack inputs until the key is released", () => {
    const inputManager = new InputManager();

    inputManager.handleKeyDown(keyEvent("keydown", "p"));
    expect(inputManager.getOpponentInput().kick).toBe(true);

    inputManager.clearTransientInputs();
    inputManager.handleKeyDown(keyEvent("keydown", "p"));
    expect(inputManager.getOpponentInput().kick).toBe(false);

    inputManager.handleKeyUp(keyEvent("keyup", "p"));
    inputManager.handleKeyDown(keyEvent("keydown", "p"));
    expect(inputManager.getOpponentInput().kick).toBe(true);
  });
});
