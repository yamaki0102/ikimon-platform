import { getPool } from "../db.js";

type CorrectionRow = {
  correction_id: string;
  guide_record_id: string;
  correction_kind: string;
  original_payload: unknown;
  corrected_payload: unknown;
  note: string | null;
  created_at: string;
};

export type GuideCorrectionEvalItem = {
  correctionId: string;
  guideRecordId: string;
  correctionKind: string;
  label: "non_biological_signage" | "vegetation_context" | "landform_context" | "human_edit";
  originalPayload: unknown;
  correctedPayload: unknown;
  note: string | null;
  createdAt: string;
};

function labelForCorrection(kind: string, note: string | null): GuideCorrectionEvalItem["label"] {
  const text = `${kind} ${note ?? ""}`;
  if (/signage|看板|ロゴ|店舗|車名|スズキ|SUZUKI/i.test(text)) return "non_biological_signage";
  if (/vegetation|植生|草地|草丈|刈り込み/i.test(text)) return "vegetation_context";
  if (/landform|地形|土地|水辺|道路際|農地/i.test(text)) return "landform_context";
  return "human_edit";
}

export async function loadGuideCorrectionEvalItems(limit = 500): Promise<GuideCorrectionEvalItem[]> {
  const cappedLimit = Math.max(1, Math.min(5000, Math.round(limit)));
  const rows = await getPool().query<CorrectionRow>(
    `select correction_id::text,
            guide_record_id::text,
            correction_kind,
            original_payload,
            corrected_payload,
            note,
            created_at::text
       from guide_record_corrections
      order by created_at desc
      limit $1`,
    [cappedLimit],
  );
  return rows.rows.map((row) => ({
    correctionId: row.correction_id,
    guideRecordId: row.guide_record_id,
    correctionKind: row.correction_kind,
    label: labelForCorrection(row.correction_kind, row.note),
    originalPayload: row.original_payload,
    correctedPayload: row.corrected_payload,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export function summarizeGuideCorrectionEval(items: GuideCorrectionEvalItem[]): {
  total: number;
  byLabel: Record<GuideCorrectionEvalItem["label"], number>;
} {
  const byLabel: Record<GuideCorrectionEvalItem["label"], number> = {
    non_biological_signage: 0,
    vegetation_context: 0,
    landform_context: 0,
    human_edit: 0,
  };
  for (const item of items) byLabel[item.label] += 1;
  return { total: items.length, byLabel };
}
