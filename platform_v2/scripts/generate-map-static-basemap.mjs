import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformV2Root = path.resolve(__dirname, "..");
const outDir = path.join(platformV2Root, "assets", "map");
const vendorDir = path.join(platformV2Root, "assets", "vendor", "maplibre-gl-4.7.1");

function loadStandardMapConfig() {
  const stdout = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "import('./src/ui/mapExplorer.ts').then((m) => process.stdout.write(JSON.stringify({ critical: m.mapExplorerCriticalScriptSource() })))",
    ],
    { cwd: platformV2Root, encoding: "utf8" },
  );
  const { critical } = JSON.parse(stdout);
  const startIdx = critical.indexOf("  var SIMPLE_MID_LANDMARK_CLASSES =");
  const endIdx = critical.indexOf("  var STARTUP_LOCATION_ZOOM =");
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
    throw new Error("Could not locate BASEMAPS / DEFAULT_MAP_CENTER / DEFAULT_MAP_ZOOM in mapExplorerCriticalScriptSource()");
  }
  const snippet = critical.slice(startIdx, endIdx);
  const sandbox = {};
  vm.runInNewContext(snippet, sandbox);
  if (!sandbox.BASEMAPS?.standard || !Array.isArray(sandbox.DEFAULT_MAP_CENTER) || typeof sandbox.DEFAULT_MAP_ZOOM !== "number") {
    throw new Error("Failed to evaluate BASEMAPS.standard, DEFAULT_MAP_CENTER, or DEFAULT_MAP_ZOOM");
  }
  const standard = structuredClone(sandbox.BASEMAPS.standard);
  const layersWithoutSymbols = standard.layers.filter((layer) => layer.type !== "symbol");
  const staticStyle = {
    ...standard,
    layers: layersWithoutSymbols,
  };
  const center = sandbox.DEFAULT_MAP_CENTER;
  const zoom = sandbox.DEFAULT_MAP_ZOOM;
  const styleDigest = createHash("sha256")
    .update(JSON.stringify({ center, zoom, style: staticStyle }))
    .digest("hex")
    .slice(0, 16);
  return { center, zoom, staticStyle, styleDigest };
}

function startLocalAssetServer(html) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      if (urlPath === "/" || urlPath === "/index.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (urlPath === "/maplibre-gl.js") {
        res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
        res.end(readFileSync(path.join(vendorDir, "maplibre-gl.js")));
        return;
      }
      if (urlPath === "/maplibre-gl.css") {
        res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
        res.end(readFileSync(path.join(vendorDir, "maplibre-gl.css")));
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function renderStaticBasemap({ center, zoom, staticStyle, cssWidth, cssHeight, pixelRatio, quality }) {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="/maplibre-gl.css" />
<style>
  html, body { margin: 0; padding: 0; width: ${cssWidth}px; height: ${cssHeight}px; overflow: hidden; background: #edf4ef; }
  #map { width: ${cssWidth}px; height: ${cssHeight}px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="/maplibre-gl.js"></script>
<script>
  window.__renderStaticBasemap = function(cfg) {
    return new Promise(function(resolve, reject) {
      var map = new maplibregl.Map({
        container: 'map',
        style: cfg.style,
        center: cfg.center,
        zoom: cfg.zoom,
        attributionControl: false,
        fadeDuration: 0,
        preserveDrawingBuffer: true
      });
      map.on('error', function(e) {
        if (e && e.error) console.error('MapLibre error:', e.error.message || e.error);
      });
      map.once('idle', function() {
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            try {
              var dataUrl = map.getCanvas().toDataURL('image/webp', cfg.quality);
              resolve(dataUrl);
            } catch (err) {
              reject(err);
            }
          });
        });
      });
    });
  };
</script>
</body>
</html>`;

  const { server, baseUrl } = await startLocalAssetServer(html);
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: cssWidth, height: cssHeight },
      deviceScaleFactor: pixelRatio,
    });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const dataUrl = await page.evaluate(
      (cfg) => window.__renderStaticBasemap(cfg),
      { style: staticStyle, center, zoom, quality },
    );
    const prefix = "data:image/webp;base64,";
    if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) {
      throw new Error(`Unexpected WebP data URL prefix: ${String(dataUrl).slice(0, 40)}`);
    }
    return Buffer.from(dataUrl.slice(prefix.length), "base64");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const cssWidth = Number(process.env.STATIC_MAP_WIDTH || 460);
  const cssHeight = Number(process.env.STATIC_MAP_HEIGHT || 840);
  const pixelRatio = Number(process.env.STATIC_MAP_DPR || 2);
  const quality = Number(process.env.STATIC_MAP_QUALITY || 0.72);

  const { center, zoom, staticStyle, styleDigest } = loadStandardMapConfig();
  const webpBuffer = await renderStaticBasemap({
    center,
    zoom,
    staticStyle,
    cssWidth,
    cssHeight,
    pixelRatio,
    quality,
  });

  const hash = createHash("sha256").update(webpBuffer).digest("hex").slice(0, 12);
  const filename = `static-basemap.${hash}.webp`;
  const publicPath = `/assets/map/${filename}`;

  mkdirSync(outDir, { recursive: true });
  for (const entry of readdirSync(outDir)) {
    if (/^static-basemap\.[a-f0-9]{12}\.webp$/.test(entry) && entry !== filename) {
      rmSync(path.join(outDir, entry));
    }
  }

  writeFileSync(path.join(outDir, filename), webpBuffer);
  const meta = {
    path: publicPath,
    hash,
    center,
    zoom,
    cssWidth,
    cssHeight,
    pixelRatio,
    quality,
    byteLength: webpBuffer.byteLength,
    styleDigest,
  };
  writeFileSync(path.join(outDir, "static-basemap.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(JSON.stringify(meta));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
