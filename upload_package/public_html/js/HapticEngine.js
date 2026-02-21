/**
 * HapticEngine.js
 * Provides physical feedback for user interactions.
 * Wraps navigator.vibrate with pattern presets.
 */
const HapticEngine = {
    enabled: true,

    init() {
        this.enabled = localStorage.getItem('tezawari_haptics') !== 'false';
    },

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('tezawari_haptics', this.enabled);
        return this.enabled;
    },

    vibrate(pattern) {
        if (!this.enabled || !navigator.vibrate) return;

        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // Ignore errors on devices that don't support it or if context is blocked
        }
    },

    // Presets
    tick() {
        // Very light tap for scroll/selection
        this.vibrate(5);
    },

    light() {
        // Standard interaction (button press)
        this.vibrate(10);
    },

    medium() {
        // Significant interaction (toggle, tab switch)
        this.vibrate(40);
    },

    heavy() {
        // Major action (delete, post)
        this.vibrate(70);
    },

    success() {
        // Double tap
        this.vibrate([30, 50, 30]);
    },

    error() {
        // Triple rapid buzz
        this.vibrate([30, 30, 30, 30, 50]);
    }
};

HapticEngine.init();
window.HapticEngine = HapticEngine;
