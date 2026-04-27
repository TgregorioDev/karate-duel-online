import { describe, expect, it } from "vitest";

import {
  createClipSignature,
  getAkaFacingRotationY,
  getAoFacingRotationY,
  getPreferredAkaClipIndex,
  getPreferredAkaSourceClipIndex,
} from "@/game/akaAnimationUtils";

function makeClip(duration: number, trackNames: string[]) {
  return {
    duration,
    tracks: trackNames.map((name) => ({
      name,
      times: { length: 12 },
      values: { length: 48 },
    })),
  };
}

describe("AKA animation helpers", () => {
  it("prefers the Layer0 clip for stance when present", () => {
    const layer0 = {
      name: "Armature|mixamo.com|Layer0",
      duration: 1.433333,
      tracks: [
        { name: "mixamorigHips.position", times: { length: 12 }, values: { length: 48 } },
        { name: "mixamorigSpine.quaternion", times: { length: 12 }, values: { length: 48 } },
      ],
    };
    const bow = makeClip(2.133333, ["mixamorigHips.position", "mixamorigSpine.quaternion"]);
    const stance = makeClip(1.433333, ["mixamorigHips.position", "mixamorigSpine.quaternion"]);
    const stanceAlt = makeClip(1.433333, ["mixamorigHips.position", "mixamorigChest.quaternion"]);

    const index = getPreferredAkaClipIndex("stance", [layer0, bow, stance, stanceAlt], createClipSignature(bow));

    expect(index).toBe(0);
  });

  it("keeps the first clip for non-stance mappings", () => {
    const walk = makeClip(0.933333, ["mixamorigHips.position"]);
    const altWalk = makeClip(1.2, ["mixamorigHips.position"]);

    expect(getPreferredAkaClipIndex("walk", [walk, altWalk], createClipSignature(walk))).toBe(0);
  });

  it("selects the last distinct clip when Blender exports stacked actions", () => {
    const duplicatedBase = makeClip(0.933333, ["mixamorigHips.position"]);
    const duplicatedBaseCopy = makeClip(0.933333, ["mixamorigHips.position"]);
    const uniqueAttack = makeClip(1.166667, ["mixamorigHips.position", "mixamorigRightArm.quaternion"]);

    expect(getPreferredAkaSourceClipIndex([duplicatedBase, duplicatedBaseCopy, uniqueAttack])).toBe(2);
  });

  it("rotates the AKA toward the opponent based on X positions", () => {
    expect(getAkaFacingRotationY("right")).toBeCloseTo(Math.PI / 2, 8);
    expect(getAkaFacingRotationY("left")).toBeCloseTo(-Math.PI / 2, 8);
  });

  it("rotates the AO toward the opponent using the same base rig orientation", () => {
    expect(getAoFacingRotationY("right")).toBeCloseTo(Math.PI / 2, 8);
    expect(getAoFacingRotationY("left")).toBeCloseTo(-Math.PI / 2, 8);
  });
});
