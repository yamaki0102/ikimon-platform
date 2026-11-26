import { isSafePublicDerivedImageKey } from "./core/shared";

export type DerivedWidth = 320 | 360 | 680 | 1020 | 1360;

function key(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/derived/")) return null;
  const k = url.slice(1).split(/[?#]/)[0]!;
  return isSafePublicDerivedImageKey(k) ? k : null;
}

export function sizedImageUrl(url: string | null | undefined, width: DerivedWidth): string {
  const k = key(url);
  return k ? `/derived-transform/w${width}/${k}` : (url ?? "");
}

export function sizedImageSrcset(url: string | null | undefined, widths: readonly DerivedWidth[]): string {
  const k = key(url);
  return k ? widths.map((w) => `/derived-transform/w${w}/${k} ${w}w`).join(", ") : "";
}

export function sizedImgAttrs(url: string | null | undefined, width: DerivedWidth, widths: readonly DerivedWidth[], sizes: string, esc: (s: string) => string): string {
  const srcset = sizedImageSrcset(url, widths);
  return `src="${esc(sizedImageUrl(url, width))}"${srcset ? ` srcset="${esc(srcset)}" sizes="${esc(sizes)}"` : ""}`;
}
