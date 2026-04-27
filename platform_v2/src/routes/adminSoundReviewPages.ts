import type { FastifyInstance } from "fastify";
import { listReviewQueue, type ReviewStatus } from "../services/audioReview.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import { renderSiteDocument } from "../ui/siteShell.js";
import {
  SOUND_REVIEW_SCRIPT,
  SOUND_REVIEW_STYLES,
  renderSoundReviewBody,
} from "../ui/admin/soundReview.js";

const VALID_STATUSES: ReadonlyArray<ReviewStatus | "any"> = [
  "ai_candidate",
  "needs_review",
  "confirmed",
  "published",
  "rejected",
  "any",
];

function loginGate(): string {
  return `
<div style="max-width:520px;margin:64px auto;padding:24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;font-family:-apple-system,system-ui,sans-serif;">
  <h2 style="margin-top:0;">音声クラスタレビューは管理者専用</h2>
  <p style="color:#555;font-size:14px;">レビューにはアナリストまたは管理者ロールでログインしてください。</p>
  <p style="font-size:13px;"><a href="/login?next=${encodeURIComponent("/admin/sound-review")}">ログインへ</a></p>
</div>
`;
}

/**
 * /admin/sound-review — Phase 2 admin UI
 *
 * 音声クラスタを一覧 → 代表音再生 → taxon 確定 → label 伝播の流れを画面化。
 * Admin / Analyst ロールのセッションのみ。API は同セッションを再利用。
 */
export async function registerAdminSoundReviewPagesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{
    Querystring: { status?: string; limit?: string };
  }>("/admin/sound-review", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(
      () => null,
    );
    reply.type("text/html; charset=utf-8");

    if (
      !session ||
      session.banned ||
      !isAdminOrAnalystRole(session.roleName, session.rankLabel)
    ) {
      reply.code(403);
      return renderSiteDocument({
        basePath: "",
        title: "音声クラスタレビュー — ikimon.life",
        extraStyles: SOUND_REVIEW_STYLES,
        body: loginGate(),
      });
    }

    const rawStatus = (request.query.status ?? "needs_review") as ReviewStatus | "any";
    const status: ReviewStatus | "any" = VALID_STATUSES.includes(rawStatus)
      ? rawStatus
      : "needs_review";
    const limit = Number(request.query.limit ?? "50");

    const clusters = await listReviewQueue({
      status,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    const body = renderSoundReviewBody({
      clusters,
      status,
      reviewerUserId: session.userId,
      authVia: "session",
      totalCount: clusters.length,
    });

    return renderSiteDocument({
      basePath: "",
      title: "音声クラスタレビュー — ikimon.life",
      extraStyles: SOUND_REVIEW_STYLES,
      body: `${body}<script>${SOUND_REVIEW_SCRIPT}</script>`,
    });
  });
}
