import assert from "node:assert/strict";
import test from "node:test";
import { BIOSECURITY_SCRIPT, BIOSECURITY_EN_SCRIPT, renderBiosecurityPage, type BiosecurityView } from "../../src/ui/biosecurity";
import { BIOSECURITY_PROFILES } from "../../src/services/biosecurityProfiles";

const CJK = /[぀-ヿ㐀-鿿]/;
const VIEWS: BiosecurityView[] = ["guide", "chooser", "capture", "receipt", "municipalities", "inbox"];
const render = (view: BiosecurityView, lang: "ja" | "en" | "es" | "pt-br", profile = BIOSECURITY_PROFILES[2]!) =>
  renderBiosecurityPage(view, { lang, profile, profiles: [...BIOSECURITY_PROFILES], recordId: `br_${"a".repeat(40)}` });
const strip = (html: string) => html.replace(/\([^)]*[぀-ヿ㐀-鿿][^)]*\)/g, "");

for (const lang of ["en", "es", "pt-br"] as const) {
  test(`biosecurity pages have no Japanese UI strings [${lang}]`, () => {
    for (const profile of BIOSECURITY_PROFILES) for (const view of VIEWS) {
      const out = strip(render(view, lang, profile));
      const m = CJK.exec(out);
      assert.equal(m, null, `${view}/${profile.id}/${lang}: "${m ? out.slice(Math.max(0, m.index - 50), m.index + 30) : ""}"`);
      assert.doesNotMatch(out, /\/ja\//);
    }
  });
}

test("biosecurity English client script has no Japanese, parses, and keeps links in-language", () => {
  assert.doesNotMatch(strip(BIOSECURITY_EN_SCRIPT), CJK);
  assert.doesNotThrow(() => new Function(BIOSECURITY_EN_SCRIPT));
  assert.match(BIOSECURITY_EN_SCRIPT, /\/en\/biosecurity\/records\//);
  const bq = String.fromCharCode(92, 39);
  assert.equal(BIOSECURITY_EN_SCRIPT.split(bq).length, BIOSECURITY_SCRIPT.split(bq).length);
  for (const lang of ["en", "es", "pt-br"] as const) {
    const html = render("receipt", lang);
    const script = /<script>([\s\S]*?)<\/script>/.exec(html.slice(html.indexOf('id="bio-config"')))![1]!;
    assert.doesNotThrow(() => new Function(script));
    assert.match(script, new RegExp(`/${lang}/biosecurity/records`));
  }
});

test("biosecurity ja output keeps its exact copy and links", () => {
  assert.match(render("capture", "ja"), /写真を残そう/);
  assert.match(render("capture", "ja"), /href="\/ja\/biosecurity"/);
  assert.match(render("guide", "ja"), /どんな写真を撮ろう？/);
  assert.equal(BIOSECURITY_SCRIPT.includes("/ja/biosecurity/records/"), true);
  assert.match(render("receipt", "ja"), /記録を開いています。/);
});

test("biosecurity English copy reads as English", () => {
  assert.match(render("capture", "en"), /<h1>Save a photo<\/h1>/);
  assert.match(render("capture", "en"), /Take or choose photos/);
  assert.match(render("guide", "en"), /What photos should I take\?/);
  assert.match(render("municipalities", "en"), /Get a verification code by email/);
  assert.match(render("receipt", "en"), /Opening the record\./);
  assert.match(render("inbox", "en"), /Shared records/);
  assert.match(render("capture", "en", BIOSECURITY_PROFILES[0]!), /Watching for the red-necked longhorn beetle/);
});
