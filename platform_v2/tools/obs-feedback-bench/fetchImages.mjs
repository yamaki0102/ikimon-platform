import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OK_LICENSE = /^(cc0|cc[- ]by(-sa)?[- ]?[1-4]\.0|cc[- ]by(-sa)?[- ]?[1-4]\.0[- ].*|public domain|pd.*)$/i;
const dir = path.resolve(process.argv[2] ?? "tools/obs-feedback-bench/v1");
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const spec = JSON.parse(fs.readFileSync(path.join(dir, "spec.json"), "utf8"));
const imgDir = path.join(dir, "images");
fs.mkdirSync(imgDir, { recursive: true });
const sourcesPath = path.join(dir, "sources.json");
const sources = fs.existsSync(sourcesPath) ? JSON.parse(fs.readFileSync(sourcesPath, "utf8")) : {};
const UA = { "User-Agent": "obs-feedback-bench/1.0 (research evaluation)" };
const strip = (h) => String(h ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function search(q, skip) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", format: "json", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "20", prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "1024" }).forEach(([k, v]) => u.searchParams.set(k, v));
  let j = null;
  for (let a = 0; a < 6 && !j; a++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok && /json/.test(r.headers.get("content-type") ?? "")) j = await r.json();
    else await new Promise((res) => setTimeout(res, 10000 * (a + 1)));
  }
  if (!j) return null;
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime) || ii.width < 800) continue;
    const m = ii.extmetadata ?? {};
    const lic = strip(m.LicenseShortName?.value);
    if (!OK_LICENSE.test(lic)) continue;
    if (skip.has(p.title)) continue;
    return { title: p.title, page: ii.descriptionurl, thumb: ii.thumburl, license: lic, licenseUrl: m.LicenseUrl?.value ?? null, artist: strip(m.Artist?.value).slice(0, 200) };
  }
  return null;
}

function transform(img, kind) {
  if (kind === "blur") return img.blur(9);
  if (kind === "tiny") return img.resize(96).resize(1024, null, { kernel: "nearest" });
  if (kind === "dark") return img.modulate({ brightness: 0.12 }).blur(2);
  if (kind === "crop") return img.extract({ left: 380, top: 280, width: 220, height: 220 }).resize(768);
  return img;
}

for (const it of spec.items) {
  if (it.images) continue;
  if (only && !only.has(it.id)) continue;
  if (!only && sources[it.id]) continue;
  const skip = new Set(sources[it.id]?.rejected ?? []);
  if (only && sources[it.id]?.title) skip.add(sources[it.id].title);
  const hit = await search(it.query, skip);
  if (!hit) { console.log("NONE", it.id); continue; }
  let buf = null;
  for (let a = 0; a < 5 && !buf; a++) {
    const r = await fetch(hit.thumb, { headers: UA });
    if (r.ok && /image/.test(r.headers.get("content-type") ?? "")) buf = Buffer.from(await r.arrayBuffer());
    else await new Promise((res) => setTimeout(res, 3000 * (a + 1)));
  }
  if (!buf) { console.log("FETCHFAIL", it.id); continue; }
  let img = sharp(buf).rotate();
  if (it.transform) img = transform(img, it.transform);
  await img.jpeg({ quality: 82 }).toFile(path.join(imgDir, `${it.id}.jpg`));
  sources[it.id] = { ...hit, rejected: [...skip], transform: it.transform ?? null };
  console.log("OK", it.id, hit.license, hit.title);
  fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 1));
  await new Promise((r) => setTimeout(r, 8000));
}
fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 1));
