import type { InputState } from "@/game/types";

type InputSlot = "player" | "opponent";
type InputAction = keyof InputState;

type KeyBinding = {
  slot: InputSlot;
  action: InputAction;
};

const TRANSIENT_ACTIONS = new Set<InputAction>(["punch", "kick", "gyakuZuki", "maeGeri"]);

const KEY_BINDINGS: Record<string, KeyBinding> = {
  a: { slot: "player", action: "left" },
  d: { slot: "player", action: "right" },
  z: { slot: "player", action: "punch" },
  v: { slot: "player", action: "gyakuZuki" },
  x: { slot: "player", action: "kick" },
  b: { slot: "player", action: "maeGeri" },
  c: { slot: "player", action: "block" },
  arrowleft: { slot: "opponent", action: "left" },
  arrowright: { slot: "opponent", action: "right" },
  i: { slot: "opponent", action: "punch" },
  o: { slot: "opponent", action: "gyakuZuki" },
  p: { slot: "opponent", action: "kick" },
  k: { slot: "opponent", action: "maeGeri" },
  l: { slot: "opponent", action: "block" },
};

function createInputState(): InputState {
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

function clearTransientInput(input: InputState) {
  input.punch = false;
  input.kick = false;
  input.gyakuZuki = false;
  input.maeGeri = false;
}

function clearInput(input: InputState) {
  input.left = false;
  input.right = false;
  input.block = false;
  clearTransientInput(input);
}

export default class InputManager {
  private readonly inputs: Record<InputSlot, InputState> = {
    player: createInputState(),
    opponent: createInputState(),
  };

  private readonly pressedKeys = new Set<string>();

  getPlayerInput() {
    return this.inputs.player;
  }

  getOpponentInput() {
    return this.inputs.opponent;
  }

  handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const binding = KEY_BINDINGS[key];
    if (!binding) return false;

    const wasPressed = this.pressedKeys.has(key);
    this.pressedKeys.add(key);
    if (wasPressed && TRANSIENT_ACTIONS.has(binding.action)) {
      return true;
    }

    this.inputs[binding.slot][binding.action] = true;
    return true;
  }

  handleKeyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    const binding = KEY_BINDINGS[key];
    if (!binding) return false;

    this.pressedKeys.delete(key);
    this.inputs[binding.slot][binding.action] = false;
    return true;
  }

  clearTransientInputs() {
    clearTransientInput(this.inputs.player);
    clearTransientInput(this.inputs.opponent);
  }

  clearAllInputs() {
    this.pressedKeys.clear();
    clearInput(this.inputs.player);
    clearInput(this.inputs.opponent);
  }
}
