import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { normalizeTimestamp } from "./writeSupport.js";

type MonitoringSnapshotOptions = {
  placeId?: string | null;
  allowFixture?: boolean;
  preferFixtureWhenEmpty?: boolean;
};

type JsonRecord = Record<string, unknown>;

type EvidenceSummary = {
  fieldNoteSummary: string | null;
  fieldScanSummary: string | null;
  fixedPointPhotoNote: string | null;
  completeness: "baseline_only" | "partial" | "ready";
};

type ImageryContext = {
  source: "existing_imagery";
  layers: string[];
  note: string | null;
  quantitativeMetricsAvailable: false;
  allowedUses: string[];
};

export type MonitoringPlaceOption = {
  placeId: string;
  placeName: string;
  municipality: string | null;
  hasPlots: boolean;
};

export type MonitoringPlotRegistryItem = {
  plotId: string;
  plotCode: string;
  plotName: string;
  areaM2: number | null;
  baselineForestType: string | null;
  geometryNote: string | null;
  fixedPhotoPoints: string[];
  imageryContext: ImageryContext;
  visitCount: number;
  latestVisitAt: string | null;
  latestProtocolCode: string | null;
  status: string;
};

export type MonitoringVisitProtocol = {
  plotVisitId: string;
  plotId: string;
  plotLabel: string;
  observedAt: string;
  protocolCode: string;
  completeChecklistFlag: boolean;
  targetTaxaScope: string | null;
  observerCount: number | null;
  siteConditionSummary: string | null;
  evidenceSummary: EvidenceSummary;
  imageryContext: ImageryContext;
  nextAction: string | null;
};

export type MonitoringComparisonReportPayload = {
  plotId: string;
  plotLabel: string;
  reportStatus: "baseline_only" | "comparison_ready" | "no_visit_data";
  fieldEvidence: EvidenceSummary;
  siteCondition: {
    latest: string | null;
    previous: string | null;
  };
  revisitDiff: {
    previousObservedAt: string | null;
    latestObservedAt: string | null;
    summary: string;
  };
  imageryContext: ImageryContext;
  nextAction: string | null;
  guardrails: string[];
};

export type MonitoringPocSnapshot = {
  source: "database" | "fixture";
  schemaReady: boolean;
  canWrite: boolean;
  site: {
    placeId: string;
    placeName: string;
    municipality: string | null;
    imagerySummary: string;
  };
  plotRegistry: MonitoringPlotRegistryItem[];
  visitProtocols: MonitoringVisitProtocol[];
  comparisonReports: MonitoringComparisonReportPayload[];
  guardrails: string[];
};

export type MonitoringPlotUpsertInput = {
  plotId?: string | null;
  placeId: string;
  plotCode: string;
  plotName?: string | null;
  areaM2?: number | null;
  baselineForestType?: string | null;
  geometryNote?: string | null;
  fixedPhotoPoints?: string[] | string | null;
  imagerySummary?: string | null;
};

export type MonitoringPlotWriteResult = {
  ok: true;
  plotId: string;
  placeId: string;
};

export type MonitoringPlotVisitInput = {
  plotVisitId?: string | null;
  plotId: string;
  visitId?: string | null;
  observedAt: string;
  protocolCode: "fixed_plot_census" | "fixed_point_scan";
  completeChecklistFlag?: boolean;
  targetTaxaScope?: string | null;
  observerCount?: number | null;
  siteConditionSummary?: string | null;
  fieldNoteSummary?: string | null;
  fieldScanSummary?: string | null;
  fixedPointPhotoNote?: string | null;
  imagerySummary?: string | null;
  nextAction?: string | null;
};

export type MonitoringPlotVisitWriteResult = {
  ok: true;
  plotVisitId: string;
  plotId: string;
};

type MonitoringSchemaState = {
  databaseReady: boolean;
  schemaReady: boolean;
};

function normalizeText(value: unknown, maxLength = 1000): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item, 160))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => normalizeText(item, 160))
      .filter((item): item is string => Boolean(item));
  }
  return [];
}

function readJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readJsonList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeText(item, 160))
    .filter((item): item is string => Boolean(item));
}

