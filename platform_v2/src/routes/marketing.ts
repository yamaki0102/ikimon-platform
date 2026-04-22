import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { loadMarketingLongformPage, renderMarketingMarkdown, type MarketingCard, type MarketingLongformPage, type MarketingRow } from "../services/marketingContent.js";
import { getMonitoringPocSnapshot, type MonitoringPocSnapshot } from "../services/monitoringPoc.js";
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
      headingHtml: escapeHtml(heading),
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
        footerNote: "Let what you notice nearby connect later.",
      };
    case "es":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizaciones",
        footerNote: "Deja que lo que notas cerca conecte más tarde.",
      };
    case "pt-BR":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizações",
        footerNote: "Deixe o que você nota por perto se conectar depois.",
      };
    default:
      return {
        record: "記録する",
        explore: "みつける",
        business: "法人向け",
        footerNote: "見つけたことが、あとで自分やほかの人につながっていく。",
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

function copyByLang(lang: SiteLang, ja: string, en: string, es?: string, ptBR?: string): string {
  switch (lang) {
    case "en":
      return en;
    case "es":
      return es ?? en;
    case "pt-BR":
      return ptBR ?? en;
    default:
      return ja;
  }
}

function resolveLocalizedHref(basePath: string, lang: SiteLang, href?: string): string | undefined {
  if (!href) return undefined;
  return appendLangToHref(withBasePath(basePath, href), lang);
}

function localizeCardsForPage(basePath: string, lang: SiteLang, items: MarketingCard[]): MarketingCard[] {
  return items.map((item) => ({
    ...item,
    href: resolveLocalizedHref(basePath, lang, item.href),
  }));
}

function localizeRowsForPage(basePath: string, lang: SiteLang, items: MarketingRow[]): MarketingRow[] {
  return items.map((item) => ({
    ...item,
    actionHref: resolveLocalizedHref(basePath, lang, item.actionHref),
  }));
}

function renderMarketingLongformBody(page: MarketingLongformPage, basePath: string, lang: SiteLang): string {
  const cardsHtml = cards(localizeCardsForPage(basePath, lang, page.cards));
  const markdownHtml = renderMarketingMarkdown(page.markdown, (href) => appendLangToHref(withBasePath(basePath, href), lang));
  const rowsHtml = page.rows.length > 0 ? rows(localizeRowsForPage(basePath, lang, page.rows)) : "";
  return `${cardsHtml}${markdownHtml}${rowsHtml}`;
}

function businessHeroActions(basePath: string, lang: SiteLang): string {
  const applyHref = appendLangToHref(withBasePath(basePath, "/for-business/apply"), lang);
  const demoHref = appendLangToHref(withBasePath(basePath, "/for-business/demo"), lang);
  return `<div class="actions">
    <a class="btn btn-solid" data-kpi-action="for_business_apply" href="${escapeHtml(applyHref)}">${escapeHtml(copyByLang(lang, "相談する", "Apply", "Solicitar", "Solicitar"))}</a>
    <a class="btn btn-ghost-on-dark" data-kpi-action="for_business_demo" href="${escapeHtml(demoHref)}">${escapeHtml(copyByLang(lang, "デモを見る", "Demo", "Demo", "Demo"))}</a>
  </div>`;
}

function renderMonitoringDemoBody(snapshot: MonitoringPocSnapshot, lang: SiteLang): string {
  const firstReport = snapshot.comparisonReports[0];
  const plotRows = snapshot.plotRegistry
    .slice(0, 3)
    .map(
      (plot) => `<div class="row">
        <div>
          <strong>${escapeHtml(`${plot.plotCode} / ${plot.plotName}`)}</strong>
          <div class="meta">${escapeHtml(plot.baselineForestType ?? (lang === "ja" ? "森林タイプ未設定" : "Forest type pending"))}</div>
          <div class="meta">${escapeHtml(plot.imageryContext.note ?? (lang === "ja" ? "既存画像を背景文脈に使用" : "Existing imagery as context only"))}</div>
        </div>
        <div class="pill">${escapeHtml(plot.latestProtocolCode ?? (lang === "ja" ? "baseline" : "baseline"))}</div>
      </div>`,
    )
    .join("");

  const reportBlock = firstReport
    ? `<section class="section">
        <div class="section-header"><div><div class="eyebrow">${escapeHtml(lang === "ja" ? "比較レポート例" : "Sample report")}</div><h2>${escapeHtml(firstReport.plotLabel)}</h2></div></div>
        <div class="list">
          <div class="row"><div><strong>${escapeHtml(copyByLang(lang, "現地の証拠", "Field evidence", "Evidencia de campo", "Evidência de campo"))}</strong><div class="meta">${escapeHtml(firstReport.fieldEvidence.fieldNoteSummary ?? copyByLang(lang, "未記録", "Pending", "Pendiente", "Pendente"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(copyByLang(lang, "現地の状況", "Site condition", "Estado del sitio", "Condição do local"))}</strong><div class="meta">${escapeHtml(firstReport.siteCondition.latest ?? copyByLang(lang, "未記録", "Pending", "Pendiente", "Pendente"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(copyByLang(lang, "再訪時の変化", "Revisit diff", "Diferencia en revisita", "Diferença na revisita"))}</strong><div class="meta">${escapeHtml(firstReport.revisitDiff.summary)}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(copyByLang(lang, "地図・航空写真の文脈", "Imagery context", "Contexto cartográfico", "Contexto do mapa"))}</strong><div class="meta">${escapeHtml(firstReport.imageryContext.note ?? copyByLang(lang, "地図・航空写真は背景文脈のみ", "Map and air photo stay in the context lane", "El mapa y la foto aérea quedan como contexto", "Mapa e foto aérea ficam só como contexto"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(copyByLang(lang, "次の一手", "Next action", "Siguiente paso", "Próximo passo"))}</strong><div class="meta">${escapeHtml(firstReport.nextAction ?? copyByLang(lang, "未設定", "Pending", "Pendiente", "Pendente"))}</div></div></div>
        </div>
      </section>`
    : "";

  return rows([
    {
      title: lang === "ja" ? "Step 1. site と plot を決める" : "Step 1. Choose the site and plots",
      body:
        lang === "ja"
          ? "固定プロットを 1-3 本に絞り、既存の地図・航空写真で固定点と境界の当たりをつけます。"
          : "Limit the first PoC to 1-3 fixed plots, then use existing map and air-photo context to anchor points and boundaries.",
    },
    {
      title: lang === "ja" ? "Step 2. visit ごとに証拠を束ねる" : "Step 2. Bundle evidence per visit",
      body:
        lang === "ja"
          ? "field note / field scan / fixed-point photo を 1 visit に束ね、欠損を見える化します。"
          : "Bundle field note, field scan, and fixed-point photo into one visit and make gaps explicit.",
    },
    {
      title: lang === "ja" ? "Step 3. baseline / revisit / next action を共有する" : "Step 3. Share baseline, revisit, and next action",
      body:
        lang === "ja"
          ? "比較レポートは、比較可能か・次に何を見るかを決めるための道具です。"
          : "The comparison report is there to decide whether the plot is comparable and what to inspect next.",
    },
  ]) + `<section class="section"><div class="section-header"><div><div class="eyebrow">${escapeHtml(copyByLang(lang, "固定プロット一覧", "Plot registry", "Registro de parcelas", "Registro de parcelas"))}</div><h2>${escapeHtml(snapshot.site.placeName)}</h2></div></div><div class="list">${plotRows || `<div class="row"><div>${escapeHtml(copyByLang(lang, "固定プロットがまだありません。", "No plots yet.", "No hay parcelas aún.", "Ainda não há parcelas."))}</div></div>`}</div></section>` + reportBlock + rows(
    snapshot.guardrails.map((item) => ({
      title: copyByLang(lang, "守る条件", "Guardrail", "Condición de resguardo", "Condição de resguardo"),
      body: item,
    })),
  );
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
    const page = loadMarketingLongformPage("about", lang);
    const inlineLinkHref = page.inlineLink ? resolveLocalizedHref(basePath, lang, page.inlineLink.href) : undefined;
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      page.title,
      page.eyebrow,
      page.heading,
      page.lead,
      renderMarketingLongformBody(page, basePath, lang),
      page.activeNavKey,
      inlineLinkHref && page.inlineLink ? `<a class="inline-link" href="${escapeHtml(inlineLinkHref)}">${escapeHtml(page.inlineLink.label)}</a>` : undefined,
    );
  });

  app.get("/learn", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const page = loadMarketingLongformPage("learn", lang);
    const inlineLinkHref = page.inlineLink ? resolveLocalizedHref(basePath, lang, page.inlineLink.href) : undefined;
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      page.title,
      page.eyebrow,
      page.heading,
      page.lead,
      renderMarketingLongformBody(page, basePath, lang),
      page.activeNavKey,
      inlineLinkHref && page.inlineLink ? `<a class="inline-link" href="${escapeHtml(inlineLinkHref)}">${escapeHtml(page.inlineLink.label)}</a>` : undefined,
    );
  });

  app.get("/learn/identification-basics", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const page = loadMarketingLongformPage("identification-basics", lang);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      page.title,
      page.eyebrow,
      page.heading,
      page.lead,
      renderMarketingLongformBody(page, basePath, lang),
      page.activeNavKey,
    );
  });

  app.get("/learn/methodology", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "方針と公開の考え方 | ikimon" : "Methodology | ikimon",
      copyByLang(lang, "解説ガイド", "Learn", "Aprender", "Aprender"),
      "透明性は、信頼のためだけでなく学びのためにも必要です。",
      "ikimon は観察データの取り扱い、希少種の位置保護、ライセンス、モニタリング参考インデックスの考え方を公開する。数値は環境の価値を断言するためではなく、継続観察の進み方を対話できるようにするために置く。",
      cards([
        {
          title: isJa ? "データの扱い" : "Data policy",
          body: "ライブスキャン中の映像は AI 判定後に自動削除し、環境音は鳥類判定のためにのみ使う。投稿された観察は将来の open biodiversity data 連携も見据える。",
        },
        {
          title: isJa ? "位置情報の扱い" : "Location handling",
          body: "GPS は生態学的な精度を保ちつつ、希少種はマスク処理し、公開権限に応じて位置精度を制御する。",
        },
        {
          title: "MRI",
          body: "MRI は種の多様性、保全価値、データ信頼性、分類群カバー率、調査継続性の 5 軸を見る参考指標で、良し悪しの断定ではありません。",
        },
      ]) + rows([
        {
          title: "5 軸評価モデル",
          body: "種の多様性 30%、保全価値 25%、データ信頼性 20%、分類群カバー率 15%、調査継続性 10% を掛け合わせて経時変化を見る。",
        },
        {
          title: isJa ? "オープンサイエンスの立場" : "Open science stance",
          body: "市民科学データはブラックボックスの都合で閉じず、条件と限界を公開したうえで future archive として残す。",
        },
        {
          title: isJa ? "法人・公共との関係" : "Business / public relationship",
          body: "企業や自治体にとっても、指標は報告のためだけでなく、場所ごとの変化を見返す共通言語として使う。",
          actionHref: withBasePath(basePath, "/for-business"),
          actionLabel: isJa ? "法人向けを見る" : "For business",
        },
      ]),
      "Learn",
    );
  });

  app.get("/learn/updates", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "更新履歴 | ikimon" : "Updates | ikimon",
      copyByLang(lang, "解説ガイド", "Learn", "Aprender", "Aprender"),
      "観察体験を少しずつ積み上げてきました。",
      "ikimon は一度に全部を変えずに、歩いて・見つけて・書き残す体験が楽になる方向へ、小さく進化してきました。主な節目を時系列で残しておきます。",
      cards([
        {
          title: "2026-04-08 | v0.10.1",
          body: "AI 同定を全面強化しました。写真 1 枚から候補・見分け方・似た種との違いまで、まとめて返せるようになりました。",
        },
        {
          title: "2026-04 | v0.10.0",
          body: "フィールドスキャンにおすすめ調査エリア表示を追加。「次にどこを歩くと発見がありそうか」が地図で分かるようになりました。",
        },
        {
          title: "2026-03-31 | v0.9.0",
          body: "AIレンズと散歩レポートを追加。歩きながら学びが返る体験の入口ができました。",
        },
        {
          title: "2026-03 | v0.8.x",
          body: "鳥の鳴き声アーカイブ、Android 版、BirdNET 連携を追加。写真だけでなく音からの観察も記録できるようになりました。",
        },
        {
          title: "2026-03 | v0.7.x",
          body: "ライブスキャン、ライブマップ、マイ図鑑、自分だけのクエスト、環境メモなどを追加し、場所と再訪を支える基盤を整えました。",
        },
      ]) + rows([
        {
          title: "どう読むと良いか",
          body: "機能追加の履歴ではなく、「自分の学びが育つ」「みんなの観察が AI を育てる」「地域の記録として積み上がる」の 3 つの方向に近づいた順序として読んでいただけると幸いです。",
        },
        {
          title: "実際に触ってみる",
          body: "トップページから、記録・みつける・ホーム・観察の詳細まで、今の体験を一通り確認できます。",
          actionHref: withBasePath(basePath, "/"),
          actionLabel: "トップへ",
        },
      ]),
      "Learn",
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
      "はじめての方、記録・投稿、同定、AI支援、法人利用、データ・プライバシーについて整理しています。",
      cards([
        { title: "はじめての方へ", body: "何から始めれば良いか、最初のステップをご案内します。" },
        { title: "記録・投稿", body: "観察の記録方法、投稿時の注意点、写真の扱いについて。", href: withBasePath(basePath, "/record"), label: lang === "ja" ? "記録する" : "Record" },
        { title: "同定・名前", body: "名前が分からない場合の進め方と、同定精度を上げるコツ。" },
        { title: "AI支援機能", body: "AI候補の見方、根拠、使いどころと限界。" },
        { title: "企業・自治体向け", body: "組織導入時のプラン、出力機能、運用相談の流れ。", href: withBasePath(basePath, "/for-business"), label: lang === "ja" ? "法人向け" : "For Business" },
        { title: "データ・プライバシー", body: "収集する情報、利用目的、公開範囲の考え方。" },
        { title: "科学データ・標本", body: "市民科学データの扱い方針と将来的な連携の考え方。" },
      ]) + rows([
        { title: "個人利用は申し込みが必要か", body: "個人利用は申込不要で、すぐに記録を始められます。" },
        { title: "同定の進め方はどこで確認できるか", body: "同定の進め方と証拠の考え方は「同定の考え方」で確認できます。", actionHref: withBasePath(basePath, "/learn/identification-basics"), actionLabel: lang === "ja" ? "同定の考え方" : "Basics" },
        { title: "データ・プライバシーはどこで確認できるか", body: "データ利用目的と公開範囲の考え方はプライバシーポリシーで確認できます。", actionHref: withBasePath(basePath, "/privacy"), actionLabel: lang === "ja" ? "プライバシー" : "Privacy" },
        { title: "AI支援の方針はどこで確認できるか", body: "AI候補の役割と限界は方針ページにまとめています。", actionHref: withBasePath(basePath, "/learn/methodology"), actionLabel: lang === "ja" ? "方針を見る" : "Methodology" },
        { title: "組織向けプランは何が違うか", body: "全種リストやCSVなど、調査や報告で使う出力機能を含む組織向けのプランです。" },
      ]),
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
      "サービスの運用と改善に必要な範囲で、みなさまのデータを取り扱います。このページでは主なポイントをまとめています。",
      rows([
        { title: "お預かりするもの", body: "アカウント情報、観察記録、アップロードいただいた写真や音声、ご利用時のアクセスログ。" },
        { title: "使い道", body: "観察履歴の表示、同定の補助、サービスの安全な運用、不正対策、機能改善のため。" },
        { title: "個別のお問い合わせ", body: "内容ごとの詳細は、お問い合わせページよりご連絡ください。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
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
      "ご利用にあたってお守りいただきたい事項と、運用上の変更点について要点をまとめています。",
      rows([
        { title: "投稿についてのご確認", body: "投稿していただく内容や写真・音声の権利と公開範囲は、投稿時にご確認をお願いいたします。" },
        { title: "ご遠慮いただく行為", body: "他の方へのご迷惑、不正なアクセス、なりすまし、希少種や保護区など位置情報の不適切な公開はお控えください。" },
        { title: "運用の変更について", body: "サービス改善の過程で、画面構成や URL が変わることがあります。記録済みのデータは引き続きご利用いただけるよう移行いたします。" },
      ]),
      "Learn",
    );
  });

  app.get("/contact", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "お問い合わせ | ikimon" : "Contact | ikimon",
      copyByLang(lang, "お問い合わせ", "Contact", "Contacto", "Contato"),
      "お問い合わせ",
      "ikimon に関するご質問・ご相談はこちらからお寄せください。内容に応じた窓口をご案内します。",
      rows([
        {
          title: "法人・団体のお問い合わせ",
          body: "企業・自治体・学校でのご導入や共同での実証についてのご相談は、下記フォームよりご連絡ください。",
          actionHref: withBasePath(basePath, "/for-business/apply"),
          actionLabel: "法人のお問い合わせ",
        },
        {
          title: "プラン・料金について",
          body: "組織向けプランに含まれる機能と料金の目安をご確認いただけます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "料金を見る",
        },
      ]),
      "Learn",
    );
  });

  app.get("/for-business", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "ikimon 法人向け — 固定プロット再訪モニタリング実証 | ikimon" : "For Business | ikimon",
      isJa ? "法人向け" : "For Business",
      isJa ? "固定プロットの再訪モニタリングを、すぐ始める。" : "Start fixed-plot revisit monitoring quickly.",
      isJa
        ? "現地調査を主、地図と航空写真を補助にして、拠点の変化を継続比較しやすくします。"
        : "Keep field work in the lead, use existing map and air-photo context as support, and make site changes easier to compare over time.",
      cards([
        {
          title: isJa ? "固定プロット比較" : "Fixed-plot comparison",
          body: isJa
            ? "site 配下で plot を決め、baseline と revisit を同じ単位で見返せるようにします。"
            : "Anchor the PoC to explicit plots under one site, then compare baseline and revisit on the same unit.",
          href: appendLangToHref(withBasePath(basePath, "/for-business/demo"), lang),
          label: copyByLang(lang, "デモを見る", "Demo", "Demo", "Demo"),
        },
        {
          title: isJa ? "再訪しやすい記録設計" : "Revisit-ready record design",
          body: isJa
            ? "field note / field scan / fixed-point photo を 1 visit に束ね、比較不能な欠損を先に見える化します。"
            : "Bundle field note, field scan, and fixed-point photo into one visit, then expose missing evidence before it causes confusion.",
        },
        {
          title: isJa ? "共有しやすい比較レポート" : "Shareable comparison report",
          body: isJa
            ? "初回ベースライン、再訪比較、次回調査計画を 1 枚にまとめ、炭素量の約束を混ぜません。"
            : "Keep baseline, revisit diff, and next survey plan in one report without turning the v1 promise into a carbon service.",
        },
      ]) + rows([
        {
          title: isJa ? "Step 1. site と plot を決める" : "Step 1. Choose the site and plots",
          body: isJa
            ? "1 拠点に対して 1-3 plot を決め、固定点と再訪の前提を最初に揃えます。"
            : "Fix the first PoC to 1 site and 1-3 plots, then agree on fixed points and revisit rules first.",
        },
        {
          title: isJa ? "Step 2. visit ごとに証拠を束ねる" : "Step 2. Bundle evidence per visit",
          body: isJa
            ? "現地で残した証拠を 1 visit に集め、比較できる状態かをその場で判断します。"
            : "Bundle field evidence per visit so the team can judge comparability on the spot.",
          actionHref: appendLangToHref(withBasePath(basePath, "/for-business/demo"), lang),
          actionLabel: copyByLang(lang, "デモを見る", "Demo", "Demo", "Demo"),
        },
        {
          title: isJa ? "v1 でやらないこと" : "What v1 does not do",
          body: isJa
            ? "正式炭素量、衛星だけの変化判定、plot 値の site 全体外挿は約束しません。"
            : "V1 does not promise official carbon, satellite-only change detection, or site-wide extrapolation from plot values.",
        },
      ]),
      "For Business",
      businessHeroActions(basePath, lang),
    );
  });

  app.get("/for-business/pricing", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "法人向けの範囲と進め方 | ikimon" : "For Business Scope | ikimon",
      isJa ? "法人向け" : "For Business",
      isJa ? "PoC で先に固定する範囲" : "Scope to lock before the PoC",
      isJa
        ? "最初に決めるのは価格表よりも、1 site・1-3 plot・baseline / revisit / next action が回るかどうかです。"
        : "Before price discussions, lock the unit: 1 site, 1-3 plots, and whether baseline / revisit / next action can run cleanly.",
      rows([
        {
          title: isJa ? "PoC の基本単位" : "Core PoC unit",
          body: isJa
            ? "1 site + 1-3 plot + 初回ベースライン + 再訪比較レポート + 次回調査計画。"
            : "1 site + 1-3 plots + baseline + revisit report + next survey plan.",
        },
        {
          title: isJa ? "この段階で含めないもの" : "Explicitly out of scope",
          body: isJa
            ? "正式炭素量、NDVI/EVI、衛星だけの変化判定、site 全体スコアは v1 に入れません。"
            : "Official carbon, NDVI/EVI, satellite-only change detection, and site-wide scoring stay out of v1.",
        },
        {
          title: isJa ? "見積りの考え方" : "How quoting works",
          body: isJa
            ? "拠点数、観測区画数、再訪頻度、共有レポートの粒度で個別に決めます。まずは相談で前提を整理します。"
            : "Quote by site count, plot count, revisit cadence, and report depth. Start by aligning the assumptions via Apply.",
          actionHref: appendLangToHref(withBasePath(basePath, "/for-business/apply"), lang),
          actionLabel: copyByLang(lang, "相談する", "Apply", "Solicitar", "Solicitar"),
        },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/demo", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    const snapshot = await getMonitoringPocSnapshot(undefined, {
      allowFixture: true,
      preferFixtureWhenEmpty: true,
    });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "法人向けデモ | ikimon" : "For Business Demo | ikimon",
      isJa ? "法人向け" : "For Business",
      isJa ? "固定プロット PoC の見え方" : "How the fixed-plot PoC looks",
      isJa
        ? "営業専用の演出ではなく、固定プロット台帳・訪問プロトコル・比較レポートの材料を同じ流れで見せます。"
        : "Instead of a sales-only mock, this demo shows the plot registry, visit protocol, and comparison report payload on the same flow.",
      renderMonitoringDemoBody(snapshot, lang),
      "For Business",
      businessHeroActions(basePath, lang),
    );
  });

  app.get("/for-business/status", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "法人向けステータス | ikimon" : "For Business Status | ikimon",
      isJa ? "法人向け" : "For Business",
      isJa ? "v1 の boundary" : "V1 boundary",
      isJa
        ? "何が ready で、何を次 gate に送るかをここで固定します。"
        : "This is where the team fixes what is ready now and what stays behind the next gate.",
      rows([
        {
          title: isJa ? "Ready now" : "Ready now",
          body: isJa
            ? "固定プロット比較、再訪しやすい記録設計、比較レポート共有までは v1 の約束にできます。"
            : "Fixed-plot comparison, revisit-ready records, and shareable comparison reports are inside the v1 promise.",
        },
        {
          title: isJa ? "Not in v1" : "Not in v1",
          body: isJa
            ? "正式炭素量、衛星だけの変化判定、plot 値の site 全体外挿はこの段階で出しません。"
            : "Official carbon, satellite-only change detection, and site-wide extrapolation from plot values stay out of this release.",
        },
        {
          title: isJa ? "Next gate" : "Next gate",
          body: isJa
            ? "構造化 tree census を internal lane に足し、そこで初めて carbon proxy の研究実証 gate を開きます。"
            : "The next gate adds structured tree census to the internal lane before any carbon-proxy research claim opens.",
        },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/apply", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const isJa = lang === "ja";
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      isJa ? "法人向け相談窓口 | ikimon" : "For Business Apply | ikimon",
      isJa ? "法人向け" : "For Business",
      isJa ? "1 拠点の初回モニタリングを始める" : "Start the first site-level monitoring PoC",
      isJa
        ? "相談時点で必要なのは site 情報と、何を再訪比較したいかだけです。炭素量前提の要件はこの PoC の対象外です。"
        : "At the Apply step, all we need is the target site and what the team wants to revisit and compare. Carbon-first requirements stay out of this PoC.",
      rows([
        {
          title: isJa ? "Step 1. 対象 site" : "Step 1. Target site",
          body: isJa
            ? "敷地、公園、緑地、拠点周辺など、最初に 1 site を決めます。"
            : "Pick the first site: a facility, park, green patch, or nearby grounds.",
        },
        {
          title: isJa ? "Step 2. 何を再訪比較したいか" : "Step 2. What to revisit and compare",
          body: isJa
            ? "林縁の変化、管理介入前後、季節差など、比較したい問いを 1 本に絞ります。"
            : "Narrow the first question to one thread: edge changes, before/after management, or seasonal differences.",
          actionHref: appendLangToHref(withBasePath(basePath, "/for-business/demo"), lang),
          actionLabel: copyByLang(lang, "デモを見る", "Demo", "Demo", "Demo"),
        },
        {
          title: isJa ? "Step 3. 欲しい成果物" : "Step 3. Output needed",
          body: isJa
            ? "初回ベースライン、再訪比較レポート、次回調査計画の 3 点で足りるかを確認します。"
            : "Confirm whether the first baseline, revisit report, and next survey plan are enough for the team.",
        },
        {
          title: isJa ? "次のステップ" : "Next step",
          body: isJa
            ? "ご相談フォーム準備中のため、現状は総合お問い合わせから受け付けています。"
            : "The dedicated form is still being replaced, so use the main contact route for now.",
          actionHref: appendLangToHref(withBasePath(basePath, "/contact"), lang),
          actionLabel: isJa ? "お問い合わせへ" : "Contact",
        },
      ]),
      "For Business",
      businessHeroActions(basePath, lang),
    );
  });
}
