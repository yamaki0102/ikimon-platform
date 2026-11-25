import type { GeminiMergedObservation } from "./geminiObservationBatch";
import { featureKindFromLabel, type ReadingFeatureInput, type ReadingPlaceInput } from "./recordReading";

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
  if (allowFeatures && !cueIndexUnknown) {
    for (const cue of merged.environment.cues) {
      const kind = featureKindFromLabel(cue.label, false);
      if (kind) add(kind, Number.isInteger(cue.asset_index) ? cue.asset_index : undefined);
    }
  }
  if (allowFeatures) {
    const cueKinds = new Set(features.map((feature) => feature.kind));
    for (const kind of merged.featureKinds ?? []) if (!cueKinds.has(kind)) add(kind, undefined);
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
