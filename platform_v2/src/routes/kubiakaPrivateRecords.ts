import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadConfig } from "../config.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { kubiakaPrivateRecordsCopy } from "../services/kubiakaPrivateRecordsCopy.js";
import { createLegacyMediaObjectStore } from "../services/mediaObjectStore.js";
import {
  KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT,
  listOwnedKubiakaRecords,
  readOwnedKubiakaAcknowledgement,
  readOwnedKubiakaPrivateMedia,
  readOwnedKubiakaRecordDetail,
  readOwnedKubiakaRecordOverview,
  type KubiakaPrivateAcknowledgement,
  type KubiakaPrivateMediaLocator,
  type KubiakaPrivateRecordDetail,
  type KubiakaPrivateRecordOverview,
  type KubiakaPrivateRecordPage,
} from "../services/kubiakaPrivateRecordsReadModel.js";
import {
  KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX,
  KUBIAKA_PRIVATE_RECORD_MEDIA_PREFIX,
  KUBIAKA_PRIVATE_RECORDS_PATH,
  renderKubiakaPrivateDocument,
  renderKubiakaPrivateRecordDetail,
  renderKubiakaPrivateRecordList,
  renderKubiakaPrivateRecordNotFound,
  renderKubiakaPrivateRecordsHome,
} from "./kubiakaPrivateRecordsView.js";

const KUBIAKA_MEMBER_PATH = "/kubiaka/me";

type KubiakaSession = { userId: string };

export type KubiakaPrivateRecordsRouteDependencies = {
  getSession(request: FastifyRequest): Promise<KubiakaSession | null>;
  readOverview(userId: string): Promise<KubiakaPrivateRecordOverview>;
  readPage(userId: string): Promise<KubiakaPrivateRecordPage>;
  readDetail(visitId: string, userId: string): Promise<KubiakaPrivateRecordDetail | null>;
  readAcknowledgement(recordId: string, userId: string): Promise<KubiakaPrivateAcknowledgement | null>;
  readMedia(visitId: string, photoIndex: number, userId: string): Promise<KubiakaPrivateMediaLocator | null>;
  readPrivateBuffer(locator: KubiakaPrivateMediaLocator): Promise<Buffer>;
};

const defaultDependencies: KubiakaPrivateRecordsRouteDependencies = {
  async getSession(request) {
    const cookie = Array.isArray(request.headers.cookie) ? request.headers.cookie[0] : request.headers.cookie;
    const session = await getSessionFromCookie(cookie);
    return session ? { userId: session.userId } : null;
  },
  readOverview: readOwnedKubiakaRecordOverview,
  readPage: (userId) => listOwnedKubiakaRecords(userId, undefined, KUBIAKA_PRIVATE_RECORD_PAGE_LIMIT),
  readDetail: readOwnedKubiakaRecordDetail,
  readAcknowledgement: readOwnedKubiakaAcknowledgement,
  readMedia: readOwnedKubiakaPrivateMedia,
  async readPrivateBuffer(locator) {
    const config = loadConfig();
    return createLegacyMediaObjectStore({
      publicRoot: config.legacyPublicRoot,
      privateRoot: config.legacyDataRoot,
    }).read({ visibility: "private", storagePath: locator.storagePath });
  },
};

function requestUrl(request: FastifyRequest): string {
  const raw = request.raw as typeof request.raw & { originalUrl?: string };
  return String(raw.originalUrl ?? raw.url ?? request.url ?? "");
}

function basePathFor(request: FastifyRequest): string {
  return getForwardedBasePath(request.headers as Record<string, unknown>);
}

function localizedHref(basePath: string, path: string, lang: SiteLang): string {
  return withBasePath(basePath, appendLangToHref(path, lang));
}

function signInRedirect(basePath: string, targetPath: string, lang: SiteLang): string {
  const target = localizedHref(basePath, targetPath, lang);
  return localizedHref(basePath, `/login?redirect=${encodeURIComponent(target)}`, lang);
}

