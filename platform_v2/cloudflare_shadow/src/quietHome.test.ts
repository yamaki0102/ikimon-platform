import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import worker,{ injectStateSplitHome,renderRecordsProductSection,withAiContentPolicy } from "./index";
import { renderQuietHome,renderSavedPage,renderSavedControl } from "./quietHome";
import { changeSavedItem,type SavedDatabase,type SavedItem } from "./savedItems";
const item:SavedItem={kind:"job",objectId:"j1",path:"/jobs/j1",title:"地域の仕事",state:"saved",revision:1,savedAt:"2026-09-17T00:00:00.000Z",updatedAt:"2026-09-17T00:00:00.000Z"};
const template=`<html><body><div data-home-auth-state="guest"></div><main><div data-home-contract="state-split-v1"><div class="home-state-view is-guest" data-home-view="guest">guest</div><div class="home-state-view is-member" data-home-view="member" hidden><!-- ikimon-home-section:member-primary:start --><section>old</section><!-- ikimon-home-section:member-primary:end --><!-- ikimon-home-section:member-recent:start -->old-recent<!-- ikimon-home-section:member-recent:end --><!-- ikimon-home-section:member-routes:start -->old-routes<!-- ikimon-home-section:member-routes:end --><!-- ikimon-home-section:member-place:start -->old-place<!-- ikimon-home-section:member-place:end --></div></div></main></body></html>`;
function fixtureDatabase(){
 const sqlite=new DatabaseSync(":memory:");sqlite.exec(readFileSync(new URL("../migrations/core/0019_private_saved_items.sql",import.meta.url),"utf8"));
 sqlite.exec(`CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,display_name TEXT,role_name TEXT,rank_label TEXT,banned INTEGER,expires_at TEXT,last_used_at TEXT)`);
 const db={prepare(sql:string){const query=(values:unknown[]=[])=>({bind:(...args:unknown[])=>query(args),first:async()=>sqlite.prepare(sql).get(...values as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...values as never[])}),run:async()=>{const r=sqlite.prepare(sql).run(...values as never[]);return {success:true,meta:{changes:Number(r.changes)}};}});return query();}} as unknown as SavedDatabase;
 const source=readFileSync(new URL("./index.ts",import.meta.url),"utf8");const cookieName=source.match(/const SESSION_COOKIE_NAME = "([^"]+)"/)?.[1];assert.ok(cookieName);
 for(const user of ["one","two"]){sqlite.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?,?,?,?,NULL)").run(createHash("sha256").update(`fixture-token-${user}`).digest("hex"),user,user,"Observer",null,0,"2099-01-01T00:00:00.000Z");}
 return {db,sqlite,cookie:(user:string)=>`${cookieName}=fixture-token-${user}`};
}
test("quiet Home is finite, stable and truthful about supported discovery",()=>{
 const html=renderQuietHome({lang:"ja",saved:{items:Array.from({length:20},()=>item)},recentHtml:""});
 assert.equal((html.match(/class="qh-item"/g)||[]).length,3);assert.match(html,/公開された記録を探す/);
 assert.match(html,/map\?tab=places/);assert.match(html,/community\/events/);assert.match(html,/records\?view=saved/);
 assert.doesNotMatch(html,/infinite|carousel|navigator.geolocation|NOCOSILに保存しました|href="\/ja\/food"|href="\/ja\/jobs"/);
 assert.equal((html.match(/<h1>/g)||[]).length,1);
});
test("saved categories retain their own meaning, without domain narrowing",()=>{
 const html=renderSavedPage({items:[item,{...item,kind:"place",objectId:"p1",path:"/places/p1",title:"旅先の飲食店"},{...item,kind:"event",objectId:"e1",path:"/events/e1",title:"週末の企画"}],nextCursor:null},"ja");
 for(const text of ["求人","場所","イベント","保存を解除","予約・応募・参加の申込みは行いません"])assert.ok(html.includes(text));
});
test("all supported UI languages have named save controls and no raw state keys",()=>{
 for(const lang of ["ja","en","es","pt-br"] as const){const html=renderSavedPage({items:[item],nextCursor:null},lang);assert.match(html,/aria-label=/);assert.doesNotMatch(html,/undefined|\[object Object\]/);}
});
test("unavailable data is not an empty library or a false synchronization result",()=>{
 assert.match(renderSavedPage(null,"ja"),/読み込めませんでした/);assert.doesNotMatch(renderSavedPage(null,"ja").replace(/<script>[\s\S]*?<\/script>/g,""),/気になるものを保存すると/);
 assert.match(renderQuietHome({lang:"ja",saved:null,recentHtml:""}),/読み込めませんでした/);
});
test("saved targets are revalidated without deleting the private relationship",()=>{
 const html=renderSavedPage({items:[item],nextCursor:null},"ja");
 assert.match(html,/data-saved-target-state="unknown"/);
 assert.match(html,/method:'HEAD'/);
 assert.match(html,/公開情報は現在利用できません/);
 assert.match(html,/data-zukan-save/);
});
test("titles and reference attributes are escaped",()=>{
 const html=renderSavedControl({...item,title:'"><img src=x onerror=alert(1)>'},"ja",item);
 assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.match(html,/data-saved-reference="\{&quot;/);
});
test("real Worker dispatcher authenticates actual cookie and scopes Saved writes/reads",async()=>{
 const {db,sqlite,cookie}=fixtureDatabase();const env={ENVIRONMENT:"staging",CORE_DB:db,OBS_DB:db};
 const input={reference:{kind:"job",objectId:"j1",path:"/jobs/j1",title:"地域の仕事"},state:"saved",expectedRevision:0,commandId:"worker-route-save-one"};
 const post=await worker.fetch(new Request("https://zukan.earth/api/v1/me/saved",{method:"POST",headers:{cookie:cookie("one"),origin:"https://zukan.earth","content-type":"application/json"},body:JSON.stringify(input)}),env as never);
 assert.equal(post.status,200,await post.clone().text());
 for(const [user,count] of [["one",1],["two",0]] as const){const read=await worker.fetch(new Request("https://zukan.earth/api/v1/me/saved",{headers:{cookie:cookie(user)}}),env as never);assert.equal(read.status,200);assert.equal((await read.json() as {items:unknown[]}).items.length,count);}
 const guest=await worker.fetch(new Request("https://zukan.earth/api/v1/me/saved"),env as never);assert.equal(guest.status,401);sqlite.close();
});
test("new Home joins live data only when explicitly enabled; guest and old mode untouched",async()=>{
 const {db,sqlite}=fixtureDatabase();await changeSavedItem(db,"one",{reference:{kind:"job",objectId:"j1",path:"/jobs/j1",title:"地域の仕事"},state:"saved",expectedRevision:0,commandId:"home-save-one-0001"});
 const env={ENVIRONMENT:"staging",CORE_DB:db,OBS_DB:db,ZUKAN_QUIET_HOME_MODE:"enabled"};
 const signed=await injectStateSplitHome(template,{userId:"one",banned:false} as never,new URL("https://zukan.earth/ja"),env as never);
 assert.match(signed,/data-zukan-quiet-home/);assert.match(signed,/地域の仕事/);assert.doesNotMatch(signed,/old-recent|old-routes|old-place/);
 const guest=await injectStateSplitHome(template,null,new URL("https://zukan.earth/ja"),env as never);assert.doesNotMatch(guest,/地域の仕事|data-zukan-quiet-home/);
 const old=await injectStateSplitHome(template,{userId:"one",banned:false} as never,new URL("https://zukan.earth/ja"),{...env,ZUKAN_QUIET_HOME_MODE:"disabled"} as never);assert.doesNotMatch(old,/data-zukan-quiet-home/);sqlite.close();
});
test("native records renderer includes independent save buttons, not nested interactive links",()=>{
 const record={visitId:"record-one",displayName:"旅先の記録",observedAt:"2026-09-17T00:00:00.000Z",mediaKind:"photo",isAwaitingId:false,photoUrl:null,publicAreaLabel:"地域",ownerVisibility:"public"};
 const html=renderRecordsProductSection([record] as never,new URL("https://zukan.earth/ja/records?view=public"),"public",{userId:"one",banned:false} as never,false,new Map());
 assert.match(html,/data-zukan-save/);assert.match(html,/data-zukan-saved-status/);assert.match(html,/records\?view=saved/);
 const start=html.indexOf('data-zukan-save');assert.ok(html.lastIndexOf('</a>',start)>html.lastIndexOf('<a ',start));
});

test("saved view is explicitly private even without a session header",()=>{const result=withAiContentPolicy(new Response("fixture"),new Request("https://zukan.earth/ja/records?view=saved"),{ENVIRONMENT:"production"});assert.match(result.headers.get("content-signal")??"",/search=no/);assert.match(result.headers.get("x-robots-tag")??"",/noindex/);});

test("Saved controls serialize a reference, not the entire stored item",()=>{const html=renderSavedControl(item,"ja",item);const attribute=html.match(/data-saved-reference="([^"]+)"/)![1]!;const ref=JSON.parse(attribute.replaceAll("&quot;",'"').replaceAll("&amp;","&"));assert.deepEqual(Object.keys(ref),["kind","objectId","path","title"]);});
