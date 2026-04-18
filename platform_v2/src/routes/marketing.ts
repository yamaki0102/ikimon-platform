import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function layout(
  basePath: string,
  lang: SiteLang,
  currentPath: string,
  title: string,
  eyebrow: string,
  heading: string,
  lead: string,
  body: string,
  activeNavKey: string,
  afterActionsHtml?: string,
  headingHtml?: string,
): string {
  const activeNav = activeNavLabel(activeNavKey, lang);
  const copy = layoutCopy(lang);
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    lang,
    currentPath,
    hero: {
      eyebrow,
      heading,
      headingHtml: headingHtml ?? escapeHtml(heading),
      lead,
      tone: "light",
      align: "center",
      afterActionsHtml: afterActionsHtml ?? "",
    },
    body,
    footerNote: copy.footerNote,
  });
}

function layoutCopy(lang: SiteLang): { record: string; explore: string; business: string; footerNote: string } {
  switch (lang) {
    case "en":
      return {
        record: "Record",
        explore: "Explore",
        business: "For Business",
        footerNote: "Save what you find nearby and review it later, place by place.",
      };
    case "es":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizaciones",
        footerNote: "Guarda lo que encuentras cerca y revísalo después, lugar por lugar.",
      };
    case "pt-BR":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizações",
        footerNote: "Guarde o que encontra por perto e reveja depois, lugar por lugar.",
      };
    default:
      return {
        record: "記録する",
        explore: "みつける",
        business: "法人向け",
        footerNote: "いつもの道で見つけた自然を、あとで見返せる形に残す。",
      };
  }
}

function activeNavLabel(nav: string, lang: SiteLang): string {
  const table: Record<string, Record<SiteLang, string>> = {
    Home: { ja: "ホーム", en: "Home", es: "Inicio", "pt-BR": "Início" },
    Learn: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    "For Business": { ja: "法人向け", en: "For Business", es: "Para organizaciones", "pt-BR": "Para organizações" },
    FAQ: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    Trust: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    Contact: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
  };
  return table[nav]?.[lang] ?? nav;
}

const FL_CSS = `<style>
  .fl { max-width: 760px; margin: 0 auto; padding: 0 4px; }
  .fl-sec { padding: 56px 0; border-bottom: 1px solid rgba(15,23,42,.08); }
  .fl-sec:last-child { border-bottom: none; }
  .fl-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #16a34a; margin-bottom: 12px; }
  .fl-h2 { font-size: clamp(24px, 3vw, 36px); font-weight: 800; line-height: 1.25; letter-spacing: -.03em; color: #0f172a; margin: 0 0 20px; }
  .fl-lead { font-size: 17px; line-height: 1.85; color: #374151; margin: 0 0 32px; }
  .fl-body { font-size: 15px; line-height: 1.9; color: #4b5563; margin: 0 0 20px; }
  .fl-body:last-child { margin-bottom: 0; }
  .fl-cycle { display: flex; align-items: stretch; gap: 0; margin: 32px 0; }
  .fl-cycle-step { flex: 1; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); padding: 20px 16px; text-align: center; font-size: 13px; font-weight: 700; line-height: 1.55; color: #1f2937; position: relative; }
  .fl-cycle-step:first-child { border-radius: 16px 0 0 16px; }
  .fl-cycle-step:last-child { border-radius: 0 16px 16px 0; }
  .fl-cycle-step + .fl-cycle-step { border-left: none; }
  .fl-cycle-step::after { content: "→"; position: absolute; right: -12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #16a34a; font-weight: 900; z-index: 1; }
  .fl-cycle-step:last-child::after { content: ""; }
  .fl-cycle-num { display: block; font-size: 11px; font-weight: 800; color: #16a34a; letter-spacing: .06em; margin-bottom: 8px; }
  .fl-trust { background: #0f172a; color: rgba(255,255,255,.88); border-radius: 16px; padding: 22px 28px; margin: 28px 0; font-size: 15px; line-height: 1.75; }
  .fl-trust strong { color: #bbf7d0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; display: block; margin-bottom: 8px; }
  .fl-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
  .fl-chip { display: inline-flex; align-items: center; padding: 9px 15px; border-radius: 999px; background: rgba(15,23,42,.05); border: 1px solid rgba(15,23,42,.08); font-size: 12.5px; font-weight: 700; color: #374151; line-height: 1.4; }
  .fl-reasons { display: grid; gap: 28px; margin: 32px 0; }
  .fl-reason { display: grid; grid-template-columns: 48px 1fr; gap: 20px; align-items: start; }
  .fl-reason-num { font-size: 28px; font-weight: 900; color: #10b981; line-height: 1; padding-top: 2px; }
  .fl-reason-body h3 { font-size: 16px; font-weight: 800; color: #111827; margin: 0 0 8px; line-height: 1.4; }
  .fl-reason-body p { font-size: 14.5px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-steps { display: grid; gap: 0; margin: 32px 0; }
  .fl-step { display: grid; grid-template-columns: 56px 1fr; gap: 0; position: relative; }
  .fl-step-num { display: flex; flex-direction: column; align-items: center; }
  .fl-step-num-badge { width: 36px; height: 36px; border-radius: 50%; background: #f0fdf4; border: 2px solid #16a34a; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #16a34a; flex-shrink: 0; }
  .fl-step-num-line { flex: 1; width: 2px; background: linear-gradient(180deg, #bbf7d0 0%, #f0fdf4 100%); margin-top: 4px; }
  .fl-step:last-child .fl-step-num-line { display: none; }
  .fl-step-content { padding: 0 0 32px 20px; }
  .fl-step:last-child .fl-step-content { padding-bottom: 0; }
  .fl-step-content h3 { font-size: 15px; font-weight: 800; color: #111827; margin: 5px 0 6px; line-height: 1.4; }
  .fl-step-content p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-step-badge-text { font-size: 10px; font-weight: 800; color: #16a34a; line-height: 1.1; text-align: center; padding: 0 2px; }
  .fl-tiers { display: grid; gap: 14px; margin: 28px 0; }
  .fl-tier { border-radius: 16px; padding: 22px 24px; display: grid; grid-template-columns: 130px 1fr 1fr; gap: 16px; align-items: start; border: 1px solid rgba(15,23,42,.08); }
  .fl-tier-1 { background: #f8fafc; }
  .fl-tier-2 { background: #f0fdf4; border-color: rgba(22,163,74,.12); }
  .fl-tier-3 { background: #ecfdf5; border-color: rgba(22,163,74,.2); }
  .fl-tier-4 { background: #dcfce7; border-color: rgba(22,163,74,.3); }
  .fl-tier-name { font-size: 14px; font-weight: 800; color: #111827; line-height: 1.45; }
  .fl-tier-meaning { font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 4px; }
  .fl-tier-col-label { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
  .fl-tier-col-body { font-size: 13px; line-height: 1.75; color: #374151; }
  .fl-tier-col-no { font-size: 13px; line-height: 1.75; color: #9ca3af; }
  .fl-callout { border-radius: 16px; padding: 22px 24px; background: linear-gradient(135deg, #f7fee7 0%, #ecfccb 100%); border: 1px solid rgba(101,163,13,.2); margin: 24px 0; }
  .fl-callout strong { display: block; font-size: 13px; font-weight: 800; color: #3f6212; letter-spacing: .02em; margin-bottom: 8px; }
  .fl-callout p { font-size: 14px; line-height: 1.85; color: #3f6212; margin: 0; }
  .fl-info { border-radius: 16px; padding: 22px 24px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); margin: 24px 0; }
  .fl-info strong { display: block; font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
  .fl-info p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-roles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 28px 0; }
  .fl-role { border-radius: 16px; padding: 24px; background: #fafafa; border: 1px solid rgba(15,23,42,.07); }
  .fl-role-icon { font-size: 24px; display: block; margin-bottom: 14px; }
  .fl-role h3 { font-size: 16px; font-weight: 800; color: #111827; margin: 0 0 6px; }
  .fl-role p { font-size: 13.5px; line-height: 1.8; color: #6b7280; margin: 0 0 14px; }
  .fl-role-tag { display: inline-block; font-size: 12px; font-weight: 700; color: #166534; background: #dcfce7; border-radius: 8px; padding: 5px 10px; line-height: 1.4; }
  .fl-benefits { list-style: none; margin: 20px 0; padding: 0; display: grid; gap: 10px; }
  .fl-benefits li { display: flex; align-items: baseline; gap: 10px; font-size: 15px; line-height: 1.8; color: #374151; }
  .fl-benefits li::before { content: "✓"; font-weight: 900; color: #16a34a; flex-shrink: 0; }
  .fl-faq { display: grid; gap: 12px; margin: 28px 0; }
  .fl-faq-item { border-radius: 14px; background: #f9fafb; border: 1px solid rgba(15,23,42,.07); }
  .fl-faq-q { font-size: 15px; font-weight: 800; color: #111827; margin: 0; line-height: 1.5; }
  .fl-faq-a { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  details.fl-faq-item summary.fl-faq-q { padding: 20px 24px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  details.fl-faq-item summary.fl-faq-q::-webkit-details-marker { display: none; }
  details.fl-faq-item summary.fl-faq-q::after { content: "+"; font-size: 20px; font-weight: 400; color: #9ca3af; flex-shrink: 0; }
  details.fl-faq-item[open] summary.fl-faq-q::after { content: "−"; }
  details.fl-faq-item .fl-faq-a { padding: 0 24px 20px; border-top: 1px solid rgba(15,23,42,.06); padding-top: 14px; }
  .fl-refs { margin: 24px 0 0; padding: 24px; background: #f9fafb; border-radius: 14px; }
  .fl-refs-label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 14px; }
  .fl-refs ol { margin: 0; padding: 0 0 0 18px; display: grid; gap: 10px; }
  .fl-refs li { font-size: 13px; line-height: 1.8; color: #6b7280; }
  .fl-refs em { font-style: italic; }
  .fl-cta-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 20px; }
  .fl-premise { font-size: 12.5px; line-height: 1.9; color: #94a3b8; border-top: 1px solid rgba(15,23,42,.06); padding-top: 20px; margin-top: 4px; }
  .fl-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 28px 0; }
  .fl-card { border-radius: 16px; padding: 24px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .fl-card h3 { font-size: 15px; font-weight: 800; color: #111827; margin: 0 0 10px; line-height: 1.4; }
  .fl-card p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-divider { border: none; border-top: 1px solid rgba(15,23,42,.08); margin: 32px 0; }
  @media (max-width: 640px) {
    .fl-sec { padding: 40px 0; }
    .fl-cycle { flex-direction: column; }
    .fl-cycle-step { border-radius: 0 !important; border-left: 1px solid rgba(15,23,42,.08) !important; }
    .fl-cycle-step:first-child { border-radius: 16px 16px 0 0 !important; }
    .fl-cycle-step:last-child { border-radius: 0 0 16px 16px !important; }
    .fl-cycle-step::after { content: "↓"; right: auto; left: 50%; bottom: -12px; top: auto; transform: translateX(-50%); }
    .fl-tier { grid-template-columns: 1fr; gap: 12px; }
    .fl-roles, .fl-2col { grid-template-columns: 1fr; }
  }
  @media (max-width: 860px) {
    .fl-tier { grid-template-columns: 140px 1fr; }
    .fl-tier > *:last-child { grid-column: 1 / -1; }
  }
</style>`;

