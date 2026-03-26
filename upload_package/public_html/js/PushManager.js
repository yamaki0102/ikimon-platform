/**
 * PushManager.js — ikimon PWA Push Notification Manager
 *
 * Handles:
 * - Requesting notification permission
 * - Subscribing to push notifications via Service Worker
 * - Sending subscription to server
 * - Streak nudge scheduling (local fallback)
 */
const IkimonPush = {
    VAPID_PUBLIC_KEY: null, // Set from server config
    _subscription: null,

    /**
     * Initialize push notifications.
     * Call after user logs in and service worker is ready.
     */
    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('[IkimonPush] Push not supported');
            return false;
        }

        if (Notification.permission === 'denied') {
            console.log('[IkimonPush] Notifications denied by user');
            return false;
        }

        return true;
    },

    /**
     * Request notification permission and subscribe.
     * Returns true if subscribed successfully.
     */
    async requestAndSubscribe() {
        if (!await this.init()) return false;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[IkimonPush] Permission not granted:', permission);
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription && this.VAPID_PUBLIC_KEY) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY),
                });
            }

            if (subscription) {
                this._subscription = subscription;
                await this._sendSubscriptionToServer(subscription);
                return true;
            }
        } catch (err) {
            console.error('[IkimonPush] Subscribe failed:', err);
        }

        return false;
    },

    /**
     * Schedule a local notification reminder for streak preservation.
     * Uses the Notification API directly (no server push needed).
     * This is a lightweight fallback for when VAPID keys aren't configured.
     */
    scheduleStreakReminder(streakDays, todayComplete) {
        if (todayComplete || !streakDays || streakDays < 1) return;
        if (Notification.permission !== 'granted') return;

        // Calculate time until 18:00 today
        const now = new Date();
        const reminderTime = new Date();
        reminderTime.setHours(18, 0, 0, 0);

        // If it's already past 18:00, schedule for 20:00
        if (now >= reminderTime) {
            reminderTime.setHours(20, 0, 0, 0);
        }

        // If still past, don't schedule
        if (now >= reminderTime) return;

        const delay = reminderTime.getTime() - now.getTime();

        // Store timeout ID to prevent duplicates
        if (this._streakTimeout) clearTimeout(this._streakTimeout);

        this._streakTimeout = setTimeout(() => {
            // Double-check: re-fetch today's state before showing
            fetch('/api/get_today_state.php')
                .then(r => r.json())
                .then(data => {
                    if (data.today_complete) return; // Already completed
                    new Notification('ikimon — ストリーク継続', {
                        body: `${streakDays}日連続が途切れる前に、1分メモだけでもOK！`,
                        icon: '/assets/img/pwa-icon-192.png',
                        tag: 'streak-reminder',
                    });
                })
                .catch(() => {
                    // Offline or error — show anyway
                    new Notification('ikimon — ストリーク継続', {
                        body: `${streakDays}日連続を守ろう！1つだけでいい。`,
                        icon: '/assets/img/pwa-icon-192.png',
                        tag: 'streak-reminder',
                    });
                });
        }, delay);
    },

    /**
     * Send subscription endpoint to server for server-side push.
     */
    async _sendSubscriptionToServer(subscription) {
        try {
            await fetch('/api/push_subscribe.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });
        } catch (err) {
            console.error('[IkimonPush] Failed to send subscription:', err);
        }
    },

    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    },
};
