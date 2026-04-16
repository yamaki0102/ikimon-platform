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
      lang === "ja" ? "ikimonについて — 近くの自然との関係を深める | ikimon" : "About | ikimon",
      lang === "ja" ? "ikimonについて" : "About",
      "近くの自然との関係を、少しずつ深めていく。",
      "ikimon は、地元の人がいつもの場所を記録し、読み返し、また行きたくなる理由を育てるための place-first product です。",
      cards([
        {
          title: "主役は地元の人",
          body: "いちばん大事にしている利用者は、たまたま来た人ではなく、その場所の近くで暮らし続ける人です。",
        },
        {
          title: "主役は種名当てではなく再訪",
          body: "1 回の正解より、前回との差分を持って同じ場所に戻れることを価値の中心に置いています。",
        },
        {
          title: "自分が学び、みんなの AI も育つ",
          body: "観察の質が上がるほど、自分の見分け方が育ち、その積み重ねが将来の候補提示や説明にも効いていきます。",
        },
        {
          title: "断定より、証拠を残す",
          body: "急いで種まで言い切るより、場所・時刻・写真・メモを残して、あとから見返せる状態を優先します。",
        },
        {
          title: "長い時間のアーカイブにする",
          body: "今日の記録を、その場限りの投稿ではなく、将来の研究や地域理解にも使える長期アーカイブとして扱います。",
        },
        {
          title: "結果として地域理解も深まる",
          body: "地域や組織への価値は大事ですが、それは place-first の観察ループが続いた結果として生まれるものだと考えています。",
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
          body: "v2 の public 面を、フィールドノート中心の導線へ寄せました。主役を record / notes / revisit に固定しています。",
        },
        {
          title: "2026-04 | v0.10.0",
          body: "フィールドスキャンで、次に歩く場所を考えるための map lane を整備しました。探索はノートに戻るための補助線として扱います。",
        },
        {
          title: "2026-03-31 | v0.9.0",
          body: "AIレンズの入口を追加しました。現時点では完成機能としてではなく、将来の walking-time guide へつながる入口として置いています。",
        },
        {
          title: "2026-03 | v0.8.x",
          body: "写真や音を含む観察の証拠を、あとから見返せる形で残す方向を強めました。入力の幅を広げるための基盤整備です。",
        },
        {
          title: "2026-03 | v0.7.x",
          body: "場所・再訪・個人の記録を中心に据えるための初期導線を整えました。探索系の機能は、この軸を支える位置に置いています。",
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
      "はじめての方、記録、同定、AI の役割、組織導入、データと公開範囲について、ikimon の前提を整理しています。",
      cards([
        { title: "はじめての方へ", body: "何から始めれば良いか、最初のステップをご案内します。" },
        { title: "記録・投稿", body: "観察の記録方法、投稿時の注意点、写真の扱いについて。", href: withBasePath(basePath, "/record"), label: lang === "ja" ? "記録する" : "Record" },
        { title: "同定・名前", body: "名前が分からない場合の進め方と、同定精度を上げるコツ。" },
        { title: "AI支援機能", body: "AI は候補提示であり、正解確定マシンではないという前提。" },
        { title: "企業・自治体向け", body: "自然共生サイトや観察導線を、どう小さく始めるか。", href: withBasePath(basePath, "/for-business"), label: lang === "ja" ? "法人向け" : "For Business" },
        { title: "データ・プライバシー", body: "何を預かり、何を公開し、どこを保護するかの考え方。" },
        { title: "科学データ・標本", body: "長期アーカイブと open biodiversity data への接続をどう考えるか。" },
      ]) + rows([
        { title: "個人利用は申し込みが必要か", body: "個人利用は申込不要で、すぐに記録を始められます。" },
        { title: "同定の進め方はどこで確認できるか", body: "同定の進め方と証拠の考え方は Identification Basics で確認できます。", actionHref: withBasePath(basePath, "/learn/identification-basics"), actionLabel: lang === "ja" ? "同定の考え方" : "Basics" },
        { title: "データ・プライバシーはどこで確認できるか", body: "データ利用目的と公開範囲の考え方は Privacy で確認できます。", actionHref: withBasePath(basePath, "/privacy"), actionLabel: lang === "ja" ? "プライバシー" : "Privacy" },
        { title: "AI支援の方針はどこで確認できるか", body: "AI候補の役割と限界は Methodology にまとめています。", actionHref: withBasePath(basePath, "/learn/methodology"), actionLabel: "Methodology" },
        { title: "組織向けでは何が違うか", body: "場所単位で観察を始める導線、継続運用、必要な出力や相談のレーンが加わります。" },
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
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Contact | ikimon",
      "Contact",
      "お問い合わせ",
      "ikimon に関するご質問や導入相談を受け付けています。個人利用と組織導入で窓口を分けています。",
      rows([
        {
          title: "個人利用・データに関するお問い合わせ",
          body: "ログイン、投稿、公開範囲、データ削除や取り扱いに関する相談はこちらからご連絡ください。",
        },
        {
          title: "法人・団体のお問い合わせ",
          body: "企業・自治体・学校で、自然共生サイトや観察導線を始めたい場合はこちらです。",
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
      "自然共生サイトの観察を、すばやく始めて続けやすくする。",
      "学校・自治体・企業が、敷地や地域の自然を place-first に記録し、初回観察会から継続運用まで立ち上げやすい導線を用意しています。",
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
          title: "最初の価値",
          body: "初回観察会を動かし、場所単位の記録を残し、次にまた見に行く理由を作ることを優先します。",
        },
        {
          title: "なぜこの設計か",
          body: "いきなり分析だけを売るのではなく、場所と運用の立ち上がりを先に成立させるためです。",
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
          title: "導入設計の背景",
          body: "なぜ site quickstart と継続運用を先に置くのか、その考え方を確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: lang === "ja" ? "導入を見る" : "Rationale",
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
        { title: "まず無料で始める", body: "観察投稿、同定、図鑑、観察会の立ち上がりまでは無料で始められます。申込不要です。" },
        { title: "必要になったら追加する", body: "全種リスト、CSV、証跡レポートなど、継続運用や調査報告に必要な機能を段階的に追加できます。" },
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
