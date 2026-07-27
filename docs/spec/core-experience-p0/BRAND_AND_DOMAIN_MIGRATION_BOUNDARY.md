# ZUKAN ブランド・ドメイン移行境界

- 状態: `PLANNING_ONLY / NO_RUNTIME_MUTATION`
- 基準日: 2026-07-28
- service strategy candidate: `ikimon-business-strategy#28`
- implementation baseline: `3c6f3556c5319821601e6f62b971e8b041e1a31c`
- 関連Issue: #1469

## 1. 役割

| 対象 | 役割 | 現時点 |
|---|---|---|
| IKIMON株式会社 | 法人・契約・運営主体 | confirmed |
| IKIMON | 会社brand | confirmed |
| ZUKAN | 公開service name | strategy candidate / source未反映 |
| `zukan.earth` | 将来の正規service domain | owner・DNS・live未確認 |
| `ikimon.life` | current URL・runtime・technical identity | active technical surface |
| `ikimon.co.jp` | 会社公式site | active company surface |
| UTSUROU | superseded service candidate | 新規実装しない |
| この場所のうつろい | Place timeline feature | 維持可能 |

## 2. ブランド変更で変更できるもの

source previewとして、別PRで変更できる。

- public page title・visible logo text
- public service copy
- navigation・helpのservice名
- OG / structured dataのservice display name
- email・notification templateのvisible service name。ただし外部送信は別承認
- screenshot・demo・materialsのservice名
- `ZUKAN（現在はikimon.lifeで提供）`という移行説明

P0がgreenになる前に、brandだけをproductionへ出さない。

## 3. ブランド変更だけでは変更しないもの

- repository名`ikimon-platform`
- project ID、Cloudflare Worker・Queue・D1・R2名
- package名、module path、environment variable名
- API path・version
- DB table・column・migration history
- auth issuer、session key、cookie name
- object ID prefix
- logging・metric name
- internal canonical type名
- existing uploaded media・Record ID
- `ikimon.life`current URL

内部識別子変更は、互換、migration、rollback、observability、costの別Decisionが必要。

## 4. `zukan.earth`read-only inventory

変更前に確認する。

- registrant / owner
- registrar
- payment・renewal・expiry
- management account・MFA・recovery
- nameserver
- DNS records
- DNSSEC
- transfer lock・auth code管理
- Cloudflare zone有無
- certificate・CAA
- existing mail・subdomain・redirect
- trademark・conflicting service

確認できない項目を推測で埋めない。

## 5. domain migration contract

### source readiness

- ZUKAN visible brandがsourceで一貫
- internal IDs非変更
- absolute URLをconfig化
- canonical、OG、sitemap、robots、structured dataをdomain parameter化
- auth callback、cookie、CORS、CSRF originを一覧化
- external links、QR、email、PDF、app linksをinventory化
- runtime identity endpointを維持

### staging readiness

- `zukan.earth`とは別のpreview hostでZUKAN brandを確認
- current `ikimon.life` login・capture・media・Placeを壊さない
- same source artifactのidentity一致
- redirectsをapplyせずtable test
- Android、iPhone、desktop
- search / share preview
- analytics duplicate防止

### production readiness

別の明示承認が必要。

- DNS change plan
- certificate ready
- auth callback登録
- cookie migration
- canonical switch
- `ikimon.life`→`zukan.earth`redirect policy
- exception path・API・asset・OAuth
- monitoring
- rollback TTL・version・route
- announcement・support

## 6. redirect原則

- 301一括適用を最初に行わない。
- auth、API、media、webhook、callback、ops pathをpage redirectと分ける。
- path・query・localeを保持する。
- POSTを無条件redirectしない。
- canonical switchとredirectを別stepで検証する。
- `ikimon.life`を直ちに廃止しない。
- rollback中もRecord・media URLを失効させない。

## 7. data・privacy

- domain変更でpublic visibilityを拡大しない。
- exact coordinate、private media、owner identityを新domainへ自動公開しない。
- current consent・rightsを維持する。
- domain変更を第三者提供同意とみなさない。
- analytics・cookie・privacy policyのdomain変更を確認する。

## 8. official site

`ikimon.co.jp`は会社siteとして維持する。

- IKIMON株式会社がZUKANを開発・運営する説明
- ZUKANへ移動するCTA
- `zukan.earth`live前は`ikimon.life`へlinkする
- live前に`zukan.earth`をcanonical・CTAへ使わない
- AI・Web・FDEは会社能力・別相談として二次導線に置く

## 9. rollback

最低限保持する。

- pre-change DNS values
- pre-change Worker/Page route
- pre-change canonical config
- auth callback old/new
- redirect disable switch
- current `ikimon.life`runtime
- exact source SHA、artifact identity、Worker version
- rollback verification paths

## 10. 承認境界

本書はplanning only。

未承認:

- domain transfer
- DNS / nameserver / DNSSEC
- certificate / route
- auth callback / cookie
- production deploy
- official announcement
- customer・municipality send
- deletion・expiration・cancel
