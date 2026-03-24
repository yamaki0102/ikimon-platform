/**
 * LiveScanner.js — ライブスキャン エンジン
 *
 * field_scan.php から抽出したスキャンコアロジック。
 * UI非依存。field_research.php の Alpine.js から呼び出す。
 *
 * 機能:
 *  - カメラキャプチャ → Gemini AI 種同定 (scan_classify.php)
 *  - 音声録音 → BirdNET AI 鳥音声同定 (analyze_audio.php)
 *  - GPS追跡
 *  - 環境スキャン (scan_classify.php?env=1)
 *  - 検出バッチ送信 (passive_event.php)
 *  - セッション終了サマリー (scan_summary.php + session_recap.php)
 *
 * 使い方:
 *   const scanner = new LiveScanner({ onDetection, onEnvUpdate, onLog });
 *   await scanner.start({ mode: 'walk', enableCamera: true, enableAudio: true });
 *   scanner.stop(); // → Promise<SessionResult>
 */

class LiveScanner {
    constructor(opts = {}) {
        this.onDetection = opts.onDetection || (() => {});
        this.onEnvUpdate = opts.onEnvUpdate || (() => {});
        this.onLog = opts.onLog || ((msg) => console.log('[LiveScanner]', msg));
        this.onGpsUpdate = opts.onGpsUpdate || (() => {});
        this.onAudioState = opts.onAudioState || (() => {});

        this._reset();
    }

    _reset() {
        this.active = false;
        this.mode = 'walk';
        this.startTime = null;
        this.sessionId = null;
        this.stream = null;
        this.videoEl = null;
        this.canvasEl = null;

        // Timers
        this._captureTimer = null;
        this._envTimer = null;
        this._batchTimer = null;
        this._timerInt = null;
        this._recTimer = null;

        // GPS
        this._watchId = null;
        this._gpsPollTimer = null;
        this._gpsPolling = false;
        this._gpsStillSince = 0;
        this.routePoints = [];
        this.currentSpeed = 0;
        this.lastGpsPos = null;

        // Detections
        this.speciesMap = {};
        this.detectionLog = [];
        this.totalDet = 0;
        this.audioDet = 0;
        this.visualDet = 0;
        this.frameScanCount = 0;
        this.audioScanCount = 0;

        // Audio
        this._recorder = null;
        this._chunks = [];
        this._mime = '';
        this._audioCtx = null;
        this._analyser = null;
        this._analyzing = false;
        this._audioEmptyStreak = 0;
        this._audioResuming = false;

        // Environment
        this.envHistory = [];

        // Batch
        this._pendingEvents = [];
        this._sentEventCount = 0;
        this._serverSessionId = null;

        // Power
        this._powerSaveMode = false;
        this._batteryLevel = 1.0;
        this._isCharging = false;
        this._isWifi = true;

        // Stats
        this.dataUsage = 0;
    }

    // ========== START ==========

    async start({ mode = 'walk', enableCamera = true, enableAudio = true, powerSave = false, videoElement = null, canvasElement = null } = {}) {
        this._reset();
        this.active = true;
        this.mode = mode;
        this.startTime = Date.now();
        this.sessionId = 'ls_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        this._powerSaveMode = powerSave;

        this.onLog('セッション開始: ' + mode);

        // Batch timer (30秒毎に送信)
        this._batchTimer = setInterval(() => this._flushEvents(false), 30000);

        // WiFi check
        const conn = navigator.connection || navigator.mozConnection;
        this._isWifi = !conn || conn.type === 'wifi' || conn.type === 'ethernet';

        // Battery
        this._monitorBattery();

        // Camera + Audio (with graceful fallback)
        if (enableCamera || enableAudio) {
            try {
                const constraints = {};
                if (enableCamera) constraints.video = { facingMode: 'environment', width: { ideal: 640 } };
                if (enableAudio) constraints.audio = true;

                try {
                    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (mediaErr) {
                    // If both failed, try camera only
                    if (enableCamera && enableAudio) {
                        this.onLog('カメラ+音声失敗。カメラのみで再試行: ' + mediaErr.message);
                        try {
                            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 } } });
                            enableAudio = false; // Disable audio for this session
                        } catch (camErr) {
                            // Camera also failed, try audio only
                            this.onLog('カメラも失敗。音声のみで再試行: ' + camErr.message);
                            try {
                                this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                enableCamera = false;
                            } catch (audioErr) {
                                throw audioErr; // Both failed completely
                            }
                        }
                    } else {
                        throw mediaErr;
                    }
                }
                this.onLog('メディアストリーム取得OK' + (!enableAudio ? '（音声なし）' : '') + (!enableCamera ? '（カメラなし）' : ''));

