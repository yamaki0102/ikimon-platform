import sharp from "sharp";

export type VideoFrameFeature = {
  frameTimeMs: number;
  brightness: number;
  edgeScore: number;
  diffScore: number;
  colorDiffScore: number;
  qualityScore: number;
};

export type VideoFrameSelection = VideoFrameFeature & {
  selectionScore: number;
  selectionReason: string;
};

export type VideoFrameImage = {
  frameTimeMs: number;
  frameUrl: string;
  mime: string;
  bytes: Buffer;
};

export type AdaptiveVideoFrame = VideoFrameImage & {
  selectionScore: number;
  selectionReason: string;
  differenceScore: number;
  qualityScore: number;
};

const FALLBACK_UNKNOWN_DURATION_TIMES_MS = [1000, 2000, 4000];
const MAX_SCORING_FRAMES = 36;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function uniqueTimes(times: number[], minGapMs: number): number[] {
  const out: number[] = [];
  for (const time of times
    .map((value) => Math.max(0, Math.round(value)))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)) {
    if (out.every((existing) => Math.abs(existing - time) >= minGapMs)) {
      out.push(time);
    }
  }
  return out;
}

export function fallbackVideoFrameTimesMs(durationMs: number | null | undefined): number[] {
  const duration = Number(durationMs ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) return [...FALLBACK_UNKNOWN_DURATION_TIMES_MS];
  if (duration <= 1200) return [Math.max(100, Math.round(duration * 0.5))];
  if (duration <= 5000) {
    return uniqueTimes([
      Math.min(800, duration * 0.25),
      duration * 0.5,
      Math.max(400, duration - 500),
    ], 400);
  }
  return uniqueTimes([
    Math.max(800, duration * 0.12),
    duration * 0.32,
    duration * 0.5,
    duration * 0.68,
    Math.min(duration - 500, duration * 0.88),
  ], 400).slice(0, 5);
}

export function adaptiveCandidateFrameTimesMs(durationMs: number | null | undefined): number[] {
  const duration = Number(durationMs ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) return fallbackVideoFrameTimesMs(durationMs);
  if (duration <= 1200) return fallbackVideoFrameTimesMs(durationMs);

  const start = Math.min(Math.max(250, duration * 0.04), Math.max(0, duration - 100));
  const end = Math.max(start, duration - Math.min(350, duration * 0.06));
  const interval =
    duration <= 5000 ? 500 :
    duration <= 30000 ? 1000 :
    duration <= 120000 ? 2000 :
    Math.max(2000, Math.ceil(duration / (MAX_SCORING_FRAMES - 1)));

  const times: number[] = [];
  for (let time = start; time <= end && times.length < MAX_SCORING_FRAMES; time += interval) {
    times.push(time);
  }
  if (times.length < 2) times.push(duration * 0.5);
  return uniqueTimes(times, Math.min(400, interval * 0.6)).slice(0, MAX_SCORING_FRAMES);
}

function histogramDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    distance += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return clamp01(distance / 2);
}

