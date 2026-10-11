import { isCurrentPublicWorkOpportunity, isPublicWorkOpportunityId, parsePublicWorkOpportunity, type PublicWorkOpportunity, type WorkOpportunityKind } from "../../src/services/workOpportunity";
import { renderWorkOpportunityDetail, renderWorkOpportunityDiscovery } from "../../src/ui/workOpportunity";

type Statement={all<T>(...values:unknown[]):Promise<{results:T[]}>};
type Database={prepare(query:string):Statement};
type Row={payload_json:string;published_at:string};
const LANG_PREFIX=/^\/(ja|en|es|pt-br)(?=\/)/i;
const safeText=(value:string|null,max=160):string=>value?.slice(0,max)??"";

async function load(db:Database):Promise<PublicWorkOpportunity[]>{
 const rows=await db.prepare("SELECT payload_json, published_at FROM work_opportunity_public_editions WHERE publication_state = 'published' ORDER BY published_at DESC").all<Row>();
 const now=new Date();
 return rows.results.flatMap((row)=>{try{const item=parsePublicWorkOpportunity(JSON.parse(row.payload_json),row.published_at);return item&&isCurrentPublicWorkOpportunity(item,now)?[item]:[];}catch{return [];}});
}

async function loadOne(db:Database,id:string):Promise<PublicWorkOpportunity|null>{
 const rows=await db.prepare("SELECT payload_json, published_at FROM work_opportunity_public_editions WHERE publication_state = 'published' AND CASE WHEN json_valid(payload_json) THEN json_extract(payload_json, '$.id') ELSE NULL END = ? ORDER BY published_at DESC LIMIT 1").all<Row>(id);
 const row=rows.results[0];
 if(!row)return null;
 try{const item=parsePublicWorkOpportunity(JSON.parse(row.payload_json),row.published_at);return item?.id===id&&isCurrentPublicWorkOpportunity(item,new Date())?item:null;}catch{return null;}
}

function listingReturnPath(url:URL,prefix:string):string {
 const q=new URLSearchParams();
 for(const key of ["q","place"]){const value=url.searchParams.get(key);if(value)q.set(key,safeText(value,100));}
 const kind=url.searchParams.get("kind");if(kind==="job"||kind==="workplace"||kind==="visit")q.set("kind",kind);
 const suffix=q.toString();return `${prefix}/jobs${suffix?`?${suffix}`:""}`;
}

export async function handleWorkOpportunityRequest(request:Request,url:URL,db:Database):Promise<Response|null>{
 const prefix=url.pathname.match(LANG_PREFIX)?.[0]??"";
 const pathname=url.pathname.slice(prefix.length)||"/";
 if(!["GET","HEAD"].includes(request.method))return null;
 if(pathname==="/jobs"||pathname==="/jobs/"){
  let items:PublicWorkOpportunity[]=[];let state:"ready"|"unavailable"="ready";
  try{items=await load(db);}catch{state="unavailable";}
  const raw=url.searchParams.get("kind");const kind:WorkOpportunityKind|"all"=raw==="job"||raw==="workplace"||raw==="visit"?raw:"all";
  const html=renderWorkOpportunityDiscovery({items,state,currentPath:url.pathname+url.search,query:{query:safeText(url.searchParams.get("q"),100),place:safeText(url.searchParams.get("place"),100),kind}});
  return new Response(request.method==="HEAD"?null:html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60","x-ikimon-cloudflare-native":"work-opportunity-public-editions"}});
 }
 const match=pathname.match(/^\/jobs\/([^/]+)$/);
 if(!match)return null;
 let id:string;
 try{id=decodeURIComponent(match[1]!);}catch{return null;}
 if(!isPublicWorkOpportunityId(id))return null;
 let item:PublicWorkOpportunity|null;
 try{item=await loadOne(db,id);}catch{return new Response("Service unavailable",{status:503,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"}});}
 if(!item)return null;
 const back=listingReturnPath(url,prefix);
 const html=renderWorkOpportunityDetail({item,currentPath:url.pathname,returnPath:back});
 return new Response(request.method==="HEAD"?null:html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=60","x-ikimon-cloudflare-native":"work-opportunity-public-editions"}});
}