                // Video element for camera capture
                if (enableCamera && videoElement) {
                    this.videoEl = videoElement;
                    this.videoEl.srcObject = this.stream;
                    await this.videoEl.play().catch(() => {});
                }

                // Canvas for frame capture
                if (enableCamera) {
                    this.canvasEl = canvasElement || document.createElement('canvas');
                }

                // Start camera capture
                if (enableCamera) {
                    this._scheduleCapture();
                    this._envTimer = setInterval(() => this._envScan(), this._isWifi ? 10000 : 30000);
                    setTimeout(() => this._envScan(), 3000);
                }

                // Start audio
                if (enableAudio && mode !== 'car') {
                    this._setupAudio();
                }
            } catch (e) {
                this.onLog('メディア取得エラー: ' + e.message);
            }
        }

        // GPS
        this._startGps();
    }

    // ========== STOP ==========

    async stop() {
        this.active = false;

        // Cleanup timers
        [this._captureTimer, this._envTimer, this._batchTimer, this._timerInt, this._recTimer, this._gpsPollTimer].forEach(t => {
            if (t) { clearTimeout(t); clearInterval(t); }
        });

        // Cleanup media
        try { if (this._recorder && this._recorder.state === 'recording') this._recorder.stop(); } catch (e) {}
        try { if (this._watchId) navigator.geolocation.clearWatch(this._watchId); } catch (e) {}
        try { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        try { if (this._audioCtx) this._audioCtx.close(); } catch (e) {}

        const duration = Math.floor((Date.now() - this.startTime) / 1000);
        const speciesCount = Object.keys(this.speciesMap).length;
        const distance = this._calcDistance(this.routePoints);

        // Send final batch
        await this._flushEvents(true);

        // Post summary
        await this._postSummary(speciesCount, Math.floor(duration / 60));

        // Fetch recap
        const recap = await this._fetchRecap(duration);

        return {
            sessionId: this._serverSessionId || this.sessionId,
            mode: this.mode,
            duration,
            distance,
            speciesCount,
            totalDetections: this.totalDet,
            audioDetections: this.audioDet,
            visualDetections: this.visualDet,
            species: Object.entries(this.speciesMap).map(([name, d]) => ({
                name, count: d.count, confidence: d.confidence, source: d.source,
                category: d.category, note: d.note
            })),
            envHistory: this.envHistory,
            routePoints: this.routePoints,
            recap,
            dataUsage: this.dataUsage,
        };
    }

    // ========== GPS ==========

    _startGps() {
        if (!navigator.geolocation) return;
        this._watchId = navigator.geolocation.watchPosition(
            pos => this._handleGps(pos),
            err => this.onLog('GPS ERR: ' + err.message),
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
    }

    _handleGps(pos) {
        const acc = pos.coords.accuracy || 999;
        this.currentSpeed = pos.coords.speed || 0;

        if (acc <= 50) {
            this.routePoints.push({
                lat: pos.coords.latitude, lng: pos.coords.longitude,
                ts: Date.now(), speed: this.currentSpeed, accuracy: acc
            });
        }
        this.lastGpsPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };
        this.onGpsUpdate(this.lastGpsPos);

        // Still detection → polling
        if (this.currentSpeed < 0.3) {
            if (!this._gpsStillSince) this._gpsStillSince = Date.now();
            if (!this._gpsPolling && Date.now() - this._gpsStillSince > 30000) {
                this._switchToGpsPolling();
            }
        } else {
            this._gpsStillSince = 0;
            if (this._gpsPolling) this._switchToGpsWatch();
        }
    }

    _switchToGpsPolling() {
        if (this._gpsPolling) return;
        this._gpsPolling = true;
        if (this._watchId) { navigator.geolocation.clearWatch(this._watchId); this._watchId = null; }
        this.onLog('GPS → polling (静止中)');
        this._gpsPollTimer = setInterval(() => {
            if (!this.active) return;
            navigator.geolocation.getCurrentPosition(
                pos => this._handleGps(pos), () => {},
                { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
            );
        }, 15000);
    }

    _switchToGpsWatch() {
        if (!this._gpsPolling) return;
        this.onLog('GPS → watch (移動再開)');
        if (this._gpsPollTimer) { clearInterval(this._gpsPollTimer); this._gpsPollTimer = null; }
        this._gpsPolling = false;
        this._startGps();
    }

    // ========== CAMERA ==========

    _getAdaptiveCaptureMs() {
        let base = this.mode === 'car' ? 5000 : this.mode === 'bike' ? 3000 : 2000;
        if (this._powerSaveMode) base *= 2;
        if (this.mode === 'walk') {
            if (this.currentSpeed < 0.3) base = Math.max(base, 12000);
            else if (this.currentSpeed > 2.0) base = Math.min(base, 1500);
        }
        return base;
    }

    _scheduleCapture() {
        if (!this.active) return;
        this._captureTimer = setTimeout(() => {
            if (!this.active) return;
            this._captureFrame();
            this._scheduleCapture();
        }, this._getAdaptiveCaptureMs());
    }

    async _captureFrame() {
        if (!this.active || !this.videoEl || !this.canvasEl) return;
        try {
            const v = this.videoEl;
            const c = this.canvasEl;
            if (!v.videoWidth) return;

            const maxW = this._isWifi ? 640 : 320;
            const quality = this._isWifi ? 0.7 : 0.5;
            c.width = Math.min(v.videoWidth, maxW);
            c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

            this.frameScanCount++;

            const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
            this.dataUsage += blob.size;

            const fd = new FormData();
            fd.append('photo', blob, 'scan.jpg');
            const last = this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1] : null;
            if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

            if (this.envHistory.length > 0) {
                fd.append('context', JSON.stringify({ environment: this.envHistory[0] }));
            }

            const resp = await fetch('/api/v2/scan_classify.php', { method: 'POST', body: fd });
            if (!resp.ok) return;
            const text = await resp.text();
            this.dataUsage += text.length;
            const json = JSON.parse(text);

            if (json.success && json.data?.suggestions?.length > 0) {
                json.data.suggestions.forEach(sug => {
                    this._addDetection(sug.name, sug.scientific_name || '', sug.confidence || 0.5, 'visual', sug.category || '', sug.note || '');
                });
                this.onLog('📷 ' + json.data.suggestions.length + '件検出');
            }
        } catch (e) {
            this.onLog('📷 ERR: ' + e.message);
        }
    }

    // ========== ENVIRONMENT SCAN ==========

    async _envScan() {
        if (!this.active || !this.videoEl || !this.canvasEl) return;
        try {
            const v = this.videoEl;
            const c = this.canvasEl;
            if (!v.videoWidth) return;

            c.width = Math.min(v.videoWidth, 320);
            c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

            const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.5));
            const fd = new FormData();
            fd.append('photo', blob, 'env.jpg');
            fd.append('env', '1');
            const last = this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1] : null;
            if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

            const resp = await fetch('/api/v2/scan_classify.php', { method: 'POST', body: fd });
            if (!resp.ok) return;
            const json = await resp.json();
            if (json.success && json.data?.environment) {
                const env = { ...json.data.environment, timestamp: new Date().toISOString() };
                this.envHistory.unshift(env);
                if (this.envHistory.length > 50) this.envHistory.pop();
                this.onEnvUpdate(env);
            }
        } catch (e) {}
    }

    // ========== AUDIO ==========

    _setupAudio() {
        if (!this.stream) return;
        const tracks = this.stream.getAudioTracks();
        if (tracks.length === 0) return;

        this._mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        if (!this._mime) return;

        const audioStream = new MediaStream(tracks);

        this._audioCtx = new AudioContext();
        const src = this._audioCtx.createMediaStreamSource(audioStream);
        this._analyser = this._audioCtx.createAnalyser();
        this._analyser.fftSize = 2048;
        src.connect(this._analyser);

        this._recorder = new MediaRecorder(audioStream, { mimeType: this._mime });
        this._chunks = [];
        this._recorder.ondataavailable = e => { if (e.data.size > 0) this._chunks.push(e.data); };
        this._recorder.onstop = () => {
            if (this._chunks.length === 0 || !this.active) return;
            const blob = new Blob(this._chunks, { type: this._mime });
            this._chunks = [];
            if (this._audioCtx?.state === 'running') this._audioCtx.suspend();
            this._sendAudio(blob);
        };

        this._startAudioCycle();
    }

    _getAdaptiveAudioMs() {
        let base = 3000;
        if (this._powerSaveMode) base = 6000;
        if (this._audioEmptyStreak >= 10) base = Math.max(base, 6000);
        else if (this._audioEmptyStreak >= 5) base = Math.max(base, 4000);
        return base;
    }

    _startAudioCycle() {
        if (!this.active || !this._recorder) return;
        if (this._analyzing || this._audioResuming) {
            this._recTimer = setTimeout(() => this._startAudioCycle(), 1000);
            return;
        }

        this.onAudioState('listening');

        const doRecord = () => {
            this._audioResuming = false;
            if (!this.active) return;
            try {
                this._chunks = [];
                this._recorder.start();
                this._recTimer = setTimeout(() => {
                    if (this._recorder?.state === 'recording') this._recorder.stop();
                }, 3000);
            } catch (e) {
                this._recTimer = setTimeout(() => this._startAudioCycle(), this._getAdaptiveAudioMs());
            }
        };

        if (this._audioCtx?.state === 'suspended') {
            this._audioResuming = true;
            this._audioCtx.resume().then(doRecord).catch(doRecord);
        } else {
            doRecord();
        }
    }

    async _sendAudio(blob) {
        if (!this.active) return;
        this._analyzing = true;
        this.onAudioState('analyzing');

        try {
            this.audioScanCount++;

            // ============================================================
            // BirdNET (CC BY-NC-SA 4.0) は不採用。
            // Perch v2 (Apache 2.0) への移行が完了するまで、
            // 音声種同定は無効。録音データは音響指数計算に使用する。
            // ============================================================

            // TODO: Perch v2 サーバーサイドAPIが準備できたら以下を有効化
            // const resp = await fetch('/api/v2/analyze_audio_perch.php', { method: 'POST', body: fd });

            // 音響指数の簡易計算（RMS レベル = 環境音の指標）
            if (this._analyser) {
                const data = new Uint8Array(this._analyser.frequencyBinCount);
                this._analyser.getByteFrequencyData(data);

                // 2-8kHz 帯域（鳥の鳴き声帯域）のエネルギー
                const sr = this._audioCtx.sampleRate;
                const binSize = sr / this._analyser.fftSize;
                const birdLo = Math.floor(2000 / binSize);
                const birdHi = Math.min(Math.ceil(8000 / binSize), data.length - 1);
                let birdEnergy = 0;
                for (let i = birdLo; i <= birdHi; i++) birdEnergy += data[i];
                birdEnergy /= (birdHi - birdLo + 1);

                // 低周波帯域（人工音）のエネルギー
                const lowHi = Math.min(Math.ceil(1000 / binSize), data.length - 1);
                let lowEnergy = 0;
                for (let i = 0; i <= lowHi; i++) lowEnergy += data[i];
                lowEnergy /= (lowHi + 1);

                // 簡易NDSI: (生物音 - 人工音) / (生物音 + 人工音)
                const ndsi = (birdEnergy + lowEnergy) > 0
                    ? (birdEnergy - lowEnergy) / (birdEnergy + lowEnergy) : 0;

                this._latestNdsi = ndsi;
                this._latestBirdEnergy = birdEnergy;

                if (this.audioScanCount % 10 === 0) {
                    this.onLog(`🎵 音響: NDSI=${ndsi.toFixed(2)} 鳥帯域=${birdEnergy.toFixed(0)} (Perch v2移行待ち)`);
                }
            }

        } catch (e) {
            this.onLog('🎤 ERR: ' + e.message);
        } finally {
            this._analyzing = false;
            this.onAudioState('listening');
            if (this.active) {
                const waitMs = this._getAdaptiveAudioMs() - 3000;
                this._recTimer = setTimeout(() => this._startAudioCycle(), Math.max(0, waitMs));
            }
        }
    }

    // ========== DETECTION ==========

    _addDetection(name, sci, conf, source, category, note) {
        this.totalDet++;
        if (source === 'audio') this.audioDet++;
        else this.visualDet++;

        const isNew = !this.speciesMap[name];
        if (isNew) {
            this.speciesMap[name] = { count: 0, confidence: 0, source, category: category || '', note: note || '', firstSeen: Date.now(), lastSeen: Date.now() };
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
        this.speciesMap[name].count++;
        this.speciesMap[name].confidence = Math.max(this.speciesMap[name].confidence, conf);
        this.speciesMap[name].lastSeen = Date.now();
        if (note && !this.speciesMap[name].note) this.speciesMap[name].note = note;

        this.detectionLog.push({
            name, sci, conf, source, note: note || '', isNew,
            time: Math.floor((Date.now() - this.startTime) / 1000),
        });

        // Callback
        this.onDetection({
            label: name, scientificName: sci, confidence: conf >= 0.7 ? 'high' : conf >= 0.4 ? 'medium' : 'low',
            confidenceScore: conf, source, emoji: source === 'audio' ? '🐦' : '🌿',
            reason: source === 'audio' ? `音声 ${Math.round(conf * 100)}%` : `視覚 ${Math.round(conf * 100)}%`,
            isNew, category, note,
        });

        // Queue for batch send
        this._queueEvent(name, sci, conf, source);
    }

    // ========== BATCH SEND ==========

    _queueEvent(name, sci, conf, source) {
        const det = this.speciesMap[name] || {};
        const last = this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1] : null;
        const evt = {
            type: source === 'audio' ? 'audio' : 'visual',
            taxon_name: name, scientific_name: sci,
            confidence: conf, category: det.category || '',
            lat: last?.lat ?? null, lng: last?.lng ?? null,
            timestamp: new Date().toISOString(),
            model: source === 'audio' ? 'birdnet-v2.4' : 'gemini-vision',
        };
        if (this.envHistory.length > 0) {
            evt.environment_snapshot = this.envHistory[0];
        }
        this._pendingEvents.push(evt);
    }

    async _flushEvents(isFinal) {
        const events = this._pendingEvents.splice(0);
        if (events.length === 0 && !isFinal) return;

        const sec = Math.floor((Date.now() - this.startTime) / 1000);
        const payload = {
            events,
            session: {
                duration_sec: sec,
                distance_m: this._calcDistance(this.routePoints),
                route_polyline: this.routePoints.map(p => p.lat.toFixed(6) + ',' + p.lng.toFixed(6)).join(';'),
                device: /iPhone/.test(navigator.userAgent) ? 'iPhone' : 'Android',
                app_version: 'web_2.0',
                scan_mode: 'live-scan',
                session_id_client: this.sessionId,
                is_incremental: !isFinal,
            }
        };
        if (isFinal) {
            payload.env_history = this.envHistory;
            payload.session.is_final = true;
        }

        try {
            const resp = await fetch('/api/v2/passive_event.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload)
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.success) {
                    this._sentEventCount += events.length;
                    if (data.data?.session_id) this._serverSessionId = data.data.session_id;
                    this.onLog('📡 ' + events.length + '件送信OK');
                }
            }
        } catch (e) {
            // Save to localStorage for retry
            this._savePending(events, payload.session);
        }
    }

    _savePending(events, session) {
        try {
            const key = 'ikimon_scan_pending';
            let existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push({ events, session, sessionId: this.sessionId, savedAt: new Date().toISOString() });
            const cutoff = Date.now() - 48 * 3600 * 1000;
            existing = existing.filter(p => new Date(p.savedAt).getTime() > cutoff);
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {}
    }

    // ========== SUMMARY & RECAP ==========

    async _postSummary(speciesCount, durationMin) {
        if (speciesCount === 0 && this.routePoints.length === 0) return;

        const speciesList = Object.entries(this.speciesMap).map(([name, d]) => ({
            name, count: d.count, confidence: d.confidence, source: d.source
        }));
        const last = this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1] : null;

        try {
            await fetch('/api/v2/scan_summary.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    scan_mode: 'live-scan',
                    duration_min: durationMin,
                    species_count: speciesCount,
                    total_detections: this.totalDet,
                    audio_detections: this.audioDet,
                    visual_detections: this.visualDet,
                    gps_points: this.routePoints.length,
                    species: speciesList,
                    environment: this.envHistory[0] || null,
                    session_id: this._serverSessionId || this.sessionId,
                    lat: last?.lat ?? null, lng: last?.lng ?? null,
                })
            });
        } catch (e) {}
    }

    async _fetchRecap(durationSec) {
        const speciesList = Object.entries(this.speciesMap).map(([name, d]) => ({
            name, scientific_name: '', confidence: d.confidence, count: d.count
        }));
        if (speciesList.length === 0) return null;

        try {
            const last = this.routePoints.length > 0 ? this.routePoints[this.routePoints.length - 1] : null;
            const resp = await fetch('/api/v2/session_recap.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    species: speciesList,
                    duration_sec: durationSec,
                    distance_m: this._calcDistance(this.routePoints),
                    lat: last?.lat ?? 0, lng: last?.lng ?? 0,
                    scan_mode: 'live-scan',
                    hour: new Date().getHours(),
                })
            });
            if (!resp.ok) return null;
            const json = await resp.json();
            return json.success ? json.data : null;
        } catch (e) {
            return null;
        }
    }

    // ========== BATTERY ==========

    async _monitorBattery() {
        if (!navigator.getBattery) return;
        try {
            const batt = await navigator.getBattery();
            this._batteryLevel = batt.level;
            this._isCharging = batt.charging;
            batt.addEventListener('levelchange', () => {
                this._batteryLevel = batt.level;
                this._checkPowerSave();
            });
        } catch (e) {}
    }

    _checkPowerSave() {
        if (this._batteryLevel <= 0.10 && !this._isCharging) {
            this._powerSaveMode = true;
            if (this._captureTimer) { clearTimeout(this._captureTimer); this._captureTimer = null; }
            this.onLog('🔋 超省エネ: カメラOFF');
        } else if (this._batteryLevel <= 0.20 && !this._isCharging) {
            this._powerSaveMode = true;
        }
    }

    // ========== UTILS ==========

    _calcDistance(points) {
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            const R = 6371000;
            const dLat = (points[i].lat - points[i - 1].lat) * Math.PI / 180;
            const dLng = (points[i].lng - points[i - 1].lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(points[i - 1].lat * Math.PI / 180) * Math.cos(points[i].lat * Math.PI / 180) *
                Math.sin(dLng / 2) ** 2;
            total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return Math.round(total);
    }

    getElapsed() {
        if (!this.startTime) return 0;
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    getSpeciesCount() {
        return Object.keys(this.speciesMap).length;
    }

    getDistance() {
        return this._calcDistance(this.routePoints);
    }
}
