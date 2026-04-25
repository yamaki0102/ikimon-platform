# ikimon Formal Staging Domain Runbook

対象: `staging.ikimon.life`  
目的: `sslip.io` をやめて、FortiGuard 等でブロックされにくい正式 staging URL を運用する。

## 1. 結論

現状の blocker は DNS ではない。

- `staging.ikimon.life` は live 済み
- **2026-04-15 統合**: `/` が platform_v2 に昇格、PHP staging lane は `/legacy/` に降格 (ロールバック用)
- Basic Auth で保護しながら HTTPS で確認できる

nginx 構成と staging 配信経路は、`staging.ikimon.life` 前提でそのまま運用できる。

> 履歴: 2026-04-13 までは `/` = PHP staging, `/v2/` = platform_v2 の 2 スタック構成だった。
> ステージングの主客が不明瞭で「v2 とそうでない方」のメンタル分岐を生んでいたため、2026-04-15 に統合。
> v2 が主、PHP は rollback fallback。本番 (`ikimon.life`) は PHP のまま (本計画では変更しない)。

## 2. あるべき構成

### URL

- Formal staging: `https://staging.ikimon.life/`
- Fallback only: `https://staging.162-43-44-131.sslip.io/`

### 配信

- `/` -> platform_v2 (`127.0.0.1:3200`) … **primary / 主**
- `/legacy/` -> PHP staging lane (`127.0.0.1:8081`) … rollback fallback
- `/v2/` は廃止 (互換を残す場合は nginx で `/` に 301 redirect)

### ガード

- Basic Auth: 維持
- `X-Robots-Tag: noindex, nofollow, noarchive`: 維持

### Basic Auth

- username: `staging`
- password: `uceALmREqM8JAnZHhwhJ`

## 3. 事前条件

### DNS

`staging.ikimon.life` に以下のいずれかを設定する。

- `A` レコード -> `162.43.44.131`
- もしくは `CNAME` -> 既存の正式ホスト

推奨は `A` レコード。

## 4. サーバー側で使う設定ファイル

repo に追加済み:

- `repo_root/ops/deploy/staging_ikimon_life_tls_reference.conf`

この設定は以下を含む。

- `server_name staging.ikimon.life`
- `/.well-known/acme-challenge/`
- `443 ssl http2`
- `/legacy/` proxy -> PHP (rollback lane)
- `/` proxy -> platform_v2 (primary)
- Basic Auth

## 5. 実施手順

### Step 1. DNS 反映確認

```bash
dig +short staging.ikimon.life
```

期待:

- `162.43.44.131` が返る

### Step 2. nginx 設定配置

```bash
sudo cp /var/www/ikimon.life-staging/repo/ops/deploy/staging_ikimon_life_tls_reference.conf /etc/nginx/sites-available/staging.ikimon.life
sudo ln -s /etc/nginx/sites-available/staging.ikimon.life /etc/nginx/sites-enabled/staging.ikimon.life
```

### Step 3. ACME challenge directory

```bash
sudo mkdir -p /var/www/ikimon.life-staging/acme-challenge/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/ikimon.life-staging/acme-challenge
```

### Step 4. 一時的に HTTP vhost だけで nginx test

注意:

- `ssl_certificate` 行があるので、初回は cert 取得前に一時的に 443 server block をコメントアウトするか、certbot の `--nginx` を使う

### Step 5. cert 発行

```bash
sudo certbot --nginx -d staging.ikimon.life
```

期待:

- `/etc/letsencrypt/live/staging.ikimon.life/` ができる

### Step 6. nginx reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7. smoke

```bash
curl -I https://staging.ikimon.life/          # -> platform_v2
curl -I https://staging.ikimon.life/legacy/    # -> PHP rollback lane
```

期待:

- `401 Unauthorized` または認証後 `200`
- `X-Robots-Tag: noindex, nofollow, noarchive`

## 6. 反映後チェック

### Browser

- `https://staging.ikimon.life/` → platform_v2 top
- `https://staging.ikimon.life/legacy/` → PHP staging (rollback / 差分確認)

### Functional

- top (v2 field-note-first)
- /notes (field note main)
- /lens, /scan (supporting tools)
- /map (MapLibre)
- /record, /home, /explore (既存 v2 ルート)
- for-business, learn
- legacy parity: `/legacy/index.php` が 200 を返すこと

## 7. 現在地

完了:

- formal staging 用 vhost reference 作成
- staging manifest の正式 URL 更新
- DNS レコード作成
- cert 発行
- nginx enable / live reload
- `https://staging.ikimon.life/` live (platform_v2)
- `https://staging.ikimon.life/legacy/` live (PHP rollback lane)

未完了:

- warning のない vhost 整理
- staging sync 手順の恒久化

## 8. 最短で詰まる場所

最も詰まりやすいのは DNS 反映だった。

DNS が無い状態では:

- certbot は通らない
- `staging.ikimon.life` は外から見えない

つまり、正式 staging 化の critical path は DNS であり、アプリ実装ではなかった。
