import { escapeHtml } from "./siteShell.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { withBasePath } from "../httpBasePath.js";

const words = {
  ja: { title:"保存したもの", intro:"気になる場所や企画を、あとから見返せます。保存は公開されません。", home:"ホーム", mine:"自分の記録", discover:"見つける", places:"場所を探す", events:"参加できる企画", public:"みんなの記録", search:"記録を探す", query:"記録のキーワード", placeholder:"風景、店、出来事など", saved:"保存済み", save:"保存する", remove:"保存を解除", loading:"読み込んでいます。", empty:"まだ保存したものはありません。", unavailable:"現在は表示できない項目", unknown:"情報を確認できませんでした。", error:"読み込みに失敗しました。もう一度お試しください。", retry:"再読み込み", more:"続きを見る", export:"選んだ候補を書き出す", exportNote:"NOCOSILの取り込みに使えるファイルです。自動連携はまだ行いません。", exportDone:"選んだ候補を書き出しました。NOCOSILへの取り込みはまだ行っていません。", changed:"別の画面で更新されています。読み直してから操作してください。", fail:"保存状態を変更できませんでした。", login:"保存するにはログインしてください。", select:"書き出す候補を選択", openSaved:"保存したものを見る", useNocosil:"NOCOSILで使う" },
  en: { title:"Saved", intro:"Return to places and programs that interest you. Your saves are private.", home:"Home", mine:"My records", discover:"Discover", places:"Explore places", events:"Find programs", public:"Public records", search:"Search records", query:"Record keywords", placeholder:"Places, moments, discoveries", saved:"Saved", save:"Save", remove:"Remove save", loading:"Loading…", empty:"Nothing saved yet.", unavailable:"This item is no longer available", unknown:"Could not check this item.", error:"Could not load saves. Please try again.", retry:"Reload", more:"Load more", export:"Export selected references", exportNote:"A file for NOCOSIL import. Automatic linking is not enabled.", exportDone:"Selection exported. It has not been imported into NOCOSIL.", changed:"Changed in another view. Reload before trying again.", fail:"Could not change the saved state.", login:"Sign in to save this item.", select:"Select a reference to export", openSaved:"View saved items", useNocosil:"Use in NOCOSIL" },
  es: { title:"Guardados", intro:"Vuelve a los lugares y actividades que te interesan. Tus guardados son privados.", home:"Inicio", mine:"Mis registros", discover:"Descubrir", places:"Explorar lugares", events:"Buscar actividades", public:"Registros públicos", search:"Buscar registros", query:"Palabras clave", placeholder:"Lugares, momentos, descubrimientos", saved:"Guardado", save:"Guardar", remove:"Quitar guardado", loading:"Cargando…", empty:"Todavía no hay guardados.", unavailable:"Este elemento ya no está disponible", unknown:"No se pudo comprobar este elemento.", error:"No se pudo cargar. Inténtalo de nuevo.", retry:"Recargar", more:"Ver más", export:"Exportar la selección", exportNote:"Archivo para importar en NOCOSIL. La vinculación automática no está activada.", exportDone:"Selección exportada. Aún no se ha importado en NOCOSIL.", changed:"Cambió en otra vista. Recarga antes de continuar.", fail:"No se pudo cambiar el estado.", login:"Inicia sesión para guardar.", select:"Seleccionar una referencia", openSaved:"Ver guardados", useNocosil:"Usar en NOCOSIL" },
  "pt-BR": { title:"Salvos", intro:"Volte aos lugares e atividades de seu interesse. Seus itens salvos são privados.", home:"Início", mine:"Meus registros", discover:"Descobrir", places:"Explorar lugares", events:"Encontrar atividades", public:"Registros públicos", search:"Buscar registros", query:"Palavras-chave", placeholder:"Lugares, momentos, descobertas", saved:"Salvo", save:"Salvar", remove:"Remover", loading:"Carregando…", empty:"Nenhum item salvo ainda.", unavailable:"Este item não está mais disponível", unknown:"Não foi possível verificar este item.", error:"Não foi possível carregar. Tente novamente.", retry:"Recarregar", more:"Carregar mais", export:"Exportar seleção", exportNote:"Arquivo para importar no NOCOSIL. A vinculação automática não está ativada.", exportDone:"Seleção exportada. Ainda não foi importada no NOCOSIL.", changed:"Alterado em outra tela. Recarregue antes de tentar novamente.", fail:"Não foi possível alterar o estado.", login:"Entre para salvar este item.", select:"Selecionar uma referência", openSaved:"Ver itens salvos", useNocosil:"Usar no NOCOSIL" },
};
export function savedCopy(lang: SiteLang) { return words[lang]; }
const scriptData = (x: unknown) => JSON.stringify(x).replace(/</g,"\\u003c");
export const SAVED_REFERENCE_STYLES = `
.zukan-discovery-entry,.zukan-saved-view{max-width:960px;margin-inline:auto;padding:24px 20px;color:var(--ik-text,#17211B)}
.zukan-discovery-entry h1,.zukan-saved-view h1{font-size:clamp(1.5rem,4vw,2rem);line-height:1.4;margin:0 0 20px}
.zukan-discovery-destinations{display:flex;flex-wrap:wrap;gap:8px 24px;margin-block:8px 24px}
.zukan-discovery-destinations a,.zukan-saved-view button,.zukan-saved-view a,.zukan-save-action button,.zukan-save-action a{min-height:44px;display:inline-flex;align-items:center;font-size:1rem;line-height:1.6}
.zukan-discovery-destinations a{color:inherit;text-underline-offset:4px}
body[data-zukan-app-experience] .home-state-root .zukan-discovery-destinations a,body[data-zukan-app-experience] .home-state-root .zukan-discovery-return a,body[data-zukan-app-experience] .zukan-saved-list a{color:var(--zukan-text-primary,#17211B)}
.zukan-discovery-search{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-block:0 20px}
.zukan-discovery-search label{display:grid;gap:6px;flex:1 1 220px;min-width:0;font-size:1rem}
.zukan-discovery-search input{width:100%;min-width:0;box-sizing:border-box;min-height:44px;border:1px solid #68746C;border-radius:4px;font:inherit;padding:8px 12px}
.zukan-discovery-search button,.zukan-saved-view button,.zukan-save-action button{min-height:44px;border:1px solid #68746C;border-radius:4px;background:#fff;color:#17211B;padding:8px 16px;font:inherit;cursor:pointer}
.zukan-discovery-search button{background:#143F2E;color:#fff;border-color:#143F2E}
.zukan-discovery-return{display:flex;gap:12px 24px;flex-wrap:wrap;border-top:1px solid #DDE2DC;padding-top:12px}
.zukan-discovery-return a{min-height:44px;display:inline-flex;align-items:center;color:inherit;font-size:1rem}
.zukan-saved-view p,.zukan-save-action p{font-size:1rem;line-height:1.7;overflow-wrap:anywhere}
.zukan-saved-list{list-style:none;padding:0;margin:24px 0}
.zukan-saved-list li{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding-block:16px;border-bottom:1px solid #DDE2DC}
.zukan-saved-list label{min-height:44px;display:flex;align-items:center;justify-content:center}
.zukan-saved-list input{width:20px;height:20px}
.zukan-saved-list a{color:inherit;overflow-wrap:anywhere}
.zukan-saved-list small{display:block;line-height:1.6;font-size:.875rem}
.zukan-saved-actions{display:flex;flex-wrap:wrap;gap:12px;margin-block:16px}
.zukan-save-action{margin:16px 20px;padding-top:16px;border-top:1px solid #DDE2DC;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.zukan-save-action p{flex-basis:100%;margin:0}
.zukan-saved-view [hidden],.zukan-save-action [hidden]{display:none!important}
.zukan-saved-view [data-saved-status]:empty{display:none}
.zukan-saved-view:not(.is-selecting) .zukan-saved-list li{grid-template-columns:minmax(0,1fr) auto}
.zukan-saved-view:not(.is-selecting) .zukan-saved-list label{display:none}
.zukan-saved-view details{border-top:1px solid var(--zukan-border-decorative,#DDE2DC);padding-top:12px}
.zukan-saved-view summary{cursor:pointer;min-height:44px;line-height:44px;font-size:1rem}

/* Small signed-in header retains wordmark and 44px language/account actions. */
@media(max-width:359px){
 body[data-zukan-app-experience] .site-header-inner{padding-inline:12px;gap:6px}
 body[data-zukan-app-experience] .site-brand-cluster{flex:1 1 auto;min-width:0}
 body[data-zukan-app-experience] .brand-logo-lockup{gap:5px;padding-right:0}
 body[data-zukan-app-experience] .brand-wordmark{max-width:96px;min-width:0}
 body[data-zukan-app-experience] .zukan-app-language{flex:0 0 44px;min-width:0;margin-left:0}
 body[data-zukan-app-experience] .zukan-app-language .lang-switch{width:44px;min-width:44px}
 body[data-zukan-app-experience] .zukan-app-language .lang-switch-label{min-height:44px;width:44px;padding-inline:3px;gap:3px}
 body[data-zukan-app-experience] .home-header-actions.is-member{flex-shrink:0;gap:4px}
}
@media(max-width:440px){.zukan-saved-list li{grid-template-columns:44px minmax(0,1fr)}.zukan-saved-list button{grid-column:2;justify-self:start}.zukan-discovery-search button{width:100%}}
`;

