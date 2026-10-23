import type { FastifyInstance } from "fastify";
import { gzip } from "node:zlib";
import { getShortCopy } from "../content/index.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "../ui/mapExplorer.js";
import { renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function gzipQuality(acceptEncoding: unknown): number {
  const header = Array.isArray(acceptEncoding) ? acceptEncoding.join(",") : String(acceptEncoding ?? "");
  let wildcardQuality: number | undefined;
  for (const part of header.split(",")) {
    const [codingValue, ...parameters] = part.trim().toLowerCase().split(";");
    const coding = codingValue?.trim();
    if (!coding) continue;
    const qualityParameter = parameters.find((parameter) => /^\s*q\s*=/.test(parameter));
    const rawQuality = qualityParameter?.split("=")[1]?.trim();
    const parsedQuality = rawQuality === undefined ? 1 : Number(rawQuality);
    const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1 ? parsedQuality : 0;
    if (coding === "gzip") return quality;
    if (coding === "*") wildcardQuality = quality;
  }
  return wildcardQuality ?? 0;
}

function addAcceptEncodingVary(reply: { getHeader(name: string): number | string | string[] | undefined; header(name: string, value: string): unknown }): void {
  const existing = String(reply.getHeader("vary") ?? "");
  const values = existing.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.some((value) => value === "*" || value.toLowerCase() === "accept-encoding")) return;
  reply.header("Vary", [...values, "Accept-Encoding"].join(", "));
}

function gzipHtml(html: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Favor response latency: level 1 halves compression time for this large shell.
    gzip(html, { level: 1 }, (error, compressed) => error ? reject(error) : resolve(compressed));
  });
}

export async function registerMapReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/map", {
    onSend: async (request, reply, payload) => {
      addAcceptEncodingVary(reply);
      if (gzipQuality(request.headers["accept-encoding"]) <= 0 || typeof payload !== "string" || Buffer.byteLength(payload) < 1024) {
        return payload;
      }
      reply.header("Content-Encoding", "gzip");
      reply.removeHeader("content-length");
      return gzipHtml(payload);
    },
  }, async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapPageCopy = getShortCopy<any>(lang, "public", "read.map");

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    const html = renderSiteDocument({
      basePath,
      title: mapPageCopy.title,
      activeNav: mapPageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/map"), lang),
      shellClassName: "shell-bleed shell-map",
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: the map page should land on the map canvas,
      // while the explorer component carries a one-line context strip.
      hideFooter: true,
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: mapPageCopy.footerNote,
    });
    return html;
  });
}
