import assert from "node:assert/strict";
import test from "node:test";
import {
  findMunicipality,
  matchMunicipalityEmail,
  MUNICIPALITIES,
  MUNICIPALITY_DIRECTORY_VERSION,
} from "./municipalityDirectory.js";

test("the versioned primary-source directory covers all municipalities and prefectures", () => {
  assert.equal(MUNICIPALITY_DIRECTORY_VERSION, "jlis-local-government-directory/2026-10-12");
  assert.equal(MUNICIPALITIES.length, 1788);
  assert.equal(MUNICIPALITIES.filter((row) => row.kind === "municipality").length, 1741);
  assert.equal(MUNICIPALITIES.filter((row) => row.kind === "prefecture").length, 47);
  assert.equal(new Set(MUNICIPALITIES.map((row) => row.prefecture)).size, 47);
  assert.equal(new Set(MUNICIPALITIES.map((row) => row.code)).size, 1788);
  for (const row of MUNICIPALITIES) {
    assert.match(row.code, /^[0-9]{6}$/);
    assert.match(row.sourceUrl, /^https:\/\/www\.j-lis\.go\.jp\/spd\/map-search\//);
    assert.match(row.codeSourceUrl, /^https:\/\/www\.j-lis\.go\.jp\/spd\/code-address\//);
    assert.equal(row.verifiedAt, "2026-10-12");
    assert.equal(findMunicipality(row.code.slice(0, 5)), row);
    assert.ok(row.domains.every((domain) => row.domainSources.some((source) => source.domain === domain)));
  }
});

test("codes bind exact municipalities, preserve leading zeroes, and reject altered check digits", () => {
  assert.equal(findMunicipality("011002")?.name, "札幌市");
  assert.equal(findMunicipality("01100"), findMunicipality("011002"));
  assert.equal(findMunicipality("221309")?.name, "浜松市");
  assert.equal(findMunicipality("131016")?.name, "千代田区");
  assert.equal(findMunicipality("221309")?.prefecture, "静岡県");
  // Administrative wards are served through the designated city, not an independent authority.
  assert.equal(findMunicipality("011011"), null);
  for (const code of ["11002", "011000", "011001", "011003", "000000", "999999", "2213090", " 221309", "221309\n", "２２１３０９"]) {
    assert.equal(findMunicipality(code), null, code);
  }
});

test("only the selected government's exact officially sourced domains are eligible", () => {
  assert.equal(matchMunicipalityEmail("221309", "kankyou@city.hamamatsu.shizuoka.jp"), true);
  assert.equal(matchMunicipalityEmail("22130", "Kankyou+field@CITY.HAMAMATSU.SHIZUOKA.JP"), true);
  assert.equal(matchMunicipalityEmail("011002", "official@city.sapporo.jp"), true);
  assert.equal(matchMunicipalityEmail("221309", "official@www.city.hamamatsu.shizuoka.jp"), true);
  assert.equal(matchMunicipalityEmail("220001", "shizenhogo@pref.shizuoka.lg.jp"), true);
  assert.equal(matchMunicipalityEmail("221309", "shizenhogo@pref.shizuoka.lg.jp"), false);
  assert.equal(matchMunicipalityEmail("220001", "kankyou@city.hamamatsu.shizuoka.jp"), false);
  assert.equal(matchMunicipalityEmail("221300", "kankyou@city.hamamatsu.shizuoka.jp"), false);
  assert.ok(findMunicipality("220001")?.domainSources.some((source) =>
    source.domain === "pref.shizuoka.lg.jp" && source.kind === "published-mailbox" &&
    source.sourceUrl === "https://www.pref.shizuoka.jp/kensei/introduction/soshiki/1002382/1002546/1017621.html"));
});

test("suffixes, subdomains, parents, unrelated government domains and generic providers confer no authority", () => {
  for (const email of [
    "a@city.hamamatsu.shizuoka.jp.attacker.com",
    "a@evilcity.hamamatsu.shizuoka.jp",
    "a@evil.city.hamamatsu.shizuoka.jp",
    "a@mail.city.hamamatsu.shizuoka.jp",
    "a@www1.city.hamamatsu.shizuoka.jp",
    "a@www.www.city.hamamatsu.shizuoka.jp",
    "a@hamamatsu.shizuoka.jp",
    "a@shizuoka.jp",
    "a@city.shizuoka.lg.jp",
    "a@lg.jp",
    "a@gmail.com",
    "a@ikimon.co.jp",
  ]) assert.equal(matchMunicipalityEmail("221309", email), false, email);
});

test("Unicode, punycode, control bytes and ambiguous mailbox syntax fail closed", () => {
  for (const email of [
    "a@city.hamamatsu.shizuoka.jp\n", "a@city.hamamatsu.shizuoka.jp\r\nBcc:x@evil.com",
    "a\u0000@city.hamamatsu.shizuoka.jp", "a\u007f@city.hamamatsu.shizuoka.jp",
    "a\u200b@city.hamamatsu.shizuoka.jp", "a＠city.hamamatsu.shizuoka.jp",
    "a@city.hamamatsu.shizuoka。jp", "a@city.hаmamatsu.shizuoka.jp",
    "a@xn--city-hamamatsu.shizuoka.jp", "a@city.hamamatsu.shizuoka.xn--jp",
    " a@city.hamamatsu.shizuoka.jp", "a@city.hamamatsu.shizuoka.jp ",
    "a@city.hamamatsu.shizuoka.jp.", "a@city..hamamatsu.shizuoka.jp",
    "a@city.hamamatsu.shizuoka.jp@evil.com", "a@@city.hamamatsu.shizuoka.jp",
    "Official <a@city.hamamatsu.shizuoka.jp>", '"a"@city.hamamatsu.shizuoka.jp',
    "a(comment)@city.hamamatsu.shizuoka.jp", ".a@city.hamamatsu.shizuoka.jp",
    "a.@city.hamamatsu.shizuoka.jp", "a..b@city.hamamatsu.shizuoka.jp",
    "a@https://city.hamamatsu.shizuoka.jp", "a@[127.0.0.1]", "a@city.hamamatsu.shizuoka.jp:443",
    "@city.hamamatsu.shizuoka.jp", "a@", `${"a".repeat(65)}@city.hamamatsu.shizuoka.jp`,
  ]) assert.equal(matchMunicipalityEmail("221309", email), false, JSON.stringify(email));
});

test("custom website domains remain discoverable without becoming an email approval fallback", () => {
  const rumoi = findMunicipality("012122");
  assert.equal(rumoi?.name, "留萌市");
  assert.equal(rumoi?.website, "https://www.e-rumoi.jp/");
  assert.deepEqual(rumoi?.domains, []);
  assert.equal(matchMunicipalityEmail("012122", "official@e-rumoi.jp"), false);
  assert.equal(matchMunicipalityEmail("012122", "official@www.e-rumoi.jp"), false);
  assert.equal(matchMunicipalityEmail("282049", "official@nishi.or.jp"), false);
  // An observed non-www hostname is exact only; its parent is not inferred.
  assert.equal(matchMunicipalityEmail("172014", "official@www4.city.kanazawa.lg.jp"), true);
  assert.equal(matchMunicipalityEmail("172014", "official@city.kanazawa.lg.jp"), false);
});

test("one source domain cannot authorize multiple governments and callers cannot mutate the directory", () => {
  const owners = new Map<string, string>();
  for (const municipality of MUNICIPALITIES) {
    assert.ok(Object.isFrozen(municipality));
    assert.ok(Object.isFrozen(municipality.domains));
    assert.ok(Object.isFrozen(municipality.domainSources));
    for (const domain of municipality.domains) {
      assert.ok(!owners.has(domain), `${domain} has multiple government owners`);
      owners.set(domain, municipality.code);
    }
  }
  assert.ok(Object.isFrozen(MUNICIPALITIES));
  const target = findMunicipality("221309")!;
  assert.throws(() => { (target.domains as string[]).push("attacker.com"); }, TypeError);
  assert.throws(() => { (target as { code: string }).code = "220001"; }, TypeError);
  assert.equal(matchMunicipalityEmail("221309", "a@attacker.com"), false);
});
