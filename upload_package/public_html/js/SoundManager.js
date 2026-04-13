/**
 * SoundManager.js
 * Synthesized UI sounds for the "Tezawari" experience.
 * Uses Web Audio API for zero-latency, procedural sound generation.
 */
const SoundManager = {
    ctx: null,
    muted: false,

    init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();

            // Resume context on first user interaction (browser policy)
            const unlock = () => {
                if (this.ctx.state === 'suspended') this.ctx.resume();
                document.removeEventListener('click', unlock);
                document.removeEventListener('touchstart', unlock);
            };
            document.addEventListener('click', unlock);
            document.addEventListener('touchstart', unlock);

            // Restore mute state from localStorage
            this.muted = localStorage.getItem('tezawari_muted') === 'true';
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('tezawari_muted', this.muted);
        return this.muted;
    },

    play(type) {
        if (!this.ctx || this.muted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (type) {
            case 'click':
                // Subtle high-pitch tick (Mechanical feel)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
                gain.gain.setValueAtTime(0.05, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                osc.start(t);
                osc.stop(t + 0.05);
                break;

            case 'light-click':
                // Very soft tick for scroll/minor interactions
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(1200, t);
                gain.gain.setValueAtTime(0.02, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
                osc.start(t);
                osc.stop(t + 0.03);
                break;

            case 'success':
                // Uplifting major chord arpeggio (rapid)
                this._playNote(660, 0.0, 0.1, 0.1); // E5
                this._playNote(880, 0.05, 0.1, 0.1); // A5
                this._playNote(1108, 0.1, 0.3, 0.1); // C#6
                break;

            case 'error':
                // Low buzz
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.2);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0.001, t + 0.2);
                osc.start(t);
                osc.stop(t + 0.2);
                break;

            case 'pop':
                // Bubble pop sound for "Like"
                osc.type = 'sine';
                osc.frequency.setValueAtTime(400, t);
                osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;
        }
    },

    _playNote(freq, startTime, duration, vol = 0.1) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + startTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
    }
};

SoundManager.init();
window.SoundManager = SoundManager;