function imageryContext(note: string | null): ImageryContext {
  return {
    source: "existing_imagery",
    layers: ["MapLibre", "air-photo"],
    note,
    quantitativeMetricsAvailable: false,
    allowedUses: [
      "plot_candidate_check",
      "boundary_confirmation",
      "route_sharing",
      "report_background",
      "human_before_after_explanation",
    ],
  };
}

function evidenceSummary(input: {
  fieldNoteSummary?: string | null;
  fieldScanSummary?: string | null;
  fixedPointPhotoNote?: string | null;
}): EvidenceSummary {
  const fieldNoteSummary = normalizeText(input.fieldNoteSummary, 1000);
  const fieldScanSummary = normalizeText(input.fieldScanSummary, 1000);
  const fixedPointPhotoNote = normalizeText(input.fixedPointPhotoNote, 1000);
  const count = [fieldNoteSummary, fieldScanSummary, fixedPointPhotoNote].filter(Boolean).length;

  return {
    fieldNoteSummary,
    fieldScanSummary,
    fixedPointPhotoNote,
    completeness: count >= 3 ? "ready" : count >= 1 ? "partial" : "baseline_only",
  };
}

function reportSummary(latest: MonitoringVisitProtocol | null, previous: MonitoringVisitProtocol | null): string {
  if (!latest) {
    return "まだ plot visit がありません。まず初回ベースラインを残します。";
  }
  if (!previous) {
    return "初回ベースラインのみです。次回再訪で比較を開始します。";
  }
  if ((latest.siteConditionSummary ?? "") === (previous.siteConditionSummary ?? "")) {
    return "前回から大きな変化は見えていません。固定点写真と現地ノートを継続比較します。";
  }
  return "前回と site condition が変化しています。固定点写真と現地ノートを並べて再確認します。";
}

function buildComparisonReport(
  plot: MonitoringPlotRegistryItem,
  latest: MonitoringVisitProtocol | null,
  previous: MonitoringVisitProtocol | null,
): MonitoringComparisonReportPayload {
  return {
    plotId: plot.plotId,
    plotLabel: `${plot.plotCode}${plot.plotName !== plot.plotCode ? ` / ${plot.plotName}` : ""}`,
    reportStatus: !latest ? "no_visit_data" : previous ? "comparison_ready" : "baseline_only",
    fieldEvidence: latest?.evidenceSummary ?? evidenceSummary({}),
    siteCondition: {
      latest: latest?.siteConditionSummary ?? null,
      previous: previous?.siteConditionSummary ?? null,
    },
    revisitDiff: {
      previousObservedAt: previous?.observedAt ?? null,
      latestObservedAt: latest?.observedAt ?? null,
      summary: reportSummary(latest, previous),
    },
    imageryContext: latest?.imageryContext ?? plot.imageryContext,
    nextAction: latest?.nextAction ?? null,
    guardrails: [
      "正式炭素量や tCO2 は出しません。",
      "plot の結果を site 全体へ自動外挿しません。",
      "衛星定量時系列は v1 の必須条件にしません。",
    ],
  };
}

function emptySnapshot(site: MonitoringPocSnapshot["site"], schemaReady: boolean, canWrite: boolean): MonitoringPocSnapshot {
  return {
    source: "database",
    schemaReady,
    canWrite,
    site,
    plotRegistry: [],
    visitProtocols: [],
    comparisonReports: [],
    guardrails: [
      "v1 では固定プロット比較を主に扱います。",
      "正式炭素量・認証提出値・site 全体外挿は扱いません。",
      "地図・航空写真は背景文脈と位置確認に限定します。",
    ],
  };
}

