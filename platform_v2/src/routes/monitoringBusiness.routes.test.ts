import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { monitoringBusinessRouteContract } from "./monitoringBusiness.js";

const routeSource = readFileSync(
  fileURLToPath(new URL("./monitoringBusiness.ts", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../app.ts", import.meta.url)),
  "utf8",
);
const sampleReportSource = readFileSync(
  fileURLToPath(new URL("./sampleReport.ts", import.meta.url)),
  "utf8",
);
const siteMapSource = readFileSync(
  fileURLToPath(new URL("../siteMap.ts", import.meta.url)),
  "utf8",
);

test("monitoring business page is a preparation-stage lead form", () => {
  assert.equal(monitoringBusinessRouteContract.publicApplyPath, "/for-business/monitoring/apply");
  assert.equal(monitoringBusinessRouteContract.submitEndpoint, "/api/v1/contact/submit");
  assert.match(routeSource, /\/for-business\/monitoring\/apply/);
  assert.match(routeSource, /\/api\/v1\/contact\/submit/);
  assert.doesNotMatch(routeSource, /monitoring_contract_applications/);
  assert.doesNotMatch(routeSource, /invoice\/generate/);
});

test("monitoring business page keeps preparation and boundary copy visible", () => {
  for (const phrase of monitoringBusinessRouteContract.readinessCopy) {
    assert.match(routeSource, new RegExp(phrase));
  }
  for (const phrase of monitoringBusinessRouteContract.requiredAcknowledgementCopy) {
    assert.match(routeSource, new RegExp(phrase));
  }
  assert.match(routeSource, /100万円\/年/);
  assert.match(routeSource, /50万円\/年/);
  assert.match(routeSource, /契約申込みの正式受付、請求、地域育成価格の承認ではありません/);
});

test("monitoring business route is registered without adding write endpoints", () => {
  assert.match(appSource, /registerMonitoringBusinessRoutes/);
  assert.match(appSource, /void registerMonitoringBusinessRoutes\(app\)/);
  assert.doesNotMatch(appSource, /registerMonitoringBusinessRoutes\(writeScope\)/);
  assert.doesNotMatch(routeSource, /app\.post/);
});

test("monitoring business entry points do not present the form as contract application", () => {
  assert.match(sampleReportSource, /先行相談へ/);
  assert.doesNotMatch(sampleReportSource, /申込みへ/);
  assert.match(siteMapSource, /ZUKAN Monitoring 先行相談/);
  assert.doesNotMatch(siteMapSource, /モニタリング契約申込み/);
});
