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
      "原体験から始まった、小さな自然観察をまちの営みにつなげるためのプロジェクトです。",
      cards([
        {
          title: "原体験",
          body: "幼少期の小さな発見が、自然との距離を縮め、学びの入口になります。",
        },
        {
          title: "まちの解像度が上がると、愛着も上がる",
          body: "近所の緑地や道端での観察が積み上がると、地域の見え方が変わっていきます。",
        },
        {
          title: "なぜ、地域創生なのか",
          body: "自然を記録して見返す行為が、地域の関係人口と継続的な関わりを生みます。",
        },
        {
          title: "子どもだけじゃない。大人もイキイキしていないと",
          body: "世代を問わず、自然との接点があることで日常の楽しさと学びが増えます。",
        },
        {
          title: "消滅可能性自治体",
          body: "地域の魅力を再発見し、地元に目を向けるきっかけを増やすことが重要です。",
        },
        {
          title: "持続可能なかたち",
          body: "一過性のイベントではなく、記録と再訪の循環を続けられる設計を重視しています。",
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
      "自然と社会、健康と学び、組織導入と分析まで、ikimonの読みものを分野ごとに整理しています。",
      cards([
        {
          title: "自然と社会",
          body: "地域の自然観察が、暮らしやまちづくりにどうつながるかを解説します。",
        },
        {
          title: "健康と学び",
          body: "観察活動が健康・教育・継続学習に与える価値を紹介します。",
        },
        {
          title: "組織導入と分析",
          body: "自治体・学校・企業での導入観点、指標、運用設計を確認できます。",
          href: withBasePath(basePath, "/for-business"),
          label: lang === "ja" ? "法人向け" : "For Business",
        },
      ]) + rows([
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
      "観察をまず残すこと、そのうえで AI が候補と次の手がかりを返すこと、専門家の同定はそれとは別の場所で扱うこと。この3つを混ぜないのが ikimon の方針です。",
      cards([
        {
          title: "種まで絞り込めないとき",
          body: "写真の角度、部位の写っていない部分、幼体や季節による姿の違い、近い仲間との共通点が多い種では、属までで止める方が正確なことがあります。",
        },
        {
          title: "AI が返す候補の役割",
          body: "AI は「正解」ではなく、候補の種・見分けるポイント・次に撮りたい部位を返します。最後に決めるのは観察者ご自身です。",
        },
        {
          title: "専門家によるレビュー",
          body: "より厳密な同定や確認は、専門家向けの別画面で扱います。日常の観察とは分けているので、一般のご利用では気にする必要はありません。",
          href: withBasePath(basePath, "/specialist/id-workbench"),
          label: "専門家向け画面を開く",
        },
      ]) + rows([
        {
          title: "撮り直しで確度が上がる例",
          body: "葉の裏、翅の脈、腹部、花の付け根、全景と接写の組み合わせなど、決め手になる部位を追加すると候補を絞りやすくなります。",
        },
        {
          title: "ikimon が返したいもの",
          body: "種名だけでなく、まだ断定しない理由、似た候補、次に何を撮れば進むか、そしてその場所にまた行きたくなる理由。",
        },
        {
          title: "最初の一歩",
          body: "まず 1 件記録してみる。完璧な同定でなくて構いません。観察と再訪を重ねることで、少しずつ見えるものが変わっていきます。",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimon for Business — 組織で支える、近くの自然" : "For Business | ikimon",
      lang === "ja" ? "法人向け" : "For Business",
      "観察会や地域の記録を、続けやすくする。",
      "観察記録の収集から、報告書の出力まで。学校・自治体・企業で継続運用しやすい導線を用意しています。",
      cards([
        {
          title: "観察記録の収集から、報告書の出力まで",
          body: "現場の記録を集め、整理し、共有・報告につなげるまでを一つの流れで支援します。",
          href: withBasePath(basePath, "/for-business/demo"),
          label: lang === "ja" ? "デモを見る" : "Demo",
        },
        {
          title: "どんな団体を想定しているか",
          body: "自治体、学校、企業、NPOなど、地域で自然観察を継続したい組織を対象にしています。",
        },
        {
          title: "プランの設計について",
          body: "Community / Public の違いと、運用段階に応じた導入ステップを確認できます。",
          href: withBasePath(basePath, "/for-business/pricing"),
          label: lang === "ja" ? "料金を見る" : "Pricing",
        },
        {
          title: "3つのプラン",
          body: "導入規模や目的に応じて、段階的に選べる構成。",
        },
        {
          title: "なぜこの料金設計なのか",
          body: "継続運用と現場負担のバランスを優先した設計です。",
        },
        {
          title: "よくある質問",
          body: "導入前に確認したい点を先に整理できます。",
          href: withBasePath(basePath, "/faq"),
          label: "FAQ",
        },
        {
          title: "導入相談も、共同実証の相談も歓迎しています。",
          body: "要件整理、試験導入、共同実証までお気軽に相談ください。",
          href: withBasePath(basePath, "/for-business/apply"),
          label: lang === "ja" ? "相談する" : "Apply",
        },
      ]) + rows([
        {
          title: "料金設計の背景",
          body: "継続運用と現場負担のバランスを優先した設計思想を確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: lang === "ja" ? "設計思想" : "Pricing rationale",
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
      "プランと料金のご案内",
      "まずは無料でお試しいただき、調査や報告で追加機能が必要になった段階で有料プランをご検討いただけます。現在のご利用状況と必要な出力をおうかがいしながら、最適な構成をご提案します。",
      rows([
        { title: "コミュニティ(無料)", body: "観察投稿、同定、図鑑、観察会への参加までを無料でご利用いただけます。お申し込みは不要です。" },
        { title: "パブリック(有料)", body: "全種リスト、CSV 出力、証跡レポートなど、調査・報告のために必要な機能を揃えた有料プランです。" },
        { title: "ご相談", body: "導入の設計や、学校・自治体などへの無償提供の対象については、下記よりお気軽にお問い合わせください。", actionHref: withBasePath(basePath, "/for-business/apply"), actionLabel: "お問い合わせ" },
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
      "実際の画面でお確かめください",
      "専用の営業デモではなく、実際にお使いいただく画面を触っていただく形でご案内しています。下記からご覧いただくと、実務での使い方のイメージが掴めます。",
      rows([
        { title: "観察を広く見る", body: "最近の観察と場所ごとのまとまりを確認できます。", actionHref: withBasePath(basePath, "/explore"), actionLabel: "みつける画面へ" },
        { title: "記録する画面", body: "写真と位置から観察を 1 件記録するまでの流れをご確認いただけます。", actionHref: withBasePath(basePath, "/record"), actionLabel: "記録画面へ" },
        { title: "運用状況の確認", body: "サービスの健全性とデータ整合性を確認できるページです。", actionHref: withBasePath(basePath, "/ops/readiness"), actionLabel: "運用状況へ" },
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
      "ikimon の稼働状況とデータの健全性をご確認いただけます。公開環境での最新状況を定期的に更新しています。",
      rows([
        { title: "データの整合性", body: "従来システムとの比較チェック、および本番想定でのリハーサルを複数回実施し、いずれも問題なく完了しています。" },
        { title: "運用面の準備", body: "本番切替に向けた各種チェックを進めており、現時点では予定どおり準備が整っています。" },
        { title: "次の予定", body: "旧サイトのページを順次新しい画面に切り替えていきます。切替後は従来ページもしばらくバックアップとして残します。" },
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
      "ご導入のご相談、共同での実証、ご要望などを受け付けています。個人のご利用・無料コミュニティプランはお申し込み不要です。",
      rows([
        { title: "お問い合わせの種類", body: "ご導入のご相談、共同実証のご提案、機能改善のご要望など、該当するものをお知らせください。" },
        { title: "対象となる場所", body: "観察を実施したい敷地、公園・緑地、拠点周辺など、対象のエリアをお教えください。" },
        { title: "ご希望のプラン", body: "無料のコミュニティから始められるか、調査・報告用のパブリックをご希望かをお知らせください。" },
        { title: "次のステップ", body: "ご連絡フォームをご用意するまで、下記の総合お問い合わせから受け付けております。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
      ]),
      "For Business",
    );
  });
}
