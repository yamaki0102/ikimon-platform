# 2026-04-12 Handover: Multilingual + Staging + UI Hardening

このファイルは、2026-04-12 セッションで進めた `ikimon.life` の実装内容を次セッションへ引き継ぐための現行メモ。
古い `docs/CLAUDE_HANDOVER.md` は 2026-03 系の UI/UX 改修メモなので、今の続きはまずこのファイルを読むこと。

## 今回の主成果

1. `Lang` の fallback を修正
2. `public_html` 配下の `__('key', '日本語fallback')` を実質ゼロ化
3. `for-business` を 4言語対応のデータ駆動に切り替え
4. staging 実表示まで確認
5. ヘッダー / CTA / 高密度画面の折り返し崩れを部分修正

## 重要な判断

- 4ヶ国語対応は「`__()` の fallback を英語化するだけ」では不十分
- ページ本文や `BrandMessaging` の直書き日本語を翻訳層に乗せない限り、英日混在は止まらない
- そのため `for-business/index.php` は静的コピーを `lang/*.php` に寄せ、`BrandMessaging` も `Lang` 経由で返すように変えた

## 主要変更ファイル

### 翻訳・言語基盤

- `upload_package/libs/Lang.php`
  - `Lang::get()` が文字列だけでなく配列も返せるように変更
  - `business_lp` や `regional_messaging` のような構造化翻訳データを取得可能にした

- `upload_package/libs/BrandMessaging.php`
  - `regionalRevitalization()` が `Lang::get('regional_messaging')` を優先して返すように変更
  - fallback として従来の日本語定数も維持

- `upload_package/lang/ja.php`
- `upload_package/lang/en.php`
- `upload_package/lang/es.php`
- `upload_package/lang/pt-br.php`
  - `regional_messaging` を追加
  - `business_lp` を大幅拡張
  - `for-business/index.php` に必要な本文・FAQ・summary・CTA・plan label まで持たせた

### ページ修正

- `upload_package/public_html/for-business/index.php`
  - 直書きの日本語/英語本文をやめて `business_lp` / `regional_messaging` 参照に変更
  - `features`, `personas`, `outcomes`, `plans`, `faq`, `closing CTA` を翻訳データから描画
  - staging 上で basic auth 付きで実ページ確認済み

- `upload_package/public_html/components/nav.php`
- `upload_package/public_html/components/footer.php`
- `upload_package/public_html/components/navigator.php`
- `upload_package/public_html/index.php`
- `upload_package/public_html/explore.php`
- `upload_package/public_html/about.php`
- `upload_package/public_html/dashboard.php`
- `upload_package/public_html/profile.php`
- `upload_package/public_html/post.php`
- `upload_package/public_html/observation_detail.php`
- `upload_package/public_html/species.php`
- `upload_package/public_html/terms.php`
  - `__('...', '日本語fallback')` の日本語 fallback を整理済み
  - `public_html` 配下でこのパターンのスキャンは 0 件まで落としてある

### UI 崩れ対策

- `upload_package/public_html/for-business/index.php`
  - ボタンと見出しに折り返し耐性を追加
  - ナビゲーションの詰まりを軽減

- `upload_package/public_html/components/nav.php`
  - 2xl 以上に一部表示を逃がしてヘッダー詰まりを軽減
  - CTA / language toggle / nav item の `whitespace-nowrap` を整理

- `upload_package/public_html/profile.php`
  - タブ列の `whitespace-nowrap` を緩めた

- `upload_package/public_html/site_dashboard.php`
  - サイト名見出しの折り返し耐性を追加

- `upload_package/public_html/components/cookie_consent.php`
  - 同意ボタンの長文耐性を補強

- `upload_package/public_html/id_workbench.php`
  - 上部バー、welcome banner、preset 行、同定ボタン周辺の横溢れを軽減

## staging 確認結果

- 対象 URL:
  - `https://staging.162-43-44-131.sslip.io/for-business/`
- staging は basic auth あり
- 認証情報の保存先:
  - `_archive/staging_access/staging_access_latest.txt`
- `Invoke-WebRequest` で `HTTP 200` を確認
- ただし確認時点の staging HTML は、`for-business/index.php` の新しい翻訳データ化より前の内容が返っていた
  - つまり「ローカル修正は完了」「staging deploy はまだ別」
  - 次セッションで必要なのは deploy / parity 確認

