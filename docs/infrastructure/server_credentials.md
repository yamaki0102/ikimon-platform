# ikimon.life サーバー情報（永久記録）

**重要**: このファイルは本番サーバーの接続情報を含む。機密扱い。

---

## 本番 VPS (Xserver VPS)

| 項目 | 値 |
|---|---|
| **プロバイダ** | Xserver VPS |
| **プラン** | VPS 8GB（メモリ無料増設で12GB） |
| **IPアドレス** | `162.43.44.131` |
| **ホスト名** | `x162-43-44-131.static.xvps.ne.jp` |
| **UUID** | `e27eb20a-a319-4e0e-a3b4-2cf6f42b017a` |
| **OS** | Ubuntu 24.04 LTS |
| **vCPU** | 6コア |
| **RAM** | 12GB |
| **NVMe SSD** | 400GB |
| **契約期間** | 2026-03-19 〜 2027-03-31 |
| **収容ホスト** | host02-102 |

## SSH 接続

```bash
ssh -i ~/.ssh/ikimon.pem root@162.43.44.131
```

- **SSH秘密鍵**: `C:\Users\YAMAKI\Downloads\ikimon.pem`（ローカル）
- **SSH Key名**: ikimon
- **ポート**: 22

## インストール済みソフトウェア

| ソフトウェア | バージョン | 状態 |
|---|---|---|
| Ubuntu | 24.04 LTS | カーネル 6.8.0-106 |
| PostgreSQL | 16 | ポート 5432 稼働中 |
| PostGIS | 3.6.2 | 拡張有効 |
| TimescaleDB | 2.x | チューニング済み（shared_buffers 3GB） |
| pg_trgm | 有効 | テキスト検索用 |
| Nginx | 1.24.0 | 稼働中 |
| PHP | 8.2.30 (FPM) | 稼働中 |
| Certbot | インストール済み | SSL 未設定（DNS切り替え後） |

## データベース

| 項目 | 値 |
|---|---|
| **DB名** | `ikimon_prod` |
| **ユーザー** | `ikimon` |
| **パスワード** | `ikimon_prod_2026_xvps` |
| **拡張** | PostGIS, TimescaleDB, pg_trgm |

## ディレクトリ構成

```
/var/www/ikimon.life/
├── public_html/    # Webドキュメントルート (Nginx root)
├── config/         # 設定ファイル
├── libs/           # PHPライブラリ
├── data/           # データストレージ
│   ├── observations/
│   ├── uploads/
│   ├── library/
│   ├── ecosystem_maps/
│   └── passive_sessions/
└── scripts/        # CLIスクリプト
```

## Nginx 設定

- サイト設定: `/etc/nginx/sites-available/ikimon.life`
- PHP-FPM ソケット: `/run/php/php8.2-fpm.sock`
- client_max_body_size: 100M

## 旧サーバー（お名前ドットコム RS Plan）

| 項目 | 値 |
|---|---|
| **SSH** | `ssh -i ~/.ssh/production.pem -p 8022 r1522484@www1070.onamae.ne.jp` |
| **Webルート** | `~/public_html/ikimon.life/public_html/` |
| **PHP** | 8.2 |
| **ストレージ** | JSON ファイル + SQLite |

## 移行チェックリスト

- [x] VPS 契約
- [x] Ubuntu 24.04 セットアップ
- [x] PostgreSQL 16 + PostGIS + TimescaleDB インストール
- [x] Nginx + PHP 8.2-FPM セットアップ
- [x] テストページ動作確認
- [ ] SSL 証明書（Certbot）— DNS 切り替え後
- [ ] ikimon.life コードデプロイ
- [ ] JSON → PostgreSQL データ移行
- [ ] DNS 切り替え（お名前ドットコム A レコード → 162.43.44.131）
- [ ] 旧サーバー停止
