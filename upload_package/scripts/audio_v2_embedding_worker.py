#!/usr/bin/env python3
"""
audio_v2_embedding_worker.py — platform_v2 用 Perch embedding 取得ワーカー

platform_v2 (Fastify + PostgreSQL) の audio_segments を polling し、
privacy_status='clean' かつ embedding 未取得のセグメントについて
Perch v2 で 1280 次元 embedding を抽出 → v2 callback (/api/v1/fieldscan/audio/callback)
へ POST して audio_embeddings テーブルに格納させる。

既存 audio_batch_worker.py (legacy v1 lane) とは独立に動作する。
v1 lane の同定処理には影響しない。

フロー:
  1. PostgreSQL からまだ embedding がないクリーン segment を取得
  2. private_uploads/<storage_path> から音声ファイルを読込
  3. Perch v2 (localhost:8765) に include_embedding=true で問い合わせ
  4. v2 callback に detections + embeddings を POST (x-ikimon-write-key 認証)

cron 設定例 (5 分毎):
  */5 * * * * /opt/ikimon-ai/venv/bin/python3 /var/www/.../upload_package/scripts/audio_v2_embedding_worker.py >> /var/log/ikimon-audio-v2-embedding.log 2>&1
"""

import io
import os
import json
import logging
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Optional

import psycopg2
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("audio_v2_embedding_worker")

