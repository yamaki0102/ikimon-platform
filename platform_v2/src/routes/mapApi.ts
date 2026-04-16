import type { FastifyInstance } from "fastify";
import { getCoverageMesh, getMapObservations, type TaxonGroup } from "../services/mapSnapshot.js";

const ALLOWED_GROUPS: readonly TaxonGroup[] = [
  "insect",
  "bird",
  "plant",
  "amphibian_reptile",
  "mammal",
  "fungi",
  "other",
];

function parseBbox(raw: unknown): [number, number, number, number] | undefined {
  if (typeof raw !== "string") return undefined;
  const parts = raw.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  const minLng = parts[0] as number;
  const minLat = parts[1] as number;
  const maxLng = parts[2] as number;
  const maxLat = parts[3] as number;
  if (minLng > maxLng || minLat > maxLat) return undefined;
  return [minLng, minLat, maxLng, maxLat];
}

function parseInt32(raw: unknown): number | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export async function registerMapApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/map/observations", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const rawGroup = typeof q.taxon_group === "string" ? q.taxon_group.trim() : "";
    const taxonGroup = (ALLOWED_GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as TaxonGroup)
      : undefined;
    const year = parseInt32(q.year);
    const bbox = parseBbox(q.bbox);
    const limit = parseInt32(q.limit);

    const collection = await getMapObservations({
      taxonGroup,
      year,
      bbox,
      limit,
    });

    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });

  app.get("/api/v1/map/coverage", async (request, reply) => {
    const q = (request.query ?? {}) as Record<string, unknown>;
    const year = parseInt32(q.year);
    const collection = await getCoverageMesh({ year });
    reply
      .type("application/json; charset=utf-8")
      .header("Cache-Control", "no-store");
    return collection;
  });
}
