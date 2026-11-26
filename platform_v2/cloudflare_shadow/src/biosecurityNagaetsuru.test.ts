import assert from "node:assert/strict";
import test from "node:test";
import { handleBiosecurityRequest, parseCapture, type BiosecurityEnv } from "./biosecurity";

const ORIGIN = "https://zukan.test";
const env = {} as BiosecurityEnv;
const FLAG = "BIOSECURITY_NAGAETSURU_ENABLED";
const on = (flag: string) => flag === FLAG;
const get = (path: string, flagOn?: (flag: string) => boolean) => handleBiosecurityRequest(new Request(ORIGIN + path), env, flagOn).then(response => response!);
const form = (profile: string) => {
  const body = new FormData();
  body.set("profile_id", profile);
  return new Request(ORIGIN, { method: "POST", body });
};

test("kubiaka pages keep the beetle copy with the flag off and on", async () => {
  for (const flagOn of [undefined, on]) {
    const guide = await (await get("/ja/biosecurity/kubiaka", flagOn)).text();
    for (const text of ["気になる虫や木を、写真で残せます。今ある写真でも大丈夫です。", "気になる虫を見つけたら", "木くずや木の変化を見つけたら", "写真を残しても、虫の名前や被害の有無は確定しません。"]) assert.ok(guide.includes(text), text);
    const capture = await (await get("/ja/biosecurity/kubiaka/capture", flagOn)).text();
    assert.ok(capture.includes('placeholder="虫や木のようすなど、わかることだけ"'));
    assert.ok(capture.includes("ZUKAN 外来種の記録（虫の名前や被害は未確認）"));
  }
});

test("nagaetsuru is a 404, omitted and rejected while the flag is off", async () => {
  for (const path of ["/ja/biosecurity/nagaetsuru", "/ja/biosecurity/nagaetsuru/capture"]) assert.equal((await get(path)).status, 404);
  const profiles = await (await get("/api/v1/biosecurity/profiles")).json() as { profiles: { id: string }[] };
  assert.deepEqual(profiles.profiles.map(profile => profile.id), ["kubiaka"]);
  await assert.rejects(parseCapture(form("nagaetsuru")), (error: unknown) => (error as { status?: number }).status === 422 && /profile_invalid/.test(String((error as Error).message)));
});

test("nagaetsuru renders its own copy with the flag on", async () => {
  const guide = await get("/ja/biosecurity/nagaetsuru", on);
  assert.equal(guide.status, 200);
  const guideHtml = await guide.text();
  assert.ok(guideHtml.includes("水辺で気になる草を見つけたら"));
  assert.ok(guideHtml.includes("花を見つけたら"));
  assert.ok(guideHtml.includes("写真を残しても、草の名前は確定しません。"));
  assert.doesNotMatch(guideHtml, /虫|木くず/);
  const capture = await get("/ja/biosecurity/nagaetsuru/capture", on);
  assert.equal(capture.status, 200);
  const html = await capture.text();
  assert.ok(html.includes("抜いたり"));
  assert.ok(html.includes("草のようすや広がり、水辺の場所など、わかることだけ"));
  assert.ok(html.includes("ZUKAN 外来種の記録（草の名前は未確認）"));
  assert.ok(html.includes("water_mat"));
  assert.doesNotMatch(html, /虫や木/);
  const profiles = await (await get("/api/v1/biosecurity/profiles", on)).json() as { profiles: { id: string }[] };
  assert.deepEqual(profiles.profiles.map(profile => profile.id), ["kubiaka", "nagaetsuru"]);
  await assert.rejects(parseCapture(form("nagaetsuru"), on), (error: unknown) => !/profile_invalid/.test(String((error as Error).message)));
});
