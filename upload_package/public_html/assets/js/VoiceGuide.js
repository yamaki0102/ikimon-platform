/**
 * VoiceGuide — 音声ネイチャーガイド
 *
 * 3モード:
 *   - 'standard': Web Speech API (ブラウザ内蔵TTS)
 *   - 'bluetooth': VOICEVOX経由のメディア再生 (Bluetooth優先)
 *   - 'zundamon': VOICEVOX ずんだもん音声 (サーバー生成)
 *
 * Bluetooth スピーカー対応。キュー管理で重複防止。
 */
var VoiceGuide = (function() {
    var enabled = false;
    var voiceMode = 'bluetooth';  // 'standard' | 'bluetooth' | 'zundamon'
    var voice = null;
    var queue = [];
    var speaking = false;
    var currentAudio = null;
    var onFinishCallback = null;

    function init() {
        if ('speechSynthesis' in window) {
            _selectJaVoice();
            speechSynthesis.onvoiceschanged = _selectJaVoice;
        }
    }

    function _selectJaVoice() {
        var voices = speechSynthesis.getVoices();
        var jaVoices = voices.filter(function(v) { return v.lang.startsWith('ja'); });
        if (jaVoices.length > 0) {
            voice = jaVoices.find(function(v) { return v.name.indexOf('Google') >= 0 || v.name.indexOf('Enhanced') >= 0; })
                 || jaVoices.find(function(v) { return v.localService === false; })
                 || jaVoices[0];
        }
    }

    function setEnabled(on) {
        enabled = !!on;
        if (!on) stop();
        try { localStorage.setItem('ikimon_voice_guide', on ? '1' : '0'); } catch(e) {}
    }

    function setVoiceMode(mode) {
        if (mode === 'zundamon' || mode === 'bluetooth' || mode === 'standard') {
            voiceMode = mode;
        } else {
            voiceMode = 'bluetooth';
        }
        try { localStorage.setItem('ikimon_voice_mode', voiceMode); } catch(e) {}
    }

    function getVoiceMode() { return voiceMode; }
    function isEnabled() { return enabled; }

    function loadSetting() {
        try {
            if (localStorage.getItem('ikimon_voice_guide') === '1') enabled = true;
            var migrated = localStorage.getItem('ikimon_voice_mode_bt_migrated');
            var m = localStorage.getItem('ikimon_voice_mode');
            if (migrated !== '1' && (!m || m === 'standard')) {
                voiceMode = 'bluetooth';
                localStorage.setItem('ikimon_voice_mode', voiceMode);
                localStorage.setItem('ikimon_voice_mode_bt_migrated', '1');
                return;
            }
            if (m === 'standard' || m === 'bluetooth' || m === 'zundamon') {
                voiceMode = m;
            }
        } catch(e) {}
    }

    var MAX_QUEUE = 4;

    function announce(text) {
        if (!enabled || !text) return;
        if (queue.length >= MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE + 1);
        queue.push({ type: 'tts', text: text });
        if (!speaking) _processQueue();
    }

    function announceAudio(audioUrl) {
        if (!enabled || !audioUrl) return;
        if (queue.length >= MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE + 1);
        queue.push({ type: 'audio', url: audioUrl });
        if (!speaking) _processQueue();
    }

    function stop() {
        queue = [];
        speaking = false;
        if (_ttsWatchdog) { clearTimeout(_ttsWatchdog); _ttsWatchdog = null; }
        if (_audioTimeout) { clearTimeout(_audioTimeout); _audioTimeout = null; }
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    }

    function onFinish(fn) { onFinishCallback = fn; }

    function _processQueue() {
        if (queue.length === 0) {
            speaking = false;
            if (onFinishCallback) onFinishCallback();
            return;
        }
        speaking = true;
        var item = queue.shift();
        if (item.type === 'audio') {
            _playAudio(item.url);
        } else {
            _speak(item.text);
        }
    }

    var _ttsWatchdog = null;
    function _speak(text) {
        if (!('speechSynthesis' in window)) { _processQueue(); return; }
        var utter = new SpeechSynthesisUtterance(text);
        if (voice) utter.voice = voice;
        utter.lang = 'ja-JP';
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        var done = false;
        function finish() {
            if (done) return; done = true;
            if (_ttsWatchdog) { clearTimeout(_ttsWatchdog); _ttsWatchdog = null; }
            _processQueue();
        }
        utter.onend = finish;
        utter.onerror = finish;
        // TTS watchdog: onend が飛ばないモバイルブラウザ対策
        // 日本語80文字 ≈ 8秒。余裕を持って15秒でフォールバック
        _ttsWatchdog = setTimeout(function() {
            if (!done) {
                speechSynthesis.cancel();
                finish();
            }
        }, 15000);
        speechSynthesis.speak(utter);
    }

    var _audioTimeout = null;
    function _playAudio(url) {
        currentAudio = new Audio(url);
        var done = false;
        function finish() {
            if (done) return; done = true;
            if (_audioTimeout) { clearTimeout(_audioTimeout); _audioTimeout = null; }
            currentAudio = null; _processQueue();
        }
        currentAudio.onended = finish;
        currentAudio.onerror = finish;
        currentAudio.play().then(function() {
            // 再生開始成功 → duration + 2秒後にフォールバック終了
            var dur = currentAudio && currentAudio.duration ? currentAudio.duration * 1000 + 2000 : 15000;
            _audioTimeout = setTimeout(finish, dur);
        }).catch(finish);
    }

    return {
        init: init,
        setEnabled: setEnabled,
        setVoiceMode: setVoiceMode,
        getVoiceMode: getVoiceMode,
        isEnabled: isEnabled,
        loadSetting: loadSetting,
        announce: announce,
        announceAudio: announceAudio,
        onFinish: onFinish,
        isSpeaking: function() { return speaking; },
        stop: stop
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { VoiceGuide.init(); VoiceGuide.loadSetting(); });
} else {
    VoiceGuide.init(); VoiceGuide.loadSetting();
}

/**
 * GuideOrchestrator — セッション全体の感情の流れを管理
 *
 * 感情レンズ: wonder / quest / mastery / memory / contribution
 * 選択ロジック: 固定ローテーションではなく、文脈に応じて最適なレンズを選ぶ
 * 沈黙管理: 段階的に深まる（5分→穏やか / 15分→五感 / 25分→詩的）
 * Opening: GPS取得を待ってから発火
 */
var GuideOrchestrator = (function() {
    var SILENCE_INTERVALS = [
        { minMs: 5 * 60 * 1000,  depthLabel: 'gentle' },
        { minMs: 10 * 60 * 1000, depthLabel: 'sensory' },
        { minMs: 8 * 60 * 1000,  depthLabel: 'poetic' },
    ];

    var session = {
        active: false,
        startTime: 0,
        detectionCount: 0,
        lastDetectionTime: 0,
        lastSilenceTime: 0,
        silenceCount: 0,
        species: [],
        speciesDetCounts: {},
        lat: 0,
        lng: 0,
        weather: '',
        temperature: '',
        highlightSpecies: '',
        highlightConfidence: 0,
        totalSilentMin: 0,
        openingSent: false,
        gpsReady: false,
    };

    var silenceTimer = null;
    var openingWaitTimer = null;

    function startSession(opts) {
        session.active = true;
        session.startTime = Date.now();
        session.detectionCount = 0;
        session.lastDetectionTime = Date.now();
        session.lastSilenceTime = 0;
        session.silenceCount = 0;
        session.species = [];
        session.speciesDetCounts = {};
        session.lat = opts.lat || 0;
        session.lng = opts.lng || 0;
        session.weather = opts.weather || '';
        session.temperature = opts.temperature || '';
        session.highlightSpecies = '';
        session.highlightConfidence = 0;
        session.totalSilentMin = 0;
        session.openingSent = false;
        session.gpsReady = (session.lat !== 0 && session.lng !== 0);

        _startSilenceWatch();

        if (session.gpsReady) {
            _fetchOpening();
        } else {
            openingWaitTimer = setInterval(function() {
                if (session.lat !== 0 && session.lng !== 0) {
                    clearInterval(openingWaitTimer);
                    openingWaitTimer = null;
                    if (!session.openingSent) _fetchOpening();
                }
            }, 1000);
            setTimeout(function() {
                if (openingWaitTimer) { clearInterval(openingWaitTimer); openingWaitTimer = null; }
                if (!session.openingSent) _fetchOpening();
            }, 15000);
        }
    }

    function endSession() {
        if (!session.active) return;
        session.active = false;
        if (openingWaitTimer) { clearInterval(openingWaitTimer); openingWaitTimer = null; }
        _stopSilenceWatch();
        _fetchClosing();
    }

    function onDetection(det) {
        if (!session.active) return;
        session.detectionCount++;
        session.lastDetectionTime = Date.now();
        var name = det.japanese_name || det.name;
        var key = det.scientific_name || name;
        session.speciesDetCounts[key] = (session.speciesDetCounts[key] || 0) + 1;
        if (session.species.indexOf(name) === -1) session.species.push(name);
        if ((det.confidence || 0) > session.highlightConfidence) {
            session.highlightSpecies = name;
            session.highlightConfidence = det.confidence || 0;
        }
    }

    function getCurrentLens(det) {
        var name = det ? (det.japanese_name || det.name) : '';
        var key = det ? (det.scientific_name || name) : '';
        var conf = det ? (det.confidence || 0) : 0;
        var thisSpeciesCount = session.speciesDetCounts[key] || 0;
        var isNewToUser = det ? !!det._isNewToUser : false;
        var isNewInSession = thisSpeciesCount <= 1;
        var elapsed = Math.floor((Date.now() - session.startTime) / 60000);

        // Life List に未登録の種 → 必ず wonder（本当の「新しい出会い」）
        if (isNewToUser && conf >= 0.5) return 'wonder';

        // セッション初検出 → wonder
        if (session.detectionCount <= 1) return 'wonder';

        // 同種の再検出3回以上 → mastery（見分け方や生態の深い話）
        if (thisSpeciesCount >= 3) return 'mastery';

        // セッション後半（20分以降） → memory に傾ける
        if (elapsed >= 20) {
            return (session.detectionCount % 2 === 0) ? 'memory' : 'quest';
        }

        // 3種以上見つかったら contribution
        if (session.species.length >= 3 && session.detectionCount % 3 === 0) return 'contribution';

        // セッション内で初めての種（Life Listには既存） → quest（次を探す動機）
        if (isNewInSession) return 'quest';

        // 通常: wonder と quest を交互
        return (session.detectionCount % 2 === 0) ? 'quest' : 'wonder';
    }

    function getSessionState() {
        return {
            detectionCount: session.detectionCount,
            speciesCount: session.species.length,
            species: session.species.slice(),
            elapsedMin: Math.floor((Date.now() - session.startTime) / 60000),
            highlightSpecies: session.highlightSpecies,
            silentMin: session.totalSilentMin,
        };
    }

    function updatePosition(lat, lng) {
        session.lat = lat;
        session.lng = lng;
    }

    function _voiceResult(json) {
        if (!json || !json.success || !json.data) return;
        var d = json.data;
        if (d.audio_url) VoiceGuide.announceAudio(d.audio_url);
        else if (d.guide_text) VoiceGuide.announce(d.guide_text);
    }

    function _fetchOpening() {
        session.openingSent = true;
        if (!VoiceGuide.isEnabled()) return;
        var params = new URLSearchParams();
        params.set('mode', 'opening');
        params.set('lat', session.lat);
        params.set('lng', session.lng);
        params.set('weather', session.weather);
        params.set('temperature', session.temperature);
        params.set('voice_mode', VoiceGuide.getVoiceMode());

        fetch('/api/v2/voice_guide.php?' + params.toString())
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(_voiceResult)
            .catch(function() {});
    }

    function _fetchClosing() {
        if (!VoiceGuide.isEnabled()) return;
        var state = getSessionState();
        var params = new URLSearchParams();
        params.set('mode', 'closing');
        params.set('lat', session.lat);
        params.set('lng', session.lng);
        params.set('weather', session.weather);
        params.set('species', session.species.join(','));
        params.set('species_count', state.speciesCount);
        params.set('duration_min', state.elapsedMin);
        params.set('highlight_species', session.highlightSpecies || (session.species[0] || ''));
        params.set('silent_minutes', session.totalSilentMin);
        params.set('voice_mode', VoiceGuide.getVoiceMode());

        fetch('/api/v2/voice_guide.php?' + params.toString())
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(_voiceResult)
            .catch(function() {});
    }

    function _fetchSilence() {
        if (!VoiceGuide.isEnabled() || !session.active) return;
        if (VoiceGuide.isSpeaking()) return;

        var sinceLastDet = Math.floor((Date.now() - session.lastDetectionTime) / 60000);
        session.totalSilentMin = sinceLastDet;

        // 沈黙の深さ段階
        var depth = 'gentle';
        if (session.silenceCount >= 3) depth = 'poetic';
        else if (session.silenceCount >= 1) depth = 'sensory';

        var params = new URLSearchParams();
        params.set('mode', 'silence');
        params.set('lat', session.lat);
        params.set('lng', session.lng);
        params.set('weather', session.weather);
        params.set('silent_min', sinceLastDet);
        params.set('silence_depth', depth);
        params.set('detected_species', session.species.length > 0 ? 'これまでに' + session.species.join('、') + 'を検出' : '');
        params.set('voice_mode', VoiceGuide.getVoiceMode());

        fetch('/api/v2/voice_guide.php?' + params.toString())
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(_voiceResult)
            .catch(function() {});

        session.silenceCount++;
        session.lastSilenceTime = Date.now();
    }

    function _startSilenceWatch() {
        _stopSilenceWatch();
        silenceTimer = setInterval(function() {
            if (!session.active) return;
            var sinceLast = Date.now() - session.lastDetectionTime;
            var sinceSilence = session.lastSilenceTime ? Date.now() - session.lastSilenceTime : Infinity;
            // 最初の沈黙は5分後、以降は間隔を広げる（5分→8分→10分）
            var threshold = SILENCE_INTERVALS[Math.min(session.silenceCount, SILENCE_INTERVALS.length - 1)].minMs;
            if (sinceLast >= threshold && sinceSilence >= threshold) {
                _fetchSilence();
            }
        }, 60000);
    }

    function _stopSilenceWatch() {
        if (silenceTimer) { clearInterval(silenceTimer); silenceTimer = null; }
    }

    return {
        startSession: startSession,
        endSession: endSession,
        onDetection: onDetection,
        getCurrentLens: getCurrentLens,
        getSessionState: getSessionState,
        updatePosition: updatePosition,
    };
})();
