import { pathToFileURL } from "node:url";

const MIN_TEXT_LENGTH = 500;
const DEFAULT_SITEMAP = "https://zukan.earth/sitemap.xml";

export function parseSitemapLocs(xml) {
  const locs = [];
  for (const match of String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)) {
    locs.push(match[1].replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&#39;|&apos;/gu, "'"));
  }
  return [...new Set(locs)];
}

export function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/iu.test(String(xml));
}

export function visibleTextLength(body) {
  return String(body)
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim().length;
}

export function evaluatePage({ url, status, body = "", error = null }) {
  const problems = [];
  if (error) problems.push(`fetch_error:${error}`);
  else {
    if (status !== 200) problems.push(`status_${status}`);
    if (String(body).includes("html_not_materialized")) problems.push("html_not_materialized");
    const textLength = visibleTextLength(body);
    if (textLength < MIN_TEXT_LENGTH) problems.push(`text_too_short:${textLength}`);
  }
  return { url, status: status ?? null, ok: problems.length === 0, problems };
}

export function summarize(results, sitemapUrl = DEFAULT_SITEMAP) {
  const failed = results.filter((r) => !r.ok);
  return { sitemap: sitemapUrl, total: results.length, passed: results.length - failed.length, failed: failed.length, ok: results.length > 0 && failed.length === 0, failures: failed };
}

async function fetchText(url, fetchImpl, timeoutMs) {
  const response = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "zukan-sitemap-live-check/1" } });
  return { status: response.status, body: await response.text() };
}

export async function collectUrls(sitemapUrl, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const root = await fetchText(sitemapUrl, fetchImpl, timeoutMs);
  if (root.status !== 200) throw new Error(`sitemap_status_${root.status}`);
  if (!isSitemapIndex(root.body)) return parseSitemapLocs(root.body);
  const urls = [];
  for (const child of parseSitemapLocs(root.body)) {
    const res = await fetchText(child, fetchImpl, timeoutMs);
    if (res.status !== 200) throw new Error(`child_sitemap_status_${res.status}:${child}`);
    urls.push(...parseSitemapLocs(res.body));
  }
  return [...new Set(urls)];
}

export async function checkSitemapLive({ sitemapUrl = DEFAULT_SITEMAP, fetchImpl = fetch, timeoutMs = 20000, concurrency = 6 } = {}) {
  const urls = await collectUrls(sitemapUrl, { fetchImpl, timeoutMs });
  const results = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next++;
      const url = urls[index];
      try {
        const { status, body } = await fetchText(url, fetchImpl, timeoutMs);
        results[index] = evaluatePage({ url, status, body });
      } catch (error) {
        results[index] = evaluatePage({ url, status: null, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return summarize(results, sitemapUrl);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sitemapUrl = process.argv[2] ?? DEFAULT_SITEMAP;
  checkSitemapLive({ sitemapUrl })
    .then((summary) => {
      console.log(JSON.stringify(summary));
      process.exit(summary.ok ? 0 : 1);
    })
    .catch((error) => {
      console.log(JSON.stringify({ sitemap: sitemapUrl, ok: false, error: error instanceof Error ? error.message : String(error) }));
      process.exit(1);
    });
}
