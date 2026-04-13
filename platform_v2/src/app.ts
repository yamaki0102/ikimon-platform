import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWriteRoutes } from "./routes/write.js";
import { escapeHtml, renderSiteDocument } from "./ui/siteShell.js";

type PreviewContext = {
  basePath: string;
  userId: string;
  occurrenceId: string;
  usesDemoFixture: boolean;
  stats: {
    observationCount: number;
    speciesCount: number;
    placeCount: number;
  };
};

function buildFlowLink(basePath: string, href: string, label: string, note: string): string {
  return `<a class="card" href="${escapeHtml(withBasePath(basePath, href))}">
    <div class="eyebrow">qa lane</div>
    <h2>${escapeHtml(label)}</h2>
    <p>${escapeHtml(note)}</p>
    <span>Open</span>
  </a>`;
}

function buildLandingRootHtml(options: PreviewContext): string {
  const recordHref = options.userId
    ? withBasePath(options.basePath, `/record?userId=${encodeURIComponent(options.userId)}`)
    : withBasePath(options.basePath, "/record");
  const homeHref = options.userId
    ? withBasePath(options.basePath, `/home?userId=${encodeURIComponent(options.userId)}`)
    : withBasePath(options.basePath, "/home");
  const detailHref = options.occurrenceId
    ? withBasePath(options.basePath, `/observations/${encodeURIComponent(options.occurrenceId)}`)
    : withBasePath(options.basePath, "/explore");

  return renderSiteDocument({
    basePath: options.basePath,
    title: "ikimon.life — いつもの散歩が、少しだけ冒険になる",
    activeNav: "Home",
    hero: {
      eyebrow: "ikimon life",
      heading: "いつもの散歩が、少しだけ冒険になる。",
      lead: "見つけたものを残しておくと、次に歩くとき、少し見え方が変わる。",
      align: "center",
      supplementHtml: `
        ${options.stats.observationCount > 0 ? `<div class="hero-metric-strip">
          <span class="hero-metric"><strong>${options.stats.observationCount.toLocaleString()}</strong> 件の観察</span>
          <span class="hero-metric-dot"></span>
          <span class="hero-metric"><strong>${options.stats.speciesCount.toLocaleString()}</strong> 種を確認</span>
          <span class="hero-metric-dot"></span>
          <span class="hero-metric"><strong>${options.stats.placeCount.toLocaleString()}</strong> か所</span>
        </div>` : ""}
        <div class="hero-chip-row">
          <span class="hero-chip">ひとりでも始められる</span>
          <span class="hero-chip">歩く理由がひとつ増える</span>
          <span class="hero-chip">同じ場所をあとで比べやすい</span>
        </div>
      `,
      actions: [
        { href: recordHref, label: "観察をはじめる" },
        { href: "/explore", label: "近くの発見を見る", variant: "secondary" },
      ],
    },
    body: `<section class="section">
      <div class="grid">
        <div class="card">
          <div class="eyebrow">today</div>
          <h2>まず、記録してみる</h2>
          <p>名前が分からなくても大丈夫。場所と時間と写真があれば十分です。</p>
          <div class="actions" style="margin-top:14px">
            <a class="btn btn-solid" href="${escapeHtml(recordHref)}">Record</a>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">season</div>
          <h2>次に見るべきものが分かる</h2>
          <p>あとで見返すと、次は何を見ればよいかが少しずつ返ってきます。</p>
          <div class="actions" style="margin-top:14px">
            <a class="btn btn-ghost" href="${escapeHtml(detailHref)}">Observation Detail</a>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">later</div>
          <h2>また行きたくなる</h2>
          <p>同じ場所を比べると、季節の変化が見えてきます。</p>
          <div class="actions" style="margin-top:14px">
            <a class="btn btn-ghost" href="${escapeHtml(homeHref)}">My Trail</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="card" style="padding:32px 28px;background:linear-gradient(135deg,#163821,#1b5f34 60%,#3a8c5a);color:white;border-color:transparent">
        <div class="eyebrow" style="color:rgba(255,255,255,.7)">field mentor</div>
        <h2 style="margin:10px 0 12px;font-size:26px;line-height:1.18;font-family:'Shippori Mincho','Yu Mincho',serif;max-width:680px">自分が学ぶことと、みんなの AI を育てることが、ひとつの行動になる。</h2>
        <p style="margin:0;color:rgba(255,255,255,.84);line-height:1.75;max-width:640px;font-size:15px">
          ひとつひとつの観察は自分の学びであり、場所の記録であり、未来の候補提示を良くする材料でもあります。
        </p>
      </div>
    </section>

    <section class="section">
      <div class="grid">
        <div class="card">
          <div class="eyebrow">learn</div>
          <h2>考え方を読む</h2>
          <p>About、FAQ、同定の考え方、Methodology を後から読めます。</p>
          <div class="actions" style="margin-top:14px">
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(options.basePath, "/learn"))}">Learn</a>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">for business</div>
          <h2>企業・自治体向け</h2>
          <p>場所の記録基盤を、組織の運用に合わせて導入できます。</p>
          <div class="actions" style="margin-top:14px">
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(options.basePath, "/for-business"))}">For Business</a>
          </div>
        </div>
      </div>
    </section>`,
    footerNote: "ikimon.life v2 — Save what you found nearby and revisit it, place by place.",
  });
}

