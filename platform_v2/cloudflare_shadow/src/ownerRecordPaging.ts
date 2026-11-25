export type PageCursor = { observedAt: string; id: string };

export function encodePageCursor(observedAt: string, id: string): string {
  return `${observedAt}~${id}`;
}

export function decodePageCursor(raw: string | null | undefined): PageCursor | null {
  if (!raw || raw.length > 220) return null;
  const at = raw.indexOf("~");
  if (at <= 0 || at === raw.length - 1) return null;
  const observedAt = raw.slice(0, at);
  const id = raw.slice(at + 1);
  if (observedAt.length > 40 || id.length > 160 || /[\u0000-\u001f]/.test(raw)) return null;
  return { observedAt, id };
}

export function likePatternFromQuery(raw: string | null | undefined): string | null {
  const q = String(raw ?? "").normalize("NFKC").trim().slice(0, 80);
  if (!q) return null;
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

export function dayBoundsFromGroupKey(groupKey: string): { from: string; to: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(groupKey);
  return m ? { from: m[1]!, to: `${m[1]}~` } : null;
}

export function loadMoreScript(config: { list: string; more: string; loading: string; rebindSaved?: boolean }): string {
  const cfg = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script data-load-more-script>(()=>{const cfg=${cfg};
document.addEventListener("click",async(e)=>{
const a=e.target&&e.target.closest?e.target.closest(cfg.more+" a[data-load-more]"):null;
if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
e.preventDefault();
if(a.getAttribute("aria-busy")==="true")return;
a.setAttribute("aria-busy","true");const label=a.textContent;a.textContent=cfg.loading;
try{
const res=await fetch(a.href,{credentials:"same-origin",headers:{accept:"text/html"}});
if(!res.ok)throw new Error("http");
const doc=new DOMParser().parseFromString(await res.text(),"text/html");
const list=document.querySelector(cfg.list),nextList=doc.querySelector(cfg.list);
if(!list||!nextList)throw new Error("shape");
if(cfg.rebindSaved)document.querySelectorAll("[data-zukan-save]").forEach((b)=>b.replaceWith(b.cloneNode(true)));
const added=Array.from(nextList.children).map((n)=>document.importNode(n,true));
added.forEach((n)=>list.appendChild(n));
const cur=document.querySelector(cfg.more),nextMore=doc.querySelector(cfg.more);
if(cur){if(nextMore)cur.replaceWith(document.importNode(nextMore,true));else cur.remove();}
if(cfg.rebindSaved){
const scripts=Array.from(doc.querySelectorAll("script")).filter((s)=>!s.hasAttribute("data-load-more-script")&&s.textContent&&s.textContent.indexOf("data-zukan-save")>=0);
const src=scripts.pop(),own=document.querySelector("script[data-load-more-script]");
if(src){const s=document.createElement("script");if(own&&own.nonce)s.nonce=own.nonce;s.textContent=src.textContent;document.body.appendChild(s);s.remove();}
}
const focusTarget=added[0]&&added[0].querySelector?added[0].querySelector("a"):null;
if(focusTarget)focusTarget.focus();
}catch(err){a.textContent=label;a.removeAttribute("aria-busy");window.location.href=a.href;}
});
})();</script>`;
}
