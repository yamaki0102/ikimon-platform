import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");
const argv = process.argv.slice(2);
const arg = (key, fallback) => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] : fallback; };
const base = arg("--base", "https://zukan.earth");
const paths = (arg("--paths", "/ja/,/ja/?year=2008,/ja/community/events")).split(",").map((s) => s.trim()).filter(Boolean);
const out = arg("--out", "");
const conc = Number(arg("--concurrency", "3"));
const widths = [390, 768, 1440];
const jobs = paths.flatMap((route) => widths.map((width) => ({ route, width })));
const rows = [];

const measure = () => {
  const iw = innerWidth;
  const sw = document.scrollingElement.scrollWidth;
  const scope = document.querySelector("main") || document.body;
  let small = 0;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (parseFloat(cs.fontSize) < 14) small++;
  }
  const primaries = [...scope.querySelectorAll(".zukan-primary-action, button[type=submit], a.button, .btn-primary, [data-primary]")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") return false;
      const bg = getComputedStyle(el).backgroundColor;
      return el.classList.contains("zukan-primary-action") || !/rgba?\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(bg);
    }).length;
  return { overflow: Math.max(0, sw - iw), small, primaryCount: primaries, h1: (document.querySelector("h1")?.innerText || "").trim() };
};

const browser = await chromium.launch();
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { route, width } = jobs[next++];
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 150)); });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 150)));
    const row = { route, width };
    try {
      const resp = await page.goto(base + route, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(300);
      row.status = resp?.status() ?? 0;
      Object.assign(row, await page.evaluate(measure));
    } catch (e) {
      Object.assign(row, { status: 0, overflow: 0, small: 0, primaryCount: 0, h1: "", err: String(e).slice(0, 120) });
    }
    row.errors = errors.slice(0, 5);
    rows.push(row);
    await ctx.close();
  }
}
await Promise.all(Array.from({ length: Math.max(1, conc) }, worker));
await browser.close();
rows.sort((a, b) => a.route.localeCompare(b.route) || a.width - b.width);
const text = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
if (out) fs.writeFileSync(out, text); else process.stdout.write(text);
const failed = rows.filter((r) => r.status !== 200 || r.overflow > 0 || r.small > 0 || r.primaryCount > 1 || r.errors.length > 0);
if (failed.length) process.exitCode = 1;
