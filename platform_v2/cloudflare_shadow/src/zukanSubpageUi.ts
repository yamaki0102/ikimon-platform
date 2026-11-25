const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const ICON_CHEV = '<svg class="zt-sp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

// Shared look of the design mocks' inner screens: back + centered title, list rows, fact rows, labeled fields, green buttons.
export const ZUKAN_SUBPAGE_CSS = `
.zt-sp{display:grid;gap:16px;min-width:0;max-width:720px;margin:0 auto;color:#17251b}
.zt-sp svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.zt-sp-head{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;min-height:56px}
.zt-sp-head h1{margin:0;text-align:center;font-size:1.25rem;line-height:1.4;font-weight:700;overflow-wrap:anywhere}
.zt-sp-back,.zt-sp-back:visited{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;color:#17251b}
.zt-sp-lead{margin:0;color:#55615a;font-size:1rem;line-height:1.7}
.zt-sp-title{margin:0;font-size:1.5rem;line-height:1.4;font-weight:700;overflow-wrap:anywhere}
.zt-sp-text{margin:0;font-size:1.0625rem;line-height:1.8;overflow-wrap:anywhere}
.zt-sp-list{margin:0;padding:0;list-style:none;display:grid}
.zt-sp-row,.zt-sp-row:visited{display:flex;align-items:center;gap:14px;min-height:76px;padding:12px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
.zt-sp-thumb{flex:none;width:64px;height:64px;border-radius:14px;overflow:hidden;background:#eef1ed}.zt-sp-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.zt-sp-body{flex:1;min-width:0}.zt-sp-body strong{display:block;font-size:1.0625rem;line-height:1.4;overflow-wrap:anywhere}.zt-sp-body small{display:block;margin-top:2px;font-size:.9375rem;color:#55615a;overflow-wrap:anywhere}
.zt-sp-chev{flex:none;width:20px!important;height:20px!important;color:#8a948d}
.zt-sp-facts{margin:0;display:grid}.zt-sp-facts div{display:grid;grid-template-columns:5.5em minmax(0,1fr);gap:12px;padding:14px 0;border-bottom:1px solid #dde2dc}.zt-sp-facts dt{color:#55615a;font-weight:600}.zt-sp-facts dd{margin:0;font-weight:700;overflow-wrap:anywhere}
.zt-sp-field{display:grid;gap:8px}.zt-sp-field>span{font-weight:700;color:#3d4a42}
.zt-sp-input{width:100%;min-height:52px;padding:12px 16px;border:1.5px solid #68746c;border-radius:16px;background:#fff;font:inherit;color:#17251b}
textarea.zt-sp-input{min-height:104px;resize:vertical}
.zt-sp-primary,.zt-sp-primary:visited{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:10px 18px;border:1px solid #143F2E;border-radius:16px;background:#143F2E;color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;box-shadow:0 2px 6px rgba(20,63,46,.25)}
.zt-sp-secondary,.zt-sp-secondary:visited{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;padding:10px 18px;border:1.5px solid #143F2E;border-radius:16px;background:#fff;color:#143F2E;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.zt-sp-empty{margin:0;padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;text-align:center;color:#55615a;background:#fff}
.zt-sp-badge{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:36px;padding:0 10px;border-radius:999px;background:#e8f0ea;color:#143F2E;font-weight:700}
.zt-sp :focus-visible{outline:3px solid currentColor;outline-offset:3px}
@media(prefers-reduced-motion:reduce){.zt-sp,.zt-sp *{transition:none!important;animation:none!important}}
`;

export function renderSubpageHeader(options: { title: string; backHref: string; backLabel: string }): string {
  return `<header class="zt-sp-head"><a class="zt-sp-back" href="${esc(options.backHref)}" aria-label="${esc(options.backLabel)}">${ICON_BACK}</a><h1>${esc(options.title)}</h1><span></span></header>`;
}

export function renderSubpageRow(options: { href: string; title: string; meta?: string; thumbUrl?: string | null }): string {
  const thumb = `<span class="zt-sp-thumb"${options.thumbUrl ? "" : ' aria-hidden="true"'}>${options.thumbUrl ? `<img src="${esc(options.thumbUrl)}" alt="" loading="lazy" decoding="async">` : ""}</span>`;
  return `<li><a class="zt-sp-row" href="${esc(options.href)}">${thumb}<span class="zt-sp-body"><strong>${esc(options.title)}</strong>${options.meta ? `<small>${esc(options.meta)}</small>` : ""}</span>${ICON_CHEV}</a></li>`;
}
