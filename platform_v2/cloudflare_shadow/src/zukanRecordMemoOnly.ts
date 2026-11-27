const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const ZUKAN_RECORD_MEMO_ONLY_STYLES = `
  .zt-mo-entry{display:flex;justify-content:center;margin:14px 0 4px}
  .zt-mo-open{min-height:48px;padding:8px 20px;border:1.5px solid #143F2E;border-radius:999px;background:#fff;color:#143F2E;font:inherit;font-size:16px;font-weight:700;white-space:nowrap;cursor:pointer}
  .zt-mo{width:min(92vw,520px);max-width:none;padding:20px;border:0;border-radius:20px;color:#17211B;background:#fff}
  .zt-mo::backdrop{background:rgba(0,0,0,.6)}
  .zt-mo h2{margin:0 0 12px;font-size:20px}
  .zt-mo textarea{width:100%;min-height:140px;padding:12px;border:1px solid #52685a;border-radius:12px;font:inherit;font-size:16px;color:#17211B;background:#fff;resize:vertical;box-sizing:border-box}
  .zt-mo-field{display:grid;gap:6px;margin-top:14px;min-width:0}
  .zt-mo-field>span{font-size:14px;font-weight:700;color:#55615A}
  .zt-mo-place-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
  .zt-mo-place-row output{min-width:0;overflow-wrap:anywhere;font-size:16px}
  .zt-mo-btn{min-height:44px;padding:6px 14px;border:1.5px solid #143F2E;border-radius:14px;background:#fff;color:#143F2E;font:inherit;font-size:15px;font-weight:700;white-space:nowrap;cursor:pointer}
  .zt-mo-btn.is-primary{width:100%;min-height:52px;border-radius:16px;background:#143F2E;color:#fff;font-size:17px}
  .zt-mo-btn:disabled{opacity:.5}
  .zt-mo-query{width:100%;box-sizing:border-box;min-height:44px;padding:8px 10px;border:1px solid #52685a;border-radius:14px;font:inherit;font-size:16px}
  .zt-mo-list{display:grid;gap:0;margin:8px 0 0;padding:0;list-style:none}
  .zt-mo-list li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #e3e6e0;min-width:0}
  .zt-mo-list li>span{min-width:0;overflow-wrap:anywhere;font-size:15px}
  .zt-mo-status{min-height:24px;margin:10px 0 0;font-size:15px;font-weight:700;color:#143F2E;text-align:center}
  .zt-mo-status.is-error{color:#b42318}
  .zt-mo-actions{display:grid;gap:8px;margin-top:12px}
  .zt-mo-actions a{display:flex;align-items:center;justify-content:center;min-height:48px;color:#143F2E;font-weight:700}
  .zt-mo-actions a[hidden],.zt-mo-btn[hidden],.zt-mo [hidden]{display:none!important}
`;

export function renderRecordMemoOnlyHtml(options: { lang: string; prefix: string; userId: string }): string {
  const en = options.lang === "en";
  const t = (ja: string, e: string) => (en ? e : ja);
  return `<div class="zt-mo-entry"><button type="button" class="zt-mo-open" data-zt-mo-open>${t("メモだけ残す", "Save a note only")}</button></div>
  <dialog class="zt-mo" id="zt-mo" data-zt-mo data-user-id="${esc(options.userId)}" data-prefix="${esc(options.prefix)}" aria-labelledby="zt-mo-title">
    <h2 id="zt-mo-title">${t("メモで記録する", "Record with a note")}</h2>
    <label class="zt-mo-field"><span>${t("メモ", "Note")}</span><textarea id="zt-mo-text" rows="5" maxlength="2000" placeholder="${t("気づいたことを書けます", "Write what you noticed")}"></textarea></label>
    <div class="zt-mo-field"><span>${t("場所", "Place")}</span>
      <div class="zt-mo-place-row"><output id="zt-mo-place-label">${t("現在地を記録（場所は未選択）", "Current location (no place chosen)")}</output><button type="button" class="zt-mo-btn" id="zt-mo-pick">${t("場所を選ぶ", "Choose place")}</button></div>
      <div id="zt-mo-picker" hidden>
        <input type="search" id="zt-mo-query" class="zt-mo-query" placeholder="${t("公園や場所の名前で探す", "Search park or area")}" aria-label="${t("場所を探す", "Search place")}">
        <ul class="zt-mo-list" id="zt-mo-list" aria-live="polite"></ul>
      </div>
    </div>
    <div class="zt-mo-field"><span>${t("日時", "Date & time")}</span><output id="zt-mo-time"></output></div>
    <p class="zt-mo-status" id="zt-mo-status" role="status" aria-live="polite"></p>
    <div class="zt-mo-actions">
      <button type="button" class="zt-mo-btn is-primary" id="zt-mo-save">${t("記録する", "Save")}</button>
      <a href="${esc(options.prefix)}/records?view=mine" id="zt-mo-done" hidden>${t("自分の記録を見る", "My records")}</a>
      <button type="button" class="zt-mo-btn" id="zt-mo-close" style="border-color:transparent">${t("閉じる", "Close")}</button>
    </div>
  </dialog>`;
}

