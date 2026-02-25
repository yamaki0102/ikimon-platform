/**
 * ikimon Analytics — 投稿フロー計測フック
 * 
 * 10要素KPIインフラ: ファネル計測で改善ポイントを可視化
 * 
 * 計測イベント:
 *   - page_view: ページ表示
 *   - post_start: 投稿フォーム到達
 *   - photo_added: 写真追加
 *   - form_expand: 詳細フォーム展開
 *   - post_submit: 投稿送信
 *   - post_success: 投稿成功
 *   - bridge_click: 同定ブリッジCTAクリック
 *   - onboarding_step: オンボーディング進行
 *   - id_attempt: 同定試行
 *   - notification_open: 通知ドロップダウン開封
 */

(function () {
    'use strict';

    const ENDPOINT = 'api/save_analytics.php';
    const SESSION_KEY = 'ikimon_analytics_session';
    const QUEUE_KEY = 'ikimon_analytics_queue';
    const FLUSH_INTERVAL = 10000; // 10秒ごとにバッチ送信
    const MAX_QUEUE = 50;

    // セッションID生成（ページロードごと）
    function getSessionId() {
        let sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    // イベントをキューに追加
    function queueEvent(event, data) {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue.push({
            event: event,
            data: data || {},
            page: window.location.pathname.replace(/^\//, '').replace(/\.php$/, '') || 'index',
            session_id: getSessionId(),
            timestamp: new Date().toISOString(),
            viewport: window.innerWidth + 'x' + window.innerHeight,
            referrer: document.referrer ? new URL(document.referrer).pathname : ''
        });

        // キュー上限
        if (queue.length > MAX_QUEUE) {
            queue.splice(0, queue.length - MAX_QUEUE);
        }

        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }

    // キューをサーバーに送信
    function flushQueue() {
        const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (queue.length === 0) return;

        const payload = JSON.stringify({ events: queue });
        localStorage.setItem(QUEUE_KEY, '[]');

        // sendBeacon for reliability (survives page unload)
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(ENDPOINT, blob);
        } else {
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(() => {
                // Restore queue on failure
                const current = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
                const restored = queue.concat(current);
                localStorage.setItem(QUEUE_KEY, JSON.stringify(restored.slice(-MAX_QUEUE)));
            });
        }
    }

    // === Public API ===
    window.ikimonAnalytics = {
        track: function (event, data) {
            queueEvent(event, data);
        },
        flush: flushQueue
    };

    // 自動ページビュー計測
    queueEvent('page_view');

    // 定期送信
    setInterval(flushQueue, FLUSH_INTERVAL);

    // ページ離脱時に送信
    window.addEventListener('beforeunload', flushQueue);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushQueue();
    });

})();