/** Capability breadth is supplied by real routes; never manufacture jobs/food inventory. */
export function renderQuietDiscoveryEntry(basePath: string, lang: SiteLang): string {
  const c=words[lang], link=(path:string)=>appendLangToHref(withBasePath(basePath,path),lang);
  return `<section class="zukan-discovery-entry" data-home-primary-state="discovery" data-home-primary-active="true">
    <h1>${escapeHtml(c.discover)}</h1>
    <nav class="zukan-discovery-destinations" aria-label="${escapeHtml(c.discover)}">
      <a href="${escapeHtml(link('/map?tab=places'))}">${escapeHtml(c.places)}</a>
      <a href="${escapeHtml(link('/community/events'))}">${escapeHtml(c.events)}</a>
      <a href="${escapeHtml(link('/records?view=public'))}">${escapeHtml(c.public)}</a>
    </nav>
    <form class="zukan-discovery-search" method="get" action="${escapeHtml(withBasePath(basePath,'/records'))}">
      <input type="hidden" name="view" value="public"><input type="hidden" name="lang" value="${escapeHtml(lang)}">
      <label>${escapeHtml(c.query)}<input name="q" type="search" maxlength="80" placeholder="${escapeHtml(c.placeholder)}"></label>
      <button type="submit">${escapeHtml(c.search)}</button>
    </form>
    <div class="zukan-discovery-return"><a href="${escapeHtml(link('/records?view=saved'))}">${escapeHtml(c.title)}</a><a href="${escapeHtml(link('/records?view=mine'))}">${escapeHtml(c.mine)}</a></div>
  </section>`;
}

