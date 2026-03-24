# Perch v2 Audio Classification Server

BirdNET (CC BY-NC-SA 4.0) の代替。Google Perch v2 (Apache 2.0) を使用。

## セットアップ（VPS上）

```bash
cd /var/www/ikimon.life/repo/upload_package/scripts/perch_server

# Python venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 起動（バックグラウンド）
nohup uvicorn main:app --host 127.0.0.1 --port 8765 > perch.log 2>&1 &

# ヘルスチェック
curl http://127.0.0.1:8765/health
```

## systemd サービス化

```ini
# /etc/systemd/system/perch-v2.service
[Unit]
Description=Perch v2 Audio Classifier
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ikimon.life/repo/upload_package/scripts/perch_server
ExecStart=/var/www/ikimon.life/repo/upload_package/scripts/perch_server/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## テスト

```bash
curl -X POST http://127.0.0.1:8765/classify \
  -F "file=@test_audio.wav" \
  -F "lat=34.71" \
  -F "lng=137.73"
```

## 日本語名マッピング

`japanese_names.csv` を配置すると、レスポンスに `japanese_name` が含まれる:
```csv
Parus_minor,シジュウカラ
Zosterops_japonicus,メジロ
Horornis_diphone,ウグイス
```

## ライセンス

- Perch v2: Apache 2.0 (Google DeepMind)
- このサーバーコード: ikimon.life プロジェクト
