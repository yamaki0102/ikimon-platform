import { createHash } from "node:crypto";
import type { HashedStaticAsset } from "./mapExplorerAssets.js";

const SCRIPT_BODY = `(function(){
'use strict';
var form=document.querySelector('form[data-place-year-band]');
if(!form)return;
var range=form.querySelector('input[type=range][name=year]');
var mapBtn=form.querySelector('button[name=map]');
var placeInput=form.querySelector('input[name=place]');
var out=form.querySelector('[data-pyb-year]');
var sub=form.querySelector('[data-pyb-sub]');
var status=document.querySelector('[data-pyb-status]');
var DATA=form.dataset;
var timer=0;
var seq=0;
function max(){return range?Number(range.max):0}
function yearFromRange(){if(!range)return null;var v=Number(range.value);return v>=max()?null:v}
function paint(year){
  if(out)out.textContent=year==null?DATA.labelNow:year+DATA.labelYear;
  if(sub)sub.textContent=year==null?'':DATA.labelUntil;
  if(range)range.setAttribute('aria-valuetext',year==null?DATA.labelNow:year+DATA.labelYear+' '+DATA.labelUntil);
}
function say(text){if(status)status.textContent=text||''}
function hrefFor(state){
  var p=new URLSearchParams();
  if(state.place)p.set('place',state.place);
  if(state.year!=null)p.set('year',String(state.year));
  if(state.map)p.set('map','1');
  var q=p.toString();
  return form.getAttribute('action')+(q?'?'+q:'');
}
function current(){
  return {place:placeInput?placeInput.value||null:null,year:yearFromRange(),map:!!mapBtn&&mapBtn.getAttribute('aria-pressed')==='true'};
}
function load(href){
  var id=++seq;
  var box=document.querySelector('[data-pyb-cards]');
  if(!box)return;
  say(DATA.labelLoading);
  var u=new URL(href,location.href);
  u.searchParams.set('fragment','cards');
  fetch(u.toString(),{credentials:'same-origin',headers:{accept:'text/html'}}).then(function(r){
    if(!r.ok)throw new Error(String(r.status));
    return r.text();
  }).then(function(h){
    if(id!==seq)return;
    box.innerHTML=h;
    say('');
  }).catch(function(){
    if(id!==seq)return;
    say(DATA.labelFailed);
  });
}
function apply(push){
  var state=current();
  var href=hrefFor(state);
  if(push)history.pushState(state,'',href);
  load(href);
}
function schedule(){clearTimeout(timer);timer=setTimeout(function(){apply(true)},150)}
if(range){
  range.addEventListener('input',function(){paint(yearFromRange());schedule()});
  range.addEventListener('change',function(){clearTimeout(timer);apply(true)});
}
if(mapBtn){
  mapBtn.addEventListener('click',function(e){
    e.preventDefault();
    var on=mapBtn.getAttribute('aria-pressed')!=='true';
    mapBtn.setAttribute('aria-pressed',on?'true':'false');
    mapBtn.value=on?'0':'1';
    apply(true);
    document.dispatchEvent(new CustomEvent('place-year-band:map',{detail:{on:on}}));
  });
}
window.addEventListener('popstate',function(){
  var p=new URL(location.href).searchParams;
  var y=/^\d{4}$/.test(p.get('year')||'')?Number(p.get('year')):null;
  if(range)range.value=String(y==null?max():Math.min(Math.max(y,Number(range.min)),max()));
  if(placeInput&&p.get('place'))placeInput.value=p.get('place');
  if(mapBtn){var on=p.get('map')==='1';mapBtn.setAttribute('aria-pressed',on?'true':'false');mapBtn.value=on?'0':'1'}
  paint(y);
  load(location.href);
});
form.addEventListener('submit',function(e){if(range||mapBtn){e.preventDefault();clearTimeout(timer);apply(true)}});
paint(yearFromRange());
})();
`;

let cached: HashedStaticAsset | null = null;

export function placeYearBandAsset(): HashedStaticAsset {
  if (cached) return cached;
  const content = Buffer.from(SCRIPT_BODY, "utf8");
  const sha256 = createHash("sha256").update(content).digest("hex");
  cached = {
    path: `/assets/ui/place-year-band.${sha256.slice(0, 12)}.js`,
    content,
    contentType: "application/javascript; charset=utf-8",
    etag: `"${sha256.slice(0, 24)}"`,
    sri: "",
  };
  return cached;
}