function buildQASiteMapHtml(options: PreviewContext): string {
  const recordHref = options.userId
    ? `/record?userId=${encodeURIComponent(options.userId)}`
    : "/record";
  const homeHref = options.userId
    ? `/home?userId=${encodeURIComponent(options.userId)}`
    : "/home";
  const profileHref = options.userId
    ? `/profile/${encodeURIComponent(options.userId)}`
    : "/profile";
  const detailHref = options.occurrenceId
    ? `/observations/${encodeURIComponent(options.occurrenceId)}`
    : "/explore";

  return renderSiteDocument({
    basePath: options.basePath,
    title: "ikimon v2 staging QA site map",
    activeNav: "Home",
    hero: {
      eyebrow: "staging qa",
      heading: "ページ遷移と確認面を、1枚で把握する。",
      lead: "本番リハーサル前の人間確認用マップです。デザイン確認だけでなく、どの導線がどこへ繋がるか、どこが 401/redirect/JSON になるかまで staging 上で一巡できます。",
      actions: [
        { href: "/", label: "Preview top" },
        { href: recordHref, label: "Start at record", variant: "secondary" },
        { href: "/for-business", label: "Check business", variant: "secondary" },
      ],
    },
    body: `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 1</div>
          <h2>Core User Journey</h2>
          <p>記録して、詳細を見て、プロフィールと explore で再訪理由を確認する主導線。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, recordHref, "Record", options.userId ? "staging user 付きで観察追加を確認。" : "user context が無いと 401 になる。")}
        ${buildFlowLink(options.basePath, detailHref, "Observation Detail", options.occurrenceId ? "最新 observation の詳細と identification を確認。" : "fixture が無い場合は explore に退避。")}
        ${buildFlowLink(options.basePath, homeHref, "Home", options.userId ? "My places と recent observations を確認。" : "userId が無い場合は共通 home shell を確認。")}
        ${buildFlowLink(options.basePath, profileHref, "Profile", options.userId ? "同じ user の places / observations を確認。" : "session か userId 前提の画面。")}
        ${buildFlowLink(options.basePath, "/explore", "Explore", "横断の一覧面。municipality / top taxa / recent observations を確認。")}
      </div>
      <div class="note">推奨確認順: <code>Record → Observation Detail → Home → Profile → Explore</code></div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 2</div>
          <h2>Public / Trust / Business</h2>
          <p>公開面の印象と、business 導線が old PHP URL に落ちず v2 で閉じるかを見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/about", "About", "思想、動機設計、Collective AI Growth Loop の見せ方を確認。")}
        ${buildFlowLink(options.basePath, "/faq", "FAQ", "個人利用、Public、v2 確認範囲の FAQ を確認。")}
        ${buildFlowLink(options.basePath, "/privacy", "Privacy", "trust page の最低限表示を確認。")}
        ${buildFlowLink(options.basePath, "/terms", "Terms", "利用条件の最低限表示を確認。")}
        ${buildFlowLink(options.basePath, "/contact", "Contact", "contact から business apply に繋がるか確認。")}
        ${buildFlowLink(options.basePath, "/for-business", "For Business", "business の親ページ。pricing / demo / status / apply へ分岐。")}
        ${buildFlowLink(options.basePath, "/for-business/pricing", "Pricing", "Community と Public の差が読めるか確認。")}
        ${buildFlowLink(options.basePath, "/for-business/demo", "Demo", "Explore / Record / Readiness の業務確認導線。")}
        ${buildFlowLink(options.basePath, "/for-business/status", "Status", "readiness の業務向け説明面。")}
        ${buildFlowLink(options.basePath, "/for-business/apply", "Apply", "導入相談の固定面。フォーム置換前の見せ方を確認。")}
      </div>
      <div class="note">redirect check も重要です。<code>/about.php</code>, <code>/for-business.php</code>, <code>/for-business/apply.php</code> が v2 path に寄るか確認対象です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 3</div>
          <h2>Specialist Review</h2>
          <p>thin entry ではなく、review read/action が v2 側で回るかを見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/specialist/id-workbench", "ID Workbench", "default lane の queue と action form を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/id-workbench?lane=public-claim", "Public Claim Lane", "public claim 用 lane 表示を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/id-workbench?lane=expert-lane", "Expert Lane", "expert lane の queue と action を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/review-queue", "Review Queue", "review sample と approve / reject / note を確認。")}
      </div>
      <div class="note">旧 URL の <code>/id_workbench.php</code> と <code>/review_queue.php</code> は redirect 確認対象です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 4</div>
          <h2>Ops / Release Gate</h2>
          <p>人間のデザイン確認と、切替前判定面を混ぜずに見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/ops/readiness", "Ops Readiness", "near_ready / drift / rollback safety の確認。")}
        ${buildFlowLink(options.basePath, "/healthz", "Health", "service health endpoint の確認。")}
      </div>
      <div class="note">ブラウザ確認はこの page map と public/core/specialist を優先し、JSON endpoint は最後に health/readiness だけ見れば十分です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">checklist</div>
          <h2>人間確認で見るべきこと</h2>
          <p>MECE に漏れなく、リハーサル前に潰すべき観点だけ絞る。</p>
        </div>
      </div>
      <div class="list">
        <div class="row"><strong>Visual</strong><div class="meta">hero / card / button の崩れ、英日混在、CTA 密度、モバイル幅での詰まり。</div></div>
        <div class="row"><strong>Transition</strong><div class="meta">主要導線が 200 / redirect / 401 の想定どおりか。迷子導線や dead end がないか。</div></div>
        <div class="row"><strong>State</strong><div class="meta">userId あり/なし、occurrence あり/なしで説明不足や壊れ方が雑でないか。</div></div>
        <div class="row"><strong>Legacy drift</strong><div class="meta">旧 PHP URL が v2 に寄るか。公開導線から PHP surface に着地しないか。</div></div>
        <div class="row"><strong>Release gate</strong><div class="meta">最後に <code>/ops/readiness</code> と <code>/healthz</code> を見て、デザイン確認と運用確認を切り分ける。</div></div>
      </div>
    </section>`,
    footerNote: "staging walkthrough for full-page QA. use this after the shared shell migration to inspect actual website movement and visual consistency.",
  });
}

