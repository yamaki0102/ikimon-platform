import type { FastifyInstance } from "fastify";
import { getSessionFromCookie } from "../services/authSession.js";
import {
  createField,
  getField,
  getFieldStats,
  createFieldVersion,
  findFieldConflicts,
  listCertifiedFields,
  listFields,
  listMyFields,
  listNearbyFields,
  listPrefectureBuckets,
  searchFieldsByName,
  updateField,
  type FieldSource,
} from "../services/observationFieldRegistry.js";
import { getPlaceSnapshot } from "../services/placeSnapshot.js";
import { getAreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import { buildFieldPublicProfileView } from "../services/fieldPublicProfileView.js";
import { getSiteEvidenceReport } from "../services/siteEvidenceReport.js";
import { isAdminOrAnalystRole } from "../services/reviewerAuthorities.js";
import {
  getFieldManagerRole,
  listManagersForField,
  grantFieldManager,
  revokeFieldManager,
  type FieldManagerRole,
} from "../services/fieldManagers.js";
import {
  AreaSketchAssessmentValidationError,
  createAreaSketchAssessment,
  listAreaSketchAssessments,
  resolveAreaSketchAssessmentDraftVisibility,
} from "../services/areaSketchAssessments.js";
import type {
  AreaSketchLandCoverInput,
  AreaSketchPolicyVersion,
} from "../services/areaSketchEstimate.js";

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function asFieldSource(v: unknown): FieldSource | null {
  if (typeof v !== "string") return null;
  return v === "user_defined" || v === "nature_symbiosis_site" || v === "tsunag" ||
    v === "protected_area" || v === "oecm" || v === "school" || v === "osm_park" ||
    v === "admin_municipality" || v === "admin_prefecture" || v === "admin_country"
    ? (v as FieldSource) : null;
}
function asAreaSketchPolicyVersion(v: unknown): AreaSketchPolicyVersion | null {
  return v === "general_precheck_v1" || v === "tsunag_2026_current" || v === "tsunag_2027_planned"
    ? v
    : null;
}
function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asLandCover(v: unknown): AreaSketchLandCoverInput[] {
  return Array.isArray(v) ? (v as AreaSketchLandCoverInput[]) : [];
}

export async function registerObservationFieldsApiRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/fields/conflicts — user_defined 保存前の重複検知
  app.post<{ Body: Record<string, unknown> }>("/api/v1/fields/conflicts", async (request, reply) => {
    const auth = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    if (!auth) return reply.status(401).send({ error: "login required" });
    const body = request.body ?? {};
    const name = asString(body.name);
    const lat = asNumber(body.lat);
    const lng = asNumber(body.lng);
    if (!name || lat === null || lng === null) {
      return reply.status(400).send({ error: "name, lat, lng required" });
    }
    const conflicts = await findFieldConflicts({
      ownerUserId: auth.userId,
      name,
      lat,
      lng,
      radiusM: asNumber(body.radius_m) ?? 1000,
      polygon: (body.polygon && typeof body.polygon === "object")
        ? (body.polygon as Record<string, unknown>)
        : null,
      excludeFieldId: asString(body.exclude_field_id),
    });
    return reply.send({ conflicts });
  });

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
    const polygon = (body.polygon && typeof body.polygon === "object")
      ? (body.polygon as Record<string, unknown>)
      : null;
    const radiusM = asNumber(body.radius_m) ?? 1000;
    const resolutionAction = asString(body.resolution_action);
    const resolutionFieldId = asString(body.resolution_field_id);
    const conflicts = await findFieldConflicts({
      ownerUserId: auth.userId,
      name,
      lat,
      lng,
      radiusM,
      polygon,
    });
    const primaryConflict = conflicts[0];
    if (primaryConflict && !resolutionAction) {
      return reply.status(409).send({
        error: "similar field exists",
        message: "似たフィールドがあります。今回の観察会ではどの範囲を使うか選んでください。",
        conflicts,
      });
    }
    if (resolutionAction === "use_existing") {
      const field = resolutionFieldId
        ? conflicts.find((c) => c.field.fieldId === resolutionFieldId)?.field
        : primaryConflict?.field;
      if (!field) return reply.status(400).send({ error: "resolution_field_id not found in conflicts" });
      return reply.send({ field, resolution: { action: "use_existing", conflicts } });
    }
    if (resolutionAction === "update_existing") {
      const target = resolutionFieldId
        ? conflicts.find((c) => c.field.fieldId === resolutionFieldId)
        : primaryConflict;
      if (!target) return reply.status(400).send({ error: "resolution_field_id not found in conflicts" });
      if (!target.editableByRequester) return reply.status(403).send({ error: "owner only" });
      const field = await createFieldVersion({
        previousFieldId: target.field.fieldId,
        source: "user_defined",
        name,
        nameKana: asString(body.name_kana) ?? target.field.nameKana,
        summary: asString(body.summary) ?? target.field.summary,
        prefecture: asString(body.prefecture) ?? target.field.prefecture,
        city: asString(body.city) ?? target.field.city,
        lat,
        lng,
        radiusM,
        polygon,
        areaHa: asNumber(body.area_ha),
        ownerUserId: auth.userId,
        payload: (body.payload && typeof body.payload === "object")
          ? (body.payload as Record<string, unknown>)
          : {},
      });
      return reply.status(201).send({ field, resolution: { action: "update_existing", conflicts } });
    }
    if (resolutionAction === "save_as_new" && primaryConflict && primaryConflict.field.name === name) {
      return reply.status(409).send({
        error: "distinct name required",
        message: "別範囲として保存する場合は、用途が分かる名前を足してください。",
        conflicts,
      });
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
        radiusM,
        polygon,
        areaHa: asNumber(body.area_ha),
        ownerUserId: auth.userId,
        payload: (body.payload && typeof body.payload === "object")
          ? (body.payload as Record<string, unknown>)
          : {},
      });
      return reply.status(201).send({ field, resolution: { action: resolutionAction || "created", conflicts } });
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

  // GET /api/v1/fields/:fieldId/public-profile — exact pin を返さない公開エリアプロフィール
  app.get<{ Params: { fieldId: string } }>("/api/v1/fields/:fieldId/public-profile", async (request, reply) => {
    const [field, stats, snapshot] = await Promise.all([
      getField(request.params.fieldId),
      getFieldStats(request.params.fieldId),
      getAreaPlaceSnapshot(request.params.fieldId, {
        viewer: { isAdminOrAnalyst: false, fieldRole: null },
        viewerUserId: null,
      }).catch(() => null),
    ]);
    if (!field || !stats) return reply.status(404).send({ error: "field not found" });
    const view = buildFieldPublicProfileView({ field, stats, snapshot });
    reply.header("Cache-Control", "public, max-age=60");
    return reply.send({
      profile: view.profile,
      publicBrief: view.publicBrief,
    });
  });

  // GET /api/v1/fields/:fieldId/place-snapshot  — 場所のいま / monitoring brief
  app.get<{ Params: { fieldId: string } }>("/api/v1/fields/:fieldId/place-snapshot", async (request, reply) => {
    const snapshot = await getPlaceSnapshot(request.params.fieldId);
    if (!snapshot) return reply.status(404).send({ error: "field not found" });
    return reply.send({ snapshot });
  });

  // GET /api/v1/fields/:fieldId/site-evidence-report?month=YYYY-MM
  // Site monitoring supplementary material. AI candidates remain separated from reviewer verified records.
  app.get<{ Params: { fieldId: string }; Querystring: { month?: string } }>(
    "/api/v1/fields/:fieldId/site-evidence-report",
    async (request, reply) => {
      const report = await getSiteEvidenceReport(request.params.fieldId, { month: request.query.month });
      if (!report) return reply.status(404).send({ error: "field not found" });
      reply.header("Cache-Control", "private, max-age=60");
      return reply.send({ report });
    },
  );

  // GET /api/v1/fields/:fieldId/area-snapshot  — エリア(公園/保護区/OECM/...)集約
  //   ベースの place-snapshot に年別タイムライン・努力量5指標・希少種マスキング情報を追加
  app.get<{ Params: { fieldId: string } }>("/api/v1/fields/:fieldId/area-snapshot", async (request, reply) => {
    const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const isAdminOrAnalyst = session
      ? isAdminOrAnalystRole(session.roleName, session.rankLabel)
      : false;
    const fieldRole = session
      ? await getFieldManagerRole(session.userId, request.params.fieldId).catch(() => null)
      : null;
    const viewer = { isAdminOrAnalyst, fieldRole } as const;
    const snapshot = await getAreaPlaceSnapshot(request.params.fieldId, { viewer, viewerUserId: session?.userId ?? null });
    if (!snapshot) return reply.status(404).send({ error: "field not found" });
    reply.header("Cache-Control", "no-store");
    return reply.send({ snapshot });
  });

  // POST /api/v1/fields/:fieldId/area-sketch-assessments
  // Area Sketch Assist の下書き診断。observation_fields.payload には混ぜず、専用テーブルへ保存する。
  app.post<{ Params: { fieldId: string }; Body: Record<string, unknown> }>(
    "/api/v1/fields/:fieldId/area-sketch-assessments",
    async (request, reply) => {
      const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!session) return reply.status(401).send({ error: "login required" });
      const field = await getField(request.params.fieldId);
      if (!field) return reply.status(404).send({ error: "field not found" });
      const body = request.body ?? {};
      const requestedVisibility = resolveAreaSketchAssessmentDraftVisibility(body.visibility);
      if (requestedVisibility !== "private") {
        const isAdminOrAnalyst = isAdminOrAnalystRole(session.roleName, session.rankLabel);
        const fieldRole = await getFieldManagerRole(session.userId, field.fieldId).catch(() => null);
        const ownsField = field.source === "user_defined" && field.ownerUserId === session.userId;
        if (!isAdminOrAnalyst && !fieldRole && !ownsField) {
          return reply.status(403).send({ error: "field manager only" });
        }
      }
      const sketchPolygon = asObject(body.sketch_polygon) ?? asObject(body.polygon);
      if (!sketchPolygon) return reply.status(400).send({ error: "sketch_polygon required" });
      try {
        const assessment = await createAreaSketchAssessment({
          fieldId: field.fieldId,
          actorUserId: session.userId,
          sketchPolygon,
          landCover: asLandCover(body.land_cover),
          policyVersion: asAreaSketchPolicyVersion(body.policy_version) ?? "general_precheck_v1",
          visibility: requestedVisibility,
          ownerAssertion: asObject(body.owner_assertion) ?? {},
          evidencePayload: asObject(body.evidence_payload) ?? {},
        });
        reply.header("Cache-Control", "no-store");
        return reply.status(201).send({ assessment });
      } catch (error) {
        if (error instanceof AreaSketchAssessmentValidationError) {
          return reply.status(400).send({ error: error.code, details: error.details });
        }
        const message = error instanceof Error ? error.message : "area sketch assessment failed";
        return reply.status(500).send({ error: message });
      }
    },
  );

  // GET /api/v1/fields/:fieldId/area-sketch-assessments
  // MVPでは本人の draft のみ返す。共有/公開レビューは次段階で separate permission model にする。
  app.get<{ Params: { fieldId: string }; Querystring: { limit?: string } }>(
    "/api/v1/fields/:fieldId/area-sketch-assessments",
    async (request, reply) => {
      const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!session) return reply.status(401).send({ error: "login required" });
      const field = await getField(request.params.fieldId);
      if (!field) return reply.status(404).send({ error: "field not found" });
      const assessments = await listAreaSketchAssessments({
        fieldId: field.fieldId,
        actorUserId: session.userId,
        limit: asNumber(request.query.limit) ?? 20,
      });
      reply.header("Cache-Control", "no-store");
      return reply.send({ assessments });
    },
  );

  // ──────────────────────────────────────────────────────────────────────
  // Field manager grants — admin/analyst のみが操作可能。
  // 希少種の正確座標を見せたい研究者・地域 steward を field 単位で登録する用途。
  // ──────────────────────────────────────────────────────────────────────
  function asFieldManagerRole(v: unknown): FieldManagerRole | null {
    return v === "owner" || v === "steward" || v === "viewer_exact" ? v : null;
  }

  app.get<{ Params: { fieldId: string } }>(
    "/api/v1/fields/:fieldId/managers",
    async (request, reply) => {
      const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!session) return reply.status(401).send({ error: "login required" });
      if (!isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
        return reply.status(403).send({ error: "admin or analyst only" });
      }
      const field = await getField(request.params.fieldId);
      if (!field) return reply.status(404).send({ error: "field not found" });
      const managers = await listManagersForField(field.fieldId);
      return reply.send({ field_id: field.fieldId, managers });
    },
  );

  app.post<{
    Params: { fieldId: string };
    Body: { user_id?: string; role?: string; expires_at?: string | null; note?: string };
  }>(
    "/api/v1/fields/:fieldId/managers",
    async (request, reply) => {
      const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!session) return reply.status(401).send({ error: "login required" });
      if (!isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
        return reply.status(403).send({ error: "admin or analyst only" });
      }
      const field = await getField(request.params.fieldId);
      if (!field) return reply.status(404).send({ error: "field not found" });
      const body = request.body ?? {};
      const userId = asString(body.user_id);
      const role = asFieldManagerRole(body.role);
      if (!userId) return reply.status(400).send({ error: "user_id required" });
      if (!role) return reply.status(400).send({ error: "role must be owner|steward|viewer_exact" });
      const grant = await grantFieldManager({
        fieldId: field.fieldId,
        userId,
        role,
        grantedBy: session.userId,
        expiresAt: typeof body.expires_at === "string" && body.expires_at ? body.expires_at : null,
        note: typeof body.note === "string" ? body.note : "",
      });
      return reply.send({ grant });
    },
  );

  app.delete<{ Params: { fieldId: string; userId: string; role: string } }>(
    "/api/v1/fields/:fieldId/managers/:userId/:role",
    async (request, reply) => {
      const session = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
      if (!session) return reply.status(401).send({ error: "login required" });
      if (!isAdminOrAnalystRole(session.roleName, session.rankLabel)) {
        return reply.status(403).send({ error: "admin or analyst only" });
      }
      const role = asFieldManagerRole(request.params.role);
      if (!role) return reply.status(400).send({ error: "role must be owner|steward|viewer_exact" });
      await revokeFieldManager(request.params.fieldId, request.params.userId, role);
      return reply.send({ revoked: true });
    },
  );

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
