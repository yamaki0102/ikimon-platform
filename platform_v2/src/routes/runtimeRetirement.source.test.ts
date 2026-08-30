import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const platformRoot = fileURLToPath(new URL("../../", import.meta.url));
const readSource = (relativePath: string): string => readFileSync(join(platformRoot, relativePath), "utf8");

test("retired focused-experience routes stay absent from the Node runtime", () => {
  const siteMapRoutes = readSource("src/routes/siteMapRoutes.ts");
  assert.doesNotMatch(siteMapRoutes, /kubiaka/iu);

  for (const relativePath of [
    "src/routes/kubiakaFocusedExperience.ts",
    "src/routes/kubiakaPrivateRecords.ts",
    "src/routes/kubiakaPrivateRecordsView.ts",
    "src/routes/kubiakaPrivateUploadGuard.ts",
    "src/services/kubiakaPrivateRecordsCopy.ts",
    "src/services/kubiakaPrivateRecordsReadModel.ts",
  ]) {
    assert.equal(existsSync(join(platformRoot, relativePath)), false, `${relativePath} must remain retired`);
  }
});

test("retired focused-experience entries stay absent from the Product Registry", () => {
  const registryRoot = join(platformRoot, "product-registry");
  for (const entry of readdirSync(registryRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    assert.doesNotMatch(readFileSync(join(registryRoot, entry.name), "utf8"), /kubiaka/iu, entry.name);
  }
});

test("general notification writers remain active without the retired taxon gate", () => {
  const alertDispatcher = readSource("src/services/alertDispatcher.ts");
  const areaWatchNotifications = readSource("src/services/areaWatchNotifications.ts");

  assert.doesNotMatch(alertDispatcher, /notificationEligibility|experienceManagedTaxonScopes|managedTaxonScopeKey/u);
  assert.doesNotMatch(areaWatchNotifications, /notificationEligibility|experienceManagedTaxonScopes|managedTaxonScopeKey/u);
  assert.match(alertDispatcher, /emitAreaWatchNotificationForObservation/u);
  assert.match(alertDispatcher, /emitInvasiveReportingForOccurrence/u);
  assert.match(alertDispatcher, /emitResearcherTrigger/u);
  assert.match(alertDispatcher, /emitUserTaxonMatches/u);
  assert.match(areaWatchNotifications, /insert into alert_deliveries/iu);
});
