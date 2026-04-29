type TrackLike = {
  name: string;
  times: { length: number };
  values: { length: number };
};

type ClipLike = {
  duration: number;
  tracks: TrackLike[];
};

export function createClipSignature(clip: ClipLike | null | undefined) {
  if (!clip) return "";

  const trackSignature = clip.tracks
    .map((track) => `${track.name}:${track.times.length}:${track.values.length}`)
    .join("|");

  return `${clip.duration.toFixed(6)}|${trackSignature}`;
}

export function getPreferredAkaSourceClipIndex(
  animations: ReadonlyArray<ClipLike>,
  referenceSignature?: string | null,
) {
  if (animations.length === 0) return -1;

  const signatures = animations.map((clip) => createClipSignature(clip));
  if (referenceSignature) {
    for (let index = signatures.length - 1; index >= 0; index -= 1) {
      if (signatures[index] !== referenceSignature) {
        return index;
      }
    }
  }

  for (let index = signatures.length - 1; index >= 0; index -= 1) {
    if (signatures.indexOf(signatures[index] ?? "") === index) {
      return index;
    }
  }

  return animations.length - 1;
}

export function getPreferredSourceClipIndex(
  animations: ReadonlyArray<ClipLike>,
  referenceSignature?: string | null,
) {
  return getPreferredAkaSourceClipIndex(animations, referenceSignature);
}

export function getPreferredAkaClipIndex(
  clipKey: string,
  animations: ReadonlyArray<ClipLike>,
  bowSignature?: string | null,
) {
  if (animations.length === 0) return -1;

  const layerZeroIndex = animations.findIndex((clip) => /layer0/i.test((clip as { name?: string }).name ?? ""));
  if (layerZeroIndex >= 0) {
    return layerZeroIndex;
  }

  if (clipKey !== "stance") {
    return 0;
  }

  if (animations.length === 1) return 0;

  if (bowSignature) {
    const preferredIndex = animations.findIndex((clip, index) => {
      if (clipKey === "stance" && index === 0) return false;
      return createClipSignature(clip) !== bowSignature;
    });
    if (preferredIndex >= 0) return preferredIndex;

    const fallbackIndex = animations.findIndex((clip) => createClipSignature(clip) !== bowSignature);
    if (fallbackIndex >= 0) return fallbackIndex;
  }

  return clipKey === "stance" && animations.length > 1 ? 1 : 0;
}

export function getAkaFacingRotationY(facing: "left" | "right") {
  return facing === "right" ? Math.PI / 2 : -Math.PI / 2;
}

export function getAoFacingRotationY(facing: "left" | "right") {
  return facing === "right" ? Math.PI / 2 : -Math.PI / 2;
}

export function getFighterFacingRotationY(facing: "left" | "right", side: "aka" | "ao") {
  return side === "aka" ? getAkaFacingRotationY(facing) : getAoFacingRotationY(facing);
}