function fixtureSnapshot(placeId?: string | null): MonitoringPocSnapshot {
  const site = {
    placeId: placeId && placeId.trim() !== "" ? placeId : "fixture:shimizu-greencorridor",
    placeName: "清水みなと緑地サンプル",
    municipality: "静岡市清水区",
    imagerySummary: "既存の地図と航空写真で plot 候補と固定点の位置を確認。",
  };

  const plots: MonitoringPlotRegistryItem[] = [
    {
      plotId: "fixture-plot-a",
      plotCode: "P-01",
      plotName: "港側樹林帯",
      areaM2: 400,
      baselineForestType: "海浜沿いの混交樹林",
      geometryNote: "北端の歩道沿い 20m x 20m",
      fixedPhotoPoints: ["北西角から南東へ", "中央通路から海側へ"],
      imageryContext: imageryContext("航空写真で林縁と遊歩道の位置を確認。"),
      visitCount: 2,
      latestVisitAt: "2026-04-18T09:00:00.000Z",
      latestProtocolCode: "fixed_point_scan",
      status: "active",
    },
    {
      plotId: "fixture-plot-b",
      plotCode: "P-02",
      plotName: "芝地の縁",
      areaM2: 225,
      baselineForestType: "低木混じりの草地縁",
      geometryNote: "芝地東側 15m x 15m",
      fixedPhotoPoints: ["芝地境界から南へ"],
      imageryContext: imageryContext("既存画像で芝地境界と導線を確認。"),
      visitCount: 1,
      latestVisitAt: "2026-04-12T08:30:00.000Z",
      latestProtocolCode: "fixed_plot_census",
      status: "active",
    },
  ];

  const visits: MonitoringVisitProtocol[] = [
    {
      plotVisitId: "fixture-visit-a2",
      plotId: "fixture-plot-a",
      plotLabel: "P-01 / 港側樹林帯",
      observedAt: "2026-04-18T09:00:00.000Z",
      protocolCode: "fixed_point_scan",
      completeChecklistFlag: true,
      targetTaxaScope: "植生 + 目立つ鳥類",
      observerCount: 2,
      siteConditionSummary: "林縁の下草が伸び、通路側の踏圧がやや増加。",
      evidenceSummary: evidenceSummary({
        fieldNoteSummary: "樹林帯の下層植生が前回より明瞭。林縁の裸地は減少。",
        fieldScanSummary: "固定点 2 箇所の広角写真と短い音環境メモを取得。",
        fixedPointPhotoNote: "北西角と中央通路の固定点写真を再取得。",
      }),
      imageryContext: imageryContext("航空写真で通路と林縁の位置を再確認。"),
      nextAction: "初夏に同じ 2 点を再訪し、林縁の踏圧と下草の変化を比較する。",
    },
    {
      plotVisitId: "fixture-visit-a1",
      plotId: "fixture-plot-a",
      plotLabel: "P-01 / 港側樹林帯",
      observedAt: "2026-03-03T09:30:00.000Z",
      protocolCode: "fixed_plot_census",
      completeChecklistFlag: true,
      targetTaxaScope: "植生 + 目立つ鳥類",
      observerCount: 2,
      siteConditionSummary: "林縁に裸地が点在。下草はまだ疎。",
      evidenceSummary: evidenceSummary({
        fieldNoteSummary: "初回ベースライン。林縁の裸地と下草の疎密を記録。",
        fieldScanSummary: "固定点候補の広角写真を取得。",
        fixedPointPhotoNote: "北西角と中央通路を固定点として決定。",
      }),
      imageryContext: imageryContext("初回は既存航空写真で plot 候補を絞り込み。"),
      nextAction: "春の再訪で林縁の植生変化を確認する。",
    },
    {
      plotVisitId: "fixture-visit-b1",
      plotId: "fixture-plot-b",
      plotLabel: "P-02 / 芝地の縁",
      observedAt: "2026-04-12T08:30:00.000Z",
      protocolCode: "fixed_plot_census",
      completeChecklistFlag: false,
      targetTaxaScope: "草地縁の植生",
      observerCount: 1,
      siteConditionSummary: "芝地境界の刈込み後。低木列は安定。",
      evidenceSummary: evidenceSummary({
        fieldNoteSummary: "刈込み直後で草丈が低い。",
        fixedPointPhotoNote: "境界の固定点写真のみ取得。",
      }),
      imageryContext: imageryContext("背景図として既存画像のみ使用。"),
      nextAction: "次回は field scan を追加し、芝地境界の再訪比較を成立させる。",
    },
  ];

  return {
    source: "fixture",
    schemaReady: false,
    canWrite: false,
    site,
    plotRegistry: plots,
    visitProtocols: visits,
    comparisonReports: [
      buildComparisonReport(plots[0]!, visits[0]!, visits[1]!),
      buildComparisonReport(plots[1]!, visits[2]!, null),
    ],
    guardrails: [
      "営業PoCは固定プロット再訪モニタリングまでに固定します。",
      "炭素proxy・衛星定量時系列は別 gate が開くまで主訴求にしません。",
      "既存画像は位置確認と背景文脈にのみ使います。",
    ],
  };
}

