import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref } from "../i18n.js";
import type { SiteLang } from "../i18n.js";

export const ZUKAN_MAP_TOP_STYLES = `
.shell.shell-map .map-explorer{position:relative}
.shell.shell-map .me-topbar{position:absolute;top:10px;left:12px;right:12px;z-index:40;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;display:grid;gap:8px;pointer-events:none}
.shell.shell-map .me-topbar>*{pointer-events:auto}
.shell.shell-map .me-topbar-primary{display:block!important;padding:0!important}
.shell.shell-map .me-map-kicker,.shell.shell-map .me-tabs,.shell.shell-map .me-map-role-strip{display:none!important}
.shell.shell-map .me-search-shell{background:#f7f8f4!important;border:0!important;border-radius:999px!important;box-shadow:0 2px 10px rgba(20,63,46,.2)!important;min-height:48px;max-width:none;width:100%;box-sizing:border-box}
.shell.shell-map .me-search-icon{font-size:0!important;width:22px;height:22px;flex:none;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23143F2E' stroke-width='2' stroke-linecap='round'><circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/></svg>") center/contain no-repeat}
.shell.shell-map .me-topbar-secondary{justify-self:start}
.shell.shell-map .me-filter-toggle{min-height:40px;padding:0 16px;border-radius:999px;background:#fff!important;color:#143F2E!important;border:0!important;font-weight:700;box-shadow:0 1px 6px rgba(20,63,46,.2)}
.shell.shell-map .maplibregl-ctrl-top-right{top:64px}
@media(max-width:959px){.shell.shell-map .maplibregl-ctrl-bottom-right{bottom:0!important}}
@media(min-width:960px){.shell.shell-map .me-topbar{left:72px;right:auto;width:520px}.shell.shell-map .maplibregl-ctrl-top-right{top:0}}
`;

export const ZUKAN_MAP_PHOTO_PINS_STYLES = ZUKAN_MAP_TOP_STYLES + `
.zk-pin{position:relative;width:48px;height:48px;cursor:pointer}
.zk-pin-dot{display:block;width:48px;height:48px;border-radius:50%;border:3px solid #fff;background:#143F2E;box-shadow:0 2px 8px rgba(20,63,46,.35);overflow:hidden;box-sizing:border-box}
.zk-pin-dot img{display:block;width:100%;height:100%;object-fit:cover}
.zk-pin.is-on .zk-pin-dot{border-color:#143F2E;border-width:4px}
.zk-pin-label{position:absolute;left:50%;top:52px;transform:translateX(-50%);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;padding:3px 9px;border-radius:999px;background:#fff;color:#1b1f1c;font:700 13px/1.3 system-ui,sans-serif;box-shadow:0 1px 5px rgba(0,0,0,.18)}
.zk-sheet{position:fixed;left:12px;right:12px;bottom:calc(var(--ikimon-floating-bottom-space,84px) + 30px);z-index:30;max-height:34vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(20,63,46,.22);padding:12px;display:grid;gap:10px;align-content:start;font-family:inherit;color:#1b1f1c}
.zk-sheet[hidden]{display:none}
.zk-card{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
.zk-thumb{flex:none;width:64px;height:64px;border-radius:12px;overflow:hidden;background:#e8efe9;display:block}
.zk-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.zk-card-main{flex:1;min-width:0;display:grid;gap:2px}
.zk-card-main strong{font-size:17px;line-height:1.3}
.zk-card-main span{font-size:13px;color:#5b655f}
.zk-go{flex:none;min-height:44px;padding:0 20px;border-radius:12px;background:#143F2E;color:#fff;font-weight:700;display:inline-flex;align-items:center;text-decoration:none}
.zk-sheet h2{margin:2px 0 0;font-size:16px}
.zk-rows{display:grid;gap:0}
.zk-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #e6ebe7;text-decoration:none;color:inherit;min-height:44px}
.zk-row .zk-thumb{width:56px;height:56px}
.zk-latest{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;padding:8px;border-radius:12px;background:#f7f8f4}
.zk-latest small{font-size:12px;color:#5b655f}
.zk-geo{position:fixed;left:24px;right:24px;top:30vh;z-index:45;max-width:360px;margin:0 auto;background:#fff;border-radius:24px;box-shadow:0 10px 36px rgba(20,63,46,.28);padding:26px 22px;text-align:center;display:grid;gap:12px;justify-items:center;color:#1b1f1c}
.zk-geo[hidden]{display:none}
.zk-geo-ic{width:58px;height:58px;border-radius:50%;background:#eef1ed;display:grid;place-items:center}
.zk-geo h2{margin:0;font-size:19px}
.zk-geo p{margin:0;font-size:14px;line-height:1.7;color:#5b655f}
.zk-geo button{font:inherit;cursor:pointer}
.zk-geo-main{width:100%;min-height:52px;border:0;border-radius:16px;background:#143F2E;color:#fff;font-weight:700;font-size:16px}
.zk-geo-sub{background:none;border:0;color:#143F2E;font-weight:700;min-height:44px;font-size:15px}
@media(min-width:960px){
.zk-sheet{left:auto;right:0;top:72px;bottom:0;width:340px;max-height:none;border-radius:0;box-shadow:-1px 0 0 #e6ebe7;padding:16px}
body:has(.zk-sheet:not([hidden])) .shell.shell-map{padding-right:340px!important;box-sizing:border-box}
}
`;

