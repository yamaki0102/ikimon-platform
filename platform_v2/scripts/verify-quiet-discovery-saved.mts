/** Synthetic local UI+SQLite journey. Never signs in as a real user or writes to a remote database. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "@playwright/test";
import { getStrings } from "../src/i18n/index.js";
import { renderLandingTopSections, LANDING_TOP_STYLES } from "../src/ui/landingTop.js";
import { renderSiteDocument } from "../src/ui/siteShell.js";
import { renderSavedReferencesView, renderSavedReferenceAction, SAVED_REFERENCE_STYLES } from "../src/ui/savedReferencesUi.js";
import { handleSavedReferences, type SavedReferenceDatabase } from "../cloudflare_shadow/src/savedReferencesNative.js";

const output = process.env.QUIET_DISCOVERY_QA_DIR;
if (!output || !output.startsWith("/")) throw new Error("Set QUIET_DISCOVERY_QA_DIR to an absolute directory outside the repository");
await mkdir(output, { recursive: true });
const root=resolve(import.meta.dirname,".."),sql=new DatabaseSync(":memory:");
sql.exec(await readFile(join(root,"cloudflare_shadow/migrations/core/0019_user_saved_references.sql"),"utf8"));
const db: SavedReferenceDatabase={prepare(query:string){let values:(string|number|null)[]=[];const stmt={bind(...args:(string|number|null)[]){values=args;return stmt;},async first<T>(){return (sql.prepare(query).get(...values)??null) as T|null;},async all<T>(){return {results:sql.prepare(query).all(...values) as T[]};},async run(){const result=sql.prepare(query).run(...values);return {meta:{changes:Number(result.changes)}};}};return stmt;}};
const strings=getStrings("ja");
const snapshot={viewerUserId:"synthetic-a",stats:{observationCount:0,speciesCount:0,placeCount:0},feed:[],myFeed:[],myPlaces:[],nearbyFields:[],nearbyEvents:[],mapPreviewCells:[],ambient:[],habit:null,dailyDashboard:null};
const home=renderLandingTopSections({basePath:"",lang:"ja",copy:strings.landing,fieldLoop:strings.fieldLoop,isLoggedIn:true,snapshot});
const shell=(body:string,title:string)=>renderSiteDocument({basePath:"",title,body,lang:"ja",currentPath:"/ja/",homeChrome:"member",shellClassName:"shell-bleed prototype-shell",extraStyles:LANDING_TOP_STYLES+SAVED_REFERENCE_STYLES,hideFooter:true});
let origin="",failedSource=false;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url||"/",origin),user=(req.headers.cookie||"").includes("fixture-user=b")?"synthetic-b":"synthetic-a";
  if(url.pathname.startsWith("/api/v1/me/saved")){
   const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
   const request=new Request(url,{method:req.method,headers:req.headers as Record<string,string>,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
   const result=await handleSavedReferences(request,db,{userId:user},async(target)=>({availability:failedSource?'unknown':'available',title:failedSource?null:'旅行で気になった店と、近くの体験（合成テスト）'}));
   res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return;
  }
  if(url.pathname==='/api/v1/me/alerts'){res.setHeader('content-type','application/json');res.end(JSON.stringify({alerts:[]}));return;}
  if(url.pathname==='/api/v1/auth/session'){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,session:{userId:user,displayName:'Synthetic',roleName:'member',rankLabel:null,banned:false,expiresAt:'2099-01-01T00:00:00.000Z'}}));return;}
  if(url.pathname.startsWith('/assets/brand/')){const name=url.pathname.split('/').at(-1)!;if(!/^[A-Za-z0-9._-]+$/.test(name))throw Error('invalid_asset');const data=await readFile(join(root,'../upload_package/public_html/assets/brand',name));res.setHeader('content-type',name.endsWith('.svg')?'image/svg+xml':'image/png');res.end(data);return;}
  let html:string;
  if(url.pathname.includes('/places/'))html=shell('<h1>旅先の候補（合成テスト）</h1>'+renderSavedReferenceAction('/places/fixture_place','ja'),'Synthetic source');
  else if(url.searchParams.get('view')==='saved')html=shell(renderSavedReferencesView('ja'),'保存したもの | ZUKAN');
  else html=shell(home.heroHtml+home.dailyDashboardHtml,'ホーム | ZUKAN');
  res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store');res.end(html);
 }catch(error){res.statusCode=500;res.end(String(error));}
});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();if(!address||typeof address==='string')throw Error('local_server_failed');origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const context=await browser.newContext({locale:'ja-JP',timezoneId:'Asia/Tokyo',viewport:{width:375,height:844},acceptDownloads:true});
const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.fulfill({status:204,body:''}));
const checks:string[]=[];let firstMutation:any;
page.on('request',request=>{if(request.url().endsWith('/api/v1/me/saved')&&request.method()==='POST'&&!firstMutation)firstMutation=request.postDataJSON();});
try{
 for(const width of [320,375,768,1280,1440]){
  await page.setViewportSize({width,height:844});await page.goto(origin+'/ja/');await page.getByRole('heading',{name:'見つける',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.site-login-link')).every(x=>x.getClientRects().length===0),{timeout:5000});
  assert.equal(await page.locator('[data-home-watch-updates]').isVisible(),false);
  if (!(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))) {
    await page.screenshot({path:join(output,`failure-home-${width}.png`),fullPage:true});
    console.log('OVERFLOW',JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(el=>({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect(),text:el.textContent?.slice(0,90)})).filter(x=>x.rect.width>0&&(x.rect.right>innerWidth+1||String(x.cls).match(/site-brand-cluster|brand-wordmark|zukan-app-language|lang-switch/))).slice(0,20))));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('.zukan-discovery-destinations a').count(),3);
  for(const link of await page.locator('.zukan-discovery-destinations a').all())assert.ok((await link.boundingBox())!.height>=44);
  await page.screenshot({path:join(output,`home-${width}.png`),fullPage:true});
 }
 checks.push('Home at 320/375/768/1280/1440: no overflow; stable three truthful entrances; >=44px targets; empty watch hidden');
 await page.setViewportSize({width:375,height:844});await page.goto(origin+'/ja/places/fixture_place');
 await page.getByRole('button',{name:'保存する',exact:true}).click();await page.getByRole('button',{name:'保存済み',exact:true}).waitFor();
 await page.getByRole('link',{name:'保存したものを見る'}).click();await page.locator('.zukan-saved-list li').waitFor();assert.equal(await page.locator('.zukan-saved-list li').count(),1);
 await page.reload();await page.locator('.zukan-saved-list li').waitFor();assert.equal(await page.locator('.zukan-saved-list li').count(),1);
 checks.push('actual native save API -> existing Records saved view -> reload retains one private reference');
 for(const width of [320,375,768,1280,1440]){
  await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(output,`saved-${width}.png`),fullPage:true});
 }
 await page.getByText('NOCOSILで使う',{exact:true}).click();await page.locator('.zukan-saved-list input').check();const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'選んだ候補を書き出す'}).click();const download=await downloadEvent;await download.saveAs(join(output,'synthetic-selected-export.json'));
 const bundle=JSON.parse(await readFile(join(output,'synthetic-selected-export.json'),'utf8'));assert.equal(bundle.records[0].recordType,'note');assert.equal(bundle.records[0].state,'candidate');assert.ok(!JSON.stringify(bundle).includes('synthetic-a'));
 checks.push('explicit selection exports native NOCOSIL candidate bundle; UI does not claim sync/import');
 await page.getByRole('button',{name:'保存を解除',exact:true}).click();await page.getByText('まだ保存したものはありません。',{exact:true}).waitFor();
 const stale=await page.evaluate(async(body)=>{const res=await fetch('/api/v1/me/saved',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return res.status;},firstMutation);assert.equal(stale,409);
 checks.push('remove hides item and stale browser retry cannot resurrect it');
 await context.addCookies([{name:'fixture-user',value:'b',url:origin}]);await page.reload();await page.getByText('まだ保存したものはありません。',{exact:true}).waitFor();assert.equal(await page.locator('.zukan-saved-list li').count(),0);
 checks.push('switching synthetic account does not expose previous account saved data');
 await context.clearCookies();await page.goto(origin+'/ja/places/fixture_place');await page.getByRole('button',{name:'保存する',exact:true}).click();await page.getByRole('button',{name:'保存済み',exact:true}).waitFor();failedSource=true;
 await page.goto(origin+'/ja/records?view=saved');await page.getByText('情報を確認できませんでした。',{exact:true}).first().waitFor();assert.equal(await page.locator('.zukan-saved-list input:enabled').count(),0);
 checks.push('source outage stays explicit; unavailable reference cannot be exported');
 assert.deepEqual(errors,[]);
 const result={result:'PASS',browserVersion:browser.version(),checks,pageErrors:errors,sourceBoundary:'synthetic local browser + actual current renderers/native saved API + in-memory SQLite; not staging/production'};
 await writeFile(join(output,'browser-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));sql.close();}