async function getMonitoringSchemaState(): Promise<MonitoringSchemaState> {
  try {
    const pool = getPool();
    const result = await pool.query<{ plots_ready: boolean; visits_ready: boolean }>(
      `select
          to_regclass('public.monitoring_plots') is not null as plots_ready,
          to_regclass('public.monitoring_plot_visits') is not null as visits_ready`,
    );
    const row = result.rows[0];
    return {
      databaseReady: true,
      schemaReady: Boolean(row?.plots_ready && row?.visits_ready),
    };
  } catch {
    return {
      databaseReady: false,
      schemaReady: false,
    };
  }
}

export async function listMonitoringPlaceOptions(options?: {
  allowFixture?: boolean;
}): Promise<{
  source: "database" | "fixture";
  schemaReady: boolean;
  options: MonitoringPlaceOption[];
}> {
  const state = await getMonitoringSchemaState();
  if (!state.databaseReady) {
    return {
      source: "fixture",
      schemaReady: false,
      options: options?.allowFixture === false ? [] : [{
        placeId: "fixture:shimizu-greencorridor",
        placeName: "清水みなと緑地サンプル",
        municipality: "静岡市清水区",
        hasPlots: true,
      }],
    };
  }

  const pool = getPool();
  const placesResult = state.schemaReady
    ? await pool.query<{
        place_id: string;
        canonical_name: string;
        municipality: string | null;
        has_plots: boolean;
      }>(
        `select
            p.place_id,
            p.canonical_name,
            p.municipality,
            exists(select 1 from monitoring_plots mp where mp.place_id = p.place_id) as has_plots
         from places p
         order by exists(select 1 from monitoring_plots mp where mp.place_id = p.place_id) desc,
                  coalesce(p.last_visit_at, p.updated_at, p.created_at) desc
         limit 12`,
      )
    : await pool.query<{
        place_id: string;
        canonical_name: string;
        municipality: string | null;
      }>(
        `select
            place_id,
            canonical_name,
            municipality
         from places
         order by coalesce(last_visit_at, updated_at, created_at) desc
         limit 12`,
      );

  const placeOptions = placesResult.rows.map((row) => ({
    placeId: row.place_id,
    placeName: row.canonical_name,
    municipality: row.municipality,
    hasPlots: "has_plots" in row ? Boolean(row.has_plots) : false,
  }));

  if (placeOptions.length === 0 && options?.allowFixture !== false) {
    return {
      source: "fixture",
      schemaReady: state.schemaReady,
      options: fixtureSnapshot().plotRegistry.length > 0
        ? [{
            placeId: fixtureSnapshot().site.placeId,
            placeName: fixtureSnapshot().site.placeName,
            municipality: fixtureSnapshot().site.municipality,
            hasPlots: true,
          }]
        : [],
    };
  }

  return {
    source: "database",
    schemaReady: state.schemaReady,
    options: placeOptions,
  };
}