async function getPreviewContext(): Promise<PreviewContext> {
  const pool = getPool();
  const demoUserQuery = `
    select user_id
    from users
    where user_id like 'sample-cadence-%-user'
       or user_id like 'staging-session-smoke-%-user'
       or user_id like 'staging-write-smoke-%-user'
    order by created_at desc
    limit 1
  `;
  const demoOccurrenceQuery = `
    select occurrence_id
    from occurrences
    where occurrence_id like 'occ:sample-cadence-%'
       or occurrence_id like 'occ:staging-session-smoke-%'
       or occurrence_id like 'occ:staging-write-smoke-%'
    order by created_at desc
    limit 1
  `;
  const latestUserQuery = `
    select user_id
    from users
    order by created_at desc
    limit 1
  `;
  const latestOccurrenceQuery = `
    select occurrence_id
    from occurrences
    order by created_at desc
    limit 1
  `;
  const statsQuery = `
    select
      (select count(*) from occurrences)::int as observation_count,
      (select count(distinct scientific_name) from occurrences where scientific_name is not null and scientific_name <> '')::int as species_count,
      (select count(*) from places)::int as place_count
  `;

  const [demoUser, demoOccurrence, latestUser, latestOccurrence, statsResult] = await Promise.all([
    pool.query<{ user_id: string }>(demoUserQuery),
    pool.query<{ occurrence_id: string }>(demoOccurrenceQuery),
    pool.query<{ user_id: string }>(latestUserQuery),
    pool.query<{ occurrence_id: string }>(latestOccurrenceQuery),
    pool.query<{ observation_count: number; species_count: number; place_count: number }>(statsQuery),
  ]);

  const userId = demoUser.rows[0]?.user_id ?? latestUser.rows[0]?.user_id ?? "";
  const occurrenceId = demoOccurrence.rows[0]?.occurrence_id ?? latestOccurrence.rows[0]?.occurrence_id ?? "";

  const row = statsResult.rows[0];
  return {
    basePath: "",
    userId,
    occurrenceId,
    usesDemoFixture: Boolean(demoUser.rows[0]?.user_id || demoOccurrence.rows[0]?.occurrence_id),
    stats: {
      observationCount: row?.observation_count ?? 0,
      speciesCount: row?.species_count ?? 0,
      placeCount: row?.place_count ?? 0,
    },
  };
}

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async (request, reply) => {
    const accept = String(request.headers.accept ?? "");
    if (accept.includes("text/html")) {
      const context = await getPreviewContext();
      context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
      reply.type("text/html; charset=utf-8");
      return buildLandingRootHtml(context);
    }

    return {
      service: "ikimon-platform-v2",
      status: "bootstrapping",
    };
  });

  app.get("/qa/site-map", async (request, reply) => {
    const context = await getPreviewContext();
    context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    reply.type("text/html; charset=utf-8");
    return buildQASiteMapHtml(context);
  });

  void registerHealthRoutes(app);
  void registerMarketingRoutes(app);
  void registerOpsRoutes(app);
  void registerReadRoutes(app);
  void registerWriteRoutes(app);

  return app;
}
