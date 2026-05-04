import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { assertAllowed as assertAiBudgetAllowed } from "./aiBudgetGate.js";
import { estimateAiCostUsd } from "./aiModelPricing.js";
import { logAiCost } from "./aiCostLogger.js";
import {
  asPolygonGeometry,
  centroidFromPolygon,
  circleToPolygon,
  haversineMeters,
  validateAreaPolygon,
  type PolygonGeometry,
} from "./observationEventAreaGeometry.js";
import type { AreaLocalSignals } from "./observationEventAreaSignals.js";

export type AreaPlanSuggestionId = "facility" | "safe_walk" | "nature_rich";

export interface AreaPlanSuggestion {
  id: AreaPlanSuggestionId;
  label: string;
  reason: string;
  geometry: PolygonGeometry;
  center: { lat: number; lng: number };
  radiusM: number;
  areaHa: number | null;
  warnings: string[];
  source: "gemini" | "fallback";
}

export interface AreaPlanInput {
  center: { lat: number; lng: number };
  radiusM?: number | null;
  drawnPolygon?: Record<string, unknown> | null;
  placeLabel?: string | null;
  intent?: string | null;
  nearbyFields?: Array<{ name: string; source?: string | null; distanceKm?: number | null }>;
  siteBrief?: unknown;
  localSignals?: AreaLocalSignals | null;
  userId?: string | null;
}

interface RawSuggestion {
  id?: unknown;
  label?: unknown;
  reason?: unknown;
  geometry?: unknown;
  warnings?: unknown;
}

const PROMPT_VERSION = "observation_event_area_planner.md/v1";
const MODEL_CHAIN = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"] as const;

function promptTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../prompts/observation_event_area_planner.md"),
    resolve(here, "../../src/prompts/observation_event_area_planner.md"),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  return "Return JSON suggestions for observation event area planning.\n${input_json}";
}

function safeRadius(input: AreaPlanInput): number {
  const raw = input.radiusM ?? 300;
  return Number.isFinite(raw) ? Math.max(80, Math.min(1_500, Number(raw))) : 300;
}

function geometryRadiusM(geometry: PolygonGeometry, center: { lat: number; lng: number }, fallback: number): number {
  const validation = validateAreaPolygon(geometry);
  const bbox = validation.bbox;
  if (!bbox) return fallback;
  const ns = Math.abs(bbox.maxLat - bbox.minLat) * 111_000;
  const ew = Math.abs(bbox.maxLng - bbox.minLng) * 111_000 * Math.cos((center.lat * Math.PI) / 180);
  return Math.max(50, Math.round(Math.max(ns, ew) / 2));
}

function labelFor(id: AreaPlanSuggestionId, placeLabel?: string | null): string {
  if (id === "facility") return placeLabel ? `${placeLabel}敷地寄せ` : "施設・集合場所寄せ";
  if (id === "safe_walk") return "安全な徒歩圏";
  return "自然観察寄せ";
}

function fallbackGeometry(input: AreaPlanInput, id: AreaPlanSuggestionId): PolygonGeometry {
  const base = asPolygonGeometry(input.drawnPolygon) ?? circleToPolygon(input.center.lat, input.center.lng, safeRadius(input));
  const center = centroidFromPolygon(base) ?? input.center;
  const radius = safeRadius(input);
  const nearestMajorRoadM = input.localSignals?.majorRoads[0]?.distanceM ?? null;
  if (id === "facility") {
    const roadFactor = nearestMajorRoadM !== null && nearestMajorRoadM < 180 ? 0.62 : 0.75;
    return circleToPolygon(center.lat, center.lng, Math.max(100, Math.round(radius * roadFactor)), 24);
  }
  if (id === "safe_walk") {
    const roadFactor = nearestMajorRoadM !== null && nearestMajorRoadM < 220 ? 0.45 : 0.55;
    return circleToPolygon(center.lat, center.lng, Math.max(140, Math.round(radius * roadFactor)), 24);
  }

  const nearestPark = input.localSignals?.parks.find((park) => park.distanceM <= 500);
  if (nearestPark) {
    const shiftedCenter = {
      lat: center.lat * 0.7 + nearestPark.lat * 0.3,
      lng: center.lng * 0.7 + nearestPark.lng * 0.3,
    };
    const distanceToParkM = haversineMeters(center.lat, center.lng, nearestPark.lat, nearestPark.lng);
    const parkRadius = Math.min(1_500, Math.max(Math.round(radius * 1.2), Math.round(distanceToParkM + 120)));
    return circleToPolygon(shiftedCenter.lat, shiftedCenter.lng, Math.max(220, parkRadius), 32);
  }

  const greenFactor = (input.localSignals?.greenHints.length ?? 0) > 0 ? 1.45 : 1.35;
  return circleToPolygon(center.lat, center.lng, Math.max(220, Math.round(radius * greenFactor)), 32);
}

function makeFallbackSuggestion(input: AreaPlanInput, id: AreaPlanSuggestionId): AreaPlanSuggestion {
  const geometry = fallbackGeometry(input, id);
  const validation = validateAreaPolygon(geometry);
  const center = validation.center ?? input.center;
  const warnings = [...validation.warnings];
  warnings.push(...(input.localSignals?.warnings ?? []));
  if (id === "safe_walk") warnings.push("道路横断や私有地への立ち入りは現地で確認してください。");
  if (id === "nature_rich") warnings.push("公園・緑地を含める場合は集合場所と移動時間を確認してください。");
  const nearestPark = input.localSignals?.parks[0];
  const footwayCount = input.localSignals?.footwayCount ?? 0;
  return {
    id,
    label: labelFor(id, input.placeLabel),
    reason: id === "facility"
      ? "集合場所と施設周辺を中心に、迷いにくい範囲へ寄せます。"
      : id === "safe_walk"
        ? footwayCount > 0
          ? "歩道・歩行者道の手がかりを優先し、親子や初参加者向けに範囲を締めます。"
          : "親子や初参加者が歩きやすいように、範囲を少し締めます。"
        : nearestPark
          ? `${nearestPark.name}側の緑地手がかりも拾えるよう、観察価値を広げます。`
          : "周辺の緑や水辺も見に行けるよう、観察価値を広げます。",
    geometry,
    center,
    radiusM: geometryRadiusM(geometry, center, safeRadius(input)),
    areaHa: validation.areaHa,
    warnings,
    source: "fallback",
  };
}

