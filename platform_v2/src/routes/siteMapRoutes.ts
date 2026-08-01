import type { FastifyInstance } from "fastify";
import { buildRobotsTxt, buildXmlSitemap } from "../siteMap.js";
import { buildReflectionLoopManifest } from "../services/reflectionLoopManifest.js";
import { registerIwataOpenDataRoutes } from "./iwataOpenData.js";
import { registerRegionalSourceRoutes } from "./regionalSources.js";

const STAGING_MATERIALIZATION_TOKEN = "materialize-admin-preview";
const STAGING_ROBOTS_META = '<meta name="robots" content="noindex, nofollow" />';

function requestOrigin(request: { headers: Record<string, unknown> }): string {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "ikimon.life");
  const proto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

function isStagingRequest(request: { headers: Record<string, unknown> }): boolean {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "").split(",")[0]?.trim().toLowerCase();
  return host === "staging.ikimon.life" || process.env.DEV_DUMMY_ADMIN_TOKEN === STAGING_MATERIALIZATION_TOKEN;
}

function addStagingRobotsMeta(payload: string): string {
  if (/name=["']robots["']/i.test(payload)) return payload;
  return payload.includes("</head>")
    ? payload.replace("</head>", `  ${STAGING_ROBOTS_META}\n</head>`)
    : payload;
}

export async function registerSiteMapRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onSend", async (request, reply, payload) => {
    if (!isStagingRequest(request as unknown as { headers: Record<string, unknown> })) return payload;
    reply.header("X-Robots-Tag", "noindex, nofollow");
    const contentType = String(reply.getHeader("content-type") ?? "");
    return contentType.startsWith("text/html") && typeof payload === "string"
      ? addStagingRobotsMeta(payload)
      : payload;
  });

  await registerIwataOpenDataRoutes(app);
  await registerRegionalSourceRoutes(app);

  app.get("/sitemap.xml", async (request, reply) => {
    reply.type("application/xml; charset=utf-8");
    return buildXmlSitemap(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/robots.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8");
    if (isStagingRequest(request as unknown as { headers: Record<string, unknown> })) {
      reply.header("Cache-Control", "no-store");
      return "User-agent: *\nDisallow: /\n";
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
