/**
 * VoiceGuide — 音声ネイチャーガイド
 *
 * 2モード:
 *   - 'standard': Web Speech API (ブラウザ内蔵TTS)
 *   - 'zundamon': VOICEVOX ずんだもん音声 (サーバー生成)
 *
 * Bluetooth スピーカー対応。キュー管理で重複防止。
 */
var VoiceGuide = (function() {
    var enabled = false;
    var voiceMode = 'standard';  // 'standard' | 'zundamon'
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
        voiceMode = (mode === 'zundamon') ? 'zundamon' : 'standard';
        try { localStorage.setItem('ikimon_voice_mode', voiceMode); } catch(e) {}
    }

    function getVoiceMode() { return voiceMode; }
    function isEnabled() { return enabled; }

    function loadSetting() {
        try {
            if (localStorage.getItem('ikimon_voice_guide') === '1') enabled = true;
            var m = localStorage.getItem('ikimon_voice_mode');
            if (m === 'zundamon') voiceMode = 'zundamon';
        } catch(e) {}
    }

    function announce(text) {
        if (!enabled || !text) return;
        queue.push({ type: 'tts', text: text });
        if (!speaking) _processQueue();
    }

    function announceAudio(audioUrl) {
        if (!enabled || !audioUrl) return;
        queue.push({ type: 'audio', url: audioUrl });
        if (!speaking) _processQueue();
    }

    function stop() {
        queue = [];
        speaking = false;
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

    function _speak(text) {
        if (!('speechSynthesis' in window)) { _processQueue(); return; }
        var utter = new SpeechSynthesisUtterance(text);
        if (voice) utter.voice = voice;
        utter.lang = 'ja-JP';
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        utter.onend = function() { _processQueue(); };
        utter.onerror = function() { _processQueue(); };
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
 * セッションフェーズ: opening → active → closing
 * 沈黙管理: 一定時間検出がなければ silence モードを発動
 */
var GuideOrchestrator = (function() {
    var LENSES = ['wonder', 'quest', 'mastery', 'memory', 'contribution'];
    var SILENCE_THRESHOLD_MS = 5 * 60 * 1000; // 5分

    var session = {
        active: false,
        startTime: 0,
        detectionCount: 0,
        lensIndex: 0,
        lastDetectionTime: 0,
        lastSilenceTime: 0,
        silenceCount: 0,
        species: [],
        lat: 0,
        lng: 0,
        weather: '',
        temperature: '',
        highlightSpecies: '',
        highlightConfidence: 0,
        totalSilentMin: 0,
    };

    var silenceTimer = null;

    function startSession(opts) {
        session.active = true;
        session.startTime = Date.now();
        session.detectionCount = 0;
        session.lensIndex = 0;
        session.lastDetectionTime = Date.now();
        session.lastSilenceTime = 0;
        session.silenceCount = 0;
        session.species = [];
        session.lat = opts.lat || 0;
        session.lng = opts.lng || 0;
        session.weather = opts.weather || '';
        session.temperature = opts.temperature || '';
        session.highlightSpecies = '';
        session.highlightConfidence = 0;
        session.totalSilentMin = 0;

        _startSilenceWatch();
        _fetchOpening();
    }

    function endSession() {
        if (!session.active) return;
        session.active = false;
        _stopSilenceWatch();
        _fetchClosing();
    }

    function onDetection(det) {
        if (!session.active) return;
        session.detectionCount++;
        session.lastDetectionTime = Date.now();
        var name = det.japanese_name || det.name;
        if (session.species.indexOf(name) === -1) session.species.push(name);
        if ((det.confidence || 0) > session.highlightConfidence) {
            session.highlightSpecies = name;
            session.highlightConfidence = det.confidence || 0;
        }
        _resetSilenceWatch();
    }

    function getCurrentLens() {
        var lens = LENSES[session.lensIndex % LENSES.length];
        session.lensIndex++;
        return lens;
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

    function _fetchOpening() {
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
            .then(function(json) {
                if (!json || !json.success || !json.data) return;
                var d = json.data;
                if (d.audio_url) {
                    VoiceGuide.announceAudio(d.audio_url);
                } else if (d.guide_text) {
                    VoiceGuide.announce(d.guide_text);
                }
            })
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
            .then(function(json) {
                if (!json || !json.success || !json.data) return;
                var d = json.data;
                if (d.audio_url) {
                    VoiceGuide.announceAudio(d.audio_url);
                } else if (d.guide_text) {
                    VoiceGuide.announce(d.guide_text);
                }
            })
            .catch(function() {});
    }

    function _fetchSilence() {
        if (!VoiceGuide.isEnabled() || !session.active) return;
        if (VoiceGuide.isSpeaking()) return;

        var sinceLastDet = Math.floor((Date.now() - session.lastDetectionTime) / 60000);
        session.totalSilentMin += Math.min(sinceLastDet, 5);

        var params = new URLSearchParams();
        params.set('mode', 'silence');
        params.set('lat', session.lat);
        params.set('lng', session.lng);
        params.set('weather', session.weather);
        params.set('silent_min', sinceLastDet);
        params.set('detected_species', session.species.length > 0 ? 'これまでに' + session.species.join('、') + 'を検出' : '');
        params.set('voice_mode', VoiceGuide.getVoiceMode());

        fetch('/api/v2/voice_guide.php?' + params.toString())
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(json) {
                if (!json || !json.success || !json.data) return;
                var d = json.data;
                if (d.audio_url) {
                    VoiceGuide.announceAudio(d.audio_url);
                } else if (d.guide_text) {
                    VoiceGuide.announce(d.guide_text);
                }
            })
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
            if (sinceLast >= SILENCE_THRESHOLD_MS && sinceSilence >= SILENCE_THRESHOLD_MS) {
                _fetchSilence();
            }
        }, 60000);
    }

    function _resetSilenceWatch() {
        session.lastDetectionTime = Date.now();
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