// Break Krug AI-slop 3-col feature grid by making the first card featured
// (double-width, accent left border, larger heading) and the rest plain.
// Also drops the repeated "ikimon" eyebrow that all cards used to share.
function cards(items: Array<{ title: string; body: string; href?: string; label?: string; eyebrow?: string }>): string {
  const featured = items[0];
  if (!featured) return "";
  const rest = items.slice(1);
  const featuredHtml = `<div class="card has-accent mkt-featured">
    ${featured.eyebrow ? `<div class="eyebrow">${escapeHtml(featured.eyebrow)}</div>` : ""}
    <h2 class="mkt-featured-title">${escapeHtml(featured.title)}</h2>
    <p>${escapeHtml(featured.body)}</p>
    ${featured.href ? `<div class="actions" style="margin-top:14px"><a class="btn btn-solid" href="${escapeHtml(featured.href)}">${escapeHtml(featured.label ?? "Open")}</a></div>` : ""}
  </div>`;
  const restHtml = rest
    .map(
      (item) => `<div class="card is-soft">
        ${item.eyebrow ? `<div class="eyebrow">${escapeHtml(item.eyebrow)}</div>` : ""}
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        ${item.href ? `<div class="actions" style="margin-top:10px"><a class="inline-link" href="${escapeHtml(item.href)}">${escapeHtml(item.label ?? "Open")}</a></div>` : ""}
      </div>`,
    )
    .join("");
  return `<section class="section mkt-cards">
    <style>
      .mkt-cards .card { flex: 1 1 260px; }
      .mkt-cards .mkt-featured { flex: 1 1 100%; padding: 28px 32px; background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%); border-left: 4px solid #10b981; }
      .mkt-cards .mkt-featured-title { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.3; letter-spacing: -.02em; margin-top: 10px; }
      .mkt-cards .card h3 { margin: 6px 0 8px; font-size: 16px; font-weight: 800; letter-spacing: -.01em; color: #0f172a; }
      .mkt-cards .grid { gap: 14px; }
    </style>
    ${featuredHtml}
    <div class="grid" style="margin-top:14px">${restHtml}</div>
  </section>`;
}

function rows(items: Array<{ title: string; body: string; actionHref?: string; actionLabel?: string }>): string {
  return `<section class="section"><div class="list">${items
    .map(
      (item) => `<div class="row">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="meta">${escapeHtml(item.body)}</div>
        </div>
        ${item.actionHref ? `<a class="btn btn-ghost" href="${escapeHtml(item.actionHref)}">${escapeHtml(item.actionLabel ?? "Open")}</a>` : ""}
      </div>`,
    )
    .join("")}</div></section>`;
}

