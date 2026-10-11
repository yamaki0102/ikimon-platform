import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildApp } from "../../src/app.js";
import publicPresentationEntry from "./publicPresentationEntry";

const sourceSha = "f".repeat(40);
const manifestHash = "e".repeat(64);
const versionPrefix = `original-ui/versions/${manifestHash}`;
const manifestKey = `${versionPrefix}/manifest.json`;
const locales = [
  { path: "/ja/lens", lang: "ja", title: "その場で観察する | ZUKAN", heading: "気になった生きものを、その場で確かめる", lead: "散歩中でも旅先でも、気になった生きものにカメラを向けると AI が候補と見分けるヒントを返します。ここで決めきらなくて大丈夫です。まずは発見を残すための入口です。" },
  { path: "/en/lens", lang: "en", title: "Observe in the moment | ZUKAN", heading: "Take a closer look at something that caught your eye", lead: "Whether you are out for a walk or traveling, point your camera at a creature you are curious about. AI can offer possible names and identification tips. You do not have to decide here. Start by saving what you found.", aiLimit: "AI offers clues; you make the decision.", unsaved: "This page does not save records.", ctaHref: "/en/record" },
  { path: "/es/lens", lang: "es", title: "Observar en el momento | ZUKAN", heading: "Observa de cerca eso que te llamó la atención", lead: "Ya sea durante un paseo o un viaje, apunta la cámara a un ser vivo que te dé curiosidad. La IA puede ofrecer posibles nombres y pistas para distinguirlos. No tienes que decidir aquí. Empieza por guardar lo que encontraste.", aiLimit: "La IA da pistas; tú decides.", unsaved: "Esta página no guarda registros.", ctaHref: "/es/record" },
  { path: "/pt-br/lens", lang: "pt-BR", title: "Observar na hora | ZUKAN", heading: "Olhe de perto o que chamou sua atenção", lead: "Durante uma caminhada ou viagem, aponte a câmera para um ser vivo que despertou sua curiosidade. A IA pode sugerir nomes possíveis e dicas para diferenciá-los. Você não precisa decidir aqui. Comece guardando o que encontrou.", aiLimit: "A IA dá pistas; você decide.", unsaved: "Esta página não salva registros.", ctaHref: "/pt-br/record" },
] as const;
const sha256 = (body: string) => createHash("sha256").update(body).digest("hex");

type FixtureObject = { body: string; contentType: string };

class ReadOnlyBucket {
  readonly objects = new Map<string, FixtureObject>();
  readonly gets: string[] = [];
  writes = 0;

  async get(key: string) {
    this.gets.push(key);
    const object = this.objects.get(key);
    return object ? {
      key,
      body: new Response(object.body).body,
      httpMetadata: { contentType: object.contentType },
      checksums: { sha256: sha256(object.body) },
    } : null;
  }

  async put() {
    this.writes += 1;
    throw new Error("Lens delivery fixture forbids R2 writes");
  }

  async delete() {
    this.writes += 1;
    throw new Error("Lens delivery fixture forbids R2 deletes");
  }
}

test("the Worker serves localized Lens HTML rendered from the canonical route copy", async () => {
  const app = await buildApp();
  const bucket = new ReadOnlyBucket();
  const items: { key: string; sha256: string; version_prefix: string }[] = [];
  const effects = { db: 0, network: 0 };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    effects.network += 1;
    throw new Error("external fetch forbidden in Lens materialization fixture");
  };

  try {
    app.log.level = "silent";
    for (const locale of locales) {
      const rendered = await app.inject({
        method: "GET",
        url: locale.path,
        headers: { host: "zukan.earth", "x-forwarded-proto": "https", accept: "text/html" },
      });
      assert.equal(rendered.statusCode, 200, `canonical render ${locale.path}`);
      const key = `html/${locale.path.slice(1)}.html`;
      items.push({ key, sha256: sha256(rendered.body), version_prefix: versionPrefix });
      bucket.objects.set(`${versionPrefix}/${key}`, {
        body: rendered.body,
        contentType: "text/html; charset=utf-8",
      });
    }
    bucket.objects.set(manifestKey, { body: JSON.stringify({ items }), contentType: "application/json" });

    const db = { prepare() { effects.db += 1; throw new Error("anonymous Lens delivery must not query D1"); } };
    const env = {
      ENVIRONMENT: "production",
      ASSET_BUCKET: bucket,
      CORE_DB: db,
      OBS_DB: db,
      IKIMON_GIT_SHA: sourceSha,
      IKIMON_WORKER_VERSION: "lens-materialization-local-fixture",
      IKIMON_UI_MANIFEST_HASH: manifestHash,
    };

    for (const locale of locales) {
      for (const method of ["GET", "HEAD"] as const) {
        const response = await publicPresentationEntry.fetch(
          new Request(`https://zukan.earth${locale.path}`, { method }),
          env,
          { waitUntil() {} },
        );
        const body = await response.text();
        assert.equal(response.status, 200, `${method} ${locale.path}`);
        assert.equal(response.headers.get("x-ikimon-cloudflare-materialized"), "original-ui-html", locale.path);
        assert.equal(response.headers.get("x-ikimon-deploy-sha"), sourceSha, locale.path);
        assert.match(response.headers.get("content-type") ?? "", /text\/html/u, locale.path);
        if (method === "HEAD") {
          assert.equal(body, "", `HEAD ${locale.path} must have no body`);
        } else {
          assert.match(body, new RegExp(`<html lang="${locale.lang}">`), locale.path);
          assert.ok(body.includes(`<title>${locale.title}</title>`), locale.path);
          assert.ok(body.includes(`<h1>${locale.heading}</h1>`), locale.path);
          assert.ok(body.includes(`<meta name="description" content="${locale.lead}" />`), locale.path);
          assert.ok(body.includes('<link rel="canonical" href="https://zukan.earth/ja/"'), locale.path);
          if (locale.lang !== "ja") {
            assert.ok(body.includes(locale.aiLimit), locale.path);
            assert.ok(body.includes(locale.unsaved), locale.path);
            assert.ok(body.includes(`href="${locale.ctaHref}"`), locale.path);
          }
          if (locale.lang !== "ja") {
            assert.doesNotMatch(body, /気になった生きものを、その場で確かめる/u, locale.path);
          }
        }
      }
    }
    assert.equal(effects.db, 0);
    assert.equal(effects.network, 0);
    assert.equal(bucket.writes, 0);
    assert.ok(bucket.gets.includes(`${versionPrefix}/html/en/lens.html`));
    assert.ok(bucket.gets.includes(`${versionPrefix}/html/es/lens.html`));
    assert.ok(bucket.gets.includes(`${versionPrefix}/html/pt-br/lens.html`));
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});
