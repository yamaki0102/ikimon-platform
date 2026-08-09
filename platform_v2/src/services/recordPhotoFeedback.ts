import { generateAiTextWithRoleChain, type AiRouterPart } from "./aiModelRouter.js";
import { normalizeEnvironmentRecordDraft } from "./environmentRecord.js";

export type RecordPhotoFeedbackImage = {
  mimeType: string;
  base64Data: string;
};

export type RecordPhotoFeedbackContext = {
  hasVideo?: boolean;
  hasLocation?: boolean;
  photoCount?: number;
  userNote?: string | null;
  taxonName?: string | null;
};

export type RecordPhotoFeedbackInput = {
  userId?: string | null;
  images: RecordPhotoFeedbackImage[];
  context?: RecordPhotoFeedbackContext | null;
};

export type RecordPhotoFeedbackResult = {
  sentence: string;
  visualSignals: string[];
  priority: "subject_clarity" | "angle" | "context" | "lighting" | "scale" | "already_good";
  environmentDraft: Record<string, string>;
  model?: string;
};

const MAX_IMAGES = 3;
const MAX_IMAGE_BASE64_LENGTH = 2_200_000;
const VALID_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function stripDataUrl(value: string): string {
  const comma = value.indexOf(",");
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value) && comma >= 0) {
    return value.slice(comma + 1);
  }
  return value;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function normalizeRecordPhotoFeedbackImages(raw: unknown): RecordPhotoFeedbackImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const mimeType = cleanText(item.mimeType, 80).toLowerCase();
      const base64Data = stripDataUrl(cleanText(item.base64Data, MAX_IMAGE_BASE64_LENGTH + 256));
      return { mimeType, base64Data };
    })
    .filter((item) =>
      VALID_IMAGE_MIME.has(item.mimeType) &&
      item.base64Data.length > 80 &&
      item.base64Data.length <= MAX_IMAGE_BASE64_LENGTH &&
      /^[a-z0-9+/=\r\n]+$/i.test(item.base64Data)
    )
    .slice(0, MAX_IMAGES);
}

export function normalizeRecordPhotoFeedbackContext(raw: unknown): RecordPhotoFeedbackContext {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const photoCount = Number(value.photoCount);
  return {
    hasVideo: Boolean(value.hasVideo),
    hasLocation: Boolean(value.hasLocation),
    photoCount: Number.isFinite(photoCount) && photoCount >= 0 ? Math.min(12, Math.floor(photoCount)) : undefined,
    userNote: cleanText(value.userNote, 220) || null,
    taxonName: cleanText(value.taxonName, 120) || null,
  };
}

export function sanitizeRecordPhotoFeedbackResponse(rawText: string): Omit<RecordPhotoFeedbackResult, "model"> {
  let parsed: Record<string, unknown> = {};
  try {
    const match = rawText.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) as Record<string, unknown> : {};
  } catch {
    parsed = {};
  }

  const priorityRaw = cleanText(parsed.priority, 40);
  const priority = (
    ["subject_clarity", "angle", "context", "lighting", "scale", "already_good"].includes(priorityRaw)
      ? priorityRaw
      : "context"
  ) as RecordPhotoFeedbackResult["priority"];
  const visualSignals = Array.isArray(parsed.visualSignals)
    ? parsed.visualSignals.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 4)
    : [];
  const sentence = cleanText(parsed.sentence, 120)
    || fallbackRecordPhotoFeedbackSentence(priority, visualSignals);
  const environmentDraft = normalizeEnvironmentRecordDraft(
    parsed.environmentDraft ?? parsed.environment_record_draft,
    { method: "record_photo_feedback_v1", source: "record_photo_feedback_v1" },
  );

  return {
    sentence,
    visualSignals,
    priority,
    environmentDraft,
  };
}

