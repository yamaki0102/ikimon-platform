import { EVENT_MODES } from "../services/observationEventModeManager.js";
import type { ObservationEventStrings } from "../i18n/strings.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderEventCreateBody(args: {
  isAuthenticated: boolean;
  strings: ObservationEventStrings;
}): string {
  const { isAuthenticated, strings } = args;

  if (!isAuthenticated) {
    return `
<section class="evt-recap-shell">
  <article class="evt-card">
    <span class="evt-eyebrow">${escapeHtml(strings.listCreateCta)}</span>
    <h1 class="evt-heading">主催者アカウントでログインしてください</h1>
    <p class="evt-lead">観察会を作成するには、主催者として ikimon にログインする必要があります。</p>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <a class="evt-btn evt-btn-primary" href="/auth?redirect=${encodeURIComponent("/community/events/new")}">ログイン</a>
      <a class="evt-btn evt-btn-ghost" href="/community/events">一覧に戻る</a>
    </div>
  </article>
</section>`;
  }

  const modeOptions = EVENT_MODES.map((mode) => {
    const label = strings.modeLabels[mode] ?? mode;
    const selected = mode === "discovery" ? " selected" : "";
    return `<option value="${mode}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");

  return `
<section class="evt-recap-shell">
  <article class="evt-hero">
    <span class="evt-hero-eyebrow">${escapeHtml(strings.listCreateCta)}</span>
    <h1>新しい観察会をひらく</h1>
    <p>30 秒で告知 → QR で参加 → 班でリアルタイム協力 → 自治体提出。すべての段階を 1 セッションで。</p>
  </article>

  <form class="evt-checkin-form" data-evt-create-form>
    <label>タイトル
      <input name="title" required maxlength="80" placeholder="例: 春の里山観察会" />
    </label>

    <label>開始日時
      <input name="started_at" required type="datetime-local" />
    </label>

    <label>参加コード(6 文字英数大文字、空欄なら自動生成)
      <input name="event_code" maxlength="8" pattern="[A-Z0-9]*" placeholder="例: HAMA26"
             style="font-family:'Roboto Mono',monospace; text-transform:uppercase; letter-spacing:.12em;" />
    </label>

    <label>開始モード
      <select name="primary_mode" required>
        ${modeOptions}
      </select>
    </label>

    <label>目標種(カンマ区切り、最大 12 種)
      <input name="target_species" placeholder="例: ヤマセミ, エナガ, シジュウカラ" />
    </label>

    <fieldset style="border:1px solid var(--evt-line); border-radius:14px; padding:12px 14px; display:grid; gap:8px;">
      <legend style="padding:0 6px; font-weight:700; font-size:13px;">開催地（任意）</legend>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <label>緯度
          <input name="location_lat" type="number" step="0.000001" placeholder="35.681236" />
        </label>
        <label>経度
          <input name="location_lng" type="number" step="0.000001" placeholder="139.767125" />
        </label>
      </div>
      <label>半径(m)
        <input name="location_radius_m" type="number" min="100" max="50000" value="1000" />
      </label>
      <button type="button" class="evt-btn evt-btn-ghost" data-evt-locate>📍 現在地から取得</button>
    </fieldset>

    <label>プラン
      <select name="plan">
        <option value="community" selected>コミュニティ(無料)</option>
        <option value="public">Public(法人・自治体提出対応)</option>
      </select>
    </label>

    <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:8px;">
      <a class="evt-btn evt-btn-ghost" href="/community/events">キャンセル</a>
      <button type="submit" class="evt-btn evt-btn-primary">✨ 観察会を作成</button>
    </div>
  </form>
</section>`;
}

export function eventCreateScript(): string {
  return String.raw`
(() => {
  const form = document.querySelector("[data-evt-create-form]");
  if (!form) return;

  // 初期 datetime-local 値: 30 分後を提示
  const startInput = form.querySelector('[name="started_at"]');
  if (startInput && !startInput.value) {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    startInput.value = d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate())
      + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  // 現在地取得
  form.querySelector("[data-evt-locate]")?.addEventListener("click", () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      form.querySelector('[name="location_lat"]').value = lat;
      form.querySelector('[name="location_lng"]').value = lng;
      if (window.evtFanfare) window.evtFanfare("位置を取得した");
    }, (err) => {
      alert("位置情報を取得できませんでした: " + (err?.message || ""));
    }, { enableHighAccuracy: true, timeout: 6000 });
  });

  function genEventCode(){
    const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random()*chars.length));
    return out;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const startedAtLocal = String(fd.get("started_at") || "");
    const startedAt = startedAtLocal ? new Date(startedAtLocal).toISOString() : new Date().toISOString();
    const eventCode = String(fd.get("event_code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || genEventCode();
    const targetSpecies = String(fd.get("target_species") || "")
      .split(/[,、]/).map(s => s.trim()).filter(Boolean).slice(0, 12);
    const lat = fd.get("location_lat") ? Number(fd.get("location_lat")) : null;
    const lng = fd.get("location_lng") ? Number(fd.get("location_lng")) : null;
    const radius = fd.get("location_radius_m") ? Number(fd.get("location_radius_m")) : 1000;

    const payload = {
      title: fd.get("title"),
      event_code: eventCode,
      started_at: startedAt,
      primary_mode: fd.get("primary_mode"),
      active_modes: [fd.get("primary_mode")],
      target_species: targetSpecies,
      plan: fd.get("plan"),
      location_lat: Number.isFinite(lat) ? lat : null,
      location_lng: Number.isFinite(lng) ? lng : null,
      location_radius_m: Number.isFinite(radius) ? radius : 1000,
    };
    const r = await fetch("/api/v1/observation-events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.text();
      alert("作成に失敗しました: " + err.slice(0, 200));
      return;
    }
    const data = await r.json();
    const sessionId = data?.sessionId || data?.session_id;
    if (window.evtFanfare) window.evtFanfare("観察会を作成しました");
    setTimeout(() => {
      window.location.href = "/events/" + sessionId + "/console";
    }, 600);
  });
})();
`;
}
