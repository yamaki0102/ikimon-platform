import { getPool } from "../db.js";

export type RecordReadingAxis = "organism" | "environment" | "human_relation";
export type RecordReadingSourceKind = "official" | "trusted_db" | "research";

export type RecordReadingSource = {
  title: string;
  url: string;
  sourceKind: RecordReadingSourceKind;
  retrievedAt: string;
};

export type RecordReadingCard = {
  cardId: string;
  visitId: string;
  axis: RecordReadingAxis;
  title: string;
  body: string;
  sources: RecordReadingSource[];
  visibility: "owner_only" | "public" | "hidden";
  generationCondition: Record<string, unknown>;
  qualityGate: Record<string, unknown>;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordReadingAvailability = {
  canGenerate: boolean;
  reason: "eligible" | "no_media" | "not_grounded" | "not_owner" | "not_found";
  candidateCount: number;
};

type VisitSignalRow = {
  visit_id: string;
  user_id: string | null;
  public_visibility: string | null;
  observed_at: string;
  observed_prefecture: string | null;
  observed_municipality: string | null;
  locality_note: string | null;
  note: string | null;
  media_count: string;
};

type SubjectSignalRow = {
  occurrence_id: string;
  subject_index: number | null;
  scientific_name: string | null;
  vernacular_name: string | null;
  taxon_rank: string | null;
  recommended_rank: string | null;
  recommended_taxon_name: string | null;
  best_specific_taxon_name: string | null;
  simple_summary: string | null;
  diagnostic_features_seen: unknown;
  geographic_context: string | null;
  seasonal_context: string | null;
};

type RecordReadingSignals = {
  visit: {
    visitId: string;
    ownerUserId: string | null;
    publicVisibility: string;
    observedAt: string;
    placeText: string;
    note: string;
    mediaCount: number;
  };
  subjects: SubjectSignalRow[];
};

type CardDraft = Omit<RecordReadingCard, "cardId" | "visitId" | "visibility" | "createdAt" | "updatedAt"> & {
  generationCondition: Record<string, unknown>;
  qualityGate: Record<string, unknown>;
};

const MODEL_VERSION = "record_reading_cards_v0_1";
const SOURCE_RETRIEVED_AT = "2026-05-23";

const SOURCE_CATALOG = {
  trifoliumRepens: [
    {
      title: "Kew Plants of the World Online - Trifolium repens",
      url: "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:523626-1",
      sourceKind: "trusted_db",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
    {
      title: "USDA Forest Service FEIS - Trifolium repens",
      url: "https://research.fs.usda.gov/feis/species-reviews/trirep",
      sourceKind: "official",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
    {
      title: "USDA NRCS Fact Sheet - White clover",
      url: "https://plants.usda.gov/DocumentLibrary/factsheet/pdf/fs_trre3.pdf",
      sourceKind: "official",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
  ] satisfies RecordReadingSource[],
  satsumaSnails: [
    {
      title: "沖縄県 レッドデータおきなわ 貝類",
      url: "https://www.pref.okinawa.jp/_res/projects/default_project/_page_/001/004/628/12_kairui.pdf",
      sourceKind: "official",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
    {
      title: "東邦大学 プレスリリース - 沖縄島北部の陸産貝類",
      url: "https://www.toho-u.ac.jp/press/2021_index/20210527-1134.html",
      sourceKind: "research",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
    {
      title: "CiNii Research - ヤマタカマイマイ類の分類研究",
      url: "https://cir.nii.ac.jp/crid/1390845712998891008",
      sourceKind: "research",
      retrievedAt: SOURCE_RETRIEVED_AT,
    },
  ] satisfies RecordReadingSource[],
};

function normalizeSignalsText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function jsonText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function buildSearchText(signals: Pick<RecordReadingSignals, "visit" | "subjects">): string {
  return normalizeSignalsText([
    signals.visit.placeText,
    signals.visit.note,
    ...signals.subjects.flatMap((subject) => [
      subject.scientific_name,
      subject.vernacular_name,
      subject.taxon_rank,
      subject.recommended_rank,
      subject.recommended_taxon_name,
      subject.best_specific_taxon_name,
      subject.simple_summary,
      subject.geographic_context,
      subject.seasonal_context,
      jsonText(subject.diagnostic_features_seen),
    ]),
  ].filter(Boolean).join(" "));
}

function baseQualityGate(sourceCount: number, identityScope: string, body: string): Record<string, unknown> {
  return {
    sourceCount,
    identityScope,
    bodyCharCount: body.length,
    usesStoredCardOnly: true,
    excludesOcrAndScrapedBodies: true,
    avoidsActionTone: !/(次は|今度|撮る|行くなら|再訪|また行)/u.test(body),
  };
}

function cardDraft(
  axis: RecordReadingAxis,
  title: string,
  body: string,
  sources: RecordReadingSource[],
  condition: Record<string, unknown>,
): CardDraft {
  const identityScope = typeof condition.identityScope === "string" ? condition.identityScope : "taxon";
  return {
    axis,
    title,
    body,
    sources,
    modelVersion: MODEL_VERSION,
    generationCondition: condition,
    qualityGate: baseQualityGate(sources.length, identityScope, body),
  };
}

export function buildRecordReadingCardDraftsForSignals(
  signals: Pick<RecordReadingSignals, "visit" | "subjects">,
): CardDraft[] {
  const text = buildSearchText(signals);
  if (/(trifolium\s+repens|シロツメクサ|白詰草|white\s+clover|クローバー)/iu.test(text)) {
    const sources = SOURCE_CATALOG.trifoliumRepens;
    const condition = {
      matchedTaxon: "Trifolium repens",
      identityScope: "species_or_common_name",
      sourcePolicy: "trusted_catalog_min_2_sources",
      placeHint: signals.visit.placeText,
      subjectCount: signals.subjects.length,
    };
    return [
      cardDraft(
        "organism",
        "低く広がる白い花",
        "シロツメクサは、地面を這う茎から節ごとに根を出し、低く広がっていく植物です。白い花だけを見ると小さな点のようですが、足元まで写った記録では、草地の面をどう作っているかも見えてきます。マメ科の植物として土の窒素循環にも関わるため、道端の小さな花が草地全体の見え方を少し変えています。",
        sources,
        condition,
      ),
      cardDraft(
        "environment",
        "草地の明るさを映す植物",
        "シロツメクサは芝地や道端など、人の利用がある明るい草地でもよく見られます。記録にまわりの草丈や裸地が少し入っていると、花そのものだけでなく、その場所がどれくらい開けているかも読み取れます。写真の端に残った足元の情報が、草地の保たれ方を後から思い出す手がかりになります。",
        sources,
        condition,
      ),
      cardDraft(
        "human_relation",
        "身近さの中に残る関係",
        "シロツメクサは、牧草や緑化にも使われてきた、人の暮らしと近い植物です。公園や道端で見かける身近さの一方で、花や葉、広がり方を一緒に残すと、そこがどんな使われ方をしている場所かも見えてきます。よくある花の写真が、その場所と人の関係まで含んだ記録になります。",
        sources,
        condition,
      ),
    ];
  }

  if (/(satsuma|オキナワヤマタカマイマイ|ヤマタカマイマイ|陸貝|かたつむり|カタツムリ|snail)/iu.test(text)) {
    const sources = SOURCE_CATALOG.satsumaSnails;
    const condition = {
      matchedTaxon: "Satsuma / Okinawan land snails",
      identityScope: "genus_or_group",
      sourcePolicy: "trusted_catalog_min_2_sources",
      placeHint: signals.visit.placeText,
      subjectCount: signals.subjects.length,
    };
    return [
      cardDraft(
        "organism",
        "殻の形から読む陸貝",
        "沖縄のヤマタカマイマイ類は、殻の形や色、巻き方などを手がかりに見られる陸貝の仲間です。この記録だけで種名まで断定するより、属や近いグループとして眺めるほうが無理がありません。小さな殻の写真でも、葉の上か幹の近くか、湿った場所かといった周辺情報が一緒に残ると、後から読み返せる幅が広がります。",
        sources,
        condition,
      ),
      cardDraft(
        "environment",
        "湿り気と林の気配",
        "陸貝は乾燥に弱く、林床や葉の裏、石や倒木の周辺など、湿り気が残る微小な環境と関係して見られます。沖縄の陸貝をめぐる資料でも、島や地域ごとの環境との結びつきが重要な背景になります。写真に写った足元や葉の状態は、貝そのものと同じくらい、その場の空気を思い出す材料になります。",
        sources,
        condition,
      ),
      cardDraft(
        "human_relation",
        "島の自然を映す小さな存在",
        "沖縄の陸貝は、島ごとの隔たりや環境の変化を考えるうえで注目されてきた生きものです。見慣れた小さな貝でも、どの地域で、どんな場所にいたかが残ると、単なる名前以上の意味を持ちます。施設や野外で見た一枚が、島の自然史につながる入口になります。",
        sources,
        condition,
      ),
    ];
  }

  return [];
}

function hasPassingQualityGate(draft: CardDraft): boolean {
  return draft.sources.length >= 2
    && draft.body.length >= 80
    && draft.body.length <= 520
    && draft.qualityGate.avoidsActionTone === true;
}

function normalizeSources(raw: unknown): RecordReadingSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Partial<RecordReadingSource>;
    if (!source.title || !source.url || !source.sourceKind) return [];
    return [{
      title: String(source.title),
      url: String(source.url),
      sourceKind: source.sourceKind,
      retrievedAt: String(source.retrievedAt ?? SOURCE_RETRIEVED_AT),
    }];
  });
}

function normalizeRecordObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

async function resolveSignals(observationId: string): Promise<RecordReadingSignals | null> {
  const pool = getPool();
  const visitResult = await pool.query<VisitSignalRow>(
    `WITH matched_visit AS (
        SELECT visit_id
          FROM visits
         WHERE visit_id = $1
            OR legacy_observation_id = $1
        UNION
        SELECT visit_id
          FROM occurrences
         WHERE occurrence_id = $1
            OR legacy_observation_id = $1
        LIMIT 1
      )
      SELECT v.visit_id,
             v.user_id,
             COALESCE(v.public_visibility, 'public') AS public_visibility,
             v.observed_at::text AS observed_at,
             v.observed_prefecture,
             v.observed_municipality,
             v.locality_note,
             v.note,
             (
               SELECT count(*)::text
                 FROM evidence_assets ea
                WHERE ea.visit_id = v.visit_id
                  AND ea.asset_role IN ('observation_photo', 'observation_video')
             ) AS media_count
        FROM matched_visit mv
        JOIN visits v ON v.visit_id = mv.visit_id
       LIMIT 1`,
    [observationId],
  );
  const visitRow = visitResult.rows[0];
  if (!visitRow) return null;

  const subjectResult = await pool.query<SubjectSignalRow>(
    `SELECT o.occurrence_id,
            o.subject_index,
            o.scientific_name,
            o.vernacular_name,
            o.taxon_rank,
            ai.recommended_rank,
            ai.recommended_taxon_name,
            ai.best_specific_taxon_name,
            ai.simple_summary,
            ai.diagnostic_features_seen,
            ai.geographic_context,
            ai.seasonal_context
       FROM occurrences o
       LEFT JOIN LATERAL (
         SELECT recommended_rank,
                recommended_taxon_name,
                best_specific_taxon_name,
                simple_summary,
                diagnostic_features_seen,
                geographic_context,
                seasonal_context
           FROM observation_ai_assessments a
          WHERE a.occurrence_id = o.occurrence_id
          ORDER BY a.generated_at DESC
          LIMIT 1
       ) ai ON true
      WHERE o.visit_id = $1
      ORDER BY COALESCE(o.subject_index, 0) ASC, o.created_at ASC
      LIMIT 8`,
    [visitRow.visit_id],
  );

  const placeText = [
    visitRow.observed_prefecture,
    visitRow.observed_municipality,
    visitRow.locality_note,
  ].filter(Boolean).join(" ");
  return {
    visit: {
      visitId: visitRow.visit_id,
      ownerUserId: visitRow.user_id,
      publicVisibility: visitRow.public_visibility ?? "public",
      observedAt: visitRow.observed_at,
      placeText,
      note: visitRow.note ?? "",
      mediaCount: Number(visitRow.media_count ?? 0),
    },
    subjects: subjectResult.rows,
  };
}

export async function getRecordReadingAvailability(options: {
  observationId: string;
  viewerUserId: string | null;
}): Promise<RecordReadingAvailability> {
  const signals = await resolveSignals(options.observationId);
  if (!signals) return { canGenerate: false, reason: "not_found", candidateCount: 0 };
  if (!options.viewerUserId || signals.visit.ownerUserId !== options.viewerUserId) {
    return { canGenerate: false, reason: "not_owner", candidateCount: 0 };
  }
  if (signals.visit.mediaCount <= 0) {
    return { canGenerate: false, reason: "no_media", candidateCount: 0 };
  }
  const drafts = buildRecordReadingCardDraftsForSignals(signals).filter(hasPassingQualityGate);
  return {
    canGenerate: drafts.length > 0,
    reason: drafts.length > 0 ? "eligible" : "not_grounded",
    candidateCount: drafts.length,
  };
}

export async function listRecordReadingCards(options: {
  visitId: string;
  viewerUserId: string | null;
}): Promise<RecordReadingCard[]> {
  const pool = getPool();
  const result = await pool.query<{
    card_id: string;
    visit_id: string;
    axis: RecordReadingAxis;
    title: string;
    body: string;
    sources: unknown;
    visibility: "owner_only" | "public" | "hidden";
    generation_condition: unknown;
    quality_gate: unknown;
    model_version: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT c.card_id::text,
            c.visit_id,
            c.axis,
            c.title,
            c.body,
            c.sources,
            c.visibility,
            c.generation_condition,
            c.quality_gate,
            c.model_version,
            c.created_at::text,
            c.updated_at::text
       FROM record_reading_cards c
       JOIN visits v ON v.visit_id = c.visit_id
      WHERE c.visit_id = $1
        AND c.visibility <> 'hidden'
        AND (
          c.visibility = 'public'
          OR (c.visibility = 'owner_only' AND v.user_id = $2)
        )
      ORDER BY CASE c.axis
        WHEN 'organism' THEN 1
        WHEN 'environment' THEN 2
        WHEN 'human_relation' THEN 3
        ELSE 9
      END`,
    [options.visitId, options.viewerUserId],
  );
  return result.rows.map((row) => ({
    cardId: row.card_id,
    visitId: row.visit_id,
    axis: row.axis,
    title: row.title,
    body: row.body,
    sources: normalizeSources(row.sources),
    visibility: row.visibility,
    generationCondition: normalizeRecordObject(row.generation_condition),
    qualityGate: normalizeRecordObject(row.quality_gate),
    modelVersion: row.model_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function generateRecordReadingCards(options: {
  observationId: string;
  actorUserId: string;
}): Promise<{ cards: RecordReadingCard[]; reason: RecordReadingAvailability["reason"] }> {
  const signals = await resolveSignals(options.observationId);
  if (!signals) return { cards: [], reason: "not_found" };
  if (signals.visit.ownerUserId !== options.actorUserId) {
    throw new Error("observation_not_owned");
  }
  if (signals.visit.mediaCount <= 0) return { cards: [], reason: "no_media" };
  const drafts = buildRecordReadingCardDraftsForSignals(signals).filter(hasPassingQualityGate);
  if (drafts.length === 0) return { cards: [], reason: "not_grounded" };

  const visibility = signals.visit.publicVisibility === "public" ? "public" : "owner_only";
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const draft of drafts.slice(0, 3)) {
      await client.query(
        `INSERT INTO record_reading_cards (
             visit_id,
             axis,
             title,
             body,
             sources,
             visibility,
             generation_condition,
             quality_gate,
             model_version,
             created_by_user_id
           )
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10)
           ON CONFLICT (visit_id, axis)
           DO UPDATE SET
             title = EXCLUDED.title,
             body = EXCLUDED.body,
             sources = EXCLUDED.sources,
             visibility = EXCLUDED.visibility,
             generation_condition = EXCLUDED.generation_condition,
             quality_gate = EXCLUDED.quality_gate,
             model_version = EXCLUDED.model_version,
             updated_at = NOW()`,
        [
          signals.visit.visitId,
          draft.axis,
          draft.title,
          draft.body,
          JSON.stringify(draft.sources),
          visibility,
          JSON.stringify({
            ...draft.generationCondition,
            observedAt: signals.visit.observedAt,
            mediaCount: signals.visit.mediaCount,
          }),
          JSON.stringify(draft.qualityGate),
          draft.modelVersion,
          options.actorUserId,
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    cards: await listRecordReadingCards({ visitId: signals.visit.visitId, viewerUserId: options.actorUserId }),
    reason: "eligible",
  };
}

export async function hideRecordReadingCard(options: {
  cardId: string;
  actorUserId: string;
}): Promise<{ hidden: boolean }> {
  const pool = getPool();
  const result = await pool.query<{ card_id: string }>(
    `UPDATE record_reading_cards c
        SET visibility = 'hidden',
            updated_at = NOW()
       FROM visits v
      WHERE c.card_id = $1::uuid
        AND c.visit_id = v.visit_id
        AND v.user_id = $2
      RETURNING c.card_id::text`,
    [options.cardId, options.actorUserId],
  );
  if (!result.rows[0]) {
    throw new Error("record_reading_card_not_found");
  }
  return { hidden: true };
}
