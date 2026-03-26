#!/bin/bash
# ============================================================
# BirdNET-Analyzer VPS セットアップスクリプト
# ============================================================
# 対象: Xserver VPS (Ubuntu 24.04, 12GB RAM)
# 実行: ssh root@162.43.44.131 'bash -s' < scripts/setup_birdnet_vps.sh
#
# 前提:
#   - Python 3.10+ がインストール済み
#   - ffmpeg がインストール済み（なければこのスクリプトでインストール）
#   - ポート 8100 は localhost のみ（外部公開しない）
# ============================================================

set -euo pipefail

INSTALL_DIR="/opt/ikimon-ai"
VENV_DIR="${INSTALL_DIR}/venv"
SERVICE_NAME="ikimon-ai"

echo "=== ikimon.life BirdNET AI Service Setup ==="

# --- 1. 依存パッケージ ---
echo "[1/6] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip ffmpeg libsndfile1 > /dev/null

# --- 2. ディレクトリ作成 ---
echo "[2/6] Creating ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# --- 3. Python venv ---
echo "[3/6] Creating Python virtual environment..."
python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"

# --- 4. パッケージインストール ---
echo "[4/6] Installing Python packages..."
pip install --upgrade pip -q
pip install fastapi uvicorn[standard] birdnetlib python-multipart librosa tensorflow-cpu -q

# --- 5. FastAPI アプリ作成 ---
echo "[5/6] Writing app.py..."
cat > "${INSTALL_DIR}/app.py" << 'PYEOF'
"""
ikimon.life AI Detection Service — BirdNET-Analyzer via FastAPI

- モデルは起動時に1回だけロード（常駐）
- /analyze: 音声ファイル → 鳥種判定
- /health: ヘルスチェック
- localhost:8100 のみリッスン（Nginx経由でアクセスしない）
"""

import os
import tempfile
import subprocess
from fastapi import FastAPI, UploadFile, Form, HTTPException
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer

app = FastAPI(title="ikimon.life AI Detection Service")

# モデル常駐（起動時に1回ロード、~500MB RAM）
print("Loading BirdNET-Analyzer model...")
analyzer = Analyzer()
print("Model loaded successfully.")


@app.post("/analyze")
async def analyze_audio(
    audio: UploadFile,
    lat: float = Form(35.0),
    lng: float = Form(139.0),
    min_conf: float = Form(0.25),
):
    """
    音声ファイルを受け取り、BirdNET で鳥種判定を行う。

    - 入力: webm/mp4/wav/ogg 等（ffmpeg がデコード可能な形式）
    - 出力: detections リスト（scientific_name, common_name, confidence, start_time, end_time）
    """
    # 入力を一時ファイルに保存
    suffix = os.path.splitext(audio.filename or "snippet.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as input_tmp:
        content = await audio.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")
        if len(content) > 5 * 1024 * 1024:  # 5MB上限
            raise HTTPException(status_code=413, detail="Audio file too large (max 5MB)")
        input_tmp.write(content)
        input_path = input_tmp.name

    # wav に変換（BirdNET は 48kHz mono wav を要求）
    wav_path = input_path.rsplit(".", 1)[0] + ".wav"
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", input_path,
                "-ar", "48000",
                "-ac", "1",
                "-f", "wav",
                wav_path,
            ],
            capture_output=True,
            timeout=10,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"Audio conversion failed: {result.stderr.decode()[:200]}",
            )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=422, detail="Audio conversion timed out")
    finally:
        _safe_unlink(input_path)

    # BirdNET 推論
    try:
        recording = Recording(
            analyzer,
            wav_path,
            lat=lat,
            lon=lng,
            min_conf=min_conf,
        )
        recording.analyze()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)[:200]}")
    finally:
        _safe_unlink(wav_path)

    return {
        "detections": [
            {
                "scientific_name": d["scientific_name"],
                "common_name": d["common_name"],
                "confidence": round(d["confidence"], 3),
                "start_time": d["start_time"],
                "end_time": d["end_time"],
            }
            for d in recording.detections
        ]
    }


@app.get("/health")
def health():
    """ヘルスチェック"""
    return {
        "status": "ok",
        "model": "BirdNET-Analyzer",
        "species_count": 6522,
    }


def _safe_unlink(path: str):
    """ファイルを安全に削除"""
    try:
        os.unlink(path)
    except OSError:
        pass
PYEOF

# --- 6. systemd サービス ---
echo "[6/6] Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=ikimon.life AI Detection Service (BirdNET)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${INSTALL_DIR}
ExecStart=${VENV_DIR}/bin/uvicorn app:app --host 127.0.0.1 --port 8100 --workers 2
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

# リソース制限
MemoryMax=2G
CPUQuota=80%

[Install]
WantedBy=multi-user.target
EOF

# パーミッション
chown -R www-data:www-data "${INSTALL_DIR}"

# サービス有効化 & 起動
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl start "${SERVICE_NAME}"

echo ""
echo "=== Setup Complete ==="
echo "Service: systemctl status ${SERVICE_NAME}"
echo "Logs:    journalctl -u ${SERVICE_NAME} -f"
echo "Test:    curl http://127.0.0.1:8100/health"
echo ""

# ヘルスチェック（起動待ち）
echo "Waiting for service to start..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8100/health > /dev/null 2>&1; then
        echo "Service is running!"
        curl -s http://127.0.0.1:8100/health | python3 -m json.tool
        exit 0
    fi
    sleep 2
done

echo "WARNING: Service did not start within 60 seconds."
echo "Check logs: journalctl -u ${SERVICE_NAME} -n 50"
exit 1
