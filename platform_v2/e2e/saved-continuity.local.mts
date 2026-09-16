/** Local synthetic verification only: actual renderers and Worker use an ephemeral SQLite fixture.
 * No staging/production calls, real accounts, external media or durable user data are used.
 * Run from platform_v2: node --import tsx e2e/saved-continuity.local.mts
 * ZUKAN_SAVED_QA_DIR optionally retains screenshots/results outside the repository.
 */
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {chromium,expect} from '@playwright/test';
import worker,{renderRecordsProductSection,injectStateSplitHome} from '../cloudflare_shadow/src/index';
import {renderSavedPage} from '../cloudflare_shadow/src/quietHome';
import {listSavedItems,savedRecordStates,changeSavedItem,type SavedDatabase} from '../cloudflare_shadow/src/savedItems';
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation } from '../src/ui/appExperience';
import {getStrings} from '../src/i18n/index';
import {LANDING_TOP_STYLES,renderLandingTopSections} from '../src/ui/landingTop';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const dir=process.env.ZUKAN_SAVED_QA_DIR??mkdtempSync(resolve(tmpdir(),'zukan-saved-qa-'));mkdirSync(dir,{recursive:true});
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(root+'/cloudflare_shadow/migrations/core/0019_private_saved_items.sql','utf8'));
sqlite.exec(`CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,display_name TEXT,role_name TEXT,rank_label TEXT,banned INTEGER,expires_at TEXT,last_used_at TEXT)`);
for(const user of ['one','two'])sqlite.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?,?,?,NULL)').run(createHash('sha256').update(`fixture-token-${user}`).digest('hex'),user,user,'Observer',null,0,'2099-01-01T00:00:00.000Z');
const db={prepare(sql:string){const q=(values:unknown[]=[])=>({bind:(...args:unknown[])=>q(args),first:async()=>sqlite.prepare(sql).get(...values as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...values as never[])}),run:async()=>{const r=sqlite.prepare(sql).run(...values as never[]);return {success:true,meta:{changes:Number(r.changes)}};}});return q();}} as unknown as SavedDatabase;
const record={visitId:'fixture-photo-one',displayName:'旅先で残した記録（検証用）',observedAt:'2026-09-17T00:00:00.000Z',mediaKind:'memo',isAwaitingId:false,photoUrl:null,publicAreaLabel:'地域',ownerVisibility:'private'};
for(const [kind,id,path,title] of [['place','place-one','/places/place-one','旅行先の飲食店（検証用）'],['event','event-one','/events/event-one','週末の体験（検証用）'],['job','job-one','/jobs/job-one','気になった求人（検証用）']])await changeSavedItem(db,'one',{reference:{kind,objectId:id,path,title},state:'saved',expectedRevision:0,commandId:'seed-fixture-'+id});
const emptyObservations={prepare(){const stmt={bind(){return stmt;},async all(){return {results:[]};},async first(){return null;}};return stmt;}};
const localErrors:string[]=[];let origin='';
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url!,origin);const user=(req.headers.cookie??'').includes('fixture-token-two')?'two':'one';
 if(url.pathname.startsWith('/assets/brand/')){const file=root+'/../upload_package/public_html'+url.pathname;const content=readFileSync(file);res.setHeader('content-type',file.endsWith('.svg')?'image/svg+xml':'image/png');res.end(content);return;}
 if(url.pathname==='/api/v1/me/saved'){
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
  const request=new Request(url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,{CORE_DB:db,OBS_DB:db,ENVIRONMENT:'staging'} as never);res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());return;
 }
 if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({items:[],alerts:[],ok:true}));return;}
 if(url.pathname==='/favicon.ico'){res.statusCode=204;res.end();return;}
 if(url.pathname.startsWith('/assets/')||url.pathname.includes('service-worker')||url.pathname.includes('manifest')){res.statusCode=204;res.end();return;}
 const lang=url.searchParams.get('lang')??'ja';let body='';let home=false;
 if(url.pathname==='/ja/records'){
  body=url.searchParams.get('view')==='saved'?renderSavedPage(await listSavedItems(db,user),lang as never):renderRecordsProductSection([record] as never,url,'mine',{userId:user,banned:false} as never,false,await savedRecordStates(db,user,[record.visitId]));
 }else{
  home=true;const strings=getStrings('ja');const sections=renderLandingTopSections({basePath:'',lang:'ja',copy:strings.landing,fieldLoop:strings.fieldLoop,isLoggedIn:true,snapshot:{viewerUserId:user,stats:{observationCount:0,speciesCount:0,placeCount:0},feed:[],myFeed:[],myPlaces:[],nearbyFields:[],nearbyEvents:[],mapPreviewCells:[],ambient:[],habit:null,dailyDashboard:null}});
  body=sections.heroHtml+sections.dailyDashboardHtml;
  if(url.pathname!=='/before')body=await injectStateSplitHome(body,{userId:user,banned:false} as never,new URL(origin+'/ja/'),{CORE_DB:db,OBS_DB:emptyObservations,ZUKAN_QUIET_HOME_MODE:'enabled'} as never);
 }
 let html=`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ZUKAN local verification</title><style>body{margin:0;font-family:system-ui,sans-serif}main{max-width:1200px;margin:0 auto;padding:24px 20px 100px;box-sizing:border-box}${APP_EXPERIENCE_STYLES}${home?LANDING_TOP_STYLES:''}</style></head><body data-zukan-app-experience="home">${renderAppExperienceHeader('ja',home?0:1,true)}<main id="main-content">${body}</main>${renderAppExperienceNavigation('ja',home?0:1,'bottom',true)}</body></html>`;
 // No external telemetry/network in this synthetic verification server.
 html=html.replace(/<script[^>]+src="https?:[^>]+><\/script>/g,'');
 res.setHeader('content-type','text/html; charset=utf-8');res.end(html);
}catch(e){localErrors.push(String(e));res.statusCode=500;res.end('fixture error');}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+ (server.address() as {port:number}).port;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});const context=await browser.newContext();await context.addCookies([{name:'ikimon_v2_session',value:'fixture-token-one',url:origin}]);
await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:204,body:''}));
const page=await context.newPage();const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
const checks:unknown[]=[];
try{
 for(const width of [320,375,768,1160,1161,1280,1440]){await page.setViewportSize({width,height:900});
  for(const [name,path] of [['before','/before'],['after','/after'],['saved','/ja/records?view=saved']]){
   await page.goto(origin+path,{waitUntil:'networkidle'});await page.screenshot({path:dir+'/'+name+'-'+width+'.png',fullPage:true});
   const layout=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));if(layout.scroll>layout.client){console.log('OVERFLOW',name,width,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>document.documentElement.clientWidth}).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width,min:getComputedStyle(e).minWidth,display:getComputedStyle(e).display})).slice(0,14))));}expect(layout.scroll).toBeLessThanOrEqual(layout.client);
   if(name==='after')await expect(page.locator('[data-zukan-quiet-home]')).toBeVisible();checks.push({name,width,layout});
  }
 }
 await page.setViewportSize({width:375,height:900});await page.goto(origin+'/ja/records?view=mine');
 const save=page.locator('[data-zukan-save]').first();await expect(save).toHaveAttribute('aria-pressed','false');await save.click();await expect(save).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-zukan-saved-status]')).toContainText('ZUKANに保存しました');
 await page.reload();await expect(page.locator('[data-zukan-save]').first()).toHaveAttribute('aria-pressed','true');
 await page.goto(origin+'/ja/records?view=saved');const row=page.locator('[data-saved-item-row]').filter({hasText:record.displayName});await expect(row).toBeVisible();await row.getByRole('button').click();await expect(row).toHaveCount(0);await page.reload();await expect(page.locator('[data-saved-item-row]').filter({hasText:record.displayName})).toHaveCount(0);
 checks.push({journey:'actual Worker cookie -> save -> reload -> Saved -> remove -> reload',pass:true});
 // Failure must not claim success; retry keeps the exact desired-state command.
 await page.goto(origin+'/ja/records?view=mine');let failed=false;
 await page.route('**/api/v1/me/saved',async route=>{if(route.request().method()==='POST'&&!failed){failed=true;await route.fulfill({status:503,contentType:'application/json',body:'{"error":"fixture_failure"}'});}else await route.continue();});
 await page.locator('[data-zukan-save]').first().click();await expect(page.locator('[data-zukan-saved-status]')).toContainText('確認できませんでした');await expect(page.locator('[data-zukan-save]').first()).toHaveAttribute('aria-pressed','false');
 await page.locator('[data-zukan-save]').first().click();await expect(page.locator('[data-zukan-save]').first()).toHaveAttribute('aria-pressed','true');checks.push({journey:'503 does not show saved; deliberate retry succeeds',pass:true});
 const other=await browser.newContext();await other.addCookies([{name:'ikimon_v2_session',value:'fixture-token-two',url:origin}]);const otherPage=await other.newPage();await otherPage.goto(origin+'/ja/records?view=saved');await expect(otherPage.locator('[data-saved-item-row]')).toHaveCount(0);await other.close();checks.push({journey:'separate account cannot see saved items',pass:true});
 await page.goto(origin+'/after');await page.getByLabel('公開された記録を探す',{exact:true}).fill('旅行');await page.getByRole('button',{name:'探す',exact:true}).click();await expect(page).toHaveURL(/q=/);checks.push({journey:'native search routes to actual supported records, not a fake universal assistant',pass:true});
 await page.goto(origin+'/after',{waitUntil:'networkidle'});await expect(page.locator('[data-home-watch-updates]')).toBeHidden();
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('ikimon-record-draft',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('drafts')){db.close();reject(new Error('fixture_schema_absent'));return;}const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put({ownerKey:'user:one',metadata:{formValues:{note:'synthetic draft'}}},'latest:user:one');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeVisible();await expect(page.locator('[data-zukan-quiet-home]')).toBeVisible();
 await context.addCookies([{name:'ikimon_v2_session',value:'fixture-token-two',url:origin}]);await page.reload();await expect(page.locator('[data-home-primary-state="draft_resume"]')).toBeHidden();checks.push({journey:'owned draft is a compact recovery notice; another account cannot see it',pass:true});
 expect(pageErrors).toEqual([]);expect(localErrors).toEqual([]);
 writeFileSync(dir+'/result.json',JSON.stringify({status:'PASS',provenance:'LOCAL_SYNTHETIC_RENDERER_AND_REAL_WORKER_SQLITE_FIXTURE_NOT_STAGING',checks,pageErrors,localErrors},null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,screenshots:21,pageErrors},null,2));
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));sqlite.close();}
