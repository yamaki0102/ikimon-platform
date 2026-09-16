import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { changeSavedItem, listSavedItems, handleSavedItemsRequest, savedReference, SavedItemError, type SavedDatabase } from "./savedItems";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0019_private_saved_items.sql",import.meta.url),"utf8"));
  const db = {prepare(sql:string){return {bind(...args:unknown[]){return {
    async first(){return sqlite.prepare(sql).get(...args as never[]) ?? null;},
    async all(){return {results:sqlite.prepare(sql).all(...args as never[])};},
    async run(){const result=sqlite.prepare(sql).run(...args as never[]);return {success:true,meta:{changes:Number(result.changes)}};}
  };}};}} as unknown as SavedDatabase;
  return {db,sqlite};
}
const reference={kind:"record",objectId:"record-1",path:"/ja/observations/record-1",title:"旅先の写真"};
const command=(revision=0,state="saved",id="command-save-0001")=>({reference,state,expectedRevision:revision,commandId:id});
const request=(body:unknown,headers:Record<string,string>={})=>new Request("https://zukan.earth/api/v1/me/saved",{
 method:"POST",headers:{origin:"https://zukan.earth","content-type":"application/json",...headers},body:JSON.stringify(body)});
const session={userId:"user-a",banned:false};

test("real SQLite: save, reload, remove and re-save retain one relationship and monotonic revision",async()=>{
 const {db,sqlite}=database();
 const saved=await changeSavedItem(db,"user-a",command(),"2026-09-17T00:00:00.000Z");
 assert.equal(saved.item.revision,1);assert.equal(saved.item.path,"/observations/record-1");
 assert.equal((await listSavedItems(db,"user-a")).items.length,1);
 const removed=await changeSavedItem(db,"user-a",command(1,"removed","command-remove-001"));
 assert.equal(removed.item.revision,2);assert.equal((await listSavedItems(db,"user-a")).items.length,0);
 assert.equal((await listSavedItems(db,"user-a",{includeRemoved:true})).items[0]!.state,"removed");
 await changeSavedItem(db,"user-a",command(2,"saved","command-resave-001"));
 assert.equal((sqlite.prepare("SELECT count(*) AS n FROM user_saved_items").get() as {n:number}).n,1);sqlite.close();
});
test("idempotent replay never toggles; old command cannot resurrect removed bookmark",async()=>{
 const {db,sqlite}=database();await changeSavedItem(db,"user-a",command());
 assert.equal((await changeSavedItem(db,"user-a",command())).replay,true);
 await changeSavedItem(db,"user-a",command(1,"removed","command-remove-001"));
 await assert.rejects(changeSavedItem(db,"user-a",command()),(e:unknown)=>e instanceof SavedItemError&&e.status===409);
 assert.equal((await listSavedItems(db,"user-a")).items.length,0);sqlite.close();
});
test("same command id with a different payload is rejected",async()=>{
 const {db,sqlite}=database();await changeSavedItem(db,"user-a",command());
 await assert.rejects(changeSavedItem(db,"user-a",{...command(),reference:{...reference,title:"different"}}),/saved_command_conflict/);sqlite.close();
});
test("real SQL CAS: only one concurrent writer changes a revision",async()=>{
 const {db,sqlite}=database();
 const results=await Promise.allSettled([changeSavedItem(db,"user-a",command()),changeSavedItem(db,"user-a",command(0,"saved","second-command-001"))]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal((await listSavedItems(db,"user-a")).items[0]!.revision,1);sqlite.close();
});
test("user isolation and forged ownership fields",async()=>{
 const {db,sqlite}=database();await changeSavedItem(db,"user-a",command());
 assert.deepEqual((await listSavedItems(db,"user-b")).items,[]);
 const read=await handleSavedItemsRequest(new Request("https://zukan.earth/api/v1/me/saved?kind=record&objectId=record-1"),db,{userId:"user-b",banned:false});
 assert.equal((await read.json() as {item:unknown}).item,null);
 const forged=await handleSavedItemsRequest(request({...command(),userId:"user-a"}),db,{userId:"user-b",banned:false});assert.equal(forged.status,400);
 await assert.rejects(changeSavedItem(db,"user-b",command(1,"removed","command-remove-001")),/saved_revision_conflict/);sqlite.close();
});
test("bounded keyset pagination including equal timestamps",async()=>{
 const {db,sqlite}=database();
 for(let i=0;i<5;i++) await changeSavedItem(db,"user-a",{...command(),commandId:`pagination-id-${i}`,reference:{...reference,objectId:`id-${i}`,path:`/observations/id-${i}`}},"2026-09-17T00:00:00.000Z");
 const first=await listSavedItems(db,"user-a",{limit:2});const second=await listSavedItems(db,"user-a",{limit:2,cursor:first.nextCursor!});const last=await listSavedItems(db,"user-a",{limit:2,cursor:second.nextCursor!});
 assert.equal(new Set([...first.items,...second.items,...last.items].map(x=>x.objectId)).size,5);assert.equal(last.nextCursor,null);sqlite.close();
});
for(const [kind,path] of [["place","/places/a"],["event","/community/events/a"],["job","/jobs/remote-a"],["offer","/offers/a"],["article","/articles/a"],["experience","/experiences/a"],["stay","/stays/a"],["learning","/learning/a"],["service","/services/a"],["organization","/organizations/a"]]){
 test(`reference preserves domain ${kind}, without Observation fields`,()=>assert.equal(savedReference({kind,objectId:"a",path,title:"saved"}).kind,kind));
}
for(const path of ["//evil.test/observations/record-1","https://zukan.earth/observations/record-1","/observations/record-1?token=secret","/observations/record-1#private","/observations/../private","/observations/%2frecord-1","/login/record-1","/jobs/record-1","/observations/record-11"]){
 test(`unsafe or mismatched locator rejected: ${path}`,()=>assert.throws(()=>savedReference({...reference,path}),/saved_path_invalid/));
}
test("GET is read-only and headers are private; no NOCOSIL success claim",async()=>{
 const {db,sqlite}=database();const response=await handleSavedItemsRequest(new Request("https://zukan.earth/api/v1/me/saved"),db,session);
 assert.equal(response.headers.get("cache-control"),"private, no-store");
 const body=await response.json() as {nocosilConnection:string;items:unknown[]};assert.equal(body.nocosilConnection,"not_connected");assert.deepEqual(body.items,[]);
 assert.equal((sqlite.prepare("SELECT count(*) AS n FROM user_saved_items").get() as {n:number}).n,0);sqlite.close();
});
for(const [name,auth,headers,status] of [["unauthenticated",null,{},401],["banned",{...session,banned:true},{},401],["cross-origin",session,{origin:"https://evil.test"},403],["missing-origin",session,{origin:""},403],["cross-site",session,{"sec-fetch-site":"cross-site"},403],["plain-text",session,{"content-type":"text/plain"},415]] as const){
 test(`HTTP rejects ${name}`,async()=>{const {db,sqlite}=database();assert.equal((await handleSavedItemsRequest(request(command(),headers),db,auth)).status,status);sqlite.close();});
}
test("size limits include chunked bodies; invalid JSON, revisions, unknown fields fail",async()=>{
 const {db,sqlite}=database();
 assert.equal((await handleSavedItemsRequest(request({large:"x".repeat(5000)}),db,session)).status,413);
 assert.equal((await handleSavedItemsRequest(request({...command(),expectedRevision:-1}),db,session)).status,400);
 assert.equal((await handleSavedItemsRequest(request({...command(),visibility:"public"}),db,session)).status,400);
 assert.equal((await handleSavedItemsRequest(new Request("https://zukan.earth/api/v1/me/saved?limit=9999"),db,session)).status,400);
 assert.equal((await handleSavedItemsRequest(new Request("https://zukan.earth/api/v1/me/saved?cursor=broken"),db,session)).status,400);sqlite.close();
});
test("missing migration is 503, never empty data or success",async()=>{
 const db={prepare(){throw new Error("no such table");}} as unknown as SavedDatabase;
 assert.equal((await handleSavedItemsRequest(new Request("https://zukan.earth/api/v1/me/saved"),db,session)).status,503);
 assert.equal((await handleSavedItemsRequest(request(command()),db,session)).status,503);
});
