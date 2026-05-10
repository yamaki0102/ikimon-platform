import { test, expect, type APIRequestContext } from "@playwright/test";
import { createStagingApiContext, requireEnv } from "./support/staging.js";

type MaterializedObservation = {
  visitId: string;
  occurrenceId: string;
};

function resolveMaterializedObservation(html: string): MaterializedObservation {
  const detailLink = html.match(/\/observations\/([^"?&#]+)\?subject=([^"&#]+)/);
  const visitId = detailLink?.[1] ? decodeURIComponent(detailLink[1]) : null;
  const occurrenceId = detailLink?.[2] ? decodeURIComponent(detailLink[2]) : null;
  expect(visitId, "QA sitemap should expose a materialized observation visit").toBeTruthy();
  expect(occurrenceId, "QA sitemap should expose a materialized observation occurrence").toBeTruthy();
  return { visitId: visitId!, occurrenceId: occurrenceId! };
}

async function resolveObservation(api: APIRequestContext): Promise<MaterializedObservation> {
  const response = await api.get("/qa/site-map?lang=ja");
  expect(response.ok(), "/qa/site-map should be reachable with staging auth").toBeTruthy();
  return resolveMaterializedObservation(await response.text());
}

test("observation package endpoint returns a reviewed package with staging auth", async ({ playwright }) => {
  const api = await createStagingApiContext(playwright);
  const writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
  try {
    const observation = await resolveObservation(api);
    const response = await api.get(
      `/api/v1/observations/${encodeURIComponent(observation.visitId)}/package?subject=${encodeURIComponent(observation.occurrenceId)}`,
      {
        headers: {
          "x-ikimon-write-key": writeKey,
          accept: "application/json",
        },
      },
    );
    const payload = await response.json().catch(() => null) as { ok?: boolean; package?: Record<string, unknown>; error?: string } | null;
    expect(response.ok(), payload?.error ?? "observation_package_failed").toBeTruthy();
    expect(payload?.ok).toBe(true);
    const pkg = payload?.package;
    expect(pkg?.packageVersion).toBe("observation_package/v1.3");
    expect(pkg?.methodContext).toBeTruthy();
    expect(pkg?.dataProductChain).toBeTruthy();
    expect(pkg?.readiness).toBeTruthy();
    expect(pkg?.runtimeVersion).toBeTruthy();

    const summary = {
      packageId: pkg?.packageId,
      packageVersion: pkg?.packageVersion,
      visitId: observation.visitId,
      occurrenceId: observation.occurrenceId,
      actionMode: pkg?.actionMode,
      latestStage: (pkg?.dataProductChain as { latestStage?: unknown } | undefined)?.latestStage,
      schemaVersion: (pkg?.readiness as { schemaVersion?: unknown } | undefined)?.schemaVersion,
      readinessKeys: Object.keys((pkg?.readiness as Record<string, unknown> | undefined) ?? {}),
      runtimeSchema: (pkg?.runtimeVersion as { schemaVersion?: unknown } | undefined)?.schemaVersion,
    };
    console.info(`observation package staging summary ${JSON.stringify(summary)}`);
  } finally {
    await api.dispose();
  }
});
