import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { listInvasiveReportingVisibility } from "../services/invasiveReporting.js";
import {
  findInvasiveSpeciesBySlug,
  invasiveSpeciesDetailPath,
  INVASIVE_SPECIES_LIST_PATH,
  INVASIVE_SPECIES_OFFICIAL_SOURCES,
  listInvasiveSpecies,
  type InvasiveSpeciesCatalogItem,
} from "../services/invasiveSpeciesCatalog.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type InvasiveReportingRecipientsQuery = {
  scientificName?: string;
  vernacularName?: string;
  invasiveStatus?: string;
  prefecture?: string;
  municipality?: string;
};

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function speciesHref(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  return appendLangToHref(withBasePath(basePath, invasiveSpeciesDetailPath(item)), lang);
}

function renderOfficialSources(): string {
  return `<div class="invasive-official-sources">
    <strong>公式情報</strong>
    ${INVASIVE_SPECIES_OFFICIAL_SOURCES.map((source) =>
      `<a href="${escapeHtml(source.href)}" target="_blank" rel="noreferrer">${escapeHtml(source.label)}</a>`,
    ).join("")}
  </div>`;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderCommonSafety(): string {
  return `<section class="invasive-safety">
    <span>見つけた人向け</span>
    <h2>触らず、写真と場所を残す。</h2>
    <p>外来種かもしれない生きものを見つけたら、近づきすぎず、写真・場所・日時を記録してください。生きもの、卵、種子、植物片は運ばず、捕獲や駆除は自治体や土地の管理者の案内に従ってください。</p>
  </section>`;
}

function renderActionSources(item: InvasiveSpeciesCatalogItem): string {
  const actionSources = [
    {
      source: "国のルール",
      action: item.legalWarning || "生きた個体や植物片を運ばず、法令上の扱いを確認する。",
      status: item.categoryLabel,
    },
    {
      source: "地域の相談先",
      action: item.actionBasis || "地域の状況に合わせて、自治体や土地の管理者が相談先や対応方法を案内します。",
      status: "自治体・管理者",
    },
    {
      source: "ikimon.life",
      action: "投稿が外来種候補になり、地域と受け取り許可が合う団体がある場合だけ、その団体へ情報が届きます。関係ない団体へ勝手に送ることはありません。",
      status: "条件つき",
    },
  ];

  return `<section class="invasive-action-sources" aria-label="推奨アクションの出し手">
    <div class="invasive-section-head">
      <span>どこに従う？</span>
      <h2>まずは国のルールと、地域の案内を見る</h2>
      <p>同じ外来種でも、法律で禁止されていることと、地域で相談してほしいことは少し違います。迷ったら「触らない・運ばない」を守り、自治体や土地の管理者へ相談してください。</p>
    </div>
    <div class="invasive-action-source-grid">
      ${actionSources.map((entry) => `<article class="invasive-action-source">
        <div>
          <strong>${escapeHtml(entry.source)}</strong>
          <span>${escapeHtml(entry.status)}</span>
        </div>
        <p>${escapeHtml(entry.action)}</p>
      </article>`).join("")}
    </div>
    <a class="invasive-source-link" href="#invasive-partner-form">自治体・団体向けの受け取り相談</a>
  </section>`;
}

function renderReportingVisibility(basePath: string, item: InvasiveSpeciesCatalogItem): string {
  const apiPath = withBasePath(basePath, "/api/v1/invasive-reporting/recipients");
  const submitEndpoint = withBasePath(basePath, "/api/v1/contact/submit");
  return `<section class="invasive-reporting-visibility" aria-label="自動通報連携団体">
    <div class="invasive-section-head">
      <span>投稿したあと</span>
      <h2>この投稿は、どこへ届く？</h2>
      <p>ikimon.life では、受け取りを許可している自治体・研究機関・管理団体がある地域だけ、外来種候補の投稿情報を自動で届けます。連携先がない地域では、自動送信はしません。</p>
    </div>
    <div class="invasive-reporting-board">
      <article class="invasive-reporting-slot is-active">
        <span>この生きもの</span>
        <strong>${escapeHtml(item.vernacularName)}</strong>
        <p>${escapeHtml(item.categoryLabel)} / ${escapeHtml(item.actionLabel)}</p>
      </article>
      <article class="invasive-reporting-slot">
        <span>届く可能性がある団体</span>
        <strong>地域を入れると確認できます</strong>
        <p>受け取り許可がある団体と投稿地点が合う場合だけ、写真・場所・日時などを共有します。</p>
      </article>
      <article class="invasive-reporting-slot is-empty">
        <span>届かない場合</span>
        <strong>自動送信されません</strong>
        <p>連携先がない地域では送信せず、必要に応じて公式窓口への相談を案内します。</p>
      </article>
    </div>
    <div class="invasive-region-check" data-inv-reporting-check data-api-path="${escapeHtml(apiPath)}" data-species='${escapeHtml(scriptJson({
      scientificName: item.scientificName,
      vernacularName: item.vernacularName,
      invasiveStatus: item.category,
    }))}'>
      <div>
        <strong>投稿地点で確認する</strong>
        <p>都道府県と市区町村を入れると、この地域で自動送信される団体があるか確認できます。</p>
      </div>
      <form class="invasive-region-form">
        <label>都道府県<input name="prefecture" autocomplete="address-level1" placeholder="例: 静岡県"></label>
        <label>市区町村<input name="municipality" autocomplete="address-level2" placeholder="例: 浜松市"></label>
        <button type="submit">確認</button>
      </form>
      <div class="invasive-region-result" aria-live="polite">地域を入力すると、自動で届く団体があるかをここに表示します。</div>
    </div>
    <div class="invasive-partner-cta" id="invasive-partner-form">
      <div>
        <strong>自治体・研究機関・管理団体の方へ</strong>
        <p>対象地域、対象種、受け取りたい情報をこの場で送れます。確認後、受信方法や停止条件を一緒に整理します。</p>
      </div>
      <form class="invasive-partner-form" data-inv-partner-form data-submit-path="${escapeHtml(submitEndpoint)}" data-species='${escapeHtml(scriptJson({
        scientificName: item.scientificName,
        vernacularName: item.vernacularName,
        invasiveStatus: item.category,
      }))}'>
        <label>団体名<input name="organization" autocomplete="organization" required maxlength="200" placeholder="例: 浜松市 環境政策課"></label>
        <label>担当者名<input name="name" autocomplete="name" maxlength="200" placeholder="例: 山田 太郎"></label>
        <label>メールアドレス<input name="email" type="email" autocomplete="email" required maxlength="200" placeholder="example@example.jp"></label>
        <label>対象地域<input name="area" required maxlength="300" placeholder="例: 静岡県浜松市、管理している公園名など"></label>
        <label class="is-wide">受け取りたい情報<textarea name="request" required minlength="5" maxlength="3000" placeholder="例: ヌートリアの写真、発見場所、日時を受け取りたい。対象地域は浜松市内。"></textarea></label>
        <label class="is-wide">補足<textarea name="note" maxlength="3000" placeholder="公式窓口URL、対象種、停止条件、電話連絡の可否など"></textarea></label>
        <label class="invasive-partner-trap" aria-hidden="true">Webサイト<input name="website" autocomplete="off" tabindex="-1"></label>
        <div class="invasive-partner-form-actions">
          <button type="submit">この内容で相談する</button>
          <span class="invasive-partner-form-status" aria-live="polite"></span>
        </div>
        <noscript><p class="invasive-partner-form-status is-error">送信には JavaScript が必要です。</p></noscript>
      </form>
    </div>
  </section>`;
}

function renderReportingVisibilityScript(): string {
  return `<script>
(function(){
  var root = document.querySelector("[data-inv-reporting-check]");
  var partnerForm = document.querySelector("[data-inv-partner-form]");
  if (!window.fetch) return;
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[ch] || ch;
    });
  }
  if (root) {
    var form = root.querySelector(".invasive-region-form");
    var result = root.querySelector(".invasive-region-result");
    var apiPath = root.getAttribute("data-api-path") || "/api/v1/invasive-reporting/recipients";
    var species = {};
    try { species = JSON.parse(root.getAttribute("data-species") || "{}"); } catch (_) { species = {}; }
    function statusLabel(status, enabled) {
      if (enabled) return "自動共有あり";
      if (status === "external_only") return "公式フォーム案内";
      if (status === "pending") return "確認中";
      if (status === "approved") return "条件不足";
      if (status === "denied" || status === "revoked") return "停止中";
      return "自動送信なし";
    }
    function render(data) {
      if (!data || data.available === false) {
        result.innerHTML = "<strong>連携情報を確認できません</strong><p>現在は公式窓口の案内だけを表示します。</p>";
        return;
      }
      if (!data.contacts || data.contacts.length === 0) {
        var copy = data.reason === "location_required" ? "都道府県または市区町村を入力してください。" : "一致する連携先はまだ登録されていません。";
        result.innerHTML = "<strong>この地域で自動送信される団体はまだありません</strong><p>" + esc(copy) + " 自治体・研究機関・管理団体の方は、下の相談窓口から受信連携を相談できます。</p>";
        return;
      }
      var cards = data.contacts.map(function(contact) {
        var label = statusLabel(contact.sendPermissionStatus, contact.autoDeliveryEnabled);
        var locality = contact.jurisdiction && contact.jurisdiction.localityLabel ? contact.jurisdiction.localityLabel : "";
        var fields = (contact.requiredFields || []).slice(0, 4).join(" / ");
        return '<article><span>' + esc(label) + '</span><strong>' + esc(contact.organizationName) + '</strong><p>' + esc([contact.departmentName, locality].filter(Boolean).join(" / ")) + '</p><p>' + esc(contact.userGuidanceJa || fields || "写真・場所・日時が判断材料になります。") + '</p></article>';
      }).join("");
      result.innerHTML = '<strong>' + esc(String(data.autoDeliveryCount || 0)) + '件へ自動送信されます</strong><div class="invasive-region-result-grid">' + cards + '</div>';
    }
    form && form.addEventListener("submit", function(event) {
      event.preventDefault();
      var params = new URLSearchParams();
      Object.keys(species).forEach(function(key) { if (species[key]) params.set(key, species[key]); });
      var prefecture = String(new FormData(form).get("prefecture") || "").trim();
      var municipality = String(new FormData(form).get("municipality") || "").trim();
      if (prefecture) params.set("prefecture", prefecture);
      if (municipality) params.set("municipality", municipality);
      result.textContent = "確認しています。";
      fetch(apiPath + "?" + params.toString(), { headers: { "Accept": "application/json" } })
        .then(function(response) { return response.ok ? response.json() : Promise.reject(new Error("request_failed")); })
        .then(render)
        .catch(function(){ render({ available: false, contacts: [] }); });
    });
  }
  if (partnerForm) {
    var partnerStatus = partnerForm.querySelector(".invasive-partner-form-status");
    var partnerButton = partnerForm.querySelector("button[type=submit]");
    var partnerSpecies = {};
    try { partnerSpecies = JSON.parse(partnerForm.getAttribute("data-species") || "{}"); } catch (_) { partnerSpecies = {}; }
    partnerForm.addEventListener("submit", function(event) {
      event.preventDefault();
      var fd = new FormData(partnerForm);
      var organization = String(fd.get("organization") || "").trim();
      var name = String(fd.get("name") || "").trim();
      var email = String(fd.get("email") || "").trim();
      var area = String(fd.get("area") || "").trim();
      var request = String(fd.get("request") || "").trim();
      var note = String(fd.get("note") || "").trim();
      var website = String(fd.get("website") || "").trim();
      var lines = [
        "外来種情報の受信連携相談",
        "",
        "対象種: " + [partnerSpecies.vernacularName, partnerSpecies.scientificName].filter(Boolean).join(" / "),
        "外来種区分: " + (partnerSpecies.invasiveStatus || ""),
        "団体名: " + organization,
        "担当者: " + name,
        "メール: " + email,
        "対象地域: " + area,
        "",
        "受け取りたい情報:",
        request,
        "",
        "補足:",
        note || "なし"
      ];
      partnerStatus.className = "invasive-partner-form-status";
      partnerStatus.textContent = "送信しています。";
      partnerButton.disabled = true;
      fetch(partnerForm.getAttribute("data-submit-path") || "/api/v1/contact/submit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "partnership",
          organization: organization,
          name: name,
          email: email,
          website: website,
          message: lines.join("\\n"),
          sourceUrl: location.href,
          userAgent: navigator.userAgent
        })
      }).then(function(response) {
        return response.json().catch(function(){ return {}; }).then(function(data) {
          if (!response.ok || !data.ok) throw new Error(data && data.error ? data.error : "send_failed");
          partnerStatus.className = "invasive-partner-form-status is-ok";
          partnerStatus.textContent = "送信しました。内容を確認して連絡します。";
          partnerForm.reset();
        });
      }).catch(function(error) {
        partnerStatus.className = "invasive-partner-form-status is-error";
        partnerStatus.textContent = "送信できませんでした。入力内容を確認して、時間をおいてもう一度お試しください。";
      }).finally(function() {
        partnerButton.disabled = false;
      });
    });
  }
})();
</script>`;
}

function renderListPage(basePath: string, lang: SiteLang): string {
  const species = listInvasiveSpecies();
  const groups = new Map<string, InvasiveSpeciesCatalogItem[]>();
  for (const item of species) {
    const existing = groups.get(item.groupLabel) ?? [];
    existing.push(item);
    groups.set(item.groupLabel, existing);
  }

  const groupHtml = Array.from(groups.entries()).map(([groupLabel, items]) => `<section class="invasive-group">
    <div class="invasive-group-head">
      <span>${escapeHtml(groupLabel)}</span>
      <strong>${escapeHtml(String(items.length))}件</strong>
    </div>
    <div class="invasive-grid">
      ${items.map((item) => `<a class="invasive-card" href="${escapeHtml(speciesHref(basePath, lang, item))}">
        <span>${escapeHtml(item.categoryLabel)}</span>
        <h2>${escapeHtml(item.vernacularName)}</h2>
        <i>${escapeHtml(item.scientificName)}</i>
        <p>${escapeHtml(item.actionLabel)}</p>
      </a>`).join("")}
    </div>
  </section>`).join("");

  return `<div class="invasive-page">
    ${renderCommonSafety()}
    <section class="invasive-summary">
      <strong class="invasive-total">全${escapeHtml(String(species.length))}件</strong>
      <p>この一覧は ikimon.life の外来種 seed を正本に、観察時の安全行動と公式情報への導線をまとめたものです。外来種かどうか、地域で何を求められるかは状況で変わるため、最終判断は公式情報と自治体・管理者の案内で確認してください。</p>
      ${renderOfficialSources()}
    </section>
    ${groupHtml}
  </div>`;
}

function renderDetailPage(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  const listHref = appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang);
  const sourceHref = item.sourceUrl || INVASIVE_SPECIES_OFFICIAL_SOURCES[0].href;
  return `<div class="invasive-page invasive-detail">
    <nav class="invasive-breadcrumb"><a href="${escapeHtml(listHref)}">外来種一覧へ戻る</a></nav>
    ${renderCommonSafety()}
    <section class="invasive-detail-card">
      <div class="invasive-detail-kicker">${escapeHtml(item.groupLabel)} / ${escapeHtml(item.categoryLabel)}</div>
      <h2>${escapeHtml(item.vernacularName)}</h2>
      <p class="invasive-scientific">${escapeHtml(item.scientificName)}</p>
      <div class="invasive-action-pill">${escapeHtml(item.actionLabel)}</div>
      <dl>
        <div><dt>記録時の注意</dt><dd>${escapeHtml(item.legalWarning || "触らず、運ばず、自治体や土地管理者に確認してください。")}</dd></div>
        <div><dt>なぜ注意するか</dt><dd>${escapeHtml(item.actionBasis)}</dd></div>
        <div><dt>地域差</dt><dd>${escapeHtml(item.regionalCaveat || "地域の分布や対応方針は自治体の案内で確認してください。")}</dd></div>
      </dl>
      <a class="invasive-source-link" href="${escapeHtml(sourceHref)}" target="_blank" rel="noreferrer">出典を開く</a>
    </section>
    ${renderActionSources(item)}
    ${renderReportingVisibility(basePath, item)}
    ${renderOfficialSources()}
    ${renderReportingVisibilityScript()}
  </div>`;
}

