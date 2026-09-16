import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSavedReferences, type SavedReferenceDatabase, type SavedSourceResolver } from "./savedReferencesNative";
import { parseSavedTarget, savedSnapshotBundle } from "../../src/services/savedReference";
import { worker, withAiContentPolicy, injectSavedReferenceActionResponse } from "./index";
const migration=readFileSync(new URL("../migrations/core/0019_user_saved_references.sql",import.meta.url),"utf8");
function fixture(schema=true) {
 const sql=new DatabaseSync(":memory:");if(schema)sql.exec(migration);
 const db:SavedReferenceDatabase={prepare(query:string){let values:(string|number|null)[]=[];const stmt={bind(...args:(string|number|null)[]){values=args;return stmt;},async first<T>(){return (sql.prepare(query).get(...values)??null) as T|null;},async all<T>(){return {results:sql.prepare(query).all(...values) as T[]};},async run(){const r=sql.prepare(query).run(...values);return {meta:{changes:Number(r.changes)}};}};return stmt;}};
 const resolver:SavedSourceResolver=async()=>({availability:"available",title:"旅行先で気になった場所"});
 const call=(body?:unknown,user="user-a",path="",source=resolver)=>handleSavedReferences(new Request('https://zukan.test/api/v1/me/saved'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{origin:'https://zukan.test','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),db,{userId:user},source);
 return {sql,db,call,resolver};
}
const mutation=(saved=true,revision=0,id='mutation_0000000001',targetPath='/places/place_a')=>({targetPath,saved,expectedRevision:revision,mutationId:id});

test('private save -> reload -> remove; old retry cannot resurrect; no duplicate records',async()=>{
 const f=fixture();try{
  const created=await f.call(mutation());assert.equal(created.status,200);assert.match(created.headers.get('cache-control')!,/no-store/);assert.equal((await created.json() as any).item.revision,1);
  const duplicate=await f.call(mutation());assert.equal(duplicate.status,200);assert.equal((await duplicate.json() as any).replayed,true);
  assert.equal((await (await f.call()).json() as any).items.length,1);
  assert.equal((await (await f.call(undefined,'user-b')).json() as any).items.length,0);
  assert.equal((await f.call(mutation(false,1,'mutation_0000000002'))).status,200);
  assert.equal((await f.call(mutation())).status,409);
  assert.equal((await (await f.call()).json() as any).items.length,0);
  assert.equal((await f.call(mutation(true,2,'mutation_0000000003'))).status,200);
  assert.equal((await f.call(mutation(false,1,'mutation_0000000002'))).status,409);
  assert.equal((f.sql.prepare('SELECT count(*) AS n FROM user_saved_references').get() as any).n,1);
 }finally{f.sql.close();}
});

test('simultaneous independent saves use SQLite CAS, not last-write-wins',async()=>{
 const f=fixture();try{const results=await Promise.all([f.call(mutation()),f.call(mutation(true,0,'mutation_0000000002'))]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);}finally{f.sql.close();}
});

test('saved is not followed/visited/applied; supplied identity/metadata is rejected',async()=>{
 const f=fixture();try{for(const field of ['userId','title','workspace','visited','applied','sourceType'])assert.equal((await f.call({...mutation(),[field]:'other'})).status,400);assert.equal((await f.call({...mutation(),saved:'yes'})).status,400);}finally{f.sql.close();}
});

test('source withdrawal and temporary outage never leak previous title',async()=>{
 const f=fixture();try{await f.call(mutation());
  const unavailable:SavedSourceResolver=async()=>({availability:'unavailable',title:'SECRET OLD TITLE'});
  const data=await (await f.call(undefined,'user-a','',unavailable)).json() as any;
  assert.equal(data.items[0].title,null);assert.equal(data.items[0].availability,'unavailable');assert.equal(data.partial,false);
  const unknown=await (await f.call(undefined,'user-a','',async()=>{throw Error('outage');})).json() as any;assert.equal(unknown.items[0].title,null);assert.equal(unknown.partial,true);
  assert.equal((await f.call(mutation(true,0,'mutation_0000000009','/places/place_b'),'user-a','',unavailable)).status,404);
  assert.equal((await f.call({targets:['/places/place_a']},'user-a','/export',unavailable)).status,409);
  assert.equal((await f.call(mutation(false,1,'mutation_0000000004'),'user-a','',unavailable)).status,200);
 }finally{f.sql.close();}
});

test('same-origin writes, authentication, no arbitrary endpoint or secret locator',async()=>{
 const f=fixture();try{
  const req=new Request('https://zukan.test/api/v1/me/saved',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify(mutation())});assert.equal((await handleSavedReferences(req,f.db,{userId:'user-a'},f.resolver)).status,403);
  assert.equal((await handleSavedReferences(new Request('https://zukan.test/api/v1/me/saved'),f.db,null,f.resolver)).status,401);
  assert.equal((await handleSavedReferences(new Request('https://zukan.test/api/v1/me/saved'),f.db,{userId:'user-a',banned:true},f.resolver)).status,403);
  for(const targetPath of ['//evil.test/places/a','https://evil.test/places/a','/places/../api/me','/places/%2e%2e','/places/a?token=secret','/profile/a','/api/token','/places/a#private','/places/a\\b'])assert.equal((await f.call({...mutation(),targetPath})).status,400);
 }finally{f.sql.close();}
});

test('zero saves and unavailable storage are different',async()=>{
 const empty=fixture();try{assert.deepEqual((await (await empty.call()).json() as any).items,[]);}finally{empty.sql.close();}
 const missing=fixture(false);try{const res=await missing.call();assert.equal(res.status,503);assert.equal((await res.json() as any).error,'saved_references_unavailable');}finally{missing.sql.close();}
});

test('bounded stable pagination is private and can retrieve more than twenty',async()=>{
 const f=fixture();try{for(let i=0;i<23;i++)await f.call(mutation(true,0,'mutation_pagination_'+String(i).padStart(3,'0'),'/places/place_'+String(i).padStart(3,'0')));
  const first=await (await f.call()).json() as any;assert.equal(first.items.length,20);assert.ok(first.nextCursor);
  const last=await (await f.call(undefined,'user-a','?before='+encodeURIComponent(first.nextCursor))).json() as any;assert.equal(last.items.length,3);assert.equal(last.nextCursor,null);
  assert.equal(new Set([...first.items,...last.items].map(x=>x.key)).size,23);
  assert.equal((await f.call(undefined,'user-a','?before=garbage')).status,400);
 }finally{f.sql.close();}
});

test('explicit export matches native NOCOSIL snapshot contract and excludes identity/credentials',async()=>{
 const f=fixture();try{await f.call(mutation());await f.call(mutation(true,0,'mutation_0000000002','/observations/record_a'));
  const export1=await f.call({targets:['/places/place_a']},'user-a','/export');assert.equal(export1.status,200);const bundle=await export1.json() as any;
  const export2=await (await f.call({targets:['/places/place_a']},'user-a','/export')).json();assert.deepEqual(bundle,export2);
  assert.equal(bundle.records.length,1);assert.equal(bundle.records[0].recordType,'note');assert.equal(bundle.records[0].state,'candidate');assert.equal(bundle.sources[0].classification,'C2');assert.equal(bundle.records[0].claims[0].verification,'unverified');
  const json=JSON.stringify(bundle);assert.doesNotMatch(json,/user-a|token|workspace|private_media|record_a/);assert.match(json,/explicit_snapshot_not_account_link_or_live_sync/);
  assert.equal((await f.call({targets:['/places/place_a']},'user-b','/export')).status,409);
  assert.equal((await f.call({targets:[]},'user-a','/export')).status,400);
  assert.equal((await f.call(undefined,'user-a','/export')).status,405);
 }finally{f.sql.close();}
});

test('typed references do not collapse food/jobs/events into biological Observations',()=>{
 assert.deepEqual(parseSavedTarget('/en/places/place_a'),parseSavedTarget('/ja/places/place_a'));
 for(const [path,type] of [['/jobs/job_a','job'],['/events/event_a','event'],['/offers/offer_a','offer'],['/articles/article_a','article'],['/observations/record_a','record']])assert.equal(parseSavedTarget(path).type,type);
 assert.equal(parseSavedTarget('/places/new').type,'place'); // parser is not eligibility authority
});

test('active Worker dispatch rejects unauthenticated saved access before storage',async()=>{
 const env={ENVIRONMENT:'production',CORE_DB:{prepare(){throw new Error('No unauthenticated DB access');}}} as never;
 const res=await worker.fetch(new Request('https://zukan.earth/api/v1/me/saved'),env);assert.equal(res.status,401);assert.match(res.headers.get('cache-control')!,/no-store/);
 const policy=withAiContentPolicy(new Response('private'),new Request('https://zukan.earth/records?view=saved'),{ENVIRONMENT:'production'} as never);assert.match(policy.headers.get('x-robots-tag')!,/noindex/);
});


test('public detail save action reuses exact response CSP nonce and preserves original source', async()=>{
 const body='<html><head><title>Source</title></head><body><main><h1>Source</h1></main></body></html>';
 const req=new Request('https://zukan.earth/ja/places/fixture');
 const original=new Response(body,{headers:{'content-type':'text/html','content-security-policy':"script-src 'nonce-abcdefgh12345678'",etag:'old','content-length':String(body.length)}});
 const enhanced=await injectSavedReferenceActionResponse(original,req);const text=await enhanced.text();
 assert.match(text,/<h1>Source<\/h1>/);assert.match(text,/data-zukan-save-action/);assert.match(text,/<script nonce="abcdefgh12345678"/);assert.equal(enhanced.headers.get('content-security-policy'),original.headers.get('content-security-policy'));assert.equal(enhanced.headers.get('etag'),null);assert.equal(enhanced.headers.get('content-length'),null);
 assert.equal(await original.text(),body);
});

test('missing CSP nonce, non-detail and HEAD keep existing response without a broken save action',async()=>{
 for(const [path,method,csp] of [['/ja/places/fixture','GET',"script-src 'self'"],['/ja/profile','GET',"script-src 'nonce-abcdefgh12345678'"],['/ja/places/fixture','HEAD',"script-src 'nonce-abcdefgh12345678'"]]){
  const res=new Response('<main>Unchanged</main>',{headers:{'content-type':'text/html','content-security-policy':csp!}});
  assert.equal(await injectSavedReferenceActionResponse(res,new Request('https://zukan.earth'+path,{method})),res);
  assert.equal(await res.text(),'<main>Unchanged</main>');
 }
});
