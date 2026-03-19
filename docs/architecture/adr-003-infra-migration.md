# ADR-003: VPS + データベース移行設計

**ステータス**: 承認
**日付**: 2026-03-19
**影響範囲**: インフラ全体

## 背景

現在のお名前ドットコム共有サーバー (RS Plan) では、PostGIS / TimescaleDB / systemd デーモン / 大容量点群処理が不可能。VPS 移行が必要。

## 決定

### VPS: Xserver VPS 12GB プラン

| 項目 | 値 |
|---|---|
| プロバイダ | Xserver VPS |
| プラン | VPS 8GB（メモリ無料増設で12GB） |
| vCPU | 6コア |
| RAM | 12GB |
| NVMe SSD | 400GB |
| OS | Ubuntu 24.04 LTS |
| IPアドレス | 162.43.44.131 |
| ホスト名 | x162-43-44-131.static.xvps.ne.jp |
| 月額 | ¥3,239（12ヶ月契約、キャンペーン適用） |
| 契約期間 | 2026-03-19 〜 2027-03-31 |

### 選定理由

| プロバイダ | プラン | 月額 | RAM | SSD | 判定 |
|---|---|---|---|---|---|
| KAGOYA | 4GB | ¥1,760 | 4GB | 600GB | ❌ RAM不足（PostGIS+TimescaleDB に4GBは厳しい） |
| さくら | 4GB | ¥3,520 | 4GB | 200GB | ❌ バックアップなし、RAM不足 |
| ConoHa | 4GB | ¥3,969 | 4GB | 100GB | ❌ 割高、RAM不足 |
| **Xserver** | **12GB** | **¥3,239** | **12GB** | **400GB** | **✅ 最適。国内シェアNo.1、RAM十分** |

### ターゲットスタック

```
Ubuntu 24.04 LTS
├── Nginx (reverse proxy + static files)
├── PHP 8.2-FPM (API 層、当面継続)
├── PostgreSQL 16
│   ├── PostGIS 3.4 (空間データ)
│   ├── TimescaleDB 2.x (時系列データ)
│   └── pg_trgm (テキスト検索)
├── systemd services
│   ├── ikimon-worker (非同期処理キュー)
│   ├── ikimon-ingest (論文取込デーモン)
│   └── ikimon-ai-queue (AI推論キュー)
├── Certbot (Let's Encrypt SSL)
└── /data/
    ├── point_clouds/ (COPC/LAZ)
    ├── uploads/ (写真)
    └── exports/ (アーカイブ)
```

### セットアップ手順

```bash
# 1. SSH接続
ssh -i ~/.ssh/ikimon.pem root@162.43.44.131

# 2. システム更新
apt update && apt upgrade -y

# 3. 基本パッケージ
apt install -y nginx php8.2-fpm php8.2-pgsql php8.2-curl php8.2-mbstring \
  php8.2-xml php8.2-gd php8.2-sqlite3 php8.2-zip certbot python3-certbot-nginx \
  git curl wget unzip

# 4. PostgreSQL 16 + PostGIS + TimescaleDB
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-16 postgresql-16-postgis-3

# TimescaleDB
apt install -y timescaledb-2-postgresql-16
timescaledb-tune --quiet --yes
systemctl restart postgresql

# 5. DB作成
sudo -u postgres psql <<SQL
CREATE USER ikimon WITH PASSWORD 'secure_password_here';
CREATE DATABASE ikimon_prod OWNER ikimon;
\c ikimon_prod
CREATE EXTENSION postgis;
CREATE EXTENSION timescaledb;
CREATE EXTENSION pg_trgm;
SQL

# 6. Nginx設定
# /etc/nginx/sites-available/ikimon.life を作成
# SSL: certbot --nginx -d ikimon.life -d www.ikimon.life

# 7. PHP-FPM 設定
# /etc/php/8.2/fpm/pool.d/ikimon.conf を作成

# 8. DNS切り替え
# お名前ドットコムで A レコードを 162.43.44.131 に変更

# 9. データ移行
# 旧サーバーから SCP でデータ転送
# JSON → PostgreSQL 移行スクリプト実行
```

### 移行スケジュール

| フェーズ | 内容 | 期間 |
|---|---|---|
| Phase A | VPS セットアップ + Nginx + PHP + PostgreSQL | 1日 |
| Phase B | シャドウ環境構築（本番と並行稼働） | 1週間 |
| Phase C | データ移行 + 動作確認 | 1週間 |
| Phase D | DNS 切り替え + 本番移行 | 1日 |
| Phase E | 旧サーバー停止 | 1ヶ月後 |

### 注意事項

- KAGOYA 固有の実行環境に閉じた設計にしないこと
- IaC または準 IaC (シェルスクリプト) でセットアップを再現可能にする
- restore 手順を文書化する
- 別 VPS / 別クラウドへ移せる構成にする
