const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ALLOWED_LINK_TARGETS = new Set(["mine_only", "place_zukan", "event"]);

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
};

type CoreDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
    };
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

export const ZUKAN_RECORD_LINK_DONE_STYLES = `
  .zt-link-targets{display:grid;gap:8px;margin:0 0 12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;min-width:0}
  .zt-link-targets-title{margin:0;font-size:15px;font-weight:900}
  .zt-link-option{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--paper);cursor:pointer;font-weight:700;font-size:14px}
  .zt-link-option input{width:20px;height:20px;accent-color:var(--teal)}
  .zt-done-card{display:grid;gap:8px;margin-top:12px;padding:14px;border:1px solid var(--teal);border-radius:12px;background:var(--mint)}
  .zt-done-card[hidden]{display:none}
  .zt-done-card a,.zt-done-card a:visited{min-height:44px}
  @media (prefers-reduced-motion:reduce){
    .zt-link-targets,.zt-link-targets *,.zt-done-card,.zt-done-card *{transition:none!important;animation:none!important}
  }
`;

export function renderRecordLinkSelectorHtml(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  hasEventContext: boolean;
}): string {
  const isEn = options.lang === "en";
  return `<fieldset class="zt-link-targets" data-record-link-targets="c7">
    <legend class="zt-link-targets-title">${isEn ? "Where to link this record" : "この記録をつなぐ先"}</legend>
    <label class="zt-link-option">
      <input type="checkbox" name="linkTarget" value="mine_only" checked>
      <span>${isEn ? "Keep in my library (private)" : "自分だけの記録に残す"}</span>
    </label>
    <label class="zt-link-option">
      <input type="checkbox" name="linkTarget" value="place_zukan">
      <span>${isEn ? "Link to this place's field guide" : "この場所の図鑑にもつなぐ"}</span>
    </label>
    ${
      options.hasEventContext
        ? `<label class="zt-link-option">
      <input type="checkbox" name="linkTarget" value="event" checked>
      <span>${isEn ? "Share with this event's participants" : "参加中の観察会のみんなにも見せる"}</span>
    </label>`
        : ""
    }
  </fieldset>`;
}

export function renderRecordDoneCardHtml(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  prefix: string;
}): string {
  const isEn = options.lang === "en";
  return `<div id="record-saved-links" class="cf-record-saved-links zt-done-card" data-record-saved-links hidden aria-label="${escapeHtml(
    isEn ? "Saved record actions" : "保存後の移動先"
  )}">
    <a href="${escapeHtml(`${options.prefix}/record`)}" class="zt-done-again">${isEn ? "Record another" : "続けて記録する"}</a>
  </div>`;
}

export async function handleSaveRecordLinks(
  request: Request,
  userId: string,
  obsDb: ObsDbLike,
  coreDb: CoreDbLike
): Promise<Response> {
  const payload = await request.json().catch(() => null) as {
    observationId?: unknown;
    targets?: unknown;
    placeId?: unknown;
  } | null;

  const observationId = typeof payload?.observationId === "string" ? payload.observationId.trim() : "";
  if (!observationId || observationId.length > 128) {
    return jsonResponse({ ok: false, error: "invalid_observation_id" }, 400);
  }

  const rawTargets = Array.isArray(payload?.targets) ? payload.targets : [];
  const targets = [...new Set(rawTargets.filter((t): t is string => typeof t === "string" && ALLOWED_LINK_TARGETS.has(t)))];
  if (targets.length === 0) {
    targets.push("mine_only");
  }

  const placeId =
    typeof payload?.placeId === "string" && payload.placeId.trim()
      ? payload.placeId.trim().slice(0, 128)
      : null;

  const obs = await obsDb
    .prepare("SELECT user_id FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{ user_id: string }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.user_id !== userId) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  const published = targets.includes("place_zukan") ? 1 : 0;
  const nowSec = Math.floor(Date.now() / 1000);

  await coreDb
    .prepare(
      `INSERT INTO zukan_observation_publications (user_id, observation_id, place_id, legacy_group_key, published, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?)
       ON CONFLICT(user_id, observation_id) DO UPDATE SET
         place_id = COALESCE(excluded.place_id, zukan_observation_publications.place_id),
         published = excluded.published,
         updated_at = excluded.updated_at`
    )
    .bind(userId, observationId, placeId, published, nowSec)
    .run();

  return jsonResponse(
    {
      ok: true,
      observationId,
      targets,
      published: published === 1,
      placeId,
    },
    200
  );
}