export async function extractVideoFrameFeature(
  frameTimeMs: number,
  bytes: Buffer,
  previous?: { grays: number[]; histogram: number[] } | null,
): Promise<{ feature: VideoFrameFeature; grays: number[]; histogram: number[] }> {
  const width = 32;
  const height = 24;
  const raw = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const grays: number[] = [];
  const histogram = new Array<number>(12).fill(0);
  let brightness = 0;
  let edge = 0;
  let diff = 0;
  const pixels = width * height;
  for (let i = 0; i < raw.length; i += 3) {
    const r = raw[i] ?? 0;
    const g = raw[i + 1] ?? 0;
    const b = raw[i + 2] ?? 0;
    const gray = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    const index = grays.length;
    grays.push(gray);
    brightness += gray;
    if (previous?.grays[index] != null) diff += Math.abs(gray - previous.grays[index]!);
    histogram[Math.min(3, Math.floor(r / 64))]! += 1 / pixels;
    histogram[4 + Math.min(3, Math.floor(g / 64))]! += 1 / pixels;
    histogram[8 + Math.min(3, Math.floor(b / 64))]! += 1 / pixels;
  }
  for (let y = 1; y < height; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const index = y * width + x;
      edge += Math.abs(grays[index]! - grays[index - 1]!) + Math.abs(grays[index]! - grays[index - width]!);
    }
  }
  const brightnessMean = brightness / Math.max(1, pixels);
  const brightnessQuality = 1 - Math.min(1, Math.abs(brightnessMean - 0.52) / 0.52);
  const edgeScore = clamp01((edge / Math.max(1, pixels)) * 3.2);
  const diffScore = previous ? clamp01((diff / Math.max(1, pixels)) * 4) : 0;
  const colorDiffScore = previous ? histogramDistance(histogram, previous.histogram) : 0;
  const qualityScore = clamp01(brightnessQuality * 0.45 + edgeScore * 0.55);
  return {
    feature: {
      frameTimeMs,
      brightness: Number(brightnessMean.toFixed(4)),
      edgeScore: Number(edgeScore.toFixed(4)),
      diffScore: Number(diffScore.toFixed(4)),
      colorDiffScore: Number(colorDiffScore.toFixed(4)),
      qualityScore: Number(qualityScore.toFixed(4)),
    },
    grays,
    histogram,
  };
}

function selectionReason(feature: VideoFrameFeature): string {
  const reasons = [
    feature.diffScore >= 0.22 || feature.colorDiffScore >= 0.18 ? "場面差分が大きい" : "",
    feature.edgeScore >= 0.18 ? "輪郭が見える" : "",
    feature.brightness >= 0.22 && feature.brightness <= 0.82 ? "明るさが使える" : "",
  ].filter(Boolean);
  return reasons.length > 0 ? reasons.join(" / ") : "代表フレーム";
}

export function selectAdaptiveVideoFramesFromFeatures(
  features: VideoFrameFeature[],
  options: { maxSelected?: number; minSelected?: number; minGapMs?: number } = {},
): VideoFrameSelection[] {
  const clean = features
    .filter((feature) => Number.isFinite(feature.frameTimeMs))
    .sort((a, b) => a.frameTimeMs - b.frameTimeMs);
  if (clean.length === 0) return [];
  const maxSelected = Math.max(1, Math.min(8, Math.floor(options.maxSelected ?? 6)));
  const minSelected = Math.max(1, Math.min(maxSelected, Math.floor(options.minSelected ?? 1)));
  const minGapMs = Math.max(400, Math.floor(options.minGapMs ?? 1200));
  const scored = clean.map((feature, index) => {
    const temporalBoost = index === 0 ? 0.04 : 0;
    const differenceScore = Math.max(feature.diffScore, feature.colorDiffScore);
    const score = clamp01(differenceScore * 0.62 + feature.qualityScore * 0.33 + temporalBoost);
    return {
      ...feature,
      selectionScore: Number(score.toFixed(4)),
      selectionReason: selectionReason(feature),
    };
  });

  const threshold = clean.length <= 3 ? 0.22 : 0.28;
  const selected: VideoFrameSelection[] = [];
  for (const candidate of scored
    .filter((item) => item.selectionScore >= threshold || item.diffScore >= 0.24 || item.colorDiffScore >= 0.2)
    .sort((a, b) => b.selectionScore - a.selectionScore)) {
    if (selected.length >= maxSelected) break;
    if (selected.every((item) => Math.abs(item.frameTimeMs - candidate.frameTimeMs) >= minGapMs)) {
      selected.push(candidate);
    }
  }

  for (const candidate of scored.sort((a, b) => b.selectionScore - a.selectionScore)) {
    if (selected.length >= minSelected) break;
    if (!selected.some((item) => item.frameTimeMs === candidate.frameTimeMs)) {
      selected.push(candidate);
    }
  }

  return selected.sort((a, b) => a.frameTimeMs - b.frameTimeMs);
}