function safeRecordId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9:._-]{1,180}$/.test(id) ? id : null;
}

function safePhotoIndex(value: unknown): number | null {
  const index = Number(value);
  return Number.isInteger(index) && index >= 1 && index <= 6 ? index : null;
}

function privateCacheHeaders(reply: FastifyReply): FastifyReply {
  return reply
    .header("Cache-Control", "private, no-store")
    .header("Pragma", "no-cache")
    .header("Vary", "Cookie");
}

function privateHtmlHeaders(reply: FastifyReply): FastifyReply {
  return privateCacheHeaders(reply)
    .type("text/html; charset=utf-8")
    .header("X-Robots-Tag", "noindex, nofollow")
    .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    .header("Referrer-Policy", "no-referrer")
    .header("X-Frame-Options", "DENY")
    .header("Cross-Origin-Opener-Policy", "same-origin")
    .header("Cross-Origin-Resource-Policy", "same-origin")
    .header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function privateMediaHeaders(reply: FastifyReply): FastifyReply {
  return privateCacheHeaders(reply)
    .header("X-Content-Type-Options", "nosniff")
    .header("Content-Security-Policy", "default-src 'none'; sandbox")
    .header("Cross-Origin-Resource-Policy", "same-origin");
}

function renderPrivateDocument(input: {
  basePath: string;
  lang: SiteLang;
  currentPath: string;
  title: string;
  description: string;
  body: string;
}): string {
  return renderKubiakaPrivateDocument(input);
}

async function sendMemberHome(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: KubiakaPrivateRecordsRouteDependencies,
): Promise<void> {
  privateCacheHeaders(reply);
  const basePath = basePathFor(request);
  const rawUrl = requestUrl(request);
  const lang = detectLangFromUrl(rawUrl);
  const parsedUrl = new URL(rawUrl, "https://ikimon.invalid");
  const suppliedRecord = parsedUrl.searchParams.has("record")
    ? safeRecordId(parsedUrl.searchParams.get("record"))
    : null;
  const targetPath = parsedUrl.searchParams.has("record")
    ? `${KUBIAKA_MEMBER_PATH}?record=${encodeURIComponent(parsedUrl.searchParams.get("record") ?? "")}`
    : KUBIAKA_MEMBER_PATH;
  const session = await dependencies.getSession(request);
  if (!session) {
    reply.redirect(signInRedirect(basePath, targetPath, lang));
    return;
  }

  let acknowledgement: KubiakaPrivateAcknowledgement | null = null;
  if (parsedUrl.searchParams.has("record")) {
    if (!suppliedRecord) {
      privateHtmlHeaders(reply).code(404).send(renderPrivateDocument({
        basePath,
        lang,
        currentPath: KUBIAKA_MEMBER_PATH,
        title: kubiakaPrivateRecordsCopy(lang).notFoundTitle,
        description: kubiakaPrivateRecordsCopy(lang).notFoundLead,
        body: renderKubiakaPrivateRecordNotFound(basePath, lang),
      }));
      return;
    }
    acknowledgement = await dependencies.readAcknowledgement(suppliedRecord, session.userId);
    if (!acknowledgement) {
      privateHtmlHeaders(reply).code(404).send(renderPrivateDocument({
        basePath,
        lang,
        currentPath: KUBIAKA_MEMBER_PATH,
        title: kubiakaPrivateRecordsCopy(lang).notFoundTitle,
        description: kubiakaPrivateRecordsCopy(lang).notFoundLead,
        body: renderKubiakaPrivateRecordNotFound(basePath, lang),
      }));
      return;
    }
  }

  const overview = await dependencies.readOverview(session.userId);
  const copy = kubiakaPrivateRecordsCopy(lang);
  privateHtmlHeaders(reply).send(renderPrivateDocument({
    basePath,
    lang,
    currentPath: KUBIAKA_MEMBER_PATH,
    title: acknowledgement ? copy.acknowledgementTitle : copy.homeTitle,
    description: acknowledgement ? copy.acknowledgementLead : copy.homeLead,
    body: renderKubiakaPrivateRecordsHome({ basePath, lang, overview, acknowledgement }),
  }));
}

function isKubiakaMemberRoute(request: FastifyRequest): boolean {
  return request.method === "GET" && request.routeOptions.url === KUBIAKA_MEMBER_PATH;
}

export async function registerKubiakaPrivateRecordRoutes(
  app: FastifyInstance,
  dependencies: KubiakaPrivateRecordsRouteDependencies = defaultDependencies,
): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    if (!isKubiakaMemberRoute(request)) return;
    await sendMemberHome(request, reply, dependencies);
    return reply;
  });

  app.get(KUBIAKA_PRIVATE_RECORDS_PATH, async (request, reply) => {
    privateCacheHeaders(reply);
    const basePath = basePathFor(request);
    const rawUrl = requestUrl(request);
    const lang = detectLangFromUrl(rawUrl);
    const session = await dependencies.getSession(request);
    if (!session) return reply.redirect(signInRedirect(basePath, KUBIAKA_PRIVATE_RECORDS_PATH, lang));
    const page = await dependencies.readPage(session.userId);
    const copy = kubiakaPrivateRecordsCopy(lang);
    return privateHtmlHeaders(reply).send(renderPrivateDocument({
      basePath,
      lang,
      currentPath: KUBIAKA_PRIVATE_RECORDS_PATH,
      title: copy.recordsTitle,
      description: copy.recordsLead,
      body: renderKubiakaPrivateRecordList({ basePath, lang, page }),
    }));
  });

  app.get<{ Params: { visitId: string } }>(
    `${KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX}/:visitId`,
    async (request, reply) => {
      privateCacheHeaders(reply);
      const basePath = basePathFor(request);
      const rawUrl = requestUrl(request);
      const lang = detectLangFromUrl(rawUrl);
      const visitId = safeRecordId(request.params.visitId);
      const session = await dependencies.getSession(request);
      if (!session) {
        const target = visitId
          ? `${KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX}/${encodeURIComponent(visitId)}`
          : KUBIAKA_PRIVATE_RECORDS_PATH;
        return reply.redirect(signInRedirect(basePath, target, lang));
      }
      const detail = visitId ? await dependencies.readDetail(visitId, session.userId) : null;
      const copy = kubiakaPrivateRecordsCopy(lang);
      if (!detail) {
        return privateHtmlHeaders(reply).code(404).send(renderPrivateDocument({
          basePath,
          lang,
          currentPath: KUBIAKA_PRIVATE_RECORDS_PATH,
          title: copy.notFoundTitle,
          description: copy.notFoundLead,
          body: renderKubiakaPrivateRecordNotFound(basePath, lang),
        }));
      }
      return privateHtmlHeaders(reply).send(renderPrivateDocument({
        basePath,
        lang,
        currentPath: `${KUBIAKA_PRIVATE_RECORD_DETAIL_PREFIX}/${encodeURIComponent(detail.visitId)}`,
        title: copy.detailTitle,
        description: copy.detailLead,
        body: renderKubiakaPrivateRecordDetail({ basePath, lang, detail }),
      }));
    },
  );

  app.get<{ Params: { visitId: string; photoIndex: string } }>(
    `${KUBIAKA_PRIVATE_RECORD_MEDIA_PREFIX}/:visitId/photos/:photoIndex`,
    async (request, reply) => {
      privateMediaHeaders(reply);
      const visitId = safeRecordId(request.params.visitId);
      const photoIndex = safePhotoIndex(request.params.photoIndex);
      const session = await dependencies.getSession(request);
      if (!session || !visitId || photoIndex === null) return reply.code(404).send();
      const locator = await dependencies.readMedia(visitId, photoIndex, session.userId);
      if (!locator) return reply.code(404).send();
      try {
        const buffer = await dependencies.readPrivateBuffer(locator);
        return reply.type(locator.mimeType).send(buffer);
      } catch {
        return reply.code(404).send();
      }
    },
  );
}
