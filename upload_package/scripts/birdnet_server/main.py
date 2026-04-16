"""
BirdNET FastAPI Service — ikimon.life
Port 8100 | analyze_audio.php から呼ばれる

POST /analyze
  - audio: 音声ファイル (webm/mp4/wav/ogg/mp3)
  - lat: float (デフォルト 35.0)
  - lng: float (デフォルト 139.0)
  - min_conf: float (デフォルト 0.10)

Response:
  { "detections": [{scientific_name, common_name, confidence, start_time, end_time}] }

Setup:
    pip install -r requirements.txt
    uvicorn main:app --host 127.0.0.1 --port 8100 --workers 2
"""

import io
import os
import tempfile
import datetime
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("birdnet_server")

app = FastAPI(title="BirdNET Audio Classifier", version="1.0.0")

# ── Model Loading (起動時に1回だけ) ──────────────────────────────────────

_analyzer = None


def get_analyzer():
    global _analyzer
    if _analyzer is None:
        logger.info("Loading BirdNET-Analyzer model...")
        from birdnetlib.analyzer import Analyzer
        _analyzer = Analyzer()
        logger.info("BirdNET-Analyzer ready")
    return _analyzer


# ── Endpoints ────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "BirdNET-Analyzer",
        "port": 8100,
    }


@app.post("/analyze")
async def analyze_audio(
    audio: UploadFile = File(...),
    lat: Optional[float] = Form(35.0),
    lng: Optional[float] = Form(139.0),
    min_conf: Optional[float] = Form(0.10),
):
    """
    音声を受け取り BirdNET で鳥種判定を行う。

    analyze_audio.php が期待するレスポンス形式:
    { "detections": [{scientific_name, common_name, confidence, start_time, end_time}] }
    """
    min_conf = max(0.01, min(0.99, min_conf or 0.10))
    lat = lat or 35.0
    lng = lng or 139.0

    audio_bytes = await audio.read()
    if not audio_bytes:
        return JSONResponse({"detections": [], "error": "Empty audio"}, status_code=400)

    # 拡張子を推定（ffmpeg の変換に必要）
    filename = audio.filename or "snippet.webm"
    suffix = Path(filename).suffix or ".webm"

    # 一時ファイルに書き出してから birdnetlib に渡す
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        from birdnetlib import Recording

        analyzer = get_analyzer()
        recording = Recording(
            analyzer,
            tmp_path,
            lat=lat,
            lon=lng,
            date=datetime.date.today(),
            min_conf=min_conf,
        )
        recording.analyze()

        detections = []
        for det in recording.detections:
            detections.append({
                "scientific_name": det.get("scientific_name", ""),
                "common_name":     det.get("common_name", ""),
                "confidence":      round(float(det.get("confidence", 0)), 4),
                "start_time":      det.get("start_time", 0.0),
                "end_time":        det.get("end_time", 3.0),
            })

        logger.info(
            "analyzed file=%s lat=%.4f lng=%.4f min_conf=%.2f detections=%d",
            filename, lat, lng, min_conf, len(detections),
        )
        return JSONResponse({"detections": detections})

    except Exception as e:
        logger.error("analyze error: %s", e, exc_info=True)
        return JSONResponse(
            {"detections": [], "error": str(e)},
            status_code=500,
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Startup ──────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    try:
        get_analyzer()
        logger.info("BirdNET server ready on port 8100")
    except Exception as e:
        logger.error("Startup failed: %s", e)
