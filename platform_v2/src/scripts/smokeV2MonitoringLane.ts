type SmokeOptions = {
  baseUrl: string;
};

type SmokeResult = {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
  response?: unknown;
};

type JsonResponse = {
  payload: unknown;
  headers: Headers;
};

function parseArgs(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
    }
  }

  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function baseUrlWithPath(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "place";
}

async function requestJson(url: string, init?: RequestInit): Promise<JsonResponse> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${JSON.stringify(payload)}`);
  }

  return {
    payload,
    headers: response.headers,
  };
}

async function requestHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

function requireIncludes(html: string, markers: string[]): string | null {
  const missing = markers.filter((marker) => !html.includes(marker));
  if (missing.length === 0) {
    return null;
  }
  return `missing_markers:${missing.join(",")}`;
}

function requireExcludes(html: string, markers: string[]): string | null {
  const hits = markers.filter((marker) => html.includes(marker));
  if (hits.length === 0) {
    return null;
  }
  return `forbidden_markers:${hits.join(",")}`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const checks: SmokeResult[] = [];
  let failed = false;

  const placesUrl = baseUrlWithPath(options.baseUrl, "/api/v1/monitoring/places");
  const businessUrl = baseUrlWithPath(options.baseUrl, "/for-business");
  const applyUrl = baseUrlWithPath(options.baseUrl, "/for-business/apply");
  let placeId = "";
  let plotId = "";
  let plotVisitId = "";

  try {
    const response = await requestJson(placesUrl);
    if (!isRecord(response.payload) || response.payload.ok !== true) {
      throw new Error("monitoring places payload missing ok=true");
    }
    if (response.payload.source !== "database") {
      throw new Error(`monitoring places source is ${String(response.payload.source)}`);
    }
    const places = Array.isArray(response.payload.places) ? response.payload.places : [];
    const firstPlace = places.find((item) => isRecord(item) && asString(item.placeId));
    placeId = firstPlace && isRecord(firstPlace) ? asString(firstPlace.placeId) ?? "" : "";
    if (!placeId) {
      throw new Error("monitoring places returned no usable placeId");
    }
    checks.push({
      name: "monitoring/places",
      url: placesUrl,
      ok: true,
      response: {
        source: response.payload.source,
        schemaReady: response.payload.schemaReady,
        placeId,
      },
    });
  } catch (error) {
    checks.push({
      name: "monitoring/places",
      url: placesUrl,
      ok: false,
      error: error instanceof Error ? error.message : "unknown_monitoring_places_failure",
    });
    failed = true;
  }

  try {
    const html = await requestHtml(businessUrl);
    const includeError = requireIncludes(html, [
      "固定プロット比較",
      "再訪しやすい記録設計",
      "共有しやすい比較レポート",
    ]);
    const excludeError = requireExcludes(html, ["NDVI", "EVI", "GEE", "tCO2", "site-wide score", "正式炭素量"]);
    const validationError = includeError ?? excludeError;
    if (validationError) {
      throw new Error(validationError);
    }
    checks.push({
      name: "for-business",
      url: businessUrl,
      ok: true,
    });
  } catch (error) {
    checks.push({
      name: "for-business",
      url: businessUrl,
      ok: false,
      error: error instanceof Error ? error.message : "unknown_for_business_failure",
    });
    failed = true;
  }

  try {
    const html = await requestHtml(applyUrl);
    const includeError = requireIncludes(html, ["1 拠点の初回モニタリングを始める"]);
    if (includeError) {
      throw new Error(includeError);
    }
    checks.push({
      name: "for-business/apply",
      url: applyUrl,
      ok: true,
    });
  } catch (error) {
    checks.push({
      name: "for-business/apply",
      url: applyUrl,
      ok: false,
      error: error instanceof Error ? error.message : "unknown_for_business_apply_failure",
    });
    failed = true;
  }

  if (placeId) {
    const smokeKey = slugify(placeId);
    plotId = `monitoring-smoke:${smokeKey}`;
    plotVisitId = `monitoring-smoke:${smokeKey}:visit`;

    const plotUrl = baseUrlWithPath(options.baseUrl, "/api/v1/monitoring/plots/upsert");
    try {
      const response = await requestJson(plotUrl, {
        method: "POST",
        body: JSON.stringify({
          plotId,
          placeId,
          plotCode: "MON-SMOKE",
          plotName: "Monitoring Smoke Plot",
          areaM2: 400,
          baselineForestType: "検証用の固定プロット",
          geometryNote: "staging smoke run only",
          fixedPhotoPoints: ["north edge", "center trail"],
          imagerySummary: "existing imagery for boundary confirmation only",
        }),
      });
      if (!isRecord(response.payload) || response.payload.ok !== true || response.payload.plotId !== plotId) {
        throw new Error("plot upsert did not return the expected plotId");
      }
      checks.push({
        name: "monitoring/plots/upsert",
        url: plotUrl,
        ok: true,
        response: {
          plotId,
          placeId,
        },
      });
    } catch (error) {
      checks.push({
        name: "monitoring/plots/upsert",
        url: plotUrl,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_monitoring_plot_upsert_failure",
      });
      failed = true;
    }

    const visitUrl = baseUrlWithPath(options.baseUrl, "/api/v1/monitoring/plot-visits");
    try {
      const response = await requestJson(visitUrl, {
        method: "POST",
        body: JSON.stringify({
          plotVisitId,
          plotId,
          observedAt: new Date().toISOString(),
          protocolCode: "fixed_point_scan",
          targetTaxaScope: "植生 + 目立つ鳥類",
          observerCount: 1,
          completeChecklistFlag: true,
          siteConditionSummary: "staging smoke site condition",
          fieldNoteSummary: "staging smoke field note",
          fieldScanSummary: "staging smoke field scan",
          fixedPointPhotoNote: "staging smoke fixed-point photo",
          imagerySummary: "existing imagery for context only",
          nextAction: "repeat the same route on the next visit",
        }),
      });
      if (!isRecord(response.payload) || response.payload.ok !== true || response.payload.plotVisitId !== plotVisitId) {
        throw new Error("plot visit upsert did not return the expected plotVisitId");
      }
      checks.push({
        name: "monitoring/plot-visits",
        url: visitUrl,
        ok: true,
        response: {
          plotId,
          plotVisitId,
        },
      });
    } catch (error) {
      checks.push({
        name: "monitoring/plot-visits",
        url: visitUrl,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_monitoring_plot_visit_failure",
      });
      failed = true;
    }

    const snapshotUrl = baseUrlWithPath(options.baseUrl, `/api/v1/monitoring/snapshot?placeId=${encodeURIComponent(placeId)}`);
    try {
      const response = await requestJson(snapshotUrl);
      if (!isRecord(response.payload) || response.payload.ok !== true || !isRecord(response.payload.snapshot)) {
        throw new Error("monitoring snapshot payload missing snapshot");
      }
      const snapshot = response.payload.snapshot;
      if (snapshot.source !== "database") {
        throw new Error(`snapshot source is ${String(snapshot.source)}`);
      }
      if (snapshot.schemaReady !== true || snapshot.canWrite !== true) {
        throw new Error("snapshot is not schemaReady/canWrite");
      }
      const plotRegistry = Array.isArray(snapshot.plotRegistry) ? snapshot.plotRegistry : [];
      const comparisonReports = Array.isArray(snapshot.comparisonReports) ? snapshot.comparisonReports : [];
      const hasPlot = plotRegistry.some((plot) => isRecord(plot) && plot.plotId === plotId);
      const hasReport = comparisonReports.some((report) => isRecord(report) && report.plotId === plotId);
      if (!hasPlot) {
        throw new Error("snapshot plot registry is missing the smoke plot");
      }
      if (!hasReport || comparisonReports.length === 0) {
        throw new Error("snapshot comparison reports are missing the smoke plot");
      }
      checks.push({
        name: "monitoring/snapshot",
        url: snapshotUrl,
        ok: true,
        response: {
          source: snapshot.source,
          schemaReady: snapshot.schemaReady,
          canWrite: snapshot.canWrite,
          plotId,
        },
      });
    } catch (error) {
      checks.push({
        name: "monitoring/snapshot",
        url: snapshotUrl,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_monitoring_snapshot_failure",
      });
      failed = true;
    }

    const monitoringPageUrl = baseUrlWithPath(options.baseUrl, `/ops/monitoring-poc?placeId=${encodeURIComponent(placeId)}`);
    try {
      const html = await requestHtml(monitoringPageUrl);
      const includeError = requireIncludes(html, [
        "DB の monitoring lane を表示中です。plot と visit をこの画面から追加できます。",
        "MON-SMOKE",
      ]);
      const excludeError = requireExcludes(html, [
        "DB が使えないため fixture を表示中です。write は無効です。",
      ]);
      const validationError = includeError ?? excludeError;
      if (validationError) {
        throw new Error(validationError);
      }
      checks.push({
        name: "ops/monitoring-poc",
        url: monitoringPageUrl,
        ok: true,
      });
    } catch (error) {
      checks.push({
        name: "ops/monitoring-poc",
        url: monitoringPageUrl,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_monitoring_page_failure",
      });
      failed = true;
    }

    const demoUrl = baseUrlWithPath(options.baseUrl, "/for-business/demo");
    try {
      const html = await requestHtml(demoUrl);
      const includeError = requireIncludes(html, ["MON-SMOKE", "Field evidence"]);
      const excludeError = requireExcludes(html, ["NDVI", "EVI", "GEE", "tCO2", "正式炭素量"]);
      const validationError = includeError ?? excludeError;
      if (validationError) {
        throw new Error(validationError);
      }
      checks.push({
        name: "for-business/demo",
        url: demoUrl,
        ok: true,
      });
    } catch (error) {
      checks.push({
        name: "for-business/demo",
        url: demoUrl,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_for_business_demo_failure",
      });
      failed = true;
    }
  }

  console.log(
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        placeId,
        plotId,
        plotVisitId,
        checks,
        status: failed ? "failed" : "passed",
      },
      null,
      2,
    ),
  );

  if (failed) {
    process.exitCode = 1;
  }
}

void main();
