/**
 * FieldRecorder v3 — Session Persistence
 * Phase 16C: sessionStorage persistence for cross-page navigation.
 * Survives post.php round-trip without losing GPS session.
 */
class FieldRecorder {
    static STORAGE_KEY = 'ikimon_field_session';

    constructor(map, fieldId = null) {
        this.map = map;
        this.fieldId = fieldId;
        this.db = null;
        this.isRecording = false;
        this.watchId = null;
        this.currentPath = [];
        this.currentAccuracy = 0;
        this.totalDistance = 0;
        this._saveCounter = 0;

        // Server sync
        this.sessionId = this._generateId();
        this.syncBuffer = [];
        this.syncInterval = null;
        this.BUFFER_SIZE = 10;       // Flush every N points
        this.FLUSH_INTERVAL = 5000;  // Or every 5 seconds

        this.initDB();
        this.setupMapLayers();

        // Auto-retry pending syncs when connectivity is restored
        window.addEventListener('online', () => {
            console.log('[FieldRecorder] Online — retrying pending syncs');
            this._retryPendingSync();
        });

        // Restore previous session if returning from post.php
        this._restoreState();
    }

    _generateId() {
        return 'trk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    // ── Session Persistence ──────────────────────────────────

    /**
     * Save recording state to sessionStorage.
     * Called on start, stop, and periodically during recording.
     */
    _saveState() {
        try {
            const state = {
                sessionId: this.sessionId,
                fieldId: this.fieldId,
                isRecording: this.isRecording,
                currentPath: this.currentPath,
                totalDistance: this.totalDistance,
                steps: window._stepCounter ? window._stepCounter.getSteps() : 0,
                savedAt: Date.now()
            };
            sessionStorage.setItem(FieldRecorder.STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            // sessionStorage full or unavailable — non-fatal
            console.warn('[FieldRecorder] State save failed:', e);
        }
    }

    /**
     * Restore recording state from sessionStorage.
     * If a recording was active, resume GPS tracking with the same sessionId.
     */
    _restoreState() {
        try {
            const raw = sessionStorage.getItem(FieldRecorder.STORAGE_KEY);
            if (!raw) return;

            const state = JSON.parse(raw);
            if (!state || !state.sessionId) return;

            // Reject stale state (> 4 hours old)
            if (state.savedAt && (Date.now() - state.savedAt > 4 * 60 * 60 * 1000)) {
                this._clearState();
                return;
            }

            // Restore state
            this.sessionId = state.sessionId;
            this.currentPath = state.currentPath || [];
            this.totalDistance = state.totalDistance || 0;

            // Restore step count
            if (state.steps && window._stepCounter) {
                window._stepCounter.setSteps(state.steps);
            }

            console.log('[FieldRecorder] State restored — session:', this.sessionId,
                'points:', this.currentPath.length, 'wasRecording:', state.isRecording);

            // Redraw existing path on map once loaded
            if (this.currentPath.length > 0) {
                const drawPath = () => {
                    if (this.map.getSource('current-track')) {
                        this.map.getSource('current-track').setData({
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: this.currentPath }
                        });
                    }
                };
                if (this.map.loaded()) {
                    drawPath();
                } else {
                    this.map.on('load', drawPath);
                }
            }

            // Resume recording if it was active
            if (state.isRecording) {
                this._resumeRecording();
            }
        } catch (e) {
            console.warn('[FieldRecorder] State restore failed:', e);
            this._clearState();
        }
    }

    /**
     * Clear persisted state (on explicit stop or session end).
     */
    _clearState() {
        try {
            sessionStorage.removeItem(FieldRecorder.STORAGE_KEY);
        } catch (e) { /* ignore */ }
    }

    /**
     * Resume GPS recording without resetting sessionId/path.
     * Used after page navigation (e.g. returning from post.php).
     */
    _resumeRecording() {
        if (!navigator.geolocation) return;

        this.isRecording = true;
        this.syncBuffer = [];

        // Resume step counter
        if (window._stepCounter && StepCounter.isSupported()) {
            window._stepCounter.start();
        }

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.processPosition(pos),
            (err) => console.error('[FieldRecorder] GPS error:', err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        this.syncInterval = setInterval(() => this._flushBuffer(), this.FLUSH_INTERVAL);

        console.log('[FieldRecorder] Recording RESUMED, session:', this.sessionId);
    }

    // ── Core ─────────────────────────────────────────────────

    async initDB() {
        try {
            this.db = await idb.openDB('ikimon-field-data', 2, {
                upgrade(db, oldVersion) {
                    if (!db.objectStoreNames.contains('tracks')) {
                        const store = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
                        store.createIndex('timestamp', 'timestamp');
                        store.createIndex('session_id', 'session_id');
                    }
                    if (!db.objectStoreNames.contains('pending_sync')) {
                        db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
                    }
                }
            });
            console.log('[FieldRecorder] DB initialized, session:', this.sessionId);

            // Retry any pending syncs from previous sessions
            this._retryPendingSync();
        } catch (err) {
            console.error('[FieldRecorder] DB init failed:', err);
        }
    }

    setupMapLayers() {
        this.map.on('load', () => {
            this.map.addSource('current-track', {
                type: 'geojson',
                data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
            });
            this.map.addLayer({
                id: 'track-line',
                type: 'line',
                source: 'current-track',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ef4444', 'line-width': 4 }
            });
        });
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.isRecording = true;
        this.currentPath = [];
        this.totalDistance = 0;
        this.syncBuffer = [];
        this.sessionId = this._generateId();

        // Start step counter
        if (window._stepCounter && StepCounter.isSupported()) {
            window._stepCounter.reset();
            window._stepCounter.start();
        }

        if (!navigator.geolocation) {
            alert('Geolocation not supported');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.processPosition(pos),
            (err) => console.error('[FieldRecorder] GPS error:', err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        // Start periodic flush timer
        this.syncInterval = setInterval(() => this._flushBuffer(), this.FLUSH_INTERVAL);

        // Persist state
        this._saveState();

        console.log('[FieldRecorder] Recording started, session:', this.sessionId);
    }

    async stopRecording() {
        this.isRecording = false;
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Stop step counter
        if (window._stepCounter) {
            window._stepCounter.stop();
        }

        // Final flush
        await this._flushBuffer();

        // Clear persisted state
        this._clearState();

        console.log('[FieldRecorder] Recording stopped. Total points:', this.currentPath.length);
    }

    async processPosition(pos) {
        const { latitude, longitude, accuracy, altitude } = pos.coords;
        const timestamp = pos.timestamp;

        this.currentAccuracy = accuracy;

        // Filter poor accuracy (> 50m)
        if (accuracy > 50) return;

        const point = [longitude, latitude];

        // Distance calculation
        if (this.currentPath.length > 0) {
            const last = this.currentPath[this.currentPath.length - 1];
            const d = this.calcDistance(last[1], last[0], latitude, longitude);
            this.totalDistance += d;
        }

        this.currentPath.push(point);

        // Update map visualization
        const geojson = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: this.currentPath }
        };
        if (this.map.getSource('current-track')) {
            this.map.getSource('current-track').setData(geojson);
            this.map.panTo(point);
        }

        const trackPoint = {
            lat: latitude,
            lng: longitude,
            accuracy,
            altitude,
            timestamp,
            session_id: this.sessionId
        };

        // Dual Write 1: Local IndexedDB (offline insurance)
        if (this.db) {
            try {
                await this.db.add('tracks', trackPoint);
            } catch (e) {
                console.warn('[FieldRecorder] IndexedDB write failed:', e);
            }
        }

        // Dual Write 2: Buffer for server sync
        this.syncBuffer.push(trackPoint);
        if (this.syncBuffer.length >= this.BUFFER_SIZE) {
            this._flushBuffer();
        }

        // Persist state periodically (every 5 points to avoid perf hit)
        this._saveCounter++;
        if (this._saveCounter % 5 === 0) {
            this._saveState();
        }
    }

    async _flushBuffer() {
        if (this.syncBuffer.length === 0) return;

        const batch = [...this.syncBuffer];
        this.syncBuffer = [];

        try {
            const resp = await fetch('api/save_track.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' },
                body: JSON.stringify({
                    field_id: this.fieldId,
                    session_id: this.sessionId,
                    points: batch,
                    step_count: window._stepCounter ? window._stepCounter.getSteps() : null
                })
            });

            if (!resp.ok) {
                // Show user-visible warning for auth failures
                if (resp.status === 401) {
                    const debugEl = document.getElementById('debug-info');
                    if (debugEl) {
                        debugEl.textContent = '⚠️ ログインが必要です — データ未保存';
                        debugEl.style.color = '#f87171';
                    }
                }
                throw new Error(`HTTP ${resp.status}`);
            }

            const result = await resp.json();
            console.log('[FieldRecorder] Synced', result.saved, 'points. Total:', result.total_points);

            if (result.habit_qualified && window.ikimonAnalytics) {
                window.ikimonAnalytics.track('walk_habit_qualified', {
                    session_id: this.sessionId,
                    total_distance: result.total_distance,
                    total_points: result.total_points
                });
            }

            // Update debug info
            const debugEl = document.getElementById('debug-info');
            if (debugEl) {
                debugEl.textContent = `Synced: ${result.total_points} pts | ${(result.total_distance / 1000).toFixed(2)} km`;
            }

            // Piggyback: retry any pending syncs after a successful flush
            this._retryPendingSync();
        } catch (err) {
            console.warn('[FieldRecorder] Server sync failed, queuing for retry:', err);
            // Store in pending_sync for later retry
            if (this.db) {
                try {
                    await this.db.add('pending_sync', {
                        field_id: this.fieldId,
                        session_id: this.sessionId,
                        points: batch,
                        failed_at: Date.now()
                    });
                } catch (e) {
                    console.error('[FieldRecorder] Failed to queue for retry:', e);
                }
            }
        }
    }

