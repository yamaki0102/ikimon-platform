/**
 * ikimon.life Voice Assistant — Web Speech API ハイブリッド方式
 *
 * 端末 STT (Web Speech API) → field_assistant API → 端末 TTS (SpeechSynthesis)
 * コスト: ~¥0.075/回の質問応答
 *
 * Usage (Alpine.js):
 *   x-data="voiceAssistant()"
 *   @click="toggleListening()"
 */
function voiceAssistant() {
    return {
        state: 'idle', // idle | listening | thinking | speaking
        partialText: '',
        lastReply: '',
        showReply: false,
        history: [],
        recentDetections: [],
        replyTimer: null,

        recognition: null,
        synth: window.speechSynthesis,

        init() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                console.warn('VoiceAssistant: SpeechRecognition not available');
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ja-JP';
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.continuous = false;

            this.recognition.onresult = (event) => {
                const result = event.results[event.results.length - 1];
                const text = result[0].transcript;
                if (result.isFinal) {
                    this.partialText = '';
                    if (text.trim()) {
                        this.processMessage(text.trim());
                    } else {
                        this.state = 'idle';
                    }
                } else {
                    this.partialText = text;
                }
            };

            this.recognition.onerror = (event) => {
                console.warn('Speech error:', event.error);
                this.state = 'idle';
                this.partialText = '';
            };

            this.recognition.onend = () => {
                if (this.state === 'listening') {
                    this.state = 'idle';
                }
            };
        },

        get isAvailable() {
            return this.recognition !== null;
        },

        get fabIcon() {
            return { idle: '🎤', listening: '⏺', thinking: '💭', speaking: '🔊' }[this.state] || '🎤';
        },

        get fabLabel() {
            return { idle: '質問する', listening: '聴いてるよ...', thinking: '考え中...', speaking: '話し中' }[this.state] || '質問する';
        },

        get fabColor() {
            return {
                idle: 'bg-green-700 hover:bg-green-800',
                listening: 'bg-red-600',
                thinking: 'bg-orange-500',
                speaking: 'bg-blue-700',
            }[this.state] || 'bg-green-700';
        },

        toggleListening() {
            if (this.state === 'idle') {
                this.startListening();
            } else if (this.state === 'speaking') {
                this.stopSpeaking();
            } else {
                this.cancel();
            }
        },

        startListening() {
            if (!this.recognition) return;
            this.stopSpeaking();
            this.state = 'listening';
            this.partialText = '';
            try {
                this.recognition.start();
            } catch (e) {
                console.warn('Recognition start error:', e);
                this.state = 'idle';
            }
        },

        stopSpeaking() {
            this.synth.cancel();
            this.state = 'idle';
        },

        cancel() {
            if (this.recognition) {
                try { this.recognition.abort(); } catch (_) {}
            }
            this.synth.cancel();
            this.state = 'idle';
            this.partialText = '';
        },

        async processMessage(text) {
            this.state = 'thinking';
            this.history.push({ role: 'user', content: text });
            if (this.history.length > 20) this.history.splice(0, this.history.length - 20);

            try {
                const body = {
                    message: text,
                    history: this.history.slice(-10),
                    recent_detections: this.recentDetections,
                };

                const resp = await fetch('/api/v2/field_assistant.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const json = await resp.json();
                if (json.success && json.data?.reply) {
                    const reply = json.data.reply;
                    this.history.push({ role: 'assistant', content: reply });
                    this.lastReply = reply;
                    this.showReply = true;
                    this.speak(reply);

                    if (this.replyTimer) clearTimeout(this.replyTimer);
                    this.replyTimer = setTimeout(() => { this.showReply = false; }, 10000);
                } else {
                    this.lastReply = json.error?.message || '応答を取得できませんでした';
                    this.showReply = true;
                    this.state = 'idle';
                }
            } catch (e) {
                console.error('Field assistant error:', e);
                this.lastReply = '通信エラーが発生しました';
                this.showReply = true;
                this.state = 'idle';
            }
        },

        speak(text) {
            if (!this.synth || !text) {
                this.state = 'idle';
                return;
            }
            this.state = 'speaking';
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';
            utterance.rate = 1.1;
            utterance.onend = () => { this.state = 'idle'; };
            utterance.onerror = () => { this.state = 'idle'; };
            this.synth.speak(utterance);
        },

        addDetection(detection) {
            this.recentDetections.unshift(detection);
            if (this.recentDetections.length > 20) this.recentDetections.pop();
        },
    };
}
