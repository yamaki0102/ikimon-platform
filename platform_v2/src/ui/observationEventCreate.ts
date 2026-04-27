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

    <fieldset style="border:1px solid var(--evt-line); border-radius:14px; padding:12px 14px; display:grid; gap:10px;">
      <legend style="padding:0 6px; font-weight:700; font-size:13px;">フィールド（開催エリア）</legend>

      <input type="hidden" name="field_id" data-evt-field-id />
      <div data-evt-field-summary class="evt-card" style="display:none; padding:10px 12px; background:rgba(16,185,129,.06); border-color:rgba(16,185,129,.32);">
        <span class="evt-eyebrow">選択中のフィールド</span>
        <strong data-evt-field-name style="display:block; margin-top:4px;">—</strong>
        <span data-evt-field-meta class="evt-lead" style="font-size:12px;"></span>
        <button type="button" class="evt-btn evt-btn-ghost" data-evt-field-clear style="min-height:32px; margin-top:6px; padding:4px 10px;">解除</button>
      </div>

      <div class="evt-recap-tabs" style="margin-top:0;">
        <button type="button" class="evt-recap-tab is-active" data-field-tab="mine">マイ</button>
        <button type="button" class="evt-recap-tab" data-field-tab="nearby">近隣</button>
        <button type="button" class="evt-recap-tab" data-field-tab="certified">認定地</button>
        <button type="button" class="evt-recap-tab" data-field-tab="manual">手入力</button>
      </div>

      <div data-field-panel="mine">
        <p class="evt-lead">過去に作ったフィールドから選ぶ。</p>
        <div data-field-list-mine style="display:grid; gap:6px; max-height:240px; overflow:auto;"></div>
      </div>

      <div data-field-panel="nearby" style="display:none;">
        <p class="evt-lead">現在地から半径 10km 以内のフィールド。</p>
        <button type="button" class="evt-btn evt-btn-ghost" data-evt-load-nearby style="min-height:36px; padding:6px 12px;">📍 近隣を取得</button>
        <div data-field-list-nearby style="display:grid; gap:6px; max-height:240px; overflow:auto; margin-top:8px;"></div>
      </div>

      <div data-field-panel="certified" style="display:none;">
        <p class="evt-lead">環境省「自然共生サイト」と国交省 TSUNAG（優良緑地確保計画認定制度）から検索。</p>
        <div style="display:grid; grid-template-columns: 1fr auto; gap:6px;">
          <input data-evt-cert-search placeholder="例: 東京都 / 渋谷区 / サイト名" style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px;" />
          <select data-evt-cert-source style="border:1px solid var(--evt-line); border-radius:12px; padding:8px 12px;">
            <option value="nature_symbiosis_site">自然共生サイト</option>
            <option value="tsunag">TSUNAG</option>
          </select>
        </div>
        <div data-field-list-certified style="display:grid; gap:6px; max-height:240px; overflow:auto; margin-top:8px;"></div>
      </div>

      <div data-field-panel="manual" style="display:none;">
        <p class="evt-lead">座標を手入力。あとからフィールド DB に保存できます。</p>
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
        <label>このエリアに名前をつけてフィールド DB に保存
          <input name="new_field_name" placeholder="例: 鎌倉広町緑地（北側エントランス）" />
        </label>
        <button type="button" class="evt-btn evt-btn-ghost" data-evt-locate>📍 現在地から取得</button>
      </div>
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

  // ============ field picker ============
  const fieldIdInput = form.querySelector("[data-evt-field-id]");
  const fieldSummary = form.querySelector("[data-evt-field-summary]");
  const fieldNameEl = form.querySelector("[data-evt-field-name]");
  const fieldMetaEl = form.querySelector("[data-evt-field-meta]");
  function escapeText(s){
    return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function selectField(field){
    if (!field) return;
    if (fieldIdInput) fieldIdInput.value = field.fieldId || field.field_id || "";
    if (fieldSummary) fieldSummary.style.display = "";
    if (fieldNameEl) fieldNameEl.textContent = field.name;
    const meta = [
      field.prefecture, field.city,
      field.areaHa ? field.areaHa.toFixed(2) + " ha" : null,
      field.source && field.source !== "user_defined" ? field.source : null,
    ].filter(Boolean).join(" • ");
    if (fieldMetaEl) fieldMetaEl.textContent = meta;
    const latI = form.querySelector('[name="location_lat"]');
    const lngI = form.querySelector('[name="location_lng"]');
    const rI = form.querySelector('[name="location_radius_m"]');
    if (latI) latI.value = field.lat;
    if (lngI) lngI.value = field.lng;
    if (rI) rI.value = field.radiusM ?? field.radius_m ?? 1000;
  }
  function clearField(){
    if (fieldIdInput) fieldIdInput.value = "";
    if (fieldSummary) fieldSummary.style.display = "none";
  }
  form.querySelector("[data-evt-field-clear]")?.addEventListener("click", clearField);

  function renderFieldList(container, fields){
    if (!container) return;
    container.innerHTML = "";
    if (!fields || fields.length === 0){
      const p = document.createElement("p");
      p.className = "evt-lead";
      p.textContent = "見つかりませんでした。";
      container.appendChild(p);
      return;
    }
    fields.forEach(f => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "evt-checkin-team-card";
      card.style.textAlign = "left";
      const dist = (typeof f.distanceKm === "number") ? " • " + f.distanceKm.toFixed(1) + " km" : "";
      card.innerHTML =
        '<strong>' + escapeText(f.name) + '</strong>' +
        '<span class="evt-lead" style="font-size:12px;">' +
          escapeText([f.prefecture, f.city].filter(Boolean).join(" / ")) + dist +
        '</span>';
      card.addEventListener("click", () => selectField(f));
      container.appendChild(card);
    });
  }

  // タブ切替
  form.querySelectorAll("[data-field-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      form.querySelectorAll("[data-field-tab]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const target = btn.getAttribute("data-field-tab");
      form.querySelectorAll("[data-field-panel]").forEach(p => {
        p.style.display = (p.getAttribute("data-field-panel") === target) ? "" : "none";
      });
    });
  });

  // マイ: 即時ロード
  (async () => {
    try {
      const r = await fetch("/api/v1/fields?mine=1&limit=20", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        renderFieldList(form.querySelector("[data-field-list-mine]"), data.fields || []);
      }
    } catch(_){}
  })();

  // 近隣
  form.querySelector("[data-evt-load-nearby]")?.addEventListener("click", () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      try {
        const r = await fetch("/api/v1/fields?nearby=" + lat + "," + lng + "&km=10&limit=30", { credentials: "include" });
        if (r.ok) {
          const data = await r.json();
          renderFieldList(form.querySelector("[data-field-list-nearby]"), data.fields || []);
        }
      } catch(_){}
    }, () => {}, { enableHighAccuracy: true, timeout: 6000 });
  });

  // テンプレート prefill: ?template_from=<sessionId> で過去観察会の値を流し込む
  const templateFromParam = new URLSearchParams(window.location.search).get("template_from");
  if (templateFromParam) {
    (async () => {
      try {
        const r = await fetch("/api/v1/observation-events/" + templateFromParam, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        const s = data?.session;
        if (!s) return;
        const titleI = form.querySelector('[name="title"]');
        if (titleI && s.title) titleI.value = s.title + "（再開催）";
        const tspI = form.querySelector('[name="target_species"]');
        if (tspI && Array.isArray(s.targetSpecies)) tspI.value = s.targetSpecies.join(", ");
        const modeI = form.querySelector('[name="primary_mode"]');
        if (modeI && s.primaryMode) modeI.value = s.primaryMode;
        if (s.fieldId) {
          try {
            const fr = await fetch("/api/v1/fields/" + s.fieldId, { credentials: "include" });
            if (fr.ok) {
              const fd = await fr.json();
              if (fd?.field) selectField(fd.field);
            }
          } catch(_){}
        } else if (s.locationLat != null && s.locationLng != null) {
          const latI = form.querySelector('[name="location_lat"]');
          const lngI = form.querySelector('[name="location_lng"]');
          const rI = form.querySelector('[name="location_radius_m"]');
          if (latI) latI.value = s.locationLat;
          if (lngI) lngI.value = s.locationLng;
          if (rI && s.locationRadiusM) rI.value = s.locationRadiusM;
        }
        if (window.evtFanfare) window.evtFanfare("テンプレートを読み込み");
      } catch(_){}
    })();
  }

  // 認定地
  let certTimer = null;
  function reloadCertified(){
    const q = String(form.querySelector("[data-evt-cert-search]")?.value || "").trim();
    const source = form.querySelector("[data-evt-cert-source]")?.value || "nature_symbiosis_site";
    const url = q
      ? "/api/v1/fields?q=" + encodeURIComponent(q) + "&limit=30"
      : "/api/v1/fields?certified=" + source + "&limit=60";
    fetch(url, { credentials: "include" }).then(r => r.ok ? r.json() : null).then(data => {
      const all = (data && data.fields) ? data.fields : [];
      const filtered = q ? all : all.filter(f => f.source === source);
      renderFieldList(form.querySelector("[data-field-list-certified]"), filtered);
    }).catch(() => {});
  }
  form.querySelector("[data-evt-cert-search]")?.addEventListener("input", () => {
    clearTimeout(certTimer);
    certTimer = setTimeout(reloadCertified, 280);
  });
  form.querySelector("[data-evt-cert-source]")?.addEventListener("change", reloadCertified);
  // 初回ロード
  reloadCertified();

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

    let fieldId = String(fd.get("field_id") || "") || null;
    const newFieldName = String(fd.get("new_field_name") || "").trim();
    if (!fieldId && newFieldName && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        const r = await fetch("/api/v1/fields", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newFieldName, lat, lng, radius_m: radius }),
        });
        if (r.ok) {
          const data = await r.json();
          fieldId = data?.field?.fieldId ?? null;
        }
      } catch(_) {}
    }

    const templateFrom = new URLSearchParams(window.location.search).get("template_from");

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
      field_id: fieldId,
      template_source_session_id: templateFrom || null,
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
