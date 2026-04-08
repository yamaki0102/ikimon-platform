#!/usr/bin/env python3
"""
audio_batch_worker.py — ikimon.life デュアルエンジン音声バッチワーカー

BirdNET v2.4 + Perch V2 を同一音声ファイルで横並び評価。
リアルタイム推論（analyze_audio_perch.php）を補完する高品質バッチ層。

フロー:
  1. QUEUE_DIR からジョブJSONを取得
  2. BirdNET v2.4 で全セグメント推論（タイムアウト制約なし）
  3. Perch V2 で同一音声を推論（localhost:8765 経由）
  4. Fusion Engine でマージ → Evidence Tier 判定
  5. 結果をJSONに書き出し → PHP経由でCanonicalStoreに反映

使い方:
  # 手動実行（テスト）
  python3 scripts/audio_batch_worker.py

  # cronで5分毎に実行（crontab -e）
  */5 * * * * /opt/ikimon-ai/venv/bin/python3 /var/www/ikimon.life/repo/upload_package/scripts/audio_batch_worker.py >> /var/log/ikimon-audio-batch.log 2>&1

BirdNET v2.4 の強み（リアルタイムで使えなかった機能）:
  - ProtoBuf CPU/GPU 実行（GPUあれば自動で高速化）
  - 複数GPU対応（将来のスケール）
  - カスタムモデル対応（日本固有種ファインチューニング）
  - 各種出力形式（ProtoBuf/CSV/JSON/DwC-A）
  - Perch V2 も同一パイプラインで処理可能
"""

import os
import io
import json
import time
import glob
import fcntl
import hashlib
import logging
import tempfile
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

# ── ロギング ──

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("audio_batch_worker")

# ── 設定 ──

BASE_DIR = Path(__file__).parent.parent  # upload_package/

QUEUE_DIR   = BASE_DIR / "data" / "audio_queue"
RESULTS_DIR = BASE_DIR / "data" / "audio_results"
PROC_DIR    = BASE_DIR / "data" / "audio_processing"   # 処理中（重複実行防止）

# 推論サービス（既存 FastAPI）
BIRDNET_URL = "http://127.0.0.1:8100/analyze"
PERCH_URL   = "http://127.0.0.1:8765/classify"

# PHP コールバック（CanonicalStore 更新）
CALLBACK_URL = "http://127.0.0.1/api/v2/audio_batch_callback.php"

# 閾値
MIN_CONF_RAW       = 0.10   # 各エンジンの生フィルタ（boost後に判断）
MIN_CONF_FINAL     = 0.30   # 最終出力フィルタ
DUAL_AGREE_BONUS   = 0.10   # 両エンジン合意時のボーナス
TIER_AUTO_PROMOTE  = 0.80   # Evidence Tier 1.5 自動昇格の閾値（dual_agreeのみ）

# 処理上限
MAX_JOBS_PER_RUN = 50
JOB_TIMEOUT_SEC  = 120     # 1ジョブの処理タイムアウト

