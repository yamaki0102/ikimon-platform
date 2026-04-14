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
  const intro = `<section class="section"><div class="card"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(heading)}</h1><p class="meta">${escapeHtml(lead)}</p>${afterActionsHtml ? `<div style="margin-top:12px">${afterActionsHtml}</div>` : ""}</div></section>`;
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    lang,
    currentPath,
    body: intro + body,
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

function cards(items: Array<{ title: string; body: string; href?: string; label?: string }>): string {
  return `<section class="section"><div class="grid">${items
    .map(
      (item) => `<div class="card">
        <div class="eyebrow">ikimon</div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.body)}</p>
        ${item.href ? `<div class="actions" style="margin-top:12px"><a class="btn btn-ghost" href="${escapeHtml(item.href)}">${escapeHtml(item.label ?? "Open")}</a></div>` : ""}
      </div>`,
    )
    .join("")}</div></section>`;
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
      "同定は、いきなり正解を断言するためだけにあるわけではない。",
      "ikimon では observation-first を保ち、一般ユーザーと AI の候補提示は『次に何を見ればよいか』を返す lane に置く。formal ID や確定に近い判断は expert lane で扱い、両者を同じ重さで見せない。",
      cards([
        {
          title: "なぜ species まで行けないことがあるか",
          body: "写真の角度、部位不足、幼体・季節差、近縁種の形質重なりがあると、属止めや higher rank の方が evidence に忠実です。",
        },
        {
          title: "AI suggestion の役割",
          body: "AI は official truth ではなく、候補・根拠・見分けポイント・次に撮るべき証拠を返す補助です。一般導線ではこの役割を超えさせません。",
        },
        {
          title: "Expert lane の役割",
          body: "review queue や id workbench は、より formal な確認や review を扱う別 lane です。public の主導線には薄く出し、一般利用と混線させません。",
          href: withBasePath(basePath, "/specialist/id-workbench"),
          label: "Open expert lane",
        },
      ]) + rows([
        {
          title: "再撮影で確度が上がる例",
          body: "葉の裏、翅脈、腹部、花の基部、全景と接写の組み合わせなど、決め手になる証拠を追加すると候補が狭まる。",
        },
        {
          title: "ikimon が返すべきもの",
          body: "species 名だけでなく、なぜまだ断定しないか、似た候補、次に何を撮れば進むか、またその場所へ行きたくなる理由。",
        },
        {
          title: "最初の一歩",
          body: "まずは記録する。最初から完璧な同定でなくても、証拠と再訪のループが学びを育てる。",
          actionHref: withBasePath(basePath, "/record"),
          actionLabel: "Record now",
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
      "観察体験は、少しずつ積み上げてきた。",
      "既存の updates 資産は捨てず、Field Mentor と Long-term Observatory の方向へつながる変化として読み直す。ここでは主要な進化だけを時系列で残す。",
      cards([
        {
          title: "2026-04-08 | v0.10.1",
          body: "AI 考察を全面強化。写真だけで候補提示、見分け方、似た種との差、安定性改善まで一気に整理した。",
        },
        {
          title: "2026-04 | v0.10.0",
          body: "Field scan に Perch v2 を導入し、おすすめ調査エリア表示を追加。地域でどこを先に見に行くかを示し始めた。",
        },
        {
          title: "2026-03-31 | v0.9.0",
          body: "AI lens と散歩レポートを追加。歩きながら学びが返る Field Mentor 方向が見え始めた。",
        },
        {
          title: "2026-03 | v0.8.x",
          body: "サウンドアーカイブ、Android 版、BirdNET 連携で、写真以外の観察入口も広げた。",
        },
        {
          title: "2026-03 | v0.7.x",
          body: "ライブスキャン、ライブマップ、マイ図鑑、クエスト、環境文脈保存を進め、場所と再訪の基盤を作った。",
        },
      ]) + rows([
        {
          title: "どう読むべきか",
          body: "単なる機能追加の履歴ではなく、『自分が学ぶ』『みんなの AI を育てる』『場所の記録基盤にする』へ近づいた順に見る。",
        },
        {
          title: "次に見る場所",
          body: "現在の v2 preview では explore / record / home / detail / specialist shell まで確認できる。",
          actionHref: withBasePath(basePath, "/"),
          actionLabel: "Open preview",
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
        { title: "はじめての方へ", body: "まず何から始めるか、個人利用の入口と基本導線を案内します。" },
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
      "Privacy Policy",
      "サインイン維持、フォーム送信、安全な運用、改善のために必要な範囲でデータを扱う。ここでは v2 public surface 用の短い要約を返す。",
      rows([
        { title: "保持するもの", body: "アカウント情報、観察記録、アップロード資産、セッションと操作ログ。" },
        { title: "使い道", body: "観察履歴の再表示、同定補助、運用保守、不正対策、サービス改善。" },
        { title: "問い合わせ", body: "個別の確認は contact から受け付ける。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "Contact" },
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
      "Terms",
      "利用中の記録、投稿、アップロード、公開範囲、禁止行為に関する要点を v2 public surface 向けに簡略表示する。",
      rows([
        { title: "投稿責任", body: "投稿内容とアップロード素材の権利と公開範囲は利用者が確認する。" },
        { title: "禁止行為", body: "他者への迷惑行為、不正アクセス、なりすまし、危険種や保護地点の不適切公開。" },
        { title: "運用変更", body: "切替期間中は UI や URL が変更されることがあるが、データ移行と互換性を優先する。" },
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
      "問い合わせの入口",
      "導入相談、Public プランの確認、改善相談などをまとめて受けるための入口です。",
      rows([
        {
          title: "導入相談・パイロット相談",
          body: "組織導入や共同パイロットの相談は apply から受け付けます。",
          actionHref: withBasePath(basePath, "/for-business/apply"),
          actionLabel: "Apply",
        },
        {
          title: "Public plan / pricing",
          body: "組織向けプランで使える出力機能と適用範囲を確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "Pricing",
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
      "Community から Public へ上げる基準を明確にする。",
      "Community は無料で始め、Public では調査・報告に使う出力機能を提供する。導入時は現在の運用と必要な出力から逆算する。",
      rows([
        { title: "Community", body: "観察投稿・同定・図鑑・観察会参加まで無料。申し込み不要。" },
        { title: "Public", body: "全種リスト、CSV、証跡レポートなど、調査・報告に使う出力機能を提供する有料プラン。" },
        { title: "相談", body: "導入設計や無償提供対象の確認は apply から。", actionHref: withBasePath(basePath, "/for-business/apply"), actionLabel: "Apply" },
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
      "デモ確認の入口",
      "営業用の重い専用画面ではなく、実際の v2 lane を薄く案内しながら業務導線を確認できる形にする。",
      rows([
        { title: "Explore lane", body: "最近の観察と場所クラスターを確認。", actionHref: withBasePath(basePath, "/explore"), actionLabel: "Explore" },
        { title: "Record lane", body: "最小観察入力と写真アップロードを確認。", actionHref: withBasePath(basePath, "/record"), actionLabel: "Record" },
        { title: "Readiness", body: "切替前の health / parity / drift の確認。", actionHref: withBasePath(basePath, "/ops/readiness"), actionLabel: "Readiness" },
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
      "運用 readiness の要点",
      "v2 は mirror-only rehearsal と write compatibility の確認が済んでおり、公開面の置換と archive mode を残している。",
      rows([
        { title: "Data parity", body: "legacy verify と cutover rehearsal は mirror-only 経路で green。" },
        { title: "Operational readiness", body: "drift report 再計算後の readiness は near_ready。" },
        { title: "Next focus", body: "public の .php 導線を v2 側へ移し、PHP を rollback artifact に下げる。" },
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
      "Implementation / pilot inquiry",
      "導入相談、共同パイロット、改善相談をここに集約する。個人利用や無料 Community は申込不要で、必要なときだけ Public や相談へ案内する。",
      rows([
        { title: "Inquiry type", body: "導入相談、共同パイロット、改善相談から近いものを選ぶ想定。" },
        { title: "Site / area", body: "観測したい敷地、緑地帯、公園、拠点周辺などを記載。" },
        { title: "Plan entry", body: "Community から開始か、Public 出力機能を前提にするかを確認。" },
        { title: "Next step", body: "本番フォーム置換までは contact 導線と運用案内の固定面として扱う。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "Contact" },
      ]),
      "For Business",
    );
  });
}
