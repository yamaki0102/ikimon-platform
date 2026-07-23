export type ObservationMediaDedupInput = {
  mediaId: string;
  displayOrder: number;
  contentSha256?: string | null;
  sourceSha256?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  bytes?: number | null;
  perceptualHashes?: readonly string[] | null;
  sharpnessScore?: number | null;
  targetRegionRatio?: number | null;
  compressionQuality?: number | null;
  cropSafetyScore?: number | null;
};

export type ObservationMediaDuplicateKind = "exact" | "near_duplicate";

export type ObservationMediaRepresentativeReason =
  | "higher_resolution"
  | "sharper_image"
  | "larger_subject_region"
  | "higher_compression_quality"
  | "safer_crop"
  | "larger_source_bytes"
  | "earlier_display_order";

export type ObservationMediaDedupCluster = {
  clusterId: string;
  kind: ObservationMediaDuplicateKind;
  representativeMediaId: string;
  representativeReason: ObservationMediaRepresentativeReason;
  memberMediaIds: string[];
  confidence: number;
};

export type ObservationMediaDedupPlan<T extends ObservationMediaDedupInput> = {
  sourceCount: number;
  representatives: T[];
  excluded: Array<{
    mediaId: string;
    duplicateOfMediaId: string;
    duplicateKind: ObservationMediaDuplicateKind;
    clusterId: string;
    confidence: number;
  }>;
  clusters: ObservationMediaDedupCluster[];
  ruleVersion: "observation-media-dedup-v1";
};

const EXACT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const PERCEPTUAL_HASH_PATTERN = /^[a-f0-9]{16}$/;
const NEAR_DUPLICATE_HAMMING_DISTANCE = 6;
const ASPECT_RATIO_TOLERANCE = 0.025;

function normalizedHash(value: string | null | undefined, pattern: RegExp): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return pattern.test(normalized) ? normalized : null;
}

function exactKeys(input: ObservationMediaDedupInput): string[] {
  return [input.contentSha256, input.sourceSha256]
    .map((value) => normalizedHash(value, EXACT_HASH_PATTERN))
    .filter((value): value is string => Boolean(value));
}

function perceptualHashes(input: ObservationMediaDedupInput): string[] {
  return [...new Set(
    (input.perceptualHashes ?? [])
      .map((value) => normalizedHash(value, PERCEPTUAL_HASH_PATTERN))
      .filter((value): value is string => Boolean(value)),
  )];
}

function hammingDistance(left: string, right: string): number {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    let value = Number.parseInt(left[index] ?? "0", 16) ^ Number.parseInt(right[index] ?? "0", 16);
    while (value > 0) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance;
}

function normalizedAspectRatio(input: ObservationMediaDedupInput): number | null {
  const width = Number(input.widthPx ?? 0);
  const height = Number(input.heightPx ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return Math.max(width, height) / Math.min(width, height);
}

function isExactDuplicate(left: ObservationMediaDedupInput, right: ObservationMediaDedupInput): boolean {
  const rightKeys = new Set(exactKeys(right));
  return exactKeys(left).some((key) => rightKeys.has(key));
}

function nearDuplicateDistance(
  left: ObservationMediaDedupInput,
  right: ObservationMediaDedupInput,
): number | null {
  const leftAspect = normalizedAspectRatio(left);
  const rightAspect = normalizedAspectRatio(right);
  if (leftAspect === null || rightAspect === null || Math.abs(leftAspect - rightAspect) > ASPECT_RATIO_TOLERANCE) {
    return null;
  }
  const leftHashes = perceptualHashes(left);
  const rightHashes = perceptualHashes(right);
  if (leftHashes.length === 0 || rightHashes.length === 0) {
    return null;
  }
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const leftHash of leftHashes) {
    for (const rightHash of rightHashes) {
      bestDistance = Math.min(bestDistance, hammingDistance(leftHash, rightHash));
    }
  }
  return bestDistance <= NEAR_DUPLICATE_HAMMING_DISTANCE ? bestDistance : null;
}

function imageArea(input: ObservationMediaDedupInput): number {
  const width = Number(input.widthPx ?? 0);
  const height = Number(input.heightPx ?? 0);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width * height
    : 0;
}

const QUALITY_FIELDS: Array<{
  reason: ObservationMediaRepresentativeReason;
  value: (input: ObservationMediaDedupInput) => number;
}> = [
  { reason: "higher_resolution", value: imageArea },
  { reason: "sharper_image", value: (input) => Number(input.sharpnessScore ?? 0) },
  { reason: "larger_subject_region", value: (input) => Number(input.targetRegionRatio ?? 0) },
  { reason: "higher_compression_quality", value: (input) => Number(input.compressionQuality ?? 0) },
  { reason: "safer_crop", value: (input) => Number(input.cropSafetyScore ?? 0) },
  { reason: "larger_source_bytes", value: (input) => Number(input.bytes ?? 0) },
];

