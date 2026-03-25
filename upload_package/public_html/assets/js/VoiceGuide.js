/**
 * VoiceGuide — 音声ネイチャーガイド
 *
 * 出力経路 (output):
 *   - 'bluetooth': VOICEVOX Audio → Bluetooth/車載に乗る
 *   - 'speaker':   Web Speech API (端末スピーカー)
 *
 * 話者 (speaker):
 *   - 'auto':     中立寄り話者を自動選択
 *   - 'mochiko':  もち子さん
 *   - 'ryusei':   青山龍星
 *   - 'zundamon': ずんだもん (キャラ口調)
 *
 * Bluetooth/車載対策:
 *   - Audio要素を使い回し（毎回newしない）で出力先を維持
 *   - A2DPキープアライブで車載BTの休止を防止
 *
 * キュー管理で重複防止。
 */
var VoiceGuide = (function() {
    var enabled = false;
    var output = 'bluetooth';   // 'bluetooth' | 'speaker'
    var speaker = 'auto';       // 'auto' | 'mochiko' | 'ryusei' | 'zundamon'
    var voice = null;
    var queue = [];
    var speaking = false;
    var currentAudio = null;
    var onFinishCallback = null;

    var VALID_OUTPUTS = ['bluetooth', 'speaker'];
    var VALID_SPEAKERS = ['auto', 'mochiko', 'ryusei', 'zundamon'];

    // --- A2DP キープアライブ ---
    // 車載Bluetoothは無音が続くとA2DPを休止し、次の再生がスマホスピーカーに
    // フォールバックする。極小音量の無音ループで接続を維持する。
    var _keepAliveAudio = null;
    var _keepAliveInterval = null;
    // 0.1秒の無音WAV (PCM 8kHz mono 16bit)
    var SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

    function _startKeepAlive() {
        if (_keepAliveAudio) return;
        try {
            _keepAliveAudio = new Audio(SILENT_WAV);
            _keepAliveAudio.loop = true;
            _keepAliveAudio.volume = 0.01;
            _keepAliveAudio.play().catch(function() {});
            // iOSなどでloopが効かない場合のフォールバック
            _keepAliveInterval = setInterval(function() {
                if (_keepAliveAudio && _keepAliveAudio.paused) {
                    _keepAliveAudio.play().catch(function() {});
                }
            }, 5000);
        } catch(e) {}
    }

    function _stopKeepAlive() {
        if (_keepAliveInterval) { clearInterval(_keepAliveInterval); _keepAliveInterval = null; }
        if (_keepAliveAudio) { _keepAliveAudio.pause(); _keepAliveAudio = null; }
    }

    // --- 永続Audio要素（使い回し用）---
    var _audioEl = null;

    function _getAudioEl() {
        if (!_audioEl) {
            _audioEl = new Audio();
            _audioEl.crossOrigin = 'anonymous';
        }
        return _audioEl;
    }

    function init() {
        if ('speechSynthesis' in window) {
            _selectJaVoice();
            speechSynthesis.onvoiceschanged = _selectJaVoice;
        }
        _getAudioEl();
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
        if (on && output === 'bluetooth') {
            _startKeepAlive();
        } else {
            stop();
            _stopKeepAlive();
        }
        try { localStorage.setItem('ikimon_voice_guide', on ? '1' : '0'); } catch(e) {}
    }

    function setOutput(o) {
        output = (VALID_OUTPUTS.indexOf(o) >= 0) ? o : 'bluetooth';
        if (enabled && output === 'bluetooth') {
            _startKeepAlive();
        } else {
            _stopKeepAlive();
        }
        try { localStorage.setItem('ikimon_voice_output', output); } catch(e) {}
    }

    function setSpeaker(s) {
        speaker = (VALID_SPEAKERS.indexOf(s) >= 0) ? s : 'auto';
        try { localStorage.setItem('ikimon_voice_speaker', speaker); } catch(e) {}
    }

    function getOutput() { return output; }
    function getSpeaker() { return speaker; }
    function isEnabled() { return enabled; }

    function getVoiceMode() {
        if (output === 'speaker') return 'standard';
        return speaker;
    }

    function setVoiceMode(mode) {
        if (mode === 'standard') {
            setOutput('speaker');
        } else if (mode === 'bluetooth') {
            setOutput('bluetooth');
            setSpeaker('auto');
        } else if (VALID_SPEAKERS.indexOf(mode) >= 0) {
            setOutput('bluetooth');
            setSpeaker(mode);
        }
    }

    function loadSetting() {
        try {
            if (localStorage.getItem('ikimon_voice_guide') === '1') enabled = true;

            var savedOutput = localStorage.getItem('ikimon_voice_output');
            var savedSpeaker = localStorage.getItem('ikimon_voice_speaker');
            if (savedOutput || savedSpeaker) {
                if (VALID_OUTPUTS.indexOf(savedOutput) >= 0) output = savedOutput;
                if (VALID_SPEAKERS.indexOf(savedSpeaker) >= 0) speaker = savedSpeaker;
            } else {
                var m = localStorage.getItem('ikimon_voice_mode');
                if (m === 'standard') {
                    output = 'speaker'; speaker = 'auto';
                } else if (m === 'zundamon') {
                    output = 'bluetooth'; speaker = 'zundamon';
                } else if (m === 'mochiko') {
                    output = 'bluetooth'; speaker = 'mochiko';
                } else if (m === 'ryusei') {
                    output = 'bluetooth'; speaker = 'ryusei';
                } else {
                    output = 'bluetooth'; speaker = 'auto';
                }
                localStorage.setItem('ikimon_voice_output', output);
                localStorage.setItem('ikimon_voice_speaker', speaker);
            }

            // 設定復元後、bluetooth有効ならキープアライブ開始
            if (enabled && output === 'bluetooth') {
                _startKeepAlive();
            }
        } catch(e) {}
    }

    var MAX_QUEUE = 4;

    function announce(text) {
        if (!enabled || !text) return;
        // 既に再生中かつキューが溜まっている場合は古いものを捨てて追加
        if (queue.length >= MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE + 1);
        queue.push({ type: 'tts', text: text });
        // speaking フラグを再確認してから処理（非同期コールバック後の状態変化に対応）
        if (!speaking) {
            speaking = true;
            var item = queue.shift();
            _speak(item.text);
        }
    }

    function announceAudio(audioUrl) {
        if (!enabled || !audioUrl) return;
        if (queue.length >= MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE + 1);
        queue.push({ type: 'audio', url: audioUrl });
        if (!speaking) {
            speaking = true;
            var item = queue.shift();
            _playAudio(item.url);
        }
    }

    function playPreview(audioUrl) {
        if (!audioUrl) return;
        stop();
        _playAudio(audioUrl);
    }

    function stop() {
        queue = [];
        speaking = false;
        if (_ttsWatchdog) { clearTimeout(_ttsWatchdog); _ttsWatchdog = null; }
        if (_audioTimeout) { clearTimeout(_audioTimeout); _audioTimeout = null; }
        if (_audioFallback) { clearTimeout(_audioFallback); _audioFallback = null; }
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        if (_audioEl) { _audioEl.pause(); _audioEl.removeAttribute('src'); _audioEl.load(); }
        currentAudio = null;
    }

    function onFinish(fn) { onFinishCallback = fn; }

    var _ambientQueue = [];

    function announceWithHint(response) {
        if (!enabled || !response) return;
        var hint = response.delivery_hint || 'immediate';
        var text = response.guide_text;
        var audioUrl = response.audio_url;

        if (hint === 'ambient_slot') {
            _ambientQueue.push({ text: text, audioUrl: audioUrl });
            return;
        }

        if (hint === 'next_slot') {
            if (speaking) {
                if (audioUrl) {
                    queue.push({ type: 'audio', url: audioUrl });
                } else if (text) {
                    queue.push({ type: 'tts', text: text });
                }
                return;
            }
        }

        if (audioUrl) {
            announceAudio(audioUrl);
        } else if (text) {
            announce(text);
        }
    }

    function drainAmbientQueue() {
        if (_ambientQueue.length === 0) return;
        var item = _ambientQueue.shift();
        if (item.audioUrl) {
            announceAudio(item.audioUrl);
        } else if (item.text) {
            announce(item.text);
        }
    }

    function _processQueue() {
        if (queue.length === 0) {
            speaking = false;
            if (onFinishCallback) onFinishCallback();
            return;
        }
        speaking = true;
        var item = queue.shift();
        if (item.type === 'audio') {
            // _playAudio内でspeaking=falseにしてから_processQueueを再帰呼出し
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
        _ttsWatchdog = setTimeout(function() {
            if (!done) {
                speechSynthesis.cancel();
                finish();
            }
        }, 15000);
        speechSynthesis.speak(utter);
    }

    var _audioTimeout = null;
    var _audioFallback = null;
    // 再生中のfinishコールバック識別子（複数登録防止）
    var _activeFinishId = 0;
    function _playAudio(url) {
        var audio = _getAudioEl();
        // 前のリスナーが残らないよう強制クリア
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audio.volume = 1.0;
        var done = false;
        var myFinishId = ++_activeFinishId;
        if (_audioTimeout) { clearTimeout(_audioTimeout); _audioTimeout = null; }
        if (_audioFallback) { clearTimeout(_audioFallback); _audioFallback = null; }
        function finish() {
            if (done) return;
            // 別のfinishが既に実行済みなら（並走防止）無視
            if (myFinishId !== _activeFinishId && !done) { done = true; return; }
            done = true;
            if (_audioTimeout) { clearTimeout(_audioTimeout); _audioTimeout = null; }
            if (_audioFallback) { clearTimeout(_audioFallback); _audioFallback = null; }
            audio.removeEventListener('ended', finish);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('loadedmetadata', onMeta);
            currentAudio = null;
            speaking = false;
            _processQueue();
        }
        function onError() { finish(); }
        function onMeta() {
            if (done) return;
            if (_audioFallback) { clearTimeout(_audioFallback); _audioFallback = null; }
            if (audio.duration && isFinite(audio.duration)) {
                var safeDur = audio.duration * 1000 + 3000;
                if (_audioTimeout) clearTimeout(_audioTimeout);
                _audioTimeout = setTimeout(finish, safeDur);
            }
        }
        audio.addEventListener('ended', finish);
        audio.addEventListener('error', onError);
        audio.addEventListener('loadedmetadata', onMeta);
        currentAudio = audio;
        audio.src = url;
        audio.load();
        _audioFallback = setTimeout(function() { if (!done) finish(); }, 30000);
        audio.play().catch(finish);
    }

    return {
        init: init,
        setEnabled: setEnabled,
        playPreview: playPreview,
        setOutput: setOutput,
        setSpeaker: setSpeaker,
        getOutput: getOutput,
        getSpeaker: getSpeaker,
        getVoiceMode: getVoiceMode,
        setVoiceMode: setVoiceMode,
        isEnabled: isEnabled,
        loadSetting: loadSetting,
        announce: announce,
        announceAudio: announceAudio,
        announceWithHint: announceWithHint,
        drainAmbientQueue: drainAmbientQueue,
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