    async _retryPendingSync() {
        if (!this.db) return;
        // Don't attempt retry if clearly offline
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) return;

        try {
            const pending = await this.db.getAll('pending_sync');
            if (pending.length === 0) return;

            // Clean up stale entries (> 72 hours old)
            const STALE_MS = 72 * 60 * 60 * 1000;
            const now = Date.now();
            let cleaned = 0;
            for (const item of pending) {
                if (item.failed_at && (now - item.failed_at > STALE_MS)) {
                    await this.db.delete('pending_sync', item.id);
                    cleaned++;
                }
            }
            if (cleaned > 0) {
                console.log(`[FieldRecorder] Cleaned ${cleaned} stale pending items`);
            }

            // Re-fetch after cleanup
            const remaining = await this.db.getAll('pending_sync');
            if (remaining.length === 0) return;

            console.log('[FieldRecorder] Retrying', remaining.length, 'pending syncs');
            const debugEl = document.getElementById('debug-info');
            let synced = 0;

            for (const item of remaining) {
                try {
                    const resp = await fetch('api/save_track.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || '' },
                        body: JSON.stringify({
                            field_id: item.field_id,
                            session_id: item.session_id,
                            points: item.points
                        })
                    });
                    if (resp.ok) {
                        await this.db.delete('pending_sync', item.id);
                        synced++;
                        console.log('[FieldRecorder] Retry sync succeeded for', item.session_id);
                    } else if (resp.status === 401) {
                        // Auth failure — stop retrying until next login
                        console.warn('[FieldRecorder] Auth required, pausing retry');
                        break;
                    }
                } catch (e) {
                    // Still offline, keep in queue
                    break;
                }
            }

            // Notify user if any data was recovered
            if (synced > 0 && debugEl) {
                debugEl.textContent = `✅ オフラインデータ ${synced}件を復旧しました`;
                debugEl.style.color = '#10b981';
                setTimeout(() => { debugEl.style.color = ''; }, 5000);
            }
        } catch (e) {
            console.warn('[FieldRecorder] Retry check failed:', e);
        }
    }

    getStats() {
        return {
            distance: this.totalDistance,
            points: this.currentPath.length,
            steps: window._stepCounter ? window._stepCounter.getSteps() : null
        };
    }

    getCurrentAccuracy() {
        return this.currentAccuracy;
    }

    calcDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}