export function renderZukanMapPhotoPins(props: { basePath: string; lang: SiteLang }): string {
  const ja = props.lang === "ja";
  const api = withBasePath(props.basePath, "/api/v1/map/places");
  const placeHref = appendLangToHref(withBasePath(props.basePath, "/places/__ID__"), props.lang);
  const obsHref = appendLangToHref(withBasePath(props.basePath, "/observations/__ID__"), props.lang);
  const labels = ja
    ? { sheet: "近くの場所", view: "見る", records: "記録", latest: "最新の記録", unknown: "未同定", geoTitle: "位置情報がオフになっています", geoBody: "オンにすると、近くの場所やいまいる場所が分かります。", geoOpen: "設定を開く", geoName: "名前で探す", geoHelp: "ブラウザの設定で位置情報を許可してください。" }
    : { sheet: "Nearby places", view: "Open", records: "records", latest: "Latest record", unknown: "Unidentified", geoTitle: "Location is off", geoBody: "Turn it on to find places near you.", geoOpen: "Open settings", geoName: "Search by name", geoHelp: "Allow location in your browser settings." };
  const cfg = JSON.stringify({ api, placeHref, obsHref, labels }).replace(/</g, "\\u003c");
  const pinIcon = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#143F2E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  return `<style>${ZUKAN_MAP_PHOTO_PINS_STYLES}</style>
<aside class="zk-sheet" id="zk-map-sheet" data-zukan-map-sheet hidden aria-label="${labels.sheet}"></aside>
<section class="zk-geo" id="zk-geo-off" data-zukan-geo-off hidden role="dialog" aria-label="${labels.geoTitle}"><span class="zk-geo-ic">${pinIcon}</span><h2>${labels.geoTitle}</h2><p>${labels.geoBody}</p><button type="button" class="zk-geo-main" id="zk-geo-retry">${labels.geoOpen}</button><button type="button" class="zk-geo-sub" id="zk-geo-name">${labels.geoName}</button></section>
<script>(function(){
var C=${cfg},sheet=document.getElementById('zk-map-sheet');if(!sheet||typeof fetch!=='function')return;
var places=[],markers={},sel=null;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function href(p){return C.placeHref.replace('__ID__',encodeURIComponent(p.placeId))}
function thumb(p){return p.photoAssetId?'<span class="zk-thumb"><img src="/thumb/400/'+encodeURIComponent(p.photoAssetId)+'" alt="" loading="lazy" decoding="async"></span>':'<span class="zk-thumb"></span>'}
function meta(p){return C.labels.records+' '+(p.recordCount||0)+(C.labels.records==='records'?'':'件')}
function render(){
  var s=places.filter(function(p){return p.placeId===sel})[0]||places[0];if(!s){sheet.hidden=true;return}
  var h='<div class="zk-card" data-zk-selected="'+esc(s.placeId)+'">'+thumb(s)+'<div class="zk-card-main"><strong>'+esc(s.name)+'</strong><span>'+esc(meta(s))+'</span></div><a class="zk-go" href="'+esc(href(s))+'">'+esc(C.labels.view)+'</a></div>';
  var L=s.latestRecord;
  if(L){var lab=!L.label||/^unidentified$/i.test(L.label)?C.labels.unknown:L.label,dt=L.observedAt?new Date(L.observedAt):null,ds=dt&&!isNaN(dt)?(dt.getMonth()+1)+'月'+dt.getDate()+'日':'';
    h+='<a class="zk-latest" data-zk-latest href="'+esc(C.obsHref.replace('__ID__',encodeURIComponent(L.observationId)))+'">'+thumb({photoAssetId:L.photoAssetId})+'<div class="zk-card-main"><small>'+esc(C.labels.latest)+'</small><strong>'+esc(lab)+'</strong><span>'+esc(ds)+'</span></div></a>'}
  h+='<h2>'+esc(C.labels.sheet)+'</h2><div class="zk-rows">'+places.map(function(p){return '<a class="zk-row" href="'+esc(href(p))+'">'+thumb(p)+'<div class="zk-card-main"><strong>'+esc(p.name)+'</strong><span>'+esc(meta(p))+'</span></div></a>'}).join('')+'</div>';
  sheet.innerHTML=h;sheet.hidden=false;
  Object.keys(markers).forEach(function(id){markers[id].getElement().classList.toggle('is-on',id===s.placeId)});
}
function pinEl(p){
  var el=document.createElement('div');el.className='zk-pin';el.setAttribute('data-zk-pin',p.placeId);
  el.innerHTML='<span class="zk-pin-dot">'+(p.photoAssetId?'<img src="/thumb/400/'+encodeURIComponent(p.photoAssetId)+'" alt="" decoding="async">':'')+'</span><span class="zk-pin-label">'+esc(p.name)+'</span>';
  el.addEventListener('click',function(e){e.stopPropagation();sel=p.placeId;render()});
  return el;
}
function addPins(){
  var b=window.__ikimonMapBoot,m=b&&b.state&&b.state.map;
  if(!m||!window.maplibregl||typeof m.getCanvas!=='function'){return false}
  places.forEach(function(p){if(markers[p.placeId]||typeof p.lat!=='number'||typeof p.lng!=='number')return;markers[p.placeId]=new window.maplibregl.Marker({element:pinEl(p),anchor:'center'}).setLngLat([p.lng,p.lat]).addTo(m)});
  render();
  try{var bd=m.getBounds(),mob0=window.innerWidth<960,ch=m.getContainer().clientHeight,vis=places.some(function(p){if(typeof p.lat!=='number'||!bd.contains([p.lng,p.lat]))return false;return !(mob0&&m.project([p.lng,p.lat]).y>ch*0.58)});
  if(!vis){var bb=new window.maplibregl.LngLatBounds();places.forEach(function(p){if(typeof p.lat==='number')bb.extend([p.lng,p.lat])});var mob=window.innerWidth<960;m.fitBounds(bb,{padding:{top:80,left:40,right:40,bottom:mob?Math.round(window.innerHeight*0.42):60},maxZoom:15,duration:0})}}catch(_){}
  if(typeof m.resize==='function')setTimeout(function(){m.resize()},60);
  return true;
}
var geo=document.getElementById('zk-geo-off');
if(geo){
  if(navigator.permissions&&navigator.permissions.query){try{navigator.permissions.query({name:'geolocation'}).then(function(st){var upd=function(){geo.hidden=st.state!=='denied'};upd();st.onchange=upd}).catch(function(){})}catch(_){}}
  document.getElementById('zk-geo-name').addEventListener('click',function(){geo.hidden=true;var i=document.getElementById('me-search-input');if(i)i.focus()});
  document.getElementById('zk-geo-retry').addEventListener('click',function(){var t=geo.querySelector('p');if(navigator.geolocation)navigator.geolocation.getCurrentPosition(function(){geo.hidden=true},function(){if(t)t.textContent=C.labels.geoHelp})});
}
fetch(C.api,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null}).then(function(d){
  if(!d||!d.places||!d.places.length)return;places=d.places;sel=places[0].placeId;render();
  var n=0,t=setInterval(function(){if(addPins()||++n>60)clearInterval(t)},500);
}).catch(function(){});
})();</script>`;
}
