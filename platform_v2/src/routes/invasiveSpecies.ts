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
  invasiveActionLabelEn,
  invasiveCategoryLabelEn,
  invasiveGroupLabelEn,
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

const tr = (lang: SiteLang, ja: string, en: string): string => (lang === "ja" ? ja : en);

function speciesHref(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  return appendLangToHref(withBasePath(basePath, invasiveSpeciesDetailPath(item)), lang);
}

function renderOfficialSources(lang: SiteLang): string {
  return `<div class="invasive-official-sources">
    <strong>${tr(lang, "公式情報", "Official information")}</strong>
    ${INVASIVE_SPECIES_OFFICIAL_SOURCES.map((source) =>
      `<a href="${escapeHtml(source.href)}" target="_blank" rel="noreferrer">${escapeHtml(tr(lang, source.label, source.labelEn))}</a>`,
    ).join("")}
  </div>`;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function renderCommonSafety(lang: SiteLang): string {
  if (lang !== "ja") {
    return `<section class="invasive-safety">
    <span>For people who found one</span>
    <h2>Do not touch it. Leave a photo and the location.</h2>
    <p>If you find a creature that might be an invasive species, do not get too close. Record a photo, the location and the date and time. Do not carry living animals, eggs, seeds or plant fragments, and follow the guidance of your municipality or the land manager for capture or removal.</p>
  </section>`;
  }
  return `<section class="invasive-safety">
    <span>見つけた人向け</span>
    <h2>触らず、写真と場所を残す。</h2>
    <p>外来種かもしれない生きものを見つけたら、近づきすぎず、写真・場所・日時を記録してください。生きもの、卵、種子、植物片は運ばず、捕獲や駆除は自治体や土地の管理者の案内に従ってください。</p>
  </section>`;
}

function renderActionSources(item: InvasiveSpeciesCatalogItem, lang: SiteLang): string {
  if (lang !== "ja") return renderActionSourcesEn(item, lang);
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
      source: "ZUKAN",
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

function renderActionSourcesEn(item: InvasiveSpeciesCatalogItem, lang: SiteLang): string {
  const actionSources = [
    { source: "National rules", action: legalWarningEn(item), status: invasiveCategoryLabelEn(item.category) },
    { source: "Local contacts", action: "Municipalities and land managers guide what to do and whom to ask, depending on local conditions.", status: "Municipality / manager" },
    { source: "ZUKAN", action: "Information reaches an organization only when a post becomes an invasive-species candidate and an organization matching the area has agreed to receive it. It is never sent to unrelated organizations.", status: "Conditional" },
  ];
  return `<section class="invasive-action-sources" aria-label="Who recommends the action">
    <div class="invasive-section-head">
      <span>Whom to follow</span>
      <h2>First check national rules and local guidance</h2>
      <p>For the same invasive species, what the law prohibits and what a region asks you to report can differ. If in doubt, do not touch or move it, and consult your municipality or the land manager.</p>
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
    <a class="invasive-source-link" href="#invasive-partner-form">Contact us as a municipality or organization</a>
  </section>`;
}

function legalWarningEn(item: InvasiveSpeciesCatalogItem): string {
  return item.category === "iaspecified"
    ? "Keeping, transporting, releasing and handing over are generally prohibited under the Invasive Alien Species Act. Do not handle it on your own judgment."
    : "Keeping or moving living individuals or plant fragments may be restricted. Do not carry them, and check the legal handling.";
}

function renderReportingVisibility(basePath: string, item: InvasiveSpeciesCatalogItem, lang: SiteLang): string {
  if (lang !== "ja") return renderReportingVisibilityEn(basePath, item, lang);
  const apiPath = withBasePath(basePath, "/api/v1/invasive-reporting/recipients");
  const submitEndpoint = withBasePath(basePath, "/api/v1/contact/submit");
  return `<section class="invasive-reporting-visibility" aria-label="自動通報連携団体">
    <div class="invasive-section-head">
      <span>投稿したあと</span>
      <h2>この投稿は、どこへ届く？</h2>
      <p>ZUKAN では、受け取りを許可している自治体・研究機関・管理団体がある地域だけ、外来種候補の投稿情報を自動で届けます。連携先がない地域では、自動送信はしません。</p>
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

function renderReportingVisibilityEn(basePath: string, item: InvasiveSpeciesCatalogItem, lang: SiteLang): string {
  const apiPath = withBasePath(basePath, "/api/v1/invasive-reporting/recipients");
  const submitEndpoint = withBasePath(basePath, "/api/v1/contact/submit");
  const speciesData = escapeHtml(scriptJson({
    scientificName: item.scientificName,
    vernacularName: item.vernacularName,
    invasiveStatus: item.category,
  }));
  return `<section class="invasive-reporting-visibility" aria-label="Organizations linked to automatic reporting">
    <div class="invasive-section-head">
      <span>After you post</span>
      <h2>Where does this post go?</h2>
      <p>ZUKAN automatically passes on posts about invasive-species candidates only in areas where a municipality, research institute or management organization has agreed to receive them. Where there is no linked organization, nothing is sent automatically.</p>
    </div>
    <div class="invasive-reporting-board">
      <article class="invasive-reporting-slot is-active">
        <span>This species</span>
        <strong>${escapeHtml(item.vernacularName)}</strong>
        <p>${escapeHtml(invasiveCategoryLabelEn(item.category))} / ${escapeHtml(invasiveActionLabelEn(item.recommendedAction))}</p>
      </article>
      <article class="invasive-reporting-slot">
        <span>Organizations that may receive it</span>
        <strong>Enter an area to check</strong>
        <p>Photos, location, date and time are shared only when an organization that has agreed to receive them matches the location of the post.</p>
      </article>
      <article class="invasive-reporting-slot is-empty">
        <span>If none apply</span>
        <strong>Nothing is sent automatically</strong>
        <p>Where there is no linked organization, nothing is sent, and we point you to the official contact where needed.</p>
      </article>
    </div>
    <div class="invasive-region-check" data-inv-reporting-check data-api-path="${escapeHtml(apiPath)}" data-species='${speciesData}'>
      <div>
        <strong>Check by post location</strong>
        <p>Enter the prefecture and city to see whether any organization receives automatic reports in this area.</p>
      </div>
      <form class="invasive-region-form">
        <label>Prefecture<input name="prefecture" autocomplete="address-level1" placeholder="e.g. Shizuoka"></label>
        <label>City<input name="municipality" autocomplete="address-level2" placeholder="e.g. Hamamatsu"></label>
        <button type="submit">Check</button>
      </form>
      <div class="invasive-region-result" aria-live="polite">Enter an area and any organization that receives reports automatically will be shown here.</div>
    </div>
    <div class="invasive-partner-cta" id="invasive-partner-form">
      <div>
        <strong>For municipalities, research institutes and management organizations</strong>
        <p>Send the target area, target species and the information you want to receive right here. After review, we will work out how to deliver it and when to stop.</p>
      </div>
      <form class="invasive-partner-form" data-inv-partner-form data-submit-path="${escapeHtml(submitEndpoint)}" data-species='${speciesData}'>
        <label>Organization<input name="organization" autocomplete="organization" required maxlength="200" placeholder="e.g. City Environmental Policy Division"></label>
        <label>Contact person<input name="name" autocomplete="name" maxlength="200" placeholder="e.g. Taro Yamada"></label>
        <label>Email address<input name="email" type="email" autocomplete="email" required maxlength="200" placeholder="example@example.jp"></label>
        <label>Target area<input name="area" required maxlength="300" placeholder="e.g. Hamamatsu, Shizuoka, or the name of a park you manage"></label>
        <label class="is-wide">Information you want to receive<textarea name="request" required minlength="5" maxlength="3000" placeholder="e.g. We want photos, locations and dates of nutria within the city."></textarea></label>
        <label class="is-wide">Notes<textarea name="note" maxlength="3000" placeholder="Official contact URL, target species, conditions for stopping, whether phone contact is fine, and so on"></textarea></label>
        <label class="invasive-partner-trap" aria-hidden="true">Website<input name="website" autocomplete="off" tabindex="-1"></label>
        <div class="invasive-partner-form-actions">
          <button type="submit">Send this inquiry</button>
          <span class="invasive-partner-form-status" aria-live="polite"></span>
        </div>
        <noscript><p class="invasive-partner-form-status is-error">JavaScript is required to send.</p></noscript>
      </form>
    </div>
  </section>`;
}

function renderReportingVisibilityScript(lang: SiteLang): string {
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
      if (enabled) return "${tr(lang, "自動共有あり", "Automatic sharing on")}";
      if (status === "external_only") return "${tr(lang, "公式フォーム案内", "Official form guidance")}";
      if (status === "pending") return "${tr(lang, "確認中", "Under review")}";
      if (status === "approved") return "${tr(lang, "条件不足", "Conditions not met")}";
      if (status === "denied" || status === "revoked") return "${tr(lang, "停止中", "Suspended")}";
      return "${tr(lang, "自動送信なし", "No automatic sending")}";
    }
    function render(data) {
      if (!data || data.available === false) {
        result.innerHTML = "${tr(lang, "<strong>連携情報を確認できません</strong><p>現在は公式窓口の案内だけを表示します。</p>", "<strong>Cannot check linked organizations</strong><p>Only official contact guidance is shown for now.</p>")}";
        return;
      }
      if (!data.contacts || data.contacts.length === 0) {
        var copy = data.reason === "location_required" ? "${tr(lang, "都道府県または市区町村を入力してください。", "Please enter a prefecture or city.")}" : "${tr(lang, "一致する連携先はまだ登録されていません。", "No matching linked organization is registered yet.")}";
        result.innerHTML = "<strong>${tr(lang, "この地域で自動送信される団体はまだありません", "No organization in this area receives reports automatically yet")}</strong><p>" + esc(copy) + " ${tr(lang, "自治体・研究機関・管理団体の方は、下の相談窓口から受信連携を相談できます。", "Municipalities, research institutes and management organizations can ask about receiving reports through the contact form below.")}</p>";
        return;
      }
      var cards = data.contacts.map(function(contact) {
        var label = statusLabel(contact.sendPermissionStatus, contact.autoDeliveryEnabled);
        var locality = contact.jurisdiction && contact.jurisdiction.localityLabel ? contact.jurisdiction.localityLabel : "";
        var fields = (contact.requiredFields || []).slice(0, 4).join(" / ");
        return '<article><span>' + esc(label) + '</span><strong>' + esc(contact.organizationName) + '</strong><p>' + esc([contact.departmentName, locality].filter(Boolean).join(" / ")) + '</p><p>' + esc(contact.userGuidanceJa || fields || "${tr(lang, "写真・場所・日時が判断材料になります。", "Photo, location, date and time are used to judge.")}") + '</p></article>';
      }).join("");
      result.innerHTML = '<strong>' + esc(String(data.autoDeliveryCount || 0)) + '${tr(lang, "件へ自動送信されます", " organization(s) will receive it automatically")}</strong><div class="invasive-region-result-grid">' + cards + '</div>';
    }
    form && form.addEventListener("submit", function(event) {
      event.preventDefault();
      var params = new URLSearchParams();
      Object.keys(species).forEach(function(key) { if (species[key]) params.set(key, species[key]); });
      var prefecture = String(new FormData(form).get("prefecture") || "").trim();
      var municipality = String(new FormData(form).get("municipality") || "").trim();
      if (prefecture) params.set("prefecture", prefecture);
      if (municipality) params.set("municipality", municipality);
      result.textContent = "${tr(lang, "確認しています。", "Checking.")}";
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
      partnerStatus.textContent = "${tr(lang, "送信しています。", "Sending.")}";
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
          partnerStatus.textContent = "${tr(lang, "送信しました。内容を確認して連絡します。", "Sent. We will review it and get back to you.")}";
          partnerForm.reset();
        });
      }).catch(function(error) {
        partnerStatus.className = "invasive-partner-form-status is-error";
        partnerStatus.textContent = "${tr(lang, "送信できませんでした。入力内容を確認して、時間をおいてもう一度お試しください。", "Could not send. Please check your entries and try again later.")}";
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
      <span>${escapeHtml(lang === "ja" ? groupLabel : invasiveGroupLabelEn(groupLabel))}</span>
      <strong>${escapeHtml(tr(lang, `${items.length}件`, String(items.length)))}</strong>
    </div>
    <div class="invasive-grid">
      ${items.map((item) => `<a class="invasive-card" href="${escapeHtml(speciesHref(basePath, lang, item))}">
        <span>${escapeHtml(lang === "ja" ? item.categoryLabel : invasiveCategoryLabelEn(item.category))}</span>
        <h2>${escapeHtml(item.vernacularName)}</h2>
        <i>${escapeHtml(item.scientificName)}</i>
        <p>${escapeHtml(lang === "ja" ? item.actionLabel : invasiveActionLabelEn(item.recommendedAction))}</p>
      </a>`).join("")}
    </div>
  </section>`).join("");

  return `<div class="invasive-page">
    ${renderCommonSafety(lang)}
    <section class="invasive-summary">
      <strong class="invasive-total">${escapeHtml(tr(lang, `全${species.length}件`, `${species.length} species in total`))}</strong>
      <p>${tr(lang, "この一覧は ZUKAN の外来種 seed を正本に、観察時の安全行動と公式情報への導線をまとめたものです。外来種かどうか、地域で何を求められるかは状況で変わるため、最終判断は公式情報と自治体・管理者の案内で確認してください。", "This list is based on the ZUKAN invasive-species master and gathers safe behavior when observing and links to official information. Whether something counts as invasive, and what is expected locally, depends on the situation, so confirm the final decision with official information and the guidance of your municipality or manager.")}</p>
      ${renderOfficialSources(lang)}
    </section>
    ${groupHtml}
  </div>`;
}

function renderDetailPage(basePath: string, lang: SiteLang, item: InvasiveSpeciesCatalogItem): string {
  const listHref = appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang);
  const sourceHref = item.sourceUrl || INVASIVE_SPECIES_OFFICIAL_SOURCES[0].href;
  return `<div class="invasive-page invasive-detail">
    <nav class="invasive-breadcrumb"><a href="${escapeHtml(listHref)}">${tr(lang, "外来種一覧へ戻る", "Back to the invasive species list")}</a></nav>
    ${renderCommonSafety(lang)}
    <section class="invasive-detail-card" id="identify">
      <div class="invasive-detail-kicker">${escapeHtml(lang === "ja" ? item.groupLabel : invasiveGroupLabelEn(item.groupLabel))} / ${escapeHtml(lang === "ja" ? item.categoryLabel : invasiveCategoryLabelEn(item.category))}</div>
      <h2>${escapeHtml(item.vernacularName)}</h2>
      <p class="invasive-scientific">${escapeHtml(item.scientificName)}</p>
      <div class="invasive-action-pill">${escapeHtml(lang === "ja" ? item.actionLabel : invasiveActionLabelEn(item.recommendedAction))}</div>
      <dl>
        <div><dt>${tr(lang, "記録時の注意", "Care when recording")}</dt><dd>${escapeHtml(lang === "ja" ? (item.legalWarning || "触らず、運ばず、自治体や土地管理者に確認してください。") : legalWarningEn(item))}</dd></div>
        <div><dt>${tr(lang, "なぜ注意するか", "Why be careful")}</dt><dd>${escapeHtml(lang === "ja" ? item.actionBasis : `Classified as: ${invasiveCategoryLabelEn(item.category)}. Recommended action: ${invasiveActionLabelEn(item.recommendedAction)}.`)}</dd></div>
        <div><dt>${tr(lang, "地域差", "Regional differences")}</dt><dd>${escapeHtml(lang === "ja" ? (item.regionalCaveat || "地域の分布や対応方針は自治体の案内で確認してください。") : "Distribution and response policy differ by region. Check the guidance of your municipality.")}</dd></div>
      </dl>
      <a class="invasive-source-link" href="${escapeHtml(sourceHref)}" target="_blank" rel="noreferrer">${tr(lang, "出典を開く", "Open the source")}</a>
    </section>
    ${renderActionSources(item, lang)}
    ${renderReportingVisibility(basePath, item, lang)}
    ${renderOfficialSources(lang)}
    ${renderReportingVisibilityScript(lang)}
  </div>`;
}