for d in [QUEUE_DIR, RESULTS_DIR, PROC_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# ────────────────────────────────────────────────────────
# メイン
# ────────────────────────────────────────────────────────

def main():
    jobs = sorted(QUEUE_DIR.glob("*.json"))
    if not jobs:
        logger.info("キューにジョブなし。終了。")
        return

    logger.info(f"{len(jobs)} ジョブを検出。最大 {MAX_JOBS_PER_RUN} 件を処理。")
    processed = failed = skipped = 0

    for job_path in jobs[:MAX_JOBS_PER_RUN]:
        result = process_job(job_path)
        if result == "ok":
            processed += 1
        elif result == "skip":
            skipped += 1
        else:
            failed += 1

    logger.info(f"完了: 処理={processed} スキップ={skipped} 失敗={failed}")


# ────────────────────────────────────────────────────────
# ジョブ処理
# ────────────────────────────────────────────────────────

def process_job(job_path: Path) -> str:
    """1つのジョブを処理する。戻り値: 'ok' | 'skip' | 'error'"""
    job_id = job_path.stem

    # 処理中ロックファイル（重複実行防止）
    lock_path = PROC_DIR / f"{job_id}.lock"
    if lock_path.exists():
        logger.info(f"[{job_id}] 他プロセスが処理中 → スキップ")
        return "skip"

    # 結果が既にある場合はスキップ
    result_path = RESULTS_DIR / f"{job_id}.json"
    if result_path.exists():
        logger.info(f"[{job_id}] 結果ファイル存在 → スキップ（コールバック再試行）")
        _notify_callback(job_id, result_path)
        return "skip"

    try:
        lock_path.touch()

        with open(job_path) as f:
            job = json.load(f)

        audio_path = Path(job.get("audio_path", ""))
        if not audio_path.exists():
            logger.warning(f"[{job_id}] 音声ファイルが見つからない: {audio_path}")
            _mark_error(job_path, result_path, "audio_file_not_found")
            return "error"

        logger.info(f"[{job_id}] 処理開始: {audio_path.name} ({audio_path.stat().st_size // 1024}KB)")

        # BirdNET 推論
        birdnet_dets = _run_birdnet(audio_path, job.get("lat", 35.0), job.get("lng", 139.0))
        logger.info(f"[{job_id}] BirdNET: {len(birdnet_dets)} 検出")

        # Perch V2 推論
        perch_dets = _run_perch(audio_path, job.get("lat", 35.0), job.get("lng", 139.0))
        logger.info(f"[{job_id}] Perch V2: {len(perch_dets)} 検出")

        # Fusion Engine
        merged = _fusion_engine(birdnet_dets, perch_dets)
        logger.info(f"[{job_id}] Fusion: {len(merged)} 種（dual_agree={sum(1 for d in merged if d['engine']=='dual_agree')}）")

        # 結果を保存
        result = {
            "job_id":       job_id,
            "session_id":   job.get("session_id"),
            "user_id":      job.get("user_id"),
            "audio_path":   str(audio_path),
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "engines_used": _engines_used(birdnet_dets, perch_dets),
            "birdnet_count": len(birdnet_dets),
            "perch_count":   len(perch_dets),
            "detections":    merged,
            "tier_promotions": [d for d in merged if d.get("tier_1_5_eligible")],
            "status":        "ok",
        }

        with open(result_path, "w") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        logger.info(f"[{job_id}] 結果保存: {result_path}")

        # PHPコールバック（CanonicalStore更新）
        _notify_callback(job_id, result_path)

        # ジョブファイルをアーカイブ
        archive_dir = QUEUE_DIR / "done"
        archive_dir.mkdir(exist_ok=True)
        job_path.rename(archive_dir / job_path.name)

        return "ok"

    except Exception as e:
        logger.error(f"[{job_id}] エラー: {e}", exc_info=True)
        _mark_error(job_path, result_path, str(e))
        return "error"

    finally:
        lock_path.unlink(missing_ok=True)


# ────────────────────────────────────────────────────────
# BirdNET 推論（既存 FastAPI サービス、タイムアウトなし）
# ────────────────────────────────────────────────────────

def _run_birdnet(audio_path: Path, lat: float, lng: float) -> list:
    """
    BirdNET-Analyzer FastAPI (localhost:8100) に音声を送信。
    リアルタイムと同じサービスだがタイムアウトを120秒まで延長。
    全セグメントを処理（リアルタイムは5秒で打ち切り）。
    """
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        boundary = "----BatchBoundary"
        body = _build_multipart(boundary, {
            "audio": (audio_path.name, audio_bytes, "audio/webm"),
            "lat":   (None, str(lat).encode(), None),
            "lng":   (None, str(lng).encode(), None),
            "min_conf": (None, b"0.10", None),  # バッチは低めの閾値（Fusion後に判断）
        })

        req = urllib.request.Request(
            BIRDNET_URL,
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=JOB_TIMEOUT_SEC) as resp:
            data = json.loads(resp.read())

        raw = data.get("detections", data.get("results", []))
        return [
            {
                "scientific_name": d.get("scientific_name", d.get("species", "")),
                "common_name":     d.get("common_name", ""),
                "confidence":      round(float(d.get("confidence", 0)), 4),
                "engine":          "birdnet_v2.4",
                "start_time":      d.get("start_time"),
                "end_time":        d.get("end_time"),
            }
            for d in raw
            if float(d.get("confidence", 0)) >= MIN_CONF_RAW
        ]

    except Exception as e:
        logger.warning(f"BirdNET 失敗: {e}")
        return []


# ────────────────────────────────────────────────────────
# Perch V2 推論（既存 FastAPI サービス、タイムアウトなし）
# ────────────────────────────────────────────────────────

def _run_perch(audio_path: Path, lat: float, lng: float) -> list:
    """
    Perch V2 FastAPI (localhost:8765) に音声を送信。
    全セグメントを処理。
    """
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        boundary = "----PerchBoundary"
        body = _build_multipart(boundary, {
            "file": (audio_path.name, audio_bytes, "audio/webm"),
            "lat":  (None, str(lat).encode(), None),
            "lng":  (None, str(lng).encode(), None),
        })

        req = urllib.request.Request(
            PERCH_URL,
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=JOB_TIMEOUT_SEC) as resp:
            data = json.loads(resp.read())

        detections = []
        for segment in data.get("results", []):
            for pred in segment.get("predictions", []):
                conf = float(pred.get("confidence", 0))
                if conf < MIN_CONF_RAW:
                    continue
                detections.append({
                    "scientific_name": pred.get("species", ""),
                    "common_name":     pred.get("common_name", ""),
                    "japanese_name":   pred.get("japanese_name"),
                    "confidence":      round(conf, 4),
                    "engine":          "perch_v2",
                })
        return detections

    except Exception as e:
        logger.warning(f"Perch V2 失敗: {e}")
        return []


# ────────────────────────────────────────────────────────
# Fusion Engine
# ────────────────────────────────────────────────────────

def _fusion_engine(birdnet: list, perch: list) -> list:
    """
    BirdNET + Perch V2 の結果をマージ。

    ルール（analyze_audio_perch.php の PHP版と同じロジック、バッチ版に拡張）:
      - 両者合意 → max(confidence) + DUAL_AGREE_BONUS, engine='dual_agree'
      - 両者合意 + fused >= TIER_AUTO_PROMOTE → tier_1_5_eligible = True
      - 片方のみ → confidence * 0.9（単独エンジンは信頼度を少し下げる）
      - 最終フィルタ: MIN_CONF_FINAL
    """

    def by_sci(dets: list) -> dict:
        index = {}
        for d in dets:
            key = d["scientific_name"].lower().strip()
            if not key:
                continue
            if key not in index or d["confidence"] > index[key]["confidence"]:
                index[key] = d
        return index

    birdnet_idx = by_sci(birdnet)
    perch_idx   = by_sci(perch)
    all_keys    = set(birdnet_idx) | set(perch_idx)

    merged = []
    for key in all_keys:
        in_birdnet = key in birdnet_idx
        in_perch   = key in perch_idx

        if in_birdnet and in_perch:
            b = birdnet_idx[key]
            p = perch_idx[key]
            base      = b if b["confidence"] >= p["confidence"] else p
            fused_raw = max(b["confidence"], p["confidence"]) + DUAL_AGREE_BONUS
            fused     = round(min(fused_raw, 0.99), 4)

            merged.append({
                "scientific_name":   base["scientific_name"],
                "common_name":       base.get("common_name", ""),
                "japanese_name":     p.get("japanese_name") or b.get("japanese_name"),
                "confidence":        fused,
                "engine":            "dual_agree",
                "engines": [
                    {"engine": "birdnet_v2.4", "confidence": b["confidence"]},
                    {"engine": "perch_v2",     "confidence": p["confidence"]},
                ],
                "tier_1_5_eligible": fused >= TIER_AUTO_PROMOTE,
                "batch_evaluated":   True,
            })

        elif in_birdnet:
            b = birdnet_idx[key]
            merged.append({
                "scientific_name": b["scientific_name"],
                "common_name":     b.get("common_name", ""),
                "japanese_name":   b.get("japanese_name"),
                "confidence":      round(b["confidence"] * 0.9, 4),  # 単独エンジン割引
                "engine":          "birdnet_v2.4",
                "engines":         [{"engine": "birdnet_v2.4", "confidence": b["confidence"]}],
                "tier_1_5_eligible": False,
                "batch_evaluated": True,
            })

        else:
            p = perch_idx[key]
            merged.append({
                "scientific_name": p["scientific_name"],
                "common_name":     p.get("common_name", ""),
                "japanese_name":   p.get("japanese_name"),
                "confidence":      round(p["confidence"] * 0.9, 4),  # 単独エンジン割引
                "engine":          "perch_v2",
                "engines":         [{"engine": "perch_v2", "confidence": p["confidence"]}],
                "tier_1_5_eligible": False,
                "batch_evaluated": True,
            })

    # 最終フィルタ & ソート
    merged = [d for d in merged if d["confidence"] >= MIN_CONF_FINAL]
    merged.sort(key=lambda d: d["confidence"], reverse=True)
    return merged


def _engines_used(birdnet: list, perch: list) -> list:
    used = []
    if birdnet:
        used.append("birdnet_v2.4")
    if perch:
        used.append("perch_v2")
    return used or ["none"]


# ────────────────────────────────────────────────────────
# PHP コールバック（CanonicalStore 更新依頼）
# ────────────────────────────────────────────────────────

def _notify_callback(job_id: str, result_path: Path):
    """
    PHP の audio_batch_callback.php に通知。
    CanonicalStore の Evidence Tier 更新と散歩レポートへの反映を行う。
    """
    try:
        payload = json.dumps({
            "job_id":      job_id,
            "result_path": str(result_path),
        }).encode()
        req = urllib.request.Request(
            CALLBACK_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode()
            data = json.loads(body)
            if data.get("success"):
                logger.info(f"[{job_id}] コールバック成功")
            else:
                logger.warning(f"[{job_id}] コールバック失敗: {data.get('error', body[:100])}")
    except Exception as e:
        logger.warning(f"[{job_id}] コールバックエラー: {e}")


def _mark_error(job_path: Path, result_path: Path, error: str):
    with open(result_path, "w") as f:
        json.dump({
            "status": "error",
            "error":  error,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }, f)
    # エラーキューへ移動
    err_dir = QUEUE_DIR / "errors"
    err_dir.mkdir(exist_ok=True)
    try:
        job_path.rename(err_dir / job_path.name)
    except Exception:
        pass


# ────────────────────────────────────────────────────────
# マルチパートヘルパー（標準ライブラリのみ）
# ────────────────────────────────────────────────────────

def _build_multipart(boundary: str, fields: dict) -> bytes:
    """
    fields: {name: (filename, data, content_type)}
      filename=None → テキストフィールド
    """
    parts = []
    for name, (filename, data, ctype) in fields.items():
        if filename is None:
            # テキストフィールド
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"\r\n'
                f"\r\n"
            )
            parts.append(data if isinstance(data, bytes) else data.encode())
            parts.append(b"\r\n")
        else:
            # ファイルフィールド
            parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                f"Content-Type: {ctype}\r\n"
                f"\r\n"
            )
            parts.append(data if isinstance(data, bytes) else data.encode())
            parts.append(b"\r\n")

    parts.append(f"--{boundary}--\r\n")

    result = b""
    for p in parts:
        result += p if isinstance(p, bytes) else p.encode()
    return result


if __name__ == "__main__":
    main()
