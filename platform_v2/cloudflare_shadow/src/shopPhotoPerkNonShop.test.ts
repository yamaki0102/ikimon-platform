import assert from "node:assert/strict";
import test from "node:test";
import { renderShopPlacePerkSectionHtml, type ShopPlacePerkSectionData } from "./shopPhotoPerk";

function data(isShop: boolean): ShopPlacePerkSectionData {
  return {
    placeId: "plc_park_1",
    shopName: "テスト公園",
    perkText: "",
    active: false,
    canManage: true,
    isShop,
    photos: [],
    metrics: { submissionRate: 0.5, redemptionCount: 3, rejectionRate: 0.1, oneTapSaveRate: 0.2 },
  } as ShopPlacePerkSectionData;
}

test("non-shop manager sees only collapsed setup details", () => {
  const html = renderShopPlacePerkSectionHtml(data(false));
  assert.ok(!html.includes("店の写真投稿"));
  assert.ok(!html.includes("投稿率"));
  assert.ok(!html.includes("まだ公開された投稿写真はありません"));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("この場所を店として登録する（管理者のみ）"));
  assert.ok(html.includes("shop-perk-config-form"));
});

test("shop keeps full panel", () => {
  const html = renderShopPlacePerkSectionHtml(data(true));
  assert.ok(html.includes("店の写真投稿"));
  assert.ok(html.includes("投稿率"));
  assert.ok(!html.includes("<details"));
});
