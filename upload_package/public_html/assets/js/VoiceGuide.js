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

    function setOutput(o) {
        output = (VALID_OUTPUTS.indexOf(o) >= 0) ? o : 'bluetooth';
        try { localStorage.setItem('ikimon_voice_output', output); } catch(e) {}
    }

    function setSpeaker(s) {
        speaker = (VALID_SPEAKERS.indexOf(s) >= 0) ? s : 'auto';
        try { localStorage.setItem('ikimon_voice_speaker', speaker); } catch(e) {}
    }

    function getOutput() { return output; }
    function getSpeaker() { return speaker; }
    function isEnabled() { return enabled; }

    // 後方互換: API に渡す voice_mode を組み立てる
    function getVoiceMode() {
        if (output === 'speaker') return 'standard';
        return speaker;  // 'auto' | 'mochiko' | 'ryusei' | 'zundamon'
    }

    // 後方互換: 旧 setVoiceMode を新2軸に変換
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

            // 新形式があればそちらを優先
            var savedOutput = localStorage.getItem('ikimon_voice_output');
            var savedSpeaker = localStorage.getItem('ikimon_voice_speaker');
            if (savedOutput || savedSpeaker) {
                if (VALID_OUTPUTS.indexOf(savedOutput) >= 0) output = savedOutput;
                if (VALID_SPEAKERS.indexOf(savedSpeaker) >= 0) speaker = savedSpeaker;
                return;
            }

            // 旧形式からの移行
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
            // 新形式で保存し直す
            localStorage.setItem('ikimon_voice_output', output);
            localStorage.setItem('ikimon_voice_speaker', speaker);
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
            var dur = currentAudio && currentAudio.duration ? currentAudio.duration * 1000 + 2000 : 15000;
            _audioTimeout = setTimeout(finish, dur);
        }).catch(finish);
    }

    return {
        init: init,
        setEnabled: setEnabled,
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