PERCH_URL = os.environ.get("PERCH_URL", "http://127.0.0.1:8765/classify")
V2_CALLBACK_URL = os.environ.get(
    "V2_CALLBACK_URL", "http://127.0.0.1:3200/api/v1/fieldscan/audio/callback"
)
V2_PRIVILEGED_WRITE_API_KEY = os.environ.get("V2_PRIVILEGED_WRITE_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
PRIVATE_UPLOADS_ROOT = Path(
    os.environ.get("PRIVATE_UPLOADS_ROOT", "/var/www/ikimon.life/private_uploads")
)

MAX_SEGMENTS_PER_RUN = int(os.environ.get("V2_EMBED_MAX_PER_RUN", "20"))
PERCH_TIMEOUT_SEC = int(os.environ.get("PERCH_TIMEOUT_SEC", "120"))
CALLBACK_TIMEOUT_SEC = int(os.environ.get("CALLBACK_TIMEOUT_SEC", "30"))


def fetch_pending_segments(conn) -> list:
    """privacy_status='clean' かつ audio_embeddings に行がない segment を取り出す。"""
    sql = """
        select s.segment_id::text,
               s.storage_path,
               s.storage_provider,
               s.mime_type,
               s.lat,
               s.lng,
               s.duration_sec
          from audio_segments s
          left join audio_embeddings e
            on e.segment_id = s.segment_id and e.model_name = 'perch_v2'
         where s.privacy_status = 'clean'
           and s.storage_path is not null
           and s.storage_path <> ''
           and e.embedding_id is null
         order by s.created_at asc
         limit %s
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (MAX_SEGMENTS_PER_RUN,))
        return list(cur.fetchall())


def resolve_audio_path(storage_path: str, storage_provider: str) -> Optional[Path]:
    if storage_provider != "private_audio_fs":
        logger.info(f"skip non-local segment storage: {storage_provider}")
        return None
    candidate = (PRIVATE_UPLOADS_ROOT / storage_path).resolve()
    root = PRIVATE_UPLOADS_ROOT.resolve()
    if not str(candidate).startswith(str(root) + os.sep):
        logger.warning(f"path escape attempt: {storage_path}")
        return None
    if not candidate.exists():
        logger.warning(f"audio file missing: {candidate}")
        return None
    return candidate


def call_perch(audio_path: Path, lat: Optional[float], lng: Optional[float]) -> dict:
    """Perch v2 に音声を送って予測 + embedding を取得する。"""
    boundary = "----V2EmbedBoundary"
    audio_bytes = audio_path.read_bytes()

    fields = {
        "file": (audio_path.name, audio_bytes, "audio/webm"),
        "lat": (None, str(lat if lat is not None else 35.0).encode(), None),
        "lng": (None, str(lng if lng is not None else 139.0).encode(), None),
        "include_embedding": (None, b"true", None),
    }

    parts: list = []
    for name, (filename, data, ctype) in fields.items():
        if filename is None:
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            )
            parts.append(data if isinstance(data, bytes) else data.encode())
            parts.append(b"\r\n")
        else:
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ctype}\r\n\r\n"
            )
            parts.append(data if isinstance(data, bytes) else data.encode())
            parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n")
    body = b"".join(p if isinstance(p, bytes) else p.encode() for p in parts)

    req = urllib.request.Request(
        PERCH_URL,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=PERCH_TIMEOUT_SEC) as resp:
        return json.loads(resp.read())


def build_callback_payload(segment_id: str, perch_result: dict) -> dict:
    """Perch のレスポンスを v2 callback の入力形式に整形。"""
    detections = []
    embeddings = []
    for segment in perch_result.get("results", []):
        # 各セグメントの top-1 を detection として送る (top-5 全部送ると重複が多い)
        for pred in segment.get("predictions", [])[:1]:
            detections.append({
                "detectedTaxon": pred.get("japanese_name") or pred.get("species") or "unknown",
                "scientificName": pred.get("species") or None,
                "confidence": pred.get("confidence", 0.0),
                "provider": "perch_v2",
                "offsetSec": segment.get("segment", 0) * 5.0,
                "durationSec": 5.0,
                "rawScore": {"common_name": pred.get("common_name")},
            })
        emb = segment.get("embedding")
        if emb:
            embeddings.append({
                "modelName": emb.get("model_name", "perch_v2"),
                "modelVersion": emb.get("model_version", "v2"),
                "frameOffsetSec": emb.get("frame_offset_sec", 0.0),
                "frameDurationSec": emb.get("frame_duration_sec", 5.0),
                "vector": emb.get("vector", []),
            })
    return {
        "segmentId": segment_id,
        "detections": detections,
        "embeddings": embeddings,
        "embeddingModelName": "perch_v2",
        "embeddingModelVersion": "v2",
    }


def post_v2_callback(payload: dict) -> dict:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        V2_CALLBACK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-ikimon-write-key": V2_PRIVILEGED_WRITE_API_KEY,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=CALLBACK_TIMEOUT_SEC) as resp:
        return json.loads(resp.read())


def process_segment(conn, segment: dict) -> str:
    seg_id = segment["segment_id"]
    audio_path = resolve_audio_path(segment["storage_path"], segment["storage_provider"])
    if audio_path is None:
        return "skip_no_file"

    try:
        perch_result = call_perch(audio_path, segment.get("lat"), segment.get("lng"))
    except Exception as e:
        logger.warning(f"[{seg_id}] perch failed: {e}")
        return "skip_perch_failed"

    payload = build_callback_payload(seg_id, perch_result)
    if not payload["embeddings"]:
        # embedding 抽出に失敗。空 detections でも v2 は処理するが、
        # detections も空ならスキップ。
        if not payload["detections"]:
            return "skip_empty"
        # detection だけ送る (legacy 互換)。
        logger.info(f"[{seg_id}] no embedding extracted; sending detections only")

    try:
        result = post_v2_callback(payload)
    except Exception as e:
        logger.warning(f"[{seg_id}] callback failed: {e}")
        return "skip_callback_failed"

    if not result.get("ok"):
        logger.warning(f"[{seg_id}] callback returned not-ok: {result}")
        return "skip_callback_rejected"

    logger.info(
        f"[{seg_id}] inserted={result.get('inserted')} "
        f"embeddings={result.get('embeddingsInserted')}"
    )
    return "ok"


def main():
    if not DATABASE_URL:
        raise SystemExit("DATABASE_URL is required")
    if not V2_PRIVILEGED_WRITE_API_KEY:
        raise SystemExit("V2_PRIVILEGED_WRITE_API_KEY is required")

    conn = psycopg2.connect(DATABASE_URL)
    try:
        segments = fetch_pending_segments(conn)
        if not segments:
            logger.info("no pending v2 segments")
            return

        logger.info(f"processing {len(segments)} segments")
        counts = {"ok": 0, "skip_no_file": 0, "skip_perch_failed": 0,
                  "skip_callback_failed": 0, "skip_callback_rejected": 0,
                  "skip_empty": 0}
        for seg in segments:
            outcome = process_segment(conn, seg)
            counts[outcome] = counts.get(outcome, 0) + 1
        logger.info(f"summary: {counts}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
