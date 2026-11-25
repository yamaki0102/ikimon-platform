import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref } from "../i18n.js";
import type { SiteLang } from "../i18n.js";

export const ZUKAN_MAP_PHOTO_PINS_STYLES = `
.zk-pin{position:relative;width:48px;height:48px;cursor:pointer;}
.zk-pin-dot{display:block;width:48px;height:48px;border-radius:50%;border:3px solid #fff;background:#143F2E;box-shadow:0 2px 8px rgba(20,63,46,.35);overflow:hidden;box-sizing:border-box}
.zk-pin-dot img{display:block;width:100%;height:100%;object-fit:cover}
.zk-pin.is-on .zk-pin-dot{border-color:#143F2E;border-width:4px}
.zk-pin-label{position:absolute;left:50%;top:52px;transform:translateX(-50%);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis;padding:3px 9px;border-radius:999px;background:#fff;color:#1b1f1c;font:700 13px/1.3 system-ui,sans-serif;box-shadow:0 1px 5px rgba(0,0,0,.18)}
.zk-sheet{position:fixed;left:12px;right:12px;bottom:var(--ikimon-floating-bottom-space,84px);z-index:30;max-height:36vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 6px 24px rgba(20,63,46,.22);padding:12px;display:grid;gap:10px;align-content:start;font-family:inherit;color:#1b1f1c}
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
@media(min-width:960px){
.zk-sheet{left:auto;right:0;top:72px;bottom:0;width:340px;max-height:none;border-radius:0;box-shadow:-1px 0 0 #e6ebe7;padding:16px}
body:has(.zk-sheet:not([hidden])) .shell.shell-map{padding-right:340px!important;box-sizing:border-box}
}
`;

export function renderZukanMapPhotoPins(props: { basePath: string; lang: SiteLang }): string {
  const ja = props.lang === "ja";
  const api = withBasePath(props.basePath, "/api/v1/map/places");
  const placeHref = appendLangToHref(withBasePath(props.basePath, "/places/__ID__"), props.lang);
  const labels = ja
    ? { sheet: "近くの場所", view: "見る", records: "記録", open: "この場所を見る" }
    : { sheet: "Nearby places", view: "Open", records: "records", open: "Open place" };
  const cfg = JSON.stringify({ api, placeHref, labels }).replace(/</g, "\u003c");
  return `<style>${ZUKAN_MAP_PHOTO_PINS_STYLES}</style>
<aside class="zk-sheet" id="zk-map-sheet" data-zukan-map-sheet hidden aria-label="${labels.sheet}"></aside>
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
  try{var bd=m.getBounds(),vis=places.some(function(p){return typeof p.lat==='number'&&bd.contains([p.lng,p.lat])});
  if(!vis){var bb=new window.maplibregl.LngLatBounds();places.forEach(function(p){if(typeof p.lat==='number')bb.extend([p.lng,p.lat])});var mob=window.innerWidth<960;m.fitBounds(bb,{padding:{top:80,left:40,right:40,bottom:mob?Math.round(window.innerHeight*0.42):60},maxZoom:15,duration:0})}}catch(_){}
  if(typeof m.resize==='function')setTimeout(function(){m.resize()},60);
  return true;
}
fetch(C.api,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null}).then(function(d){
  if(!d||!d.places||!d.places.length)return;places=d.places;sel=places[0].placeId;render();
  var n=0,t=setInterval(function(){if(addPins()||++n>60)clearInterval(t)},500);
}).catch(function(){});
})();</script>`;
}