export function fallbackAreaPlanSuggestions(input: AreaPlanInput): AreaPlanSuggestion[] {
  return [
    makeFallbackSuggestion(input, "facility"),
    makeFallbackSuggestion(input, "safe_walk"),
    makeFallbackSuggestion(input, "nature_rich"),
  ];
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const raw = fenced ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isSuggestionId(value: unknown): value is AreaPlanSuggestionId {
  return value === "facility" || value === "safe_walk" || value === "nature_rich";
}

export function normalizeAreaPlanSuggestions(raw: unknown, input: AreaPlanInput): AreaPlanSuggestion[] {
  const obj = typeof raw === "string" ? parseJsonObject(raw) : raw;
  const list = obj && typeof obj === "object" && Array.isArray((obj as Record<string, unknown>).suggestions)
    ? ((obj as Record<string, unknown>).suggestions as RawSuggestion[])
    : [];
  const out: AreaPlanSuggestion[] = [];
  const fallback = fallbackAreaPlanSuggestions(input);
  for (const id of ["facility", "safe_walk", "nature_rich"] as const) {
    const hit = list.find((s) => isSuggestionId(s.id) && s.id === id);
    const geometry = asPolygonGeometry(hit?.geometry);
    const validation = geometry ? validateAreaPolygon(geometry) : null;
    if (!hit || !geometry || !validation?.ok) {
      out.push(fallback.find((s) => s.id === id)!);
      continue;
    }
    const center = validation.center ?? input.center;
    out.push({
      id,
      label: typeof hit.label === "string" && hit.label.trim() ? hit.label.trim().slice(0, 32) : labelFor(id, input.placeLabel),
      reason: typeof hit.reason === "string" && hit.reason.trim() ? hit.reason.trim().slice(0, 90) : fallback.find((s) => s.id === id)!.reason,
      geometry,
      center,
      radiusM: geometryRadiusM(geometry, center, safeRadius(input)),
      areaHa: validation.areaHa,
      warnings: [
        ...validation.warnings,
        ...(Array.isArray(hit.warnings) ? hit.warnings.filter((w): w is string => typeof w === "string").slice(0, 3) : []),
      ],
      source: "gemini",
    });
  }
  return out;
}

function renderPrompt(input: AreaPlanInput): string {
  const payload = {
    center: input.center,
    radius_m: safeRadius(input),
    drawn_polygon: input.drawnPolygon ?? null,
    place_label: input.placeLabel ?? null,
    intent: input.intent ?? null,
    nearby_fields: (input.nearbyFields ?? []).slice(0, 8),
    site_brief: input.siteBrief ?? null,
    local_osm_signals: input.localSignals ?? null,
    output_language: "ja",
  };
  return promptTemplate().replace("${input_json}", JSON.stringify(payload, null, 2));
}

async function callGemini(prompt: string, userId: string | null | undefined): Promise<{ text: string; model: string }> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  await assertAiBudgetAllowed("hot");
  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });
  let lastErr: unknown = null;
  for (const model of MODEL_CHAIN) {
    const started = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json", temperature: 0.35 },
      });
      const text = response.text ?? "";
      const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
      const inputTokens = Number(usage?.promptTokenCount ?? 0);
      const outputTokens = Number(usage?.candidatesTokenCount ?? 0);
      await logAiCost({
        layer: "hot",
        endpoint: "observation_event_area_suggestions",
        provider: "gemini",
        model,
        inputTokens,
        outputTokens,
        costUsd: estimateAiCostUsd({ model, inputTokens, outputTokens }),
        userId,
        latencyMs: Date.now() - started,
        metadata: { promptVersion: PROMPT_VERSION },
      }).catch(() => undefined);
      if (!text.trim()) throw new Error("gemini_empty_response");
      return { text, model };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("gemini_all_models_failed");
}

export async function planObservationEventArea(input: AreaPlanInput): Promise<{
  suggestions: AreaPlanSuggestion[];
  provider: "gemini" | "fallback";
  promptVersion: string;
}> {
  const drawnValidation = input.drawnPolygon ? validateAreaPolygon(input.drawnPolygon) : null;
  const base = drawnValidation?.ok && input.drawnPolygon
    ? input.drawnPolygon
    : circleToPolygon(input.center.lat, input.center.lng, safeRadius(input));
  const normalizedInput = { ...input, drawnPolygon: base };
  try {
    const { text } = await callGemini(renderPrompt(normalizedInput), input.userId);
    return {
      suggestions: normalizeAreaPlanSuggestions(text, normalizedInput),
      provider: "gemini",
      promptVersion: PROMPT_VERSION,
    };
  } catch {
    return {
      suggestions: fallbackAreaPlanSuggestions(normalizedInput),
      provider: "fallback",
      promptVersion: PROMPT_VERSION,
    };
  }
}

export const __test__ = {
  parseJsonObject,
  normalizeAreaPlanSuggestions,
  fallbackGeometry,
  PROMPT_VERSION,
};