const INVASIVE_SPECIES_STYLES = `
  .invasive-page { display: grid; gap: 20px; }
  .invasive-breadcrumb a { color: #047857; font-size: 13px; font-weight: 850; text-decoration: none; }
  .invasive-safety,
  .invasive-summary,
  .invasive-detail-card,
  .invasive-group,
  .invasive-action-sources,
  .invasive-reporting-visibility { border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #fff; box-shadow: 0 18px 44px rgba(15,23,42,.055); }
  .invasive-safety { padding: clamp(18px, 4vw, 32px); background: linear-gradient(135deg, #fff7ed, #ffffff 58%, #ecfdf5); }
  .invasive-safety span,
  .invasive-detail-kicker,
  .invasive-group-head span,
  .invasive-card span,
  .invasive-total,
  .invasive-official-sources strong,
  .invasive-section-head span,
  .invasive-reporting-slot span { color: #047857; font-size: 12px; line-height: 1.35; font-weight: 950; }
  .invasive-safety h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(25px, 4vw, 42px); line-height: 1.16; letter-spacing: 0; }
  .invasive-safety p,
  .invasive-summary p { margin: 10px 0 0; color: #475569; font-size: 15px; line-height: 1.8; font-weight: 680; }
  .invasive-summary { padding: 18px; }
  .invasive-official-sources { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
  .invasive-official-sources a,
  .invasive-source-link,
  .invasive-action-pill { min-height: 38px; display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; font-size: 13px; font-weight: 900; text-decoration: none; }
  .invasive-official-sources a,
  .invasive-source-link { border: 1px solid rgba(16,185,129,.22); color: #047857; background: #f0fdf4; }
  .invasive-group { padding: 16px; }
  .invasive-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .invasive-group-head strong { color: #64748b; font-size: 12px; }
  .invasive-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .invasive-card { min-height: 160px; display: grid; align-content: start; gap: 7px; padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #f8fafc; color: inherit; text-decoration: none; }
  .invasive-card h2 { margin: 0; color: #10251a; font-size: 20px; line-height: 1.3; letter-spacing: 0; }
  .invasive-card i,
  .invasive-scientific { color: #64748b; font-size: 13px; font-style: italic; overflow-wrap: anywhere; }
  .invasive-card p { margin: 4px 0 0; color: #92400e; font-size: 13px; font-weight: 850; }
  .invasive-detail-card { display: grid; gap: 12px; padding: clamp(18px, 4vw, 32px); }
  .invasive-detail-card h2 { margin: 0; color: #10251a; font-size: clamp(30px, 5vw, 54px); line-height: 1.08; letter-spacing: 0; }
  .invasive-action-pill { width: fit-content; background: #fff7ed; color: #92400e; border: 1px solid rgba(217,119,6,.18); }
  .invasive-detail-card dl { display: grid; gap: 10px; margin: 6px 0 0; }
  .invasive-detail-card dl div { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: #f8fafc; }
  .invasive-detail-card dt { color: #10251a; font-size: 13px; font-weight: 950; }
  .invasive-detail-card dd { margin: 0; color: #475569; font-size: 14px; line-height: 1.75; font-weight: 680; }
  .invasive-action-sources,
  .invasive-reporting-visibility { display: grid; gap: 14px; padding: clamp(18px, 4vw, 28px); }
  .invasive-section-head h2 { margin: 4px 0 0; color: #10251a; font-size: clamp(22px, 3vw, 31px); line-height: 1.22; letter-spacing: 0; }
  .invasive-section-head p { margin: 8px 0 0; color: #475569; font-size: 14px; line-height: 1.75; font-weight: 680; }
  .invasive-action-source-grid,
  .invasive-reporting-board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .invasive-action-source,
  .invasive-reporting-slot { display: grid; align-content: start; gap: 10px; min-height: 154px; padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #f8fafc; }
  .invasive-action-source div { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .invasive-action-source strong,
  .invasive-reporting-slot strong,
  .invasive-partner-cta strong { color: #10251a; font-size: 15px; line-height: 1.45; font-weight: 950; }
  .invasive-action-source div span { flex-shrink: 0; padding: 3px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 950; }
  .invasive-action-source p,
  .invasive-reporting-slot p,
  .invasive-partner-cta p { margin: 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 680; }
  .invasive-reporting-slot.is-active { border-color: rgba(16,185,129,.24); background: #f0fdf4; }
  .invasive-reporting-slot.is-empty { border-style: dashed; background: #fff; }
  .invasive-region-check { display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(16,185,129,.22); border-radius: 8px; background: #f0fdf4; }
  .invasive-region-check strong { color: #10251a; font-size: 15px; line-height: 1.45; font-weight: 950; }
  .invasive-region-check p { margin: 4px 0 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 680; }
  .invasive-region-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; gap: 10px; align-items: end; }
  .invasive-region-form label { display: grid; gap: 5px; color: #047857; font-size: 12px; font-weight: 950; }
  .invasive-region-form input { width: 100%; min-height: 42px; border: 1px solid rgba(15,23,42,.14); border-radius: 8px; padding: 8px 10px; color: #10251a; background: #fff; font: inherit; font-size: 14px; }
  .invasive-region-form button { min-height: 42px; border: 0; border-radius: 8px; padding: 8px 14px; background: #10251a; color: #fff; font-size: 13px; font-weight: 950; cursor: pointer; }
  .invasive-region-result { padding: 12px; border-radius: 8px; background: rgba(255,255,255,.78); color: #475569; font-size: 13px; line-height: 1.7; font-weight: 680; }
  .invasive-region-result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-top: 8px; }
  .invasive-region-result article { display: grid; gap: 5px; padding: 10px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #fff; }
  .invasive-region-result article span { color: #047857; font-size: 11px; font-weight: 950; }
  .invasive-region-result article p { margin: 0; font-size: 12px; }
  .invasive-partner-cta { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.2fr); align-items: start; gap: 14px; padding: 14px; border-radius: 8px; background: #10251a; }
  .invasive-partner-cta strong { color: #fff; }
  .invasive-partner-cta p { margin-top: 4px; color: rgba(255,255,255,.78); }
  .invasive-partner-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.96); }
  .invasive-partner-form label { display: grid; gap: 5px; color: #10251a; font-size: 12px; font-weight: 950; }
  .invasive-partner-form label.is-wide,
  .invasive-partner-form-actions { grid-column: 1 / -1; }
  .invasive-partner-form input,
  .invasive-partner-form textarea { width: 100%; min-height: 40px; border: 1px solid rgba(15,23,42,.14); border-radius: 8px; padding: 8px 10px; color: #10251a; background: #fff; font: inherit; font-size: 13px; }
  .invasive-partner-form textarea { min-height: 82px; resize: vertical; }
  .invasive-partner-trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
  .invasive-partner-form-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  .invasive-partner-form button { min-height: 40px; border: 0; border-radius: 999px; padding: 8px 14px; background: #10251a; color: #fff; font-size: 13px; font-weight: 950; cursor: pointer; }
  .invasive-partner-form button:disabled { opacity: .56; cursor: wait; }
  .invasive-partner-form-status { color: #475569; font-size: 12px; line-height: 1.6; font-weight: 800; }
  .invasive-partner-form-status.is-ok { color: #047857; }
  .invasive-partner-form-status.is-error { color: #dc2626; }
  @media (max-width: 560px) {
    .invasive-grid { grid-template-columns: 1fr; }
    .invasive-action-source-grid,
    .invasive-reporting-board { grid-template-columns: 1fr; }
    .invasive-region-form { grid-template-columns: 1fr; }
    .invasive-partner-cta { grid-template-columns: 1fr; }
    .invasive-partner-form { grid-template-columns: 1fr; }
    .invasive-official-sources { align-items: stretch; }
    .invasive-official-sources a,
    .invasive-partner-cta .invasive-source-link { width: 100%; justify-content: center; }
  }
`;