export function renderSavedReferencesView(lang: SiteLang): string {
 const c=words[lang];
 return `<section class="zukan-saved-view" data-zukan-saved-view><h1>${escapeHtml(c.title)}</h1><p>${escapeHtml(c.intro)}</p>
 <p data-saved-status role="status">${escapeHtml(c.loading)}</p><ul class="zukan-saved-list" data-saved-list></ul>
 <div class="zukan-saved-actions"><button type="button" data-saved-reload>${escapeHtml(c.retry)}</button><button type="button" data-saved-more hidden>${escapeHtml(c.more)}</button></div>
 <details data-saved-export-section hidden><summary>${escapeHtml(c.useNocosil)}</summary><p>${escapeHtml(c.exportNote)}</p><button type="button" data-saved-export disabled>${escapeHtml(c.export)}</button></details>
 <script>${savedReferencesClient(c)}</script></section>`;
}

function savedReferencesClient(c: ReturnType<typeof savedCopy>): string { return `(() => {
 const copy=${scriptData(c)},root=document.querySelector('[data-zukan-saved-view]');if(!root)return;
 const status=root.querySelector('[data-saved-status]'),list=root.querySelector('[data-saved-list]'),more=root.querySelector('[data-saved-more]'),reload=root.querySelector('[data-saved-reload]'),exp=root.querySelector('[data-saved-export]'),exportSection=root.querySelector('[data-saved-export-section]');
 let cursor=null,busy=false,rows=[];
 const selected=()=>Array.from(list.querySelectorAll('input:checked')).map(x=>x.value);
 const updateExport=()=>{exp.disabled=busy||selected().length===0||selected().length>20;};
 async function api(path,body){const res=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});if(!res.ok){const e=new Error('request_failed');e.status=res.status;throw e;}return res;}
 function draw(){list.replaceChildren();rows.forEach(item=>{const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input'),text=document.createElement(item.availability==='available'?'a':'span'),remove=document.createElement('button');
 check.type='checkbox';check.value=item.path;check.disabled=item.availability!=='available';check.setAttribute('aria-label',copy.select+': '+(item.title||copy.unavailable));check.addEventListener('change',updateExport);label.append(check);
 text.textContent=item.title||(item.availability==='unknown'?copy.unknown:copy.unavailable);if(item.availability==='available')text.href=item.path;
 remove.type='button';remove.textContent=copy.remove;remove.addEventListener('click',async()=>{if(busy)return;busy=true;remove.disabled=true;updateExport();try{await api('/api/v1/me/saved',{targetPath:item.path,saved:false,expectedRevision:item.revision,mutationId:crypto.randomUUID()});rows=rows.filter(x=>x.key!==item.key);draw();status.textContent=rows.length?'':copy.empty;}catch(e){status.textContent=e.status===409?copy.changed:copy.fail;}finally{busy=false;remove.disabled=false;updateExport();}});
 li.append(label,text,remove);list.append(li);});exportSection.hidden=rows.length===0;updateExport();}
 async function load(append=false){if(busy)return;busy=true;reload.disabled=true;more.disabled=true;updateExport();status.textContent=copy.loading;try{const response=await api('/api/v1/me/saved'+(append&&cursor?'?before='+encodeURIComponent(cursor):''));const data=await response.json();if(!Array.isArray(data.items))throw new Error('bad_response');rows=append?Array.from(new Map(rows.concat(data.items).map(x=>[x.key,x])).values()):data.items;cursor=data.nextCursor;draw();more.hidden=!cursor;status.textContent=data.partial?copy.unknown:(rows.length?'':copy.empty);}catch(e){status.textContent=e.status===401?copy.login:copy.error;}finally{busy=false;reload.disabled=false;more.disabled=false;updateExport();}}
 exportSection.addEventListener('toggle',()=>root.classList.toggle('is-selecting',exportSection.open));reload.addEventListener('click',()=>load());more.addEventListener('click',()=>load(true));exp.addEventListener('click',async()=>{const targets=selected();if(busy||!targets.length||targets.length>20)return;busy=true;updateExport();try{const res=await api('/api/v1/me/saved/export',{targets});const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='zukan-saved-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent=copy.exportDone;}catch(e){status.textContent=e.status===409?copy.changed:copy.error;}finally{busy=false;updateExport();}});load();
})();`; }

