import type { GeminiMergedObservation, GeminiPhotoReading } from "./geminiObservationBatch";
import { featureKindFromLabel, type ReadingFeatureInput, type ReadingPlaceInput } from "./recordReading";

export function validPhotoReadings(photos: readonly GeminiPhotoReading[] | undefined, imageCount: number): GeminiPhotoReading[] {
  const seen = new Set<number>();
  const out: GeminiPhotoReading[] = [];
  for (const photo of photos ?? []) {
    if (!Number.isInteger(photo.asset_index) || photo.asset_index < 0 || photo.asset_index >= imageCount || seen.has(photo.asset_index)) continue;
    seen.add(photo.asset_index);
    out.push(photo);
  }
  return out.sort((left, right) => left.asset_index - right.asset_index);
}

export function recordReadingInputs(
  merged: GeminiMergedObservation,
  imageCount: number,
  cueIndexUnknown: boolean,
): { features: ReadingFeatureInput[]; place: ReadingPlaceInput[] } {
  const single = imageCount === 1;
  const features: ReadingFeatureInput[] = [];
  const seen = new Set<string>();
  const add = (kind: string, assetIndex: number | undefined) => {
    const key = `${kind}:${assetIndex ?? "record"}`;
    if (seen.has(key)) return;
    seen.add(key);
    features.push({ kind, assetIndex });
  };
  const allowFeatures = merged.recordClass !== "person" && merged.recordClass !== "document";
  const photos = validPhotoReadings(merged.environment.photos, imageCount);
  if (allowFeatures) for (const photo of photos) for (const kind of photo.feature_kinds) add(kind, photo.asset_index);
  if (allowFeatures && !cueIndexUnknown) {
    for (const cue of merged.environment.cues) {
      const kind = featureKindFromLabel(cue.label, false);
      if (kind) add(kind, Number.isInteger(cue.asset_index) ? cue.asset_index : undefined);
    }
  }
  if (allowFeatures) {
    const covered = new Set(features.map((feature) => feature.kind));
    for (const kind of merged.featureKinds ?? []) if (!covered.has(kind)) add(kind, undefined);
  }
  if (photos.length > 0) {
    return {
      features,
      place: photos.map((photo) => ({
        assetIndex: photo.asset_index,
        fields: photo.fields,
        assessmentState: photo.assessment_state,
        scope: "photo" as const,
      })),
    };
  }
  return {
    features,
    place: [{
      assetIndex: single ? 0 : undefined,
      fields: merged.environment.fields,
      assessmentState: merged.environment.assessment_state,
      scope: single ? "photo" : "photo_set",
    }],
  };
}