export async function getMonitoringPocSnapshot(
  placeId?: string | null,
  options?: MonitoringSnapshotOptions,
): Promise<MonitoringPocSnapshot> {
  const allowFixture = options?.allowFixture !== false;
  const preferFixtureWhenEmpty = options?.preferFixtureWhenEmpty === true;
  const placeOptions = await listMonitoringPlaceOptions({ allowFixture });
  const chosenPlaceId = normalizeText(placeId, 256) ?? placeOptions.options[0]?.placeId ?? null;

  if (placeOptions.source === "fixture" || !chosenPlaceId) {
    return allowFixture ? fixtureSnapshot(chosenPlaceId) : emptySnapshot({
      placeId: "place:unknown",
      placeName: "Unknown place",
      municipality: null,
      imagerySummary: "既存画像を利用できる site がまだ選ばれていません。",
    }, false, false);
  }

  const pool = getPool();
  try {
    const placeResult = await pool.query<{
      place_id: string;
      canonical_name: string;
      municipality: string | null;
    }>(
      `select place_id, canonical_name, municipality
       from places
       where place_id = $1
       limit 1`,
      [chosenPlaceId],
    );

    const place = placeResult.rows[0];
    if (!place) {
      return allowFixture ? fixtureSnapshot(chosenPlaceId) : emptySnapshot({
        placeId: chosenPlaceId,
        placeName: "Unknown place",
        municipality: null,
        imagerySummary: "site が見つかりません。",
      }, placeOptions.schemaReady, false);
    }

    const site = {
      placeId: place.place_id,
      placeName: place.canonical_name,
      municipality: place.municipality,
      imagerySummary: "MapLibre と既存の航空写真を、plot 候補確認と比較レポート背景に使います。",
    };

    if (!placeOptions.schemaReady) {
      return preferFixtureWhenEmpty && allowFixture ? fixtureSnapshot(chosenPlaceId) : emptySnapshot(site, false, false);
    }

    const [plotsResult, visitsResult] = await Promise.all([
      pool.query<{
        plot_id: string;
        plot_code: string;
        plot_name: string | null;
        area_m2: string | null;
        baseline_forest_type: string | null;
        geometry_summary: unknown;
        fixed_photo_points: unknown;
        imagery_context: unknown;
        status: string;
        visit_count: string;
        latest_visit_at: string | null;
        latest_protocol_code: string | null;
      }>(
        `select
            mp.plot_id,
            mp.plot_code,
            mp.plot_name,
            mp.area_m2::text,
            mp.baseline_forest_type,
            mp.geometry_summary,
            mp.fixed_photo_points,
            mp.imagery_context,
            mp.status,
            count(mpv.plot_visit_id)::text as visit_count,
            max(mpv.observed_at)::text as latest_visit_at,
            (
              array_agg(mpv.protocol_code order by mpv.observed_at desc)
            )[1] as latest_protocol_code
         from monitoring_plots mp
         left join monitoring_plot_visits mpv on mpv.plot_id = mp.plot_id
         where mp.place_id = $1
         group by
            mp.plot_id,
            mp.plot_code,
            mp.plot_name,
            mp.area_m2,
            mp.baseline_forest_type,
            mp.geometry_summary,
            mp.fixed_photo_points,
            mp.imagery_context,
            mp.status
         order by mp.plot_code asc`,
        [place.place_id],
      ),
      pool.query<{
        plot_visit_id: string;
        plot_id: string;
        plot_code: string;
        plot_name: string | null;
        observed_at: string;
        protocol_code: string;
        complete_checklist_flag: boolean;
        target_taxa_scope: string | null;
        observer_count: number | null;
        site_condition_summary: string | null;
        evidence_summary: unknown;
        imagery_context: unknown;
        next_action: string | null;
      }>(
        `select
            mpv.plot_visit_id,
            mpv.plot_id,
            mp.plot_code,
            mp.plot_name,
            mpv.observed_at::text,
            mpv.protocol_code,
            mpv.complete_checklist_flag,
            mpv.target_taxa_scope,
            mpv.observer_count,
            mpv.site_condition_summary,
            mpv.evidence_summary,
            mpv.imagery_context,
            mpv.next_action
         from monitoring_plot_visits mpv
         join monitoring_plots mp on mp.plot_id = mpv.plot_id
         where mp.place_id = $1
         order by mpv.observed_at desc, mp.plot_code asc`,
        [place.place_id],
      ),
    ]);

    if (plotsResult.rows.length === 0 && preferFixtureWhenEmpty && allowFixture) {
      return fixtureSnapshot(chosenPlaceId);
    }

    const plotRegistry = plotsResult.rows.map((row) => {
      const geometry = readJsonRecord(row.geometry_summary);
      const rawImagery = readJsonRecord(row.imagery_context);
      return {
        plotId: row.plot_id,
        plotCode: row.plot_code,
        plotName: normalizeText(row.plot_name, 160) ?? row.plot_code,
        areaM2: normalizeNumber(row.area_m2),
        baselineForestType: normalizeText(row.baseline_forest_type, 240),
        geometryNote: normalizeText(geometry.note, 240),
        fixedPhotoPoints: readJsonList(row.fixed_photo_points),
        imageryContext: imageryContext(normalizeText(rawImagery.note, 320)),
        visitCount: Number(row.visit_count ?? 0),
        latestVisitAt: row.latest_visit_at,
        latestProtocolCode: normalizeText(row.latest_protocol_code, 64),
        status: normalizeText(row.status, 40) ?? "active",
      } satisfies MonitoringPlotRegistryItem;
    });

    const visitProtocols = visitsResult.rows.map((row) => {
      const rawEvidence = readJsonRecord(row.evidence_summary);
      const rawImagery = readJsonRecord(row.imagery_context);
      return {
        plotVisitId: row.plot_visit_id,
        plotId: row.plot_id,
        plotLabel: `${row.plot_code}${row.plot_name ? ` / ${row.plot_name}` : ""}`,
        observedAt: row.observed_at,
        protocolCode: normalizeText(row.protocol_code, 64) ?? "fixed_plot_census",
        completeChecklistFlag: Boolean(row.complete_checklist_flag),
        targetTaxaScope: normalizeText(row.target_taxa_scope, 240),
        observerCount: normalizeNumber(row.observer_count),
        siteConditionSummary: normalizeText(row.site_condition_summary, 1000),
        evidenceSummary: evidenceSummary({
          fieldNoteSummary: normalizeText(rawEvidence.fieldNoteSummary, 1000),
          fieldScanSummary: normalizeText(rawEvidence.fieldScanSummary, 1000),
          fixedPointPhotoNote: normalizeText(rawEvidence.fixedPointPhotoNote, 1000),
        }),
        imageryContext: imageryContext(normalizeText(rawImagery.note, 320)),
        nextAction: normalizeText(row.next_action, 1000),
      } satisfies MonitoringVisitProtocol;
    });

    const visitsByPlot = new Map<string, MonitoringVisitProtocol[]>();
    for (const visit of visitProtocols) {
      const items = visitsByPlot.get(visit.plotId) ?? [];
      items.push(visit);
      visitsByPlot.set(visit.plotId, items);
    }

    const comparisonReports = plotRegistry.map((plot) => {
      const [latest, previous] = visitsByPlot.get(plot.plotId) ?? [];
      return buildComparisonReport(plot, latest ?? null, previous ?? null);
    });

    return {
      source: "database",
      schemaReady: true,
      canWrite: true,
      site,
      plotRegistry,
      visitProtocols,
      comparisonReports,
      guardrails: [
        "固定プロット再訪モニタリングまでを営業PoCの約束に固定します。",
        "正式炭素量・認証提出値・site 全体外挿は扱いません。",
        "既存画像は背景文脈と位置確認に限定します。",
      ],
    };
  } catch {
    return allowFixture ? fixtureSnapshot(chosenPlaceId) : emptySnapshot({
      placeId: chosenPlaceId,
      placeName: "Unknown place",
      municipality: null,
      imagerySummary: "monitoring snapshot を取得できませんでした。",
    }, false, false);
  }
}