export const ZUKAN_RECORD_MEMO_ONLY_SCRIPT = `
  (() => {
    const dlg = document.getElementById("zt-mo");
    if (!dlg) return;
    const $ = (id) => document.getElementById(id);
    const text = $("zt-mo-text"), statusEl = $("zt-mo-status"), saveBtn = $("zt-mo-save");
    const placeLabel = $("zt-mo-place-label"), picker = $("zt-mo-picker"), list = $("zt-mo-list"), query = $("zt-mo-query");
    let placeId = "", coords = null, submissionId = "", observedAt = "", saved = false;
    const setStatus = (m, err) => { statusEl.textContent = m; statusEl.classList.toggle("is-error", !!err); };
    const getCoords = () => new Promise((resolve) => {
      if (coords) return resolve(coords);
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition((p) => { coords = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; resolve(coords); }, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    });
    const fmt = (d) => d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    document.querySelector("[data-zt-mo-open]")?.addEventListener("click", () => {
      if (saved) { saved = false; submissionId = ""; text.value = ""; placeId = ""; $("zt-mo-done").hidden = true; saveBtn.hidden = false; }
      observedAt = new Date().toISOString();
      $("zt-mo-time").textContent = fmt(new Date(observedAt));
      setStatus("", false);
      dlg.showModal();
      text.focus();
      void getCoords();
    });
    $("zt-mo-close")?.addEventListener("click", () => dlg.close());
    async function loadPlaces() {
      const params = new URLSearchParams();
      if (query.value.trim()) params.set("q", query.value.trim());
      const c = await getCoords();
      if (c) { params.set("lat", String(c.lat)); params.set("lng", String(c.lng)); }
      list.textContent = "";
      const resp = await fetch("/api/v1/record/places/nearby?" + params.toString(), { credentials: "same-origin" });
      const data = await resp.json().catch(() => null);
      const places = resp.ok && data && Array.isArray(data.places) ? data.places : [];
      if (!places.length) { const li = document.createElement("li"); li.textContent = "近くの場所が見つかりませんでした。"; list.appendChild(li); return; }
      for (const p of places) {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = p.name + (typeof p.distanceKm === "number" ? "（現在地から " + p.distanceKm + "km）" : "");
        const b = document.createElement("button");
        b.type = "button"; b.className = "zt-mo-btn"; b.textContent = "選ぶ";
        b.addEventListener("click", () => { placeId = p.placeId; placeLabel.textContent = p.name; picker.hidden = true; });
        li.append(span, b); list.appendChild(li);
      }
    }
    $("zt-mo-pick")?.addEventListener("click", () => { picker.hidden = !picker.hidden; if (!picker.hidden) void loadPlaces(); });
    let queryTimer = null;
    query?.addEventListener("input", () => { clearTimeout(queryTimer); queryTimer = setTimeout(loadPlaces, 350); });
    saveBtn.addEventListener("click", async () => {
      const note = text.value.trim();
      if (!note) { setStatus("メモを書いてください。", true); return; }
      saveBtn.disabled = true;
      setStatus("保存しています…", false);
      try {
        const c = await getCoords();
        if (!submissionId) submissionId = "memo-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
        const resp = await fetch("/api/v1/observations/upsert", {
          method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            observationId: submissionId,
            clientSubmissionId: submissionId + "-cloudflare-memo-only",
            userId: dlg.dataset.userId,
            siteId: placeId || null,
            observedAt,
            latitude: c ? c.lat : null,
            longitude: c ? c.lng : null,
            locationAccuracyM: c ? c.acc : null,
            visibility: "private",
            note,
            taxon: { vernacularName: "未同定", rank: "unknown" },
            sourcePayload: { source: "cloudflare_record_memo_only", place_id_hint: placeId || null, mediaKind: "none" }
          })
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) throw new Error(payload.error || "request_failed");
        saved = true;
        saveBtn.hidden = true;
        $("zt-mo-done").hidden = false;
        setStatus("メモを記録しました。今は自分だけに見えています。", false);
      } catch (e) {
        setStatus("保存できませんでした。もう一度お試しください。", true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  })();
`;
