# 連理 Synthetic Browser QA Surface

最終確認日: 2026-07-17

## 目的

Cloudflare上のread-only Browser Runnerが、PC常駐process、localhost MCP、staging write key、
ログインCookie、顧客データに依存せず、連理イベントの主要UIを証拠付きで確認するための固定面。

この面は現行Workerの観察会rendererを再利用するが、データはコード内の固定合成fixtureだけを使う。
実イベント、参加者、写真、位置、アカウント、D1、R2、Queueには接続しない。

## 固定route

base URLは現行Cloudflare stagingの `https://staging.ikimon.life`。

| 状態 | path | 主な確認 |
|---|---|---|
| manifest | `/__ops/browser-qa/renri/manifest.json` | 安全境界、route、viewport、interaction contract |
| join | `/__ops/browser-qa/renri/join` | required入力、保護者同意、error、tab内draft保持、合成成功 |
| rally | `/__ops/browser-qa/renri/rally` | mission、progressbar、browser内progress操作 |
| live | `/__ops/browser-qa/renri/live` | summary、対象分類群、固定timeline |
| recap | `/__ops/browser-qa/renri/recap` | summary、写真なし状態、次の調査ヒント |

routeにquery、任意state、任意path、任意URLを追加しない。上表以外とGET/HEAD以外は404になる。
hostも `staging.ikimon.life` と固定staging workers.dev hostだけを許可する。
production、shadow、developmentなど `ENVIRONMENT=staging` 以外、production host、任意hostでは、
上表を含むprefix全体がdetailなしの404になる。

## 安全境界

- D1 read/write: 0
- R2 read/write: 0
- Queue send/read: 0
- customer data read/write: 0
- cookie/session read/write: 0
- secret/token/credential input: 0
- analytics/telemetry: 0
- external HTTP/asset request: 0
- production mutation: 0
- 実check-in、実投稿、実位置共有: 0
- browser-local state: joinの入力draftとrallyの合成progressだけ。`sessionStorage`またはDOM内に限定

レスポンスは `no-store`、`X-Robots-Tag: noindex,nofollow,noarchive,nosnippet`、
`frame-ancestors 'none'`、`X-Frame-Options: DENY`、`connect-src 'none'` を返す。
HTMLは外部画像・font・scriptを持たず、inline scriptはrequestごとのCSP nonceを必須にする。

## Browser Runner evidence contract

最低viewport:

- 320x568
- 375x667
- 390x844
- 768x1024
- 1366x768
- 1920x1080

標準はmanifestが返す10 viewportを使う。各状態で次をEvidence Bundleへ保存する。

- screenshotとcontact sheet
- viewport別overflow判定
- accessibility smoke（landmark、label、button/link name、progressbar）
- console error
- failed request
- join required-name error
- join minor + location-share + no-consent error
- join input reload persistence
- join controlled synthetic network-error display
- join synthetic successとrally導線
- rally progress interaction
- cleanup結果（server-side cleanup不要、tab-local stateだけ）

manifestの `values_exposed=false`、`customer_data_access=false`、
`customer_data_write=false`、`production_unchanged=true` も証拠へ取り込む。

## 判定境界

この面でPASSと判定できるのは、固定合成状態のvisual、responsive、accessibility smoke、
browser内interaction、no-network contractまで。

以下は別gateのまま残す。

- 実データの正確性
- 実ログイン・権限・Cookie lifecycle
- 実check-in、写真投稿、位置共有、D1/R2/Queue連携
- 実スマートフォン・OS・in-app browser
- 現地の安全性、回線、案内、参加者行動
- 人によるvisual judgment
- productionのread-only smoke

合成面のPASSを、実データ、人、実端末の確認済みとしてwrite-backしてはいけない。

## 実装・検証locator

- Worker route/renderer: `platform_v2/cloudflare_shadow/src/index.ts`
- fail-closed tests: `platform_v2/cloudflare_shadow/src/syntheticRenriBrowserQa.test.ts`
- staging operator entry: `docs/STAGING_RUNBOOK.md`