export function fallbackRecordPhotoFeedbackSentence(
  priority: RecordPhotoFeedbackResult["priority"],
  visualSignals: string[] = [],
): string {
  const firstSignal = visualSignals[0];
  if (priority === "subject_clarity") return "主役が少し読み取りにくいので、次は対象にもう一歩寄ってピントが合う1枚を足すと見分けやすくなります。";
  if (priority === "angle") return "見えている特徴が限られるので、次は別角度から葉・花・体の横側などが分かる1枚を足すと確認しやすくなります。";
  if (priority === "lighting") return "光の当たり方で細部が弱いので、次は明るい向きに回って模様や輪郭が見える1枚を足すと使いやすくなります。";
  if (priority === "scale") return "大きさの手がかりが弱いので、次は葉・指先・地面など周囲との比較が分かる1枚を足すと記録価値が上がります。";
  if (priority === "already_good") return firstSignal
    ? `${firstSignal}が見えています。次は気になった特徴を短くメモすると、あとで見分け直しやすくなります。`
    : "主役の特徴は見えています。次は気になった特徴を短くメモすると、あとで見分け直しやすくなります。";
  return "周囲の文脈が少し弱いので、次は対象と生えている場所・とまっている場所が一緒に分かる1枚を足すと見返しやすくなります。";
}

function buildRecordPhotoFeedbackPrompt(context: RecordPhotoFeedbackContext): string {
  return `ZUKANの観察記録フォームで、ユーザーが選んだ写真を見て「次にどう撮ると観察データとして良くなるか」を日本語で1文だけ返してください。

目的:
- 種名の確定ではなく、撮り方・記録の質を上げる助言に限定する。
- 写真に実際に見える弱点を優先する。
- 断定的な同定、医療・危険判断、希少種位置の示唆はしない。
- ユーザーを責めず、次の1アクションにする。

記録コンテキスト:
- 写真枚数: ${context.photoCount ?? "不明"}
- 動画あり: ${context.hasVideo ? "はい" : "いいえ"}
- 場所あり: ${context.hasLocation ? "はい" : "いいえ"}
- 入力名: ${context.taxonName || "未入力"}
- メモ: ${context.userNote || "未入力"}

返却JSON:
{
  "sentence": "80字前後の日本語1文。文末は「ます。」",
  "priority": "subject_clarity|angle|context|lighting|scale|already_good",
  "visualSignals": ["写真から見えた根拠を短く最大4つ"],
  "environmentDraft": {
    "place_type": {"value": "grassland_urban_edge|urban|woodland|water_edge|wetland|coast|unknown", "confidence": 0.0},
    "contact_surface": {"value": "soil_gravel_litter|soil|plant|water|rock|artificial|unknown", "confidence": 0.0},
    "surrounding_cover": {"value": "low_grass|trees_shrubs|bare_ground|water|snow|built_surface|unknown", "confidence": 0.0},
    "environment_condition": {"value": "open_dry|sunny|shaded|wet|flowing|windy|unknown", "confidence": 0.0},
    "human_change": {"value": "trampling_mowing|mowing|trampling|planting|construction|release|none_visible|unknown", "confidence": 0.0}
  }
}

environmentDraft は写真から無理なく見える範囲だけ選ぶ。迷う項目は unknown。位置情報、施設名、精密な場所は推測しない。
JSONのみ。コードブロック不要。`;
}

export async function generateRecordPhotoFeedback(input: RecordPhotoFeedbackInput): Promise<RecordPhotoFeedbackResult> {
  const images = normalizeRecordPhotoFeedbackImages(input.images);
  if (!images.length) throw new Error("record_feedback_image_required");
  const context = normalizeRecordPhotoFeedbackContext(input.context ?? {});
  const parts: AiRouterPart[] = images.map((image) => ({
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64Data,
    },
  }));
  parts.push({ text: buildRecordPhotoFeedbackPrompt(context) });

  const response = await generateAiTextWithRoleChain({
    chainName: "observationVisualExtract",
    parts,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: "minimal" },
    maxOutputTokens: 960,
    temperature: 0.2,
    retriesPerModel: 1,
    cost: {
      layer: "hot",
      endpoint: "record_photo_feedback",
      userId: input.userId ?? null,
      metadata: {
        photoCount: context.photoCount ?? images.length,
        hasVideo: Boolean(context.hasVideo),
        hasLocation: Boolean(context.hasLocation),
      },
    },
  });

  return {
    ...sanitizeRecordPhotoFeedbackResponse(response.text),
    model: `${response.provider}:${response.model}`,
  };
}
