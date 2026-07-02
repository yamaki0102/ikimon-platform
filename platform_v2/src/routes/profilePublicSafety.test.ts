import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("public profile route uses public visibility and never owner mode for signed-in other viewers", async () => {
  const readRoute = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const publicProfileBody = readRoute.slice(
    readRoute.indexOf("function renderProfileSnapshotBody"),
    readRoute.indexOf("function notesEntryDate"),
  );
  const publicProfileRoute = readRoute.slice(
    readRoute.indexOf('app.get<{ Params: { userId: string } }>("/profile/:userId"'),
    readRoute.indexOf("await registerPlaceStationReadRoutes"),
  );
  const guestProfileRoute = readRoute.slice(
    readRoute.indexOf('app.get<{ Params: { userId: string } }>("/guest/:userId"'),
    readRoute.indexOf('app.get<{ Params: { userId: string } }>("/profile/:userId"'),
  );

  assert.match(publicProfileBody, /profileVisibility: ProfileSnapshotVisibility = "public"/);
  assert.match(publicProfileBody, /const isOwnerView = profileVisibility === "owner"/);
  assert.match(publicProfileBody, /formatPlaceDisplay\(item, lang, isOwnerView \? "owner" : "public"\)/);
  assert.doesNotMatch(publicProfileBody, /formatPlaceDisplay\(item, lang, viewerUserId \? "owner" : "public"\)/);

  assert.match(publicProfileRoute, /getProfileSnapshot\(request\.params\.userId, \{ visibility: "public" \}\)/);
  assert.match(publicProfileRoute, /const isOwnProfile = Boolean\(viewerSession\?\.userId && viewerSession\.userId === snapshot\.userId\)/);
  assert.match(publicProfileRoute, /renderProfileSnapshotBody\(basePath, lang, viewerSession\?\.userId \?\? null, snapshot, "registered", "public"\)/);
  assert.doesNotMatch(publicProfileRoute, /\/home\?userId=/);
  assert.doesNotMatch(publicProfileRoute, /このユーザーのホームを見る/);
  assert.doesNotMatch(publicProfileRoute, /最近の場所と観察を追う/);

  assert.match(guestProfileRoute, /getProfileSnapshot\(request\.params\.userId, \{ visibility: "public" \}\)/);
  assert.match(guestProfileRoute, /renderProfileSnapshotBody\(basePath, lang, viewerSession\?\.userId \?\? null, snapshot, "guest", "public"\)/);
  assert.doesNotMatch(guestProfileRoute, /\/home\?userId=/);
  assert.doesNotMatch(guestProfileRoute, /このGuestのホームを見る/);
});

test("public profile visual QA contract targets public records instead of owner places", async () => {
  const siteMap = await readFile(path.join(process.cwd(), "src", "siteMap.ts"), "utf8");
  const publicProfilePage = siteMap.slice(
    siteMap.indexOf('path: "/profile/:userId"'),
    siteMap.indexOf('path: "/observations/:id"'),
  );

  assert.match(publicProfilePage, /expectedText: \{ ja: "地域図鑑に公開された観察" \}/);
  assert.doesNotMatch(publicProfilePage, /expectedText: \{ ja: "最近の場所" \}/);
  assert.doesNotMatch(publicProfilePage, /一人の観察と場所の履歴を見る/);
});
