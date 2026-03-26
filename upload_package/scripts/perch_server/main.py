"""
Perch v2 Audio Classification API — ikimon.life

BirdNET (CC BY-NC-SA) の代替として Perch v2 (Apache 2.0) を使用。
VPS 上で FastAPI サーバーとして動作し、PHP から呼び出される。

Usage:
    pip install perch-hoplite fastapi uvicorn librosa python-multipart
    uvicorn main:app --host 127.0.0.1 --port 8765

Port 8765 は analyze_audio_perch.php から localhost でアクセスされる。
"""

import io
import csv
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import librosa
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("perch_server")

app = FastAPI(title="Perch v2 Audio Classifier", version="1.0.0")

# ── Model Loading ──

_model = None
_labels = None
_jp_names = None


def get_model():
    global _model
    if _model is None:
        logger.info("Loading Perch v2 model...")
        try:
            from perch_hoplite.zoo import model_configs
            _model = model_configs.load_model_by_name('perch_v2')
            logger.info("Perch v2 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Perch v2: {e}")
            raise
    return _model


def get_labels():
    global _labels
    if _labels is None:
        _labels = []
        # perch-hoplite が labels.csv を自動ダウンロードする
        # 見つからない場合は空リストで返す（species は index で返す）
        label_paths = [
            Path(__file__).parent / "labels.csv",
            Path.home() / ".cache" / "perch" / "labels.csv",
        ]
        for p in label_paths:
            if p.exists():
                with open(p) as f:
                    _labels = [row[0] for row in csv.reader(f)]
                logger.info(f"Loaded {len(_labels)} labels from {p}")
                break
        if not _labels:
            logger.warning("labels.csv not found. Species names will be indices.")
    return _labels


def get_japanese_names():
    """日本語名マッピング（あれば）"""
    global _jp_names
    if _jp_names is None:
        _jp_names = {}
        jp_path = Path(__file__).parent / "japanese_names.csv"
        if jp_path.exists():
            with open(jp_path, encoding='utf-8') as f:
                for row in csv.reader(f):
                    if len(row) >= 2:
                        _jp_names[row[0]] = row[1]  # scientific_name → japanese_name
            logger.info(f"Loaded {len(_jp_names)} Japanese names")
    return _jp_names


# ── API Endpoints ──

@app.get("/health")
async def health():
    return {"status": "ok", "model": "perch_v2", "license": "Apache-2.0"}


@app.post("/classify")
async def classify_audio(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(35.0),
    lng: Optional[float] = Form(139.0),
):
    """
    音声ファイルを受け取り、Perch v2 で鳥の種同定を行う。

    - file: 音声ファイル (webm/mp4/wav)
    - lat, lng: GPS座標（将来の地理フィルタリング用）
    """
    try:
        # 1. 音声読み込み（32kHz モノラルに変換）
        audio_bytes = await file.read()
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=32000, mono=True)

        if len(audio) == 0:
            return JSONResponse({"results": [], "error": "Empty audio"})

        # 2. 5秒セグメントに分割
        segment_samples = 5 * 32000  # 160,000 samples
        segments = []
        for i in range(0, len(audio), segment_samples):
            seg = audio[i:i + segment_samples]
            if len(seg) < segment_samples:
                seg = np.pad(seg, (0, segment_samples - len(seg)))
            segments.append(seg.astype(np.float32))

        # 最大3セグメント（15秒分）に制限
        segments = segments[:3]

        # 3. 推論
        model = get_model()
        labels = get_labels()
        jp_names = get_japanese_names()

        results = []
        for idx, seg in enumerate(segments):
            outputs = model.embed(seg)
            logits = outputs.logits.get('label', None)

            if logits is None:
                continue

            # Softmax で確率に変換
            logits_np = np.array(logits).flatten()
            exp_logits = np.exp(logits_np - np.max(logits_np))
            probs = exp_logits / exp_logits.sum()

            # Top 5 取得
            top_indices = np.argsort(probs)[-5:][::-1]
            predictions = []
            for ti in top_indices:
                species = labels[ti] if ti < len(labels) else f"class_{ti}"
                conf = float(probs[ti])
                if conf < 0.01:
                    continue
                predictions.append({
                    "species": species,
                    "common_name": species.replace("_", " ").title(),
                    "japanese_name": jp_names.get(species),
                    "confidence": round(conf, 4),
                })

            results.append({
                "segment": idx,
                "predictions": predictions,
            })

        logger.info(f"Classified {len(segments)} segments, file={file.filename}")
        return JSONResponse({"results": results})

    except Exception as e:
        logger.error(f"Classification error: {e}", exc_info=True)
        return JSONResponse(
            {"results": [], "error": str(e)},
            status_code=500,
        )


# ── Startup ──

@app.on_event("startup")
async def startup_event():
    """サーバー起動時にモデルをプリロード"""
    try:
        get_model()
        get_labels()
        get_japanese_names()
        logger.info("Perch v2 server ready on port 8765")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
