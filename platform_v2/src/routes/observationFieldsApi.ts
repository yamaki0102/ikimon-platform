import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  createField,
  getField,
  getFieldStats,
  listCertifiedFields,
  listFields,
  listMyFields,
  listNearbyFields,
  listPrefectureBuckets,
  searchFieldsByName,
  updateField,
  type FieldSource,
} from "../services/observationFieldRegistry.js";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function asFieldSource(v: unknown): FieldSource | null {
  return v === "user_defined" || v === "nature_symbiosis_site" || v === "tsunag" ||
    v === "protected_area" || v === "oecm" ? v : null;
}

export async function registerObservationFieldsApiRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/fields  — 自分のフィールドを登録(user_defined)
  app.post<{ Body: Record<string, unknown> }>("/api/v1/fields", async (request, reply) => {
    const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!auth) return reply.status(401).send({ error: "login required" });
    const body = request.body ?? {};
    const name = asString(body.name);
    const lat = asNumber(body.lat);
    const lng = asNumber(body.lng);
    if (!name || lat === null || lng === null) {
      return reply.status(400).send({ error: "name, lat, lng required" });
    }
    try {
      const field = await createField({
        source: "user_defined",
        name,
        nameKana: asString(body.name_kana) ?? "",
        summary: asString(body.summary) ?? "",
        prefecture: asString(body.prefecture) ?? "",
        city: asString(body.city) ?? "",
        lat,
        lng,
        radiusM: asNumber(body.radius_m) ?? 1000,
        polygon: (body.polygon && typeof body.polygon === "object")
          ? (body.polygon as Record<string, unknown>)
          : null,
        areaHa: asNumber(body.area_ha),
        ownerUserId: auth.userId,
        payload: (body.payload && typeof body.payload === "object")
          ? (body.payload as Record<string, unknown>)
          : {},
      });
      return reply.status(201).send({ field });
    } catch (err) {
      const message = err instanceof Error ? err.message : "create failed";
      return reply.status(500).send({ error: message });
    }
  });

  // GET /api/v1/fields/prefectures  — 都道府県別バケット
  app.get("/api/v1/fields/prefectures", async (_request, reply) => {
    const buckets = await listPrefectureBuckets();
    return reply.send({ prefectures: buckets });
  });

  // GET /api/v1/fields/:fieldId  — 単一取得
  app.get<{ Params: { fieldId: string } }>("/api/v1/fields/:fieldId", async (request, reply) => {
    const field = await getField(request.params.fieldId);
    if (!field) return reply.status(404).send({ error: "field not found" });
    return reply.send({ field });
  });

  // GET /api/v1/fields/:fieldId/stats  — フィールドごとの観察会・観察集計
  app.get<{ Params: { fieldId: string } }>("/api/v1/fields/:fieldId/stats", async (request, reply) => {
    const stats = await getFieldStats(request.params.fieldId);
    if (!stats) return reply.status(404).send({ error: "field not found" });
    return reply.send({ stats });
  });

  // PATCH /api/v1/fields/:fieldId  — 自分のフィールドのみ
  app.patch<{ Params: { fieldId: string }; Body: Record<string, unknown> }>(
    "/api/v1/fields/:fieldId",
    async (request, reply) => {
      const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!auth) return reply.status(401).send({ error: "login required" });
      const field = await getField(request.params.fieldId);
      if (!field) return reply.status(404).send({ error: "field not found" });
      if (field.source !== "user_defined" || field.ownerUserId !== auth.userId) {
        return reply.status(403).send({ error: "owner only" });
      }
      const body = request.body ?? {};
      const updates: Parameters<typeof updateField>[1] = {};
      if (body.name !== undefined) updates.name = asString(body.name) ?? "";
      if (body.name_kana !== undefined) updates.nameKana = asString(body.name_kana) ?? "";
      if (body.summary !== undefined) updates.summary = asString(body.summary) ?? "";
      if (body.prefecture !== undefined) updates.prefecture = asString(body.prefecture) ?? "";
      if (body.city !== undefined) updates.city = asString(body.city) ?? "";
      if (body.lat !== undefined) {
        const n = asNumber(body.lat);
        if (n !== null) updates.lat = n;
      }
      if (body.lng !== undefined) {
        const n = asNumber(body.lng);
        if (n !== null) updates.lng = n;
      }
      if (body.radius_m !== undefined) {
        const n = asNumber(body.radius_m);
        if (n !== null) updates.radiusM = n;
      }
      if (body.polygon !== undefined) {
        updates.polygon = (body.polygon && typeof body.polygon === "object")
          ? (body.polygon as Record<string, unknown>) : null;
      }
      if (body.area_ha !== undefined) {
        updates.areaHa = asNumber(body.area_ha);
      }
      if (body.payload !== undefined && typeof body.payload === "object") {
        updates.payload = body.payload as Record<string, unknown>;
      }
      const updated = await updateField(field.fieldId, updates);
      return reply.send({ field: updated });
    },
  );

  // GET /api/v1/fields  — 検索系の入口
  //   ?nearby=lat,lng&km=10&source=...
  //   ?q=keyword
  //   ?mine=1
  //   ?certified=nature_symbiosis_site&prefecture=東京都
  app.get<{
    Querystring: {
      nearby?: string;
      km?: string;
      q?: string;
      mine?: string;
      certified?: string;
      prefecture?: string;
      source?: string;
      limit?: string;
    };
  }>("/api/v1/fields", async (request, reply) => {
    const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const limit = Math.min(Math.max(1, Number(request.query.limit ?? 30) || 30), 100);

    if (request.query.nearby) {
      const parts = request.query.nearby.split(",");
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return reply.status(400).send({ error: "invalid nearby" });
      }
      const km = Number(request.query.km ?? 10) || 10;
      const source = asFieldSource(request.query.source);
      const fields = await listNearbyFields(lat, lng, km, { source, limit });
      return reply.send({ fields });
    }

    if (request.query.q) {
      const fields = await searchFieldsByName(request.query.q, limit);
      return reply.send({ fields });
    }

    if (request.query.mine === "1") {
      if (!auth) return reply.status(401).send({ error: "login required" });
      const fields = await listMyFields(auth.userId, limit);
      return reply.send({ fields });
    }

    if (request.query.certified) {
      const source = asFieldSource(request.query.certified);
      if (!source) return reply.status(400).send({ error: "invalid certified source" });
      const fields = await listCertifiedFields(source, {
        prefecture: asString(request.query.prefecture) ?? undefined,
        limit,
      });
      return reply.send({ fields });
    }

    // 一般ブラウズ: prefecture/city/source/offset の任意組み合わせ
    const prefecture = asString(request.query.prefecture);
    const city = asString((request.query as Record<string, unknown>).city);
    const sourceFilter = request.query.source ? asFieldSource(request.query.source) : null;
    const offset = Number((request.query as Record<string, unknown>).offset ?? 0) || 0;
    if (prefecture || city || sourceFilter) {
      const fields = await listFields({
        prefecture: prefecture ?? undefined,
        city: city ?? undefined,
        source: sourceFilter ?? undefined,
        limit,
        offset,
      });
      return reply.send({ fields });
    }

    return reply.status(400).send({ error: "specify nearby/q/mine/certified/prefecture" });
  });
}
