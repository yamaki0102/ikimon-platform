import type { FastifyInstance } from "fastify";
import { buildRobotsTxt, buildXmlSitemap } from "../siteMap.js";
import { buildReflectionLoopManifest } from "../services/reflectionLoopManifest.js";
import { registerIwataOpenDataRoutes } from "./iwataOpenData.js";
import { registerKubiakaFocusedExperienceRoutes } from "./kubiakaFocusedExperience.js";
import { registerKubiakaPrivateRecordRoutes } from "./kubiakaPrivateRecords.js";
import { registerKubiakaPrivateUploadGuard } from "./kubiakaPrivateUploadGuard.js";
import { registerRegionalSourceRoutes } from "./regionalSources.js";

function requestOrigin(request: { headers: Record<string, unknown> }): string {
  const host = String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "ikimon.life");
  const proto = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

export async function registerSiteMapRoutes(app: FastifyInstance): Promise<void> {
  await registerIwataOpenDataRoutes(app);
  await registerKubiakaPrivateUploadGuard(app);
  await registerKubiakaPrivateRecordRoutes(app);
  await registerKubiakaFocusedExperienceRoutes(app);
  await registerRegionalSourceRoutes(app);

  app.get("/sitemap.xml", async (request, reply) => {
    reply.type("application/xml; charset=utf-8");
    return buildXmlSitemap(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/robots.txt", async (request, reply) => {
    reply.type("text/plain; charset=utf-8");
    return buildRobotsTxt(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });

  app.get("/qa/reflection-loop.json", async (request, reply) => {
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return buildReflectionLoopManifest(requestOrigin(request as unknown as { headers: Record<string, unknown> }));
  });
}
