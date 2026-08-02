const STATE_SPLIT_STYLE_ID = "zukan-home-state-split-release-closure";

const STATE_SPLIT_STYLE = `<style id="${STATE_SPLIT_STYLE_ID}">
.home-state-root :is(a,button):focus-visible{outline:3px solid var(--home-green);outline-offset:3px}
.home-category-index{color:var(--home-green)}
.home-guest-proof.is-count-0{grid-template-columns:1fr;grid-template-rows:1fr}
.home-guest-proof.is-empty{background:#f3f5f2}
.home-guest-proof.is-empty img{display:none}
.home-guest-proof.is-empty p{max-width:24rem;margin:0;padding:0 20px;color:var(--home-green);font-weight:800;text-align:center}
@media(max-width:959px){
.home-guest-proof-item.is-item-4,.home-guest-proof-item.is-item-5{display:block}
.home-guest-proof.is-count-1,.home-guest-proof.is-count-2{grid-template-rows:minmax(260px,1fr)}
.home-guest-proof.is-count-1 .is-item-1{grid-column:1/13;grid-row:1/2}
.home-guest-proof.is-count-2 .is-item-1{grid-column:1/7;grid-row:1/2}
.home-guest-proof.is-count-2 .is-item-2{grid-column:7/13;grid-row:1/2}
.home-guest-proof.is-count-3{grid-template-rows:repeat(2,minmax(120px,1fr))}
.home-guest-proof.is-count-3 .is-item-1{grid-column:1/9;grid-row:1/3}
.home-guest-proof.is-count-3 .is-item-2{grid-column:9/13;grid-row:1/2}
.home-guest-proof.is-count-3 .is-item-3{grid-column:9/13;grid-row:2/3}
.home-guest-proof.is-count-4,.home-guest-proof.is-count-5{grid-template-rows:repeat(3,minmax(100px,1fr))}
.home-guest-proof.is-count-4 .is-item-1,.home-guest-proof.is-count-5 .is-item-1{grid-column:1/9;grid-row:1/3}
.home-guest-proof.is-count-4 .is-item-2,.home-guest-proof.is-count-5 .is-item-2{grid-column:9/13;grid-row:1/2}
.home-guest-proof.is-count-4 .is-item-3,.home-guest-proof.is-count-5 .is-item-3{grid-column:9/13;grid-row:2/3}
.home-guest-proof.is-count-4 .is-item-4{grid-column:1/13;grid-row:3/4}
.home-guest-proof.is-count-5 .is-item-4{grid-column:1/7;grid-row:3/4}
.home-guest-proof.is-count-5 .is-item-5{grid-column:7/13;grid-row:3/4}
}
@media(min-width:960px){
.home-guest-proof.is-count-1 .is-item-1{grid-column:1/13;grid-row:1/3}
.home-guest-proof.is-count-2 .is-item-1{grid-column:1/7;grid-row:1/3}
.home-guest-proof.is-count-2 .is-item-2{grid-column:7/13;grid-row:1/3}
.home-guest-proof.is-count-3 .is-item-1{grid-column:1/8;grid-row:1/3}
.home-guest-proof.is-count-3 .is-item-2{grid-column:8/13;grid-row:1/2}
.home-guest-proof.is-count-3 .is-item-3{grid-column:8/13;grid-row:2/3}
.home-guest-proof.is-count-4 .is-item-1,.home-guest-proof.is-count-5 .is-item-1{grid-column:1/7;grid-row:1/3}
.home-guest-proof.is-count-4 .is-item-2,.home-guest-proof.is-count-5 .is-item-2{grid-column:7/10;grid-row:1/2}
.home-guest-proof.is-count-4 .is-item-3,.home-guest-proof.is-count-5 .is-item-3{grid-column:10/13;grid-row:1/2}
.home-guest-proof.is-count-4 .is-item-4{grid-column:7/13;grid-row:2/3}
.home-guest-proof.is-count-5 .is-item-4{grid-column:7/10;grid-row:2/3}
.home-guest-proof.is-count-5 .is-item-5{grid-column:10/13;grid-row:2/3}
}
</style>`;

export function applyStateSplitHomeResponsive(html: string): string {
  if (!html.includes('data-home-contract="state-split-v1"') || html.includes(`id="${STATE_SPLIT_STYLE_ID}"`)) {
    return html;
  }
  return html.includes("</head>")
    ? html.replace("</head>", `${STATE_SPLIT_STYLE}\n</head>`)
    : `${STATE_SPLIT_STYLE}${html}`;
}

export async function ensureStateSplitHomeResponsive(response: Response): Promise<Response> {
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html") || response.status < 200 || response.status >= 300) return response;

  const html = await response.text();
  const patched = applyStateSplitHomeResponsive(html);
  if (patched === html) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  }

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");
  headers.set("x-zukan-home-responsive", "state-split-release-closure-v1");
  return new Response(patched, { status: response.status, statusText: response.statusText, headers });
}
