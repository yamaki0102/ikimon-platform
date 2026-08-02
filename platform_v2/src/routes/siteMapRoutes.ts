import type { FastifyInstance } from "fastify";
import { resolveZukanPublicAssetOrigin } from "../brandAssets.js";
import { buildRobotsTxt, buildXmlSitemap } from "../siteMap.js";
import { buildReflectionLoopManifest } from "../services/reflectionLoopManifest.js";
import { registerIwataOpenDataRoutes } from "./iwataOpenData.js";
import { registerKubiakaFocusedExperienceRoutes } from "./kubiakaFocusedExperience.js";
import { registerKubiakaPrivateUploadGuard } from "./kubiakaPrivateUploadGuard.js";
import { registerRegionalSourceRoutes } from "./regionalSources.js";

const STAGING_ORIGIN = "https://staging.ikimon.life";
const PRODUCTION_ORIGIN = "https://ikimon.life";
const STAGING_ROBOTS_META = '<meta name="robots" content="noindex, nofollow" />';
const ROBOTS_META_PATTERN = /<meta\b[^>]*\bname=["']robots["'][^>]*>/gi;

function requestOrigin(request: { headers: Record<string, unknown> }): string {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "ikimon.life");
  const proto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

export function isStagingRequest(
  request: { headers: Record<string, unknown> },
  publicAssetOrigin: string = resolveZukanPublicAssetOrigin(),
): boolean {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return host === "staging.ikimon.life" || publicAssetOrigin === STAGING_ORIGIN;
}

export function stagingRobotsTxt(): string {
  return `User-agent: *\nDisallow: /\n# production-canonical-origin: ${PRODUCTION_ORIGIN}\n`;
}

export function addStagingRobotsMeta(payload: string): string {
  const withoutRobotsMeta = payload.replace(ROBOTS_META_PATTERN, "");
  return withoutRobotsMeta.includes("</head>")
    ? withoutRobotsMeta.replace("</head>", `  ${STAGING_ROBOTS_META}\n</head>`)
    : `${STAGING_ROBOTS_META}\n${withoutRobotsMeta}`;
}

export async function registerSiteMapRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onSend", (request, reply, payload, done) => {
    if (!isStagingRequest(request as unknown as { headers: Record<string, unknown> })) {
      done(null, payload);
      return;
    }
    reply.header("X-Robots-Tag", "noindex, nofollow");
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    const nextPayload = contentType.startsWith("text/html") && typeof payload === "string"
      ? addStagingRobotsMeta(payload)
      : payload;
    done(null, nextPayload);
  });

  await registerIwataOpenDataRoutes(app);
  await registerKubiakaPrivateUploadGuard(app);
  await registerKubiakaFocusedExperienceRoutes(app);
  await registerRegionalSourceRoutes(app);

  app.get("/sitemap.xml", async (request, reply) => {
    reply.type("application/xml; charset=utf-8");
    return buildXmlSitemap(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/robots.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8");
    if (isStagingRequest(request as unknown as { headers: Record<string, unknown> })) {
      reply.header("Cache-Control", "no-store");
      return stagingRobotsTxt();
    }
    return buildRobotsTxt(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/qa/reflection-loop.json", async (request, reply) => {
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return buildReflectionLoopManifest(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });
}
