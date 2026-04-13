import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function layout(basePath: string, title: string, eyebrow: string, heading: string, lead: string, body: string, activeNav: string): string {
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    hero: {
      eyebrow,
      heading,
      lead,
      actions: [
        { href: "/record", label: "Record" },
        { href: "/explore", label: "Explore", variant: "secondary" },
        { href: "/for-business", label: "For Business", variant: "secondary" },
      ],
    },
    body,
    footerNote: "shared website shell on staging. design, transitions, and page hierarchy should be checked here before live rehearsal.",
  });
}

function cards(items: Array<{ title: string; body: string; href?: string; label?: string }>): string {
  return `<section class="section"><div class="grid">${items
    .map(
      (item) => `<div class="card">
        <div class="eyebrow">ikimon v2</div>
        <h2>${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.body)}</p>
        ${item.href ? `<div class="actions" style="margin-top:12px"><a class="btn primary" href="${escapeHtml(item.href)}">${escapeHtml(item.label ?? "Open")}</a></div>` : ""}
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
        ${item.actionHref ? `<a class="btn primary" href="${escapeHtml(item.actionHref)}">${escapeHtml(item.actionLabel ?? "Open")}</a>` : ""}
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
      return reply.redirect(withBasePath(basePath, targetPath), 308);
    });
  }

  app.get("/about", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "About | ikimon v2",
      "About",
      "観察を、学びと地域の記録基盤に変える。",
      "ikimon.life は、自分が学ぶこと、みんなの AI を育てること、そしてまだ十分に知られていない生物多様性の理解に寄与することを一つの行動ループにまとめる。",
      cards([
        {
          title: "続ける動機",
          body: "記録すると自分の変化が見え、場所ごとの比較ができ、次の観察理由が増える。単発の投稿ではなく再訪の理由を残す。",
        },
        {
          title: "Collective AI Growth Loop",
          body: "一件ずつの観察と同定が、個人の学びだけでなく、みんなの AI がより良い候補と根拠を返す材料になる。",
        },
        {
          title: "Place-first",
          body: "種だけでなく場所を主語にして、自治体・学校・企業・地域団体があとで見返せる記録基盤にする。",
        },
      ]),
      "Learn",
    );
  });

  app.get("/learn", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Learn | ikimon v2",
      "Learn",
      "見る目が育つと、また行きたくなる。",
      "ikimon の Learn は content marketing を消すための置き場ではなく、観察・再訪・同定の考え方を深める hub です。入口は protagonist-first のまま保ちつつ、必要なときにだけ深く読めるようにする。",
      cards([
        {
          title: "About ikimon",
          body: "ikimon の思想、地域性、Field Mentor / Long-term Observatory の意味を読む。",
          href: withBasePath(basePath, "/about"),
          label: "Open about",
        },
        {
          title: "FAQ",
          body: "個人利用、Public、切替中の v2 の見方など、まず詰まりやすい点を解消する。",
          href: withBasePath(basePath, "/faq"),
          label: "Open FAQ",
        },
        {
          title: "Identification basics",
          body: "なぜ今は species まで行けないか、AI 提案と expert lane をどう分けるか、再撮影が価値になる理由を読む。",
          href: withBasePath(basePath, "/learn/identification-basics"),
          label: "Open basics",
        },
        {
          title: "Methodology",
          body: "データ方針、希少種の位置精度、MRI の考え方、透明性の前提を確認する。",
          href: withBasePath(basePath, "/learn/methodology"),
          label: "Open methodology",
        },
        {
          title: "Updates",
          body: "Perch v2、AI レンズ、サウンドアーカイブなど、既存アップデート資産を時系列で追う。",
          href: withBasePath(basePath, "/learn/updates"),
          label: "Open updates",
        },
      ]) + rows([
        {
          title: "観察の目を育てる",
          body: "答えの即時提示だけでなく、見分けポイント、似た種、次に撮るべき証拠を返す設計にする。",
        },
        {
          title: "個人から collective へつながる",
          body: "入口は自分の発見と成長だが、改善された観察と review は future AI explanation の学習資産にもなる。",
        },
        {
          title: "既存コンテンツは捨てない",
          body: "About / FAQ / guides / methodology / updates などの資産は Learn 配下に再編し、SEO と理解促進に使い続ける。",
        },
      ]),
      "Learn",
    );
  });

  app.get("/learn/identification-basics", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Identification Basics | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Methodology | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Updates | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "FAQ | ikimon v2",
      "FAQ",
      "まず確認されること",
      "無料で使える範囲、企業向け導線、データの扱い、切替中の v2 についての簡易 FAQ。",
      rows([
        {
          title: "個人利用は申し込みが必要か",
          body: "個人利用と Community のグループページは申込不要。すぐに記録を始められる。",
        },
        {
          title: "Public は何が違うか",
          body: "全種リスト、CSV、証跡レポートなど、調査・報告に使う出力機能を含む有料プラン。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "Pricing",
        },
        {
          title: "いまの v2 は何を確認できるか",
          body: "Record / Explore / Home / Observation Detail / Profile と readiness の確認ができる。",
          actionHref: withBasePath(basePath, "/"),
          actionLabel: "Preview",
        },
      ]),
      "Learn",
    );
  });

  app.get("/privacy", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Privacy Policy | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Terms | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Contact | ikimon v2",
      "Contact",
      "問い合わせの入口",
      "企業導入、Public プラン、改善相談、パイロット検討の入口を v2 側に固定する。",
      rows([
        {
          title: "Implementation / pilot inquiry",
          body: "導入相談、共同パイロット、運用改善の相談は for-business/apply から受け付ける。",
          actionHref: withBasePath(basePath, "/for-business/apply"),
          actionLabel: "Apply",
        },
        {
          title: "Public plan / pricing",
          body: "Public で提供する出力機能と適用範囲を確認する。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "Pricing",
        },
      ]),
      "Learn",
    );
  });

  app.get("/for-business", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "For Business | ikimon v2",
      "For Business",
      "場所の記録基盤を、導入しやすくする。",
      "Community から始め、必要な組織だけ Public の出力機能や導入相談へ進める。若年女性減少率 80% 以上を目安に、最も記録基盤が必要な地域には無償提供も含めて検討する。",
      cards([
        {
          title: "Pricing",
          body: "Public が含む全種リスト、CSV、証跡レポートなどの出力機能を確認。",
          href: withBasePath(basePath, "/for-business/pricing"),
          label: "Open pricing",
        },
        {
          title: "Demo",
          body: "組織向け導線の確認用 preview。必要に応じて staging での確認に繋げる。",
          href: withBasePath(basePath, "/for-business/demo"),
          label: "Open demo",
        },
        {
          title: "Status",
          body: "切替・導入 readiness・パイロット相談の前提を確認。",
          href: withBasePath(basePath, "/for-business/status"),
          label: "Open status",
        },
        {
          title: "Apply",
          body: "導入相談・共同パイロット・改善相談の入口。",
          href: withBasePath(basePath, "/for-business/apply"),
          label: "Open apply",
        },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/pricing", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "For Business Pricing | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "For Business Demo | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "For Business Status | ikimon v2",
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
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "For Business Apply | ikimon v2",
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