## このあと追加で終わったこと

1. `for-business/apply.php` を 4 言語対応に変更し、staging へ反映済み
2. `about.php` の本文を翻訳配列ベースに整理し、`en / es / pt-BR` の本文まで staging 反映済み
3. `BrandMessaging` の取得をキー単位に修正し、英語 UI に日本語プラン説明が混ざる不具合を解消
4. `footer` / `cookie` の `es / pt-BR` 欠落を補完し、staging 反映済み
5. `about.php` の改行崩れを修正し、英語本文の `\n` 露出を解消
6. `components/nav.php` のアバター `alt` を翻訳化
7. `components/navigator.php` を言語別 JSON 読み込みに変更
8. `public_html/assets/data/navigator_data.en.json`
9. `public_html/assets/data/navigator_data.es.json`
10. `public_html/assets/data/navigator_data.pt-br.json`
   - navigator の質問導線を `ja / en / es / pt-BR` で持てる状態にした
11. `components/quick_identify.php` を 4 言語対応
12. `components/nps_survey.php` を 4 言語対応
13. `components/onboarding.php` を translation key 化
14. `components/onboarding_modal.php` の `x-text` quote 崩れを修正

補足:

- `navigator.php` は現状、`public_html` 側から include されていない
- つまり navigator の多言語化は「今 visible な画面の修正」というより、将来再接続された時に日本語へ逆戻りしないための先回り
- staging では `navigator_data.en.json / es.json / pt-br.json` が public 配信されるところまで確認済み
- nav の visible な日本語固定は、今回把握した範囲ではアバター `alt` 以外はほぼ comment のみ
- `quick_identify.php` は `id_workbench.php` から include されている
- `onboarding_modal.php` は `index.php` から include されている
- `nps_survey.php` は 2026-04-12 時点では include 先が見つかっていない

## 実行済み確認

- `php -l` 実行済み:
  - `upload_package/libs/Lang.php`
  - `upload_package/libs/BrandMessaging.php`
  - `upload_package/lang/ja.php`
  - `upload_package/lang/en.php`
  - `upload_package/lang/es.php`
  - `upload_package/lang/pt-br.php`
  - `upload_package/public_html/for-business/index.php`
  - ほか、上記ページ群の多数

- 確認済み事項:
  - `Lang::get('business_lp')` は配列として取得可能
  - `for-business/index.php` の直書き日本語スキャンは 0 件
  - `public_html` 配下の `__('...', '日本語fallback')` スキャンは 0 件

## 次にやるべきこと

1. `for-business/index.php` の `ja / en / es / pt-BR` を実画面で再確認
   - apply / about と同じ基準で parity を点検
   - pricing / FAQ / CTA / footer まで含める

2. `id_workbench.php` 実画面で `quick_identify` の `en / es / pt-BR` を確認
   - これは logged-in 導線なので source だけでなく実操作で確認したい

3. `public_html` 配下の component 群を `ja固定` スキャンして、残債を一気に圧縮
   - 優先候補: `quick_identify` 以外の logged-in モーダル、survey 系、scan recommendation 系

4. 高密度画面の UI QA 継続
   - 優先候補: `field_research.php`, `site_dashboard.php`
   - 基準: `truncate` の乱用をやめ、本当に必要な箇所だけに限定

## 注意点

- `deploy.json` は production 用で `github_actions_only`
- staging は別系統
  - `docs/STAGING_RUNBOOK.md`
  - `.github/workflows/deploy-staging.yml`
  - `ops/deploy/staging_manifest.json`
- staging/prod の secret 値そのものは docs に書かない
- この handover は「現行の続き」を優先するためのメモで、過去の設計議論全文は再掲していない

## 最初の 5 分でやること

1. このファイルを読む
2. `upload_package/public_html/for-business/index.php` を開く
3. `upload_package/lang/en.php`, `es.php`, `pt-br.php`, `ja.php` の `business_lp` / `regional_messaging` を確認
4. `docs/STAGING_RUNBOOK.md` を見て staging deploy 手順を確認
5. staging に反映して 4言語表示を実画面確認する