export async function upsertMonitoringPlot(input: MonitoringPlotUpsertInput): Promise<MonitoringPlotWriteResult> {
  const placeId = normalizeText(input.placeId, 256);
  const plotCode = normalizeText(input.plotCode, 64);
  if (!placeId) {
    throw new Error("placeId is required");
  }
  if (!plotCode) {
    throw new Error("plotCode is required");
  }

  const pool = getPool();
  const plotId = normalizeText(input.plotId, 256) ?? `plot:${randomUUID()}`;
  const fixedPhotoPoints = normalizeList(input.fixedPhotoPoints);

  const placeExists = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from places where place_id = $1) as exists",
    [placeId],
  );
  if (!placeExists.rows[0]?.exists) {
    throw new Error(`Unknown placeId: ${placeId}`);
  }

  await pool.query(
    `insert into monitoring_plots (
        plot_id,
        place_id,
        plot_code,
        plot_name,
        area_m2,
        baseline_forest_type,
        geometry_summary,
        fixed_photo_points,
        imagery_context,
        metadata,
        created_at,
        updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, now(), now()
     )
     on conflict (plot_id) do update set
        place_id = excluded.place_id,
        plot_code = excluded.plot_code,
        plot_name = excluded.plot_name,
        area_m2 = excluded.area_m2,
        baseline_forest_type = excluded.baseline_forest_type,
        geometry_summary = excluded.geometry_summary,
        fixed_photo_points = excluded.fixed_photo_points,
        imagery_context = excluded.imagery_context,
        metadata = excluded.metadata,
        updated_at = now()`,
    [
      plotId,
      placeId,
      plotCode,
      normalizeText(input.plotName, 160),
      normalizeNumber(input.areaM2),
      normalizeText(input.baselineForestType, 240),
      JSON.stringify({
        note: normalizeText(input.geometryNote, 320),
      }),
      JSON.stringify(fixedPhotoPoints),
      JSON.stringify(imageryContext(normalizeText(input.imagerySummary, 320))),
      JSON.stringify({
        source: "v2_monitoring_poc",
      }),
    ],
  );

  return {
    ok: true,
    plotId,
    placeId,
  };
}