const INVASIVE_SPECIES_STYLES = `
  .invasive-page { display: grid; gap: 20px; }
  .invasive-breadcrumb a { color: #047857; font-size: 14px; font-weight: 850; text-decoration: none; }
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
  .invasive-reporting-slot span { color: #047857; font-size: 14px; line-height: 1.35; font-weight: 950; }
  .invasive-safety h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(25px, 4vw, 42px); line-height: 1.16; letter-spacing: 0; }
  .invasive-safety p,
  .invasive-summary p { margin: 10px 0 0; color: #475569; font-size: 15px; line-height: 1.8; font-weight: 680; }
  .invasive-summary { padding: 18px; }
  .invasive-official-sources { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
  .invasive-official-sources a,
  .invasive-source-link,
  .invasive-action-pill { min-height: 38px; display: inline-flex; align-items: center; padding: 8px 12px; border-radius: 999px; font-size: 14px; font-weight: 900; text-decoration: none; }
  .invasive-official-sources a,
  .invasive-source-link { border: 1px solid rgba(16,185,129,.22); color: #047857; background: #f0fdf4; }
  .invasive-group { padding: 16px; }
  .invasive-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .invasive-group-head strong { color: #64748b; font-size: 14px; }
  .invasive-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .invasive-card { min-height: 160px; display: grid; align-content: start; gap: 7px; padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #f8fafc; color: inherit; text-decoration: none; }
  .invasive-card h2 { margin: 0; color: #10251a; font-size: 20px; line-height: 1.3; letter-spacing: 0; }
  .invasive-card i,
  .invasive-scientific { color: #64748b; font-size: 14px; font-style: italic; overflow-wrap: anywhere; }
  .invasive-card p { margin: 4px 0 0; color: #92400e; font-size: 14px; font-weight: 850; }
  .invasive-detail-card { display: grid; gap: 12px; padding: clamp(18px, 4vw, 32px); }
  .invasive-detail-card h2 { margin: 0; color: #10251a; font-size: clamp(30px, 5vw, 54px); line-height: 1.08; letter-spacing: 0; }
  .invasive-action-pill { width: fit-content; background: #fff7ed; color: #92400e; border: 1px solid rgba(217,119,6,.18); }
  .invasive-detail-card dl { display: grid; gap: 10px; margin: 6px 0 0; }
  .invasive-detail-card dl div { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: #f8fafc; }
  .invasive-detail-card dt { color: #10251a; font-size: 14px; font-weight: 950; }
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
  .invasive-action-source div span { flex-shrink: 0; padding: 3px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 14px; font-weight: 950; }
  .invasive-action-source p,
  .invasive-reporting-slot p,
  .invasive-partner-cta p { margin: 0; color: #475569; font-size: 14px; line-height: 1.7; font-weight: 680; }
  .invasive-reporting-slot.is-active { border-color: rgba(16,185,129,.24); background: #f0fdf4; }
  .invasive-reporting-slot.is-empty { border-style: dashed; background: #fff; }
  .invasive-region-check { display: grid; gap: 12px; padding: 14px; border: 1px solid rgba(16,185,129,.22); border-radius: 8px; background: #f0fdf4; }
  .invasive-region-check strong { color: #10251a; font-size: 15px; line-height: 1.45; font-weight: 950; }
  .invasive-region-check p { margin: 4px 0 0; color: #475569; font-size: 14px; line-height: 1.7; font-weight: 680; }
  .invasive-region-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; gap: 10px; align-items: end; }
  .invasive-region-form label { display: grid; gap: 5px; color: #047857; font-size: 14px; font-weight: 950; }
  .invasive-region-form input { width: 100%; min-height: 42px; border: 1px solid rgba(15,23,42,.14); border-radius: 8px; padding: 8px 10px; color: #10251a; background: #fff; font: inherit; font-size: 14px; }
  .invasive-region-form button { min-height: 42px; border: 0; border-radius: 8px; padding: 8px 14px; background: #10251a; color: #fff; font-size: 14px; font-weight: 950; cursor: pointer; }
  .invasive-region-result { padding: 12px; border-radius: 8px; background: rgba(255,255,255,.78); color: #475569; font-size: 14px; line-height: 1.7; font-weight: 680; }
  .invasive-region-result-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; margin-top: 8px; }
  .invasive-region-result article { display: grid; gap: 5px; padding: 10px; border: 1px solid rgba(15,23,42,.08); border-radius: 8px; background: #fff; }
  .invasive-region-result article span { color: #047857; font-size: 14px; font-weight: 950; }
  .invasive-region-result article p { margin: 0; font-size: 14px; }
  .invasive-partner-cta { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(0, 1.2fr); align-items: start; gap: 14px; padding: 14px; border-radius: 8px; background: #10251a; }
  .invasive-partner-cta strong { color: #fff; }
  .invasive-partner-cta p { margin-top: 4px; color: rgba(255,255,255,.78); }
  .invasive-partner-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.96); }
  .invasive-partner-form label { display: grid; gap: 5px; color: #10251a; font-size: 14px; font-weight: 950; }
  .invasive-partner-form label.is-wide,
  .invasive-partner-form-actions { grid-column: 1 / -1; }
  .invasive-partner-form input,
  .invasive-partner-form textarea { width: 100%; min-height: 40px; border: 1px solid rgba(15,23,42,.14); border-radius: 8px; padding: 8px 10px; color: #10251a; background: #fff; font: inherit; font-size: 14px; }
  .invasive-partner-form textarea { min-height: 82px; resize: vertical; }
  .invasive-partner-trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
  .invasive-partner-form-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  .invasive-partner-form button { min-height: 40px; border: 0; border-radius: 999px; padding: 8px 14px; background: #10251a; color: #fff; font-size: 14px; font-weight: 950; cursor: pointer; }
  .invasive-partner-form button:disabled { opacity: .56; cursor: wait; }
  .invasive-partner-form-status { color: #475569; font-size: 14px; line-height: 1.6; font-weight: 800; }
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
    title: tr(lang, "外来種ページが見つかりません | ZUKAN", "Invasive species page not found | ZUKAN"),
    description: tr(lang, "指定された外来種ページは見つかりませんでした。", "The invasive species page you asked for was not found."),
    currentPath,
    canonicalPath: INVASIVE_SPECIES_LIST_PATH,
    noindex: true,
    extraStyles: INVASIVE_SPECIES_STYLES,
    body: `<div class="invasive-page"><section class="invasive-summary"><p>${tr(lang, "指定された外来種ページは見つかりませんでした。", "The invasive species page you asked for was not found.")}</p><a class="invasive-source-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, INVASIVE_SPECIES_LIST_PATH), lang))}">${tr(lang, "外来種一覧を見る", "View the invasive species list")}</a></section></div>`,
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
    title: tr(lang, "外来種一覧 | ZUKAN", "Invasive species list | ZUKAN"),
      description: tr(lang, "外来種候補を見つけたときの安全行動と、公式情報への導線をまとめます。", "Safe behavior when you find a possible invasive species, with links to official information."),
      currentPath: requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
      canonicalPath: INVASIVE_SPECIES_LIST_PATH,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: "INVASIVE SPECIES",
        heading: tr(lang, "外来種を見つけたときの安全メモ", "Safety notes for finding an invasive species"),
        lead: tr(lang, "触らず、運ばず、捕獲せず、写真・場所・日時を残して公式情報と地域の案内を確認するための一覧です。", "A list for when you find one: do not touch, carry or capture it, leave a photo, location and time, and check official information and local guidance."),
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
    title: tr(lang, `${item.vernacularName} | 外来種メモ | ZUKAN`, `${item.vernacularName} | Invasive species note | ZUKAN`),
      description: tr(lang, `${item.vernacularName}を見つけたときの安全行動、法的注意、公式情報への導線をまとめます。`, `Safe behavior, legal cautions and links to official information for when you find ${item.vernacularName}.`),
      currentPath,
      canonicalPath,
      alternateLangs: ["ja"],
      extraStyles: INVASIVE_SPECIES_STYLES,
      hero: {
        eyebrow: lang === "ja" ? item.categoryLabel : invasiveCategoryLabelEn(item.category),
        heading: item.vernacularName,
        lead: lang === "ja" ? `${item.scientificName}。${item.actionLabel}を基本に、触らず、運ばず、自治体や管理者の案内を確認します。` : `${item.scientificName}. Basic action: ${invasiveActionLabelEn(item.recommendedAction)}. Do not touch or carry it, and check the guidance of your municipality or manager.`,
        tone: "light",
        align: "center",
      },
      body: renderDetailPage(basePath, lang, item),
    });
  });
}