function compareRepresentatives(
  left: ObservationMediaDedupInput,
  right: ObservationMediaDedupInput,
): number {
  for (const field of QUALITY_FIELDS) {
    const difference = field.value(right) - field.value(left);
    if (difference !== 0) return difference;
  }
  return left.displayOrder - right.displayOrder || left.mediaId.localeCompare(right.mediaId);
}

function representativeReason(
  representative: ObservationMediaDedupInput,
  members: ObservationMediaDedupInput[],
): ObservationMediaRepresentativeReason {
  for (const field of QUALITY_FIELDS) {
    const representativeValue = field.value(representative);
    if (members.some((member) => representativeValue > field.value(member))) {
      return field.reason;
    }
  }
  return "earlier_display_order";
}

class UnionFind {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_value, index) => index);
  }

  find(index: number): number {
    const parent = this.parents[index] ?? index;
    if (parent !== index) {
      this.parents[index] = this.find(parent);
    }
    return this.parents[index] ?? index;
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) {
      this.parents[rightRoot] = leftRoot;
    }
  }
}

function nearDuplicateConfidence(maxDistance: number): number {
  return Number((1 - maxDistance / 64).toFixed(4));
}

export function buildObservationMediaDedupPlan<T extends ObservationMediaDedupInput>(
  inputs: readonly T[],
): ObservationMediaDedupPlan<T> {
  const items = [...inputs];
  const unions = new UnionFind(items.length);

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];
      if (!left || !right) continue;
      if (isExactDuplicate(left, right) || nearDuplicateDistance(left, right) !== null) {
        unions.union(leftIndex, rightIndex);
      }
    }
  }

  const grouped = new Map<number, T[]>();
  items.forEach((item, index) => {
    const root = unions.find(index);
    grouped.set(root, [...(grouped.get(root) ?? []), item]);
  });

  const representatives: T[] = [];
  const clusters: ObservationMediaDedupCluster[] = [];
  const excluded: ObservationMediaDedupPlan<T>["excluded"] = [];

  for (const members of grouped.values()) {
    const sortedMembers = [...members].sort(compareRepresentatives);
    const representative = sortedMembers[0];
    if (!representative) continue;
    representatives.push(representative);
    if (members.length === 1) continue;

    const allExact = members.every((member) => (
      member.mediaId === representative.mediaId || isExactDuplicate(representative, member)
    ));
    const kind: ObservationMediaDuplicateKind = allExact ? "exact" : "near_duplicate";
    const maximumNearDistance = kind === "near_duplicate"
      ? Math.max(
        0,
        ...members
          .filter((member) => member.mediaId !== representative.mediaId)
          .map((member) => nearDuplicateDistance(representative, member) ?? NEAR_DUPLICATE_HAMMING_DISTANCE),
      )
      : 0;
    const confidence = kind === "exact" ? 1 : nearDuplicateConfidence(maximumNearDistance);
    const stableKey = exactKeys(representative)[0]?.slice(0, 16) ?? representative.mediaId;
    const clusterId = `observation-media-dedup-v1:${kind}:${stableKey}`;
    const displaySortedMembers = [...members].sort(
      (left, right) => left.displayOrder - right.displayOrder || left.mediaId.localeCompare(right.mediaId),
    );
    const cluster: ObservationMediaDedupCluster = {
      clusterId,
      kind,
      representativeMediaId: representative.mediaId,
      representativeReason: representativeReason(representative, members),
      memberMediaIds: displaySortedMembers.map((member) => member.mediaId),
      confidence,
    };
    clusters.push(cluster);
    for (const member of displaySortedMembers) {
      if (member.mediaId === representative.mediaId) continue;
      excluded.push({
        mediaId: member.mediaId,
        duplicateOfMediaId: representative.mediaId,
        duplicateKind: kind,
        clusterId,
        confidence,
      });
    }
  }

  representatives.sort(
    (left, right) => left.displayOrder - right.displayOrder || left.mediaId.localeCompare(right.mediaId),
  );
  clusters.sort((left, right) => {
    const leftRepresentative = items.find((item) => item.mediaId === left.representativeMediaId);
    const rightRepresentative = items.find((item) => item.mediaId === right.representativeMediaId);
    return (leftRepresentative?.displayOrder ?? 0) - (rightRepresentative?.displayOrder ?? 0);
  });
  excluded.sort((left, right) => {
    const leftItem = items.find((item) => item.mediaId === left.mediaId);
    const rightItem = items.find((item) => item.mediaId === right.mediaId);
    return (leftItem?.displayOrder ?? 0) - (rightItem?.displayOrder ?? 0);
  });

  return {
    sourceCount: items.length,
    representatives,
    excluded,
    clusters,
    ruleVersion: "observation-media-dedup-v1",
  };
}
