import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { getFixedPointStation } from "../services/fixedPointStation.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { FIXED_POINT_STATION_STYLES, renderFixedPointStationBody } from "../ui/fixedPointStation.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function stationStateCard(eyebrow: string, title: string, body: string): string {
  return `<section class="section">
    <div class="state-card">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h2 style="margin-top:8px">${escapeHtml(title)}</h2>
      <div style="margin-top:8px;color:#475569;line-height:1.7">${body}</div>
    </div>
  </section>`;
}

function renderPlaceStationDocument(
  basePath: string,
  title: string,
  body: string,
  currentPath: string,
  extraStyles?: string,
): string {
  return renderSiteDocument({
    basePath,
    title,
    activeNav: "記録",
    body,
    extraStyles,
    currentPath,
    footerNote: "いつもの道で見つけた自然を、その場で読み解く。",
  });
}

export async function registerPlaceStationReadRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { placeId: string } }>("/places/:placeId/station", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const station = await getFixedPointStation(decodeURIComponent(request.params.placeId)).catch(() => null);
    if (!station) {
      reply.code(404).type("text/html; charset=utf-8");
      return renderPlaceStationDocument(
        basePath,
        "定点ページ | ZUKAN",
        stationStateCard("定点ページが見つかりません", "この場所の記録をまだ束ねられません", "観察詳細やマップから、同じ場所の再記録を作ると定点ページが育ちます。"),
        appendLangToHref(withBasePath(basePath, `/places/${encodeURIComponent(request.params.placeId)}/station`), lang),
      );
    }
    reply.type("text/html; charset=utf-8");
    return renderPlaceStationDocument(
      basePath,
      `定点ページ | ${station.place.name} | ZUKAN`,
      renderFixedPointStationBody(station, basePath),
      appendLangToHref(withBasePath(basePath, `/places/${encodeURIComponent(station.place.placeId)}/station`), lang),
      FIXED_POINT_STATION_STYLES,
    );
  });
}
