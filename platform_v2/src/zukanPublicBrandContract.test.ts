import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const platformRoot = process.cwd();

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function withoutLegacyEmail(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@ikimon\.life/gi, "[legacy-contact-email]");
}

function withoutAllowedLegacyProductNames(text: string): string {
  return withoutLegacyEmail(text).replace(/ikimon Pocket/g, "[legacy-product-name]");
}

test("public editorial content presents ZUKAN without stale ikimon.life branding", async () => {
  const contentRoot = path.join(platformRoot, "src", "content");
  const files = (await filesBelow(contentRoot)).filter((file) => /\.(?:json|md)$/.test(file));
  for (const file of files) {
    const text = withoutAllowedLegacyProductNames(await readFile(file, "utf8"));
    assert.doesNotMatch(text, /ikimon\.life/i, path.relative(platformRoot, file));
    assert.doesNotMatch(text, /\bikimon\b/, path.relative(platformRoot, file));
  }
});

test("public presentation source uses zukan.earth and ZUKAN identity", async () => {
  const relativePaths = [
    "src/routes/read.ts",
    "src/routes/marketing.ts",
    "src/routes/observationEventPages.ts",
    "src/routes/monitoringBusiness.ts",
    "src/routes/guideRead.ts",
    "src/routes/guideRecordsDebug.ts",
    "src/routes/auth.ts",
    "src/routes/invasiveSpecies.ts",
    "src/routes/personalLibrary.ts",
    "src/routes/personalLibraryCopy.ts",
    "src/siteMap.ts",
    "src/ui/landingTop.ts",
    "src/ui/observationEventRecap.ts",
  ];
  for (const relativePath of relativePaths) {
    const source = withoutLegacyEmail(await readFile(path.join(platformRoot, relativePath), "utf8"));
    assert.doesNotMatch(source, /ikimon\.life/i, relativePath);
  }

  const readSource = await readFile(path.join(platformRoot, "src", "routes", "read.ts"), "utf8");
  assert.match(readSource, /const PUBLIC_ORIGIN = "https:\/\/zukan\.earth"/);
  assert.match(readSource, /isPartOf: \{ "@type": "WebSite", name: "ZUKAN", url: PUBLIC_ORIGIN \}/);
  assert.match(readSource, /position: 1, name: "ZUKAN", item: `\$\{PUBLIC_ORIGIN\}\/ja\/`/);

  const marketingSource = await readFile(path.join(platformRoot, "src", "routes", "marketing.ts"), "utf8");
  assert.match(marketingSource, /publisher: \{ "@type": "Organization", name: "IKIMON株式会社" \}/);
  assert.doesNotMatch(marketingSource, /publisher: \{ "@type": "Organization", name: "ZUKAN"/);

  const authSource = await readFile(path.join(platformRoot, "src", "routes", "auth.ts"), "utf8");
  assert.doesNotMatch(authSource, /ikimon\.life アカウント/);
  assert.match(authSource, /ZUKANアカウントでログインしました/);

  const invasiveSource = await readFile(path.join(platformRoot, "src", "routes", "invasiveSpecies.ts"), "utf8");
  assert.doesNotMatch(invasiveSource, /source: "ikimon\.life"|ikimon\.life では|ikimon\.life の外来種 seed/);

  const siteMapSource = await readFile(path.join(platformRoot, "src", "siteMap.ts"), "utf8");
  assert.doesNotMatch(siteMapSource, /How ikimon\.life|ikimon\.life が|\bikimon\b の公開|\bikimon\b is|\bikimon\b es|\bikimon\b e um/);

  const titleSources = await Promise.all([
    "src/routes/read.ts",
    "src/routes/personalLibrary.ts",
    "src/routes/personalLibraryCopy.ts",
    "src/routes/invasiveSpecies.ts",
  ].map((relativePath) => readFile(path.join(platformRoot, relativePath), "utf8")));
  for (const source of titleSources) {
    assert.doesNotMatch(source, /\| ikimon(?:["'`<]|$)/);
  }

  const researchSource = await readFile(path.join(platformRoot, "src", "routes", "researchApi.ts"), "utf8");
  assert.match(researchSource, /datasetName:\s+"ZUKAN Field Loop"/);
  assert.match(researchSource, /filename=\\"zukan-darwin-core-v0\.csv\\"/);
  assert.doesNotMatch(researchSource, /datasetName:\s+"ikimon Field Loop"/);

  const authUserSource = await readFile(path.join(platformRoot, "src", "services", "authUsers.ts"), "utf8");
  assert.match(authUserSource, /profile\.name\.trim\(\) \|\| "ZUKAN user"/);
  assert.doesNotMatch(authUserSource, /"ikimon user"/);

  const compatibilityWriterSource = await readFile(path.join(platformRoot, "src", "legacy", "compatibilityWriter.ts"), "utf8");
  assert.match(compatibilityWriterSource, /"ZUKAN user"/);
  assert.doesNotMatch(compatibilityWriterSource, /"ikimon user"/);

  const eventRecapSource = await readFile(path.join(platformRoot, "src", "routes", "observationEventRecapApi.ts"), "utf8");
  assert.match(eventRecapSource, /`zukan-event-\$\{report\.session\.sessionId\}-species\.csv`/);
  assert.doesNotMatch(eventRecapSource, /ikimon-event-.*-species\.csv/);

  const mapAtlasSource = await readFile(path.join(platformRoot, "src", "ui", "mapPlaceAtlasProfile.ts"), "utf8");
  const fieldDetailSource = await readFile(path.join(platformRoot, "src", "ui", "observationFieldDetail.ts"), "utf8");
  const mapExplorerSource = await readFile(path.join(platformRoot, "src", "ui", "mapExplorer.ts"), "utf8");
  for (const source of [mapAtlasSource, fieldDetailSource, mapExplorerSource]) {
    assert.match(source, /zukan\.earth/);
    assert.match(source, /ikimon\.life/);
  }
});

test("landing translations and observation-event entry do not revive the former display brand", async () => {
  const relativePaths = [
    "src/i18n/ja.ts",
    "src/i18n/en.ts",
    "src/i18n/es.ts",
    "src/i18n/pt-BR.ts",
  ];
  for (const relativePath of relativePaths) {
    const source = await readFile(path.join(platformRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /\bikimon\b/, relativePath);
    assert.match(source, /ZUKAN/, relativePath);
  }

  const eventCreateSource = await readFile(path.join(platformRoot, "src", "ui", "observationEventCreate.ts"), "utf8");
  assert.match(eventCreateSource, /主催者としてZUKANにログイン/);
  assert.doesNotMatch(eventCreateSource, /主催者として\s*ikimon\s*にログイン/);
});

test("compatibility PWA surfaces use canonical ZUKAN names and generated app icons", async () => {
  const publicRoot = path.resolve(platformRoot, "..", "upload_package", "public_html");
  const staticManifest = JSON.parse(await readFile(path.join(publicRoot, "manifest.json"), "utf8")) as {
    name: string;
    short_name: string;
    theme_color: string;
    icons: Array<{ src: string }>;
  };
  assert.match(staticManifest.name, /^ZUKAN/);
  assert.equal(staticManifest.short_name, "ZUKAN");
  assert.equal(staticManifest.theme_color, "#0F4A2F");
  assert.ok(staticManifest.icons.every(({ src }) => src.startsWith("/assets/brand/zukan-app-icon-")));

  const manifestPhp = await readFile(path.join(publicRoot, "manifest.php"), "utf8");
  const metaPhp = await readFile(path.join(publicRoot, "components", "meta.php"), "utf8");
  const pushManager = await readFile(path.join(publicRoot, "js", "PushManager.js"), "utf8");
  const serviceWorker = await readFile(path.join(publicRoot, "sw.php"), "utf8");
  const presentationSource = [manifestPhp, metaPhp, pushManager, serviceWorker].join("\n");
  assert.doesNotMatch(presentationSource, /assets\/img\/(?:pwa-icon|apple-touch-icon|favicon-32|icon-192)/);
  assert.doesNotMatch(presentationSource, /apple-mobile-web-app-title" content="ikimon"|new Notification\('ikimon/);
  assert.match(manifestPhp, /'short_name' => 'ZUKAN'/);
  assert.match(metaPhp, /apple-mobile-web-app-title" content="ZUKAN"/);
  assert.match(pushManager, /new Notification\('ZUKAN/);
  assert.match(serviceWorker, /assets\/brand\/zukan-app-icon-192\.png/);
});
