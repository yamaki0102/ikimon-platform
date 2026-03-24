#!/bin/bash
# Perch v2 サーバーデプロイスクリプト
# Usage: ssh root@162.43.44.131 'bash -s' < deploy.sh

set -e

PERCH_DIR="/var/www/ikimon.life/repo/upload_package/scripts/perch_server"
SERVICE_NAME="perch-v2"

echo "=== Perch v2 デプロイ開始 ==="

# 1. Python venv セットアップ
cd "$PERCH_DIR"
if [ ! -d "venv" ]; then
    echo "→ Python venv 作成中..."
    python3 -m venv venv
fi

echo "→ 依存パッケージインストール..."
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

# 2. systemd サービス作成
echo "→ systemd サービス設定..."
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Perch v2 Audio Classifier (ikimon.life)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PERCH_DIR}
ExecStart=${PERCH_DIR}/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765
Restart=always
RestartSec=10
Environment=TF_CPP_MIN_LOG_LEVEL=2

[Install]
WantedBy=multi-user.target
EOF

# 3. サービス起動
echo "→ サービス再起動..."
systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# 4. ヘルスチェック（起動に数十秒かかるので30秒待つ）
echo "→ モデルロード中（最大60秒待機）..."
for i in $(seq 1 12); do
    sleep 5
    if curl -s http://127.0.0.1:8765/health | grep -q '"status":"ok"'; then
        echo "✅ Perch v2 サーバー起動完了!"
        curl -s http://127.0.0.1:8765/health
        echo ""
        exit 0
    fi
    echo "   ...待機中 ($((i*5))秒)"
done

echo "⚠️ タイムアウト。ログを確認:"
journalctl -u ${SERVICE_NAME} --no-pager -n 20
exit 1
