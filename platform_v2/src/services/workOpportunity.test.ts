import assert from "node:assert/strict";
import test from "node:test";
import { findPublicWorkOpportunities, type PublicWorkOpportunity } from "./workOpportunity.js";
import { renderWorkOpportunityDiscovery } from "../ui/workOpportunity.js";

const base: PublicWorkOpportunity = { id:"opening-1",editionId:"edition-1",kind:"job",state:"open",title:"地域資料の整理",organizationName:"まちの資料館",placeName:"浜松市",relationshipLabel:"契約職員",payLabel:null,scheduleLabel:"週3日",summary:"地域資料を整理します。",sourceLabel:"まちの資料館 採用情報",sourceUrl:"https://example.org/jobs/1",publishedAt:"2026-09-01T00:00:00Z",validThrough:"2026-10-31T23:59:59Z",detailPath:"/jobs/opening-1" };

test("discovery excludes closed and expired editions and normalizes IME text", () => {
  const found = findPublicWorkOpportunities([base,{...base,id:"closed",state:"closed"},{...base,id:"expired",validThrough:"2026-08-01T00:00:00Z"}], {query:"地域資料",place:"浜松"}, new Date("2026-09-20T00:00:00Z"));
  assert.deepEqual(found.map(({id}) => id), ["opening-1"]);
});
test("unknown pay and evidence remain explicit", () => {
  const html=renderWorkOpportunityDiscovery({items:[base],query:{},state:"ready",currentPath:"/ja/jobs"});
  assert.match(html,/給与・報酬は公開情報で確認できません/); assert.match(html,/情報源と更新日/); assert.doesNotMatch(html,/応募済み|おすすめ|残りわずか/);
});
test("failure and zero results are distinct recoverable states", () => {
  const failed=renderWorkOpportunityDiscovery({items:[],query:{},state:"unavailable",currentPath:"/ja/jobs"});
  const empty=renderWorkOpportunityDiscovery({items:[],query:{query:"林業"},state:"ready",currentPath:"/ja/jobs?q=林業"});
  assert.match(failed,/仕事の情報を読み込めませんでした/); assert.match(failed,/もう一度読み込む/); assert.match(empty,/条件に合う仕事・職場・見学は見つかりませんでした/); assert.match(empty,/条件をクリア/);
});
import { readFileSync } from "node:fs";

const experience = readFileSync(
  new URL("../../../docs/spec/zukan-app-experience/WORK_OPPORTUNITY_EXPERIENCE_V1.md", import.meta.url),
  "utf8",
);
const acceptance = readFileSync(
  new URL("../../../docs/spec/zukan-app-experience/WORK_OPPORTUNITY_ACCEPTANCE_20260907.md", import.meta.url),
  "utf8",
);

test("work-opportunity acceptance does not promote proposed routes to a rendered pass", () => {
  assert.match(experience, /Proposed additions, not current routes/u);
  assert.match(acceptance, /判定: \*\*NOT ACCEPTED/u);
  assert.match(acceptance, /Noah の rendered acceptance を代行しない/u);
  assert.match(acceptance, /参照 prototype[^\n]+live auth・永続化・配送・公開可用性の証明にしない/u);
  assert.doesNotMatch(acceptance, /判定: \*\*(?:PASS|ACCEPTED)/u);
});

test("acceptance separates source, rendered, staging, production and transaction evidence", () => {
  for (const layer of [
    "Source",
    "Local rendered",
    "Staging",
    "Production",
    "Auth / persistence / delivery",
    "Noah rendered verdict",
  ]) {
    assert.match(acceptance, new RegExp(`\\| ${layer.replaceAll("/", "\\/")} \\|`, "u"), layer);
  }

  assert.match(acceptance, /proxy の HTTP 403/u);
  assert.match(acceptance, /403 を product response と解釈しない/u);
  assert.match(acceptance, /production mutation、dummy 応募、owner impersonation は行っていない/u);
});

test("acceptance keeps the complete responsive and recovery matrix pending", () => {
  for (const width of [320, 375, 768, 1024, 1160, 1161, 1280]) {
    const row = acceptance.split("\n").find((line) => line.startsWith(`| ${width}px |`));
    assert.ok(row?.endsWith("| **BLOCKED / NOT RUN** |"), `${width}px`);
  }

  for (const requirement of [
    "keyboard",
    "IME",
    "200% text",
    "safe area",
    "map failure",
    "empty",
    "load failure",
    "partial",
    "closed",
    "expired",
    "provider unknown",
    "44px",
  ]) {
    assert.ok(acceptance.includes(requirement), requirement);
  }
});

test("acceptance requires the real discovery-to-application transition before re-review", () => {
  for (const dependency of [
    "WFC-Z1",
    "active Worker",
    "materialized artifact",
    "allowlisted NOCOSIL guest/application",
    "同一 target",
    "重複送信防止",
    "Noah の明示的な verdict",
  ]) {
    assert.match(acceptance, new RegExp(dependency, "u"), dependency);
  }

  assert.match(acceptance, /クリック\/ブラウザ復帰だけでは `応募済み` にせず/u);
  assert.match(acceptance, /production へ synthetic\/dummy record を作らない/u);
});
