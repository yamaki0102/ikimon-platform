const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ALLOWED_CORRECTION_FIELDS = new Set(["note", "taxon_name", "observed_at"]);

export type ObservationCorrectionEntry = {
  correctionId: string;
  observationId: string;
  editorUserId: string;
  field: "note" | "taxon_name" | "observed_at";
  previousValue: string;
  nextValue: string;
  reason: string;
  createdAt: string;
};

type SessionLike = {
  userId: string;
  banned?: boolean;
} | null;

type EnvLike = {
  OBS_DB: {
    prepare(sql: string): {
      bind(...values: unknown[]): {
        first<T = Record<string, unknown>>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
    };
  };
  ASSET_BUCKET?: {
    get(key: string): Promise<{ body: ReadableStream | null } | null>;
    put(key: string, value: string, options?: unknown): Promise<unknown>;
  };
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function correctionObjectKey(observationId: string): string {
  return `observation-corrections/${encodeURIComponent(observationId)}.json`;
}

export async function loadObservationCorrectionHistory(
  observationId: string,
  env: Pick<EnvLike, "ASSET_BUCKET">
): Promise<ObservationCorrectionEntry[]> {
  if (!env.ASSET_BUCKET) return [];
  const obj = await env.ASSET_BUCKET.get(correctionObjectKey(observationId)).catch(() => null);
  if (!obj || !obj.body) return [];
  const parsed = await new Response(obj.body).json().catch(() => null);
  return Array.isArray(parsed) ? (parsed as ObservationCorrectionEntry[]) : [];
}

export function renderObservationEditAndCorrectionHtml(options: {
  observationId: string;
  lang: "ja" | "en" | "es" | "pt-br";
  isOwner: boolean;
  currentNote: string | null;
  currentTaxon: string;
  history: ObservationCorrectionEntry[];
}): string {
  const isEn = options.lang === "en";
  const editBlock = options.isOwner
    ? `<details class="zt-edit-box">
        <summary>${isEn ? "Edit or correct this record" : "この記録を編集・訂正する"}</summary>
        <form id="obs-edit-form" class="zt-edit-form" data-observation-id="${escapeHtml(options.observationId)}">
          <label>
            <span>${isEn ? "Note" : "メモ"}</span>
            <textarea name="nextValue" rows="2">${escapeHtml(options.currentNote ?? "")}</textarea>
          </label>
          <label>
            <span>${isEn ? "Reason for correction (optional)" : "訂正の理由（任意）"}</span>
            <input type="text" name="reason" maxlength="120" placeholder="${isEn ? "e.g. Checked species name" : "例: 現地で再確認"}">
          </label>
          <button type="submit" class="zt-edit-save-btn">${isEn ? "Save correction" : "訂正を保存"}</button>
        </form>
        <details class="zt-delete-confirm">
          <summary>${isEn ? "Delete this record" : "この記録を削除する"}</summary>
          <p class="zt-delete-warning">${
            isEn
              ? "This action cannot be undone. This record will be removed from public views."
              : "この操作は元に戻せません。公開一覧からも外れます。"
          }</p>
          <button type="button" id="obs-delete-confirm-btn" class="zt-delete-btn" data-observation-id="${escapeHtml(options.observationId)}">${
            isEn ? "Confirm delete" : "確認して削除する"
          }</button>
        </details>
      </details>`
    : "";

  const historyItems =
    options.history.length > 0
      ? options.history
          .map(
            (item) =>
              `<li><strong>${escapeHtml(item.field)}</strong>: ${escapeHtml(item.previousValue || "—")} → ${escapeHtml(
                item.nextValue
              )}${item.reason ? ` (${escapeHtml(item.reason)})` : ""}</li>`
          )
          .join("")
      : `<li>${isEn ? "No corrections recorded yet." : "訂正の履歴はまだありません。"}</li>`;

  return `<section class="zt-edit-correct-card" data-detail-edit="d3-d4-d7">
    <style>
      .zt-edit-correct-card{margin:16px 0;padding:14px;border:1px solid #dce3dd;border-radius:12px;background:#fff;display:grid;gap:12px;min-width:0}
      .zt-edit-form{display:grid;gap:8px;margin-top:8px}
      .zt-edit-form label{display:grid;gap:4px;font-size:14px;font-weight:700}
      .zt-edit-form textarea,.zt-edit-form input{width:100%;min-height:44px;padding:8px 10px;border:1px solid #dce3dd;border-radius:8px;font:inherit}
      .zt-edit-save-btn{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid #245c3a;background:#245c3a;color:#fff;font:inherit;font-weight:800;cursor:pointer}
      .zt-delete-confirm{margin-top:10px;padding-top:10px;border-top:1px dashed #dce3dd}
      .zt-delete-warning{margin:6px 0;color:#b42318;font-size:14px;font-weight:700}
      .zt-delete-btn{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid #b42318;background:#fff;color:#b42318;font:inherit;font-weight:800;cursor:pointer}
      .zt-correction-list{margin:0;padding-left:18px;display:grid;gap:4px;font-size:14px}
      @media (prefers-reduced-motion:reduce){.zt-edit-correct-card,.zt-edit-correct-card *{transition:none!important;animation:none!important}}
    </style>
    ${editBlock}
    <div>
      <h3 style="margin:0 0 6px;font-size:15px">${escapeHtml(isEn ? "Correction history" : "訂正履歴")}</h3>
      <ul id="obs-correction-history" class="zt-correction-list">${historyItems}</ul>
    </div>
  </section>`;
}

export async function handlePostObservationCorrection(
  observationId: string,
  request: Request,
  session: SessionLike,
  env: EnvLike
): Promise<Response> {
  if (!session || session.banned) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const payload = await request.json().catch(() => null) as {
    field?: unknown;
    nextValue?: unknown;
    reason?: unknown;
  } | null;

  const field = typeof payload?.field === "string" && ALLOWED_CORRECTION_FIELDS.has(payload.field)
    ? (payload.field as "note" | "taxon_name" | "observed_at")
    : null;
  const nextValue = typeof payload?.nextValue === "string" ? payload.nextValue.trim().slice(0, 1000) : "";
  const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 120) : "";

  if (!field || !nextValue) {
    return jsonResponse({ ok: false, error: "invalid_correction_payload" }, 400);
  }

  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, user_id, visibility, note, observed_at FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{
      observation_id: string;
      user_id: string;
      visibility: string;
      note: string | null;
      observed_at: string | null;
    }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.user_id !== session.userId) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  const previousValue =
    field === "note"
      ? obs.note ?? ""
      : field === "observed_at"
        ? obs.observed_at ?? ""
        : "";

  if (field === "note") {
    await env.OBS_DB
      .prepare("UPDATE observations SET note = ?, updated_at = CURRENT_TIMESTAMP WHERE observation_id = ? AND user_id = ?")
      .bind(nextValue, observationId, session.userId)
      .run();
  } else if (field === "observed_at") {
    await env.OBS_DB
      .prepare("UPDATE observations SET observed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE observation_id = ? AND user_id = ?")
      .bind(nextValue, observationId, session.userId)
      .run();
  }

  const existing = await loadObservationCorrectionHistory(observationId, env);
  const correction: ObservationCorrectionEntry = {
    correctionId: `corr_${crypto.randomUUID()}`,
    observationId,
    editorUserId: session.userId,
    field,
    previousValue,
    nextValue,
    reason,
    createdAt: new Date().toISOString(),
  };
  const history = [...existing, correction];

  if (env.ASSET_BUCKET) {
    await env.ASSET_BUCKET.put(correctionObjectKey(observationId), JSON.stringify(history), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return jsonResponse({ ok: true, correction, history }, 200);
}

export async function handleGetObservationCorrections(
  observationId: string,
  session: SessionLike,
  env: EnvLike
): Promise<Response> {
  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, user_id, visibility FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{ observation_id: string; user_id: string; visibility: string }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.visibility !== "public") {
    if (!session || session.banned) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    if (obs.user_id !== session.userId) {
      return jsonResponse({ ok: false, error: "forbidden" }, 403);
    }
  }

  const history = await loadObservationCorrectionHistory(observationId, env);
  return jsonResponse({ ok: true, history }, 200);
}
