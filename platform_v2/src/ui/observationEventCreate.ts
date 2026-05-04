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

    <fieldset class="evt-area-planner">
      <legend>開催エリア</legend>

      <input type="hidden" name="field_id" data-evt-field-id />
      <input type="hidden" name="area_polygon" data-evt-area-polygon />
      <div class="evt-area-head">
        <div>
          <span class="evt-eyebrow">観察会で歩く運用範囲</span>
          <p class="evt-lead">公式な施設境界ではなく、今回の集合・移動・観察に使う範囲を決めます。</p>
        </div>
        <div class="evt-area-toolbar">
          <button type="button" class="evt-btn evt-btn-ghost" data-evt-locate style="min-height:36px; padding:6px 12px;">現在地</button>
          <button type="button" class="evt-btn evt-btn-ghost" data-evt-area-use-center style="min-height:36px; padding:6px 12px;">ここでやる</button>
          <button type="button" class="evt-btn evt-btn-primary" data-evt-area-suggest style="min-height:36px; padding:6px 12px;">AIで整える</button>
          <button type="button" class="evt-btn evt-btn-ghost" data-evt-area-undo style="min-height:36px; padding:6px 12px;">元に戻す</button>
        </div>
      </div>

      <div class="evt-area-modebar" role="group" aria-label="範囲指定モード">
        <button type="button" class="evt-recap-tab is-active" data-evt-area-mode="circle">円</button>
        <button type="button" class="evt-recap-tab" data-evt-area-mode="rect">矩形</button>
        <button type="button" class="evt-recap-tab" data-evt-area-mode="polygon">指で囲む</button>
      </div>

      <div class="evt-area-map-shell">
        <div data-evt-area-map class="evt-area-map" role="application" aria-label="開催エリアを指定する地図"></div>
        <div class="evt-area-map-fallback">
          地図を読み込めない場合も、下の緯度・経度・半径で作成できます。
        </div>
      </div>

      <div data-evt-area-status class="evt-area-status">現在地か地図上の場所を選んでください。</div>
      <div data-evt-area-suggestions class="evt-area-suggestions" style="display:none;"></div>
      <div data-evt-field-conflicts class="evt-area-conflicts" style="display:none;"></div>

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
  const areaState = {
    map: null,
    marker: null,
    mode: "circle",
    center: null,
    polygon: null,
    history: [],
    drawPoints: [],
    rectStart: null,
    selectedSuggestion: null,
    resolution: null,
    mapInitialCenter: { lat: 34.6984, lng: 137.7043 },
  };
  const areaStatus = form.querySelector("[data-evt-area-status]");
  const areaPolygonInput = form.querySelector("[data-evt-area-polygon]");
  const suggestionBox = form.querySelector("[data-evt-area-suggestions]");
  const conflictBox = form.querySelector("[data-evt-field-conflicts]");
  function setAreaStatus(text){
    if (areaStatus) areaStatus.textContent = text;
  }
  function toRad(n){ return n * Math.PI / 180; }
  function toDeg(n){ return n * 180 / Math.PI; }
  function circlePolygon(lat, lng, radiusM, points){
    const R = 6371000;
    const radius = Math.max(30, Math.min(3000, Number(radiusM) || 300));
    const count = Math.max(12, Math.min(48, points || 32));
    const latR = toRad(lat), lngR = toRad(lng), ang = radius / R;
    const coords = [];
    for (let i = 0; i < count; i++) {
      const b = 2 * Math.PI * i / count;
      const outLat = Math.asin(Math.sin(latR) * Math.cos(ang) + Math.cos(latR) * Math.sin(ang) * Math.cos(b));
      const outLng = lngR + Math.atan2(Math.sin(b) * Math.sin(ang) * Math.cos(latR), Math.cos(ang) - Math.sin(latR) * Math.sin(outLat));
      coords.push([Number(toDeg(outLng).toFixed(7)), Number(toDeg(outLat).toFixed(7))]);
    }
    coords.push(coords[0]);
    return { type: "Polygon", coordinates: [coords] };
  }
  function rectPolygon(a, b){
    const minLng = Math.min(a.lng, b.lng), maxLng = Math.max(a.lng, b.lng);
    const minLat = Math.min(a.lat, b.lat), maxLat = Math.max(a.lat, b.lat);
    return { type: "Polygon", coordinates: [[[minLng,minLat],[maxLng,minLat],[maxLng,maxLat],[minLng,maxLat],[minLng,minLat]]] };
  }
  function polygonCenter(poly){
    const ring = poly && poly.coordinates && poly.coordinates[0] ? poly.coordinates[0].slice(0, -1) : [];
    if (!ring.length) return null;
    const lng = ring.reduce((s,p) => s + p[0], 0) / ring.length;
    const lat = ring.reduce((s,p) => s + p[1], 0) / ring.length;
    return { lat, lng };
  }
  function pushAreaHistory(){
    areaState.history.push({
      center: areaState.center ? { ...areaState.center } : null,
      polygon: areaState.polygon ? JSON.parse(JSON.stringify(areaState.polygon)) : null,
      selectedSuggestion: areaState.selectedSuggestion,
    });
    areaState.history = areaState.history.slice(-3);
  }
  function setManualInputs(center, radius){
    const latI = form.querySelector('[name="location_lat"]');
    const lngI = form.querySelector('[name="location_lng"]');
    const rI = form.querySelector('[name="location_radius_m"]');
    if (latI && center) latI.value = Number(center.lat).toFixed(6);
    if (lngI && center) lngI.value = Number(center.lng).toFixed(6);
    if (rI && radius) rI.value = String(Math.round(radius));
  }
  function syncAreaLayer(){
    if (areaPolygonInput) areaPolygonInput.value = areaState.polygon ? JSON.stringify(areaState.polygon) : "";
    if (!areaState.map || !window.maplibregl) return;
    const data = { type: "FeatureCollection", features: areaState.polygon ? [{ type: "Feature", properties: {}, geometry: areaState.polygon }] : [] };
    const src = areaState.map.getSource("evt-area-current");
    if (src) src.setData(data);
    if (areaState.center) {
      if (!areaState.marker) {
        areaState.marker = new window.maplibregl.Marker({ color: "#10b981" }).setLngLat([areaState.center.lng, areaState.center.lat]).addTo(areaState.map);
      } else {
        areaState.marker.setLngLat([areaState.center.lng, areaState.center.lat]);
      }
    }
  }
  function setArea(center, polygon, opts){
    if (!opts || opts.push !== false) pushAreaHistory();
    areaState.center = center || polygonCenter(polygon);
    areaState.polygon = polygon || (areaState.center ? circlePolygon(areaState.center.lat, areaState.center.lng, Number(form.querySelector('[name="location_radius_m"]')?.value || 300)) : null);
    const radius = Number(form.querySelector('[name="location_radius_m"]')?.value || 300);
    setManualInputs(areaState.center, radius);
    clearField();
    syncAreaLayer();
    setAreaStatus("開催エリアを設定しました。必要ならAIで整えるか、手動で調整してください。");
  }
  function currentMapCenter(){
    const latI = form.querySelector('[name="location_lat"]');
    const lngI = form.querySelector('[name="location_lng"]');
    const manualLat = Number(latI?.value);
    const manualLng = Number(lngI?.value);
    const c = areaState.map ? areaState.map.getCenter() : null;
    const mapLat = c ? Number(c.lat) : NaN;
    const mapLng = c ? Number(c.lng) : NaN;
    const mapLooksUnset = Number.isFinite(mapLat) && Number.isFinite(mapLng) && mapLat === 0 && mapLng === 0 && (!latI?.value || !lngI?.value);
    if (Number.isFinite(mapLat) && Number.isFinite(mapLng) && !mapLooksUnset) return { lat: mapLat, lng: mapLng };
    if (Number.isFinite(manualLat) && Number.isFinite(manualLng)) return { lat: manualLat, lng: manualLng };
    return { ...areaState.mapInitialCenter };
  }
  function loadMapLibre(){
    return new Promise((resolve, reject) => {
      if (window.maplibregl) return resolve(window.maplibregl);
      if (!document.querySelector('link[data-evt-maplibre-css]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        css.setAttribute("data-evt-maplibre-css", "1");
        document.head.appendChild(css);
      }
      const existing = document.querySelector('script[data-evt-maplibre-js]');
      if (existing) {
        const i = setInterval(() => { if (window.maplibregl){ clearInterval(i); resolve(window.maplibregl); } }, 80);
        setTimeout(() => { clearInterval(i); window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre_timeout")); }, 7000);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      s.async = true;
      s.setAttribute("data-evt-maplibre-js", "1");
      s.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre_missing"));
      s.onerror = () => reject(new Error("maplibre_load_failed"));
      document.head.appendChild(s);
    });
  }
  async function initAreaMap(){
    const el = form.querySelector("[data-evt-area-map]");
    if (!el) return;
    try {
      const maplibregl = await loadMapLibre();
      const lat = Number(form.querySelector('[name="location_lat"]')?.value || areaState.mapInitialCenter.lat);
      const lng = Number(form.querySelector('[name="location_lng"]')?.value || areaState.mapInitialCenter.lng);
      areaState.mapInitialCenter = { lat, lng };
      areaState.map = new maplibregl.Map({
        container: el,
        center: [lng, lat],
        zoom: 16,
        attributionControl: true,
        style: {
          version: 8,
          sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      areaState.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      areaState.map.on("load", () => {
        areaState.map.addSource("evt-area-current", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        areaState.map.addLayer({ id: "evt-area-fill", type: "fill", source: "evt-area-current", paint: { "fill-color": "#10b981", "fill-opacity": 0.24 } });
        areaState.map.addLayer({ id: "evt-area-line", type: "line", source: "evt-area-current", paint: { "line-color": "#059669", "line-width": 3 } });
        syncAreaLayer();
      });
      areaState.map.on("click", (e) => {
        const p = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const radius = Number(form.querySelector('[name="location_radius_m"]')?.value || 300);
        if (areaState.mode === "circle") {
          setArea(p, circlePolygon(p.lat, p.lng, radius));
        } else if (areaState.mode === "rect") {
          if (!areaState.rectStart) {
            areaState.rectStart = p;
            setAreaStatus("矩形の反対側をタップしてください。");
          } else {
            setArea(polygonCenter(rectPolygon(areaState.rectStart, p)), rectPolygon(areaState.rectStart, p));
            areaState.rectStart = null;
          }
        } else {
          areaState.drawPoints.push([p.lng, p.lat]);
          if (areaState.drawPoints.length >= 3) {
            const coords = areaState.drawPoints.concat([areaState.drawPoints[0]]);
            setArea(polygonCenter({ type: "Polygon", coordinates: [coords] }), { type: "Polygon", coordinates: [coords] });
          } else {
            setAreaStatus("3点以上タップすると範囲になります。続けて囲んでください。");
          }
        }
      });
    } catch (_) {
      setAreaStatus("地図を読み込めませんでした。緯度・経度・半径で作成できます。");
    }
  }
  initAreaMap();
  form.querySelectorAll("[data-evt-area-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      form.querySelectorAll("[data-evt-area-mode]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      areaState.mode = btn.getAttribute("data-evt-area-mode") || "circle";
      areaState.drawPoints = [];
      areaState.rectStart = null;
      setAreaStatus(areaState.mode === "polygon" ? "地図上を3点以上タップして範囲を囲んでください。" : "地図上をタップして範囲を指定してください。");
    });
  });
  form.querySelector("[data-evt-area-use-center]")?.addEventListener("click", () => {
    const center = currentMapCenter();
    const lat = center.lat;
    const lng = center.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const radius = Number(form.querySelector('[name="location_radius_m"]')?.value || 300);
    setArea({ lat, lng }, circlePolygon(lat, lng, radius));
  });
  form.querySelector("[data-evt-area-undo]")?.addEventListener("click", () => {
    const prev = areaState.history.pop();
    if (!prev) return;
    areaState.center = prev.center;
    areaState.polygon = prev.polygon;
    areaState.selectedSuggestion = prev.selectedSuggestion;
    setManualInputs(areaState.center, Number(form.querySelector('[name="location_radius_m"]')?.value || 300));
    syncAreaLayer();
    setAreaStatus("ひとつ前の範囲に戻しました。");
  });
  function renderSuggestions(suggestions){
    if (!suggestionBox) return;
    suggestionBox.innerHTML = "";
    suggestionBox.style.display = suggestions && suggestions.length ? "" : "none";
    suggestions.forEach(s => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "evt-area-suggestion";
      card.innerHTML = '<strong>' + escapeText(s.label) + '</strong><span>' + escapeText(s.reason) + '</span>' +
        (s.warnings && s.warnings.length ? '<span>' + escapeText(s.warnings[0]) + '</span>' : "");
      card.addEventListener("click", () => {
        suggestionBox.querySelectorAll(".evt-area-suggestion").forEach(x => x.classList.remove("is-selected"));
        card.classList.add("is-selected");
        areaState.selectedSuggestion = s;
        setArea(s.center, s.geometry);
      });
      suggestionBox.appendChild(card);
    });
  }
  form.querySelector("[data-evt-area-suggest]")?.addEventListener("click", async () => {
    const lat = areaState.center?.lat ?? Number(form.querySelector('[name="location_lat"]')?.value);
    const lng = areaState.center?.lng ?? Number(form.querySelector('[name="location_lng"]')?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setAreaStatus("先に現在地か地図上の場所を選んでください。");
      return;
    }
    setAreaStatus("AIが範囲候補を作っています。");
    try {
      const r = await fetch("/api/v1/observation-events/area-suggestions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          center: { lat, lng },
          radius_m: Number(form.querySelector('[name="location_radius_m"]')?.value || 300),
          drawn_polygon: areaState.polygon,
          place_label: String(form.querySelector('[name="new_field_name"]')?.value || form.querySelector('[name="title"]')?.value || ""),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      renderSuggestions(data.suggestions || []);
      setAreaStatus(data.provider === "gemini" ? "AI候補を3つ作りました。" : "AIが混雑中のため、安全な補正候補を作りました。");
    } catch (err) {
      setAreaStatus("候補作成に失敗しました。手動範囲のまま作成できます。");
    }
  });
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
    areaState.center = { lat: Number(field.lat), lng: Number(field.lng) };
    areaState.polygon = field.polygon || circlePolygon(Number(field.lat), Number(field.lng), field.radiusM ?? field.radius_m ?? 1000);
    syncAreaLayer();
    if (areaState.map && Number.isFinite(areaState.center.lat) && Number.isFinite(areaState.center.lng)) {
      areaState.map.flyTo({ center: [areaState.center.lng, areaState.center.lat], zoom: 16 });
    }
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

  // ?field_id=<uuid> で地図・フォームへ反映
  const fieldIdParam = new URLSearchParams(window.location.search).get("field_id");
  if (fieldIdParam) {
    (async () => {
      try {
        const r = await fetch("/api/v1/fields/" + encodeURIComponent(fieldIdParam), { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json();
        if (data?.field) selectField(data.field);
      } catch (_) {}
    })();
  }

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
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const radius = Number(form.querySelector('[name="location_radius_m"]')?.value || 300);
      setArea({ lat, lng }, circlePolygon(lat, lng, radius));
      if (areaState.map) areaState.map.flyTo({ center: [lng, lat], zoom: 17 });
      if (window.evtFanfare) window.evtFanfare("位置を取得した");
    }, (err) => {
      alert("位置情報を取得できませんでした: " + (err?.message || ""));
    }, { enableHighAccuracy: true, timeout: 6000 });
  });

  function renderFieldConflicts(conflicts){
    if (!conflictBox) return;
    conflictBox.innerHTML = "";
    conflictBox.style.display = conflicts && conflicts.length ? "" : "none";
    if (!conflicts || !conflicts.length) return;
    const first = conflicts[0];
    const field = first.field || first;
    const wrap = document.createElement("div");
    wrap.className = "evt-area-conflict";
    wrap.style.gridColumn = "1 / -1";
    wrap.innerHTML =
      '<strong>似たフィールドがあります。今回の観察会ではどの範囲を使うか選んでください。</strong>' +
      '<span>既存: ' + escapeText(field?.name || "") + ' / 約 ' + Math.round(first.distanceM || first.distance_m || 0) + 'm</span>' +
      '<label style="display:grid;gap:4px;font-weight:700;font-size:12px;">別名で保存する場合' +
      '<input data-evt-conflict-new-name placeholder="例: ' + escapeText((field?.name || "開催エリア") + "（公園側）") + '" style="min-height:40px;border:1px solid var(--evt-line);border-radius:12px;padding:8px 10px;" />' +
      '</label>' +
      '<div class="evt-area-conflict-actions">' +
      '<button type="button" class="evt-btn evt-btn-ghost" data-conflict-action="use_existing" style="min-height:36px;padding:6px 12px;">既存フィールドを使う</button>' +
      '<button type="button" class="evt-btn evt-btn-ghost" data-conflict-action="update_existing" style="min-height:36px;padding:6px 12px;">範囲を更新する</button>' +
      '<button type="button" class="evt-btn evt-btn-primary" data-conflict-action="save_as_new" style="min-height:36px;padding:6px 12px;">別名で保存する</button>' +
      '</div>';
    conflictBox.appendChild(wrap);
    wrap.querySelectorAll("[data-conflict-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-conflict-action");
        if (action === "save_as_new") {
          const nextName = String(wrap.querySelector("[data-evt-conflict-new-name]")?.value || "").trim();
          if (!nextName) {
            alert("別名を入力してください。");
            return;
          }
          const nameI = form.querySelector('[name="new_field_name"]');
          if (nameI) nameI.value = nextName;
        }
        areaState.resolution = { action, fieldId: field?.fieldId || field?.field_id || first.fieldId || first.field_id || "" };
        conflictBox.style.display = "none";
        form.requestSubmit();
      });
    });
  }

  async function resolveFieldForEvent(fd, lat, lng, radius){
    const explicitFieldId = String(fd.get("field_id") || "") || null;
    if (explicitFieldId) return { fieldId: explicitFieldId, action: "use_existing" };
    const title = String(fd.get("title") || "").trim();
    const newFieldName = String(fd.get("new_field_name") || "").trim() || (title ? "観察会: " + title : "");
    const polygon = areaState.polygon || null;
    if (!newFieldName || !Number.isFinite(lat) || !Number.isFinite(lng) || (!polygon && !String(fd.get("new_field_name") || "").trim())) {
      return { fieldId: null, action: "none" };
    }
    const suggestion = areaState.selectedSuggestion;
    const body = {
      name: newFieldName,
      lat, lng,
      radius_m: Number.isFinite(radius) ? radius : 300,
      polygon,
      payload: {
        field_kind: "event_operational_area",
        area_planner: {
          source: suggestion?.source || (polygon ? "manual" : "radius"),
          variant: suggestion?.id || null,
          warnings: suggestion?.warnings || [],
        },
      },
    };
    if (areaState.resolution?.action) {
      body.resolution_action = areaState.resolution.action;
      body.resolution_field_id = areaState.resolution.fieldId;
    }
    const r = await fetch("/api/v1/fields", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (r.status === 409 && data?.conflicts) {
      renderFieldConflicts(data.conflicts);
      setAreaStatus(data.message || "似たフィールドがあります。使う範囲を選んでください。");
      throw new Error("field_resolution_required");
    }
    if (!r.ok) throw new Error(data?.error || "field_create_failed");
    areaState.resolution = null;
    return { fieldId: data?.field?.fieldId || data?.field?.field_id || null, action: data?.resolution?.action || "created" };
  }

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

    let fieldResolution = { fieldId: String(fd.get("field_id") || "") || null, action: "none" };
    try {
      fieldResolution = await resolveFieldForEvent(fd, lat, lng, radius);
    } catch (err) {
      if (String(err?.message || "") === "field_resolution_required") return;
      alert("開催エリアの保存に失敗しました: " + String(err?.message || err).slice(0, 160));
      return;
    }

    const templateFrom = new URLSearchParams(window.location.search).get("template_from");
    const suggestion = areaState.selectedSuggestion;

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
      field_id: fieldResolution.fieldId,
      template_source_session_id: templateFrom || null,
      config: {
        area_plan_source: suggestion?.source || (areaState.polygon ? "manual" : "none"),
        area_plan_variant: suggestion?.id || null,
        area_plan_warnings: suggestion?.warnings || [],
        field_resolution_action: fieldResolution.action,
      },
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
