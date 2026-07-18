const HOME_PATHS = new Set(["/", "/home", "/ja", "/ja/", "/ja/home", "/en", "/en/", "/en/home"]);

function isFocusedHomeRequest(request: Request): boolean {
  if (request.method.toUpperCase() !== "GET") return false;
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/u, "") || "/";
    return HOME_PATHS.has(path);
  } catch {
    return false;
  }
}

export function enforceCameraFirstHomeCtaHtml(html: string): string {
  return html.replace(/<a\b[^>]*>/gu, (tag) => {
    if (!/\bclass=["'][^"']*\bprototype-guest-home-primary\b[^"']*["']/u.test(tag)) return tag;

    const hrefMatch = tag.match(/\bhref=["']([^"']*\/record)\?start=(?:gallery|photo)["']/u);
    if (!hrefMatch) return tag;

    const photoHref = `${hrefMatch[1] ?? "/record"}?start=photo`;
    let patched = tag.replace(hrefMatch[0], `href="${photoHref}"`);

    if (/\bdata-kpi-target=["'][^"']*["']/u.test(patched)) {
      patched = patched.replace(/\bdata-kpi-target=["'][^"']*["']/u, `data-kpi-target="${photoHref}"`);
    }
    if (/\bdata-global-record-trigger=["'][^"']*["']/u.test(patched)) {
      patched = patched.replace(/\bdata-global-record-trigger=["'][^"']*["']/u, 'data-global-record-trigger="photo"');
    } else {
      patched = patched.replace(/>$/u, ' data-global-record-trigger="photo">');
    }
    if (/\bdata-record-target=["'][^"']*["']/u.test(patched)) {
      patched = patched.replace(/\bdata-record-target=["'][^"']*["']/u, `data-record-target="${photoHref}"`);
    } else {
      patched = patched.replace(/>$/u, ` data-record-target="${photoHref}">`);
    }

    return patched;
  });
}

export async function enforceCameraFirstHomeCta(request: Request, response: Response): Promise<Response> {
  if (!isFocusedHomeRequest(request) || response.status < 200 || response.status >= 300) return response;
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const patched = enforceCameraFirstHomeCtaHtml(html);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");
  headers.set("x-ikimon-home-capture-entry", "camera-first-v2");

  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
