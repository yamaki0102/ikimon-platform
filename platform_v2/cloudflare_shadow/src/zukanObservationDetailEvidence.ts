const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
};

type SessionLike = {
  userId: string;
  banned?: boolean;
} | null;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export type ObservationDetailEvidence = {
  observationId: string;
  isOwner: boolean;
  verificationState: "verified" | "pending";
  locationSource: "registered_place" | "device_or_manual";
  locationPrecision: string;
  observedAt: string | null;
};

export function buildObservationDetailEvidence(input: {
  observationId: string;
  isOwner: boolean;
  observedAt: string | null;
  placeId: string | null;
  locationPrecision: string | null;
  hasScrubbedAsset: boolean;
}): ObservationDetailEvidence {
  return {
    observationId: input.observationId,
    isOwner: input.isOwner,
    verificationState: input.hasScrubbedAsset ? "verified" : "pending",
    locationSource: input.placeId ? "registered_place" : "device_or_manual",
    locationPrecision: input.locationPrecision ?? "grid",
    observedAt: input.observedAt,
  };
}

export function renderObservationDetailEvidenceHtml(
  evidence: ObservationDetailEvidence,
  lang: "ja" | "en" | "es" | "pt-br"
): string {
  const isEn = lang === "en";
  const viewerLabel = evidence.isOwner
    ? isEn
      ? "My record"
      : "自分の記録"
    : isEn
      ? "Public record"
      : "みんなの記録";
  const verifyLabel =
    evidence.verificationState === "verified"
      ? isEn
        ? "Verified"
        : "確認済み"
      : isEn
        ? "Pending check"
        : "確認待ち";
  const locationLabel =
    evidence.locationSource === "registered_place"
      ? isEn
        ? "Registered place"
        : "登録された場所"
      : isEn
        ? "Recorded position"
        : "記録時の位置";
  const timeLabel = evidence.observedAt ?? "—";

  return `<section class="zt-detail-evidence-card" data-detail-evidence="d1-d2-d6" aria-label="${escapeHtml(
    isEn ? "Record provenance and verification" : "記録の根拠と確認状態"
  )}">
    <style>
      .zt-detail-evidence-card{margin:16px 0;padding:14px;border:1px solid #dce3dd;border-radius:12px;background:#f6f7f6;display:grid;gap:10px;min-width:0}
      .zt-detail-evidence-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
      .zt-detail-badge{display:inline-flex;align-items:center;min-height:28px;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:800;background:#fff;border:1px solid #dce3dd;color:#17251b}
      .zt-detail-badge.is-verified{background:#245c3a;border-color:#245c3a;color:#fff}
      .zt-detail-evidence-list{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
      .zt-detail-evidence-list div{display:grid;gap:2px}
      .zt-detail-evidence-list dt{font-size:12px;color:#485a4e;font-weight:700}
      .zt-detail-evidence-list dd{margin:0;font-size:14px;font-weight:800;color:#17251b;overflow-wrap:anywhere}
      @media (prefers-reduced-motion:reduce){.zt-detail-evidence-card,.zt-detail-evidence-card *{transition:none!important;animation:none!important}}
    </style>
    <div class="zt-detail-evidence-head">
      <span class="zt-detail-badge">${escapeHtml(viewerLabel)}</span>
      <span class="zt-detail-badge${evidence.verificationState === "verified" ? " is-verified" : ""}">${escapeHtml(verifyLabel)}</span>
    </div>
    <dl class="zt-detail-evidence-list">
      <div><dt>${escapeHtml(isEn ? "Location basis" : "位置の根拠")}</dt><dd>${escapeHtml(locationLabel)} (${escapeHtml(evidence.locationPrecision)})</dd></div>
      <div><dt>${escapeHtml(isEn ? "Observed time" : "撮影・観察日時")}</dt><dd>${escapeHtml(timeLabel)}</dd></div>
    </dl>
  </section>`;
}

export async function handleGetObservationEvidence(
  observationId: string,
  session: SessionLike,
  obsDb: ObsDbLike
): Promise<Response> {
  const row = await obsDb
    .prepare(
      `SELECT observation_id, owner_user_id AS user_id, visibility, observed_at, 'grid' AS location_precision, NULL AS place_id
       FROM observations
       WHERE observation_id = ?`
    )
    .bind(observationId)
    .first<{
      observation_id: string;
      user_id: string;
      visibility: string;
      observed_at: string | null;
      location_precision: string | null;
      place_id: string | null;
    }>();

  if (!row) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }

  const isOwner = Boolean(session && !session.banned && row.user_id === session.userId);
  if (row.visibility !== "public") {
    if (!session || session.banned) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    if (!isOwner) {
      return jsonResponse({ ok: false, error: "forbidden" }, 403);
    }
  }

  const assetRow = await obsDb
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM asset_ledger
       WHERE observation_id = ?
         AND (exif_scrub_state = 'scrubbed' OR processing_state = 'uploaded')`
    )
    .bind(observationId)
    .first<{ cnt: number }>();

  const evidence = buildObservationDetailEvidence({
    observationId: row.observation_id,
    isOwner,
    observedAt: row.observed_at,
    placeId: row.place_id,
    locationPrecision: row.location_precision,
    hasScrubbedAsset: Number(assetRow?.cnt ?? 0) > 0,
  });

  return jsonResponse({ ok: true, evidence }, 200);
}
