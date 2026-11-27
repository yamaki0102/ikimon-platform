import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerMarketingRoutes } from "../../src/routes/marketing";
import { renderSiteDocument } from "../../src/ui/siteShell";
import { worker } from "./index";

const JA = /[぀-ヿ一-鿿]/u;
const visible = (html: string): string =>
  html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
const attrs = (html: string): string => (html.match(/(?:aria-label|placeholder|title|alt|data-title-open|data-title-close)="[^"]*"/g) ?? []).join(" ");
const shell = (lang: "ja" | "en" | "es" | "pt-BR") =>
  renderSiteDocument({ basePath: "", title: "T", lang, currentPath: `/${lang}/learn`, bodyHtml: "<p>x</p>" } as never);

test("shell aria/title/placeholder have no Japanese outside ja", () => {
  for (const lang of ["en", "es", "pt-BR"] as const) {
    const html = shell(lang);
    assert.equal(JA.test(attrs(html)), false, lang);
    assert.equal(JA.test(visible(html.slice(html.indexOf("data-global-record-camera-sheet")))), false, lang);
  }
  assert.match(shell("en"), /aria-label="Toggle left menu"/);
  assert.match(shell("en"), /placeholder="Jot down what you noticed"/);
  const ja = shell("ja");
  assert.match(ja, /aria-label="左メニューを切り替える"/);
  assert.match(ja, /aria-label="ピントを近くへ"/);
  assert.match(ja, /placeholder="気づいたことを書いておく"/);
  assert.doesNotMatch(ja, /data-title-open/);
});

const get = async (path: string) => {
  const app = Fastify();
  try {
    await registerMarketingRoutes(app);
    const response = await app.inject({ method: "GET", url: path });
    return { statusCode: response.statusCode, text: response.body };
  } finally {
    await app.close();
  }
};

test("en about and learn have no Japanese chrome, ja about unchanged", async () => {
  try {
    const about = await get("/about?lang=en");
    assert.equal(about.statusCode, 200);
    assert.equal(JA.test(visible(about.text) + attrs(about.text)), false);
    assert.match(about.text, /Growing local records together/);
    const learn = await get("/learn?lang=en");
    assert.equal(learn.statusCode, 200);
    assert.equal(JA.test(visible(learn.text) + attrs(learn.text)), false);
    assert.match(learn.text, /Nature connectedness/);
    const ja = await get("/about?lang=ja");
    assert.match(ja.text, /地域の記録を、みんなで育てる。/);
  } finally {
  }
});

test("non-ja privacy and terms redirect to ja", async () => {
  for (const lang of ["en", "es", "pt-br"]) {
    for (const page of ["privacy", "terms"]) {
      const response = await worker.fetch(new Request(`https://zukan.test/${lang}/${page}`), {} as never);
      assert.equal(response.status, 302, `${lang}/${page}`);
      assert.equal(new URL(response.headers.get("location") ?? "").pathname, `/ja/${page}`);
    }
  }
});
