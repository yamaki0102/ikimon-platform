import assert from "node:assert/strict";
import test from "node:test";
import { handleBiosecurityRequest, parseCapture, type BiosecurityEnv } from "./biosecurity";

const ORIGIN = "https://zukan.test";
const env = {} as BiosecurityEnv;
const GENERIC = "BIOSECURITY_GENERIC_ENABLED";
const NAGA = "BIOSECURITY_NAGAETSURU_ENABLED";
const flags = (...names: string[]) => (flag: string) => names.includes(flag);
const get = (path: string, flagOn?: (flag: string) => boolean) => handleBiosecurityRequest(new Request(ORIGIN + path), env, flagOn).then(response => response!);
const form = (profile: string) => {
  const body = new FormData();
  body.set("profile_id", profile);
  return new Request(ORIGIN, { method: "POST", body });
};

test("generic flag off keeps the kubiaka guide and hides gairai", async () => {
  const html = await (await get("/ja/biosecurity")).text();
  assert.ok(html.includes("気になる虫や木を見つけたら"));
  assert.doesNotMatch(html, /class="bio-choose-primary"|見つけた生きものを残す/);
  for (const path of ["/ja/biosecurity/gairai", "/ja/biosecurity/gairai/capture"]) assert.equal((await get(path, flags(NAGA))).status, 404);
  const profiles = await (await get("/api/v1/biosecurity/profiles", flags(NAGA))).json() as { profiles: { id: string }[] };
  assert.ok(!profiles.profiles.some(profile => profile.id === "gairai"));
  await assert.rejects(parseCapture(form("gairai"), flags(NAGA)), (error: unknown) => (error as { status?: number }).status === 422 && /profile_invalid/.test(String((error as Error).message)));
});

test("generic flag on shows the chooser with gairai first", async () => {
  const html = await (await get("/ja/biosecurity", flags(GENERIC))).text();
  assert.ok(html.includes("見つけた生きものを残す"));
  assert.ok(html.includes("種類が分からなくても"));
  assert.ok(html.includes('href="/ja/biosecurity/gairai/capture"'));
  assert.doesNotMatch(html, /\/ja\/biosecurity\/nagaetsuru/);
  assert.doesNotMatch(html, /気になる虫や木を見つけたら/);
  const kubiaka = html.indexOf('href="/ja/biosecurity/kubiaka"');
  assert.ok(kubiaka > html.indexOf(`class="bio-choose-primary"`) && kubiaka > 0);
  const both = await (await get("/ja/biosecurity", flags(GENERIC, NAGA))).text();
  assert.ok(both.includes('href="/ja/biosecurity/nagaetsuru"'));
  assert.ok(both.indexOf("/ja/biosecurity/gairai/capture") < both.indexOf("/ja/biosecurity/nagaetsuru"));
});

test("gairai capture page uses generic copy", async () => {
  const response = await get("/ja/biosecurity/gairai/capture", flags(GENERIC));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("持ち帰ったり"));
  assert.ok(html.includes("見た目や数、いた場所など、わかることだけ"));
  assert.ok(html.includes("ZUKAN 外来種の記録（種類は未確認）"));
  assert.ok(html.includes("other_animal"));
  assert.doesNotMatch(html, /虫や木/);
  const profiles = await (await get("/api/v1/biosecurity/profiles", flags(GENERIC))).json() as { profiles: { id: string }[] };
  assert.deepEqual(profiles.profiles.map(profile => profile.id), ["kubiaka", "gairai"]);
  await assert.rejects(parseCapture(form("gairai"), flags(GENERIC)), (error: unknown) => !/profile_invalid/.test(String((error as Error).message)));
});