export async function recordMonitoringPlotVisit(input: MonitoringPlotVisitInput): Promise<MonitoringPlotVisitWriteResult> {
  const plotId = normalizeText(input.plotId, 256);
  if (!plotId) {
    throw new Error("plotId is required");
  }

  const pool = getPool();
  const plotResult = await pool.query<{ place_id: string }>(
    "select place_id from monitoring_plots where plot_id = $1 limit 1",
    [plotId],
  );
  const plot = plotResult.rows[0];
  if (!plot) {
    throw new Error(`Unknown plotId: ${plotId}`);
  }

  const plotVisitId = normalizeText(input.plotVisitId, 256) ?? `plotvisit:${randomUUID()}`;
  const observedAt = normalizeTimestamp(input.observedAt);
  const evidence = evidenceSummary(input);
  const imagery = imageryContext(normalizeText(input.imagerySummary, 320));

  await pool.query(
    `insert into monitoring_plot_visits (
        plot_visit_id,
        plot_id,
        visit_id,
        observed_at,
        protocol_code,
        complete_checklist_flag,
        target_taxa_scope,
        observer_count,
        site_condition_summary,
        evidence_summary,
        imagery_context,
        next_action,
        metadata,
        created_at,
        updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb, now(), now()
     )
     on conflict (plot_visit_id) do update set
        plot_id = excluded.plot_id,
        visit_id = excluded.visit_id,
        observed_at = excluded.observed_at,
        protocol_code = excluded.protocol_code,
        complete_checklist_flag = excluded.complete_checklist_flag,
        target_taxa_scope = excluded.target_taxa_scope,
        observer_count = excluded.observer_count,
        site_condition_summary = excluded.site_condition_summary,
        evidence_summary = excluded.evidence_summary,
        imagery_context = excluded.imagery_context,
        next_action = excluded.next_action,
        metadata = excluded.metadata,
        updated_at = now()`,
    [
      plotVisitId,
      plotId,
      normalizeText(input.visitId, 256),
      observedAt,
      input.protocolCode,
      Boolean(input.completeChecklistFlag),
      normalizeText(input.targetTaxaScope, 240),
      normalizeNumber(input.observerCount),
      normalizeText(input.siteConditionSummary, 1000),
      JSON.stringify(evidence),
      JSON.stringify(imagery),
      normalizeText(input.nextAction, 1000),
      JSON.stringify({
        source: "v2_monitoring_poc",
      }),
    ],
  );

  await pool.query(
    `insert into place_conditions (
        place_id,
        visit_id,
        observed_at,
        summary,
        metadata
     ) values (
        $1, $2, $3, $4, $5::jsonb
     )`,
    [
      plot.place_id,
      normalizeText(input.visitId, 256),
      observedAt,
      normalizeText(input.siteConditionSummary, 1000),
      JSON.stringify({
        source: "v2_monitoring_poc",
        plot_id: plotId,
        protocol_code: input.protocolCode,
      }),
    ],
  );

  return {
    ok: true,
    plotVisitId,
    plotId,
  };
}
