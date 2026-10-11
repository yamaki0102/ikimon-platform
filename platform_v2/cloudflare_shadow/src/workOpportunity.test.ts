import assert from "node:assert/strict";
import test from "node:test";
import { handleWorkOpportunityRequest } from "./workOpportunity";
import publicPresentationEntry from "./publicPresentationEntry";

const item={id:"opening-1",editionId:"edition-2026-09",kind:"job",state:"open",title:"地域資料の整理",organizationName:"まちの資料館",placeName:"浜松市",relationshipLabel:"契約職員",payLabel:null,scheduleLabel:"週3日",summary:"地域資料を整理します。",sourceLabel:"採用情報",sourceUrl:"https://example.org/jobs/1",publishedAt:"2026-09-01T00:00:00Z",validThrough:"2026-12-31T23:59:59Z",detailPath:"/ignored"};
const row=(payload:unknown, published_at="2026-09-01T00:00:00Z")=>({payload_json:JSON.stringify(payload),published_at});
function db(rows:ReturnType<typeof row>[],fail=false){const calls:{sql:string;values:unknown[]}[]=[];return {calls,prepare(sql:string){return {async all<T>(...values:unknown[]){calls.push({sql,values});if(fail)throw new Error("db unavailable");return {results:rows as T[]};}};}};}
const req=(path:string,method="GET")=>new Request(`https://zukan.earth${path}`,{method});

test("listing target resolves through the actual Worker presentation wrapper to its published public edition",async()=>{
 const database=db([row(item)]);const env={CORE_DB:database,ENVIRONMENT:"production"};
 const listing=await publicPresentationEntry.fetch(req("/ja/jobs"),env,{waitUntil(){}});
 assert.equal(listing.status,200);const listHtml=await listing.text();assert.match(listHtml,/href="\/ja\/jobs\/opening-1"/);
 const detail=await publicPresentationEntry.fetch(req("/ja/jobs/opening-1"),env,{waitUntil(){}});
 assert.equal(detail.status,200);assert.equal(detail.headers.get("cache-control"),"no-store");const html=await detail.text();assert.match(html,/地域資料の整理/);assert.match(html,/data-edition-id="edition-2026-09"/);assert.match(html,/https:\/\/example\.org\/jobs\/1/);assert.doesNotMatch(html,/応募する|応募フォーム/);
 assert.equal(database.calls.length,2);assert.match(database.calls[1]!.sql,/publication_state = 'published'/);assert.deepEqual(database.calls[1]!.values,["opening-1"]);
});

test("detail route rejects closed, expired, malformed, and mismatched editions",async()=>{
 const cases=[
  row({...item,state:"closed"}),row({...item,validThrough:"2020-01-01T00:00:00Z"}),row({...item,id:"another-id"}),
  row({...item,summary:{private:"leak"}}),row({...item,sourceUrl:"javascript:alert(1)"}),
 ];
 for(const bad of cases){const response=await handleWorkOpportunityRequest(req("/jobs/opening-1"),new URL("https://zukan.earth/jobs/opening-1"),db([bad]) as never);assert.equal(response,null);}
});

test("invalid route shapes do not widen lookup; database errors remain 503",async()=>{
 for(const path of ["/jobs/a/b","/jobs/%2Fprivate","/jobs/%2e%2e","/jobs/%ZZ"]){const response=await handleWorkOpportunityRequest(req(path),new URL(`https://zukan.earth${path}`),db([row(item)]) as never);assert.equal(response,null,path);}
 const failed=await handleWorkOpportunityRequest(req("/jobs/opening-1"),new URL("https://zukan.earth/jobs/opening-1"),db([],true) as never);assert.equal(failed?.status,503);assert.equal(await failed?.text(),"Service unavailable");
});

test("HEAD is read-only and returns no detail body",async()=>{
 const response=await handleWorkOpportunityRequest(req("/jobs/opening-1","HEAD"),new URL("https://zukan.earth/jobs/opening-1"),db([row(item)]) as never);
 assert.equal(response?.status,200);assert.equal(await response?.text(),"");
});
