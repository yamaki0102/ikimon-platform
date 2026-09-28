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
