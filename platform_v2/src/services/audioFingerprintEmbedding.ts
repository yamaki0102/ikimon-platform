const EMBEDDING_DIMENSION = 1280;

type AudioFingerprintLike = {
  peakHz?: unknown;
  centroidHz?: unknown;
  rolloffHz?: unknown;
  energy?: unknown;
  voiceBandRatio?: unknown;
  bandEnergies?: unknown;
};

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeEnergy(value: unknown): number {
  const energy = Math.max(0, asFiniteNumber(value));
  if (energy <= 0) return 0;
  return clamp01((Math.log10(energy + 1e-8) + 8) / 4);
}

function normalizeBandEnergies(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [0, 0, 0, 0, 0, 0];
  const values = raw.slice(0, 6).map((item) => Math.max(0, asFiniteNumber(item)));
  while (values.length < 6) values.push(0);
  const sum = values.reduce((acc, item) => acc + item, 0);
  return sum > 0 ? values.map((item) => item / sum) : values;
}

export function audioFingerprintToEmbedding(fingerprint: AudioFingerprintLike | null | undefined): number[] {
  const input = fingerprint ?? {};
  const features = [
    clamp01(asFiniteNumber(input.peakHz) / 12000),
    clamp01(asFiniteNumber(input.centroidHz) / 12000),
    clamp01(asFiniteNumber(input.rolloffHz) / 12000),
    normalizeEnergy(input.energy),
    clamp01(asFiniteNumber(input.voiceBandRatio)),
    ...normalizeBandEnergies(input.bandEnergies),
  ];

  const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => {
    const a = features[index % features.length] ?? 0;
    const b = features[(index * 7 + 3) % features.length] ?? 0;
    const c = features[(index * 13 + 5) % features.length] ?? 0;
    const projected = Math.sin((index + 1) * (0.37 + a * 3.1) + b * 5.7) + Math.cos((index + 1) * (0.11 + c * 2.3));
    return (projected * 0.35) + (a - b) * 0.6 + (c * 0.2);
  });

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    const fallback = new Array<number>(EMBEDDING_DIMENSION).fill(0);
    fallback[0] = 1;
    return fallback;
  }
  return vector.map((value) => Math.round((value / norm) * 1_000_000) / 1_000_000);
}

export const __test__ = { EMBEDDING_DIMENSION, normalizeBandEnergies, normalizeEnergy };
