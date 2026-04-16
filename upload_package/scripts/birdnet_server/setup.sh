#!/bin/bash
# BirdNET FastAPI サービス セットアップスクリプト
# Xserver VPS (Ubuntu 24.04) 用
# Usage: sudo bash setup.sh
set -euo pipefail

SERVICE_DIR=/opt/ikimon/birdnet_server
SERVICE_FILE=/etc/systemd/system/birdnet.service

echo "=== BirdNET FastAPI Setup ==="

# 依存パッケージ
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv ffmpeg

# サービスディレクトリ作成
mkdir -p "$SERVICE_DIR"
cp main.py requirements.txt "$SERVICE_DIR/"

# virtualenv
python3 -m venv "$SERVICE_DIR/venv"
"$SERVICE_DIR/venv/bin/pip" install --upgrade pip
"$SERVICE_DIR/venv/bin/pip" install -r "$SERVICE_DIR/requirements.txt"

# BirdNET モデルを事前ダウンロード（初回起動を速くするため）
echo "Downloading BirdNET model (初回のみ・約200MB)..."
"$SERVICE_DIR/venv/bin/python" -c "
from birdnetlib.analyzer import Analyzer
a = Analyzer()
print('Model ready:', type(a))
"

# systemd サービス登録
cp birdnet.service "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable birdnet
systemctl start birdnet

# 動作確認
sleep 3
if curl -sf http://127.0.0.1:8100/health > /dev/null; then
    echo "✅ BirdNET service is running on port 8100"
else
    echo "❌ Service failed to start. Check: journalctl -u birdnet -n 50"
    exit 1
fi

echo "=== Done ==="
echo "管理コマンド:"
echo "  systemctl status birdnet"
echo "  journalctl -u birdnet -f"
echo "  systemctl restart birdnet"