function renderNotFound(basePath: string, lang: SiteLang, currentPath: string): string {
  return renderSiteDocument({
    basePath,
    lang,
    activeNav: "学ぶ",
    title: "外来種ページが見つかりません | ikimon",
    description: "指定された外来種ページは見つかりませんでした。",
    currentPath,
    canonicalPath: INVASIVE_SPECIES_LIST_PATH,
    noindex: true,
    extraStyles: INVASIVE_SPECIES_STYLES,
    body: `<div class="invasive-page"><section class="invasive-summary"><p>指定された外来種ページは見つかりませんでした。</p><a class="invasive-source-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang))}">外来種一覧を見る</a></section></div>`,
  });
}

export async function registerInvasiveSpeciesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: InvasiveReportingRecipientsQuery }>("/api/v1/invasive-reporting/recipients", async (request, reply) => {
    const query = request.query;
    reply.type("application/json; charset=utf-8");
    if (!query.invasiveStatus || (!query.scientificName && !query.vernacularName)) {
      reply.status(400);
      return {
        available: true,
        reason: "bad_request",
        matchedRules: 0,
        autoDeliveryCount: 0,
        contacts: [],
      };
    }
    try {
      const visibility = await listInvasiveReportingVisibility(getPool(), {
        invasiveStatus: query.invasiveStatus,
        scientificName: query.scientificName ?? null,
        vernacularName: query.vernacularName ?? null,
        prefecture: query.prefecture ?? null,
        municipality: query.municipality ?? null,
      });
      return visibility;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/DATABASE_URL is required/u.test(message)) {
        return {
          available: false,
          reason: "unavailable",
          matchedRules: 0,
          autoDeliveryCount: 0,
          contacts: [],
        };
      }
      throw error;
    }
  });

  app.get(INVASIVE_SPECIES_LIST_PATH, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "学ぶ",
      title: "外来種一覧 | ikimon",
      description: "外来種候補を見つけたときの安全行動と、公式情報への導線をまとめます。",
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
      canonicalPath: INVASIVE_SPECIES_LIST_PATH,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: "INVASIVE SPECIES",
        heading: "外来種を見つけたときの安全メモ",
        lead: "触らず、運ばず、捕獲せず、写真・場所・日時を残して公式情報と地域の案内を確認するための一覧です。",
        tone: "light",
        align: "center",
      },
      body: renderListPage(basePath, lang),
    });
  });

  app.get<{ Params: { slug: string } }>(`${INVASIVE_SPECIES_LIST_PATH}/:slug`, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const item = findInvasiveSpeciesBySlug(request.params.slug);
    const currentPath = requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } });
    reply.type("text/html; charset=utf-8");
    if (!item) {
      reply.status(404);
      return renderNotFound(basePath, lang, currentPath);
    }
    const canonicalPath = invasiveSpeciesDetailPath(item);
    return renderSiteDocument({
      basePath,
      lang,
      activeNav: "学ぶ",
      title: `${item.vernacularName} | 外来種メモ | ikimon`,
      description: `${item.vernacularName}を見つけたときの安全行動、法的注意、公式情報への導線をまとめます。`,
      currentPath,
      canonicalPath,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: item.categoryLabel,
        heading: item.vernacularName,
        lead: `${item.scientificName}。${item.actionLabel}を基本に、触らず、運ばず、自治体や管理者の案内を確認します。`,
        tone: "light",
        align: "center",
      },
      body: renderDetailPage(basePath, lang, item),
    });
  });
}