export function renderSavedReferenceAction(targetPath: string, lang: SiteLang): string {
 const c=words[lang],savedHref=appendLangToHref('/records?view=saved',lang);
 return `<aside class="zukan-save-action" data-zukan-save-action><button type="button" data-save-toggle disabled>${escapeHtml(c.loading)}</button><a href="${escapeHtml(savedHref)}">${escapeHtml(c.openSaved)}</a><p data-save-status role="status"></p>
 <script>(()=>{const root=document.querySelector('[data-zukan-save-action]');if(!root)return;const copy=${scriptData(c)},target=${scriptData(targetPath)},button=root.querySelector('[data-save-toggle]'),status=root.querySelector('[data-save-status]');let item=null,busy=false;
 const draw=()=>{button.textContent=item&&item.saved?copy.saved:copy.save;button.setAttribute('aria-pressed',String(Boolean(item&&item.saved)));button.disabled=!item||busy;};
 async function load(){try{const res=await fetch('/api/v1/me/saved?target='+encodeURIComponent(target),{credentials:'same-origin'});if(res.status===401){const a=document.createElement('a');a.href='/login?redirect='+encodeURIComponent(location.pathname+location.search);a.textContent=copy.login;status.replaceChildren(a);button.hidden=true;return;}if(!res.ok)throw new Error('unavailable');item=(await res.json()).item;draw();}catch(e){button.textContent=copy.retry;button.disabled=false;status.textContent=copy.error;}}
 button.addEventListener('click',async()=>{if(busy)return;if(!item){load();return;}busy=true;draw();try{const res=await fetch('/api/v1/me/saved',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({targetPath:target,saved:!item.saved,expectedRevision:item.revision,mutationId:crypto.randomUUID()})});if(!res.ok){status.textContent=res.status===409?copy.changed:copy.fail;item=null;return;}item=(await res.json()).item;status.textContent=item.saved?copy.saved:copy.remove;}catch(e){status.textContent=copy.fail;}finally{busy=false;draw();if(!item){button.disabled=false;button.textContent=copy.retry;}}});load();})();</script></aside>`;
}
