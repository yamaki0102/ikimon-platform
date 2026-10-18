import assert from "node:assert/strict";
import test from "node:test";
import { handleGenrePortalRequest, type PublicParticipation, type PublicParticipationSource } from "./genrePortal";

const items: PublicParticipation[] = [
  { id: "event-1", kind: "event", genre: "nature", region: "shizuoka", name: "森の観察会 <春>", description: "川辺で観察します。", startDate: "2027-04-10T09:00:00+09:00", location: "都田の森", publisher: "森の会", url: "/events/1" },
  { id: "site-1", kind: "site", genre: "culture", region: "kyoto", name: "地域資料館", url: "/places/1" },
  { id: "record-1", kind: "record", genre: "nature", region: "nagano", name: "高原の記録", url: "/records/1" },
];

function fixtureSource(fixture: PublicParticipation[] = items): PublicParticipationSource {
  return { async listPublic(filter) { return fixture.filter((item) => (!filter.genre || item.genre === filter.genre) && (!filter.region || item.region === filter.region)); } };
}

async function get(path: string, enabled: string | undefined = "true", source = fixtureSource()): Promise<Response> {
  const response = await handleGenrePortalRequest(new Request(`https://zukan.earth${path}`), { GENRE_PORTALS_ENABLED: enabled }, source);
  assert.ok(response);
  return response;
}

test("feature flag defaults off and returns 404", async () => {
  const response = await handleGenrePortalRequest(new Request("https://zukan.earth/portal"), {}, fixtureSource());
  assert.equal(response?.status, 404);
  assert.equal((await get("/portal", "TRUE")).status, 404);
});

test("index lists fixture genres", async () => {
  const response = await get("/portal");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /\/portal\/nature/);
  assert.match(body, /\/portal\/culture/);
});

test("empty genre is a polite 200 state", async () => {
  const response = await get("/portal/history");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /まだ公開情報はありません/);
  assert.match(body, /href="\/portal"/);
});

test("listing filters through the source and escapes item names", async () => {
  const body = await (await get("/portal/nature/shizuoka")).text();
  assert.match(body, /森の観察会 &lt;春&gt;/);
  assert.doesNotMatch(body, /高原の記録|地域資料館|森の観察会 <春>/);
});

test("JSON-LD parses with Event, Organization and ItemList nodes", async () => {
  const body = await (await get("/portal/nature/shizuoka")).text();
  const raw = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(raw);
  const data = JSON.parse(raw) as Array<{ "@graph": Array<{ "@type": string; name?: string; startDate?: string; location?: { name: string } }> }>;
  const graph = data[0]?.["@graph"] ?? [];
  assert.ok(graph.some((node) => node["@type"] === "Organization"));
  assert.ok(graph.some((node) => node["@type"] === "ItemList"));
  const event = graph.find((node) => node["@type"] === "Event");
  assert.equal(event?.name, "森の観察会 <春>");
  assert.equal(event?.startDate, "2027-04-10T09:00:00+09:00");
  assert.equal(event?.location?.name, "都田の森");
});

test("invalid slugs return 404 without reading the source", async () => {
  let reads = 0;
  const source: PublicParticipationSource = { async listPublic() { reads += 1; return []; } };
  for (const path of ["/portal/Nature", "/portal/nature/%3Cscript%3E", "/portal/nature/tokyo/extra", "/portals/nature"]) {
    const response = await handleGenrePortalRequest(new Request(`https://zukan.earth${path}`), { GENRE_PORTALS_ENABLED: "true" }, source);
    if (path.startsWith("/portals")) assert.equal(response, null);
    else assert.equal(response?.status, 404);
  }
  assert.equal(reads, 0);
});