function renderContactForm(_basePath: string): string {
  // 認証不要フォーム。POST /api/v1/contact/submit に JSON 送信。
  // JS 無効環境では送信できない旨を noscript で案内。
  const categories = [
    { value: "question",    label: "❓ 質問" },
    { value: "bug",         label: "🐛 バグ報告" },
    { value: "improvement", label: "💡 要望・提案" },
    { value: "partnership", label: "🤝 導入・連携" },
    { value: "media",       label: "📰 取材・メディア" },
    { value: "deletion",    label: "🗑️ データ削除" },
    { value: "other",       label: "💬 その他" },
  ];
  const optionsHtml = categories
    .map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`)
    .join("");

  return `<section class="section">
<style>
  .cf-form { display: grid; gap: 14px; max-width: 640px; margin: 0 auto 32px; padding: 24px; border-radius: 16px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); }
  .cf-form label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #111827; }
  .cf-form input, .cf-form select, .cf-form textarea { padding: 10px 12px; border: 1px solid rgba(15,23,42,.15); border-radius: 10px; font-size: 14px; background: #fff; font-family: inherit; }
  .cf-form textarea { min-height: 140px; resize: vertical; }
  .cf-form .cf-required::after { content: " *"; color: #dc2626; }
  .cf-form .cf-hint { font-size: 12px; color: #6b7280; font-weight: 400; }
  .cf-form .cf-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .cf-form button[type=submit] { padding: 12px 22px; border-radius: 999px; border: none; background: #111827; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; }
  .cf-form button[type=submit]:disabled { opacity: .5; cursor: not-allowed; }
  .cf-form .cf-status { font-size: 13px; color: #4b5563; }
  .cf-form .cf-status.cf-err { color: #dc2626; font-weight: 700; }
  .cf-form .cf-status.cf-ok { color: #16a34a; font-weight: 700; }
</style>
<form class="cf-form" id="cf-form" onsubmit="return false;">
  <label><span class="cf-required">カテゴリ</span>
    <select name="category" required>${optionsHtml}</select>
  </label>
  <label><span class="cf-required">内容</span>
    <textarea name="message" required minlength="5" maxlength="8000" placeholder="ご質問・ご要望・ご報告の内容を記入してください。"></textarea>
    <span class="cf-hint">最低 5 文字・最大 8000 文字</span>
  </label>
  <label>お名前
    <input name="name" type="text" maxlength="200" placeholder="任意" />
  </label>
  <label>組織名
    <input name="organization" type="text" maxlength="200" placeholder="任意" />
  </label>
  <label>メールアドレス
    <input name="email" type="email" maxlength="200" placeholder="返信を希望する場合は入力してください" />
    <span class="cf-hint">入力すると受付自動返信が届きます（任意）</span>
  </label>
  <div class="cf-actions">
    <button type="submit" id="cf-submit">送信する</button>
    <span class="cf-status" id="cf-status"></span>
  </div>
  <noscript><p class="cf-status cf-err">JavaScript を有効にして送信してください。無効の場合は contact@ikimon.life へ直接メールでご連絡をお願いします。</p></noscript>
</form>
<script>
(function(){
  var form = document.getElementById('cf-form');
  if (!form) return;
  var btn = document.getElementById('cf-submit');
  var status = document.getElementById('cf-status');
  form.addEventListener('submit', async function(ev){
    ev.preventDefault();
    btn.disabled = true;
    status.className = 'cf-status';
    status.textContent = '送信中…';
    var fd = new FormData(form);
    var payload = {
      category: fd.get('category') || 'question',
      message: fd.get('message') || '',
      name: fd.get('name') || '',
      organization: fd.get('organization') || '',
      email: fd.get('email') || '',
      sourceUrl: location.href,
      userAgent: navigator.userAgent
    };
    try {
      var res = await fetch('/api/v1/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function(){ return {}; });
      if (res.ok && data && data.ok) {
        status.className = 'cf-status cf-ok';
        status.textContent = '送信しました。受付番号: ' + (data.submissionId || '').slice(0, 8) + '…';
        form.reset();
      } else {
        status.className = 'cf-status cf-err';
        var msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
        status.textContent = '送信できませんでした: ' + msg;
      }
    } catch(e) {
      status.className = 'cf-status cf-err';
      status.textContent = '送信できませんでした（ネットワークエラー）';
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>
</section>`;
}

export async function registerMarketingRoutes(app: FastifyInstance): Promise<void> {
  const redirectMap = new Map<string, string>([
    ["/index.php", "/"],
    ["/guides.php", "/learn/identification-basics"],
    ["/guidelines.php", "/learn/methodology"],
    ["/updates.php", "/learn/updates"],
    ["/methodology.php", "/learn/methodology"],
    ["/about.php", "/about"],
    ["/faq.php", "/faq"],
    ["/privacy.php", "/privacy"],
    ["/terms.php", "/terms"],
    ["/contact.php", "/contact"],
    ["/for-business.php", "/for-business"],
    ["/pricing.php", "/for-business/pricing"],
    ["/for-business/index.php", "/for-business"],
    ["/for-business/pricing.php", "/for-business/pricing"],
    ["/for-business/demo.php", "/for-business/demo"],
    ["/for-business/status.php", "/for-business/status"],
    ["/for-business/apply.php", "/for-business/apply"],
    ["/for-business/create.php", "/for-business/apply"],
    ["/id_workbench.php", "/specialist/id-workbench"],
    ["/id_center.php", "/specialist/id-workbench"],
    ["/needs_id.php", "/specialist/id-workbench"],
    ["/review_queue.php", "/specialist/review-queue"],
  ]);

  for (const [legacyPath, targetPath] of redirectMap) {
    app.get(legacyPath, async (request, reply) => {
      const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      return reply.redirect(appendLangToHref(withBasePath(basePath, targetPath), lang), 308);
    });
  }

  app.get("/about", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimonについて — 近くの自然との関係を深める | ikimon" : "About | ikimon",
      lang === "ja" ? "ikimonについて" : "About",
      "近くの自然との関係を、少しずつ深めていく。",
      "ikimon は、地元の人がいつもの場所を記録し、読み返し、また行きたくなる理由を育てるためのプラットフォームです。",
      cards([
        {
          title: "主役は地元の人",
          body: "いちばん大事にしている利用者は、たまたま来た人ではなく、その場所の近くで暮らし続ける人です。",
        },
        {
          title: "名前当てより、同じ場所に戻ること",
          body: "1 回の正解より、前回と今回の違いに気づいて同じ場所に戻れることを大事にしています。一度見た場所にまた行く——この繰り返しが、観察を学びに変えます。",
        },
        {
          title: "記録するほど、見え方が変わる",
          body: "自分で観察を続けるほど、見分け方が育ちます。そして積み重ねた記録は、将来の AI 同定の精度を支える学習データにもなります。",
        },
        {
          title: "断定より、証拠を残す",
          body: "急いで種まで言い切るより、場所・時刻・写真・メモを残して、あとから見返せる状態を優先します。",
        },
        {
          title: "今日の記録を、100 年のデータにする",
          body: "今日の記録を、その場限りの投稿ではなく、将来の研究や地域理解にも使える長期アーカイブとして扱います。",
        },
        {
          title: "記録が続いた先に、地域理解が生まれる",
          body: "記録を積み重ねていくと、気づかなかった地域の自然が見えてきます。地域や組織への活用は、あなたの記録が続いた先で自然と生まれるものです。",
        },
      ]) + rows([
        {
          title: "まずは試しに 1 件、記録してみる",
          body: "名前が分からなくても大丈夫。場所とメモだけで残せます。",
          actionHref: withBasePath(basePath, "/record"),
          actionLabel: lang === "ja" ? "観察を記録する" : "Start recording",
        },
      ]),
      "Learn",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/learn"))}">考え方を読む</a>`,
    );
  });

  app.get("/learn", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "解説ガイド一覧 | ikimon" : "Learn | ikimon",
      lang === "ja" ? "解説ガイド" : "Learn",
      lang === "ja" ? "ikimon をもっとよく使うために" : "Learn",
      "近い場所の記録をどう続けるか、断定しない同定をどう扱うか、記録をどんなアーカイブとして残すかを整理しています。",
      cards([
        {
          title: "近い場所と再訪",
          body: "同じ場所に戻ることが、なぜ学びと継続の中心になるかを整理します。",
        },
        {
          title: "断定しない同定",
          body: "AI は候補、観察は証拠、レビューは別レーンという扱いを確認します。",
        },
        {
          title: "組織導入と長期アーカイブ",
          body: "学校・自治体・企業で、場所の記録をどう始めて続けるかを確認できます。",
          href: withBasePath(basePath, "/for-business"),
          label: lang === "ja" ? "法人向け" : "For Business",
        },
      ]) + rows([
        {
          title: "Satellite-to-Field Loop",
          body: "衛星文脈から現地仮説を作り、Field Scan と Field Note に落として再訪まで回す one-pager。空白と不在を混ぜない境界条件もここで固定する。",
          actionHref: withBasePath(basePath, "/learn/field-loop"),
          actionLabel: lang === "ja" ? "読む" : "Field Loop",
        },
        {
          title: "同定の考え方",
          body: "断定しない理由、次に見るべきポイント、再観察で精度を上げる方法。",
          actionHref: withBasePath(basePath, "/learn/identification-basics"),
          actionLabel: lang === "ja" ? "読む" : "Basics",
        },
        {
          title: "Methodology（方針）",
          body: "データ方針、位置情報の扱い、公開の前提と限界。",
          actionHref: withBasePath(basePath, "/learn/methodology"),
          actionLabel: lang === "ja" ? "確認する" : "Methodology",
        },
        {
          title: "アップデート",
          body: "機能追加を単なる更新履歴ではなく、観察体験の進化として整理。",
        },
      ]),
      "Learn",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/about"))}">ikimon について読む</a>`,
    );
  });

  app.get("/learn/field-loop", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const pageTitle = lang === "ja" ? "Field Loop | ikimon" : "Field Loop | ikimon";
    const heroHeading = lang === "ja"
      ? "名前が分からなくても、観測は始めていい。"
      : "You don't need a name. Just start observing.";
    const heroLead = lang === "ja"
      ? "ikimon では、現場の発見を AI・市民・専門家・研究が循環して解像度を上げていく仕組みを「フィールドループ」と呼んでいます。その場で正解を出せなくても、観測には価値があります。"
      : "ikimon calls this the Field Loop — a cycle where AI, citizens, experts, and research gradually raise the resolution of your observation. Certainty is not required at the start.";
    const trustSentence = lang === "ja"
      ? "AI は答えを決める役ではなく、候補を広げる役です。"
      : "AI does not decide the final answer. It expands plausible candidates.";
    const body = `${FL_CSS}
    <div class="fl">

      <section class="fl-sec">
        <div class="fl-label">フィールドループとは</div>
        <h2 class="fl-h2">観測は、その場で正解を出すためのものではない。</h2>
        <p class="fl-lead">ikimon.life は、現場の発見を AI・市民・専門家・研究の循環で少しずつ高解像度化していく仕組みです。名前が分からなくても、観測は始められます。</p>

        <div class="fl-cycle">
          <div class="fl-cycle-step"><span class="fl-cycle-num">STEP 1</span>観測を残す</div>
          <div class="fl-cycle-step"><span class="fl-cycle-num">STEP 2</span>候補を広げる</div>
          <div class="fl-cycle-step"><span class="fl-cycle-num">STEP 3</span>検証して絞る</div>
          <div class="fl-cycle-step"><span class="fl-cycle-num">STEP 4</span>知識へ更新する</div>
        </div>

        <div class="fl-trust">
          <strong>AI の役割</strong>
          AI は答えを決める役ではなく、候補を広げる役です。
        </div>

        <div class="fl-chips">
          <span class="fl-chip">種名が分からなくても観測には価値がある</span>
          <span class="fl-chip">AI同定は確定ではなく候補提示</span>
          <span class="fl-chip">専門家同定は重要観測の検証と基準管理を担う</span>
          <span class="fl-chip">研究資料化された知見だけが集合知とAI更新に入る</span>
          <span class="fl-chip">未確定は未確定のまま保持される</span>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">なぜ必要か</div>
        <h2 class="fl-h2">3つの現実的な理由</h2>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>自然は多すぎる</h3>
              <p>現地では、名前がすぐ出ない観測のほうが多い。それでも地域の変化や季節の気配は、そこでしか拾えないと私たちは考えています。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>専門家だけでは追いきれない</h3>
              <p>重要観測の検証は専門家が担うべきだと思っていますが、すべてを最初から専門家だけで処理する設計では広域・長期の観測を支えきれないと言われています<sup>[1]</sup>。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>でも曖昧な観測を捨てるともったいない</h3>
              <p>科・属レベルでも、分布、季節性、異変の兆し、観測空白地帯の把握には十分な価値があると言われています<sup>[2]</sup>。ここで見えるのはまず空白であり、いないことの断定ではないと考えています<sup>[3]</sup>。</p>
            </div>
          </div>
        </div>
        <p class="fl-body">だから ikimon.life は、最初から完璧な同定を求めるのでなく、観測を失わず、あとから解像度を上げられる構造を採用します。</p>
      </section>

      <section class="fl-sec">
        <div class="fl-label">仕組み</div>
        <h2 class="fl-h2">7ステップのループ</h2>
        <p class="fl-lead">この循環により、同じ地域・同じ生きものについて、次の観測ほど見つけやすく、学びやすく、確かめやすくなります。</p>
        <div class="fl-steps">
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">1</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>衛星データ・現地観測</h3><p>場所の文脈とその場の発見を起点にする。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">2</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>フィールドスキャン / ガイド / ノート</h3><p>観測を失わず、証拠と文脈を残す。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">3</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>AI同定・市民同定</h3><p>候補と仮説を広げ、絞り込みを進める。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">4</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>専門家同定</h3><p>重要観測を検証し、基準を管理する。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">5</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>研究資料化</h3><p>再利用できる形に整理し、証拠を固定する。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">6</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>集合知アップデート</h3><p>ガイドや知識基盤に反映する。</p></div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num"><div class="fl-step-num-badge">7</div><div class="fl-step-num-line"></div></div>
            <div class="fl-step-content"><h3>AIアップデート</h3><p>更新対象だけを使って次の候補提示を改善する。</p></div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">証拠の階層</div>
        <h2 class="fl-h2">Evidence Ladder</h2>
        <p class="fl-body">使い道と確実性は同じではない。未確定を未確定のまま保持することで、usefulness と certainty を切り分ける。</p>
        <div class="fl-callout">
          <strong>重要な境界</strong>
          <p>観測空白は「まだ十分に見ていない」を意味する。「いない」に近い主張には、時期・時間帯・探索努力の記録を含む、より高い証拠条件が必要です。</p>
        </div>
        <div class="fl-tiers">
          <div class="fl-tier fl-tier-1">
            <div><div class="fl-tier-name">科・属レベル</div><div class="fl-tier-meaning">まず群として捉える</div></div>
            <div><div class="fl-tier-col-label">使えること</div><div class="fl-tier-col-body">分布、季節性、初学者参加、ホットスポット把握</div></div>
            <div><div class="fl-tier-col-label">使えないこと</div><div class="fl-tier-col-no">稀少種の確定</div></div>
          </div>
          <div class="fl-tier fl-tier-2">
            <div><div class="fl-tier-name">種レベル候補</div><div class="fl-tier-meaning">有力な仮説</div></div>
            <div><div class="fl-tier-col-label">使えること</div><div class="fl-tier-col-body">学習、追加観察、レビュー優先順位付け</div></div>
            <div><div class="fl-tier-col-label">使えないこと</div><div class="fl-tier-col-no">単独での確定判断</div></div>
          </div>
          <div class="fl-tier fl-tier-3">
            <div><div class="fl-tier-name">専門家確認</div><div class="fl-tier-meaning">検証済み観測</div></div>
            <div><div class="fl-tier-col-label">使えること</div><div class="fl-tier-col-body">重要観測の確定、基準管理</div></div>
            <div><div class="fl-tier-col-label">使えないこと</div><div class="fl-tier-col-no">自動大量確定</div></div>
          </div>
          <div class="fl-tier fl-tier-4">
            <div><div class="fl-tier-name">研究資料 / 更新対象</div><div class="fl-tier-meaning">再利用可能な証拠</div></div>
            <div><div class="fl-tier-col-label">使えること</div><div class="fl-tier-col-body">ガイド更新、モデル更新、分析</div></div>
            <div><div class="fl-tier-col-label">使えないこと</div><div class="fl-tier-col-no">生データの無差別投入</div></div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">役割分担</div>
        <h2 class="fl-h2">Who Does What</h2>
        <div class="fl-roles">
          <article class="fl-role">
            <span class="fl-role-icon">🧭</span>
            <h3>観測者</h3>
            <p>見つける人</p>
            <span class="fl-role-tag">名前が分からなくても観測には価値がある</span>
          </article>
          <article class="fl-role">
            <span class="fl-role-icon">🛰️</span>
            <h3>AI</h3>
            <p>候補を広げる人ではなく、候補を示す道具</p>
            <span class="fl-role-tag">確定ではなく候補提示</span>
          </article>
          <article class="fl-role">
            <span class="fl-role-icon">🧠</span>
            <h3>市民同定者</h3>
            <p>知識を持ち寄り、絞り込む人</p>
            <span class="fl-role-tag">最終判定の代替ではない</span>
          </article>
          <article class="fl-role">
            <span class="fl-role-icon">🔬</span>
            <h3>専門家</h3>
            <p>基準を管理し、確かめる人</p>
            <span class="fl-role-tag">重要観測の検証と基準管理を担う</span>
          </article>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">粗いデータの価値</div>
        <h2 class="fl-h2">種まで分からなくても意味がある</h2>
        <p class="fl-body">科や属の情報が集まるだけで、地域の変化、季節の偏り、異変の兆し、観測の空白地帯は見えてくると私たちは信じています<sup>[2]</sup>。</p>
        <div class="fl-callout">
          <strong>空白と不在は別です</strong>
          <p>ここでまず見えるのは「未観測」や「観測薄い」という空白だと考えています。「いない」に近い含意を持たせるには、いつ・どこで・どれだけ探したかという sampling effort（探索努力量）が必要だと言われています<sup>[3]</sup>。</p>
        </div>
        <ul class="fl-benefits">
          <li>観測数を増やせる</li>
          <li>初学者が参加しやすい</li>
          <li>あとから解像度を上げられる</li>
        </ul>
        <p class="fl-body">ただし、保全上重要な判断や稀少種の確定は、より高い証拠階層で扱います。</p>
      </section>

      <section class="fl-sec">
        <div class="fl-label">よくある疑問</div>
        <h2 class="fl-h2">Governance / Safety</h2>
        <div class="fl-faq">
          <div class="fl-faq-item">
            <div class="fl-faq-q">AIが勝手に正解を決めるのですか？</div>
            <p class="fl-faq-a">いいえ。AI同定は候補提示であり、確定ではありません。</p>
          </div>
          <div class="fl-faq-item">
            <div class="fl-faq-q">多数決で種名が決まるのですか？</div>
            <p class="fl-faq-a">いいえ。市民同定は知識形成に参加する層ですが、重要観測の確定は検証プロセスを通ります。</p>
          </div>
          <div class="fl-faq-item">
            <div class="fl-faq-q">間違った観測も学習されるのですか？</div>
            <p class="fl-faq-a">いいえ。更新対象に入るのは、整理・検証条件を満たした知見です。</p>
          </div>
          <div class="fl-faq-item">
            <div class="fl-faq-q">記録がない場所は、その生きものがいない場所なのですか？</div>
            <p class="fl-faq-a">いいえ。まず分かるのは未観測や観測薄い領域です。不在に近い判断には、探索努力の記録と、より高い証拠条件が必要です。</p>
          </div>
        </div>
        <div class="fl-refs">
          <div class="fl-refs-label">参照している考え方</div>
          <ol>
            <li>[1] Chandler, M. et al. (2017). Contribution of citizen science towards international biodiversity monitoring. <em>Biological Conservation</em>, 213, 280–294. — 市民科学が広域・長期モニタリングを補完しうると言われています。</li>
            <li>[2] Callaghan, C. T. et al. (2019). Improving big citizen science data: Moving beyond haphazard sampling. <em>PLOS Biology</em>, 17(6). — 粗い分類解像度でも分布・季節性の把握に寄与しうると言われています。</li>
            <li>[3] MacKenzie, D. I. et al. (2002). Estimating site occupancy rates when detection probabilities are less than one. <em>Ecology</em>, 83(8), 2248–2255. — 未検出と不在は別概念として扱う必要があると言われています。</li>
          </ol>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">次の一歩</div>
        <h2 class="fl-h2">観測を始める</h2>
        <p class="fl-body">Field Loop は、AI が最後の審判になる仕組みではない。未確定を保持しながら、観測を失わず、役割分担のある検証と更新で知識解像度を上げる仕組みだ。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">まずは名前が分からなくても観測する</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">フィールドループの考え方を詳しく見る</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/for-business/apply"))}">研究・教育・保全で連携したい</a>
        </div>
        <p class="fl-premise">
          明示する前提 — 種名が分からなくても観測には価値がある / AI同定は確定ではなく候補提示 / 市民同定は最終判定の代替ではない / 研究資料化された知見だけが集合知とAI更新に入る / 未確定は未確定のまま保持される / 観測空白と不在証拠は別である
        </p>
      </section>

    </div>`;
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      pageTitle,
      "Learn",
      heroHeading,
      heroLead,
      body,
      "Learn",
      `<div class="note">${escapeHtml(trustSentence)}</div><a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      lang === "ja" ? "名前が分からなくても、<br>観測は始めていい。" : "You don&#39;t need a name.<br>Just start observing.",
    );
  });

  app.get("/learn/identification-basics", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Identification Basics | ikimon",
      "Learn",
      "その場で名前が出なくて、当然です。",
      "ikimon では、観察を残す・AI が候補を返す・専門家が検証する、この3つを別の役割として分けて設計しています。混ぜないことが、同定の基本です。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">3つの前提</div>
        <h2 class="fl-h2">名前が分からなくても、観察は始められる。</h2>
        <p class="fl-lead">ikimon は「その場で正解を断言する」ことを求めません。観察を残し、候補を広げ、あとから確度を上げていく設計です。</p>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>種まで絞り込めないとき</h3>
              <p>写真の角度、部位の写っていない部分、幼体や季節による姿の違い、近い仲間との共通点が多い種では、属までで止める方が正確なことがあります。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>AI が返す候補の役割</h3>
              <p>AI は「正解」ではなく、候補の種・見分けるポイント・次に撮りたい部位を返します。最後に決めるのは観察者ご自身です。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>専門家によるレビュー</h3>
              <p>より厳密な同定や確認は、専門家向けの別画面で扱います。日常の観察とは分けているので、一般のご利用では気にする必要はありません。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">確度の上げ方</div>
        <h2 class="fl-h2">撮り直しで候補が絞れる</h2>
        <p class="fl-body">葉の裏、翅の脈、腹部、花の付け根、全景と接写の組み合わせなど、決め手になる部位を追加すると候補を絞りやすくなります。</p>
        <div class="fl-info">
          <strong>ikimon が返したいもの</strong>
          <p>種名だけでなく、まだ断定しない理由、似た候補、次に何を撮れば進むか、そしてその場所にまた行きたくなる理由。</p>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">最初の一歩</div>
        <h2 class="fl-h2">まず 1 件、記録してみる</h2>
        <p class="fl-body">完璧な同定でなくて構いません。観察と再訪を重ねることで、少しずつ見えるものが変わっていきます。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">観察を記録する</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench"))}">専門家向け画面を開く</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      "その場で名前が出なくて、<br>当然です。",
    );
  });

  app.get("/learn/methodology", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Methodology | ikimon",
      "Learn",
      "ikimon が何をどう扱うか、全部見せます。",
      "データの取り扱い、希少種の位置保護、モニタリング参考指標の考え方を公開しています。数値は環境の価値を断言するためではなく、継続観察の対話をするために置いています。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">データの扱い方</div>
        <h2 class="fl-h2">3つの基本方針</h2>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>Data policy</h3>
              <p>ライブスキャン中の映像は AI 判定後に自動削除し、環境音は鳥類判定のためにのみ使います。投稿された観察は将来の open biodiversity data 連携も見据えています。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>Location handling</h3>
              <p>GPS は生態学的な精度を保ちつつ、希少種はマスク処理し、公開権限に応じて位置精度を制御します。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>MRI（モニタリング参考インデックス）</h3>
              <p>MRI は種の多様性、保全価値、データ信頼性、分類群カバー率、調査継続性の 5 軸を見る参考指標で、良し悪しの断定ではありません。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">指標の詳細</div>
        <h2 class="fl-h2">5 軸評価モデル</h2>
        <p class="fl-body">種の多様性 30%、保全価値 25%、データ信頼性 20%、分類群カバー率 15%、調査継続性 10% を掛け合わせて経時変化を見ます。</p>
        <div class="fl-callout">
          <strong>観測空白と不在証拠</strong>
          <p>地図でまず見えるのは「未観測」や「観測薄い」領域だと考えています。「いない」に近い判断をするには、時期・時間帯・探索努力を含む sampling effort と、より高い証拠条件が必要だと言われています。</p>
        </div>
        <div class="fl-2col">
          <div class="fl-card">
            <h3>Open science stance</h3>
            <p>市民科学データはブラックボックスの都合で閉じず、条件と限界を公開したうえで future archive として残します。</p>
          </div>
          <div class="fl-card">
            <h3>Business / public との関係</h3>
            <p>企業や自治体にとっても、指標は報告のためだけでなく、場所ごとの変化を見返す共通言語として使います。</p>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">連携</div>
        <h2 class="fl-h2">組織での活用</h2>
        <p class="fl-body">研究・教育・保全の現場で ikimon の観察インフラを活用したい場合は、法人向けページからご相談ください。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/for-business"))}">For business</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/field-loop"))}">Field Loop を読む</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      "ikimonが何をどう扱うか、<br>全部見せます。",
    );
  });

  app.get("/learn/updates", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Updates | ikimon",
      "Learn",
      "少しずつ、確実に。",
      "歩いて・見つけて・書き残す体験が楽になる方向へ、ikimon は小さく進化してきました。主な節目を時系列で残しています。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">リリース履歴</div>
        <h2 class="fl-h2">小さく、着実に。</h2>
        <p class="fl-lead">機能追加の履歴ではなく、「自分の学びが育つ」「みんなの観察が AI を育てる」「地域の記録として積み上がる」の 3 つの方向に近づいた順序として読んでいただけると幸いです。</p>
        <div class="fl-steps">
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.10.1</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-04-08 — フィールドノート中心の導線</h3>
              <p>v2 の public 面を、フィールドノート中心の導線へ寄せました。主役を record / notes / revisit に固定しています。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.10.0</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-04 — Map lane 整備</h3>
              <p>フィールドスキャンで、次に歩く場所を考えるための map lane を整備しました。探索はノートに戻るための補助線として扱います。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.9.0</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03-31 — AIレンズ入口</h3>
              <p>AIレンズの入口を追加しました。現時点では完成機能としてではなく、将来の walking-time guide へつながる入口として置いています。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.8.x</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03 — 証拠保存の強化</h3>
              <p>写真や音を含む観察の証拠を、あとから見返せる形で残す方向を強めました。入力の幅を広げるための基盤整備です。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.7.x</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03 — 場所・再訪・記録の軸</h3>
              <p>場所・再訪・個人の記録を中心に据えるための初期導線を整えました。探索系の機能は、この軸を支える位置に置いています。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">今の体験を確かめる</div>
        <h2 class="fl-h2">実際に触ってみる</h2>
        <p class="fl-body">トップページから、記録・みつける・ホーム・観察の詳細まで、今の体験を一通り確認できます。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/record"))}">観察を記録する</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
    );
  });

  app.get("/faq", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "よくある質問 | ikimon" : "FAQ | ikimon",
      "FAQ",
      "よくある質問",
      "はじめての方、記録、同定、AI の役割、組織導入、データと公開範囲について、ikimon の前提を整理しています。",
      `<section class="section">
        <div class="section-header"><h2>はじめての方へ</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">ikimon とは何ですか？</summary><p class="fl-faq-a">散歩中に見つけた生き物を写真で記録し、AI とコミュニティが名前の特定を手伝ってくれるプラットフォームです。あなたの記録は長期の生態系データとして蓄積され、地域の生物多様性の把握や企業の環境報告にも活用されます。「見つけた → 撮った → 名前がわかった」この体験の連鎖が自然保全の力になります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">登録や費用はかかりますか？</summary><p class="fl-faq-a">個人利用は登録不要・完全無料です。閲覧・記録・マップ・AI ヒントなど基本機能に制限はありません。企業・自治体向けに観察データを使ったレポートや組織管理が必要な場合は、有料プランがあります（Public プラン ¥39,800/月〜）。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">スマートフォンだけで使えますか？</summary><p class="fl-faq-a">はい。ブラウザだけで完結します。アプリのダウンロードは不要です。iPhone（Safari）・Android（Chrome）でホーム画面に追加すると、アプリのように使えます。山や森など電波が弱い場所では、写真と記録を端末に保存し、電波が戻ったら自動送信されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">子どもでも使えますか？</summary><p class="fl-faq-a">使えます。13 歳未満のお子さんは保護者の同意・見守りのもとでご利用ください。Google アカウントを使ってログインするため、Google の年齢制限ポリシーが適用されます。学校でのフィールドワーク・環境教育にも活用いただけます。教育目的での利用相談は contact@ikimon.life まで。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>記録について</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">名前がわからなくても記録できますか？</summary><p class="fl-faq-a">できます。場所・日時・写真だけで記録になります。名前は空欄のまま投稿して OK。投稿後に AI がヒントを返し、コミュニティが同定を手伝ってくれます。「なんか気になる虫がいた」という記録が、のちに希少種の発見につながることがあります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">どんな写真を撮ればいいですか？</summary><p class="fl-faq-a">「全体像」「特徴部分のアップ」「生息環境」の 3 枚が理想です。鳥なら体の模様・くちばし、昆虫なら翅の模様・触角、植物なら花・葉・茎がポイント。1 枚だけでも記録になります。定規や手を添えてサイズ感を示すと同定しやすくなります。暗い場所ではフラッシュより自然光が有効です。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">過去の写真も投稿できますか？</summary><p class="fl-faq-a">できます。EXIF 情報（撮影日時・GPS 座標）が残っている写真なら、日時と場所が自動入力されます。情報が消えている写真でも、おおよその日時と場所をメモ欄で補足すれば有用なデータになります。自分が撮影した写真に限ります（他人の写真の転載は禁止です）。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">私の 1 件の記録に意味はありますか？</summary><p class="fl-faq-a">あります。世界中で市民の 1 件の記録が新分布の発見や希少種の確認につながった事例があります。今日の「普通の記録」が、10 年後に「この場所にこの種がいた」という歴史的なデータになります。あなたの目とスマートフォンは、専門家が観察できない場所をカバーする唯一の手段です。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">こんな投稿は避けてください</summary><p class="fl-faq-a">AI 生成画像・他人が撮影した写真・生き物が写っていない写真・同じペットの繰り返し投稿・虚偽の位置情報や日時は避けてください。「自分が見て撮った・生き物が写っている・生き物を傷つけていない」の 3 点がクリアなら、名前がわからなくてもピントが甘くても投稿 OK です。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>AI と同定について</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">AI は名前を自動で確定しますか？</summary><p class="fl-faq-a">しません。AI が返すのは候補と見分けのヒントです。名前の確定は複数ユーザーの加重合意（WE-Consensus）で決まります。投稿者 1 人だけの同定では確定せず、必ず他のユーザーの目が入る設計です。AI だけで「研究グレード」に昇格することはありません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿後に表示される「観察のヒント」とは何ですか？</summary><p class="fl-faq-a">投稿後に写真・場所・季節をもとに AI が自動生成するメモです。「いまはここまで絞れそう」「見分けのポイント」「次に確認すると良いこと」を示します。コミュニティ同定の票にはなりません。名前を断定するものではなく、あくまでヒントとして参考にしてください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">間違った名前を付けてしまったらどうなりますか？</summary><p class="fl-faq-a">いつでも修正できます。間違いはコミュニティが一緒に修正してくれます。「モンシロチョウだと思ったらスジグロシロチョウだった」——この体験が観察力を磨きます。初心者もベテランも学びの途中です。間違いを恐れずに挑戦する姿勢をコミュニティは応援しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">「研究グレード」とは何ですか？</summary><p class="fl-faq-a">写真・日時・位置情報が揃い、コミュニティの加重合意率が 66.7% 以上に達した記録のステータスです。科・属レベルで安定した記録は「研究利用可」、種以下まで安定した記録は「種レベル研究用」として区別されます。研究グレードに達すると、将来的に GBIF（地球規模生物多様性情報機構）との連携対象になります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">AI の提案はどのくらい正確ですか？</summary><p class="fl-faq-a">「参考情報」として設計しています。大きな分類群（チョウの仲間・甲虫の仲間）や特徴的な形態の種は得意です。近縁種の識別・幼虫・写真が暗い場合は精度が落ちます。AI が方向性を示し、コミュニティが正解を確定する——このバトンリレーが ikimon のデータ品質を支えています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿データが AI の学習に使われますか？</summary><p class="fl-faq-a">第三者の AI 企業には一切提供しません。AI クローラーによるスクレイピングも技術的にブロックしています。将来的に ikimon 自身のサービス改善（AI 同定精度の向上）に活用する可能性がありますが、その場合も外部に流出することはありません。データの主権はユーザーとikimon コミュニティにあります。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>企業・自治体向け</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">法人向けは個人利用と何が違いますか？</summary><p class="fl-faq-a">サイト単位のダッシュボード・TNFD 参照レポートの自動生成・複数人の管理席が加わります。観察会の初回立ち上げから継続運用まで相談できます。個人利用（記録・閲覧・AI ヒント）は引き続き無料です。詳細は「法人向け」ページをご覧ください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">TNFD レポートは自動生成できますか？</summary><p class="fl-faq-a">サイトダッシュボードから観測ベースの参考レポートを自動生成できます。確認種リスト・レッドリスト該当種・月次推移チャートを含み、TNFD の LEAP フレームに読み替えやすい構成です。重要な開示や意思決定には専門家レビューとの組み合わせを推奨します。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">費用はどのくらいかかりますか？</summary><p class="fl-faq-a">個人利用は無料です。法人向けは Public プラン（¥39,800/月・1 サイト・5 席）から始められます。複数拠点をまとめて管理する Portfolio プラン（¥99,000/月・5 サイト・20 席）もあります。まずは無料デモでダッシュボードとレポートをお試しください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自社の敷地だけのデータを見られますか？</summary><p class="fl-faq-a">できます。サイト登録機能で GeoJSON 形式の境界データをアップロードすると、敷地内の観察データのみを対象にしたダッシュボードとレポートが自動生成されます。複数サイトの登録・比較も可能です。GeoJSON の準備が難しい場合はサポートします。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>データ・プライバシー</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">位置情報は公開されますか？</summary><p class="fl-faq-a">絶滅危惧種（環境省・都道府県レッドリスト該当種）の位置情報は自動でマスキングされ、詳細な場所が特定されない精度に落とされます。通常の記録も住所が特定されるような表示はしません。写真の EXIF 情報（GPS 座標）はアップロード時に自動除去されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自分のデータを削除できますか？</summary><p class="fl-faq-a">できます。各観察記録の詳細ページからいつでも削除できます。削除するとデータベースから完全に除去されます（復元不可）。アカウント全体の削除は contact@ikimon.life までご連絡ください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">データは他のプラットフォームと共有されますか？</summary><p class="fl-faq-a">研究グレードに達した高品質データを、将来的に GBIF（地球規模生物多様性情報機構）と連携する準備を進めています。SNS や広告目的での共有は一切しません。CC BY-NC ライセンスを選択した記録は GBIF 共有の対象外になります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿データのライセンスはどうなりますか？</summary><p class="fl-faq-a">投稿時に CC0・CC BY・CC BY-NC の 3 種類から選べます。デフォルトは CC BY（表示・改変・商用利用可）です。世界中の研究者がデータを活用できる形にするには CC BY が最適です。写真の著作権は投稿者に帰属し、ikimon が著作権を取得することはありません。</p></details>
        </div>
      </section>`,
      "Learn",
    );
  });

  app.get("/privacy", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Privacy Policy | ikimon",
      "Trust",
      "プライバシーポリシー",
      "ikimon は、記録を長く残すためにデータを扱います。同時に、希少種や個人の行動が露出しすぎないよう公開範囲を分けます。",
      rows([
        { title: "お預かりするもの", body: "アカウント情報、観察記録、写真・音声などの証拠、サービス運用に必要なログ。" },
        { title: "公開範囲の考え方", body: "観察は残しますが、希少種や保護上配慮が必要な位置は公開精度を下げる、あるいは非公開にします。" },
        { title: "使い道", body: "観察履歴の表示、再訪しやすいノートの提供、同定補助、将来の長期アーカイブ整備、安全運用のため。" },
        { title: "個別のお問い合わせ", body: "詳細な取り扱い方針や削除依頼は、お問い合わせページから受け付けています。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
      ]),
      "Learn",
    );
  });

  app.get("/terms", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Terms | ikimon",
      "Trust",
      "利用規約",
      "安全に記録を残し、他者や生きものへの不利益を避けながら使っていただくための要点をまとめています。",
      rows([
        { title: "投稿についての確認", body: "写真・音声・メモの権利を持つ内容のみ投稿してください。公開範囲と位置情報の扱いも投稿時に確認いただきます。" },
        { title: "避けてほしい行為", body: "なりすまし、不正アクセス、他者への迷惑行為、希少種や保護上配慮が必要な位置の不用意な公開は禁止です。" },
        { title: "AI と同定の扱い", body: "AI の候補は補助です。公開面での断定は、観察証拠やレビューの状態と切り分けて扱います。" },
        { title: "運用変更について", body: "改善に伴い画面や URL が変わることがありますが、既存の記録は移行し、読み返せる状態の維持を優先します。" },
      ]),
      "Learn",
    );
  });

  app.get("/contact", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    const formHtml = renderContactForm(basePath);
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Contact | ikimon",
      "Contact",
      "お問い合わせ",
      "ikimon に関するご質問や導入相談を受け付けています。個人利用と組織導入で窓口を分けています。",
      formHtml + rows([
        {
          title: "法人・団体のお問い合わせ",
          body: "企業・自治体・学校で、自然共生サイトや観察導線を始めたい場合はこちらの導線もあります。",
          actionHref: withBasePath(basePath, "/for-business/apply"),
          actionLabel: "法人のお問い合わせ",
        },
        {
          title: "導入の考え方を見る",
          body: "料金より先に、どういう場所でどう始めるかを確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "導入を見る",
        },
      ]),
      "Learn",
    );
  });

  app.post<{ Body: { category?: string; name?: string; email?: string; organization?: string; message?: string; sourceUrl?: string } }>(
    "/contact",
    async (_request, reply) => {
      // フォームの action が /contact を指していても、クライアントの JS が fetch で /api/v1/contact/submit を使う。
      // JS 無効環境のフォールバックとして、/contact への POST はエラーを返す（fetch を使うよう促す）。
      reply.code(400);
      reply.type("application/json");
      return { ok: false, error: "use_api_endpoint", hint: "POST /api/v1/contact/submit" };
    },
  );

  app.get("/for-business", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimon for Business — 組織で支える、近くの自然" : "For Business | ikimon",
      lang === "ja" ? "法人向け" : "For Business",
      "企業・自治体の敷地の自然を、記録して積み上げる。",
      "学校・自治体・企業が、敷地や地域の自然を継続的に記録する仕組みを、初回観察会から運用まで立ち上げやすい導線で用意しています。",
      cards([
        {
          title: "まずは場所を立ち上げる",
          body: "はじめに必要なのは高機能な分析より、対象となる場所で最初の観察を始め、再訪の導線を作ることです。",
          href: withBasePath(basePath, "/for-business/demo"),
          label: lang === "ja" ? "デモを見る" : "Demo",
        },
        {
          title: "想定する利用者",
          body: "自治体、学校、企業、NPOなど、敷地や地域で自然観察を継続したい組織を対象にしています。",
        },
        {
          title: "段階的に始める",
          body: "無料で始めて、継続運用や出力が必要になった段階で追加する設計です。",
          href: withBasePath(basePath, "/for-business/pricing"),
          label: lang === "ja" ? "料金を見る" : "Pricing",
        },
        {
          title: "まず記録から始める",
          body: "初回の観察会を開き、その場所で生き物の記録を 1 件残します。分析ツールより先に、現場で記録が続く仕組みを作ることを優先します。",
        },
        {
          title: "なぜ分析より先に記録の仕組みか",
          body: "観察のデータがなければ分析も報告もできません。まず現場で記録が続く状態を作り、その上に分析や報告を乗せる設計です。",
        },
        {
          title: "よくある質問",
          body: "導入前に確認したい点を先に整理できます。",
          href: withBasePath(basePath, "/faq"),
          label: "FAQ",
        },
        {
          title: "導入相談と共同実証",
          body: "対象場所、初回の観察導線、継続体制まで含めて相談できます。",
          href: withBasePath(basePath, "/for-business/apply"),
          label: lang === "ja" ? "相談する" : "Apply",
        },
      ]) + rows([
        {
          title: "なぜ分析より先に記録の仕組みを作るのか",
          body: "測定や報告より先に、現場で観察が続く状態を作ることが大事です。その考え方を確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: lang === "ja" ? "詳しく見る" : "Learn more",
        },
      ]),
      "For Business",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/contact"))}">問い合わせる</a>`,
    );
  });

  app.get("/for-business/pricing", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Pricing | ikimon",
      "For Business",
      "導入の始め方",
      "最初から重い契約を結ぶより、まずは場所単位で観察を始め、継続運用や出力が必要になった段階で追加する方針です。",
      rows([
        { title: "まず無料で始める", body: "記録・閲覧・マップ表示・初回観察会の立ち上げまでは無料で始められます。申込不要です。追加料金の発生する機能は導入後に相談ベースで選びます。" },
        { title: "必要になったら追加する", body: "全種リスト、CSV出力、証跡レポートなど、継続運用や調査報告に必要な機能を段階的に追加できます。" },
        { title: "ご相談", body: "対象場所、初回観察会、無償提供の適用可否などは、下記から相談できます。", actionHref: withBasePath(basePath, "/for-business/apply"), actionLabel: "お問い合わせ" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/demo", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Demo | ikimon",
      "For Business",
      "実際の画面で、場所の立ち上がりを確認する",
      "営業用の別画面ではなく、実際の public lane を見ていただきます。どのように記録を始め、再訪導線につなぐかを把握できます。",
      rows([
        { title: "場所の広がりを見る", body: "どの場所に観察が積み重なっているかを確認できます。", actionHref: withBasePath(basePath, "/map"), actionLabel: "マップへ" },
        { title: "最初の 1 件を記録する", body: "場所・時刻・写真を残してノートを始める流れを確認できます。", actionHref: withBasePath(basePath, "/record"), actionLabel: "記録画面へ" },
        { title: "運用 readiness を見る", body: "サービスの健全性と切替 readiness を確認できるページです。", actionHref: withBasePath(basePath, "/ops/readiness"), actionLabel: "運用状況へ" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/status", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Status | ikimon",
      "For Business",
      "サービスの状況",
      "ikimon の稼働だけでなく、切替 readiness、互換性、rollback 前提の運用準備を確認するためのページです。",
      rows([
        { title: "データの整合性", body: "legacy との比較、delta sync、read/write lane の整合、rehearsal 結果を確認しながら進めています。" },
        { title: "運用面の準備", body: "本番切替は near-ready の確認だけでなく、rollback 可能性と compatibility write を前提に管理しています。" },
        { title: "次の予定", body: "新しい画面へ順次切り替えますが、一定期間は rollback lane を残し、急な後戻りができる状態を維持します。" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/apply", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Apply | ikimon",
      "For Business",
      "法人・団体のお問い合わせ",
      "導入相談、共同実証、対象場所の選定、初回観察導線の設計などを受け付けています。個人利用と無料開始には申し込み不要です。",
      rows([
        { title: "お問い合わせの種類", body: "導入相談、共同実証、対象場所の整理、運用設計の相談など、近い内容をお知らせください。" },
        { title: "対象となる場所", body: "観察したい敷地、公園・緑地、拠点周辺など、まず立ち上げたい場所を教えてください。" },
        { title: "いま困っていること", body: "初回観察会の設計、継続者不足、報告導線、対象範囲の整理など、現状の課題を共有いただけると早いです。" },
        { title: "次のステップ", body: "ご連絡フォームをご用意するまで、下記の総合お問い合わせから受け付けております。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
      ]),
      "For Business",
    );
  });
}
