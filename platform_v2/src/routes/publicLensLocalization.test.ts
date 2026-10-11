import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

const locales = [
  { path: "/lens", lang: "ja", title: "その場で観察する | ZUKAN", heading: "気になった生きものを、その場で確かめる" },
  { path: "/ja/lens", lang: "ja", title: "その場で観察する | ZUKAN", heading: "気になった生きものを、その場で確かめる" },
  { path: "/en/lens", prefix: "en", lang: "en", title: "Observe in the moment | ZUKAN", heading: "Take a closer look at something that caught your eye", aiLimit: "AI offers clues; you make the decision.", unsaved: "This page does not save records." },
  { path: "/es/lens", prefix: "es", lang: "es", title: "Observar en el momento | ZUKAN", heading: "Observa de cerca eso que te llamó la atención", aiLimit: "La IA da pistas; tú decides.", unsaved: "Esta página no guarda registros." },
  { path: "/pt-br/lens", prefix: "pt-br", lang: "pt-BR", title: "Observar na hora | ZUKAN", heading: "Olhe de perto o que chamou sua atenção", aiLimit: "A IA dá pistas; você decide.", unsaved: "Esta página não salva registros." },
] as const;

test("public Lens page keeps its route and localizes the complete public copy", async () => {
  const app = await buildApp();
  try {
    for (const locale of locales) {
      const response = await app.inject({ method: "GET", url: locale.path, headers: { accept: "text/html" } });
      assert.equal(response.statusCode, 200, locale.path);
      assert.match(response.headers["content-type"] ?? "", /text\/html/u, locale.path);
      assert.match(response.body, new RegExp(`<html lang="${locale.lang}">`), locale.path);
      assert.ok(response.body.includes(`<title>${locale.title}</title>`), locale.path);
      assert.ok(response.body.includes(`<h1>${locale.heading}</h1>`), locale.path);
      if (locale.lang !== "ja") {
        assert.ok(response.body.includes(locale.aiLimit), locale.path);
        assert.ok(response.body.includes(locale.unsaved), locale.path);
      }
      if (locale.lang !== "ja") {
        assert.doesNotMatch(response.body, /気になった生きものを、その場で確かめる/u, locale.path);
        assert.ok(response.body.includes(`href="/${locale.prefix}/record"`), locale.path);
      }

      const head = await app.inject({ method: "HEAD", url: locale.path, headers: { accept: "text/html" } });
      assert.equal(head.statusCode, 200, `HEAD ${locale.path}`);
      assert.match(head.headers["content-type"] ?? "", /text\/html/u, `HEAD ${locale.path}`);
      assert.equal(head.body, "", `HEAD ${locale.path} must have no body`);
    }
  } finally {
    await app.close();
  }
});
