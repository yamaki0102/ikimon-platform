import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
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

function editorialSections(
  items: Array<{
    eyebrow?: string;
    title: string;
    lead?: string;
    paragraphs: string[];
    bullets?: string[];
    actionHref?: string;
    actionLabel?: string;
  }>,
): string {
  if (items.length === 0) return "";
  return `<section class="section mkt-editorial">
    <style>
      .mkt-editorial .stack { display: grid; gap: 18px; }
      .mkt-editorial .block { padding: 24px 28px; }
      .mkt-editorial .block h2 { margin: 8px 0 12px; font-size: clamp(22px, 2vw, 28px); line-height: 1.35; letter-spacing: -.02em; color: #0f172a; }
      .mkt-editorial .lead { margin: 0 0 14px; font-size: 15px; font-weight: 700; line-height: 1.7; color: #1e293b; }
      .mkt-editorial .block p { margin: 0 0 12px; font-size: 15px; line-height: 1.8; color: #475569; }
      .mkt-editorial .block p:last-child { margin-bottom: 0; }
      .mkt-editorial .block ul { margin: 14px 0 0 18px; padding: 0; display: grid; gap: 8px; color: #475569; }
      .mkt-editorial .block li { line-height: 1.7; }
    </style>
    <div class="stack">${items
      .map(
        (item) => `<article class="card is-soft block">
          ${item.eyebrow ? `<div class="eyebrow">${escapeHtml(item.eyebrow)}</div>` : ""}
          <h2>${escapeHtml(item.title)}</h2>
          ${item.lead ? `<p class="lead">${escapeHtml(item.lead)}</p>` : ""}
          ${item.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          ${item.bullets?.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
          ${item.actionHref ? `<div class="actions" style="margin-top:14px"><a class="btn btn-ghost" href="${escapeHtml(item.actionHref)}">${escapeHtml(item.actionLabel ?? "Open")}</a></div>` : ""}
        </article>`,
      )
      .join("")}</div>
  </section>`;
}

function businessHeroActions(basePath: string, lang: SiteLang): string {
  const applyHref = appendLangToHref(withBasePath(basePath, "/for-business/apply"), lang);
  const demoHref = appendLangToHref(withBasePath(basePath, "/for-business/demo"), lang);
  return `<div class="actions">
    <a class="btn btn-solid" data-kpi-action="for_business_apply" href="${escapeHtml(applyHref)}">${escapeHtml("Apply")}</a>
    <a class="btn btn-ghost-on-dark" data-kpi-action="for_business_demo" href="${escapeHtml(demoHref)}">${escapeHtml("Demo")}</a>
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
          <div class="row"><div><strong>${escapeHtml("Field evidence")}</strong><div class="meta">${escapeHtml(firstReport.fieldEvidence.fieldNoteSummary ?? (lang === "ja" ? "未記録" : "Pending"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml("Site condition")}</strong><div class="meta">${escapeHtml(firstReport.siteCondition.latest ?? (lang === "ja" ? "未記録" : "Pending"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml("Revisit diff")}</strong><div class="meta">${escapeHtml(firstReport.revisitDiff.summary)}</div></div></div>
          <div class="row"><div><strong>${escapeHtml("Imagery context")}</strong><div class="meta">${escapeHtml(firstReport.imageryContext.note ?? (lang === "ja" ? "地図・航空写真は背景文脈のみ" : "Map and air photo stay in the context lane"))}</div></div></div>
          <div class="row"><div><strong>${escapeHtml("Next action")}</strong><div class="meta">${escapeHtml(firstReport.nextAction ?? (lang === "ja" ? "未設定" : "Pending"))}</div></div></div>
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
  ]) + `<section class="section"><div class="section-header"><div><div class="eyebrow">${escapeHtml(lang === "ja" ? "plot registry" : "Plot registry")}</div><h2>${escapeHtml(snapshot.site.placeName)}</h2></div></div><div class="list">${plotRows || `<div class="row"><div>${escapeHtml(lang === "ja" ? "plot がまだありません。" : "No plots yet.")}</div></div>`}</div></section>` + reportBlock + rows(
    snapshot.guardrails.map((item) => ({
      title: lang === "ja" ? "Guardrail" : "Guardrail",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimonの想い — 自然が、子どもとまちを結ぶ | ikimon" : "About | ikimon",
      lang === "ja" ? "ikimonについて" : "About",
      "自然が、子どもとまちを結ぶ。",
      "小さな自然観察を、やらされる行動ではなく、暮らしや旅の中で自然につながる営みにしていくためのプロジェクトです。",
      cards([
        {
          title: "いつもの散歩道にも、つづきがある",
          body: "特別な遠出でなくても、毎日通る道の 1 枚が、あとで季節や時間の違いを感じる入口になります。",
        },
        {
          title: "旅先の 1 枚も、別の来訪者とつながる",
          body: "ある人が撮った景色に、別の人が違う季節や時間に 1 枚重ねる。その重なり自体に価値があります。",
        },
        {
          title: "AI は答えを押しつけない",
          body: "ikimon の AI は「ここを見て」「この特徴に注目して」とヒントを返す役割にとどまります。最後に決めるのは人です。",
        },
        {
          title: "見方が 1 つ増えるだけでいい",
          body: "散歩や旅行を観測義務に変えるのではなく、既にある行動に視点を 1 つ足す。そのくらいの温度感を大切にしています。",
        },
        {
          title: "まちの解像度が上がると、愛着も上がる",
          body: "近所の緑地や道端を見比べる材料が少しずつ増えると、地域の見え方そのものが変わっていきます。",
        },
        {
          title: "続ける理由は、外から押しつけない",
          body: "続けたくなるかどうかは、本人の発見や手応えから生まれるべきだと考えています。ikimon はその下支えをします。",
        },
      ]) +
        editorialSections([
          {
            eyebrow: "Place-first",
            title: "なぜ同じ場所や同じあたりの 1 枚に価値があるのか",
            lead: "比較の義務があるからではなく、前回のつづきや場所の変化が見えやすくなるからです。",
            paragraphs: [
              "いつもの散歩道なら、前に気づかなかった花の時期や、木陰の雰囲気、鳥の集まり方の違いが見えてきます。毎回きっちり同じ構図でなくても、同じあたりから 1 枚あるだけで、あとから見比べる入口になります。",
              "旅先でも価値の出方は同じです。ある旅行者が春に残した景色に、別の旅行者が秋の光や水の量を重ねると、その場所の厚みが増します。1 人が何度も通わなくても、場所の記録はつながっていきます。",
              "ikimon が大事にしたいのは、\"同じ構図をノルマのように撮るべき\" という圧ではなく、\"この 1 枚があるとあとで面白い\" という気づきです。価値はあとから見返したときに立ち上がることが多いので、最初から完璧さを要求しません。",
            ],
          },
          {
            eyebrow: "AI as hint",
            title: "AI は、観察のつづきを一緒に考える役割にとどめる",
            lead: "AI が返すのは命令ではなく、候補・理由・次の一手です。",
            paragraphs: [
              "たとえば写真から種を断言できないときも、ikimon は \"ここがまだ写っていない\" \"この候補同士はここを見ると分かれやすい\" といったヒントを返します。正解を上から置くより、観察者が次に判断しやすくなることを優先します。",
              "同じ場所の記録についても、AI は \"今度また通るなら同じあたりから 1 枚あると違いが見えやすい\" のように小さな提案だけを出します。やるかどうかは本人が決める前提で、強制や点数化はしません。",
              "専門家による正式な確認が必要な場面は別 lane に分けます。日常の観察、AI の候補、専門家レビューの責任境界を混ぜないことが、押しつけ感を減らしつつ信頼を保つ条件だと考えています。",
            ],
          },
          {
            eyebrow: "Why it stays gentle",
            title: "続ける理由は、発見と手応えのほうから育てる",
            lead: "続けること自体を褒めるより、前より分かる・前より見える感覚を返すほうを重視します。",
            paragraphs: [
              "散歩や旅行を、ミッションやノルマの連続にすると長続きしません。ikimon は streak や義務感より、\"この前より見分けられた\" \"この場所の空気が読めるようになった\" という小さな自己効力感を大切にします。",
              "そのために必要なのは、大きな説教よりも、いまの記録から自然に言える次のヒントです。葉の裏を撮る、全景を足す、同じあたりからもう 1 枚撮る。そういう無理のない提案を積み重ねます。",
              "だから About でも、公益や監視の話を最初に置きません。まずは自分の散歩や旅が少し豊かになること。その先に、ほかの人や未来の自分とつながる意味が出てくる順番を守ります。",
            ],
            actionHref: withBasePath(basePath, "/learn/identification-basics"),
            actionLabel: "撮り方と同定の考え方を読む",
          },
        ]) +
        rows([
          {
            title: "同じ場所の 1 枚が役立つ場面",
            body: "いつもの散歩道、学校や職場の近く、旅先の遊歩道、公園の池、毎年通る神社や海辺。再訪でも別の来訪者でも、場所の記録はつながります。",
          },
          {
            title: "まず何を読むと良いか",
            body: "撮り方・断定しない理由・AI の役割から読み始めると、ikimon の温度感がつかみやすくなります。",
            actionHref: withBasePath(basePath, "/learn/identification-basics"),
            actionLabel: "同定の考え方へ",
          },
          {
            title: "データと公開の考え方",
            body: "位置情報、公開範囲、AI と専門家の責任境界は Methodology に整理しています。",
            actionHref: withBasePath(basePath, "/learn/methodology"),
            actionLabel: "Methodology",
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
      "解説ガイド一覧",
      "自然と社会、健康と学び、そして「同じような場所や構図の 1 枚にどんな価値があるか」を、具体例から読めるように整理しています。",
      cards([
        {
          title: "いつもの散歩道で見えてくること",
          body: "同じ道でも、季節や時間で何が変わるのか。身近な場所の 1 枚が持つ意味を解説します。",
        },
        {
          title: "旅先や別の来訪者とつながる記録",
          body: "違う人が違うタイミングで同じ場所を撮ることに、なぜ価値があるのかを整理します。",
        },
        {
          title: "組織導入と分析",
          body: "自治体・学校・企業での導入観点、指標、運用設計を確認できます。",
          href: withBasePath(basePath, "/for-business"),
          label: lang === "ja" ? "法人向け" : "For Business",
        },
      ]) +
        editorialSections([
          {
            eyebrow: "Learn cluster",
            title: "Learn は、理解を深めるための層として残す",
            lead: "入口の主役ではないが、ikimon を信用して使い続けるためにはここが必要です。",
            paragraphs: [
              "ここでは、同じ場所の記録がなぜ意味を持つのか、AI がどこまでヒント役に徹するのか、そしてデータがどう扱われるのかを、順番に読めるようにします。トップの勢いだけでは伝わりきらない前提を、押しつけずに補うのが Learn の役目です。",
              "コンテンツマーケティングとしても、Learn は単なる記事置き場ではありません。初学者の不安を減らし、ikimon の思想と責任境界を伝え、検索から来た人にも \"ここは何を大切にしているサービスか\" が分かる状態を作ります。",
              "だから、短いスローガンだけで終わらせません。読むと判断しやすくなる、撮りやすくなる、次に何を見ればいいか分かる。その実用性がある説明だけを残していきます。",
            ],
          },
          {
            eyebrow: "Concrete scenes",
            title: "このガイド群が扱うのは、机上の理念より現地で起きる迷いです",
            lead: "散歩中・旅行中・あとで見返すときの迷いに答える構成に寄せます。",
            paragraphs: [
              "いつもの散歩道なら、\"また同じところを撮る意味はあるのか\" という迷いがあります。Learn では、同じ構図を義務にせず、同じあたりから 1 枚あると何が見えてくるかを具体例で伝えます。",
              "旅行なら、\"一度しか行かないけれど記録する意味はあるのか\" という問いが出ます。そこで、別の来訪者や未来の自分の記録とつながる価値を説明します。",
              "同定が難しいときは、\"なぜ種まで行けないのか\" と \"次にどこを撮れば進むのか\" が分からないまま終わりがちです。AI の候補表示だけでなく、その理由と次の一手まで読めるようにします。",
            ],
          },
          {
            eyebrow: "What to read first",
            title: "最初に読むべきものは、種名辞典ではなく撮り方と考え方です",
            lead: "知識を増やす前に、観察が前進しやすくなる順番を優先します。",
            paragraphs: [
              "ikimon の Learn は encyclopedia ではなく、field mentor に近い面です。まずは撮り方、AI の役割、断定しない理由を押さえる。そのあとで Methodology や法人向けの説明に進むほうが自然です。",
              "この順番にしておくと、説明が長くても押しつけになりにくい。なぜなら、読むことで \"今の自分が少しやりやすくなる\" からです。役に立たない長文は置かず、次の行動につながるものだけを残します。",
            ],
          },
        ]) +
        rows([
          {
            title: "同定の考え方",
            body: "断定しない理由、次に見るべきポイント、そして AI がどこまでヒント役に徹するか。",
            actionHref: withBasePath(basePath, "/learn/identification-basics"),
            actionLabel: lang === "ja" ? "読む" : "Basics",
          },
          {
            title: "ikimon の想い",
            body: "同じ場所の 1 枚、旅先で残す 1 枚、そして押しつけない継続設計の考え方をまとめています。",
            actionHref: withBasePath(basePath, "/about"),
            actionLabel: lang === "ja" ? "About" : "About",
          },
          {
            title: "Methodology（方針）",
            body: "データ方針、位置情報の扱い、公開の前提と限界。",
            actionHref: withBasePath(basePath, "/learn/methodology"),
            actionLabel: lang === "ja" ? "確認する" : "Methodology",
          },
          {
            title: "アップデート",
            body: "機能追加を単なる更新履歴ではなく、観察体験の温度感がどう整ってきたかとして整理。",
            actionHref: withBasePath(basePath, "/learn/updates"),
            actionLabel: lang === "ja" ? "見る" : "Updates",
          },
          {
            title: "組織導入と分析",
            body: "市民向けの動機づけとは分けて、 monitoring と report の導線を法人向けに整理しています。",
            actionHref: withBasePath(basePath, "/for-business"),
            actionLabel: lang === "ja" ? "法人向け" : "For Business",
          },
        ]),
      "Learn",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/about"))}">ikimon について読む</a>`,
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
      "同定は、いきなり正解を断言することだけが目的ではありません。",
      "観察をまず残すこと、そのうえで AI が候補と次の手がかりを返すこと、専門家の同定はそれとは別の場所で扱うこと。この 3 つを混ぜないのが ikimon の方針です。",
      cards([
        {
          title: "種まで絞り込めないとき",
          body: "写真の角度、部位の写っていない部分、幼体や季節による姿の違い、近い仲間との共通点が多い種では、属までで止める方が正確なことがあります。",
        },
        {
          title: "AI が返す候補の役割",
          body: "AI は「正解」ではなく、候補の種・見分けるポイント・次に撮ると分かりやすい部位を返します。最後に決めるのは観察者ご自身です。",
        },
        {
          title: "専門家によるレビュー",
          body: "より厳密な同定や確認は、専門家向けの別画面で扱います。日常の観察とは分けているので、一般のご利用では気にする必要はありません。",
          href: withBasePath(basePath, "/specialist/id-workbench"),
          label: "専門家向け画面を開く",
        },
      ]) +
        editorialSections([
          {
            eyebrow: "Start with evidence",
            title: "まず残す。断定は、そのあとでいい",
            lead: "最初の 1 枚に求めるのは完璧さより、あとで考えられる材料です。",
            paragraphs: [
              "野外では、光の向き、動き、距離、葉陰、幼体か成体かといった条件で、どうしても写りきらない部分が出ます。その場で種まで決まらないのは珍しいことではありません。",
              "だから ikimon は、\"今はここまで\" を前向きに扱います。属までで止める、候補を数個に絞る、追加で見るべき部位を知る。その積み重ねのほうが、無理に断言するより信頼できます。",
              "同じ場所をまた通るなら、同じあたりからもう 1 枚あるだけで前回の疑問が解けることがあります。再訪は義務ではありませんが、前回のつづきを自分で拾いやすくする方法として提案できます。",
            ],
          },
          {
            eyebrow: "How to shoot",
            title: "撮るなら、全景・本体・決め手の 3 層を意識すると進みやすい",
            lead: "全部を完璧に撮る必要はありません。どの層が足りないかが分かるだけでも次につながります。",
            paragraphs: [
              "全景は、どこにいたかを教えてくれます。葉の上なのか、水辺なのか、木の幹なのか。周辺の環境は、候補を考えるときの大きな手がかりです。",
              "本体の全体像は、形や大きさの見当を付けるために役立ちます。さらに余裕があれば、翅の脈、葉の裏、花の付け根、腹部、樹皮の質感など、決め手になる部位を足します。",
            ],
            bullets: [
              "1 枚目は、見つけた場所ごと残すつもりで全景を撮る",
              "2 枚目は、体全体や葉全体が入るように寄る",
              "3 枚目は、迷っている候補を分けそうな部位を撮る",
              "もう一度通るなら、同じあたりから 1 枚足しておくと見比べやすい",
            ],
          },
          {
            eyebrow: "AI boundary",
            title: "AI が返すのは、候補と理由と次の一手まで",
            lead: "AI を答えとして使うのではなく、観察を前に進めるヒントとして使います。",
            paragraphs: [
              "ikimon の AI は、似た候補の違い、まだ足りない証拠、次に撮ると進みやすい部位を返します。ここが production の学習ヒントと同じ大前提です。",
              "一方で、正式な確定や専門的なレビューが必要な場面は別 lane で扱います。観察者の画面では、\"一緒に絞る\" ことに徹し、責任を曖昧にしません。",
              "だから、AI が候補を返しても焦る必要はありません。候補と理由を読み、やってみたくなれば追加で撮る。そのくらいの距離感で十分です。",
            ],
          },
        ]) +
        rows([
          {
            title: "撮り直しで確度が上がる例",
            body: "葉の裏、翅の脈、腹部、花の付け根、全景と接写の組み合わせなど、決め手になる部位が 1 枚増えるだけで候補を絞りやすくなります。",
          },
          {
            title: "ikimon が返したいもの",
            body: "種名だけでなく、まだ断定しない理由、似た候補、次に何を撮れば進みやすいか、そして同じ場所の 1 枚にどんな意味があるか。",
          },
          {
            title: "最初の一歩",
            body: "まず 1 件記録してみる。完璧な同定でなくて構いません。あとで見返せる 1 枚があるだけで、次に見たいポイントが生まれます。",
            actionHref: withBasePath(basePath, "/record"),
            actionLabel: "記録する",
          },
        ]),
      "Learn",
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
      "透明性は、信頼のためだけでなく学びのためにも必要です。",
      "ikimon は観察データの取り扱い、希少種の位置保護、ライセンス、モニタリング参考インデックスの考え方を公開する。数値は環境の価値を断言するためではなく、継続観察の進み方を対話できるようにするために置く。",
      cards([
        {
          title: "Data policy",
          body: "ライブスキャン中の映像は AI 判定後に自動削除し、環境音は鳥類判定のためにのみ使う。投稿された観察は将来の open biodiversity data 連携も見据える。",
        },
        {
          title: "Location handling",
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
          title: "Open science stance",
          body: "市民科学データはブラックボックスの都合で閉じず、条件と限界を公開したうえで future archive として残す。",
        },
        {
          title: "Business / public との関係",
          body: "企業や自治体にとっても、指標は報告のためだけでなく、場所ごとの変化を見返す共通言語として使う。",
          actionHref: withBasePath(basePath, "/for-business"),
          actionLabel: "For business",
        },
      ]),
      "Learn",
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
        { title: "同定の進め方はどこで確認できるか", body: "同定の進め方と証拠の考え方は Identification Basics で確認できます。", actionHref: withBasePath(basePath, "/learn/identification-basics"), actionLabel: lang === "ja" ? "同定の考え方" : "Basics" },
        { title: "データ・プライバシーはどこで確認できるか", body: "データ利用目的と公開範囲の考え方は Privacy で確認できます。", actionHref: withBasePath(basePath, "/privacy"), actionLabel: lang === "ja" ? "プライバシー" : "Privacy" },
        { title: "AI支援の方針はどこで確認できるか", body: "AI候補の役割と限界は Methodology にまとめています。", actionHref: withBasePath(basePath, "/learn/methodology"), actionLabel: "Methodology" },
        { title: "Public は何が違うか", body: "全種リストやCSVなど、調査や報告で使う出力機能を含む組織向けのプランです。" },
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
      "Contact | ikimon",
      "Contact",
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
      isJa ? "ikimon for Business — 固定プロット再訪モニタリング PoC | ikimon" : "For Business | ikimon",
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
          label: "Demo",
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
          actionLabel: "Demo",
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
      "For Business Scope | ikimon",
      "For Business",
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
            ? "site 数、plot 数、再訪頻度、共有レポートの粒度で個別に決めます。まずは Apply で前提を整理します。"
            : "Quote by site count, plot count, revisit cadence, and report depth. Start by aligning the assumptions via Apply.",
          actionHref: appendLangToHref(withBasePath(basePath, "/for-business/apply"), lang),
          actionLabel: "Apply",
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
      "For Business Demo | ikimon",
      "For Business",
      isJa ? "固定プロット PoC の見え方" : "How the fixed-plot PoC looks",
      isJa
        ? "営業専用の演出ではなく、plot registry / visit protocol / comparison report payload を同じ流れで見せます。"
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
      "For Business Status | ikimon",
      "For Business",
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
      "For Business Apply | ikimon",
      "For Business",
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
          actionLabel: "Demo",
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
