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

    function _playAudio(url) {
        currentAudio = new Audio(url);
        currentAudio.onended = function() { currentAudio = null; _processQueue(); };
        currentAudio.onerror = function() { currentAudio = null; _processQueue(); };
        currentAudio.play().catch(function() { currentAudio = null; _processQueue(); });
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
