# ZUKAN名称変更・Home刷新 — Opusレビュー採否

- Date: 2026-07-29
- Target PR: #1488
- Target head at review: `39455d73f510422a5cb735db06ed55262d221ea6`
- Decision: `REQUEST_CHANGES accepted`

## Scope decision

`ZUKAN`の命名判断は採択済みであり、本レビューでは蒸し返さない。商標クリアランス、名称変更、`zukan.earth`取得可否はPR #1488のmerge blockerにしない。

## Blocking findings adopted

1. `siteShell.ts`を含むvisible brand、metadata、accessibility label、footerがZUKANへ統一されていない。
2. OGP、apple touch icon、favicon、PWA iconでSVG/PNGの用途と宣言が混在している。互換性のあるラスタ派生物を用意する。
3. Cloudflare state-split injectionがmember Homeの新しいsectionを削除・置換し、PR本文とruntime結果が一致しない。
4. member経路に生成風画像と`イメージ`表示が残り、guest-only testでは回帰を検出できない。
5. `brand-manifest.json`が旧IKIMON資産を正本として残している。
6. 1/2/5枚時のguest mosaic、empty state専用copy、maskable safe zoneを実表示で検証する。
7. 挙動変更と無関係な再formatを戻し、reviewable diffへ縮小する。

## Partially adopted

- Homeで「写真が場所と時間のRecordになり、地域の知識へ育つ」価値を現在より具体化する。
- safeなPlace名・地域文脈を実写真に付け、単なる写真フィードにしない。
- `ZUKAN`、IKIMON株式会社、`ikimon.life`の関係をfooter等で簡潔に示す。
- absolute URL設定化は将来domain migrationのgateとして維持するが、PR #1488でdomain切替までは行わない。

## Not adopted as blockers

- ZUKANという名称の再検討
- 商標クリアランス
- `zukan.earth` inventory
- adopted logo symbol / wordmarkの全面描き直し
- 公開Recordが0件の環境で必ずseed写真を投入すること
- PRの強制分割

## Required completion gate

- guest/member両経路でvisible brandとmetadataがZUKANへ一貫
- private / blurred / blocked public Recordの非露出
- synthetic lifestyle asset / `イメージ` badgeが全runtime経路で0
- 0/1/2/3/5枚mosaic、empty state、long copyを検証
- 320 / 375 / 390 / 412 / 768 / 1024 / 1440px
- manifest / apple touch / favicon / OGPの実配信形式と宣言が一致
- source tests green
- exact-SHA staging visual QA before merge
- production、DB、migration、secret、DNSは変更しない
