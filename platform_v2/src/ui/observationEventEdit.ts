import { EVENT_MODES, type ObservationEventSessionRow } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function renderEventEditBody(args: {
  session: ObservationEventSessionRow;
  strings: ObservationEventStrings;
}): string {
  const { session, strings } = args;
  const modeOptions = EVENT_MODES.map((mode) => {
    const label = strings.modeLabels[mode] ?? mode;
    const sel = mode === session.primaryMode ? " selected" : "";
    return `<option value="${mode}"${sel}>${escapeHtml(label)}</option>`;
  }).join("");

  return `
<section class="evt-recap-shell" data-session-id="${escapeHtml(session.sessionId)}">
  <article class="evt-card">
    <span class="evt-eyebrow">編集</span>
    <h1 class="evt-heading">${escapeHtml(session.title || "観察会")} を編集</h1>
    <p class="evt-lead">主催者だけが編集できます。変更は即時反映されます。</p>
  </article>

  <form class="evt-checkin-form" data-evt-edit-form>
    <label>タイトル
      <input name="title" required maxlength="80" value="${escapeHtml(session.title)}" />
    </label>
    <label>開始日時
      <input name="started_at" type="datetime-local" value="${escapeHtml(toLocalDatetimeValue(session.startedAt))}" />
    </label>
    <label>参加コード
      <input name="event_code" maxlength="8" value="${escapeHtml(session.eventCode ?? "")}"
             style="font-family:'Roboto Mono',monospace; text-transform:uppercase; letter-spacing:.12em;" />
    </label>
    <label>主モード
      <select name="primary_mode" required>${modeOptions}</select>
    </label>
    <label>目標種(カンマ区切り)
      <input name="target_species" value="${escapeHtml((session.targetSpecies ?? []).join(", "))}" />
    </label>
    <fieldset style="border:1px solid var(--evt-line); border-radius:14px; padding:12px 14px; display:grid; gap:8px;">
      <legend style="padding:0 6px; font-weight:700; font-size:13px;">開催地</legend>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label>緯度
          <input name="location_lat" type="number" step="0.000001" value="${session.locationLat ?? ""}" />
        </label>
        <label>経度
          <input name="location_lng" type="number" step="0.000001" value="${session.locationLng ?? ""}" />
        </label>
      </div>
      <label>半径(m)
        <input name="location_radius_m" type="number" min="100" max="50000" value="${session.locationRadiusM}" />
      </label>
    </fieldset>
    <label>プラン
      <select name="plan">
        <option value="community" ${session.plan === "community" ? "selected" : ""}>コミュニティ</option>
        <option value="public" ${session.plan === "public" ? "selected" : ""}>Public</option>
      </select>
    </label>
    <div style="display:flex; gap:8px; justify-content:flex-end;">
      <a class="evt-btn evt-btn-ghost" href="/events/${escapeHtml(session.sessionId)}/console">キャンセル</a>
      <button type="submit" class="evt-btn evt-btn-primary">保存</button>
    </div>
  </form>
</section>`;
}

export function eventEditScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector("[data-session-id]");
  const form = document.querySelector("[data-evt-edit-form]");
  if (!root || !form) return;
  const sessionId = root.dataset.sessionId;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const startedAtLocal = String(fd.get("started_at") || "");
    const startedAt = startedAtLocal ? new Date(startedAtLocal).toISOString() : undefined;
    const targetSpecies = String(fd.get("target_species") || "")
      .split(/[,、]/).map(s => s.trim()).filter(Boolean).slice(0, 24);
    const lat = fd.get("location_lat") ? Number(fd.get("location_lat")) : null;
    const lng = fd.get("location_lng") ? Number(fd.get("location_lng")) : null;
    const radius = fd.get("location_radius_m") ? Number(fd.get("location_radius_m")) : 1000;
    const payload = {
      title: fd.get("title"),
      event_code: String(fd.get("event_code") || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      started_at: startedAt,
      primary_mode: fd.get("primary_mode"),
      target_species: targetSpecies,
      plan: fd.get("plan"),
      location_lat: Number.isFinite(lat) ? lat : null,
      location_lng: Number.isFinite(lng) ? lng : null,
      location_radius_m: Number.isFinite(radius) ? radius : 1000,
    };
    const r = await fetch("/api/v1/observation-events/" + sessionId, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      alert("保存に失敗しました: " + (await r.text()).slice(0, 200));
      return;
    }
    if (window.evtFanfare) window.evtFanfare("保存しました");
    setTimeout(() => { window.location.href = "/events/" + sessionId + "/console"; }, 500);
  });
})();
`;
}
