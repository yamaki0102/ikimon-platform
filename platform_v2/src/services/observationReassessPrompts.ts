import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AiRouterPart } from "./aiModelRouter.js";

export type ReassessPromptImage = {
  mime: string;
  b64: string;
  assetId?: string | null;
  frameTimeMs?: number | null;
  selectionScore?: number | null;
  selectionReason?: string | null;
  differenceScore?: number | null;
  qualityScore?: number | null;
};
type ReassessImageInput = ReassessPromptImage;
type LoadedPhotoInput = ReassessPromptImage;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/observation_reassess.md");
let CACHED_PROMPT: string | null = null;

function loadPrompt(): string {
  if (CACHED_PROMPT) return CACHED_PROMPT;
  CACHED_PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  return CACHED_PROMPT;
}

export function renderPrompt(vars: Record<string, string>): string {
  let out = loadPrompt();
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

export function guessSeason(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const m = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

export function buildVisualInputParts(photos: ReassessImageInput[]): AiRouterPart[] {
  return photos.flatMap((photo, index) => {
    const asset = photo.assetId ? ` asset_id=${photo.assetId}` : "";
    const frame = typeof photo.frameTimeMs === "number" && Number.isFinite(photo.frameTimeMs)
      ? ` frame_time_ms=${Math.round(photo.frameTimeMs)}`
      : "";
    const selection = typeof photo.selectionScore === "number" && Number.isFinite(photo.selectionScore)
      ? ` selection_score=${photo.selectionScore.toFixed(2)}`
      : "";
    const reason = photo.selectionReason ? ` selection_reason=${photo.selectionReason}` : "";
    return [
      { text: `入力画像 asset_index=${index}${asset}${frame}${selection}${reason}` },
      { inlineData: { mimeType: photo.mime, data: photo.b64 } },
    ];
  });
}

export function formatInputMediaSummaryForPrompt(sourceTag: string, photos: LoadedPhotoInput[]): string {
  if (photos.length === 0) return "";
  const imageLines = photos.map((photo, index) => {
    const frame = typeof photo.frameTimeMs === "number" && Number.isFinite(photo.frameTimeMs)
      ? ` video_frame ${(Number(photo.frameTimeMs) / 1000).toFixed(1).replace(/\.0$/, "")}s`
      : "photo";
    const asset = photo.assetId ? ` asset_id=${photo.assetId}` : "";
    const score = typeof photo.selectionScore === "number" ? ` score=${photo.selectionScore.toFixed(2)}` : "";
    const reason = photo.selectionReason ? ` reason=${photo.selectionReason}` : "";
    return `- asset_index ${index}: ${frame}${asset}${score}${reason}`;
  });
  const videoFrames = photos
    .map((photo, index) => ({
      index,
      frameTimeMs: photo.frameTimeMs,
      selectionScore: photo.selectionScore,
      selectionReason: photo.selectionReason,
      differenceScore: photo.differenceScore,
      qualityScore: photo.qualityScore,
    }))
    .filter((item) => item.frameTimeMs != null && Number.isFinite(Number(item.frameTimeMs)));
  const base = `\n\n入力画像メタデータ:\n${imageLines.join("\n")}\n領域を返す場合は、必ずこの 0 始まりの asset_index と対応させてください。複数写真では1枚目だけで決めず、各画像の主対象・周囲文脈・別対象候補を比較してください。`;
  if (!sourceTag.startsWith("video") || videoFrames.length === 0) return base;
  const lines = videoFrames.map((item) => {
    const seconds = (Number(item.frameTimeMs) / 1000).toFixed(1).replace(/\.0$/, "");
    const score = typeof item.selectionScore === "number" ? ` score=${item.selectionScore.toFixed(2)}` : "";
    const reason = item.selectionReason ? ` reason=${item.selectionReason}` : "";
    return `- asset_index ${item.index}: video_frame ${seconds}s${score}${reason}`;
  });
  return `${base}\n動画由来の複数フレーム:\n${lines.join("\n")}\nフレームはAIなしの差分・明るさ・輪郭スコアで可変選抜されています。時間差で見える対象・動き・周辺環境を総合し、領域を返す場合は該当する asset_index と frame_time_ms を使ってください。`;
}

export const VISUAL_EXTRACT_INSTRUCTIONS = `ここでは保存文の完成ではなく、画像・動画フレーム・音声から読み取れる「分類インベントリ」と「根拠」だけをJSONで返してください。
- primary は主対象として最も妥当な分類を1つ。断定しない場合も recommended_taxon_name / recommended_rank は最も有用な上位分類まで出す。
- recommended_media_regions は主対象が見える矩形。各矩形は asset_index と rect(x,y,width,height 0-1) を必ず含める。動画フレームなら frame_time_ms も使う。
- taxonomic_candidates / rank_decision_reason / diagnostic_features_observed / diagnostic_features_missing / confusable_groups / visual_contradictions を必ず使い、種確定に必要な形質が欠ける場合は species ではなく genus/family/order で止める。
- 白黒模様で黄色い腹部を持つ蛾は、キハラゴマダラヒトリ等のヒトリガ類だけでなく、Abraxas などシャクガ科も比較する。
- candidate_readings は同じ主対象の代替同定候補。副対象をここに混ぜない。
- coexisting_taxa は主対象とは別に写る対象だけ。各対象に media_regions をできるだけ付ける。
- 裸地・礫・舗装・石碑・看板・建物など非生物は coexisting_taxa に入れず、area_inference / management_action_candidates / note に分離する。
- area_inference は写真から読める植生構造・人為影響・水分環境・管理痕跡を短く残す。読み取れないキーは空配列でよいが、環境文脈を捨てない。
- area_inference は必ず次の5キーを持つJSONオブジェクトで返す: vegetation_structure_candidates / succession_stage_candidates / human_influence_candidates / moisture_regime_candidates / management_hint_candidates。各候補は label / confidence / why を持つ。
- audio_events / heard_taxa は音声だけで得た証拠。画像に写る副対象 coexisting_taxa に混ぜない。
- 音声入力がある場合は、何が聞こえたかを audio_events / heard_taxa に必ず入れる。聞き取れない場合も空配列を返す。鳥声・人声・環境音を区別し、人声や個人情報が疑われる場合は audio_privacy_risk を true にする。
- observer_boost は、この記録ですでに良いところを1文で返す。励まし過剰にせず、写っている証拠・周囲文脈・比較しやすさのどれが良いかを具体的に書く。next_step_text は最小限でよい。
- 各説明は短くする。diagnostic_features_seen / missing_evidence は各5件まで、candidate_readings / coexisting_taxa は各6件まで。
- トップレベルキー名は既存スキーマに合わせ、recommended_taxon_name / recommended_scientific_name / recommended_rank / confidence_band / recommended_media_regions を必ず使う。別名の primary や taxon は使わない。
JSONのみ出力。`;

export function buildVisualSummaryPrompt(prompt: string, extractText: string, audioRawText: string | null): string {
  return `${prompt}

以下は3.5 Flashが抽出した分類・視覚・音声証拠JSONです。この情報だけを使って、最終的な観察ページ保存用JSONを同じスキーマで作ってください。
AI単独で確定同定せず、根拠・保留点・次に撮るべき写真を明確に分けてください。
上流AIが species と言っていても、taxonomic_candidates が拮抗している、diagnostic_features_missing がある、visual_contradictions がある、または confusable_groups が残る場合は recommended_rank を genus/family/order に下げてください。
上流AIの taxonomic_candidates / rank_decision_reason / diagnostic_features_observed / diagnostic_features_missing / confusable_groups / visual_contradictions は省略せず、最終JSONにも残してください。
主対象の recommended_media_regions と、副対象の media_regions は可能な限りそのまま維持してください。
同じ主対象の代替候補は candidate_readings、別個体や背景植生は coexisting_taxa、音声だけで聞こえた対象は heard_taxa / audio_events に分離してください。
分類名は証拠JSONにないものを新しく増やさないでください。地域文脈は補助に留め、画像・音声証拠を優先してください。
裸地・礫・舗装・石碑・看板・建物など非生物は coexisting_taxa に入れず、area_inference / management_action_candidates / narrative の環境文脈へ分離してください。
証拠JSONの area_inference / management_action_candidates に環境・場・人為管理の情報がある場合、最終JSONにも短く保持してください。
トップレベルキー recommended_taxon_name / recommended_scientific_name / recommended_rank / confidence_band / recommended_media_regions は必ず含めてください。
recommended_media_regions と coexisting_taxa[].media_regions は、証拠JSONにある asset_index / frame_time_ms / rect を維持してください。
証拠JSONに audio_events / heard_taxa がある場合、最終JSONにも必ず残してください。音声入力がある場合、missing_evidence に「音声データ不足」と書かないでください。
保存用JSONは短くしてください。narrative は日本語160字以内、simple_summary は80字以内、diagnostic_features_seen / missing_evidence / distinguishing_tips / confirm_more は各5件以内、candidate_readings / coexisting_taxa は各6件以内。根拠領域以外の長文説明は増やさないでください。
observer_boost は日本語70字以内で必ず1文。すでに残せている観察上の良さだけを書く。未不足・否定・説教・「素晴らしい」などの大げさな賞賛は禁止。

証拠JSON:
${extractText.slice(0, 18000)}
${audioRawText ? `\n\n音声専用証拠JSON:\n${audioRawText.slice(0, 6000)}` : ""}

JSONのみ出力。`;
}
