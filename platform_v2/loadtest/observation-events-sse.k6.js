/**
 * k6 負荷スクリプト: 観察会 SSE 接続を 5000 同時に張り、平均接続維持時間と切断率を測る。
 *
 * 実行例:
 *   k6 run -e BASE_URL=https://staging.ikimon.life -e SESSION_ID=<uuid> loadtest/observation-events-sse.k6.js
 *
 * シナリオ:
 *   - 6 段階ランプアップ(0 → 1000 → 3000 → 5000 → 5000 → 0)で SSE 接続。
 *   - 各 VU は GET /api/v1/observation-events/:sessionId/live を 60 秒保持し、heartbeat を期待。
 *   - 平均接続時間 / 切断率 / 初回バイト時間(TTFB) を集計。
 *
 * しきい値:
 *   - drop_rate < 1%
 *   - p95(ttfb) < 1500ms
 *   - p95(connection_age_ms) > 50000  (= 50 秒以上接続維持)
 */

import http from "k6/http";
import { sleep, check } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8765";
const SESSION_ID = __ENV.SESSION_ID || "00000000-0000-0000-0000-000000000000";
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 60);

const dropRate = new Rate("sse_drop_rate");
const ttfb = new Trend("sse_ttfb_ms");
const connectionAge = new Trend("sse_connection_age_ms");
const completed = new Counter("sse_completed_count");

export const options = {
  scenarios: {
    sse_5000: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 1000 },
        { duration: "1m", target: 3000 },
        { duration: "1m", target: 5000 },
        { duration: "2m", target: 5000 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    sse_drop_rate: ["rate<0.01"],
    sse_ttfb_ms: ["p(95)<1500"],
    sse_connection_age_ms: ["p(95)>50000"],
  },
};

export default function () {
  const url = `${BASE_URL}/api/v1/observation-events/${SESSION_ID}/live`;
  const start = Date.now();
  // k6 は EventSource を直接持たないので、HTTP GET で stream を開く。
  // timeout 内で読める範囲だけ受け取り、status と TTFB を測る。
  const res = http.get(url, {
    headers: { Accept: "text/event-stream" },
    timeout: `${HOLD_SECONDS + 5}s`,
    responseType: "text",
  });
  const elapsed = Date.now() - start;

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "content-type is text/event-stream": (r) => String(r.headers["Content-Type"] || "").includes("text/event-stream"),
  });

  if (!ok) {
    dropRate.add(1);
  } else {
    dropRate.add(0);
    completed.add(1);
    if (typeof res.timings.waiting === "number") ttfb.add(res.timings.waiting);
    connectionAge.add(elapsed);
  }

  // VU 切断後のサーバ side cleanup を観測するため少し待つ
  sleep(1);
}
